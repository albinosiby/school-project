const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { schoolTimeZone } = require("./schoolTime");
const { appMessaging } = require("./appMessaging");
// Resolve an institution's wall-clock event time without assuming the server timezone.
function eventInstant(date, time, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) return NaN;
  const target = Date.parse(`${date}T${time}:00Z`), formatter = new Intl.DateTimeFormat("en-CA", { timeZone: schoolTimeZone(timezone), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(guess).map(({ type, value }) => [type, value]));
    const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    guess += target - shown;
  }
  return guess;
}
async function sendReminders(now = Date.now(), service = appMessaging(), db = getFirestore()) {
  const events = await db.collectionGroup("calendar_events").where("remindApp", "==", true).get();
  let sent = 0;
  for (const event of events.docs) {
    const data = event.data(), sid = event.ref.parent.parent.id;
    if (data.status !== "published" || data.deleted) continue;
    const [platform, regional] = await Promise.all([db.collection("platform_schools").doc(sid).get(), event.ref.parent.parent.collection("set_config").doc("regional").get()]);
    if (platform.get("status") === "suspended") continue;
    const start = eventInstant(data.start, data.startTime || "08:30", regional.get("timezone"));
    if (!Number.isFinite(start) || now >= start || now < start - 48 * 3600e3) continue;
    await service.broadcast(sid, `event48:${event.id}:${start}`, { type: "event", title: `Upcoming: ${data.title}`, body: `${data.start}${data.startTime ? ` · ${data.startTime}` : ""}${data.venue ? ` · ${data.venue}` : ""}`.slice(0,240), route: "/notifications", urgent: false }, "All School", data.grades || []);
    sent++;
  }
  return sent;
}
exports.eventInstant = eventInstant;
exports.sendReminders = sendReminders;
exports.sendCalendarAppReminders = onSchedule({ schedule: "every 60 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 540, memory: "512MiB", retryCount: 3 }, async () => { await sendReminders(); });
