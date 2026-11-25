// Reminders for class meetings and live classes (DATA_CONTRACT section 6 and 10):
//   - pm_meetings (parent-teacher meetings, teacher-private, status "upcoming"): the teacher and every parent of the class;
//   - live_classes (status scheduled, not a draft or cancelled): the teacher and every parent of the class.
// Two reminders each: the morning of the day (from 07:00 India time) and one hour before the start. Each reminder
// is sent once per meeting time: reminder_log/{kind}_{id}_{start}_{key} is created first, so a rerun or a second
// instance skips it, and a rescheduled meeting (new start) gets its reminders again.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");

const MORNING_HOUR = 7, TZ = 330; // minutes east of UTC (Asia/Kolkata)

/** start (ms) of "YYYY-MM-DD" + "HH:MM" India time, or NaN */
const startOf = (date, time) => Date.parse(`${String(date ?? "").slice(0, 10)}T${String(time ?? "").slice(0, 5)}:00+05:30`);

/** "day" from 07:00 on the day until an hour before, "h1" in the last hour, else null (also once started). */
function reminderKey(start, now) {
  const left = start - now;
  if (!Number.isFinite(start) || left <= 0) return null;
  if (left <= 60 * 60e3) return "h1";
  const local = (t) => new Date(t + TZ * 60e3);
  const a = local(start), b = local(now);
  const sameDay = a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  return sameDay && b.getUTCHours() >= MORNING_HOUR ? "day" : null;
}

const t12 = (hhmm) => { const [h, m] = String(hhmm ?? "").split(":").map(Number); return Number.isFinite(h) ? `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` : ""; };
const isOnline = (m) => !/person/i.test(String(m.format ?? ""));
const liveScheduled = (c) => c.deleted !== true && !/cancel|draft/i.test(String(c.status ?? ""));

module.exports = ({ db, notify, shared }) => {
  const S = (sid) => db.collection("schools").doc(sid);

  /** true when this reminder was not sent yet (and is now claimed) */
  async function claim(sid, id) {
    try { await S(sid).collection("reminder_log").doc(id).create({ at: new Date().toISOString() }); return true; } catch (e) {
      if (e?.code === 6 || /already exists/i.test(String(e?.message))) return false;
      throw e;
    }
  }

  async function remind(sid, kind, id, item, key, { teacherId, teacherTitle, parentTitle, body, teacherRoute, parentRoute, type }) {
    const start = startOf(item.date, item.time);
    if (!(await claim(sid, `${kind}_${id}_${start}_${key}`))) return 0;
    const when = `${key === "h1" ? "In 1 hour" : "Today"} at ${t12(item.time)}`;
    if (teacherId) await notify(sid, [teacherId], { type, category: "Duties", tag: kind === "ptm" ? "Parent Meeting" : "Live Class", title: teacherTitle, body: `${when} · ${body}`, route: teacherRoute });
    if (item.classId && shared.classRoster && shared.notifyParents) {
      const roster = await shared.classRoster(sid, item.classId);
      await shared.notifyParents(sid, shared.guardiansOf(roster).map(({ uid, student }) => ({
        id: `rem_${kind}_${id}_${start}_${key}_${student.id}_${uid}`, uid, studentId: student.id, type, title: parentTitle, body: `${when} · ${body}`, route: parentRoute,
      })));
    }
    return 1;
  }

  async function sendDue(now = Date.now()) {
    const local = (t) => new Date(t + TZ * 60e3).toISOString().slice(0, 10);
    const days = [local(now), local(now + 86400e3)];
    let sent = 0;
    const schools = await db.collection("schools").listDocuments();
    for (const school of schools) {
      const sid = school.id;
      try {
        const [ptm, live] = await Promise.all([
          school.collection("pm_meetings").where("date", "in", days).get(),
          school.collection("live_classes").where("date", "in", days).get(),
        ]);
        for (const doc of ptm.docs) {
          const m = doc.data();
          if (m.status !== "upcoming") continue;
          const key = reminderKey(startOf(m.date, m.time), now);
          if (!key) continue;
          const where = isOnline(m) ? `Online${m.link ? `: ${m.link}` : " on Google Meet"}` : `In person${m.venue ? ` at ${m.venue}` : ""}`;
          sent += await remind(sid, "ptm", doc.id, m, key, { type: "ptm", teacherId: m.teacherId,
            teacherTitle: `Parent meeting: ${m.title || "Class meeting"}`, parentTitle: `Parent-teacher meeting: ${m.title || "Class meeting"}`,
            body: where, teacherRoute: "/meetings", parentRoute: "/notifications" });
        }
        for (const doc of live.docs) {
          const c = doc.data();
          if (!liveScheduled(c)) continue;
          const key = reminderKey(startOf(c.date, c.time), now);
          if (!key) continue;
          const name = c.title || c.subject || "Live class";
          sent += await remind(sid, "live", doc.id, c, key, { type: "live", teacherId: c.teacherId,
            teacherTitle: `Live class: ${name}`, parentTitle: `Live class: ${name}`, body: [c.subject, c.link ? `Join: ${c.link}` : "Google Meet"].filter(Boolean).join(" · "),
            teacherRoute: "/live-classes", parentRoute: "/more/live" });
        }
      } catch (err) {
        logger.warn("class reminders failed for a school", { sid, err: String(err?.message ?? err) });
      }
    }
    return sent;
  }

  return {
    sendDue,
    sendClassReminders: onSchedule({ schedule: "every 5 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 300, memory: "256MiB", retryCount: 1 }, async () => {
      const n = await sendDue();
      if (n) logger.info("class reminders sent", { n });
    }),
  };
};
module.exports.reminderKey = reminderKey;
module.exports.startOf = startOf;
