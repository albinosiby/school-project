const { createHash } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const defaults = require("./staffNumberingDefaults.json");

const employeeKey = (value) => typeof value === "string" ? value.trim().toUpperCase() : "";
const employeeRef = (school, id) =>
  school.collection("staff_employee_ids").doc(createHash("sha256").update(employeeKey(id)).digest("hex"));
const maxStart = Number.MAX_SAFE_INTEGER - 1;
const sequenceToken = /\{SEQ(?::([1-9]))?\}/g;
const duplicate = () => new HttpsError("already-exists", "Another staff member has this employee ID.", {
  fields: { empId: "This employee ID is already used." },
});

async function reserveEmployeeId(tx, school, staffId, { requested = "", previous = "", stamp }) {
  const previousKey = employeeKey(previous);
  const requestedKey = employeeKey(requested);
  if (previousKey && (!requestedKey || requestedKey === previousKey)) return previous;

  const automatic = !requestedKey;
  const settingsRef = school.collection("set_config").doc(defaults.id);
  const config = automatic ? (await tx.get(settingsRef)).data() ?? defaults : defaults;
  const staff = await tx.get(school.collection("staff").select("empId"));
  const taken = new Set(staff.docs.filter((row) => row.id !== staffId).map((row) => employeeKey(row.get("empId"))));
  const previousReservation = previousKey ? await tx.get(employeeRef(school, previousKey)) : null;

  let employeeId = requestedKey;
  let next;
  let reservation;
  if (automatic) {
    const template = config.template;
    const start = config.start;
    next = config.next ?? start;
    if (typeof template !== "string" || template.length > 64 || (template.match(sequenceToken)?.length ?? 0) !== 1 ||
        !/^[a-z\d_-]+$/i.test(template.replaceAll("{YEAR}", "0").replace(sequenceToken, "0")) ||
        !Number.isSafeInteger(start) || start < 1 || start > maxStart || !Number.isSafeInteger(next) || next < 1) {
      throw new HttpsError("failed-precondition", "Save a valid employee ID pattern in Settings.");
    }
    next = Math.max(next, start);
    const year = new Date(stamp.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" });
    let attempts = 0;
    while (next <= maxStart && attempts < 50) {
      const candidate = template.replaceAll("{YEAR}", year)
        .replace(sequenceToken, (_, width) => String(next).padStart(Number(width) || 1, "0")).toUpperCase();
      next++;
      if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(candidate)) {
        throw new HttpsError("failed-precondition", "The employee ID pattern must generate an ID from 2 to 40 characters.");
      }
      if (taken.has(candidate)) continue;
      attempts++;
      const record = await tx.get(employeeRef(school, candidate));
      if (!record.exists || record.get("staffId") === staffId) {
        employeeId = candidate;
        reservation = record;
        break;
      }
    }
    if (!reservation) throw new HttpsError("resource-exhausted", "No employee ID is available. Set a higher starting number in Settings.");
  } else {
    if (taken.has(employeeId)) throw duplicate();
    reservation = await tx.get(employeeRef(school, employeeId));
    if (reservation.exists && reservation.get("staffId") !== staffId) throw duplicate();
  }

  tx.set(reservation.ref, { staffId });
  if (previousReservation?.get("staffId") === staffId) tx.delete(previousReservation.ref);
  if (automatic) tx.set(settingsRef, { id: defaults.id, template: config.template, start: config.start, next, ...stamp }, { merge: true });
  return employeeId;
}

module.exports = { employeeRef, reserveEmployeeId };
