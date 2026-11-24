// Automatic roll numbers (DATA_CONTRACT section 3a). Settings → Classes & Sections → "Roll numbers" stores
// set_config/rolls { auto }. While auto is on (the default), a student who is in a division without a roll number
// for the current academic year gets one from the trigger below:
//   - a division with no roll numbers yet (never numbered, or just rolled over to the new year) is numbered
//     1..n in name order, so the whole class ends up alphabetical;
//   - a division that is already numbered gives the newcomer the next number after the highest in use, so the
//     numbers of the other students never change mid-year (attendance registers and mark sheets stay valid).
// Renumbering a whole school alphabetically is the "Number all classes" action on the same settings page.
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");

const validRoll = (value) => Number.isInteger(value) && value >= 1 && value <= 999;
const isActive = (s) => !!s && s.deleted !== true && (!s.status || s.status === "Active");
const byName = (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "en", { sensitivity: "base" }) || String(a.id).localeCompare(String(b.id));
/** holds a roll number that is valid for [year] (a number from an earlier year counts as none) */
const holdsRoll = (s, year) => validRoll(Number(s.roll)) && (!s.rollAcademicYear || !year || s.rollAcademicYear === year);

/**
 * Roll numbers to assign in one division: `[{id, roll}]` for the active students without a number for [year].
 * Empty division → 1..n alphabetical; otherwise newcomers in name order after the highest number in use.
 */
function rollPlan(roster, year) {
  const rows = roster.filter(isActive);
  const used = rows.filter((s) => holdsRoll(s, year)).map((s) => Number(s.roll));
  const pending = rows.filter((s) => !holdsRoll(s, year)).sort(byName);
  if (!pending.length) return [];
  let next = used.length ? Math.max(...used) + 1 : 1;
  return pending.map((s) => ({ id: s.id, roll: next++ })).filter((row) => validRoll(row.roll));
}

/** Assigns the missing roll numbers of one division in a transaction; returns how many were assigned. */
async function assignDivisionRolls(db, sid, classId) {
  const school = db.collection("schools").doc(sid);
  return db.runTransaction(async (tx) => {
    const [platform, settings, config, section] = await tx.getAll(
      db.collection("platform_schools").doc(sid), school.collection("school").doc("school"),
      school.collection("set_config").doc("rolls"), school.collection("classes").doc(classId),
    );
    if (platform.get("rolloverJob") || platform.get("status") === "suspended") return 0; // the rollover job renumbers afterwards
    if (config.exists && config.get("auto") === false) return 0; // manual mode: the office or class teacher allots
    const year = settings.get("academicYear") || "";
    const roster = await tx.get(school.collection("students").where("classId", "==", classId));
    const plan = rollPlan(roster.docs.map((d) => ({ id: d.id, ...d.data() })), year);
    if (!plan.length) return 0;
    const now = new Date().toISOString();
    for (const row of plan) tx.update(school.collection("students").doc(row.id), { roll: row.roll, rollAcademicYear: year, updatedAt: now, updatedBy: "system:rolls" });
    if (section.exists) tx.update(section.ref, { rollRevision: FieldValue.increment(1) });
    return plan.length;
  });
}

// A student joins a division (admission, division move, rollover) or loses a roll number: number the division.
const onStudentRollNeeded = onDocumentWritten("schools/{sid}/students/{id}", async (e) => {
  const after = e.data?.after?.data();
  if (!isActive(after) || typeof after.classId !== "string" || !after.classId) return;
  const before = e.data?.before?.data();
  // only when something relevant changed: a valid number for the same year is left alone
  if (validRoll(Number(after.roll)) && before && before.classId === after.classId && before.rollAcademicYear === after.rollAcademicYear && Number(before.roll) === Number(after.roll)) return;
  try {
    const n = await assignDivisionRolls(getFirestore(), e.params.sid, after.classId);
    if (n) logger.info("roll numbers assigned", { sid: e.params.sid, classId: after.classId, assigned: n });
  } catch (error) {
    logger.error("roll assignment failed", { sid: e.params.sid, classId: after.classId, error: String(error) });
  }
});

module.exports = { rollPlan, assignDivisionRolls, onStudentRollNeeded, validRoll };
