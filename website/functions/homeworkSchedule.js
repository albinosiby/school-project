// Homework timing (DATA_CONTRACT section 13.2):
//   - scheduled homework (ops_homework status "scheduled", publishAt ISO time): published when its time comes; the
//     status change to "open" makes onHomeworkForParents tell the parents, as for homework set right away;
//   - two days before the due day (from 08:00 India time): the parents of every student who has not handed in yet;
//   - on the due day (from 08:00): the teacher, with how many have handed in and how many have not.
// Each reminder is sent once per homework and due day (reminder_log/hw2d_{id}_{due} / hwdue_{id}_{due}).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");

const MORNING_HOUR = 8, TZ = 330;
const localDay = (t) => new Date(t + TZ * 60e3).toISOString().slice(0, 10);
const localHour = (t) => new Date(t + TZ * 60e3).getUTCHours();

/** Open for hand-ins and reminders: not deleted, not draft / scheduled / closed. */
const live = (h) => h && h.deleted !== true && !/draft|scheduled|closed|completed/i.test(String(h.status ?? ""));

/** Students of [roster] who have not handed in (no parent upload, submission still pending). */
function notHandedIn(h, roster) {
  return roster.filter((s) => {
    if (h?.handins?.[s.id]) return false;
    const st = h?.submissions?.[s.id]?.status;
    return !st || st === "pending";
  });
}

/** Which reminder is due for homework [h] now: "parents2d" two days before, "teacherDue" on the day (both from 08:00). */
function reminderFor(h, now) {
  if (!live(h) || localHour(now) < MORNING_HOUR) return null;
  const due = String(h.due ?? "").slice(0, 10);
  if (due === localDay(now + 2 * 86400e3)) return "parents2d";
  if (due === localDay(now)) return "teacherDue";
  return null;
}

/** Scheduled homework whose publish time has come. */
const publishDue = (h, now) => h && h.deleted !== true && h.status === "scheduled" && Number.isFinite(Date.parse(h.publishAt ?? "")) && Date.parse(h.publishAt) <= now;

module.exports = ({ db, notify, shared }) => {
  const S = (sid) => db.collection("schools").doc(sid);

  async function claim(sid, id) {
    try { await S(sid).collection("reminder_log").doc(id).create({ at: new Date().toISOString() }); return true; } catch (e) {
      if (e?.code === 6 || /already exists/i.test(String(e?.message))) return false;
      throw e;
    }
  }

  async function run(now = Date.now()) {
    let published = 0, reminded = 0;
    const days = [localDay(now), localDay(now + 2 * 86400e3)];
    for (const school of await db.collection("schools").listDocuments()) {
      const sid = school.id;
      try {
        // 1. publish scheduled homework
        const scheduled = await school.collection("ops_homework").where("status", "==", "scheduled").get();
        for (const d of scheduled.docs) {
          if (!publishDue(d.data(), now)) continue;
          const ok = await db.runTransaction(async (tx) => {
            const cur = await tx.get(d.ref);
            if (!publishDue(cur.data(), now)) return false;
            tx.update(d.ref, { status: "open", publishedAt: new Date(now).toISOString(), assigned: localDay(now), updatedAt: new Date(now).toISOString(), updatedBy: "functions" });
            return true;
          });
          if (ok) published++;
        }
        // 2. reminders
        const dueSoon = await school.collection("ops_homework").where("due", "in", days).get();
        for (const d of dueSoon.docs) {
          const h = d.data();
          const kind = reminderFor(h, now);
          if (!kind) continue;
          const roster = await shared.classRoster(sid, h.classId);
          const pending = notHandedIn(h, roster);
          const title = String(h.title ?? "Homework").slice(0, 80);
          if (kind === "parents2d") {
            if (!pending.length || !(await claim(sid, `hw2d_${d.id}_${h.due}`))) continue;
            await shared.notifyParents(sid, shared.guardiansOf(pending).map(({ uid, student }) => ({
              id: `hw2d_${d.id}_${student.id}_${uid}`, uid, studentId: student.id, type: "homework",
              title: `Reminder: ${title} is due in 2 days`,
              body: `${student.name ?? "Your child"} has not handed it in yet${h.subject ? ` · ${h.subject}` : ""} · upload photos or a PDF in the app`.slice(0, 140),
              route: `/academics/homework/${d.id}`,
            })));
            reminded++;
          } else if (h.teacherId && (await claim(sid, `hwdue_${d.id}_${h.due}`))) {
            const total = roster.length, done = total - pending.length;
            await notify(sid, [h.teacherId], {
              type: "homework", category: "Homework", tag: "Due today",
              title: `Due today: ${title}`,
              body: `${done} of ${total} handed in${pending.length ? ` · ${pending.length} not yet` : " · everyone handed in"}`,
              route: `/homework/${d.id}`,
            });
            reminded++;
          }
        }
      } catch (err) {
        logger.warn("homework schedule failed for a school", { sid, err: String(err?.message ?? err) });
      }
    }
    return { published, reminded };
  }

  return {
    run,
    homeworkSchedule: onSchedule({ schedule: "every 5 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 300, memory: "256MiB", retryCount: 1 }, async () => {
      const r = await run();
      if (r.published || r.reminded) logger.info("homework schedule", r);
    }),
  };
};
Object.assign(module.exports, { live, notHandedIn, reminderFor, publishDue, localDay });
