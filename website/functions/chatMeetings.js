// Meetings scheduled from a teacher ↔ parent chat (schools/{sid}/msg_meetings, written by the teacher app):
// {threadId, studentId, studentName, parentUids, teacherId, teacher, guardian, date, time, startsAt (UTC ISO), link,
//  note, status: scheduled|cancelled, reminders: {day?, h1?, m10?}}.
// The meeting card itself is a normal msg_messages row (so onMessageCreated pushes it); this module only sends the
// three reminders to both sides: the morning of the meeting, one hour before and ten minutes before.
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");

const MORNING_HOUR = 7, TZ_OFFSET_MIN = 330; // 07:00 India time; the schools run on one timezone (DATA_CONTRACT §10)

/** Which reminder is due now for a meeting starting at [start] (ms), or null. */
function dueReminder(start, now, sent = {}) {
  const left = start - now;
  if (left <= 0) return null;
  if (left <= 10 * 60e3) return sent.m10 ? null : "m10";
  if (left <= 60 * 60e3) return sent.h1 ? null : "h1";
  // same local day and past the morning hour
  const local = (t) => new Date(t + TZ_OFFSET_MIN * 60e3);
  const a = local(start), b = local(now);
  const sameDay = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  if (sameDay && b.getUTCHours() >= MORNING_HOUR) return sent.day ? null : "day";
  return null;
}

const label = { day: "Today", h1: "In 1 hour", m10: "In 10 minutes" };
const fmtTime = (hhmm) => { const [h, m] = String(hhmm ?? "").split(":").map(Number); const am = h < 12; return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${am ? "AM" : "PM"}`; };

module.exports = ({ db, notify, shared }) => {
  async function sendDue(now = Date.now()) {
    const horizon = new Date(now + 26 * 3600e3).toISOString();
    const snap = await db.collectionGroup("msg_meetings").where("status", "==", "scheduled").where("startsAt", "<=", horizon).get();
    let sent = 0;
    for (const doc of snap.docs) {
      const m = doc.data(), sid = doc.ref.parent.parent?.id;
      if (!sid) continue;
      const start = Date.parse(m.startsAt ?? "");
      if (!Number.isFinite(start)) continue;
      const key = dueReminder(start, now, m.reminders ?? {});
      if (!key) continue;
      const when = `${label[key]} at ${fmtTime(m.time)}`;
      const route = `/messages/${m.threadId}`;
      await doc.ref.set({ reminders: { ...(m.reminders ?? {}), [key]: true }, updatedAt: new Date(now).toISOString() }, { merge: true });
      try {
        if (m.teacherId) {
          await notify(sid, [m.teacherId], { type: "meeting", category: "Messages", tag: "Meeting", urgent: key === "m10",
            title: `Meeting with ${m.guardian || "parent"}${m.studentName ? ` (${m.studentName})` : ""}`, body: `${when} · Google Meet`, route });
        }
        const parents = Array.isArray(m.parentUids) ? m.parentUids.filter((u) => typeof u === "string" && u) : [];
        if (parents.length && shared.notifyParents) {
          await shared.notifyParents(sid, parents.map((uid) => ({ id: `meet_${doc.id}_${key}_${uid}`, uid, studentId: m.studentId ?? "", type: "meeting",
            title: `Meeting with ${m.teacher || "teacher"}`, body: `${when} · Google Meet${m.note ? ` · ${String(m.note).slice(0, 80)}` : ""}`, route: `/messages/thread/${m.threadId}` })));
        }
        sent++;
      } catch (err) {
        logger.warn("meeting reminder failed", { sid, meeting: doc.id, key, err: String(err?.message ?? err) });
      }
    }
    return sent;
  }
  return {
    sendDue,
    sendChatMeetingReminders: onSchedule({ schedule: "every 5 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 300, memory: "256MiB", retryCount: 1 }, async () => { await sendDue(); }),
  };
};
module.exports.dueReminder = dueReminder;
