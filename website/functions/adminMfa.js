const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { verifiedAdminSession } = require("./adminSession");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const allowedOrigins = () => (process.env.WEBAUTHN_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,https://school-admin-tatos-2610.web.app,https://school-admin-tatos-2610.firebaseapp.com").split(",").map((x) => x.trim()).filter(Boolean);
const denied = () => new HttpsError("permission-denied", "Verify your administrator passkey to continue.");
function createAdminMfa({ db, auth, webauthn, clock = () => Date.now(), origins = allowedOrigins }) {
  async function handler(req) {
    const uid = req.auth?.uid, data = req.data || {}, action = data.action;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in with your email and password first.");
    const profileRef = db.doc(`users/${uid}`), security = db.doc(`admin_security/${uid}`);
    const profile = (await profileRef.get()).data();
    if (profile?.role !== "admin" || !profile.schoolId) throw new HttpsError("permission-denied", "Passkey setup is available to school administrators.");
    if ((await db.doc(`platform_schools/${profile.schoolId}`).get()).get("status") === "suspended") throw denied();
    const verified = verifiedAdminSession(req.auth, profile, clock());
    const recentPassword = () => {
      const age = clock() / 1000 - (Number(req.auth.token?.auth_time) || 0);
      if (age < -30 || age > 300) throw new HttpsError("failed-precondition", "Enter your password again before changing security settings.", { reason: "recent-login-required" });
    };
    const issue = async (version, recovery = false) => ({ token: await auth.createCustomToken(uid, { adminMfaVersion: version, adminMfaAt: Math.floor(clock() / 1000), adminMfaRecovery: recovery }) });
    const credentials = security.collection("credentials");
    if (action === "status") {
      const keys = await credentials.get();
      return { enabled: !!profile.mfaVersion, verified, credentials: keys.docs.map((key) => ({ id: key.id, label: key.get("label"), rpId: key.get("rpId"), createdAt: key.get("createdAt"), lastUsedAt: key.get("lastUsedAt") || "" })) };
    }
    const origin = req.rawRequest?.get?.("origin") || req.rawRequest?.headers?.origin;
    if (!origins().includes(origin)) throw new HttpsError("failed-precondition", "Passkeys are not configured for this website address.");
    if (JSON.stringify(data.response || {}).length > 32768) throw new HttpsError("invalid-argument", "The passkey response is too large.");
    const rpId = new URL(origin).hostname, now = clock();
    if (["beginRegistration", "beginAuthentication"].includes(action)) {
      const expired = await security.collection("challenges").where("expiresAt", "<", new Date(now)).limit(50).get();
      if (!expired.empty) { const cleanup = db.batch(); expired.docs.forEach((doc) => cleanup.delete(doc.ref)); await cleanup.commit(); }
    }
    const reserve = async (kind, options) => {
      const ref = security.collection("challenges").doc(randomUUID());
      await db.runTransaction(async (tx) => {
        const current = await tx.get(security), minute = Math.floor(now / 60000), count = current.get("rateMinute") === minute ? Number(current.get("rateCount")) || 0 : 0;
        if (count >= 10) throw new HttpsError("resource-exhausted", "Too many passkey attempts. Try again in a minute.");
        tx.set(security, { rateMinute: minute, rateCount: count + 1 }, { merge: true });
        tx.create(ref, { kind, challenge: options.challenge, origin, rpId, version: profile.mfaVersion || "", expiresAt: new Date(now + 300000), used: false });
      });
      return { challengeId: ref.id, options };
    };
    const consume = async (kind) => {
      if (!/^[a-f0-9-]{36}$/i.test(data.challengeId || "")) throw new HttpsError("invalid-argument", "Start passkey verification again.");
      const ref = security.collection("challenges").doc(data.challengeId);
      return db.runTransaction(async (tx) => {
        const challenge = await tx.get(ref), c = challenge.data();
        if (!c || c.used || c.expiresAt.toMillis() < now || c.kind !== kind || c.origin !== origin || c.rpId !== rpId || c.version !== (profile.mfaVersion || "")) throw new HttpsError("failed-precondition", "This passkey request expired. Start again.");
        tx.update(ref, { used: true });
        return c;
      });
    };
    const audit = (tx, actionName) => tx.create(db.collection("schools").doc(profile.schoolId).collection("set_audit").doc(), { at: new Date(now).toISOString(), actor: uid, action: actionName, detail: "Administrator account security", kind: "security" });
    if (action === "beginRegistration") {
      recentPassword(); if (!verified) throw denied();
      const keys = await credentials.get();
      if (keys.size >= 8) throw new HttpsError("resource-exhausted", "Remove an old passkey before adding another.");
      const options = await webauthn.generateRegistrationOptions({ rpName: "Edvio School Administration", rpID: rpId, userID: new Uint8Array(Buffer.from(uid)), userName: profile.email || uid, userDisplayName: profile.name || profile.email || "School administrator", timeout: 120000, attestationType: "none", preferredAuthenticatorType: "securityKey", authenticatorSelection: { residentKey: "preferred", userVerification: "required" }, excludeCredentials: keys.docs.filter((key) => key.get("rpId") === rpId).map((key) => ({ id: key.get("credentialId"), transports: key.get("transports") || [] })) });
      return reserve("registration", options);
    }
    if (action === "finishRegistration") {
      recentPassword(); if (!verified) throw denied();
      const c = await consume("registration");
      let result;
      try { result = await webauthn.verifyRegistrationResponse({ response: data.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: true }); } catch { throw new HttpsError("invalid-argument", "The passkey could not be verified. Start pairing again."); }
      if (!result.verified || !result.registrationInfo.userVerified) throw denied();
      const info = result.registrationInfo, key = info.credential, ref = credentials.doc(digest(key.id));
      const version = profile.mfaVersion || randomUUID();
      const codes = !profile.mfaVersion ? Array.from({ length: 8 }, () => randomBytes(10).toString("hex").toUpperCase()) : [];
      await db.runTransaction(async (tx) => {
        const [current, exists] = await tx.getAll(profileRef, ref);
        if ((current.get("mfaVersion") || "") !== c.version || exists.exists) throw new HttpsError("failed-precondition", "The security settings changed. Start again.");
        tx.create(ref, { credentialId: key.id, publicKey: Buffer.from(key.publicKey), counter: key.counter, transports: key.transports || [], rpId, label: String(data.label || "Security key / passkey").trim().slice(0, 80), createdAt: new Date(now).toISOString(), lastUsedAt: "" });
        tx.update(profileRef, { mfaVersion: version, mfaEnabledAt: new Date(now).toISOString() });
        if (codes.length) tx.set(security, { recoveryHashes: codes.map((code) => digest(`${uid}:${code}`)) }, { merge: true });
        audit(tx, "Registered administrator passkey");
      });
      return { ...(await issue(version)), recoveryCodes: codes };
    }
    if (action === "beginAuthentication") {
      if (!profile.mfaVersion) throw new HttpsError("failed-precondition", "No passkey is configured for this account.");
      const keys = await credentials.where("rpId", "==", rpId).get();
      if (keys.empty) throw new HttpsError("failed-precondition", "Use a recovery code to sign in on this website, then register a passkey here.");
      const options = await webauthn.generateAuthenticationOptions({ rpID: rpId, timeout: 120000, userVerification: "required", allowCredentials: keys.docs.map((key) => ({ id: key.get("credentialId"), transports: key.get("transports") || [] })) });
      return reserve("authentication", options);
    }
    if (action === "finishAuthentication") {
      const c = await consume("authentication");
      const id = data.response?.id;
      if (typeof id !== "string" || id.length > 2048) throw denied();
      const keyRef = credentials.doc(digest(id)), key = await keyRef.get();
      if (!key.exists || key.get("rpId") !== rpId) throw denied();
      let result;
      try { result = await webauthn.verifyAuthenticationResponse({ response: data.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: true, credential: { id: key.get("credentialId"), publicKey: new Uint8Array(key.get("publicKey")), counter: key.get("counter"), transports: key.get("transports") || [] } }); } catch { throw denied(); }
      if (!result.verified || !result.authenticationInfo.userVerified) throw denied();
      await db.runTransaction(async (tx) => {
        const [current, currentKey] = await tx.getAll(profileRef, keyRef);
        if (current.get("mfaVersion") !== c.version || !currentKey.exists || currentKey.get("counter") !== key.get("counter")) throw denied();
        tx.update(keyRef, { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date(now).toISOString() }); audit(tx, "Verified administrator passkey");
      });
      return issue(c.version);
    }
    if (action === "recover") {
      recentPassword();
      const code = String(data.code || "").replace(/\s|-/g, "").toUpperCase();
      if (!/^[A-F0-9]{20}$/.test(code) || !profile.mfaVersion) throw denied();
      const accepted = await db.runTransaction(async (tx) => {
        const [current, currentProfile] = await tx.getAll(security, profileRef);
        const minute = Math.floor(now / 60000), tries = current.get("recoveryMinute") === minute ? Number(current.get("recoveryTries")) || 0 : 0;
        if (tries >= 5) throw new HttpsError("resource-exhausted", "Too many recovery attempts. Try again later.");
        const hashes = current.get("recoveryHashes") || [], value = digest(`${uid}:${code}`);
        tx.set(security, { recoveryMinute: minute, recoveryTries: tries + 1 }, { merge: true });
        // Return a committed failure, so incorrect guesses still count toward the limit.
        if (!hashes.includes(value) || currentProfile.get("mfaVersion") !== profile.mfaVersion) return false;
        tx.set(security, { recoveryHashes: hashes.filter((item) => item !== value) }, { merge: true });
        audit(tx, "Used administrator recovery code"); return true;
      });
      if (!accepted) throw denied();
      return issue(profile.mfaVersion, true);
    }
    if (["removeCredential", "disable"].includes(action)) {
      recentPassword(); if (!verified) throw denied();
      const next = randomUUID();
      await db.runTransaction(async (tx) => {
        const [current, keys] = await Promise.all([tx.get(profileRef), tx.get(credentials)]);
        if (current.get("mfaVersion") !== profile.mfaVersion) throw denied();
        if (action === "removeCredential") {
          if (!/^[a-f0-9]{64}$/.test(data.id || "") || !keys.docs.some((key) => key.id === data.id)) throw new HttpsError("invalid-argument", "Choose a registered passkey.");
          if (keys.size <= 1) throw new HttpsError("failed-precondition", "Add another passkey before removing your last one, or disable MFA.");
          tx.delete(credentials.doc(data.id)); tx.update(profileRef, { mfaVersion: next });
        } else {
          for (const key of keys.docs) tx.delete(key.ref);
          tx.update(profileRef, { mfaVersion: FieldValue.delete(), mfaEnabledAt: FieldValue.delete() });
          tx.set(security, { recoveryHashes: [] }, { merge: true });
        }
        audit(tx, action === "disable" ? "Disabled administrator MFA" : "Removed administrator passkey");
      });
      return action === "disable" ? { ...(await issue("")), disabled: true } : issue(next);
    }
    throw new HttpsError("invalid-argument", "Choose a valid passkey action.");
  }
  return handler;
}
exports.createAdminMfa = createAdminMfa;
exports.manageAdminMfa = onCall({ timeoutSeconds: 60, concurrency: 8 }, async (req) => {
  const webauthn = await import("@simplewebauthn/server");
  return createAdminMfa({ db: getFirestore(), auth: getAuth(), webauthn })(req);
});
