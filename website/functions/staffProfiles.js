const { requireAdminSession, verifiedAdminSession } = require("./adminSession");
const { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID } = require("node:crypto");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions/v2");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { clean, validDocId, validEmail, readStaffProfile } = require("./staffProfileData");
const { normalizeSubjects, subjectCatalogId, subjectForSelection } = require("./subjectCatalog");
const { employeeRef, reserveEmployeeId } = require("./staffNumbering");
const { staffDocuments, deleteStaffDocuments } = require("./staffDocuments");
const { staffPayroll } = require("./staffPayroll");
const { refreshStaffSelf } = require("./staffSelf");
const { designationAppRoles } = require("./staffProfileOptions.json");

const isHodDesignation = (value) => /^(?:head of department|hod)$/i.test(clean(value));
const subjectKey = (value) => clean(value).replace(/\s+/g, " ").toLowerCase();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const teacherRoles = ["teacher", "hod"];
const driverRoles = ["driver", "helper"];
const appRole = (role) => teacherRoles.includes(role) ? "teacher" : role === "helper" ? "attendant" : role === "driver" ? "driver" : "staff";
const duplicateLogin = () => new HttpsError("already-exists", "This email is already linked to an account.");
const absent = () => new HttpsError("not-found", "This staff member could not be found.");
const requiresAdmin = () => new HttpsError("permission-denied", "Only a school admin can manage staff profiles and passwords.");
const staffPasswordSecret = defineSecret("STAFF_PASSWORD_ENCRYPTION_KEY");
const sixDigits = /^\d{6}$/;
const randomPassword = () => String(randomInt(1_000_000)).padStart(6, "0");

function staffPasswordKey() {
  const key = staffPasswordSecret.value();
  if (!/^[a-f\d]{64}$/i.test(key ?? "")) throw new HttpsError("internal", "Staff password storage is unavailable.");
  return Buffer.from(key, "hex");
}

const authVersion = (account) => account.tokensValidAfterTime ?? "";
const passwordContext = (schoolId, staffId, account) => Buffer.from(JSON.stringify([
  schoolId, staffId, account.uid, clean(account.email).toLowerCase(), authVersion(account),
]));

function sealStaffPassword(password, key, context, account) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return { version: authVersion(account), iv: iv.toString("hex"), ciphertext: ciphertext.toString("hex"), tag: cipher.getAuthTag().toString("hex") };
}

function openStaffPassword({ iv, ciphertext, tag }, key, context) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"), { authTagLength: 16 });
  decipher.setAAD(context);
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

function profilePhoto(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" && value.length <= 160_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    const jpeg = Buffer.from(value.slice("data:image/jpeg;base64,".length), "base64");
    if (jpeg.length > 4 && jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg.at(-2) === 0xff && jpeg.at(-1) === 0xd9) return value;
  }
  throw new HttpsError("invalid-argument", "Choose a valid profile photo.", { fields: { photo: "Choose a smaller photo and try again." } });
}

module.exports = function staffProfileFunctions(staffScope, rolesFor) {
  async function adminScope(req) {
    await requireAdminSession(req);
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to manage staff profiles.");
    const scope = await staffScope(uid);
    if (scope.actor.role !== "admin") throw requiresAdmin();
    return { ...scope, uid, auth: req.auth };
  }

  async function verifyAdmin(tx, scope) {
    const [actor, owner, platform] = await tx.getAll(scope.actorRef, scope.ownerRef, scope.platform);
    if (owner.exists || !verifiedAdminSession(scope.auth, actor.data()) || platform.get("rolloverJob") || actor.get("role") !== "admin" || actor.get("schoolId") !== scope.sid || platform.get("status") === "suspended") {
      throw requiresAdmin();
    }
  }

  function refs(scope, staffId) {
    return {
      staff: scope.school.collection("staff").doc(staffId),
      privateProfile: scope.school.collection("staff_hr").doc(staffId),
      photo: scope.school.collection("staff_hr_photos").doc(staffId),
    };
  }

  function staffIdFrom(req) {
    const staffId = clean(req.data?.staffId);
    if (!validDocId(staffId)) throw new HttpsError("invalid-argument", "Choose a staff member.");
    return staffId;
  }

  const saveStaffProfile = onCall(async (req) => {
    const scope = await adminScope(req);
    const existingId = clean(req.data?.staffId);
    const requestId = clean(req.data?.requestId);
    if (existingId ? !validDocId(existingId) : !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "Invalid staff profile request.");
    }
    const staffId = existingId || `stf_${requestId}`;
    const { profile, name } = readStaffProfile(req.data?.profile);
    const image = profilePhoto(req.data?.photo);
    const { staff, privateProfile, photo } = refs(scope, staffId);
    const db = getFirestore();
    return db.runTransaction(async (tx) => {
      await verifyAdmin(tx, scope);
      const [member, saved] = await tx.getAll(staff, privateProfile);
      if (existingId && !member.exists) throw absent();
      if (!existingId && member.exists) {
        if (saved.get("createdBy") !== scope.uid || saved.get("requestId") !== requestId) {
          throw new HttpsError("already-exists", "This staff profile already exists.");
        }
        return { staffId, empId: member.get("empId") };
      }

      if (profile.category === "Teaching") {
        const catalog = await tx.get(scope.school.collection("set_config").doc("subjects"));
        let subjects = normalizeSubjects(catalog.get("subjects"));
        if (!catalog.exists) {
          const [classes, assignments] = await Promise.all([
            tx.get(scope.school.collection("classes").select("subjects")),
            tx.get(scope.school.collection("assignments").select("subject")),
          ]);
          subjects = normalizeSubjects([
            ...classes.docs.flatMap((row) => Array.isArray(row.get("subjects")) ? row.get("subjects") : []),
            ...assignments.docs.map((row) => row.get("subject")),
          ].map((name) => ({ name, active: true })));
        }
        const activeSubjects = subjects.filter((subject) => subject.active);
        const departments = catalog.get("departments");
        const departmentNames = new Map(Array.isArray(departments)
          ? departments.flatMap((entry) => clean(entry?.id) ? [[clean(entry.id), clean(entry.name)]] : []) : []);
        const canonicalSubject = (name, id) => {
          const subject = subjectForSelection(subjects, name, id);
          return subject ? { name: subject.name, id: subjectCatalogId(subject) } : { name, id };
        };
        const identity = ({ name, id }) => JSON.stringify(id ? ["id", id] : ["name", subjectKey(name)]);
        const savedNames = [saved.get("details.primarySubject"), ...(saved.get("details.additionalSubjects") ?? [])].map(clean);
        const savedIds = [saved.get("details.primarySubjectId"), ...(saved.get("details.additionalSubjectIds") ?? [])].map(clean);
        const previous = new Map(savedNames.flatMap((name, index) => {
          if (!name) return [];
          const selection = canonicalSubject(name, savedIds[index] || "");
          return [[identity(selection), selection]];
        }));
        const resolveSubject = (name, id) => {
          const active = subjectForSelection(activeSubjects, name, id);
          if (active) return { name: active.name, id: subjectCatalogId(active) };
          return previous.get(identity(canonicalSubject(name, id)));
        };
        const fields = {};
        const hod = isHodDesignation(profile.designation);
        const savedHod = isHodDesignation(saved.get("details.designation") ?? member.get("designation") ?? member.get("role"));
        if (hod && !departmentNames.size && !savedHod) {
          fields.designation = "Add a department in Settings before choosing Head of Department.";
        }
        if ((profile.departmentId && !departmentNames.has(profile.departmentId)) ||
            (hod && departmentNames.size && !profile.departmentId)) {
          fields.departmentId = "Choose a configured department.";
        }
        const primary = resolveSubject(profile.primarySubject, profile.primarySubjectId);
        const additional = profile.additionalSubjects.map((name, index) => resolveSubject(name, profile.additionalSubjectIds[index]));
        if (!primary) fields.primarySubject = "Choose from the school's configured subjects.";
        if (additional.some((name) => !name)) fields.additionalSubjects = "Choose from the school's configured subjects.";
        if (Object.keys(fields).length) {
          throw new HttpsError("invalid-argument", "Check the teaching profile fields.", { fields });
        }
        profile.primarySubject = primary.name;
        profile.primarySubjectId = primary.id;
        const distinct = new Map(additional.map((selection) => [identity(selection), selection]));
        distinct.delete(identity(primary));
        profile.additionalSubjects = [...distinct.values()].map(({ name }) => name);
        profile.additionalSubjectIds = [...distinct.values()].map(({ id }) => id);
      } else if (isHodDesignation(profile.designation)) {
        throw new HttpsError("invalid-argument", "Head of Department is a teaching designation.", { fields: { designation: "Choose a non-teaching designation." } });
      }

      const currentRole = member.get("staffRole");
      if (member.get("authUid") && currentRole && !allowedRole(profile, currentRole)) {
        throw new HttpsError("failed-precondition", "This category or designation conflicts with the linked app login.");
      }
      const now = new Date().toISOString();
      const stamp = { updatedBy: scope.uid, updatedAt: now };
      const empId = await reserveEmployeeId(tx, scope.school, staffId, {
        requested: profile.empId, previous: member.get("empId"), stamp,
      });
      const status = member.exists && saved.get("details.employmentStatus") === profile.employmentStatus
        ? member.get("status") || profile.employmentStatus : profile.employmentStatus;
      const subjectNames = profile.category === "Teaching" ? [profile.primarySubject, ...profile.additionalSubjects] : [];
      tx.set(staff, {
        id: staffId, name, empId, category: profile.category, designation: profile.designation,
        role: profile.designation, department: profile.department, departmentId: profile.departmentId ?? "", joined: profile.joined, status, profileVersion: 1,
        subjects: subjectNames.join(", "), subjectNames,
        ...(!member.exists ? { _o: Date.parse(now) } : {}), ...stamp,
      }, { merge: true });
      tx.set(privateProfile, {
        details: { ...profile, empId },
        ...(!saved.exists ? { createdBy: scope.uid, createdAt: now, requestId } : {}),
        ...stamp,
      }, { mergeFields: ["details", ...(!saved.exists ? ["createdBy", "createdAt", "requestId"] : []), "updatedBy", "updatedAt"] });
      if (image === null) tx.delete(photo);
      else if (image) tx.set(photo, { image });
      return { staffId, empId };
    });
  });

  const getStaffProfile = onCall(async (req) => {
    const scope = await adminScope(req);
    const { staff, privateProfile, photo } = refs(scope, staffIdFrom(req));
    return getFirestore().runTransaction(async (tx) => {
      await verifyAdmin(tx, scope);
      const [member, profile, picture] = await tx.getAll(staff, privateProfile, photo);
      if (!member.exists) throw absent();
      return { profile: profile.get("details") ?? null, photo: picture.get("image") ?? null };
    }, { readOnly: true });
  });

  const manageStaffFiles = onCall({ memory: "512MiB", concurrency: 4 }, async (req) => {
    const scope = await adminScope(req);
    const { staff, photo } = refs(scope, staffIdFrom(req));
    const { action } = req.data;
    if (!["photo", "list", "read", "save"].includes(action)) {
      throw new HttpsError("invalid-argument", "Choose a staff file action.");
    }

    if (action === "photo") {
      const image = profilePhoto(req.data.photo);
      if (!image) throw new HttpsError("invalid-argument", "Choose a profile photo.");
      await getFirestore().runTransaction(async (tx) => {
        await verifyAdmin(tx, scope);
        if (!(await tx.get(staff)).exists) throw absent();
        tx.set(photo, { image });
      });
      return { photo: image };
    }

    if (!(await staff.get()).exists) throw absent();
    const result = await staffDocuments(staff, req.data);
    if (action === "save") {
      // the staff member's own view of the document list (staff_self) follows an upload
      await refreshStaffSelf(scope.sid, staff.id).catch((error) => logger.warn("staff_self refresh failed after a document upload", { schoolId: scope.sid, staffId: staff.id, error: String(error) }));
    }
    return result;
  });

  const manageStaffPayroll = onCall(async (req) => {
    const scope = await adminScope(req);
    const staffId = staffIdFrom(req);
    const { action } = req.data;
    if (!["list", "saveAccount", "revealAccount", "recordPayment"].includes(action)) {
      throw new HttpsError("invalid-argument", "Choose a payroll action.");
    }
    const db = getFirestore();
    const staff = refs(scope, staffId).staff;
    const employee = db.collection("staff_payroll").doc(scope.sid).collection("employees").doc(staffId);
    return db.runTransaction(async (tx) => {
      await verifyAdmin(tx, scope);
      if (!(await tx.get(staff)).exists) throw absent();
      return staffPayroll(tx, employee, req.data, scope, staffId);
    }, { readOnly: action === "list" || action === "revealAccount" });
  });

  const cleanupStaffFiles = onDocumentDeleted({ document: "schools/{schoolId}/staff/{staffId}", retry: true }, async (event) => {
    const staff = event.data?.ref;
    if (!staff || (await staff.get()).exists) return;
    const school = staff.parent.parent;
    await Promise.all([school.collection("staff_hr_photos").doc(staff.id).delete(), school.collection("staff_self").doc(staff.id).delete(), deleteStaffDocuments(staff)]);
  });

  function allowedRole(profile, role) {
    if (!profile) return false;
    if (profile.category === "Teaching") return teacherRoles.includes(role);
    if (profile.designation === "Driver") return role === "driver";
    if (profile.designation === "Bus Attendant") return role === "helper";
    return !teacherRoles.includes(role) && !driverRoles.includes(role);
  }

  function profileAppRole(profile) {
    if (!profile?.category || !profile.designation) return "";
    if (profile.category === "Teaching") return isHodDesignation(profile.designation) && profile.departmentId ? "hod" : "teacher";
    return Object.hasOwn(designationAppRoles, profile.designation) ? designationAppRoles[profile.designation] : "general_staff";
  }

  async function linkedLogin(tx, scope, member, staffId) {
    const uid = member.get("authUid");
    if (!uid) return null;
    if (!validDocId(uid)) throw new HttpsError("failed-precondition", "The linked login is invalid.");
    const profile = await tx.get(scope.users.doc(uid));
    if (profile.get("schoolId") !== scope.sid || profile.get("staffId") !== staffId ||
        !["teacher", "driver", "attendant", "staff"].includes(profile.get("role"))) {
      throw new HttpsError("failed-precondition", "The linked login could not be verified.");
    }
    return { uid, profile };
  }

  const setStaffAppLogin = onCall({ timeoutSeconds: 60, secrets: [staffPasswordSecret] }, async (req) => {
    const scope = await adminScope(req);
    const staffId = staffIdFrom(req);
    const { staff, privateProfile } = refs(scope, staffId);
    const db = getFirestore();
    const auth = getAuth();
    const role = clean(req.data?.role);
    const email = clean(req.data?.email).toLowerCase();
    const replace = req.data?.replace === true;
    const requestedPassword = req.data?.password;
    if (!replace && (!validEmail(email) || !rolesFor(scope.actor).includes(role))) {
      throw new HttpsError("invalid-argument", "Enter a valid login email and app role.");
    }
    if (requestedPassword !== undefined && (replace || typeof requestedPassword !== "string" ||
        (!sixDigits.test(requestedPassword) && requestedPassword.length < 8) ||
        requestedPassword.length > 128 || requestedPassword.trim() !== requestedPassword)) {
      throw new HttpsError("invalid-argument", "Use six digits or 8 to 128 characters with no leading or trailing spaces.");
    }
    const passwordKey = staffPasswordKey();
    const operation = randomUUID();
    const current = await db.runTransaction(async (tx) => {
      await verifyAdmin(tx, scope);
      const [member, privateRecord] = await tx.getAll(staff, privateProfile);
      if (!member.exists) throw absent();
      const linked = await linkedLogin(tx, scope, member, staffId);
      if (replace && !linked) throw new HttpsError("failed-precondition", "This staff member has no linked login.");
      if (!replace && linked) throw new HttpsError("already-exists", "A login is already linked. Reopen the staff record to manage it.");
      const profile = privateRecord.get("details");
      if (!replace && profileAppRole(profile) !== role) {
        throw new HttpsError("failed-precondition", "Save the staff profile before setting up the app login for this designation.");
      }
      if ((privateRecord.get("loginLock.until") ?? 0) > Date.now()) {
        throw new HttpsError("resource-exhausted", "A password change is already running. Try again shortly.");
      }
      tx.set(privateProfile, { loginLock: { operation, until: Date.now() + 90_000 } }, { merge: true });
      return { member, linked, savedPassword: privateRecord.get("appPassword") };
    });
    let password = requestedPassword ?? randomPassword();
    const seal = (account) => sealStaffPassword(password, passwordKey, passwordContext(scope.sid, staffId, account), account);
    try {
      if (current.linked) {
        const { uid, profile } = current.linked;
        const account = await auth.getUser(uid);
        const linkedEmail = clean(account.email).toLowerCase();
        if (account.disabled || !validEmail(linkedEmail) || linkedEmail !== clean(profile.get("email")).toLowerCase()) {
          throw new HttpsError("failed-precondition", "The linked login is unavailable.");
        }
        if (current.savedPassword?.version === authVersion(account)) {
          let previous;
          try {
            previous = openStaffPassword(current.savedPassword, passwordKey, passwordContext(scope.sid, staffId, account));
          } catch {
            // A damaged copy can still be replaced.
          }
          while (password === previous) password = randomPassword();
        }
        // An interrupted Auth update must not leave an older password available for reveal.
        await privateProfile.update({ appPassword: FieldValue.delete() });
        const updated = await auth.updateUser(uid, { password });
        await privateProfile.update({ appPassword: seal(updated) });
        logger.info("Staff app password replaced", { schoolId: scope.sid, staffId, actorUid: scope.uid });
        return { email: linkedEmail, password };
      }

      const name = clean(current.member.get("name"));
      const uid = "staff_" + digest(JSON.stringify([scope.sid, staffId]));
      let account;
      try {
        account = await auth.createUser({ uid, email, displayName: name, password });
      } catch (error) {
        if (!["auth/email-already-exists", "auth/uid-already-exists"].includes(error.code)) throw error;
        const existing = await auth.getUser(uid).catch((lookupError) => {
          if (lookupError.code === "auth/user-not-found") return null;
          throw lookupError;
        });
        // Recover an Auth creation that completed before an interrupted staff transaction.
        if (!existing || (await scope.users.doc(uid).get()).exists) throw duplicateLogin();
        try {
          account = await auth.updateUser(uid, { email, displayName: name, password });
        } catch (updateError) {
          if (updateError.code === "auth/email-already-exists") throw duplicateLogin();
          throw updateError;
        }
      }
      const accessRole = appRole(role);
      const crew = accessRole === "driver" || accessRole === "attendant";
      const crewCollection = scope.school.collection("tr_crew");
      const existingCrewId = clean(current.member.get("crewId"));
      const crewRef = crew ? crewCollection.doc(validDocId(existingCrewId) ? existingCrewId : `crw_${account.uid}`) : null;
      try {
        await db.runTransaction(async (tx) => {
          await verifyAdmin(tx, scope);
          const [member, details] = await tx.getAll(staff, privateProfile);
          if (!member.exists || member.get("authUid") || details.get("loginLock.operation") !== operation ||
              profileAppRole(details.get("details")) !== role) {
            throw new HttpsError("failed-precondition", "The staff record changed. Reopen it and try again.");
          }
          if (crewRef) {
            const [crewRecord, matches] = await Promise.all([tx.get(crewRef), tx.get(crewCollection.where("email", "==", email))]);
            if (matches.docs.some((record) => record.id !== crewRef.id) ||
                (crewRecord.exists && (crewRecord.get("staffId") !== staffId || crewRecord.get("authUid")))) throw duplicateLogin();
          }
          const now = new Date().toISOString();
          tx.create(scope.users.doc(account.uid), {
            schoolId: scope.sid, role: accessRole, staffRole: role, staffId, name, email, createdAt: now, invitedBy: scope.uid,
            ...(crewRef ? { crewId: crewRef.id } : {}),
          });
          tx.update(staff, {
            authUid: account.uid, staffRole: role, email, updatedBy: scope.uid, updatedAt: now,
            ...(crewRef ? { crewId: crewRef.id } : {}),
          });
          tx.update(privateProfile, { appPassword: seal(account) });
          if (crewRef) tx.set(crewRef, {
            id: crewRef.id, staffId, authUid: account.uid, name, email, role: accessRole,
            ...(!existingCrewId ? { empId: `TR-${digest(staffId).slice(0, 12).toUpperCase()}`, status: "Active", _o: Date.parse(now) } : {}),
            phone: details.get("details.phone") ?? "", updatedBy: scope.uid, updatedAt: now,
          }, { merge: true });
        });
      } catch (error) {
        const linked = await scope.users.doc(account.uid).get().catch(() => null);
        if (linked?.exists && linked.get("staffId") === staffId) return { email, password };
        if (linked && !linked.exists) {
          await auth.deleteUser(account.uid).catch((failure) => logger.error("Staff login cleanup failed", { code: failure.code, staffId }));
        }
        throw error;
      }
      logger.info("Staff app password set", { schoolId: scope.sid, staffId, actorUid: scope.uid });
      return { email, password };
    } finally {
      await db.runTransaction(async (tx) => {
        const record = await tx.get(privateProfile);
        if (record.get("loginLock.operation") === operation) tx.update(privateProfile, { "loginLock.until": 0 });
      }).catch((error) => logger.warn("Staff login lock cleanup failed", { staffId, code: error.code }));
    }
  });

  const revealStaffAppPassword = onCall({ secrets: [staffPasswordSecret] }, async (req) => {
    const scope = await adminScope(req);
    const staffId = staffIdFrom(req);
    const { staff, privateProfile } = refs(scope, staffId);
    const result = await getFirestore().runTransaction(async (tx) => {
      await verifyAdmin(tx, scope);
      const [member, record] = await tx.getAll(staff, privateProfile);
      if (!member.exists) throw absent();
      if ((record.get("loginLock.until") ?? 0) > Date.now()) {
        throw new HttpsError("failed-precondition", "Wait for the password change to finish.");
      }
      const linked = await linkedLogin(tx, scope, member, staffId);
      if (!linked) throw new HttpsError("failed-precondition", "This staff member has no linked login.");
      return { uid: linked.uid, email: clean(linked.profile.get("email")).toLowerCase(), encrypted: record.get("appPassword") };
    }, { readOnly: true });
    if (!result.encrypted) return { state: "replacement-required" };

    const account = await getAuth().getUser(result.uid);
    if (account.disabled || !validEmail(result.email) || clean(account.email).toLowerCase() !== result.email) {
      throw new HttpsError("failed-precondition", "The linked login is unavailable.");
    }
    if (result.encrypted.version !== authVersion(account)) return { state: "replacement-required" };
    let password;
    try {
      password = openStaffPassword(result.encrypted, staffPasswordKey(), passwordContext(scope.sid, staffId, account));
    } catch {
      throw new HttpsError("internal", "The staff password could not be retrieved.");
    }
    logger.info("Staff app password revealed", { schoolId: scope.sid, staffId, actorUid: scope.uid });
    return { state: "revealed", email: result.email, password };
  });

  const deleteStaffProfile = onCall(async (req) => {
    const scope = await adminScope(req);
    const staffId = staffIdFrom(req);
    const { staff, privateProfile, photo } = refs(scope, staffId);
    const uid = await getFirestore().runTransaction(async (tx) => {
      await verifyAdmin(tx, scope);
      const [member, record] = await tx.getAll(staff, privateProfile);
      if (!member.exists) throw absent();
      if (member.get("crewId")) throw new HttpsError("failed-precondition", "Manage this staff member through Transport.");
      if ((record.get("loginLock.until") ?? 0) > Date.now()) throw new HttpsError("resource-exhausted", "Wait for the password change to finish.");
      const linked = await linkedLogin(tx, scope, member, staffId);
      const reservation = await tx.get(employeeRef(scope.school, member.get("empId")));
      if (reservation.get("staffId") === staffId) tx.delete(reservation.ref);
      if (linked) tx.delete(linked.profile.ref);
      tx.delete(privateProfile);
      tx.delete(photo);
      tx.delete(staff);
      return linked?.uid;
    });
    if (uid) await getAuth().deleteUser(uid).catch((error) => {
      if (error.code !== "auth/user-not-found") logger.error("Removed staff Auth cleanup failed", { staffId, uid, code: error.code });
    });
    return { deleted: true };
  });

  return { saveStaffProfile, getStaffProfile, manageStaffFiles, manageStaffPayroll, cleanupStaffFiles, setStaffAppLogin,
    revealStaffAppPassword, deleteStaffProfile };
};
