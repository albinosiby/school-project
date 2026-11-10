// Keep the wire format in sync with school-dash/src/lib/academicStreams.ts.
const names = { science: "Science", commerce: "Commerce", humanities: "Humanities" };
const streams = "science|commerce|humanities|course_[a-z0-9]+(?:_[a-z0-9]+)*";
const aliases = { sci: "science", com: "commerce", arts: "humanities", hum: "humanities" };
const custom = /^course_[a-z0-9]+(?:_[a-z0-9]+)*$/;
function streamId(value = "") {
  const key = String(value).trim().toLowerCase();
  if (Object.hasOwn(aliases, key)) return aliases[key];
  if (Object.hasOwn(names, key) || (custom.test(key) && key.length <= 56)) return key;
  const slug = "course_" + key.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return custom.test(slug) && slug.length <= 56 ? slug : "";
}
const streamName = (id) => names[id] || id.slice(7).split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const classPattern = new RegExp(`^cls_(11|12)_(${streams})_([A-H])$`);
const clsLabel = (id = "") => {
  const match = classPattern.exec(id);
  return match ? `${match[1]}-${streamName(match[2])}-${match[3]}` : id.replace(/^cls_(\d+|LKG|UKG)([A-H])$/, "$1-$2");
};
const labelToClassId = (label = "") => {
  const parts = String(label).replace(/^Grade\s+/i, "").split("-");
  const grade = parts[0], section = (parts.at(-1) || "").toUpperCase();
  const stream = streamId(parts.slice(1, -1).join("-"));
  return /^(11|12)$/.test(grade) && stream ? `cls_${grade}_${stream}_${section}` : `cls_${grade}${section}`;
};
const audienceClassTest = (label = "") => {
  const match = /^(?:Grade\s+)?(LKG|UKG|\d+)(?:-(.+))?$/i.exec(String(label).trim());
  if (!match) return null;
  const grade = match[1].toUpperCase();
  const parts = (match[2] || "").split("-");
  const section = /^[A-H]$/i.test(parts.at(-1)) ? parts.pop().toUpperCase() : "[A-H]";
  const requested = parts.join("-");
  const stream = requested && /^(11|12)$/.test(grade) ? streamId(requested) : "";
  if (requested && !stream) return null;
  return stream ? new RegExp(`^cls_${grade}_${stream}_${section}$`) : new RegExp(`^cls_${grade}(?:${section}|_(?:${streams})_${section})$`);
};
module.exports = { clsLabel, labelToClassId, audienceClassTest };
