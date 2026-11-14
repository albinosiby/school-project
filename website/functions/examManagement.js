const { createHash } = require("node:crypto");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireAdminSession, verifiedAdminSession } = require("./adminSession");
const { clsLabel } = require("./classIdentity");
const { consolidated, readyForReport, scheduleErrors, participates, mins, end } = require("./examOperations");
const { assessMark, markFingerprint } = require("./examAssessment");
const sheets = require("./examSheets");
const results = require("./examResults");
const validId = (v) => typeof v === "string" && /^[\w-]{1,128}$/.test(v);
const text = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const fail = (message, code = "failed-precondition") => {
  throw new HttpsError(code, message);
};
const rows = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
const changesOf = (p) =>
  Object.fromEntries(
    ["date", "start", "duration", "venue", "invigilatorId", "invigilator", "scheduleStatus"].map((k) => [
      k,
      p[k] ?? (k === "duration" ? 0 : ""),
    ]),
  );
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};
const activeStudents = (snap) => rows(snap).filter((s) => s.deleted !== true && (s.status || "Active") === "Active");
const SHEET_ACTIONS = [
  "openEntry",
  "sheetSubmit",
  "sheetReturn",
  "sheetApprove",
  "sheetReopen",
  "sheetAssign",
  "compile",
  "signOff",
  "publishResults",
  "withdrawResults",
];
// Firestore transactions take at most 500 writes; the receipt, audit row and cycle update are reserved.
const WRITE_BUDGET = 480;

/** Marks of many papers inside a transaction (the `in` filter takes 30 ids). */
async function marksForPapers(tx, school, paperIds) {
  const marks = [];
  for (const part of chunk(paperIds, 30))
    marks.push(...rows(await tx.get(school.collection("exm_marks").where("paperId", "in", part))));
  return marks;
}

/** Students of some divisions inside a transaction. */
async function studentsOfClasses(tx, school, classIds) {
  const students = [];
  for (const part of chunk([...new Set(classIds)], 30))
    students.push(...activeStudents(await tx.get(school.collection("students").where("classId", "in", part))));
  return students;
}

/**
 * The paper update that publishes one division's subject result (what `subjectPublish` has always written).
 * `publishedClassIds` + `published` drive the parent projection (parent.js onPaperForParents) and its push.
 */
function paperPublication(paper, classId, label, allSections) {
  const expectedClasses = paper.classIds?.length
    ? paper.classIds
    : allSections.filter((s) => String(s.grade) === String(paper.grade)).map((s) => s.id);
  const publishedClassIds = [...new Set([...(paper.publishedClassIds || []), classId])];
  const fullyPublished =
    expectedClasses.length > 0 &&
    expectedClasses.every((id) => publishedClassIds.includes(id) || (paper.published || []).includes(clsLabel(id)));
  return {
    published: [...new Set([...(paper.published || []), label])],
    publishedClassIds,
    marksEntered: fullyPublished,
    status: fullyPublished ? "Completed" : "Scheduled",
    locked: fullyPublished || paper.locked === true,
  };
}
/** Reverse of paperPublication for one division; a paper auto-locked by full publication is unlocked again. */
function paperWithdrawal(paper, classId, label) {
  return {
    published: (paper.published || []).filter((l) => l !== label && l !== classId),
    publishedClassIds: (paper.publishedClassIds || []).filter((id) => id !== classId),
    marksEntered: false,
    status: "Scheduled",
    locked: paper.status === "Completed" ? false : paper.locked === true,
  };
}
const paperCoversClass = (paper, classId, allSections) =>
  paper.publishedClassIds?.includes(classId) ||
  (paper.published || []).includes(sheets.classLabelOf(classId, allSections)) ||
  (paper.classIds?.length
    ? paper.classIds.includes(classId)
    : allSections.some((s) => s.id === classId && String(s.grade) === String(paper.grade)));

/** Cycle-wide records every class publication needs (read once per transaction, before any write). */
async function readPublication(tx, school, cycleId) {
  const [paperSnap, classSnap, sheetSnap, classResultSnap] = await Promise.all([
    tx.get(school.collection("exm_papers").where("cycleId", "==", cycleId)),
    tx.get(school.collection("classes")),
    tx.get(school.collection("exm_sheets").where("cycleId", "==", cycleId)),
    tx.get(school.collection("exm_class_results").where("cycleId", "==", cycleId)),
  ]);
  return {
    papers: rows(paperSnap).filter((p) => p.scheduleStatus !== "Cancelled"),
    classes: rows(classSnap),
    sheets: rows(sheetSnap),
    classResults: rows(classResultSnap),
  };
}
/** One division's result records (read before any write). */
async function readClassPublication(tx, school, cycleId, classId) {
  const [classResult, resultSnap] = await Promise.all([
    tx.get(school.collection("exm_class_results").doc(results.classResultId(cycleId, classId))),
    tx.get(school.collection("exm_results").where("cycleId", "==", cycleId).where("classId", "==", classId)),
  ]);
  return { classId, classResult: classResult.exists ? { ...classResult.data(), id: classResult.id } : null, results: rows(resultSnap) };
}
/** Why a class result cannot be published now, or "" when it can. */
function publicationBlocker(cycle, classResult) {
  if (!classResult) return "Compile the division's results first.";
  if (classResult.stale) return "Marks changed after compilation. Compile the division again.";
  if (classResult.status === "Published") return "These results are already published.";
  if (classResult.status === "Approved") return "";
  if (classResult.status === "Compiled" && cycle.resultRules?.requireApproval === false) return "";
  return "Sign off the compiled results before publication.";
}
/**
 * Publishes one division's current result version (shared by `publishResults` and the scheduled job).
 * Every write goes through `tx`; the caller has finished reading. Returns the number of writes.
 */
function applyClassPublication(tx, school, cycle, shared, plan, stamp) {
  const { classId, classResult } = plan;
  const label = sheets.classLabelOf(classId, shared.classes);
  const canonical = new Set();
  let writes = 0;
  for (const r of plan.results) {
    if (!results.isCanonical(r) || r.version !== classResult.version || r.status === "Published") continue;
    canonical.add(r.id);
    tx.update(school.collection("exm_results").doc(r.id), { status: "Published", publishedAt: stamp.updatedAt, ...stamp });
    writes++;
  }
  for (const r of plan.results) {
    if (r.status !== "Published" || canonical.has(r.id)) continue;
    tx.update(school.collection("exm_results").doc(r.id), {
      status: "Superseded",
      supersededBy: results.resultId(cycle.id, r.studentId),
      ...stamp,
    });
    writes++;
  }
  for (const old of shared.classResults)
    if (old.classId === classId && old.id !== classResult.id && old.status === "Published") {
      tx.update(school.collection("exm_class_results").doc(old.id), { status: "Superseded", supersededBy: classResult.id, ...stamp });
      writes++;
    }
  tx.update(school.collection("exm_class_results").doc(classResult.id), {
    status: "Published",
    publishedAt: stamp.updatedAt,
    publishAt: null,
    ...stamp,
  });
  writes++;
  for (const paper of shared.papers) {
    if (!paperCoversClass(paper, classId, shared.classes)) continue;
    if (paper.publishedClassIds?.includes(classId) && (paper.published || []).includes(label)) continue;
    tx.update(school.collection("exm_papers").doc(paper.id), { ...paperPublication(paper, classId, label, shared.classes), ...stamp });
    writes++;
  }
  return writes;
}
/** Cycle fields after some classes were (un)published: stage and correctionPending. */
function cycleAfterPublication(cycle, shared, publishedNow = [], withdrawnNow = []) {
  const published = new Set(shared.classResults.filter((c) => c.status === "Published" && results.isCanonical(c)).map((c) => c.classId));
  for (const id of publishedNow) published.add(id);
  for (const id of withdrawnNow) published.delete(id);
  const withSheets = [...new Set(shared.sheets.map((s) => s.classId))];
  const stale = shared.classResults.some((c) => results.isCanonical(c) && c.stale === true);
  const everyPublished = withSheets.length > 0 && withSheets.every((id) => published.has(id));
  return {
    stage: everyPublished ? "published" : ["published", "closed"].includes(cycle.stage) && !everyPublished ? "tabulation" : cycle.stage || "tabulation",
    correctionPending: stale,
  };
}
function signatureImage(value) {
  if (!value) return "";
  if (
    typeof value !== "string" ||
    value.length > 140000 ||
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)
  )
    fail("Choose a PNG or JPEG signature under 100 KB.", "invalid-argument");
  try {
    const PDFDocument = require("pdfkit"),
      document = new PDFDocument({ autoFirstPage: false });
    document.resume();
    const image = document.openImage(value);
    document.end();
    if (!image.width || !image.height || image.width > 1500 || image.height > 600)
      fail("Resize the signature to at most 1500 × 600 pixels.", "invalid-argument");
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    fail("This signature image could not be read.", "invalid-argument");
  }
  return value;
}

// Export the handler separately for emulator integration tests without invoking production.
function createExamManager({ db, now = () => new Date() }) {
  return async (req) => {
    const uid = req.auth?.uid;
    if (!uid) fail("Sign in first.", "unauthenticated");
    const input = req.data || {},
      action = input.action;
    if (!validId(input.cycleId) || !validId(input.schoolId) || !/^[a-f\d-]{36}$/i.test(input.requestId || ""))
      fail("Choose an examination and retry the action.", "invalid-argument");
    const sid = input.schoolId,
      school = db.collection("schools").doc(sid);
    const actorRef = db.doc(`users/${uid}`),
      ownerRef = db.doc(`platform_admins/${uid}`),
      platformRef = db.doc(`platform_schools/${sid}`);
    const cycleRef = school.collection("exm_cycles").doc(input.cycleId);
    const requestRef = school.collection("exm_requests").doc(input.requestId);
    const stamp = { updatedBy: uid, updatedAt: now().toISOString() };
    const fingerprint = hash([uid, input]);
    return db.runTransaction(async (tx) => {
      const [actor, owner, platform, exam, receipt] = await tx.getAll(
        actorRef,
        ownerRef,
        platformRef,
        cycleRef,
        requestRef,
      );
      if (
        (!owner.exists &&
          (actor.get("role") !== "admin" ||
            actor.get("schoolId") !== sid ||
            !verifiedAdminSession(req.auth, actor.data()))) ||
        platform.get("status") === "suspended" ||
        platform.get("rolloverJob")
      )
        fail("Your account cannot manage examinations for this school.", "permission-denied");
      if (!exam.exists) fail("Examination no longer exists.", "not-found");
      if (receipt.exists) {
        if (receipt.get("fingerprint") !== fingerprint)
          fail("This request has already been used.", "already-exists");
        return receipt.get("response");
      }
      const cycle = { ...exam.data(), id: exam.id };
      const actorName = text(
        actor.get("name") || req.auth.token?.name || req.auth.token?.email || "School administrator",
        160,
      );
      const activityRef = school.collection("exm_activity").doc(`op_${input.requestId}`);
      let response = { ok: true },
        activity = {
          cycleId: exam.id,
          action,
          actorId: uid,
          actorName,
          at: stamp.updatedAt,
          requestId: input.requestId,
        };
      const audit = (more = {}) => {
        activity = { ...activity, ...more };
      };
      const operation = { operationId: input.requestId, ...stamp };
      const paperQuery = school.collection("exm_papers");

      if (action === "schedule" || action === "duty") {
        if (cycle.status === "Draft" || cycle.publicationState === "scheduled")
          fail("Publish the examination setup before managing its live timetable.");
        const [paperSnap, dutySnap, guard, calendar, staffSnap] = await Promise.all([
          tx.get(paperQuery),
          tx.get(school.collection("exm_duties")),
          tx.get(school.collection("exm_config").doc("schedule_guard")),
          tx.get(school.collection("calendar_events")),
          tx.get(school.collection("staff")),
        ]);
        const papers = rows(paperSnap),
          duties = rows(dutySnap),
          staff = rows(staffSnap);
        const staffName = (id) => {
          const member = staff.find(
            (s) => s.id === id && !/inactive|resigned|terminated|retired|left/i.test(s.status || ""),
          );
          if (id && !member) fail("Choose an active staff member.", "invalid-argument");
          return member?.name || "";
        };
        if (action === "schedule") {
          if (
            !Array.isArray(input.changes) ||
            !input.changes.length ||
            input.changes.length > 150 ||
            new Set(input.changes.map((c) => c.paperId)).size !== input.changes.length
          )
            fail("Select between one and 150 different papers.", "invalid-argument");
          const reason = text(input.reason, 1000),
            notes = text(input.notes);
          if (reason.length < 5) fail("Enter a reason with at least five characters.", "invalid-argument");
          const changes = input.changes.map((c) => {
            const p = papers.find((p) => p.id === c.paperId && p.cycleId === exam.id);
            if (!p) fail("A selected paper no longer belongs to this examination.");
            if (p.published?.length || p.marksEntered || p.status === "Completed")
              fail(
                `${p.subject}: results already exist. Reopen and correct results instead of moving a completed paper.`,
              );
            if (!Number.isInteger(c.revision) || c.revision !== (p.scheduleRevision || 0))
              fail("The timetable changed. Reload before rescheduling.");
            const scheduleStatus = c.scheduleStatus || "Scheduled";
            if (!["Scheduled", "Postponed", "Cancelled"].includes(scheduleStatus))
              fail("Invalid paper status.", "invalid-argument");
            const postponed = ["Postponed", "Cancelled"].includes(scheduleStatus);
            const invigilatorId =
              c.invigilatorId === undefined ? p.invigilatorId || "" : text(c.invigilatorId, 128);
            return {
              ...p,
              id: p.id,
              date: postponed ? "" : text(c.date, 10),
              start: postponed ? "" : text(c.start, 5),
              duration: postponed ? p.duration : c.duration,
              venue: text(c.venue ?? p.venue, 160),
              invigilatorId,
              invigilator: staffName(invigilatorId),
              scheduleStatus,
              scheduleRevision: (p.scheduleRevision || 0) + 1,
            };
          });
          const window = input.window
            ? { start: text(input.window.start, 10), end: text(input.window.end, 10) }
            : { start: cycle.start, end: cycle.end };
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(window.start) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(window.end) ||
            window.start > window.end ||
            [window.start, window.end].some((d) => {
              const parsed = new Date(d + "T12:00:00Z");
              return !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== d;
            })
          )
            fail("Enter a valid examination window.", "invalid-argument");
          const effectiveDuties = duties.filter(
            (d) =>
              d.role !== "Chief Invigilator" ||
              !changes.some((p) => p.id === d.paperId && p.invigilatorId !== d.staffId),
          );
          const errors = scheduleErrors(changes, papers, effectiveDuties, window, rows(calendar));
          for (const p of papers.filter(
            (p) =>
              p.cycleId === exam.id &&
              !changes.some((c) => c.id === p.id) &&
              p.date &&
              !["Cancelled", "Postponed"].includes(p.scheduleStatus),
          ))
            if (p.date < window.start || p.date > window.end)
              errors.push(`${p.subject}: the new examination window must also include unchanged papers.`);
          if (errors.length) fail(errors.slice(0, 5).join("\n"));
          const affectedDuties = duties.filter((d) => changes.some((p) => p.id === d.paperId));
          if (changes.length * 2 + affectedDuties.length > 450)
            fail("Too many assignments to move together; reschedule fewer papers at a time.");
          for (const next of changes) {
            const previous = papers.find((p) => p.id === next.id);
            const historyRef = school.collection("exm_schedule_history").doc(`${input.requestId}_${next.id}`);
            const history = {
              id: historyRef.id,
              cycleId: exam.id,
              paperId: next.id,
              subject: next.subject,
              previous: changesOf(previous),
              next: changesOf(next),
              reason,
              notes,
              actorId: uid,
              actorName,
              at: stamp.updatedAt,
              approvalStatus: "Approved",
              notify: input.notify !== false,
              notificationStatus: input.notify === false ? "Not requested" : "Pending",
              operationId: input.requestId,
            };
            tx.create(historyRef, history);
            tx.update(paperQuery.doc(next.id), {
              ...changesOf(next),
              scheduleRevision: next.scheduleRevision,
              locked: next.scheduleStatus !== "Scheduled",
              ...operation,
            });
            for (const d of affectedDuties.filter((d) => d.paperId === next.id)) {
              if (d.role === "Chief Invigilator" && d.staffId !== next.invigilatorId) {
                tx.delete(school.collection("exm_duties").doc(d.id));
                continue;
              }
              tx.update(school.collection("exm_duties").doc(d.id), {
                date: next.date,
                start: next.start,
                end: next.start ? hhmm(end(next)) : "",
                venue: next.venue,
                reportBy: next.start ? hhmm(Math.max(0, mins(next.start) - 30)) : "",
                status: next.scheduleStatus === "Scheduled" ? "upcoming" : "cancelled",
                ...operation,
              });
            }
          }
          const final = papers
            .filter((p) => p.cycleId === exam.id)
            .map((p) => changes.find((c) => c.id === p.id) || p);
          tx.update(cycleRef, {
            start: window.start,
            end: window.end,
            operationalStatus: final.every((p) => p.scheduleStatus === "Postponed")
              ? "Postponed"
              : "Scheduled",
            ...operation,
          });
          audit({
            action: changes.every((p) => p.scheduleStatus === "Postponed")
              ? "Exam postponed"
              : "Timetable changed",
            reason,
            paperIds: changes.map((p) => p.id),
            previous: changes.map((p) => ({
              paperId: p.id,
              ...changesOf(papers.find((old) => old.id === p.id)),
            })),
            next: changes.map((p) => ({ paperId: p.id, ...changesOf(p) })),
          });
        } else {
          if (!validId(input.paperId)) fail("Choose a paper.", "invalid-argument");
          const paper = papers.find((p) => p.id === input.paperId && p.cycleId === exam.id);
          if (!paper || ["Postponed", "Cancelled"].includes(paper.scheduleStatus))
            fail("Schedule the paper before assigning a duty.");
          const dutyId = input.dutyId || `dut_${input.requestId}`;
          if (!validId(dutyId)) fail("Invalid duty.", "invalid-argument");
          const prior = duties.find((d) => d.id === dutyId);
          if (prior && prior.paperId !== paper.id) fail("This duty belongs to a different paper.");
          let nextDuties = duties.filter((d) => d.id !== dutyId);
          const member = text(input.staffId, 128);
          if (input.remove !== true) {
            staffName(member);
            if (!member || !["Chief Invigilator", "Invigilator", "Reliever"].includes(input.role))
              fail("Select a staff member and duty role.", "invalid-argument");
            if (
              nextDuties.some((d) => d.paperId === paper.id && d.staffId === member) ||
              (paper.invigilatorId === member && input.role !== "Chief Invigilator")
            )
              fail("This staff member already has a duty for this paper.");
            const reportBy = text(input.reportBy || hhmm(Math.max(0, mins(paper.start) - 30)), 5);
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reportBy) || mins(reportBy) > mins(paper.start))
              fail("Reporting time must be before the examination starts.");
            const duty = {
              id: dutyId,
              cycleId: exam.id,
              paperId: paper.id,
              staffId: member,
              role: input.role,
              hall: text(input.hall, 160),
              venue: text(input.venue || paper.venue, 160),
              reportBy,
              date: paper.date,
              start: paper.start,
              end: hhmm(end(paper)),
              grade: paper.grade,
              subject: paper.subject,
              code: paper.code || "",
              classIds: paper.classIds || [],
              candidates: Array.isArray(paper.studentIds)
                ? paper.studentIds.length
                : Math.max(0, Math.min(5000, Number(input.candidates) || 0)),
              status: "upcoming",
              note: text(input.note),
              createdAt: prior?.createdAt || stamp.updatedAt,
              ...operation,
            };
            nextDuties = [...nextDuties, duty];
            const nextPaper =
              input.role === "Chief Invigilator" ? { ...paper, invigilatorId: member } : paper;
            const errors = scheduleErrors(
              [nextPaper],
              papers,
              nextDuties.filter(
                (d) =>
                  input.role !== "Chief Invigilator" ||
                  d.paperId !== paper.id ||
                  d.role !== "Chief Invigilator" ||
                  d.id === dutyId,
              ),
            );
            if (errors.length) fail(errors.join("\n"));
            if (input.role === "Chief Invigilator") {
              for (const old of nextDuties.filter(
                (d) => d.paperId === paper.id && d.role === "Chief Invigilator" && d.id !== dutyId,
              ))
                tx.delete(school.collection("exm_duties").doc(old.id));
              tx.update(paperQuery.doc(paper.id), {
                invigilatorId: member,
                invigilator: staffName(member),
                ...operation,
              });
            } else if (prior?.role === "Chief Invigilator" && paper.invigilatorId === prior.staffId)
              tx.update(paperQuery.doc(paper.id), { invigilatorId: "", invigilator: "", ...operation });
            tx.set(school.collection("exm_duties").doc(dutyId), duty);
          } else {
            if (!prior) fail("Duty no longer exists.");
            tx.delete(school.collection("exm_duties").doc(dutyId));
            if (prior.role === "Chief Invigilator" && paper.invigilatorId === prior.staffId)
              tx.update(paperQuery.doc(paper.id), { invigilatorId: "", invigilator: "", ...operation });
          }
          audit({
            action: input.remove ? "Invigilation removed" : "Invigilation assigned",
            paperId: paper.id,
            staffId: member,
            previous: prior || null,
            next: input.remove
              ? null
              : {
                  staffId: member,
                  role: input.role,
                  hall: text(input.hall, 160),
                  reportBy: text(input.reportBy, 5),
                },
          });
        }
        tx.set(guard.ref, { revision: (guard.get("revision") || 0) + 1, ...operation });
      } else if (action === "lock" || action === "subjectPublish") {
        if (!validId(input.paperId)) fail("Choose a paper.", "invalid-argument");
        const ref = paperQuery.doc(input.paperId),
          saved = await tx.get(ref),
          paper = { ...saved.data(), id: saved.id };
        if (
          !saved.exists ||
          paper.cycleId !== exam.id ||
          cycle.status === "Draft" ||
          paper.setupPublished === false ||
          ["Cancelled", "Postponed"].includes(paper.scheduleStatus)
        )
          fail("This paper is not available for marks entry.");
        if (action === "lock") {
          if (input.locked !== true && text(input.reason).length < 5)
            fail("A reason is required to reopen marks entry.", "invalid-argument");
          tx.update(ref, {
            locked: input.locked === true,
            ...(input.locked === true
              ? {}
              : {
                  published: [],
                  publishedClassIds: [],
                  lockedClassIds: [],
                  marksEntered: false,
                  status: "Scheduled",
                }),
            ...operation,
          });
          tx.update(cycleRef, { correctionPending: input.locked !== true, ...operation });
          audit({
            action: input.locked === true ? "Marks locked" : "Marks reopened",
            previous: { locked: paper.locked || false, published: paper.published || [] },
            next: {
              locked: input.locked === true,
              published: input.locked === true ? paper.published || [] : [],
            },
            paperId: paper.id,
            reason: text(input.reason),
          });
        } else {
          if (!validId(input.classId)) fail("Choose a division.", "invalid-argument");
          const section = await tx.get(school.collection("classes").doc(input.classId));
          if (!section.exists) fail("Division no longer exists.");
          const label =
            clsLabel(input.classId) === input.classId
              ? `${section.get("grade")}-${section.get("section")}`
              : clsLabel(input.classId);
          const roster = rows(
            await tx.get(school.collection("students").where("classId", "==", input.classId)),
          ).filter(
            (s) => s.deleted !== true && (s.status || "Active") === "Active" && participates(paper, s),
          );
          const markRows = rows(
            await tx.get(school.collection("exm_marks").where("paperId", "==", paper.id)),
          );
          if (!roster.length) fail("This paper has no participating students in that division.");
          for (const student of roster) {
            const mark = markRows.find(
              (m) => (m.studentId || String(m.candId).replace(/^cand_/, "")) === student.id,
            );
            const result = assessMark(mark, paper);
            if (!["verified", "exempt", "absent"].includes(result.state))
              fail(`${student.name}: marks must be complete and verified before publication.`);
          }
          const allSections = rows(await tx.get(school.collection("classes")));
          tx.update(ref, { ...paperPublication(paper, input.classId, label, allSections), ...operation });
          audit({ action: "Subject results published", paperId: paper.id, classId: input.classId });
        }
      } else if (action === "template") {
        if (!validId(input.templateId)) fail("Choose a template ID.", "invalid-argument");
        const template = input.template || {};
        if (
          !text(template.name, 120) ||
          !Array.isArray(template.classIds) ||
          template.classIds.length > 100 ||
          template.classIds.some((id) => !validId(id))
        )
          fail("Enter a template name and valid divisions.", "invalid-argument");
        const templateBody = {
          id: input.templateId,
          name: text(template.name, 120),
          classIds: template.classIds,
          showComponents: template.showComponents !== false,
          showAttendance: template.showAttendance === true,
          showRemarks: template.showRemarks !== false,
          showRank: template.showRank !== false,
          teacherSignature: text(template.teacherSignature, 150),
          principalSignature: text(template.principalSignature, 150),
          teacherSignatureImage: signatureImage(template.teacherSignatureImage),
          principalSignatureImage: signatureImage(template.principalSignatureImage),
          footer: text(template.footer, 500),
          ...operation,
        };
        tx.set(school.collection("exm_report_templates").doc(input.templateId), templateBody);
        audit({ action: "Report template saved", templateId: input.templateId });
      } else if (action === "remarks") {
        if (!validId(input.studentId)) fail("Choose a student.", "invalid-argument");
        const student = await tx.get(school.collection("students").doc(input.studentId));
        if (!student.exists) fail("Student no longer exists.");
        const present = input.attendancePresent ?? null,
          total = input.attendanceTotal ?? null;
        if (
          (present !== null || total !== null) &&
          (!Number.isInteger(present) ||
            !Number.isInteger(total) ||
            present < 0 ||
            total < present ||
            total > 366)
        )
          fail("Enter valid present / total attendance days.", "invalid-argument");
        tx.set(school.collection("exm_report_remarks").doc(`${exam.id}__${input.studentId}`), {
          cycleId: exam.id,
          studentId: input.studentId,
          classTeacher: text(input.classTeacher),
          principal: text(input.principal),
          attendancePresent: present,
          attendanceTotal: total,
          ...operation,
        });
        audit({ action: "Report remarks saved", studentId: input.studentId });
      } else if (["prepare", "submit", "approve", "publishReport"].includes(action)) {
        const batchRef =
          action === "prepare"
            ? school.collection("exm_report_batches").doc(`rep_${input.requestId}`)
            : validId(input.batchId)
              ? school.collection("exm_report_batches").doc(input.batchId)
              : null;
        if (!batchRef) fail("Select a report preview.", "invalid-argument");
        const batch = await tx.get(batchRef);
        const classId = action === "prepare" ? input.classId : batch.get("classId");
        if (
          !validId(classId) ||
          (action !== "prepare" && (!batch.exists || batch.get("cycleId") !== exam.id))
        )
          fail("Select a valid division/report preview.");
        const [paperSnap, studentSnap, sections, remarksSnap, schoolProfile, templates] = await Promise.all([
          tx.get(paperQuery.where("cycleId", "==", exam.id)),
          tx.get(school.collection("students").where("classId", "==", classId)),
          tx.get(school.collection("classes")),
          tx.get(school.collection("exm_report_remarks").where("cycleId", "==", exam.id)),
          tx.get(school.collection("school").doc("school")),
          tx.get(school.collection("exm_report_templates")),
        ]);
        const papers = rows(paperSnap).filter((p) => p.scheduleStatus !== "Cancelled");
        if (!papers.length || cycle.status === "Draft" || papers.some((p) => p.setupPublished === false))
          fail("Publish the examination timetable first.");
        const students = rows(studentSnap).filter(
          (s) => s.deleted !== true && (s.status || "Active") === "Active",
        );
        if (students.length > 180 || papers.length > 150)
          fail(
            "This division/exam is too large for a single report batch. Split the examination into smaller cohorts.",
          );
        let marks = [];
        for (let offset = 0; offset < papers.length; offset += 30)
          marks.push(
            ...rows(
              await tx.get(
                school.collection("exm_marks").where(
                  "paperId",
                  "in",
                  papers.slice(offset, offset + 30).map((p) => p.id),
                ),
              ),
            ),
          );
        const candidateOf = (s) => ({
          studentId: s.id,
          id: `cand_${s.id}`,
          name: s.name || "",
          classId: s.classId || "",
          grade: s.grade || "",
          section: s.section || "",
          roll: String(s.roll || ""),
          cls: clsLabel(s.classId),
          grn: s.grn || s.admissionNumber || "",
        });
        const candidates = students.map(candidateOf);
        const results = consolidated(cycle, papers, candidates, marks, rows(sections));
        if (!results.length) fail("No participating students in this division.");
        const invalid = results.filter((row) => !readyForReport(row, cycle.resultRules));
        if (invalid.length)
          fail(
            `${invalid.length} student(s) have incomplete or unverified results. First: ${invalid[0].name}.`,
          );
        if (papers.some((p) => p.scheduleStatus === "Postponed"))
          fail("Reschedule postponed papers and complete their results first.");
        if (cycle.resultRules?.rankScope === "class-course" && results.some((r) => r.pct !== null)) {
          // Class/course rank must be calculated against all participating divisions, never just this batch.
          const allStudents = rows(await tx.get(school.collection("students"))).filter(
            (s) => s.deleted !== true && (s.status || "Active") === "Active",
          );
          const cohort = consolidated(cycle, papers, allStudents.map(candidateOf), marks, rows(sections));
          for (const row of results)
            row.rank = cohort.find((c) => c.studentId === row.studentId)?.rank ?? null;
          if (
            cohort.some(
              (r) => results.some((s) => s.group === r.group) && !readyForReport(r, cycle.resultRules),
            )
          )
            fail("Complete and verify every division in this course before publishing course ranks.");
        }
        const template = rows(templates).find(
          (t) => t.id === (action === "prepare" ? input.templateId : batch.get("templateId")),
        ) ||
          rows(templates).find((t) => t.classIds?.includes(classId)) || {
            id: "default",
            name: "Standard report card",
            showComponents: true,
            showRemarks: true,
            showRank: true,
            showAttendance: false,
            teacherSignature: "Class teacher",
            principalSignature: "Principal",
            footer: "",
          };
        const remarks = rows(remarksSnap)
          .filter((r) => results.some((s) => s.studentId === r.studentId))
          .sort((a, b) => a.id.localeCompare(b.id));
        const content = results.map((r) => ({
          ...r,
          entries: r.entries.map(({ paper, mark, result }) => ({
            paper: {
              id: paper.id,
              subject: paper.subject,
              code: paper.code || "",
              assessmentMode: paper.assessmentMode || "marks",
              theory: paper.theory,
              internal: paper.internal,
              practical: paper.practical || 0,
              weight: paper.weight || 1,
            },
            mark: {
              theory: mark?.theory ?? null,
              internal: mark?.internal ?? null,
              practical: mark?.practical ?? null,
              status: mark?.status || "Present",
              gradeValue: mark?.gradeValue || "",
            },
            result,
          })),
        }));
        const sourceHash = hash([
          cycle.title,
          cycle.academicYear || cycle.term || "",
          cycle.resultRules || {},
          cycle.scale || "",
          content,
          remarks,
          template,
          schoolProfile.data() || {},
        ]);
        if (action !== "prepare" && sourceHash !== batch.get("sourceHash"))
          fail(
            "Marks, remarks, branding or template changed after preview. Generate a new preview before approving or publishing.",
          );
        if (action === "prepare") {
          let logoPath = schoolProfile.get("logoPath") || "";
          // Keep branding referenced by historical snapshots after a school replaces its current logo.
          if (logoPath.startsWith(`schools/${sid}/branding/`)) {
            const bucket = require("firebase-admin/storage").getStorage().bucket();
            const copyPath = `schools/${sid}/exam-branding/${hash(logoPath)}`;
            if (!(await bucket.file(copyPath).exists())[0])
              await bucket.file(logoPath).copy(bucket.file(copyPath));
            logoPath = copyPath;
          } else logoPath = "";
          const cards = content.map((row) => ({
            ...row,
            id: `${batchRef.id}__${row.studentId}`,
            cycleId: exam.id,
            batchId: batchRef.id,
            classId,
            exam: cycle.title,
            academicYear: cycle.academicYear || cycle.term || "",
            date: cycle.end || "",
            resultRules: cycle.resultRules || {},
            scale: cycle.scale || "",
            school: {
              name: schoolProfile.get("name") || "",
              city: schoolProfile.get("city") || "",
              affiliation: schoolProfile.get("affiliation") || "",
              logoPath,
            },
            template,
            remarks: remarks.find((m) => m.studentId === row.studentId) || {},
            status: "Preview",
            createdAt: stamp.updatedAt,
          }));
          tx.create(batchRef, {
            id: batchRef.id,
            cycleId: exam.id,
            classId,
            classLabel: clsLabel(classId),
            templateId: template.id,
            sourceHash,
            status: "Preview",
            students: results.length,
            createdBy: uid,
            createdAt: stamp.updatedAt,
            ...operation,
          });
          for (const card of cards) tx.create(school.collection("exm_report_cards").doc(card.id), card);
          for (const p of papers.filter((p) =>
            results.some((r) => r.entries.some((e) => e.paper.id === p.id)),
          ))
            tx.update(paperQuery.doc(p.id), {
              lockedClassIds: [...new Set([...(p.lockedClassIds || []), classId])],
              ...operation,
            });
          response = { ok: true, batchId: batchRef.id };
          audit({ action: "Report preview generated", batchId: batchRef.id, classId });
        } else if (action === "submit") {
          if (batch.get("status") !== "Preview") fail("Only a preview can be submitted.");
          tx.update(batchRef, { status: "Pending approval", submittedBy: uid, ...operation });
          audit({ action: "Results submitted for approval", batchId: batch.id, classId });
        } else if (action === "approve") {
          if (batch.get("status") !== "Pending approval") fail("Submit the preview for approval first.");
          tx.update(batchRef, {
            status: "Approved",
            approvedBy: uid,
            approvedAt: stamp.updatedAt,
            ...operation,
          });
          audit({ action: "Results approved", batchId: batch.id, classId });
        } else {
          if (batch.get("status") === "Published") fail("This report version is already published.");
          if (cycle.resultRules?.requireApproval && batch.get("status") !== "Approved")
            fail("Approve this exact report preview before publication.");
          const cards = await tx.get(school.collection("exm_report_cards").where("batchId", "==", batch.id));
          const previous = await tx.get(
            school.collection("exm_report_batches").where("cycleId", "==", exam.id),
          );
          if (cards.size !== results.length) fail("Preview records are incomplete. Generate a new preview.");
          for (const old of previous.docs.filter(
            (d) => d.get("classId") === classId && d.get("status") === "Published",
          ))
            tx.update(old.ref, { status: "Superseded", ...operation });
          for (const card of cards.docs)
            tx.update(card.ref, { status: "Published", publishedAt: stamp.updatedAt });
          for (const p of papers.filter((p) =>
            results.some((r) => r.entries.some((e) => e.paper.id === p.id)),
          ))
            tx.update(paperQuery.doc(p.id), {
              lockedClassIds: [...new Set([...(p.lockedClassIds || []), classId])],
              ...operation,
            });
          // Historic snapshots stay immutable. Only the batch's visibility changes.
          tx.update(batchRef, {
            status: "Published",
            publishedBy: uid,
            publishedAt: stamp.updatedAt,
            notify: input.notify !== false,
            notificationStatus: input.notify === false ? "Not requested" : "Pending",
            ...operation,
          });
          tx.update(cycleRef, { correctionPending: false, ...operation });
          audit({
            action: previous.docs.some((d) => d.get("classId") === classId && d.get("publishedAt"))
              ? "Results republished"
              : "Report cards published",
            batchId: batch.id,
            classId,
          });
        }
      } else if (SHEET_ACTIONS.includes(action)) {
        response = await runSheetAction({ tx, school, input, exam, cycle, uid, stamp, operation, audit, cycleRef, paperQuery, action });
      } else fail("Unknown examination operation.", "invalid-argument");
      tx.create(activityRef, { id: activityRef.id, ...activity });
      tx.create(requestRef, { fingerprint, response, actorId: uid, at: stamp.updatedAt });
      return response;
    });
  };
}

/**
 * Mark-sheet and class-result actions (docs/EXAMS_SHEETS_RESULTS_CONTRACT.md sections 1-2). Runs inside the
 * manageExamination transaction: every read happens before the first write, and the receipt/audit rows are
 * written by the caller. Write counts are bounded (WRITE_BUDGET) rather than chunked after the transaction, so a
 * sheet approval or class compilation is all-or-nothing; oversized cohorts get an error and must be split.
 */
async function runSheetAction({ tx, school, input, exam, cycle, uid, stamp, operation, audit, cycleRef, paperQuery, action }) {
  const sheetRef = (id) => school.collection("exm_sheets").doc(id);
  const resultRef = (id) => school.collection("exm_results").doc(id);
  const classResultRef = (id) => school.collection("exm_class_results").doc(id);
  const validSheetId = (v) => typeof v === "string" && /^[\w-]{1,128}__[\w-]{1,128}$/.test(v);
  const loadSheet = async () => {
    if (!validSheetId(input.sheetId)) fail("Choose a mark sheet.", "invalid-argument");
    const snap = await tx.get(sheetRef(input.sheetId));
    if (!snap.exists || snap.get("cycleId") !== exam.id) fail("This mark sheet no longer belongs to the examination.");
    return { ...snap.data(), id: snap.id };
  };
  const loadPaper = async (paperId) => {
    const snap = await tx.get(paperQuery.doc(paperId));
    if (!snap.exists || snap.get("cycleId") !== exam.id) fail("The sheet's paper no longer belongs to the examination.");
    return { ...snap.data(), id: snap.id };
  };
  const examTypeOf = async () =>
    cycle.examTypeId && validId(cycle.examTypeId)
      ? (await tx.get(school.collection("set_exam_types").doc(cycle.examTypeId))).data() || null
      : null;
  const transition = (sheet, to, who = "admin") => {
    if (!sheets.allowedTransition(sheet.status, to, who))
      fail(`Sheet is ${sheet.status || "missing"}. It cannot move to ${to} from there.`);
  };
  const budget = (writes) => {
    if (writes > WRITE_BUDGET)
      fail("This division/exam is too large for a single operation. Split the examination into smaller cohorts.");
  };
  const requireClassId = () => {
    if (!validId(input.classId)) fail("Choose a division.", "invalid-argument");
    return input.classId;
  };

  if (action === "openEntry") {
    if (cycle.status === "Draft" || cycle.publicationState === "scheduled")
      fail("Publish the examination setup before opening marks entry.");
    const [paperSnap, classSnap, assignmentSnap, staffSnap, sheetSnap] = await Promise.all([
      tx.get(paperQuery.where("cycleId", "==", exam.id)),
      tx.get(school.collection("classes")),
      tx.get(school.collection("assignments")),
      tx.get(school.collection("staff")),
      tx.get(school.collection("exm_sheets").where("cycleId", "==", exam.id)),
    ]);
    const papers = rows(paperSnap),
      classes = rows(classSnap);
    if (!papers.length) fail("Add papers to the examination before opening marks entry.");
    const classIds = [...new Set(papers.flatMap((p) => sheets.paperClasses(cycle, p, classes)))];
    const students = await studentsOfClasses(tx, school, classIds);
    const existing = rows(sheetSnap);
    const created = sheets.buildSheets(cycle, papers, students, rows(assignmentSnap), classes, existing.map((s) => s.id), {
      now: stamp.updatedAt,
      staff: rows(staffSnap),
      updatedBy: uid,
    });
    // exm_papers.sheetsOpened lets the Firestore rules dispatch teacher marks writes to the sheet rule without
    // looking up a sheet document that may not exist (see teacherMarksWrite in firestore.rules).
    const flagged = papers.filter(
      (p) => p.sheetsOpened !== true && [...existing, ...created].some((s) => s.paperId === p.id),
    );
    budget(created.length + flagged.length);
    for (const sheet of created) tx.create(sheetRef(sheet.id), { ...sheet, ...operation });
    for (const p of flagged) tx.update(paperQuery.doc(p.id), { sheetsOpened: true, ...operation });
    tx.update(cycleRef, {
      stage: ["tabulation", "published", "closed"].includes(cycle.stage) ? cycle.stage : "entry",
      entryOpenedAt: cycle.entryOpenedAt || stamp.updatedAt,
      ...operation,
    });
    audit({
      action: "Marks entry opened",
      sheetIds: created.map((s) => s.id),
      next: { created: created.length, total: existing.length + created.length },
    });
    return { ok: true, created: created.length, total: existing.length + created.length };
  }

  if (action === "sheetSubmit" || action === "sheetApprove") {
    const sheet = await loadSheet();
    transition(sheet, action === "sheetSubmit" ? "Submitted" : "Approved");
    const [paper, markSnap, classSnap, examType] = await Promise.all([
      loadPaper(sheet.paperId),
      tx.get(school.collection("exm_marks").where("paperId", "==", sheet.paperId)),
      action === "sheetApprove" ? tx.get(school.collection("classes")) : null,
      action === "sheetApprove" ? examTypeOf() : null,
    ]);
    const marks = rows(markSnap);
    const gap = sheets.completeness(sheet, marks, paper);
    if (gap.missing)
      fail(`${gap.missing} of ${sheet.rosterIds.length} students have no usable mark yet (missing or out of range).`);
    const summary = sheets.sheetSummary(sheet, marks, paper);
    if (action === "sheetSubmit") {
      tx.update(sheetRef(sheet.id), {
        status: "Submitted",
        submittedAt: stamp.updatedAt,
        submittedBy: uid,
        summary,
        ...operation,
      });
      audit({ action: "Sheet submitted", sheetId: sheet.id, paperId: sheet.paperId, classId: sheet.classId, previous: { status: sheet.status }, next: { status: "Submitted" } });
      return { ok: true, status: "Submitted" };
    }
    // Approval verifies every rostered mark in this transaction (bounded by WRITE_BUDGET, see runSheetAction).
    const roster = sheets.assessRoster(sheet, marks, paper).filter(({ mark }) => mark);
    budget(roster.length + 3);
    for (const { mark } of roster)
      tx.update(school.collection("exm_marks").doc(mark.id), {
        verified: true,
        verificationFingerprint: markFingerprint(mark, paper),
        ...operation,
      });
    tx.update(sheetRef(sheet.id), {
      status: "Approved",
      reviewedAt: stamp.updatedAt,
      reviewedBy: uid,
      reviewerId: uid,
      summary,
      ...operation,
    });
    const shareSubjectWise = examType?.shareSubjectWise === true;
    if (shareSubjectWise) {
      const allSections = rows(classSnap);
      tx.update(paperQuery.doc(paper.id), {
        ...paperPublication(paper, sheet.classId, sheets.classLabelOf(sheet.classId, allSections), allSections),
        ...operation,
      });
    }
    audit({
      action: "Sheet approved",
      sheetId: sheet.id,
      paperId: sheet.paperId,
      classId: sheet.classId,
      previous: { status: sheet.status },
      next: { status: "Approved", verified: roster.length, subjectShared: shareSubjectWise },
    });
    return { ok: true, status: "Approved", verified: roster.length, subjectShared: shareSubjectWise };
  }

  if (action === "sheetReturn") {
    const note = text(input.note);
    if (note.length < 5) fail("Enter a note with at least five characters.", "invalid-argument");
    const sheet = await loadSheet();
    if (sheet.status !== "Submitted") fail(`Sheet is ${sheet.status}. Only submitted sheets can be returned.`);
    tx.update(sheetRef(sheet.id), {
      status: "Returned",
      returnNote: note,
      reviewedAt: stamp.updatedAt,
      reviewedBy: uid,
      reviewerId: uid,
      ...operation,
    });
    audit({ action: "Sheet returned", sheetId: sheet.id, paperId: sheet.paperId, classId: sheet.classId, reason: note, previous: { status: sheet.status }, next: { status: "Returned" } });
    return { ok: true, status: "Returned" };
  }

  if (action === "sheetReopen") {
    const reason = text(input.reason);
    if (reason.length < 5) fail("Enter a reason with at least five characters.", "invalid-argument");
    const sheet = await loadSheet();
    if (!["Approved", "Locked"].includes(sheet.status))
      fail(`Sheet is ${sheet.status}. Only approved or locked sheets can be reopened.`);
    const [paper, classSnap, plan] = await Promise.all([
      loadPaper(sheet.paperId),
      tx.get(school.collection("classes")),
      readClassPublication(tx, school, exam.id, sheet.classId),
    ]);
    const label = sheets.classLabelOf(sheet.classId, rows(classSnap));
    const staleResults = plan.results.filter((r) => results.LIVE.includes(r.status) && r.stale !== true);
    budget(staleResults.length + 4);
    tx.update(sheetRef(sheet.id), {
      status: "Returned",
      version: (sheet.version || 1) + 1,
      reopenReason: reason,
      reviewedAt: stamp.updatedAt,
      reviewedBy: uid,
      reviewerId: uid,
      ...operation,
    });
    if (paper.publishedClassIds?.includes(sheet.classId) || (paper.published || []).includes(label))
      tx.update(paperQuery.doc(paper.id), { ...paperWithdrawal(paper, sheet.classId, label), ...operation });
    const marksStale = !!plan.classResult && results.LIVE.includes(plan.classResult.status);
    if (marksStale) {
      tx.update(classResultRef(plan.classResult.id), { stale: true, ...operation });
      for (const r of staleResults) tx.update(resultRef(r.id), { stale: true, ...operation });
    }
    tx.update(cycleRef, { correctionPending: true, ...operation });
    audit({
      action: "Sheet reopened",
      sheetId: sheet.id,
      paperId: sheet.paperId,
      classId: sheet.classId,
      reason,
      previous: { status: sheet.status, version: sheet.version || 1 },
      next: { status: "Returned", version: (sheet.version || 1) + 1, resultsStale: marksStale },
    });
    return { ok: true, status: "Returned", version: (sheet.version || 1) + 1, resultsStale: marksStale };
  }

  if (action === "sheetAssign") {
    const ownerId = text(input.ownerId, 128);
    if (ownerId && !validId(ownerId)) fail("Choose a staff member.", "invalid-argument");
    const sheet = await loadSheet();
    if (sheet.status === "Locked") fail("Sheet is Locked. Reopen it before changing its owner.");
    let ownerName = "";
    if (ownerId) {
      const member = await tx.get(school.collection("staff").doc(ownerId));
      if (!member.exists || /inactive|resigned|terminated|retired|left/i.test(member.get("status") || ""))
        fail("Choose an active staff member.", "invalid-argument");
      ownerName = member.get("name") || "";
    }
    tx.update(sheetRef(sheet.id), { ownerId, ownerName, ...operation });
    audit({
      action: "Sheet reassigned",
      sheetId: sheet.id,
      paperId: sheet.paperId,
      classId: sheet.classId,
      staffId: ownerId,
      previous: { ownerId: sheet.ownerId || "", ownerName: sheet.ownerName || "" },
      next: { ownerId, ownerName },
    });
    return { ok: true, ownerId, ownerName };
  }

  if (action === "compile") {
    const classId = requireClassId();
    const [sheetSnap, paperSnap, classSnap, typeSnap, plan] = await Promise.all([
      tx.get(school.collection("exm_sheets").where("cycleId", "==", exam.id).where("classId", "==", classId)),
      tx.get(paperQuery.where("cycleId", "==", exam.id)),
      tx.get(school.collection("classes")),
      tx.get(school.collection("set_exam_types")),
      readClassPublication(tx, school, exam.id, classId),
    ]);
    const classSheets = rows(sheetSnap);
    if (!classSheets.length) fail("Open marks entry for this division before compiling its results.");
    const open = classSheets.filter((s) => !["Approved", "Locked"].includes(s.status));
    if (open.length) fail(`${open.length} sheet(s) of this division are not approved yet. First: ${open[0].subject} (${open[0].status}).`);
    const papers = rows(paperSnap).filter((p) => p.scheduleStatus !== "Cancelled");
    if (!papers.length || cycle.status === "Draft" || papers.some((p) => p.setupPublished === false))
      fail("Publish the examination timetable first.");
    const classes = rows(classSnap);
    const courseWide = cycle.resultRules?.rankScope === "class-course";
    const students = courseWide
      ? activeStudents(await tx.get(school.collection("students")))
      : await studentsOfClasses(tx, school, [classId]);
    const roster = students.filter((s) => s.classId === classId);
    if (roster.length > 180 || papers.length > 150)
      fail("This division/exam is too large for a single compilation. Split the examination into smaller cohorts.");
    const marks = await marksForPapers(tx, school, papers.map((p) => p.id));
    const termResultsOfStudents = {};
    if (cycle.termId)
      for (const part of chunk(roster.map((s) => s.id), 30))
        for (const r of rows(await tx.get(school.collection("exm_results").where("studentId", "in", part))))
          if (r.cycleId !== exam.id && results.LIVE.includes(r.status))
            (termResultsOfStudents[r.studentId] ||= []).push(r);
    const examTypes = Object.fromEntries(rows(typeSnap).map((t) => [t.id, t]));
    const compiled = results.compileClass(cycle, papers, students.map(results.candidateOf), marks, classes, classId, {
      examType: examTypes[cycle.examTypeId] || null,
      examTypes,
      previousResults: plan.classResult ? [plan.classResult] : [],
      termResultsOfStudents,
    });
    if (!compiled.results.length) fail("No participating students in this division.");
    const previous = plan.classResult;
    const archive = previous?.status === "Published";
    const existing = new Map(plan.results.filter(results.isCanonical).map((r) => [r.id, r]));
    const orphans = [...existing.values()].filter((r) => !compiled.results.some((c) => c.id === r.id) && r.status !== "Published");
    budget(compiled.results.length * (archive ? 2 : 1) + orphans.length + classSheets.length + 3);
    const version = compiled.version;
    const stamped = { status: "Compiled", version, compiledAt: stamp.updatedAt, compiledBy: uid, ...operation };
    for (const r of compiled.results) {
      const old = existing.get(r.id);
      // The published version stays readable for parents until the new one is published (see publishResults).
      if (archive && old?.status === "Published") {
        const id = results.archivedId(r.id, old.version || previous.version);
        tx.set(resultRef(id), { ...old, id, archivedAt: stamp.updatedAt });
      }
      tx.set(resultRef(r.id), { ...r, ...stamped });
    }
    for (const r of orphans) tx.delete(resultRef(r.id));
    if (archive) {
      const id = results.archivedId(previous.id, previous.version);
      tx.set(classResultRef(id), { ...previous, id, archivedAt: stamp.updatedAt });
    }
    tx.set(classResultRef(compiled.classResult.id), { ...compiled.classResult, publishAt: null, ...stamped });
    for (const sheet of classSheets.filter((s) => s.status === "Approved"))
      tx.update(sheetRef(sheet.id), { status: "Locked", ...operation });
    tx.update(cycleRef, { stage: cycle.stage === "published" ? "published" : "tabulation", ...operation });
    audit({
      action: "Results compiled",
      classId,
      next: { version, students: compiled.results.length, incomplete: compiled.classResult.incomplete, sourceHash: compiled.sourceHash },
      previous: previous ? { status: previous.status, version: previous.version } : null,
    });
    return { ok: true, version, students: compiled.results.length, incomplete: compiled.classResult.incomplete };
  }

  if (action === "signOff") {
    const classId = requireClassId();
    const plan = await readClassPublication(tx, school, exam.id, classId);
    if (!plan.classResult) fail("Compile the division's results first.");
    if (plan.classResult.status !== "Compiled") fail(`Class results are ${plan.classResult.status}. Only compiled results can be signed off.`);
    if (plan.classResult.stale) fail("Marks changed after compilation. Compile the division again.");
    const current = plan.results.filter((r) => results.isCanonical(r) && r.status === "Compiled" && r.version === plan.classResult.version);
    budget(current.length + 2);
    const approval = { status: "Approved", approvedAt: stamp.updatedAt, approvedBy: uid, ...operation };
    for (const r of current) tx.update(resultRef(r.id), approval);
    tx.update(classResultRef(plan.classResult.id), approval);
    audit({ action: "Results signed off", classId, next: { version: plan.classResult.version, students: current.length } });
    return { ok: true, version: plan.classResult.version, students: current.length };
  }

  if (action === "publishResults") {
    const classIds = Array.isArray(input.classIds) ? [...new Set(input.classIds)] : [];
    if (!classIds.length || classIds.length > 50 || classIds.some((id) => !validId(id)))
      fail("Select between one and 50 divisions.", "invalid-argument");
    const publishAt = input.publishAt ? text(input.publishAt, 40) : "";
    if (publishAt && (!Number.isFinite(Date.parse(publishAt)) || Date.parse(publishAt) <= Date.parse(stamp.updatedAt)))
      fail("Choose a publication time in the future.", "invalid-argument");
    const shared = await readPublication(tx, school, exam.id);
    const plans = [];
    for (const classId of classIds) plans.push(await readClassPublication(tx, school, exam.id, classId));
    for (const plan of plans) {
      const blocker = publicationBlocker(cycle, plan.classResult);
      if (blocker) fail(`${sheets.classLabelOf(plan.classId, shared.classes)}: ${blocker}`);
    }
    if (publishAt) {
      const at = new Date(publishAt).toISOString();
      for (const plan of plans) tx.update(classResultRef(plan.classResult.id), { publishAt: at, ...operation });
      audit({ action: "Results publication scheduled", classIds, next: { publishAt: at } });
      return { ok: true, scheduled: at, classIds };
    }
    budget(plans.reduce((sum, p) => sum + p.results.length + shared.papers.length + 2, 0) + 1);
    let writes = 0;
    for (const plan of plans) writes += applyClassPublication(tx, school, cycle, shared, plan, operation);
    tx.update(cycleRef, { ...cycleAfterPublication(cycle, shared, classIds), ...operation });
    audit({
      action: shared.classResults.some((c) => classIds.includes(c.classId) && c.status === "Published")
        ? "Results republished"
        : "Results published",
      classIds,
      next: { versions: Object.fromEntries(plans.map((p) => [p.classId, p.classResult.version])), writes },
    });
    return { ok: true, published: classIds, writes };
  }

  if (action === "withdrawResults") {
    const classId = requireClassId();
    const reason = text(input.reason);
    if (reason.length < 5) fail("Enter a reason with at least five characters.", "invalid-argument");
    const shared = await readPublication(tx, school, exam.id);
    const plan = await readClassPublication(tx, school, exam.id, classId);
    if (plan.classResult?.status !== "Published") fail("Only published results can be withdrawn.");
    const label = sheets.classLabelOf(classId, shared.classes);
    const current = plan.results.filter((r) => results.isCanonical(r) && r.status === "Published");
    budget(current.length + shared.papers.length + 2);
    const back = { status: "Approved", withdrawnAt: stamp.updatedAt, withdrawnBy: uid, ...operation };
    for (const r of current) tx.update(resultRef(r.id), back);
    tx.update(classResultRef(plan.classResult.id), back);
    for (const paper of shared.papers)
      if (paper.publishedClassIds?.includes(classId) || (paper.published || []).includes(label))
        tx.update(paperQuery.doc(paper.id), { ...paperWithdrawal(paper, classId, label), ...operation });
    tx.update(cycleRef, { ...cycleAfterPublication(cycle, shared, [], [classId]), ...operation });
    audit({ action: "Results withdrawn", classId, reason, previous: { status: "Published", version: plan.classResult.version }, next: { status: "Approved" } });
    return { ok: true, status: "Approved", version: plan.classResult.version };
  }
  return fail("Unknown examination operation.", "invalid-argument");
}
exports.createExamManager = createExamManager;
exports.readPublication = readPublication;
exports.readClassPublication = readClassPublication;
exports.publicationBlocker = publicationBlocker;
exports.applyClassPublication = applyClassPublication;
exports.cycleAfterPublication = cycleAfterPublication;
exports.paperPublication = paperPublication;
exports.paperWithdrawal = paperWithdrawal;
exports.manageExamination = onCall({ timeoutSeconds: 180, memory: "512MiB" }, async (req) => {
  await requireAdminSession(req);
  return createExamManager({ db: getFirestore() })(req);
});
