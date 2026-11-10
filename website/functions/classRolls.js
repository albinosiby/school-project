const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\/]/.test(value) && value !== "." && value !== "..";
const validRoll = (value) => Number.isInteger(value) && value >= 1 && value <= 999;

exports.assignStudentRoll = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in as the class teacher.");
  const { studentId, roll = null } = request.data ?? {};
  if (!validId(studentId) || (roll !== null && !validRoll(roll))) {
    throw new HttpsError("invalid-argument", "Choose a student and enter a whole number from 1 to 999.");
  }

  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const actor = (await tx.get(db.collection("users").doc(uid))).data();
    if (actor?.role !== "teacher" || !validId(actor.staffId) || !validId(actor.schoolId)) {
      throw new HttpsError("permission-denied", "Only the assigned class teacher can allot roll numbers.");
    }
    const school = db.collection("schools").doc(actor.schoolId);
    const students = school.collection("students");
    const studentRef = students.doc(studentId);
    const student = await tx.get(studentRef);
    const classId = student.get("classId");
    if (!student.exists || student.get("deleted") === true || !validId(classId) ||
        (student.get("status") && student.get("status") !== "Active")) {
      throw new HttpsError("failed-precondition", "The student must be active and assigned to a division.");
    }
    const classRef = school.collection("classes").doc(classId);
    const [section, platform, settings] = await tx.getAll(
      classRef, db.collection("platform_schools").doc(actor.schoolId), school.collection("school").doc("school"),
    );
    if (platform.get("status") === "suspended" || section.get("classTeacherId") !== actor.staffId) {
      throw new HttpsError("permission-denied", "Only the assigned class teacher can allot roll numbers.");
    }
    const year = settings.get("academicYear") || student.get("academicYear") || "";
    const roster = await tx.get(students.where("classId", "==", classId));
    const used = new Set(roster.docs.filter((row) => row.id !== studentId && row.get("deleted") !== true &&
      (!row.get("status") || row.get("status") === "Active") &&
      (!row.get("rollAcademicYear") || row.get("rollAcademicYear") === year))
      .map((row) => Number(row.get("roll"))).filter(validRoll));
    const current = Number(student.get("roll"));
    let assigned = roll ?? (validRoll(current) && !used.has(current) ? current : 1);
    if (roll === null) while (used.has(assigned)) assigned++;
    if (!validRoll(assigned)) throw new HttpsError("resource-exhausted", "This division has no available roll numbers.");
    if (used.has(assigned)) throw new HttpsError("already-exists", "This roll number is already used in this division.");
    tx.update(studentRef, { roll: assigned, rollAcademicYear: year, updatedAt: new Date().toISOString(), updatedBy: uid });
    // Serialize roll changes for the section, including assignments to different students.
    tx.update(classRef, { rollRevision: FieldValue.increment(1) });
    return { roll: assigned };
  });
});
