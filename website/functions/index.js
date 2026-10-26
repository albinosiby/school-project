// Push notifications for the teacher app (DATA_CONTRACT section 10).
// Firestore writes by the admin web trigger these functions; each one
//   1. adds a row to the teacher's in-app list (schools/{sid}/hm_notifications, teacherId = staff id), and
//   2. sends an FCM push to every device token at users/{uid}/fcm_tokens/{token} of that teacher.
// Tokens that FCM reports as dead are deleted.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");

initializeApp();
setGlobalOptions({ region: "asia-south1", maxInstances: 5 });
const db = getFirestore();

const DEAD_TOKEN = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);
// the same audience test the teacher app uses for circulars
const STAFF_AUDIENCE = /staff|teacher|faculty|all school/i;
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const clsLabel = (classId = "") => classId.replace(/^cls_(\d+)([A-Z])$/, "$1-$2");

/** users/{uid} of the school's teachers, optionally only these staff ids. */
async function teacherUsers(sid, staffIds) {
  const base = db.collection("users").where("schoolId", "==", sid).where("role", "==", "teacher");
  if (!staffIds) return (await base.get()).docs;
  const ids = [...new Set(staffIds.filter(Boolean))];
  const snaps = await Promise.all(chunk(ids, 30).map((c) => base.where("staffId", "in", c).get()));
  return snaps.flatMap((s) => s.docs);
}

// ---------------------------------------------------------------------------
// The teacher's notification settings (teacher app > Settings, stored in schools/{sid}/hm_settings):
//   classUpdates   "Class & Student Updates"   circulars, substitutions, leave, classes, exams, calendar
//   parentMessages "Parent & Direct Messages"  messages (parent app, later)
//   dnd + dndFrom/dndTo (India time)            quiet hours: no push for anything but urgent
//   parentMute                                  no parent messages on Saturday and Sunday
// Urgent broadcasts always push. Settings only decide the push; the in-app list always gets the row.
// ---------------------------------------------------------------------------

async function teacherPrefs(sid, staffId) {
  const s = await db.collection("schools").doc(sid).collection("hm_settings").where("teacherId", "==", staffId).limit(1).get();
  return s.empty ? {} : s.docs[0].data();
}

const minutes = (hhmm) => { const [h, m] = String(hhmm ?? "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

/** Why this push should not be sent to a teacher with these settings (null = send). */
function pushBlocked(prefs, n, istDate = new Date(Date.now() + 5.5 * 3600e3)) {
  if (n.urgent) return null;
  if (n.type === "message") {
    if (prefs.parentMessages === false) return "parent messages off";
    const day = istDate.getUTCDay();
    if (prefs.parentMute === true && (day === 0 || day === 6)) return "weekend parent mute";
  } else if (prefs.classUpdates === false) return "class updates off";
  if (prefs.dnd === true) {
    const now = istDate.getUTCHours() * 60 + istDate.getUTCMinutes(), from = minutes(prefs.dndFrom ?? "18:00"), to = minutes(prefs.dndTo ?? "07:30");
    if (from <= to ? now >= from && now < to : now >= from || now < to) return "quiet hours";
  }
  return null;
}

/**
 * Notifies teachers. staffIds = null means every teacher of the school.
 * n = {type, category, tag, title, body, route, urgent?}
 */
async function notify(sid, staffIds, n) {
  const users = await teacherUsers(sid, staffIds);
  if (!users.length) { logger.info("no teacher accounts to notify", { sid, staffIds, type: n.type }); return; }
  const now = new Date();
  const batch = db.batch();
  for (const u of users) {
    batch.set(db.collection("schools").doc(sid).collection("hm_notifications").doc(), {
      teacherId: u.get("staffId"), type: n.type, category: n.category, tag: n.tag, title: n.title, body: n.body,
      route: n.route, read: false, at: now.toISOString(), ord: now.getTime() * 1000, updatedAt: now.toISOString(), source: "push",
    });
  }
  await batch.commit();

  const allowed = [];
  for (const u of users) {
    const why = pushBlocked(await teacherPrefs(sid, u.get("staffId")), n);
    if (why) logger.info("push skipped", { sid, staffId: u.get("staffId"), type: n.type, why }); else allowed.push(u);
  }
  const tokens = (await Promise.all(allowed.map((u) => u.ref.collection("fcm_tokens").get())))
    .flatMap((s) => s.docs.map((d) => ({ token: d.id, ref: d.ref })));
  if (!tokens.length) { logger.info("teachers have no device tokens yet", { sid, type: n.type }); return; }
  for (const part of chunk(tokens, 500)) {
    const res = await getMessaging().sendEachForMulticast({
      tokens: part.map((t) => t.token),
      notification: { title: n.title, body: n.body },
      data: { route: n.route ?? "", type: n.type },
      // no tag: every notification stays in the tray (a shared tag would replace the previous one of that type)
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    const dead = res.responses.map((r, i) => (!r.success && DEAD_TOKEN.has(r.error?.code) ? part[i].ref : null)).filter(Boolean);
    await Promise.all(dead.map((r) => r.delete()));
    logger.info("push sent", { sid, type: n.type, sent: res.successCount, failed: res.failureCount, removed: dead.length });
  }
}

// A circular / notice for staff is published (created as Published, or a draft/scheduled one goes live).
exports.onNoticePublished = onDocumentWritten("schools/{sid}/com_notices/{id}", async (e) => {
  const before = e.data?.before?.data(), after = e.data?.after?.data();
  if (!after || after.status !== "Published" || before?.status === "Published") return;
  if (!STAFF_AUDIENCE.test(after.audience ?? "")) return;
  await notify(e.params.sid, null, {
    type: "circular", category: "Academic", tag: after.urgent ? "Urgent Circular" : "Circular", urgent: after.urgent === true,
    title: after.urgent ? `Urgent: ${after.title}` : `New circular: ${after.title}`,
    body: String(after.body ?? "").replace(/\s+/g, " ").slice(0, 140), route: "/circulars",
  });
});

// The admin assigns a substitute (new row, or the substitute changes).
exports.onSubstitutionAssigned = onDocumentWritten("schools/{sid}/ops_substitutions/{id}", async (e) => {
  const before = e.data?.before?.data(), after = e.data?.after?.data();
  if (!after?.substituteTeacherId || before?.substituteTeacherId === after.substituteTeacherId) return;
  await notify(e.params.sid, [after.substituteTeacherId], {
    type: "substitution", category: "Duties", tag: "Substitution",
    title: "Substitution assigned",
    body: `${clsLabel(after.classId)} · ${after.subject ?? ""} · ${after.day ?? ""} P${after.period ?? ""}${after.date ? ` on ${after.date}` : ""}`,
    route: "/timetable",
  });
});

// The admin approves or rejects a teacher's leave.
exports.onStaffLeaveDecided = onDocumentUpdated("schools/{sid}/staff_leaves/{id}", async (e) => {
  const before = e.data.before.data(), after = e.data.after.data();
  if (before.status === after.status || !["Approved", "Rejected"].includes(after.status)) return;
  await notify(e.params.sid, [after.staffId], {
    type: "leave", category: "Duties", tag: "Leave",
    title: `Leave ${after.status.toLowerCase()}`,
    body: `${after.type ?? "Leave"} · ${after.from}${after.to && after.to !== after.from ? ` to ${after.to}` : ""}${after.decisionNote ? ` · ${after.decisionNote}` : ""}`,
    route: "/leave-management",
  });
});

// The admin assigns a teacher to teach a subject in a class.
exports.onAssignmentCreated = onDocumentCreated("schools/{sid}/assignments/{id}", async (e) => {
  const a = e.data?.data();
  if (!a?.teacherId) return;
  await notify(e.params.sid, [a.teacherId], {
    type: "assignment", category: "Academic", tag: "Class Assigned",
    title: "New class assigned", body: `${a.subject ?? "Subject"} for ${clsLabel(a.classId)}`, route: "/classes",
  });
});

// The admin makes a teacher the class teacher of a class.
exports.onClassTeacherChanged = onDocumentUpdated("schools/{sid}/classes/{id}", async (e) => {
  const before = e.data.before.data(), after = e.data.after.data();
  if (!after.classTeacherId || before.classTeacherId === after.classTeacherId) return;
  await notify(e.params.sid, [after.classTeacherId], {
    type: "assignment", category: "Academic", tag: "Class Teacher",
    title: "You are now a class teacher", body: `Class ${after.grade}-${after.section}`, route: "/classes",
  });
});


// ---------------------------------------------------------------------------
// Exams: duty, marks window, results
// ---------------------------------------------------------------------------

/** Staff ids of the teachers who teach this paper's subject in its classes (from `assignments`). */
async function paperTeachers(sid, p) {
  const science = (x) => /physics|chemistry|biology/i.test(x) || (/science/i.test(x) && !/social|computer/i.test(x));
  const covers = (paper, a) => {
    const P = (paper ?? "").toLowerCase(), A = (a ?? "").toLowerCase();
    return !!P && !!A && (P === A || P.includes(A) || A.includes(P) || (science(P) && science(A)));
  };
  const classIds = p.classIds?.length ? p.classIds : null;
  const snap = await db.collection("schools").doc(sid).collection("assignments").get();
  return [...new Set(snap.docs.map((d) => d.data())
    .filter((a) => covers(p.subject, a.subject) && (classIds ? classIds.includes(a.classId) : String(a.classId ?? "").startsWith(`cls_${p.grade}`)))
    .map((a) => a.teacherId))];
}

/** The staff id of a paper's chief invigilator: invigilatorId, else a staff member with that exact name. */
async function invigilatorId(sid, p) {
  if (p.invigilatorId) return p.invigilatorId;
  if (!p.invigilator) return null;
  const s = await db.collection("schools").doc(sid).collection("staff").where("name", "==", p.invigilator).limit(1).get();
  return s.empty ? null : s.docs[0].id;
}

/** "HH:mm" + hours -> "HH:mm" */
const addHours = (hhmm, hours) => {
  const [h, m] = String(hhmm || "09:00").split(":").map(Number);
  const t = h * 60 + m + Math.round(Number(hours || 0) * 60);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * Keeps the paper's exm_duties rows in step (contract 12.3): a deleted paper removes its duties; a new date / time /
 * subject / venue is copied to every duty row (a duty's own hall and a venue the admin changed by hand are kept) and the
 * duty holders are told when the date or time moved.
 */
async function syncPaperDuties(sid, paperId, before, after) {
  const snap = await db.collection("schools").doc(sid).collection("exm_duties").where("paperId", "==", paperId).get();
  if (snap.empty) return;
  if (!after) { await Promise.all(snap.docs.map((d) => d.ref.delete())); logger.info("duties removed with their paper", { sid, paperId, n: snap.size }); return; }
  const timing = ["date", "start", "duration"].some((k) => before[k] !== after[k]);
  const other = ["subject", "code", "grade", "venue"].some((k) => before[k] !== after[k]) || JSON.stringify(before.classIds ?? []) !== JSON.stringify(after.classIds ?? []);
  if (!timing && !other) return;
  const start = after.start ?? "09:00", end = addHours(start, after.duration ?? 2.5);
  const batch = db.batch();
  for (const d of snap.docs) {
    const v = d.data();
    batch.update(d.ref, {
      date: after.date, start, end, reportBy: addHours(start, -0.5), subject: after.subject, code: after.code, grade: after.grade,
      classIds: after.classIds ?? v.classIds ?? [], ...(v.venue === before.venue ? { venue: after.venue } : {}), updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  if (timing) {
    await notify(sid, [...new Set(snap.docs.map((d) => d.get("staffId")))], {
      type: "exam", category: "Duties", tag: "Exam Duty", title: "Exam duty rescheduled",
      body: `Grade ${after.grade} ${after.subject} moved to ${after.date} at ${start} (report by ${addHours(start, -0.5)})`, route: "/exam-duties",
    });
  }
}

exports.onExamPaperChanged = onDocumentWritten("schools/{sid}/exm_papers/{id}", async (e) => {
  const sid = e.params.sid, before = e.data?.before?.data() ?? {}, after = e.data?.after?.data();
  await syncPaperDuties(sid, e.params.id, before, after);
  if (!after) return;
  const when = `${after.date ?? ""}${after.start ? ` at ${after.start}` : ""}`;
  // exam duty: a (new) chief invigilator
  const inv = await invigilatorId(sid, after);
  const invBefore = e.data?.before?.exists ? await invigilatorId(sid, before) : null;
  if (inv && inv !== invBefore) {
    await notify(sid, [inv], {
      type: "exam", category: "Duties", tag: "Exam Duty", title: "Exam invigilation duty assigned",
      body: `Grade ${after.grade} ${after.subject} · ${when} · ${after.venue ?? ""}`.trim(), route: "/exam-duties",
    });
  }
  // marks window closed
  if (after.locked === true && before.locked !== true) {
    await notify(sid, await paperTeachers(sid, after), {
      type: "exam", category: "Academic", tag: "Marks Locked", title: "Marks entry closed",
      body: `Grade ${after.grade} ${after.subject}: the marks window is locked. Contact the exam cell for changes.`, route: "/marks",
    });
  }
  // results published for one or more classes ("10-B")
  const newly = (after.published ?? []).filter((c) => !(before.published ?? []).includes(c));
  if (newly.length) {
    const classIds = newly.map((c) => `cls_${String(c).replace("-", "")}`);
    await notify(sid, await paperTeachers(sid, { ...after, classIds }), {
      type: "exam", category: "Academic", tag: "Results", title: "Results published",
      body: `${after.subject} results for ${newly.join(", ")} are now visible to parents.`, route: "/marks",
    });
  }
});

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

// A calendar event is published with "notify in app" on (new, or a draft that gets published).
exports.onCalendarEventPublished = onDocumentWritten("schools/{sid}/calendar_events/{id}", async (e) => {
  const before = e.data?.before?.data(), after = e.data?.after?.data();
  if (!after || after.status !== "published" || after.notifyApp === false || before?.status === "published") return;
  const range = after.end && after.end !== after.start ? `${after.start} to ${after.end}` : after.start;
  await notify(e.params.sid, null, {
    type: "event", category: "Academic", tag: "School Calendar", title: `New event: ${after.title}`,
    body: `${range}${after.startTime ? ` · ${after.startTime}` : ""}${after.venue ? ` · ${after.venue}` : ""}`, route: "/notifications",
  });
});

// ---------------------------------------------------------------------------
// Teacher actions the admin should know about: in the admin web's notification bell (schools/{sid}/notifications)
// ---------------------------------------------------------------------------

/** "YYYY-MM-DDTHH:mm:ss" in India time, the format the admin web stores (nowLocal). */
const istNow = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 19);

async function notifyAdmin(sid, n) {
  await db.collection("schools").doc(sid).collection("notifications").add({ ...n, createdAt: istNow(), read: false, source: "teacher", _o: Date.now() });
}

async function staffName(sid, staffId) {
  const s = staffId ? await db.collection("schools").doc(sid).collection("staff").doc(staffId).get() : null;
  return s?.exists ? s.get("name") : "A teacher";
}

exports.onStaffLeaveRequested = onDocumentCreated("schools/{sid}/staff_leaves/{id}", async (e) => {
  const l = e.data?.data();
  if (!l || l.status !== "Pending") return;
  const range = l.to && l.to !== l.from ? `${l.from} to ${l.to}` : l.from;
  await notifyAdmin(e.params.sid, {
    category: "approvals", title: "Leave request", href: "/approvals",
    body: `${await staffName(e.params.sid, l.staffId)} applied for ${l.type ?? "leave"} (${l.days ?? "?"} day${l.days === 1 ? "" : "s"}, ${range}): ${l.reason ?? ""}`.trim(),
  });
});

exports.onLiveClassScheduled = onDocumentCreated("schools/{sid}/live_classes/{id}", async (e) => {
  const c = e.data?.data();
  if (!c) return;
  await notifyAdmin(e.params.sid, {
    category: "ops", title: "Live class scheduled", href: "/live-classes",
    body: `${await staffName(e.params.sid, c.teacherId)} scheduled “${c.title}” for ${clsLabel(c.classId)} on ${c.date} at ${c.time} (${c.medium ?? "online"}).`,
  });
});

// ---------------------------------------------------------------------------
// Staff check-in regularization and exam duties (DATA_CONTRACT section 12)
// ---------------------------------------------------------------------------

/** "14:05" -> "02:05 PM" */
const t12 = (t) => {
  const [h, m] = String(t ?? "").split(":").map(Number);
  return Number.isFinite(h) ? `${String(h % 12 || 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` : "";
};

// A teacher asks to regularize a missed / wrong punch: admin bell.
exports.onRegularizationRequested = onDocumentCreated("schools/{sid}/staff_regularizations/{id}", async (e) => {
  const r = e.data?.data();
  if (!r || r.status !== "Pending") return;
  await notifyAdmin(e.params.sid, {
    category: "approvals", title: "Attendance regularization", href: "/staff?tab=checkins",
    body: `${await staffName(e.params.sid, r.staffId)} asked to regularize ${r.type ?? "a punch"} on ${r.date}${r.time ? ` (${t12(r.time)})` : ""}: ${r.reason ?? ""}`.trim(),
  });
});

// The admin approves or rejects a regularization: push to the teacher.
exports.onRegularizationDecided = onDocumentUpdated("schools/{sid}/staff_regularizations/{id}", async (e) => {
  const before = e.data.before.data(), after = e.data.after.data();
  if (before.status === after.status || !["Approved", "Rejected"].includes(after.status)) return;
  await notify(e.params.sid, [after.staffId], {
    type: "attendance", category: "Duties", tag: "Attendance",
    title: `Regularization ${after.status.toLowerCase()}`,
    body: `${after.type ?? "Punch"} on ${after.date}${after.time ? ` at ${t12(after.time)}` : ""}${after.decisionNote ? ` · ${after.decisionNote}` : ""}`,
    route: "/attendance",
  });
});

// An exam duty row is created or moved to another teacher: push to that teacher.
exports.onExamDutyAssigned = onDocumentWritten("schools/{sid}/exm_duties/{id}", async (e) => {
  const before = e.data?.before?.data(), after = e.data?.after?.data();
  if (!after?.staffId || before?.staffId === after.staffId) return;
  const time = after.start ? `${t12(after.start)}${after.end ? `–${t12(after.end)}` : ""}` : "";
  await notify(e.params.sid, [after.staffId], {
    type: "exam", category: "Duties", tag: "Exam Duty",
    title: `Exam duty: ${after.role ?? "Invigilator"}`,
    body: [`Grade ${after.grade ?? ""} ${after.subject ?? ""}`.trim(), [after.date, time].filter(Boolean).join(" "), after.hall ? (/hall|room/i.test(after.hall) ? after.hall : `Hall ${after.hall}`) : "", after.role ?? "Invigilator"]
      .filter(Boolean).join(" · ") + (after.reportBy ? ` · report by ${t12(after.reportBy)}` : ""),
    route: "/exam-duties",
  });
});
