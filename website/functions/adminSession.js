const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const MFA_AGE_SECONDS = 12 * 3600;
function verifiedAdminSession(auth, profile, now = Date.now()) {
  const version = profile?.mfaVersion;
  return !version || (auth?.token?.firebase?.sign_in_provider === "custom" && auth.token.adminMfaVersion === version
    && Number.isSafeInteger(auth.token.adminMfaAt) && auth.token.adminMfaAt <= now / 1000 + 30 && now / 1000 - auth.token.adminMfaAt < MFA_AGE_SECONDS);
}
async function requireAdminSession(req, profile, allowRollover = false) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const data = profile || (await getFirestore().doc(`users/${req.auth.uid}`).get()).data();
  if (data?.role === "admin" && !verifiedAdminSession(req.auth, data)) throw new HttpsError("permission-denied", "Verify your administrator passkey to continue.", { reason: "mfa-required" });
  if (data?.schoolId && !allowRollover) {
    const platform = await getFirestore().doc(`platform_schools/${data.schoolId}`).get();
    if (platform.get("rolloverJob")) throw new HttpsError("failed-precondition", "The academic rollover is running. Wait for it to finish before changing school records.");
  }
}
exports.verifiedAdminSession = verifiedAdminSession;
exports.requireAdminSession = requireAdminSession;
