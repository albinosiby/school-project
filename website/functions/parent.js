// Parent app backend (DATA_CONTRACT section 13).
// Parents never read class-wide records; these functions copy each child's slice into par_* collections, keep the parent's
// users/{uid} arrays (studentIds / classIds / grns) in step with students.guardianUids, maintain message threads and send
// parent pushes (FCM + a par_notifications row). Teacher pushes go through the shared notify() of index.js, so the teacher's
// notification settings (classUpdates / parentMessages / parentMute / dnd) apply.
//
// Loop safety: every function that writes back into a collection it is triggered by compares first and writes only on a
// change (classes.classTeacher, com_notices / calendar_events.parentVisible); message counters are applied once per message
// (msg_messages.counted, in a transaction). Projections (par_*) and users docs trigger nothing.
const { assessMark } = require("./examAssessment");
const { FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { logger } = require("firebase-functions/v2");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { labelToClassId, audienceClassTest } = require("./classIdentity");

// `shared` (optional) receives the helpers other codebases reuse (transport.js: notifyParents, guardiansOf, istToday, safe).
module.exports = ({ db, notify, chunk, clsLabel, DEAD_TOKEN, shared = {} }) => {
  const S = (sid) => db.collection("schools").doc(sid);
  const nowIso = () => new Date().toISOString();
  /** today's date in India time, YYYY-MM-DD */
  const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const uniq = (a) => [...new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === "string" && x))];
  const sameSet = (a, b) => { const x = uniq(a).sort(), y = uniq(b).sort(); return x.length === y.length && x.every((v, i) => v === y[i]); };
  /** drops undefined values (Firestore rejects them) */
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((student) => activeStudent(student) && (!student.classId || student.classId === classId));
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
      const ref = db.collection("users").doc(uid);
      const [profile, snap] = await Promise.all([ref.get(), ref.collection("fcm_tokens").get()]);
      const version = profile.get("parentCredentialVersion");
      const tokens = snap.docs
        .filter((d) => (d.get("app") ?? "parent") === "parent" && (!version || d.get("parentCredentialVersion") === version))
        .map((d) => ({ token: d.id, ref: d.ref }));
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
  Object.assign(shared, { notifyParents, guardiansOf, istToday, safe, classRoster });

  // ---------------------------------------------------------------------------
  // 13.1 accounts: users/{uid}.studentIds / classIds / grns follow students.guardianUids
  // ---------------------------------------------------------------------------

  async function syncParentUser(sid, uid) {
    const ref = db.collection("users").doc(uid);
    await db.runTransaction(async (tx) => {
      const u = await tx.get(ref);
      if (!u.exists || u.get("schoolId") !== sid || u.get("role") !== "parent") return;
      const snap = await tx.get(S(sid).collection("students").where("guardianUids", "array-contains", uid));
      const kids = snap.docs.filter((d) => d.get("deleted") !== true);
      const next = {
        studentIds: uniq(kids.map((d) => d.id)).sort(),
        classIds: uniq(kids.map((d) => d.get("classId"))).sort(),
        grns: uniq(kids.map((d) => (d.get("grn") == null ? null : String(d.get("grn"))))).sort(),
      };
      if (["studentIds", "classIds", "grns"].every((k) => JSON.stringify(u.get(k) ?? []) === JSON.stringify(next[k]))) return;
      tx.update(ref, { ...next, updatedAt: nowIso(), updatedBy: "functions" });
    });
  }

  const linkedUids = (s) => (s && s.deleted !== true ? uniq(s.guardianUids) : []);

  const onStudentWritten = onDocumentWritten({ document: "schools/{sid}/students/{id}", retry: true }, async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    const bU = linkedUids(before), aU = linkedUids(after);
    const relevant = !before || !after || !sameSet(bU, aU) || before.classId !== after.classId || before.grn !== after.grn
      || (before.deleted === true) !== (after.deleted === true) || !sameSet(before.guardianUids, after.guardianUids);
    if (!relevant) return;
    for (const uid of uniq([...uniq(before?.guardianUids), ...uniq(after?.guardianUids)])) {
      if (!uid.includes("/")) await syncParentUser(sid, uid);
    }

    await safe("onStudentWritten audit", async () => {
      const name = after?.name ?? before?.name ?? id;
      const actor = (await userName(after?.updatedBy ?? before?.updatedBy)) ?? "System";
      if (!before && after) await audit(sid, "Student record created", `${name} (${id})`, actor);
      if (before && !after) await audit(sid, "Student record deleted", `${name} (${id})`, actor);
      for (const uid of aU.filter((u) => !bU.includes(u))) await audit(sid, "Parent login linked", `${(await userName(uid)) ?? uid} linked to ${name} (${id})`, actor);
      for (const uid of bU.filter((u) => !aU.includes(u))) await audit(sid, "Parent login unlinked", `${(await userName(uid)) ?? uid} unlinked from ${name} (${id})`, actor);
    })(e);
  });

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

  // A teacher's "Notify Parent" from the teacher app (att_notices, teacher-private): the guardians of that student get
  // it in the parent app's notifications with a push, once per notice and parent. Call logs are not delivered.
  // The notice is stamped with how many parents it reached so the teacher app can say so.
  const onTeacherNoticeForParents = onDocumentCreated("schools/{sid}/att_notices/{id}", safe("onTeacherNoticeForParents", async (e) => {
    const sid = e.params.sid, n = e.data?.data();
    if (!n?.studentId || !n.teacherId) return;
    const channels = Array.isArray(n.channels) ? n.channels.map(String) : [];
    const text = String(n.message ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!text || (channels.length && channels.every((c) => c === "Call"))) return;
    const [stSnap, staff] = await Promise.all([
      S(sid).collection("students").doc(String(n.studentId)).get(),
      S(sid).collection("staff").doc(String(n.teacherId)).get(),
    ]);
    const student = stSnap.exists && stSnap.get("deleted") !== true ? { id: stSnap.id, ...stSnap.data() } : null;
    const teacher = staff.exists ? String(staff.get("name") ?? "").trim() : "";
    const rows = student ? guardiansOf([student]).map(({ uid }) => ({
      id: `attn_${e.params.id}_${uid}`, uid, studentId: student.id, type: "attendance",
      title: teacher ? `Message from ${teacher}` : "Message from school", body: text, route: "/academics?section=attendance",
    })) : [];
    const sent = rows.length ? await notifyParents(sid, rows) : 0;
    await e.data.ref.set({ deliveredTo: rows.length, deliveredAt: nowIso(), ...(rows.length ? {} : { undelivered: student ? "no-parent-login" : "no-student" }) }, { merge: true });
    return sent;
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

  function resultDoc(paper, paperId, cycleTitle, classId, studentId, m, expectedPapers) {
    const theory = typeof m.theory === "number" ? m.theory : null, internal = typeof m.internal === "number" ? m.internal : null;
    const theoryMax = Number(paper.theory ?? 80), internalMax = Number(paper.internal ?? 20);
    const assessment = assessMark(m, { ...paper, theory: theoryMax, internal: internalMax });
    return {
      studentId, paperId, classId, cycleId: paper.cycleId ?? "", exam: cycleTitle ?? "", subject: paper.subject ?? "", code: paper.code ?? "",
      date: paper.date ?? "", theory, internal, theoryMax, internalMax, practical: m.practical ?? null, practicalMax: paper.practical ?? 0,
      grade: assessment.grade, percent: assessment.pct, assessmentMode: paper.assessmentMode ?? "marks", status: m.status ?? "Present", resultRules: paper.resultRules ?? {}, weight: paper.weight ?? 1, scale: paper.scale ?? "",
      obtained: assessment.total, max: theoryMax + internalMax + (paper.practical ?? 0),
      medical: m.medical === true, updatedAt: nowIso(),
      ...(expectedPapers === undefined ? {} : { expectedPapers }),
    };
  }

  async function cycleTitle(sid, cycleId) {
    if (!cycleId) return "";
    const c = await S(sid).collection("exm_cycles").doc(String(cycleId)).get();
    return c.exists ? c.get("title") ?? "" : "";
  }

  /** Writes the class's results of one paper; returns the students that got a result. */
  async function writeClassResults(sid, paperId, paper, label, storedClassId) {
    const classId = storedClassId || labelToClassId(label);
    const [roster, marks, exam, examPapers] = await Promise.all([
      classRoster(sid, classId), S(sid).collection("exm_marks").where("paperId", "==", paperId).get(), cycleTitle(sid, paper.cycleId),
      S(sid).collection("exm_papers").where("cycleId", "==", paper.cycleId).get(),
    ]);
    const byStudent = new Map(marks.docs.map((d) => [markStudentId(d.data()), d.data()]));
    const got = roster.filter((s) => byStudent.has(s.id) && (!Array.isArray(paper.studentIds) || paper.studentIds.includes(s.id)));
    for (const part of chunk(got, 450)) {
      const b = db.batch();
      for (const s of part) b.set(S(sid).collection("par_results").doc(`${s.id}_${paperId}`), resultDoc(paper, paperId, exam, classId, s.id, byStudent.get(s.id), examPapers.docs.filter((p) => require("./examOperations").participates({ ...p.data(), id: p.id }, s)).length));
      await b.commit();
    }
    return { got, exam };
  }

  const onPaperForParents = onDocumentWritten("schools/{sid}/exm_papers/{id}", safe("onPaperForParents", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after) { await deleteWhere(S(sid).collection("par_results").where("paperId", "==", id)); return; }
    const classKeys = (p) => uniq([...(p?.publishedClassIds || []), ...uniq(p?.published).map(labelToClassId)]);
    const pubBefore = classKeys(before), pubAfter = classKeys(after);
    const newly = pubAfter.filter((c) => !pubBefore.includes(c)), removed = pubBefore.filter((c) => !pubAfter.includes(c));
    const detailsChanged = !!before && ["subject", "code", "date", "theory", "internal", "cycleId", "practical", "assessmentMode", "gradeOptions", "scale", "resultRules", "passMarks", "studentIds"].some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    // unpublished (e.g. the admin edits marks again): hide that class's results until it is published again
    if (removed.length) {
      const gone = new Set(removed);
      const snap = await S(sid).collection("par_results").where("paperId", "==", id).get();
      await Promise.all(snap.docs.filter((d) => gone.has(d.get("classId"))).map((d) => d.ref.delete()));
    }
    for (const label of detailsChanged ? pubAfter : newly) {
      const { got, exam } = await writeClassResults(sid, id, after, label, label);
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
    if (!uniq(paper.publishedClassIds).includes(student.classId) && !uniq(paper.published).includes(clsLabel(student.classId))) return;
    if (Array.isArray(paper.studentIds) && !paper.studentIds.includes(studentId)) return;
    const ref = S(sid).collection("par_results").doc(`${studentId}_${m.paperId}`);
    if (!after) { await ref.delete(); return; }
    const examPapers = await S(sid).collection("exm_papers").where("cycleId", "==", paper.cycleId).get();
    await ref.set(resultDoc(paper, m.paperId, await cycleTitle(sid, paper.cycleId), student.classId, studentId, after, examPapers.docs.filter((p) => require("./examOperations").participates({ ...p.data(), id: p.id }, { ...student, id: studentId })).length));
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
    const tests = uniq(grades).map(audienceClassTest).filter(Boolean);
    return snap.docs.filter((d) => !uniq(grades).length || (d.get("classIds") ?? []).some((c) => tests.some((t) => t.test(c))));
  }

  const onNoticeForParents = onDocumentWritten("schools/{sid}/com_notices/{id}", safe("onNoticeForParents", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after) return;
    const vis = noticeVisible(after);
    if (after.parentVisible !== vis) await e.data.after.ref.update({ parentVisible: vis });
    if (!vis || noticeVisible(before)) return;
    // App feed notifications and Firebase Messaging jobs are owned by onNoticePublished.

  }));

  const onCalendarForParents = onDocumentWritten("schools/{sid}/calendar_events/{id}", safe("onCalendarForParents", async (e) => {
    const after = e.data?.after?.data();
    if (!after) return;
    const vis = eventVisible(after);
    if (after.parentVisible !== vis) await e.data.after.ref.update({ parentVisible: vis });
  }));

  // a parent acknowledges a notice: com_notices/{id}/acks/{uid}
  const onNoticeAck = onDocumentCreated("schools/{sid}/com_notices/{id}/acks/{uid}", safe("onNoticeAck", async (e) => {
    // one receipt per parent: counts the acknowledgement (and the read, if not counted yet) once
    const { recordReceipt, nameOf } = require("./noticeReceipts");
    await recordReceipt(db, e.params.sid, e.params.id, e.params.uid, { role: "parent", name: await nameOf(db, e.params.uid), ack: true });
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
    const text = messagePreview(m);
    // someone already reading this conversation (msg_presence, refreshed by the apps) gets no push for it
    const present = async (uid) => {
      if (!uid) return false;
      const p = await S(sid).collection("msg_presence").doc(uid).get();
      return p.exists && p.get("threadId") === m.threadId && Date.now() - ms(p.get("at")) < 90e3;
    };
    if (m.from === "parent") {
      if (!thread.teacherId) return;
      await notify(sid, [thread.teacherId], {
        type: "message", category: "Messages", tag: "Parent Message",
        title: `${m.name ?? thread.guardian ?? "Parent"}${thread.studentName ? ` (${thread.studentName})` : ""}`, body: text, route: `/messages/${m.threadId}`,
      }, { skipPush: (u) => present(u.id) });
    } else {
      const rows = [];
      for (const uid of uniq(thread.parentUids).filter((u) => u !== m.uid)) {
        if (await present(uid)) continue;
        rows.push({ id: `msg_${e.params.id}_${uid}`, uid, studentId: thread.studentId ?? "", type: "message",
          title: thread.teacher ?? m.name ?? "Teacher", body: text, route: `/messages/thread/${m.threadId}` });
      }
      if (rows.length) await notifyParents(sid, rows);
    }
  }));

  /** Push body for a message: its text, else what was shared. */
  function messagePreview(m) {
    const text = String(m.text ?? "").replace(/\s+/g, " ").trim();
    const a = m.attachment;
    if (a && typeof a === "object") {
      const kind = a.kind === "image" ? "📷 Photo" : a.kind === "audio" ? "🎤 Voice note" : `📎 ${String(a.name ?? "File").slice(0, 60)}`;
      return (text ? `${kind} · ${text}` : kind).slice(0, 140);
    }
    if (m.meeting && typeof m.meeting === "object") {
      // "📅 Meeting rescheduled to 27 Nov 2026, 04:00 PM" — the new time, readable, in the push itself
      const mt = m.meeting;
      const when = [fmtDay(mt.date), mt.time ? t12(mt.time) : ""].filter(Boolean).join(", ");
      const st = mt.status === "cancelled" ? "Meeting cancelled" : /reschedul/i.test(text) ? "Meeting rescheduled to" : "Meeting on";
      return `📅 ${st} ${when}`.trim().slice(0, 140);
    }
    return text.slice(0, 140);
  }

  // ---------------------------------------------------------------------------
  // live classes and fees
  // ---------------------------------------------------------------------------

  // Live classes (section 6): parents of the class hear when a class is scheduled (`notify` on, not a draft), when its
  // date / time / link changes, and when it is cancelled. Each event is sent once per parent and child (deduped ids).
  /** "14:05" -> "02:05 PM" */
  const t12 = (t) => { const [h, m] = String(t ?? "").split(":").map(Number); return Number.isFinite(h) ? `${String(h % 12 || 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` : String(t ?? ""); };
  const liveState = (c) => (!c || c.deleted === true || /cancel/i.test(String(c.status ?? "")) ? "cancelled" : /draft/i.test(String(c.status ?? "")) ? "draft" : "scheduled");
  const onLiveClassForParents = onDocumentWritten("schools/{sid}/live_classes/{id}", safe("onLiveClassForParents", async (e) => {
    const sid = e.params.sid, before = e.data?.before?.data(), after = e.data?.after?.data();
    const was = before ? liveState(before) : "none", now = after ? liveState(after) : "cancelled";
    const c = after ?? before;
    if (!c?.classId) return;
    const name = c.title || c.subject || "Online class";
    const when = [c.date, c.time ? t12(c.time) : ""].filter(Boolean).join(" at ");
    let title, body, key;
    if (now === "scheduled" && was !== "scheduled") {
      if (c.notify === false) return;
      title = `Live class: ${name}`; body = [c.subject, when].filter(Boolean).join(" · "); key = "new";
    } else if (now === "scheduled" && was === "scheduled" && (before.date !== after.date || before.time !== after.time || before.link !== after.link)) {
      title = `Live class rescheduled: ${name}`; body = [c.subject, `now ${when}`].filter(Boolean).join(" · "); key = `r${String(after.updatedAt ?? Date.now()).replace(/[^0-9A-Za-z]/g, "")}`;
    } else if (now === "cancelled" && was === "scheduled") {
      title = `Live class cancelled: ${name}`; body = [c.subject, when].filter(Boolean).join(" · "); key = "cancel";
    } else return;
    const roster = await classRoster(sid, c.classId);
    await notifyParents(sid, guardiansOf(roster).map(({ uid, student }) => ({
      id: key === "new" ? `live_${e.params.id}_${student.id}_${uid}` : `live_${e.params.id}_${key}_${student.id}_${uid}`,
      uid, studentId: student.id, type: "live", title, body, route: "/more/live",
    })));
  }));

  // Class parent-teacher meetings (teacher app `pm_meetings`, teacher-private): parents of the class get the invitation
  // when a meeting is scheduled (not a draft), an update when its date / time / place / link changes, and a notice when
  // it is cancelled (deleted while scheduled). Deduped per parent and child like live classes.
  const meetingState = (m) => (!m || m.deleted === true ? "cancelled" : m.status === "upcoming" ? "scheduled" : String(m.status ?? ""));
  const meetingWhere = (m) => (/person/i.test(String(m.format ?? ""))
    ? `In person${m.venue ? ` at ${m.venue}` : ""}`
    : `Online on Google Meet${m.link ? `: ${m.link}` : ""}`);
  const onClassMeetingForParents = onDocumentWritten("schools/{sid}/pm_meetings/{id}", safe("onClassMeetingForParents", async (e) => {
    const sid = e.params.sid, before = e.data?.before?.data(), after = e.data?.after?.data();
    const was = meetingState(before), now = after ? meetingState(after) : "cancelled";
    const m = after ?? before;
    if (!m?.classId) return;
    const name = m.title || "Parent-teacher meeting";
    const when = [fmtDay(m.date), m.time ? t12(m.time) : ""].filter(Boolean).join(", ");
    const moved = (k) => String(before?.[k] ?? "") !== String(after?.[k] ?? "");
    let title, body, key;
    if (now === "scheduled" && was !== "scheduled") {
      if (m.invite === false) return;
      title = `Meeting invitation: ${name}`; body = `${when} · ${meetingWhere(m)}`; key = "new";
    } else if (now === "scheduled" && was === "scheduled" && ["date", "time", "venue", "link", "format"].some(moved)) {
      const retimed = moved("date") || moved("time");
      title = retimed ? `Meeting rescheduled: ${name}` : `Meeting updated: ${name}`;
      body = retimed ? `New time: ${when} · ${meetingWhere(m)}` : `${when} · ${meetingWhere(m)}`; key = `u${String(after.updatedAt ?? Date.now()).replace(/[^0-9A-Za-z]/g, "")}`;
    } else if (now === "cancelled" && was === "scheduled") {
      title = `Meeting cancelled: ${name}`; body = when; key = "cancel";
    } else return;
    const roster = await classRoster(sid, m.classId);
    await notifyParents(sid, guardiansOf(roster).map(({ uid, student }) => ({
      id: `ptmc_${e.params.id}_${key}_${student.id}_${uid}`, uid, studentId: student.id, type: "ptm", title, body: body.slice(0, 300), route: "/notifications",
    })));
  }));

  async function studentsByGrn(sid, grn) {
    if (grn == null || grn === "") return [];
    const snap = await S(sid).collection("students").where("grn", "==", String(grn)).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.deleted !== true);
  }
  /** "2026-11-01" -> "1 Nov 2026" (unknown values pass through) */
  const fmtDay = (iso) => { const t = Date.parse(`${String(iso ?? "").slice(0, 10)}T00:00:00Z`); return isNaN(t) ? String(iso ?? "") : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
  const rupees = (n) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "");

  const onFeeInvoiceCreated = onDocumentCreated("schools/{sid}/fee_invoices/{id}", safe("onFeeInvoiceCreated", async (e) => {
    const sid = e.params.sid, inv = e.data?.data();
    const kids = await studentsByGrn(sid, inv?.grn);
    await notifyParents(sid, guardiansOf(kids).map(({ uid, student }) => ({
      id: `inv_${e.params.id}_${uid}`, uid, studentId: student.id, type: "fees", title: `Fee invoice ${inv.no ?? ""}`.trim(),
      body: [`${student.name ?? inv.student ?? ""}`, rupees(inv.balance ?? inv.amount), inv.due ? `due ${fmtDay(inv.due)}` : ""].filter(Boolean).join(" · "), route: "/fees",
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
  // 13.7 parent-teacher meetings and certificates
  // ---------------------------------------------------------------------------

  /** "Thu 29 Oct, 4:30 pm" in India time */
  const istWhen = (v) => (ms(v) ? new Date(ms(v)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

  const onPtmBookingWritten = onDocumentWritten("schools/{sid}/ptm_bookings/{slotId}", safe("onPtmBookingWritten", async (e) => {
    const sid = e.params.sid, slotId = e.params.slotId;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    // the slot shows as taken while it holds a Scheduled booking
    const booked = after?.status === "Scheduled";
    const slotRef = S(sid).collection("ptm_slots").doc(slotId);
    const slot = await slotRef.get();
    if (slot.exists && slot.get("booked") !== booked) await slotRef.update({ booked, updatedAt: nowIso(), updatedBy: "functions" });
    if (!after) return;

    const who = `${after.studentName ?? "A student"}${after.classId ? ` (${clsLabel(after.classId)})` : ""}`;
    const when = istWhen(after.startMs ?? after.start);
    // a new booking (or a re-booked slot): tell the teacher
    const isNew = after.status === "Scheduled" && (before?.status !== "Scheduled" || before?.studentId !== after.studentId);
    if (isNew && after.teacherId) {
      await notify(sid, [after.teacherId], {
        type: "ptm", category: "Duties", tag: "Parent Meeting", title: `Meeting booked: ${who}`,
        body: [when, after.mode, after.agenda].filter(Boolean).join(" · "), route: "/notifications",
      });
    }
    const student = await studentDoc(sid, after.studentId);
    const parents = uniq([after.parentUid, ...(student?.guardianUids ?? [])]);
    const toParents = (key, title, body) => notifyParents(sid, parents.map((uid) => ({
      id: `ptm_${slotId}_${key}_${uid}`, uid, studentId: after.studentId ?? "", type: "ptm", title, body, route: "/more/ptm",
    })));
    if (before?.status === "Scheduled" && after.status === "Cancelled") {
      if (after.cancelledBy === "parent") {
        if (after.teacherId) {
          await notify(sid, [after.teacherId], {
            type: "ptm", category: "Duties", tag: "Parent Meeting", title: `Meeting cancelled: ${who}`, body: `${when} · cancelled by the parent`, route: "/notifications",
          });
        }
      } else {
        await toParents(`cx${ms(after.cancelledAt) || Date.now()}`, "Meeting cancelled",
          `${after.teacher ?? "Teacher"} · ${when}${after.cancelReason ? ` · ${after.cancelReason}` : ""}`);
      }
    }
    // the school shares notes of the meeting
    const minutes = String(after.minutes ?? "").trim();
    if (minutes && minutes !== String(before?.minutes ?? "").trim()) {
      await toParents(`min${minutes.length}_${ms(after.updatedAt)}`, `Meeting notes from ${after.teacher ?? "the school"}`, minutes.slice(0, 160));
    }
    // a Meet link was added to a virtual meeting after it was booked
    if (after.status === "Scheduled" && after.link && !before?.link && before?.status === "Scheduled") {
      await toParents("link", "Meeting link ready", `${after.teacher ?? "Teacher"} · ${when}`);
    }
  }));

  /** a withdrawn slot cancels its Scheduled booking */
  const onPtmSlotDeleted = onDocumentDeleted("schools/{sid}/ptm_slots/{slotId}", safe("onPtmSlotDeleted", async (e) => {
    const ref = S(e.params.sid).collection("ptm_bookings").doc(e.params.slotId);
    const b = await ref.get();
    if (!b.exists || b.get("status") !== "Scheduled") return;
    await ref.update({ status: "Cancelled", cancelledBy: "school", cancelReason: "The slot was withdrawn", cancelledAt: nowIso(), updatedAt: nowIso(), updatedBy: "functions" });
  }));

  const onCertificateWritten = onDocumentWritten("schools/{sid}/certificates/{id}", safe("onCertificateWritten", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after || after.recipientKind === "staff" || !after.studentId || before?.status === after.status || !["Issued", "Rejected", "Revoked"].includes(after.status)) return;
    const student = await studentDoc(sid, after.studentId);
    const uids = uniq([after.parentUid, ...(student?.guardianUids ?? [])]);
    const issued = after.status === "Issued";
    await notifyParents(sid, uids.map((uid) => ({
      id: `cert_${id}_${after.status}_${uid}`, uid, studentId: after.studentId ?? "", type: "certificate",
      title: issued ? `${after.title ?? "Certificate"} issued` : after.status === "Revoked" ? `${after.title ?? "Certificate"} revoked` : `${after.title ?? "Certificate"} request declined`,
      body: issued
        ? [after.studentName ?? student?.name, after.refNo, after.fileUrl || after.pdfPath ? "Download it in the app" : "Collect the signed copy from the school office"].filter(Boolean).join(" · ")
        : [after.studentName ?? student?.name, after.status === "Revoked" ? "This certificate is no longer valid. Contact the school office." : after.rejectReason].filter(Boolean).join(" · "),
      route: "/more/certificates",
    })));
  }));

  /** a reported payment the office could not match with the bank statement (13.8) */
  const onFeeClaimWritten = onDocumentWritten("schools/{sid}/fee_claims/{id}", safe("onFeeClaimWritten", async (e) => {
    const sid = e.params.sid, id = e.params.id;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after || before?.status === after.status || after.status !== "Rejected") return;
    const student = await studentDoc(sid, after.studentId);
    const uids = uniq([after.parentUid, ...(student?.guardianUids ?? [])]);
    await notifyParents(sid, uids.map((uid) => ({
      id: `clm_${id}_Rejected_${uid}`, uid, studentId: after.studentId ?? "", type: "fees", title: "Payment not verified",
      body: [rupees(after.amount), after.reference, after.rejectReason].filter(Boolean).join(" · "), route: "/fees",
    })));
  }));

  // ---------------------------------------------------------------------------
  // 13.4 fee due reminders: the admin's Remind button, and a daily check of due dates
  // ---------------------------------------------------------------------------

  /** fee_reminders rows are written by the admin web's Remind (Fees > Invoices): push the guardians of that invoice */
  const onFeeReminderCreated = onDocumentCreated("schools/{sid}/fee_reminders/{id}", safe("onFeeReminderCreated", async (e) => {
    const sid = e.params.sid, r = e.data?.data();
    if (!r?.invoiceId) return;
    const inv = await S(sid).collection("fee_invoices").doc(String(r.invoiceId)).get();
    if (!inv.exists || !(Number(inv.get("balance")) > 0)) return;
    const kids = await studentsByGrn(sid, inv.get("grn"));
    await notifyParents(sid, guardiansOf(kids).map(({ uid, student }) => ({
      id: `rem_${e.params.id}_${uid}`, uid, studentId: student.id, type: "fees", title: "Fee reminder",
      body: [student.name, `${rupees(inv.get("balance"))} due${inv.get("due") ? ` on ${fmtDay(inv.get("due"))}` : ""}`, inv.get("no")].filter(Boolean).join(" · "), route: "/fees",
    })));
  }));

  /** whole days from today (India time) to an ISO date; NaN when unknown */
  const daysUntil = (iso, today) => Math.round((Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  /** which reminder an unpaid invoice gets today: 3 days before, on the day, 1 and 7 days late (null = none) */
  const dueKind = (d) => (d === 3 ? "soon" : d === 0 ? "today" : d === -1 ? "late1" : d === -7 ? "late7" : null);
  const DUE_TITLE = { soon: "Fee due in 3 days", today: "Fee due today", late1: "Fee overdue", late7: "Fee overdue by a week" };

  /** Sends the day's due-date reminders for every school; dedupe ids make a re-run harmless. Returns the number sent. */
  async function sendFeeDueReminders(today = istToday()) {
    let sent = 0;
    const schools = await db.collection("schools").listDocuments();
    for (const school of schools) {
      const sid = school.id;
      const snap = await S(sid).collection("fee_invoices").where("balance", ">", 0).get();
      for (const d of snap.docs) {
        const inv = d.data();
        const kind = inv.due ? dueKind(daysUntil(inv.due, today)) : null;
        if (!kind) continue;
        const kids = await studentsByGrn(sid, inv.grn);
        sent += await notifyParents(sid, guardiansOf(kids).map(({ uid, student }) => ({
          id: `due_${d.id}_${kind}_${uid}`, uid, studentId: student.id, type: "fees", title: DUE_TITLE[kind],
          body: [student.name, `${rupees(inv.balance)} ${kind.startsWith("late") ? "was due" : "due"} on ${fmtDay(inv.due)}`, inv.no].filter(Boolean).join(" · "), route: "/fees",
        })));
      }
    }
    logger.info("fee due reminders", { today, sent });
    return sent;
  }

  const feeDueReminders = onSchedule({ schedule: "every day 09:00", timeZone: "Asia/Kolkata" }, async () => { await sendFeeDueReminders(); });
  feeDueReminders.runFor = sendFeeDueReminders; // tools/e2e/act.mjs dues: run the daily check for a given day

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
    onStudentWritten, onClassTeacherNameSync, onStaffRenamed, onAttendanceForParents, onTeacherNoticeForParents, onHomeworkForParents, onPaperForParents,
    onMarkForParents, onNoticeForParents, onCalendarForParents, onNoticeAck, onStudentLeaveRequested, onStudentLeaveDecided,
    onMessageCreated, onLiveClassForParents, onClassMeetingForParents, onFeeInvoiceCreated, onFeePaymentCreated, onConsentWritten, onPtmBookingWritten,
    onPtmSlotDeleted, onCertificateWritten, onFeeClaimWritten, onFeeReminderCreated, feeDueReminders,
  };
};
