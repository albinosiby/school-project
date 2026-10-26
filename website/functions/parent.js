// Parent app backend (DATA_CONTRACT section 13).
// Parents never read class-wide records; these functions copy each child's slice into par_* collections, keep the parent's
// users/{uid} arrays (studentIds / classIds / grns) in step with students.guardianUids, maintain message threads and send
// parent pushes (FCM + a par_notifications row). Teacher pushes go through the shared notify() of index.js, so the teacher's
// notification settings (classUpdates / parentMessages / parentMute / dnd) apply.
//
// Loop safety: every function that writes back into a collection it is triggered by compares first and writes only on a
// change (classes.classTeacher, com_notices / calendar_events.parentVisible); message counters are applied once per message
// (msg_messages.counted, in a transaction). Projections (par_*) and users docs trigger nothing.
const { FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { logger } = require("firebase-functions/v2");
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");

module.exports = ({ db, notify, chunk, clsLabel, DEAD_TOKEN }) => {
  const S = (sid) => db.collection("schools").doc(sid);
  const nowIso = () => new Date().toISOString();
  /** today's date in India time, YYYY-MM-DD */
  const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const uniq = (a) => [...new Set((a ?? []).filter((x) => typeof x === "string" && x))];
  const sameSet = (a, b) => { const x = uniq(a).sort(), y = uniq(b).sort(); return x.length === y.length && x.every((v, i) => v === y[i]); };
  /** drops undefined values (Firestore rejects them) */
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const labelToClassId = (label) => `cls_${String(label ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase()}`;
  /** ISO string / Timestamp / Date / millis -> millis (0 if unknown) */
  const ms = (v) => (v == null ? 0 : typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : +new Date(v) || 0);

  /** Wraps a handler so that a missing doc / field is logged, never thrown (triggers do not retry). */
  const safe = (name, fn) => async (e) => {
    try { await fn(e); } catch (err) { logger.error(`${name} failed`, { params: e?.params, err: String(err?.stack ?? err) }); }
  };

  const activeStudent = (s) => !!s && s.deleted !== true && (!s.status || /^active$/i.test(String(s.status)));

  /** Active students of a class: students.classId, else grade + section from cls_{grade}{SECTION}. */
  async function classRoster(sid, classId) {
    if (!classId) return [];
    let snap = await S(sid).collection("students").where("classId", "==", classId).get();
    if (snap.empty) {
      const m = /^cls_(\d+)([A-Z])$/.exec(classId);
      if (m) snap = await S(sid).collection("students").where("grade", "==", m[1]).where("section", "==", m[2]).get();
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(activeStudent);
  }

  async function studentDoc(sid, studentId) {
    if (!studentId) return null;
    const s = await S(sid).collection("students").doc(String(studentId)).get();
    return s.exists ? { id: s.id, ...s.data() } : null;
  }

  async function audit(sid, action, detail, actor = "System") {
    await S(sid).collection("set_audit").add({ at: nowIso(), actor, action, detail, kind: "parent", source: "functions" });
  }

  async function userName(uid) {
    if (!uid) return null;
    const u = await db.collection("users").doc(uid).get();
    return u.exists ? u.get("name") || u.get("email") || null : null;
  }

  // ---------------------------------------------------------------------------
  // Parent notifications: a par_notifications row per parent + FCM push to the parent's devices
  // ---------------------------------------------------------------------------

  /**
   * rows: [{uid, studentId, type, title, body, route, id?}]. A row with an `id` is created only once (dedupe); when that
   * id already exists the row and its push are skipped.
   */
  async function notifyParents(sid, rows) {
    const at = nowIso();
    const sent = [];
    for (const r of rows) {
      if (!r?.uid) continue;
      const data = { uid: r.uid, studentId: r.studentId ?? "", type: r.type, title: r.title, body: r.body ?? "", route: r.route ?? "", read: false, at, ord: Date.now() };
      const col = S(sid).collection("par_notifications");
      try {
        if (r.id) await col.doc(r.id).create(data); else await col.add(data);
        sent.push(r);
      } catch (err) {
        if (err?.code === 6 || /already exists/i.test(String(err?.message))) continue; // dedupe hit
        throw err;
      }
    }
    if (!sent.length) return 0;
    // one push per (uid, title, body): siblings in one class get one push per child, which is what parents expect
    const byUid = new Map();
    for (const r of sent) (byUid.get(r.uid) ?? byUid.set(r.uid, []).get(r.uid)).push(r);
    for (const [uid, list] of byUid) {
      const snap = await db.collection("users").doc(uid).collection("fcm_tokens").get();
      const tokens = snap.docs.filter((d) => (d.get("app") ?? "parent") === "parent").map((d) => ({ token: d.id, ref: d.ref }));
      if (!tokens.length) continue;
      for (const r of list) {
        for (const part of chunk(tokens, 500)) {
          try {
            const res = await getMessaging().sendEachForMulticast({
              tokens: part.map((t) => t.token),
              notification: { title: r.title, body: r.body ?? "" },
              data: { route: r.route ?? "", type: r.type ?? "" },
              android: { priority: "high" },
              apns: { payload: { aps: { sound: "default" } } },
            });
            const dead = res.responses.map((x, i) => (!x.success && DEAD_TOKEN.has(x.error?.code) ? part[i].ref : null)).filter(Boolean);
            await Promise.all(dead.map((d) => d.delete()));
            logger.info("parent push sent", { sid, type: r.type, sent: res.successCount, failed: res.failureCount, removed: dead.length });
          } catch (err) {
            logger.warn("parent push failed", { sid, uid, type: r.type, err: String(err?.message ?? err) });
          }
        }
      }
    }
    return sent.length;
  }

  /** [{uid, student}] for every guardian login of these students */
  const guardiansOf = (students) => students.flatMap((s) => uniq(s?.guardianUids).map((uid) => ({ uid, student: s })));

  // ---------------------------------------------------------------------------
  // 13.1 accounts: users/{uid}.studentIds / classIds / grns follow students.guardianUids
  // ---------------------------------------------------------------------------

  async function syncParentUser(sid, uid) {
    const ref = db.collection("users").doc(uid);
    const u = await ref.get();
    if (!u.exists || u.get("schoolId") !== sid || u.get("role") !== "parent") { logger.info("guardian uid has no parent login in this school", { sid, uid }); return; }
    const snap = await S(sid).collection("students").where("guardianUids", "array-contains", uid).get();
    const kids = snap.docs.filter((d) => d.get("deleted") !== true);
    const next = {
      studentIds: uniq(kids.map((d) => d.id)).sort(),
      classIds: uniq(kids.map((d) => d.get("classId"))).sort(),
      grns: uniq(kids.map((d) => (d.get("grn") == null ? null : String(d.get("grn"))))).sort(),
    };
    if (["studentIds", "classIds", "grns"].every((k) => JSON.stringify(u.get(k) ?? []) === JSON.stringify(next[k]))) return;
    await ref.update({ ...next, updatedAt: nowIso(), updatedBy: "functions" });
  }

  const linkedUids = (s) => (s && s.deleted !== true ? uniq(s.guardianUids) : []);

  const onStudentWritten = onDocumentWritten("schools/{sid}/students/{id}", safe("onStudentWritten", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    const bU = linkedUids(before), aU = linkedUids(after);
    const relevant = !before || !after || !sameSet(bU, aU) || before.classId !== after.classId || before.grn !== after.grn
      || (before.deleted === true) !== (after.deleted === true) || !sameSet(before.guardianUids, after.guardianUids);
    if (!relevant) return;
    for (const uid of uniq([...(before?.guardianUids ?? []), ...(after?.guardianUids ?? [])])) await syncParentUser(sid, uid);

    const name = after?.name ?? before?.name ?? id;
    const actor = (await userName(after?.updatedBy ?? before?.updatedBy)) ?? "System";
    if (!before && after) await audit(sid, "Student record created", `${name} (${id})`, actor);
    if (before && !after) await audit(sid, "Student record deleted", `${name} (${id})`, actor);
    for (const uid of aU.filter((u) => !bU.includes(u))) await audit(sid, "Parent login linked", `${(await userName(uid)) ?? uid} linked to ${name} (${id})`, actor);
    for (const uid of bU.filter((u) => !aU.includes(u))) await audit(sid, "Parent login unlinked", `${(await userName(uid)) ?? uid} unlinked from ${name} (${id})`, actor);
  }));

  // ---------------------------------------------------------------------------
  // classes.classTeacher (name) follows classTeacherId; a staff rename updates their classes
  // (a separate trigger: onClassTeacherChanged is an onDocumentUpdated function and a deployed function cannot change its event type)
  // ---------------------------------------------------------------------------

  const onClassTeacherNameSync = onDocumentWritten("schools/{sid}/classes/{id}", safe("onClassTeacherNameSync", async (e) => {
    const after = e.data?.after?.data();
    if (!after) return;
    let name = "";
    if (after.classTeacherId) {
      const s = await S(e.params.sid).collection("staff").doc(String(after.classTeacherId)).get();
      name = s.exists ? s.get("name") ?? "" : after.classTeacher ?? ""; // unknown staff: keep what is there
    }
    if ((after.classTeacher ?? "") === name) return;
    await e.data.after.ref.update({ classTeacher: name });
  }));

  const onStaffRenamed = onDocumentUpdated("schools/{sid}/staff/{id}", safe("onStaffRenamed", async (e) => {
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after?.name || before?.name === after.name) return;
    const snap = await S(e.params.sid).collection("classes").where("classTeacherId", "==", e.params.id).get();
    await Promise.all(snap.docs.filter((d) => d.get("classTeacher") !== after.name).map((d) => d.ref.update({ classTeacher: after.name })));
  }));

  // ---------------------------------------------------------------------------
  // 13.2 attendance: par_attendance/{studentId}_{YYYY-MM}
  // ---------------------------------------------------------------------------

  /** The record that decides a class's day (§9): newest updatedAt, ties higher period. Drafts (submitted:false) do not count. */
  async function dayRecord(sid, classId, date) {
    const snap = await S(sid).collection("ops_attendance").where("classId", "==", classId).where("date", "==", date).get();
    const recs = snap.docs.map((d) => d.data()).filter((r) => r.submitted !== false && r.deleted !== true);
    recs.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt) || Number(b.period ?? 0) - Number(a.period ?? 0));
    return recs[0] ?? null;
  }

  /** Recomputes one class-day for every student; returns [{student, status}] whose status changed to A or L. */
  async function syncAttendanceDay(sid, classId, date) {
    const [rec, roster] = await Promise.all([dayRecord(sid, classId, date), classRoster(sid, classId)]);
    if (!roster.length) return [];
    const month = date.slice(0, 7);
    const refs = roster.map((s) => S(sid).collection("par_attendance").doc(`${s.id}_${month}`));
    const cur = await db.getAll(...refs);
    const flagged = [];
    let batch = db.batch(), n = 0;
    for (let i = 0; i < roster.length; i++) {
      const s = roster[i];
      const was = cur[i].exists ? cur[i].get("days")?.[date] : undefined;
      const status = rec ? (["A", "L", "E"].includes(rec.marks?.[s.id]) ? rec.marks[s.id] : "P") : undefined;
      if (status === was) continue;
      batch.set(refs[i], { studentId: s.id, classId, month, days: { [date]: status ?? FieldValue.delete() }, updatedAt: nowIso() }, { merge: true });
      if (status === "A" || status === "L") flagged.push({ student: s, status });
      if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n) await batch.commit();
    return flagged;
  }

  const onAttendanceForParents = onDocumentWritten("schools/{sid}/ops_attendance/{id}", safe("onAttendanceForParents", async (e) => {
    const sid = e.params.sid;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    const days = new Map();
    for (const r of [before, after]) if (r?.classId && /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "")) days.set(`${r.classId}|${r.date}`, r);
    for (const key of days.keys()) {
      const [classId, date] = key.split("|");
      const flagged = await syncAttendanceDay(sid, classId, date);
      // absence alert: only for today's attendance, once per child per day (and parent)
      if (!flagged.length || date !== istToday()) continue;
      await notifyParents(sid, guardiansOf(flagged.map((f) => f.student)).map(({ uid, student }) => {
        const st = flagged.find((f) => f.student.id === student.id).status;
        return {
          id: `att_${date}_${student.id}_${uid}`, uid, studentId: student.id, type: "attendance",
          title: st === "A" ? "Absence alert" : "Late arrival",
          body: `${student.name ?? "Your child"} was marked ${st === "A" ? "absent" : "late"} today`, route: "/academics?section=attendance",
        };
      }));
    }
  }));

  // ---------------------------------------------------------------------------
  // 13.2 homework: par_homework/{studentId}_{homeworkId}
  // ---------------------------------------------------------------------------

  const hwHidden = (h) => !h || h.deleted === true || /draft/i.test(String(h.status ?? ""));
  const hwShared = (h, id) => clean({
    homeworkId: id, classId: h.classId, title: h.title ?? "", subject: h.subject ?? "", description: h.description ?? "",
    teacher: h.teacher ?? "", teacherId: h.teacherId ?? "", assigned: h.assigned ?? h.createdAt ?? null, due: h.due ?? null,
    maxMarks: h.maxMarks ?? null, status: h.status ?? "open", attachments: h.attachments,
  });
  const hwSubmission = (h, sid) => {
    const x = h?.submissions?.[sid];
    if (!x || typeof x !== "object") return { status: "pending" };
    return clean({ status: x.status ?? "pending", marks: x.marks, feedback: x.feedback, gradedAt: x.gradedAt });
  };

  async function deleteWhere(q) {
    const snap = await q.get();
    for (const part of chunk(snap.docs, 450)) { const b = db.batch(); part.forEach((d) => b.delete(d.ref)); await b.commit(); }
    return snap.size;
  }

  const onHomeworkForParents = onDocumentWritten("schools/{sid}/ops_homework/{id}", safe("onHomeworkForParents", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (hwHidden(after)) {
      if (!hwHidden(before) || !after) await deleteWhere(S(sid).collection("par_homework").where("homeworkId", "==", id));
      return;
    }
    const roster = await classRoster(sid, after.classId);
    const shared = hwShared(after, id);
    const fresh = hwHidden(before) || before.classId !== after.classId;
    // backfilledAt (tools/parent_backfill) forces a full refresh of the copies without any push
    const sharedChanged = fresh || before?.backfilledAt !== after.backfilledAt || JSON.stringify(hwShared(before, id)) !== JSON.stringify(shared);
    const targets = sharedChanged ? roster
      : roster.filter((s) => JSON.stringify(hwSubmission(before, s.id)) !== JSON.stringify(hwSubmission(after, s.id)));
    for (const part of chunk(targets, 450)) {
      const b = db.batch();
      for (const s of part) {
        b.set(S(sid).collection("par_homework").doc(`${s.id}_${id}`), { ...shared, studentId: s.id, submission: hwSubmission(after, s.id), updatedAt: nowIso() });
      }
      await b.commit();
    }
    if (fresh && before?.classId && before.classId !== after.classId) {
      // moved to another class: drop the old class's copies
      const keep = new Set(roster.map((s) => `${s.id}_${id}`));
      const old = await S(sid).collection("par_homework").where("homeworkId", "==", id).get();
      await Promise.all(old.docs.filter((d) => !keep.has(d.id)).map((d) => d.ref.delete()));
    }

    const rows = [];
    if (fresh) {
      for (const { uid, student } of guardiansOf(roster)) {
        rows.push({ id: `hw_${id}_${student.id}_${uid}`, uid, studentId: student.id, type: "homework", title: `New homework: ${after.title ?? "Homework"}`,
          body: `${after.subject ?? ""}${after.due ? ` · due ${after.due}` : ""}`.replace(/^ · /, ""), route: `/academics/homework/${id}` });
      }
    }
    const graded = roster.filter((s) => hwSubmission(after, s.id).status === "graded" && hwSubmission(before, s.id).status !== "graded");
    for (const { uid, student } of guardiansOf(graded)) {
      const sub = hwSubmission(after, student.id);
      rows.push({ id: `hwg_${id}_${student.id}_${uid}`, uid, studentId: student.id, type: "homework", title: `${after.title ?? "Homework"} reviewed`,
        body: `${student.name ?? "Your child"}${sub.marks != null ? `: ${sub.marks}${after.maxMarks ? `/${after.maxMarks}` : ""}` : ""}${sub.feedback ? ` · ${sub.feedback}` : ""}`,
        route: `/academics/homework/${id}` });
    }
    if (rows.length) await notifyParents(sid, rows);
  }));

  // ---------------------------------------------------------------------------
  // 13.2 results: par_results/{studentId}_{paperId}, only for published classes ("10-B" in exm_papers.published)
  // ---------------------------------------------------------------------------

  const markStudentId = (m) => m?.studentId || String(m?.candId ?? "").replace(/^cand_/, "") || null;

  function resultDoc(paper, paperId, cycleTitle, classId, studentId, m) {
    const theory = typeof m.theory === "number" ? m.theory : null, internal = typeof m.internal === "number" ? m.internal : null;
    const theoryMax = Number(paper.theory ?? 80), internalMax = Number(paper.internal ?? 20);
    return {
      studentId, paperId, classId, cycleId: paper.cycleId ?? "", exam: cycleTitle ?? "", subject: paper.subject ?? "", code: paper.code ?? "",
      date: paper.date ?? "", theory, internal, theoryMax, internalMax,
      obtained: theory === null && internal === null ? null : (theory ?? 0) + (internal ?? 0), max: theoryMax + internalMax,
      medical: m.medical === true, updatedAt: nowIso(),
    };
  }

  async function cycleTitle(sid, cycleId) {
    if (!cycleId) return "";
    const c = await S(sid).collection("exm_cycles").doc(String(cycleId)).get();
    return c.exists ? c.get("title") ?? "" : "";
  }

  /** Writes the class's results of one paper; returns the students that got a result. */
  async function writeClassResults(sid, paperId, paper, label) {
    const classId = labelToClassId(label);
    const [roster, marks, exam] = await Promise.all([
      classRoster(sid, classId), S(sid).collection("exm_marks").where("paperId", "==", paperId).get(), cycleTitle(sid, paper.cycleId),
    ]);
    const byStudent = new Map(marks.docs.map((d) => [markStudentId(d.data()), d.data()]));
    const got = roster.filter((s) => byStudent.has(s.id));
    for (const part of chunk(got, 450)) {
      const b = db.batch();
      for (const s of part) b.set(S(sid).collection("par_results").doc(`${s.id}_${paperId}`), resultDoc(paper, paperId, exam, classId, s.id, byStudent.get(s.id)));
      await b.commit();
    }
    return { got, exam };
  }

  const onPaperForParents = onDocumentWritten("schools/{sid}/exm_papers/{id}", safe("onPaperForParents", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after) { await deleteWhere(S(sid).collection("par_results").where("paperId", "==", id)); return; }
    const pubBefore = uniq(before?.published), pubAfter = uniq(after.published);
    const newly = pubAfter.filter((c) => !pubBefore.includes(c)), removed = pubBefore.filter((c) => !pubAfter.includes(c));
    const detailsChanged = !!before && ["subject", "code", "date", "theory", "internal", "cycleId"].some((k) => before[k] !== after[k]);
    // unpublished (e.g. the admin edits marks again): hide that class's results until it is published again
    if (removed.length) {
      const gone = new Set(removed.map(labelToClassId));
      const snap = await S(sid).collection("par_results").where("paperId", "==", id).get();
      await Promise.all(snap.docs.filter((d) => gone.has(d.get("classId"))).map((d) => d.ref.delete()));
    }
    for (const label of detailsChanged ? pubAfter : newly) {
      const { got, exam } = await writeClassResults(sid, id, after, label);
      if (!newly.includes(label)) continue;
      await notifyParents(sid, guardiansOf(got).map(({ uid, student }) => ({
        id: `res_${id}_${student.id}_${uid}`, uid, studentId: student.id, type: "results",
        title: `${exam || "Exam"} results: ${after.subject ?? ""}`.trim(), body: `${student.name ?? "Your child"}'s ${after.subject ?? ""} result is out`, route: "/academics",
      })));
    }
  }));

  // marks changed after the class was published: refresh that child's result (no push)
  const onMarkForParents = onDocumentWritten("schools/{sid}/exm_marks/{id}", safe("onMarkForParents", async (e) => {
    const sid = e.params.sid;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    const m = after ?? before;
    const studentId = markStudentId(m);
    if (!m?.paperId || !studentId) return;
    const [paperSnap, student] = await Promise.all([S(sid).collection("exm_papers").doc(String(m.paperId)).get(), studentDoc(sid, studentId)]);
    if (!paperSnap.exists || !student?.classId) return;
    const paper = paperSnap.data();
    if (!uniq(paper.published).includes(clsLabel(student.classId))) return;
    const ref = S(sid).collection("par_results").doc(`${studentId}_${m.paperId}`);
    if (!after) { await ref.delete(); return; }
    await ref.set(resultDoc(paper, m.paperId, await cycleTitle(sid, paper.cycleId), student.classId, studentId, after));
  }));

  // ---------------------------------------------------------------------------
  // notices and calendar: parentVisible flag (written only when it changes)
  // ---------------------------------------------------------------------------

  const PARENT_AUDIENCE = /parent|guardian|all school|whole school|everyone/i;
  const noticeVisible = (n) => !!n && n.deleted !== true && n.status === "Published" && PARENT_AUDIENCE.test(String(n.audience ?? ""));
  const eventVisible = (ev) => !!ev && ev.deleted !== true && ev.status === "published";

  /** parent users of the school; with grades (["Grade 8-A", "Grade 9"]) only those with a child in a matching class */
  async function schoolParents(sid, grades) {
    const snap = await db.collection("users").where("schoolId", "==", sid).where("role", "==", "parent").get();
    const tests = uniq(grades).map((g) => {
      const m = /(\d+)\s*-?\s*([A-Z])?\b/i.exec(g);
      return m ? new RegExp(`^cls_${m[1]}${m[2] ? m[2].toUpperCase() : "[A-Z]"}$`) : null;
    }).filter(Boolean);
    return snap.docs.filter((d) => !tests.length || (d.get("classIds") ?? []).some((c) => tests.some((t) => t.test(c))));
  }

  const onNoticeForParents = onDocumentWritten("schools/{sid}/com_notices/{id}", safe("onNoticeForParents", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after) return;
    const vis = noticeVisible(after);
    if (after.parentVisible !== vis) await e.data.after.ref.update({ parentVisible: vis });
    if (!vis || noticeVisible(before)) return;
    const parents = await schoolParents(sid, after.grades);
    await notifyParents(sid, parents.map((u) => ({
      id: `ntc_${id}_${u.id}`, uid: u.id, studentId: "", type: "notice", title: after.urgent ? `Urgent: ${after.title}` : after.title ?? "New notice",
      body: String(after.body ?? "").replace(/\s+/g, " ").slice(0, 140), route: "/notifications",
    })));
  }));

  const onCalendarForParents = onDocumentWritten("schools/{sid}/calendar_events/{id}", safe("onCalendarForParents", async (e) => {
    const after = e.data?.after?.data();
    if (!after) return;
    const vis = eventVisible(after);
    if (after.parentVisible !== vis) await e.data.after.ref.update({ parentVisible: vis });
  }));

  // a parent acknowledges a notice: com_notices/{id}/acks/{uid}
  const onNoticeAck = onDocumentCreated("schools/{sid}/com_notices/{id}/acks/{uid}", safe("onNoticeAck", async (e) => {
    const ref = S(e.params.sid).collection("com_notices").doc(e.params.id);
    if (!(await ref.get()).exists) return;
    await ref.update({ acked: FieldValue.increment(1), read: FieldValue.increment(1) });
  }));

  // ---------------------------------------------------------------------------
  // 13.3 student leave requests
  // ---------------------------------------------------------------------------

  const range = (from, to) => (to && to !== from ? `${from} to ${to}` : from ?? "");

  const onStudentLeaveRequested = onDocumentCreated("schools/{sid}/student_leaves/{id}", safe("onStudentLeaveRequested", async (e) => {
    const sid = e.params.sid, l = e.data?.data();
    if (!l?.parentUid || l.status !== "Pending" || !l.classId) return;
    const cls = await S(sid).collection("classes").doc(String(l.classId)).get();
    const ct = cls.exists ? cls.get("classTeacherId") : null;
    if (!ct) { logger.info("student leave: class has no class teacher", { sid, classId: l.classId }); return; }
    const name = l.name ?? (await studentDoc(sid, l.studentId))?.name ?? "A student";
    await notify(sid, [ct], {
      type: "leave", category: "Duties", tag: "Leave Request", title: `${name} (${clsLabel(l.classId)})`,
      body: `Leave requested ${range(l.from, l.to)}${l.reason ? `: ${l.reason}` : ""}`, route: "/leave-management/students",
    });
  }));

  const onStudentLeaveDecided = onDocumentUpdated("schools/{sid}/student_leaves/{id}", safe("onStudentLeaveDecided", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after || before?.status === after.status || !["Approved", "Rejected"].includes(after.status)) return;
    const student = await studentDoc(sid, after.studentId);
    const uids = uniq([after.parentUid, ...(student?.guardianUids ?? [])]);
    await notifyParents(sid, uids.map((uid) => ({
      id: `lv_${id}_${after.status}_${uid}`, uid, studentId: after.studentId ?? "", type: "leave", title: `Leave ${after.status.toLowerCase()}`,
      body: `${after.name ?? student?.name ?? "Leave"} · ${range(after.from, after.to)}${after.decisionNote ? ` · ${after.decisionNote}` : ""}`, route: "/more/leave",
    })));
  }));

  // ---------------------------------------------------------------------------
  // 13.3 messages: thread last* / unread counters (once per message) and pushes
  // ---------------------------------------------------------------------------

  const onMessageCreated = onDocumentCreated("schools/{sid}/msg_messages/{id}", safe("onMessageCreated", async (e) => {
    const sid = e.params.sid, m = e.data?.data();
    if (!m?.threadId || !["parent", "teacher"].includes(m.from)) return;
    const threadRef = S(sid).collection("msg_threads").doc(String(m.threadId)), msgRef = e.data.ref;
    const thread = await db.runTransaction(async (tx) => {
      const [ms, ts] = await Promise.all([tx.get(msgRef), tx.get(threadRef)]);
      if (!ts.exists || !ms.exists || ms.get("counted") === true) return null;
      tx.update(threadRef, {
        lastMessage: String(m.text ?? "").slice(0, 300), lastAt: m.at ?? nowIso(), lastFrom: m.from,
        [m.from === "parent" ? "unreadTeacher" : "unreadParent"]: FieldValue.increment(1), updatedAt: nowIso(),
      });
      tx.update(msgRef, { counted: true });
      return ts.data();
    });
    if (!thread) return;
    const text = String(m.text ?? "").replace(/\s+/g, " ").slice(0, 140);
    if (m.from === "parent") {
      if (!thread.teacherId) return;
      await notify(sid, [thread.teacherId], {
        type: "message", category: "Messages", tag: "Parent Message",
        title: `${m.name ?? thread.guardian ?? "Parent"}${thread.studentName ? ` (${thread.studentName})` : ""}`, body: text, route: "/messages",
      });
    } else {
      await notifyParents(sid, uniq(thread.parentUids).filter((u) => u !== m.uid).map((uid) => ({
        id: `msg_${e.params.id}_${uid}`, uid, studentId: thread.studentId ?? "", type: "message",
        title: thread.teacher ?? m.name ?? "Teacher", body: text, route: `/messages/thread/${m.threadId}`,
      })));
    }
  }));

  // ---------------------------------------------------------------------------
  // live classes and fees
  // ---------------------------------------------------------------------------

  const onLiveClassForParents = onDocumentCreated("schools/{sid}/live_classes/{id}", safe("onLiveClassForParents", async (e) => {
    const sid = e.params.sid, c = e.data?.data();
    if (!c?.classId || /draft|cancel/i.test(String(c.status ?? ""))) return;
    const roster = await classRoster(sid, c.classId);
    await notifyParents(sid, guardiansOf(roster).map(({ uid, student }) => ({
      id: `live_${e.params.id}_${student.id}_${uid}`, uid, studentId: student.id, type: "live",
      title: `Live class: ${c.title ?? c.subject ?? "Online class"}`, body: [c.subject, [c.date, c.time].filter(Boolean).join(" at ")].filter(Boolean).join(" · "), route: "/more/live",
    })));
  }));

  async function studentsByGrn(sid, grn) {
    if (grn == null || grn === "") return [];
    const snap = await S(sid).collection("students").where("grn", "==", String(grn)).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.deleted !== true);
  }
  const rupees = (n) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "");

  const onFeeInvoiceCreated = onDocumentCreated("schools/{sid}/fee_invoices/{id}", safe("onFeeInvoiceCreated", async (e) => {
    const sid = e.params.sid, inv = e.data?.data();
    const kids = await studentsByGrn(sid, inv?.grn);
    await notifyParents(sid, guardiansOf(kids).map(({ uid, student }) => ({
      id: `inv_${e.params.id}_${uid}`, uid, studentId: student.id, type: "fees", title: `Fee invoice ${inv.no ?? ""}`.trim(),
      body: [`${student.name ?? inv.student ?? ""}`, rupees(inv.balance ?? inv.amount), inv.due ? `due ${inv.due}` : ""].filter(Boolean).join(" · "), route: "/fees",
    })));
  }));

  const onFeePaymentCreated = onDocumentCreated("schools/{sid}/fee_payments/{id}", safe("onFeePaymentCreated", async (e) => {
    const sid = e.params.sid, p = e.data?.data();
    const kids = await studentsByGrn(sid, p?.grn);
    await notifyParents(sid, guardiansOf(kids).map(({ uid, student }) => ({
      id: `pay_${e.params.id}_${uid}`, uid, studentId: student.id, type: "fees", title: "Payment received",
      body: [p.receiptNo ? `Receipt ${p.receiptNo}` : "", rupees(p.amount), p.mode ?? ""].filter(Boolean).join(" · "), route: "/fees",
    })));
  }));

  // ---------------------------------------------------------------------------
  // 13.5 consents -> set_audit
  // ---------------------------------------------------------------------------

  const onConsentWritten = onDocumentWritten("schools/{sid}/consents/{uid}", safe("onConsentWritten", async (e) => {
    const sid = e.params.sid, uid = e.params.uid;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    const items = after?.items ?? {};
    const withdrawn = !after || after.withdrawn === true;
    const action = withdrawn ? "Consent withdrawn" : before ? "Consent updated" : "Consent recorded";
    if (before && after && JSON.stringify(before.items ?? {}) === JSON.stringify(items) && before.version === after.version && before.withdrawn === after.withdrawn) return;
    const who = (await userName(uid)) ?? uid;
    const detail = `${who} (students ${uniq(after?.studentIds ?? before?.studentIds).join(", ") || "-"})${withdrawn ? "" : `: v${after.version ?? "?"}; ` +
      Object.entries(items).map(([k, v]) => `${k} ${v ? "yes" : "no"}`).join(", ")}`;
    await audit(sid, action, detail, who);
  }));

  return {
    onStudentWritten, onClassTeacherNameSync, onStaffRenamed, onAttendanceForParents, onHomeworkForParents, onPaperForParents,
    onMarkForParents, onNoticeForParents, onCalendarForParents, onNoticeAck, onStudentLeaveRequested, onStudentLeaveDecided,
    onMessageCreated, onLiveClassForParents, onFeeInvoiceCreated, onFeePaymentCreated, onConsentWritten,
  };
};
