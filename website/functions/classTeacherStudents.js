// Class teacher access to a student's admission record (adm_student_details), for the teacher app.
// Firestore rules keep adm_student_details office-only; these callables let the class teacher of the student's
// division read it (without caste / category / religion) and correct contacts, address and medical notes.
// Every change is audited in set_audit, and the student's guardian name / phone follow the primary contact.
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const validId = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && !/[/]/.test(v) && v !== "." && v !== "..";
const validPhone = (p) => /^\+?[\d\s-]+$/.test(p.trim()) && /^\d{10,15}$/.test(p.replace(/[\s+-]/g, ""));
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const CONTACTS = ["father", "mother", "guardian"];
const CONTACT_FIELDS = ["name", "phone", "email", "occupation", "relationship", "address"];
const RESIDENCE_FIELDS = ["addressLine1", "addressLine2", "country", "state", "district", "city", "pin"];
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The signed-in teacher, the student and the school, after checking she is the student's class teacher. */
async function classTeacherContext(request, studentId, tx) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!validId(studentId)) throw new HttpsError("invalid-argument", "Choose a student.");
  const db = getFirestore();
  const get = (ref) => (tx ? tx.get(ref) : ref.get());
  const actor = (await get(db.collection("users").doc(uid))).data();
  if (actor?.role !== "teacher" || !validId(actor.staffId) || !validId(actor.schoolId)) {
    throw new HttpsError("permission-denied", "Only the class teacher can open these details.");
  }
  const school = db.collection("schools").doc(actor.schoolId);
  const student = await get(school.collection("students").doc(studentId));
  const classId = student.get("classId");
  if (!student.exists || student.get("deleted") === true || !validId(classId)) {
    throw new HttpsError("not-found", "This student is not in a division.");
  }
  const [section, platform] = await Promise.all([get(school.collection("classes").doc(classId)), get(db.collection("platform_schools").doc(actor.schoolId))]);
  if (platform.get("status") === "suspended" || section.get("classTeacherId") !== actor.staffId) {
    throw new HttpsError("permission-denied", "Only the class teacher of this division can open these details.");
  }
  return { db, uid, actor, school, student, classId, rollover: !!platform.get("rolloverJob") };
}

const contactOut = (c) => Object.fromEntries(CONTACT_FIELDS.map((k) => [k, str(c?.[k], 300)]));

/** What the teacher app shows (no caste, category or religion). */
function detailsOut(student, d) {
  d = d ?? {};
  return {
    exists: Object.keys(d).length > 0,
    gender: str(d.gender || student.get("gender"), 40),
    dob: str(student.get("dob"), 20),
    email: str(student.get("email"), 200),
    nationality: str(d.nationality, 60),
    motherTongue: str(d.motherTongue, 60),
    language: str(d.language, 60),
    residence: Object.fromEntries(RESIDENCE_FIELDS.map((k) => [k, str(d.residence?.[k], 200)])),
    address: str(student.get("address"), 500),
    contacts: Object.fromEntries(CONTACTS.map((k) => [k, contactOut(d.contacts?.[k])])),
    primary: CONTACTS.includes(d.primary) ? d.primary : "guardian",
    secondary: CONTACTS.includes(d.secondary) ? d.secondary : "",
    emergencyPhone: str(d.emergencyPhone, 30),
    admissionDate: str(d.admissionDate || student.get("admissionDate"), 20),
    admissionNumber: str(student.get("admissionNumber") || student.get("grn"), 60),
    academicYear: str(d.academicYear || student.get("academicYear"), 20),
    studentType: str(d.studentType, 30),
    admissionType: str(d.admissionType, 30),
    previousSchool: str(d.previousSchool, 200),
    previousClass: str(d.previousClass, 60),
    previousBoard: str(d.previousBoard, 60),
    bloodGroup: str(d.bloodGroup, 5),
    conditions: str(d.conditions, 1000),
    assistance: str(d.assistance, 1000),
    bus: str(student.get("bus"), 100),
    busStop: str(student.get("busStop"), 100),
    stream: str(student.get("stream"), 100),
    status: str(student.get("status"), 30) || "Active",
    updatedAt: str(d.updatedAt, 40),
  };
}

exports.getClassStudentDetails = onCall(async (request) => {
  const { school, student } = await classTeacherContext(request, request.data?.studentId);
  const details = await school.collection("adm_student_details").doc(student.id).get();
  return detailsOut(student, details.data());
});

/**
 * Class teacher corrections: contacts (father / mother / guardian), which one is primary / secondary, emergency
 * phone, home address and medical notes. Anything else in [input] is ignored. Returns the patch for
 * adm_student_details, what changed (for the audit) and the primary contact after the change.
 */
function detailsPatch(cur, input) {
  cur = cur ?? {};
  const patch = {};
  const changed = [];
  if (input.contacts && typeof input.contacts === "object") {
    const contacts = { ...(cur.contacts ?? {}) };
    for (const k of CONTACTS) {
      if (!input.contacts[k] || typeof input.contacts[k] !== "object") continue;
      const next = { ...contactOut(cur.contacts?.[k]) };
      for (const f of CONTACT_FIELDS) if (f in input.contacts[k]) next[f] = str(input.contacts[k][f], f === "address" ? 300 : 120);
      if (next.phone && !validPhone(next.phone)) throw new HttpsError("invalid-argument", `Enter a valid mobile number for the ${k}.`);
      if (next.email && !validEmail(next.email)) throw new HttpsError("invalid-argument", `Enter a valid email for the ${k}.`);
      if ((next.phone || next.email) && !next.name) throw new HttpsError("invalid-argument", `Enter the ${k}'s name.`);
      contacts[k] = next;
      changed.push(k);
    }
    patch.contacts = contacts;
  }
  const contacts = patch.contacts ?? cur.contacts ?? {};
  if ("primary" in input) {
    if (!CONTACTS.includes(input.primary)) throw new HttpsError("invalid-argument", "Choose the primary contact.");
    patch.primary = input.primary;
    changed.push("primary contact");
  }
  if ("secondary" in input) {
    if (input.secondary !== "" && !CONTACTS.includes(input.secondary)) throw new HttpsError("invalid-argument", "Choose the second contact.");
    patch.secondary = input.secondary;
    changed.push("second contact");
  }
  const primary = patch.primary ?? (CONTACTS.includes(cur.primary) ? cur.primary : "guardian");
  const secondary = "secondary" in patch ? patch.secondary : cur.secondary ?? "";
  if (secondary && secondary === primary) throw new HttpsError("invalid-argument", "Choose a different second contact.");
  const main = contactOut(contacts[primary]);
  if ((patch.contacts || patch.primary) && (!main.name || !validPhone(main.phone))) {
    throw new HttpsError("invalid-argument", "The primary contact needs a name and a valid mobile number.");
  }
  if ("emergencyPhone" in input) {
    const p = str(input.emergencyPhone, 30);
    if (p && !validPhone(p)) throw new HttpsError("invalid-argument", "Enter a valid emergency number.");
    patch.emergencyPhone = p;
    changed.push("emergency number");
  }
  if (input.residence && typeof input.residence === "object") {
    const r = { ...(cur.residence ?? {}) };
    for (const f of RESIDENCE_FIELDS) if (f in input.residence) r[f] = str(input.residence[f], 200);
    if (r.pin && !/^[0-9A-Za-z -]{3,10}$/.test(r.pin)) throw new HttpsError("invalid-argument", "Enter a valid PIN code.");
    patch.residence = r;
    changed.push("address");
  }
  if ("bloodGroup" in input) {
    const b = str(input.bloodGroup, 5).toUpperCase();
    if (!BLOOD.includes(b)) throw new HttpsError("invalid-argument", "Choose a blood group.");
    patch.bloodGroup = b;
    changed.push("blood group");
  }
  for (const f of ["conditions", "assistance"]) {
    if (f in input) {
      patch[f] = str(input[f], 1000);
      changed.push(f === "conditions" ? "medical conditions" : "support needs");
    }
  }
  if (!changed.length) throw new HttpsError("invalid-argument", "Nothing to update.");
  return { patch, changed: [...new Set(changed)], main: patch.contacts || patch.primary ? main : null };
}

exports.updateClassStudentDetails = onCall(async (request) => {
  const input = request.data ?? {};
  return getFirestore().runTransaction(async (tx) => {
    const { uid, actor, school, student, rollover } = await classTeacherContext(request, input.studentId, tx);
    if (rollover) throw new HttpsError("failed-precondition", "The academic rollover is running. Try again when it finishes.");
    const ref = school.collection("adm_student_details").doc(student.id);
    const cur = (await tx.get(ref)).data() ?? {};
    const { patch, changed, main } = detailsPatch(cur, input);
    const now = new Date().toISOString();
    tx.set(ref, { id: student.id, ...patch, updatedAt: now, updatedBy: uid }, { merge: true });
    // the roster, the apps and messages use students.guardian / phone: keep them on the primary contact
    const mirror = {};
    if (main) {
      if (main.name !== student.get("guardian")) mirror.guardian = main.name;
      if (main.phone !== student.get("phone")) mirror.phone = main.phone;
      if (main.relationship && main.relationship !== student.get("relation")) mirror.relation = main.relationship;
      if (Object.keys(mirror).length) tx.update(student.ref, { ...mirror, updatedAt: now, updatedBy: uid });
    }
    tx.create(school.collection("set_audit").doc(), {
      at: now, actor: actor.name || uid, action: "Class teacher updated student details",
      detail: `${student.get("name") ?? student.id} (${student.id}) · ${changed.join(", ")}`,
    });
    const view = { get: (k) => (k in mirror ? mirror[k] : student.get(k)) };
    return detailsOut(view, { ...cur, ...patch, updatedAt: now });
  });
});

exports.detailsOut = detailsOut;
exports.detailsPatch = detailsPatch;
