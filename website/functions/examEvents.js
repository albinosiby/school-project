const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");
const { appMessaging } = require("./appMessaging");
const { participates } = require("./examOperations");
const { sheetId, sheetSummary, studentOf } = require("./examSheets");
const { schoolTimeZone } = require("./schoolTime");
const hash = (s) => createHash("sha256").update(s).digest("hex");

function auditRecord(collection, before, after) {
  if (collection === "att_exam_state") {
    if (after?.status === "Submitted" && (before?.status !== "Submitted" || before?.submittedAt !== after.submittedAt)) return "Marks submitted";
    if (before?.status === "Submitted" && after?.status !== "Submitted") return "Marks submission withdrawn";
    return null;
  }
  if (collection === "exm_sheets") {
    // Teacher submissions are direct writes; every other sheet change comes from manageExamination (audited there).
    if (after?.status === "Submitted" && before?.status !== "Submitted") return "Sheet submitted";
    return null;
  }
  if (!after) return collection === "exm_marks" ? "Marks deleted" : "Record removed";
  if (collection === "exm_cycles")
    return !before
      ? "Exam created"
      : before.publicationState !== after.publicationState && after.publicationState === "published"
        ? "Exam published"
        : "Exam edited";
  if (collection === "exm_marks") {
    if (!before) return "Marks entered";
    if (after.verified === true && (before.verified !== true || before.verificationFingerprint !== after.verificationFingerprint)) return "Marks verified";
    if (
      ["theory", "internal", "practical", "status", "gradeValue", "medical"].some(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
    )
      return "Marks modified";
    return null;
  }
  return collection === "exm_duties" ? "Invigilation changed" : "Paper changed";
}
exports.auditRecord = auditRecord;
exports.invalidateChangedExamMarks = onDocumentWritten(
  { document: "schools/{sid}/exm_marks/{id}", retry: true },
  async (event) => {
    const before = event.data?.before?.data(),
      after = event.data?.after?.data();
    if (
      !before ||
      !after ||
      !after.verified ||
      !["theory", "internal", "practical", "status", "gradeValue", "medical"].some(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
    )
      return;
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      const current = await tx.get(event.data.after.ref);
      // Do not invalidate a later administrator review that already saw this update.
      if (
        !current.exists ||
        current.get("updatedAt") !== after.updatedAt ||
        current.get("verificationFingerprint") !== after.verificationFingerprint
      )
        return;
      tx.update(current.ref, { verified: false });
    });
  },
);
/**
 * Keeps exm_sheets.summary in step with the marks of its paper × division and moves a NotStarted sheet to
 * InProgress once something is entered (contract section 1). Idempotent: nothing is written when the stored summary
 * already matches, and marks whose paper × division has no sheet are ignored.
 */
async function syncSheetForMark(db, sid, mark) {
  if (!mark?.paperId) return null;
  const school = db.collection("schools").doc(sid);
  let classId = mark.classId;
  if (!classId) {
    const studentId = studentOf(mark);
    classId = studentId ? (await school.collection("students").doc(studentId).get()).get("classId") : "";
  }
  if (!classId) return null;
  const ref = school.collection("exm_sheets").doc(sheetId(mark.paperId, classId));
  if (!(await ref.get()).exists) return null;
  return db.runTransaction(async (tx) => {
    const [sheet, paper, marks] = await Promise.all([
      tx.get(ref),
      tx.get(school.collection("exm_papers").doc(mark.paperId)),
      tx.get(school.collection("exm_marks").where("paperId", "==", mark.paperId)),
    ]);
    if (!sheet.exists) return null;
    const data = sheet.data();
    const summary = sheetSummary(
      data,
      marks.docs.map((d) => ({ ...d.data(), id: d.id })),
      paper.exists ? { ...paper.data(), id: paper.id } : undefined,
    );
    const status = data.status === "NotStarted" && summary.entered > 0 ? "InProgress" : data.status;
    if (status === data.status && JSON.stringify(summary) === JSON.stringify(data.summary || null)) return null;
    tx.update(ref, { summary, status, summaryAt: new Date().toISOString() });
    return status;
  });
}
exports.syncSheetForMark = syncSheetForMark;
exports.syncExamSheetSummary = onDocumentWritten(
  { document: "schools/{sid}/exm_marks/{id}", retry: true },
  async (event) => {
    const before = event.data?.before?.data(),
      after = event.data?.after?.data();
    const mark = after || before;
    if (!mark) return;
    // Only entry fields change the summary; stamps and verification flags do not.
    if (
      before &&
      after &&
      !["theory", "internal", "practical", "status", "gradeValue", "medical", "classId", "studentId"].some(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
    )
      return;
    await syncSheetForMark(getFirestore(), event.params.sid, mark);
    if (before && after && before.classId && before.classId !== after.classId)
      await syncSheetForMark(getFirestore(), event.params.sid, before);
  },
);
for (const collection of ["exm_cycles", "exm_papers", "exm_marks", "exm_duties", "att_exam_state", "exm_sheets"]) {
  const name = {
    exm_cycles: "auditExamCycle",
    exm_papers: "auditExamPaper",
    exm_marks: "auditExamMarks",
    exm_duties: "auditExamDuty",
    att_exam_state: "auditExamSubmission",
    exm_sheets: "auditExamSheet",
  }[collection];
  exports[name] = onDocumentWritten(
    { document: `schools/{sid}/${collection}/{id}`, retry: true },
    async (event) => {
      const before = event.data?.before?.data(),
        after = event.data?.after?.data(),
        record = after || before;
      // Callable operations already write their audit event in the same transaction.
      if (!record || (after?.operationId && after.operationId !== before?.operationId)) return;
      const action = auditRecord(collection, before, after);
      if (!action) return;
      const db = getFirestore(),
        school = db.collection("schools").doc(event.params.sid);
      let cycleId = collection === "exm_cycles" ? event.params.id : record.cycleId;
    const paperId = record.paperId || (collection === "att_exam_state" ? event.params.id.split("@")[0] : "");
    if (!cycleId && paperId)
      cycleId = (await school.collection("exm_papers").doc(paperId).get()).get("cycleId");
      if (!cycleId) return;
      const ref = school.collection("exm_activity").doc(`event_${hash(event.id)}`);
      const actorId = record.updatedBy || "system";
      const actor = actorId && actorId !== "system" ? await db.collection("users").doc(actorId).get() : null;
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return;
        tx.create(ref, {
          id: ref.id,
          action,
          cycleId,
        paperId: collection === "exm_papers" ? event.params.id : paperId,
          studentId: record.studentId || "",
          actorId,
          actorName: actor?.get("name") || actor?.get("email") || actorId,
          at: event.time || new Date().toISOString(),
          previous: before || null,
          next: after || null,
        });
      });
    },
  );
}

// Durable per-recipient jobs reuse the app's feed and push-delivery outbox.
async function queueExamNotification(db, messaging, sid, sourceId, source, kind) {
  const school = db.collection("schools").doc(sid);
  const cycle = await school.collection("exm_cycles").doc(source.cycleId).get();
  if (kind === "sheet") return queueSheetNotification(db, messaging, sid, sourceId, source, cycle);
  const paperDocs =
    kind === "schedule"
      ? [await school.collection("exm_papers").doc(source.paperId).get()]
      : (await school.collection("exm_papers").where("cycleId", "==", source.cycleId).get()).docs;
  const papers = paperDocs.filter((d) => d.exists).map((d) => ({ ...d.data(), id: d.id }));
  const students = (await school.collection("students").get()).docs
    .filter((d) => d.get("deleted") !== true && (d.get("status") || "Active") === "Active")
    .map((d) => ({ ...d.data(), id: d.id }));
  const reportStudents =
    kind === "reports"
      ? new Set(
          (await school.collection("exm_report_cards").where("batchId", "==", sourceId).get()).docs.map((d) =>
            d.get("studentId"),
          ),
        )
      : null;
  const affected = students.filter((s) =>
    kind === "reports"
      ? reportStudents.has(s.id)
      : papers.some((p) => participates({ ...p, scheduleStatus: "Scheduled" }, s)),
  );
  const studentIds = new Set(affected.map((s) => s.id));
  const duties = (await school.collection("exm_duties").get()).docs.map((d) => d.data());
  const teachers = new Set(
    papers
      .flatMap((p) => [
        p.invigilatorId,
        ...Object.values(p.evaluatorIds || {}),
        ...duties.filter((d) => d.paperId === p.id).map((d) => d.staffId),
      ])
      .filter(Boolean),
  );
  // Legacy papers have no evaluator map; include the subject's existing allocations.
  const allocations = await school.collection("assignments").get();
  for (const assignment of allocations.docs)
    if (
      papers.some(
        (p) =>
          (!p.classIds?.length || p.classIds.includes(assignment.get("classId"))) &&
          p.subject?.toLowerCase() === assignment.get("subject")?.toLowerCase(),
      )
    )
      teachers.add(assignment.get("teacherId"));
  const regional = await school.collection("set_config").doc("regional").get();
  const users = await db.collection("users").where("schoolId", "==", sid).get();
  let count = 0;
  for (const user of users.docs) {
    const role = user.get("role");
    const parent = role === "parent" && (user.get("studentIds") || []).some((id) => studentIds.has(id));
    const teacher = role === "teacher" && teachers.has(user.get("staffId"));
    if (!parent && !teacher) continue;
    let push = true;
    if (teacher) {
      const pref =
        (
          await school.collection("hm_settings").where("teacherId", "==", user.get("staffId")).limit(1).get()
        ).docs[0]?.data() || {};
      push = pref.classUpdates !== false;
      if (pref.dnd) {
        const time = new Intl.DateTimeFormat("en-GB", {
          timeZone: schoolTimeZone(regional.get("timezone")),
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date());
        const from = pref.dndFrom || "18:00",
          to = pref.dndTo || "07:30";
        if (from <= to ? time >= from && time < to : time >= from || time < to) push = false;
      }
    }
    const p = papers[0],
      next = source.next || {};
    const title =
      kind === "reports"
        ? `${cycle.get("title") || "Exam"}: report cards published`
        : `${p?.subject || "Examination"}: timetable update`;
    const body =
      kind === "reports"
        ? `The consolidated report card for ${source.classLabel || source.classId} is available.`
        : [
            `${next.scheduleStatus || "Scheduled"}: ${next.date || "new date pending"}${next.start ? " at " + next.start : ""}`,
            next.venue && `Room: ${next.venue}`,
            `Reason: ${source.reason}`,
          ]
            .filter(Boolean)
            .join("\n");
    await messaging.queue(
      sid,
      user,
      `exam:${kind}:${sourceId}`,
      { type: "exam", title, body, route: parent ? "/academics" : "/exam-duties" },
      push,
    );
    count++;
  }
  return count;
}
exports.queueExamNotification = queueExamNotification;

/** A sheet was returned or approved: one job for its owner (teacher app route /marks), honouring their settings. */
async function queueSheetNotification(db, messaging, sid, sourceId, sheet, cycle) {
  if (!sheet?.ownerId) return 0;
  const school = db.collection("schools").doc(sid);
  const users = await db
    .collection("users")
    .where("schoolId", "==", sid)
    .where("role", "==", "teacher")
    .where("staffId", "==", sheet.ownerId)
    .get();
  if (users.empty) return 0;
  const regional = await school.collection("set_config").doc("regional").get();
  const approved = sheet.status === "Approved";
  const title = `${cycle.get("title") || "Exam"}: ${sheet.subject || "marks"} ${sheet.classLabel || sheet.classId || ""} ${approved ? "approved" : "returned"}`.trim();
  const body = approved
    ? "The mark sheet was approved by the examination office."
    : `Returned for correction: ${sheet.reopenReason && sheet.version > 1 && !sheet.returnNote ? sheet.reopenReason : sheet.returnNote || sheet.reopenReason || "see the note in the app"}`;
  let count = 0;
  for (const user of users.docs) {
    const pref =
      (await school.collection("hm_settings").where("teacherId", "==", user.get("staffId")).limit(1).get()).docs[0]?.data() || {};
    let push = pref.classUpdates !== false;
    if (pref.dnd && push) {
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: schoolTimeZone(regional.get("timezone")),
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
      const from = pref.dndFrom || "18:00",
        to = pref.dndTo || "07:30";
      if (from <= to ? time >= from && time < to : time >= from || time < to) push = false;
    }
    await messaging.queue(sid, user, `exam:sheet:${sourceId}`, { type: "exam", title, body: body.slice(0, 2200), route: "/marks" }, push);
    count++;
  }
  return count;
}
exports.queueSheetNotification = queueSheetNotification;
exports.notifyExamSheetReviewed = onDocumentWritten(
  { document: "schools/{sid}/exm_sheets/{id}", retry: true, timeoutSeconds: 120 },
  async (e) => {
    const before = e.data?.before?.data(),
      after = e.data?.after?.data();
    if (!after || !["Returned", "Approved"].includes(after.status) || before?.status === after.status) return;
    const count = await queueExamNotification(
      getFirestore(),
      appMessaging(),
      e.params.sid,
      `${e.params.id}:${after.status}:${after.reviewedAt || after.updatedAt || ""}`,
      after,
      "sheet",
    );
    await e.data.after.ref.update({ notificationStatus: "Queued", notificationRecipients: count });
  },
);
exports.notifyExamScheduleChanged = onDocumentCreated(
  { document: "schools/{sid}/exm_schedule_history/{id}", retry: true, timeoutSeconds: 180 },
  async (e) => {
    const source = e.data?.data();
    if (!source?.notify) return;
    try {
      const count = await queueExamNotification(
        getFirestore(),
        appMessaging(),
        e.params.sid,
        e.params.id,
        source,
        "schedule",
      );
      await e.data.ref.update({ notificationStatus: "Queued", notificationRecipients: count });
    } catch (error) {
      await e.data.ref.update({ notificationStatus: "Failed" });
      throw error;
    }
  },
);
exports.notifyExamReportsPublished = onDocumentWritten(
  { document: "schools/{sid}/exm_report_batches/{id}", retry: true, timeoutSeconds: 180 },
  async (e) => {
    const before = e.data?.before?.data(),
      source = e.data?.after?.data();
    if (source?.status !== "Published" || before?.status === "Published" || !source.notify) return;
    try {
      const count = await queueExamNotification(
        getFirestore(),
        appMessaging(),
        e.params.sid,
        e.params.id,
        source,
        "reports",
      );
      await e.data.after.ref.update({ notificationStatus: "Queued", notificationRecipients: count });
    } catch (error) {
      await e.data.after.ref.update({ notificationStatus: "Failed" });
      throw error;
    }
  },
);
