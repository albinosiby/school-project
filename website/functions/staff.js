const { randomBytes } = require("node:crypto");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { labels, assignable } = require("./staffRoles.json");
const { reserveEmployeeId } = require("./staffNumbering");
const { sendStaffInvitation, staffSmtpUrl } = require("./staffEmail");

function rolesFor(profile) {
  const actor = profile?.role === "admin" ? "admin" :
    profile?.role === "staff" && profile.staffRole !== "admin" ? profile.staffRole : "";
  return Object.hasOwn(assignable, actor) ? assignable[actor] : [];
}

const clean = (value) => typeof value === "string" ? value.trim() : "";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function staffScope(actorUid) {
  const db = getFirestore();
  const users = db.collection("users");
  const actorRef = users.doc(actorUid);
  const ownerRef = db.collection("platform_admins").doc(actorUid);
  const [actorSnap, owner] = await Promise.all([actorRef.get(), ownerRef.get()]);
  const actor = actorSnap.data();
  const sid = actor?.schoolId;
  if (typeof sid !== "string" || !sid || sid.includes("/") || !rolesFor(actor).length || owner.exists) {
    throw new HttpsError("permission-denied", "Your account cannot manage staff invitations.");
  }
  const school = db.collection("schools").doc(sid);
  const platform = db.collection("platform_schools").doc(sid);
  if ((await platform.get()).data()?.status === "suspended") {
    throw new HttpsError("permission-denied", "This school's account is suspended.");
  }
  return { actor, actorRef, ownerRef, users, sid, school, platform };
}

async function createSchoolStaff(req) {
  const actorUid = req.auth?.uid;
  if (!actorUid) throw new HttpsError("unauthenticated", "Sign in to add staff.");
  const name = clean(req.data?.name);
  const email = clean(req.data?.email).toLowerCase();
  const role = clean(req.data?.role);
  const invitationId = clean(req.data?.invitationId);
  if (name.length < 2 || name.length > 120 || email.length > 254 || !emailPattern.test(email) ||
    !Object.hasOwn(labels, role) || !/^[a-f0-9-]{36}$/.test(invitationId)) {
    throw new HttpsError("invalid-argument", "Enter a valid name, email, and role.");
  }

  const db = getFirestore();
  const auth = getAuth();
  const { actor, actorRef, ownerRef, users, sid, school, platform } = await staffScope(actorUid);
  if (!rolesFor(actor).includes(role)) {
    throw new HttpsError("permission-denied", "Your account cannot add this role.");
  }

  const staff = school.collection("staff");
  const duplicate = new HttpsError("already-exists", "This email already has a login or staff record.");
  let uid;
  try {
    const account = await auth.createUser({ email, displayName: name, password: randomBytes(32).toString("base64url") + "Aa1!" });
    uid = account.uid;
  } catch (error) {
    if (error.code !== "auth/email-already-exists") throw error;
    const existing = await auth.getUserByEmail(email);
    const p = (await users.doc(existing.uid).get()).data();
    if (p?.schoolId === sid && p.staffRole === role && p.invitedBy === actorUid && p.invitationId === invitationId) {
      return { created: true, emailSent: await sendStaffInvitation({ uid: existing.uid, email, name: p.name }) };
    }
    throw duplicate;
  }

  const staffRef = staff.doc(`stf_${uid}`);
  const crewRole = role === "helper" ? "attendant" : role === "driver" ? "driver" : "";
  const crewRef = crewRole ? school.collection("tr_crew").doc(`crw_${uid}`) : null;
  const teaching = role === "hod" || role === "teacher";
  const now = new Date().toISOString();
  const stamp = { updatedAt: now, updatedBy: actorUid, _o: Date.parse(now) };
  const employeeCode = randomBytes(6).toString("hex").toUpperCase();
  try {
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(actorRef)).data();
      const owner = await tx.get(ownerRef);
      const status = (await tx.get(platform)).data()?.status;
      if (current?.schoolId !== sid || !rolesFor(current).includes(role) || owner.exists || status === "suspended") {
        throw new HttpsError("permission-denied", "Your account cannot add this role.");
      }
      if (!(await tx.get(staff.where("email", "==", email).limit(1))).empty) throw duplicate;
      if (crewRef && !(await tx.get(school.collection("tr_crew").where("email", "==", email).limit(1))).empty) throw duplicate;
      const empId = await reserveEmployeeId(tx, school, staffRef.id, { stamp });
      tx.create(users.doc(uid), {
        schoolId: sid, role: teaching ? "teacher" : crewRole || "staff", staffRole: role,
        staffId: staffRef.id, ...(crewRef ? { crewId: crewRef.id } : {}),
        name, email, createdAt: now, invitedBy: actorUid, invitationId,
      });
      tx.create(staffRef, {
        id: staffRef.id, name, email, authUid: uid, staffRole: role, role: labels[role],
        empId, department: teaching ? "Academics" : crewRole ? "Transport" : "Administration",
        status: "Active", phone: "", ...(crewRef ? { crewId: crewRef.id } : {}), ...stamp,
      });
      if (crewRef) tx.create(crewRef, {
        id: crewRef.id, staffId: staffRef.id, authUid: uid, name, email, role: crewRole,
        empId: `TR-${employeeCode}`, phone: "", status: "Active", ...stamp,
      });
    });
  } catch (error) {
    // A lost acknowledgement can leave a successful transaction. Check before removing Auth.
    const profile = await users.doc(uid).get().catch(() => null);
    if (profile?.data()?.invitationId !== invitationId) {
      if (profile && !profile.exists) {
        await auth.deleteUser(uid).catch((cleanupError) => logger.error("Staff account cleanup failed", { uid, code: cleanupError.code }));
      }
      if (error instanceof HttpsError) throw error;
      logger.error("Staff provisioning failed", { uid, code: error.code });
      throw new HttpsError("internal", "Could not create the staff account. Try again.");
    }
  }
  return { created: true, emailSent: await sendStaffInvitation({ uid, email, name }) };
}

async function resendSchoolStaffInvite(req) {
  const actorUid = req.auth?.uid;
  if (!actorUid) throw new HttpsError("unauthenticated", "Sign in to send staff invitations.");
  const staffId = clean(req.data?.staffId);
  if (!staffId || staffId.length > 150 || staffId.includes("/") || staffId === "." || staffId === "..") {
    throw new HttpsError("invalid-argument", "Choose a staff member.");
  }
  const { actor, users, sid, school } = await staffScope(actorUid);
  const member = (await school.collection("staff").doc(staffId).get()).data();
  if (typeof member?.authUid !== "string" || !member.authUid || member.authUid.includes("/")) {
    throw new HttpsError("not-found", "This staff member has no linked account.");
  }
  const profile = (await users.doc(member.authUid).get()).data();
  if (profile?.schoolId !== sid || profile.staffId !== staffId || !rolesFor(actor).includes(profile.staffRole)) {
    throw new HttpsError("permission-denied", "Your account cannot invite this staff member.");
  }
  const account = await getAuth().getUser(member.authUid);
  if (!account.email || account.disabled || account.email.toLowerCase() !== profile.email) {
    throw new HttpsError("failed-precondition", "This staff member's login is unavailable.");
  }
  return {
    emailSent: await sendStaffInvitation({ uid: account.uid, email: account.email, name: profile.name }, { resend: true }),
  };
}

const mailOptions = { secrets: [staffSmtpUrl] };
exports.createSchoolStaff = onCall(mailOptions, createSchoolStaff);
exports.resendSchoolStaffInvite = onCall(mailOptions, resendSchoolStaffInvite);
Object.assign(exports, require("./staffProfiles")(staffScope, rolesFor));
