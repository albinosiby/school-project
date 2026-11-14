function schoolTimeZone(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || /^IST\b|New Delhi/i.test(name)) return "Asia/Kolkata";
  if (/^GST\b|Dubai/i.test(name)) return "Asia/Dubai";
  try { new Intl.DateTimeFormat("en", { timeZone: name }); return name; } catch { return "Asia/Kolkata"; }
}
function schoolDate(now = Date.now(), zone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: schoolTimeZone(zone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (key) => parts.find((entry) => entry.type === key).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
module.exports = { schoolTimeZone, schoolDate };
