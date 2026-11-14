const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");

async function publishDueExams(db, now = new Date()) {
  let published = 0;
  for (const school of await db.collection("schools").listDocuments()) {
    const exams = await school.collection("exm_cycles").where("publicationState", "==", "scheduled").get();
    for (const exam of exams.docs) {
      if (
        !exam.get("publishAt") ||
        Date.parse(exam.get("publishAt")) > +now ||
        !Number.isFinite(Date.parse(exam.get("publishAt")))
      )
        continue;
      const papers = await school.collection("exm_papers").where("cycleId", "==", exam.id).get();
      published += await db.runTransaction(async (tx) => {
        const current = await tx.get(exam.ref);
        if (
          current.get("publicationState") !== "scheduled" ||
          current.get("status") !== "Draft" ||
          current.get("setupVersion") !== exam.get("setupVersion") ||
          !current.get("publishAt") ||
          Date.parse(current.get("publishAt")) > +now
        )
          return 0;
        const savedPapers = papers.size ? await tx.getAll(...papers.docs.map((paper) => paper.ref)) : [];
        if (
          !savedPapers.length ||
          savedPapers.some(
            (paper) => !paper.exists || paper.get("setupVersion") !== current.get("setupVersion"),
          )
        )
          throw new Error("Exam papers changed during scheduled publication");
        const stamp = { updatedAt: now.toISOString(), updatedBy: "examPublication" };
        for (const paper of savedPapers)
          tx.update(paper.ref, { locked: false, setupPublished: true, ...stamp });
        tx.update(exam.ref, { publicationState: "published", status: "Scheduled", ...stamp });
        return 1;
      });
    }
  }
  return published;
}

/**
 * Publishes class results whose scheduled `publishAt` has passed (manageExamination publishResults with a date),
 * through the same routine the immediate action uses. Returns the number of divisions published.
 */
async function publishDueClassResults(db, now = new Date()) {
  const { readPublication, readClassPublication, publicationBlocker, applyClassPublication, cycleAfterPublication } =
    require("./examManagement");
  const { createHash } = require("node:crypto");
  let published = 0;
  for (const school of await db.collection("schools").listDocuments()) {
    const due = await school.collection("exm_class_results").where("publishAt", "<=", now.toISOString()).get();
    for (const doc of due.docs) {
      if (!["Approved", "Compiled"].includes(doc.get("status")) || !doc.get("cycleId") || !doc.get("classId")) continue;
      published += await db.runTransaction(async (tx) => {
        const cycleRef = school.collection("exm_cycles").doc(doc.get("cycleId"));
        const [exam, shared, plan] = await Promise.all([
          tx.get(cycleRef),
          readPublication(tx, school, doc.get("cycleId")),
          readClassPublication(tx, school, doc.get("cycleId"), doc.get("classId")),
        ]);
        const current = plan.classResult;
        if (
          !exam.exists ||
          !current?.publishAt ||
          current.publishAt !== doc.get("publishAt") ||
          Date.parse(current.publishAt) > +now
        )
          return 0;
        const cycle = { ...exam.data(), id: exam.id };
        const operationId = "sched_" + createHash("sha256").update(`${current.id}:${current.publishAt}:${current.version}`).digest("hex").slice(0, 32);
        const stamp = { updatedAt: now.toISOString(), updatedBy: "examPublication", operationId };
        const blocker = publicationBlocker(cycle, current);
        const activity = school.collection("exm_activity").doc(`op_${operationId}`);
        if (blocker) {
          // Leave the result as it is; the dashboard shows why the scheduled publication did not happen.
          tx.update(doc.ref, { publishAt: null, publishError: blocker, ...stamp });
          tx.set(activity, { id: activity.id, cycleId: cycle.id, classId: current.classId, action: "Scheduled publication failed", reason: blocker, actorId: "examPublication", actorName: "Scheduled publication", at: stamp.updatedAt });
          return 0;
        }
        applyClassPublication(tx, school, cycle, shared, plan, stamp);
        tx.update(cycleRef, { ...cycleAfterPublication(cycle, shared, [current.classId]), ...stamp });
        tx.set(activity, { id: activity.id, cycleId: cycle.id, classId: current.classId, action: "Results published", actorId: "examPublication", actorName: "Scheduled publication", at: stamp.updatedAt, next: { version: current.version, scheduled: current.publishAt } });
        return 1;
      });
    }
  }
  return published;
}

module.exports = ({ db, notifyParents, guardiansOf }) => {
  const publishScheduledExams = onSchedule(
    { schedule: "every 5 minutes", timeZone: "Asia/Kolkata" },
    async () => {
      const count = await publishDueExams(db);
      const classResults = await publishDueClassResults(db);
      const expiredLinks = await db.collection("exam_download_links").where("expiresAt", "<=", Date.now()).limit(400).get();
      if (!expiredLinks.empty) {
        const batch = db.batch();
        for (const link of expiredLinks.docs) batch.delete(link.ref);
        await batch.commit();
      }
      logger.info("Scheduled exam publication", { count, classResults });
    },
  );
  const onExamTimetablePublished = onDocumentWritten(
    { document: "schools/{sid}/exm_cycles/{cycleId}", retry: true },
    async (event) => {
      const before = event.data?.before?.data();
      const exam = event.data?.after?.data();
      if (exam?.publicationState !== "published" || before?.publicationState === "published") return;
      const school = db.collection("schools").doc(event.params.sid);
      const latest = await school.collection("exm_cycles").doc(event.params.cycleId).get();
      if (latest.get("publicationState") !== "published" || latest.get("setupVersion") !== exam.setupVersion) return;
      const papers = await school.collection("exm_papers").where("cycleId", "==", event.params.cycleId).get();
      const ids = [...new Set(papers.docs.flatMap((paper) => paper.get("studentIds") ?? []))];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const students = await db.getAll(
          ...ids.slice(offset, offset + 100).map((id) => school.collection("students").doc(id)),
        );
        for (const student of students.filter((doc) => doc.exists && doc.get("deleted") !== true)) {
          const timetable = papers.docs.filter((paper) =>
            (paper.get("studentIds") ?? []).includes(student.id),
          );
          for (const paper of timetable) {
            const p = paper.data();
            const [hours, minutes] = p.start.split(":").map(Number);
            const finish = hours * 60 + minutes + Math.round(p.duration * 60);
            const end = `${String(Math.floor(finish / 60)).padStart(2, "0")}:${String(finish % 60).padStart(2, "0")}`;
            await notifyParents(
              event.params.sid,
              guardiansOf([{ ...student.data(), id: student.id }]).map(({ uid }) => ({
                id: "exam_schedule_" + event.params.cycleId + "_" + paper.id + "_" + student.id + "_" + uid,
                uid,
                studentId: student.id,
                type: "exam",
                title: exam.title + " · " + p.subject,
                body: [
                  student.get("name"),
                  p.date + " · " + p.start + "–" + end,
                  p.venue && "Room: " + p.venue,
                  p.instructions,
                  exam.instructions,
                ]
                  .filter(Boolean)
                  .join("\n")
                  .slice(0, 2200),
                route: "/notifications",
              })),
            );
          }
        }
      }
    },
  );
  return { publishScheduledExams, onExamTimetablePublished };
};
module.exports.publishDueExams = publishDueExams;
module.exports.publishDueClassResults = publishDueClassResults;
