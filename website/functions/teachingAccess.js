const { requireAdminSession, verifiedAdminSession } = require("./adminSession");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\/]/.test(value) && ![".", ".."].includes(value);
const classOf = (row) => row.classId || (row.grade && row.section ? `cls_${row.grade}${row.section}` : "");
const accessId = (classId, staffId) => `${classId}__${staffId}`;

/** Rebuild from current master data. Rules always recheck the anchor, including after an unassignment. */
async function refreshAccess(sid, classId, staffId) {
  if (![sid, classId, staffId].every(validId)) return;
  const db = getFirestore(), school = db.collection("schools").doc(sid);
  const ref = school.collection("teaching_access").doc(accessId(classId, staffId));
  await db.runTransaction(async (tx) => {
    await tx.get(ref);
    const [assignments, periods] = await Promise.all([
      tx.get(school.collection("assignments").where("teacherId", "==", staffId)),
      tx.get(school.collection("ops_periods").where("teacherId", "==", staffId)),
    ]);
    const mine = assignments.docs.filter((row) => row.get("classId") === classId);
    const lessons = periods.docs.filter((row) => classOf(row.data()) === classId);
    const subjects = {};
    for (const row of mine) {
      const subject = row.get("subject");
      if (typeof subject === "string" && subject) subjects[subject] = { ...(subjects[subject] || {}), assignmentId: row.id };
    }
    for (const row of lessons) {
      const subject = row.get("subject");
      if (typeof subject === "string" && subject) subjects[subject] = { ...(subjects[subject] || {}), periodId: row.id };
    }
    if (!mine.length && !lessons.length) tx.delete(ref);
    else tx.set(ref, { classId, teacherId: staffId, assignmentId: mine[0]?.id || "", periodId: lessons[0]?.id || "", subjects, updatedAt: new Date().toISOString() });
  });
}

async function syncWrite(event) {
  const targets = new Map();
  for (const row of [event.data?.before?.data(), event.data?.after?.data()]) {
    if (row && validId(row.teacherId) && validId(classOf(row))) targets.set(accessId(classOf(row), row.teacherId), [classOf(row), row.teacherId]);
  }
  await Promise.all([...targets.values()].map(([classId, staffId]) => refreshAccess(event.params.sid, classId, staffId)));
}
exports.onTeachingAssignmentWritten = onDocumentWritten({ document: "schools/{sid}/assignments/{id}", retry: true }, syncWrite);
exports.onTeachingPeriodWritten = onDocumentWritten({ document: "schools/{sid}/ops_periods/{id}", retry: true }, syncWrite);

async function adminScope(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to manage classes.");
  await requireAdminSession(req);
  const db = getFirestore(), actorRef = db.collection("users").doc(req.auth.uid), ownerRef = db.collection("platform_admins").doc(req.auth.uid);
  const [actor, owner] = await db.getAll(actorRef, ownerRef);
  const sid = owner.exists ? req.data?.schoolId : actor.get("schoolId");
  if (!validId(sid) || (!owner.exists && actor.get("role") !== "admin")) throw new HttpsError("permission-denied", "Only a school administrator can manage classes.");
  return { db, sid, school: db.collection("schools").doc(sid), actorRef, ownerRef };
}

exports.rebuildTeachingAccess = onCall(async (req) => {
  const { db, sid, school } = await adminScope(req);
  const platform = await db.collection("platform_schools").doc(sid).get();
  if (platform.get("status") === "suspended") throw new HttpsError("permission-denied", "This school is suspended.");
  const [assignments, periods, current] = await Promise.all([
    school.collection("assignments").select("classId", "teacherId").get(),
    school.collection("ops_periods").select("classId", "grade", "section", "teacherId").get(),
    school.collection("teaching_access").select("classId", "teacherId").get(),
  ]);
  const targets = new Map();
  for (const row of [...assignments.docs, ...periods.docs, ...current.docs]) {
    const data = row.data(), classId = classOf(data);
    if (validId(classId) && validId(data.teacherId)) targets.set(accessId(classId, data.teacherId), [classId, data.teacherId]);
  }
  const list = [...targets.values()];
  for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(([classId, staffId]) => refreshAccess(sid, classId, staffId)));
  return { rebuilt: list.length };
});

exports.setClassTeacher = onCall(async (req) => {
  const { db, school, sid, actorRef, ownerRef } = await adminScope(req);
  const classId = req.data?.classId, teacherId = req.data?.teacherId || "";
  const create = req.data?.create;
  if (create) {
    const grade = String(create.grade || ""), section = String(create.section || ""), streamId = String(create.streamId || "");
    const senior = ["11", "12"].includes(grade);
    const expected = senior ? `cls_${grade}_${streamId}_${section}` : `cls_${grade}${section}`;
    if (!/^(LKG|UKG|[1-9]|1[0-2])$/.test(grade) || !/^[A-H]$/.test(section) || classId !== expected ||
        (senior && !/^(science|commerce|humanities|course_[a-z0-9]+(?:_[a-z0-9]+)*)$/.test(streamId)) ||
        typeof create.room !== "string" || create.room.length > 20 || typeof create.wing !== "string" || create.wing.length > 80 ||
        (create.stream !== undefined && (typeof create.stream !== "string" || create.stream.length > 120))) {
      throw new HttpsError("invalid-argument", "Check the class grade, section, room and stream.");
    }
  }
  if (!validId(classId) || (teacherId && !validId(teacherId))) throw new HttpsError("invalid-argument", "Choose a class and teacher.");
  const classRef = school.collection("classes").doc(classId);
  return db.runTransaction(async (tx) => {
    const [actor, owner, platform, section] = await tx.getAll(actorRef, ownerRef, db.collection("platform_schools").doc(sid), classRef);
    if (platform.get("rolloverJob") || (!owner.exists && (!verifiedAdminSession(req.auth, actor.data()) || actor.get("role") !== "admin" || actor.get("schoolId") !== sid || platform.get("status") === "suspended"))) throw new HttpsError("permission-denied", "Your account cannot manage this class.");
    if (create && section.exists) throw new HttpsError("already-exists", "This class already exists.");
    if (!create && !section.exists) throw new HttpsError("not-found", "The class was not found.");
    const previous = section.get("classTeacherId");
    const oldRef = validId(previous) ? school.collection("class_teacher_assignments").doc(previous) : null;
    const old = oldRef ? await tx.get(oldRef) : null;
    const reservationRef = teacherId ? school.collection("class_teacher_assignments").doc(teacherId) : null;
    const reservation = reservationRef ? await tx.get(reservationRef) : null;
    const staff = teacherId ? await tx.get(school.collection("staff").doc(teacherId)) : null;
    if (staff && (!staff.exists || (staff.get("category") ? staff.get("category") !== "Teaching" : !["teacher", "hod"].includes(staff.get("staffRole")) && staff.get("department") === "Administration") ||
        ["Suspended", "Resigned", "Terminated", "Retired"].includes(staff.get("status")))) throw new HttpsError("failed-precondition", "Choose an active teaching staff member.");
    const other = teacherId ? await tx.get(school.collection("classes").where("classTeacherId", "==", teacherId)) : null;
    const occupied = reservation?.get("classId");
    const occupiedClass = validId(occupied) && occupied !== classId ? await tx.get(school.collection("classes").doc(occupied)) : null;
    if (other?.docs.some((row) => row.id !== classId) || (occupiedClass?.exists && occupiedClass.get("classTeacherId") === teacherId)) {
      throw new HttpsError("already-exists", "This teacher is already class teacher of another class. Unassign them there first.");
    }
    const now = new Date().toISOString(), stamp = { updatedAt: now, updatedBy: req.auth.uid };
    const patch = { classTeacherId: teacherId, classTeacher: staff?.get("name") || "", ...stamp };
    if (create) tx.create(classRef, { id: classId, grade: String(create.grade), section: create.section,
      room: create.room.trim(), wing: create.wing.trim(), ...(["11", "12"].includes(String(create.grade)) ? { streamId: create.streamId, stream: create.stream || "" } : {}),
      ...patch, _o: Date.parse(now) });
    else tx.update(classRef, patch);
    if (oldRef && previous !== teacherId && old?.get("classId") === classId) tx.delete(oldRef);
    if (reservationRef) tx.set(reservationRef, { classId, teacherId, ...stamp });
    tx.create(school.collection("set_audit").doc(), { at: now, actor: actor.get("name") || req.auth.uid, action: "Updated class teacher", detail: `${classId} · ${teacherId || "Unassigned"}` });
    return patch;
  });
});
