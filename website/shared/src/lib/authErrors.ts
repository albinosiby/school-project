const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/user-not-found": "No account found for this email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled. Contact your school administrator.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/operation-not-allowed": "Email sign-in is not enabled for this project.",
  "unavailable": "Network error. Check your connection.",
  "permission-denied": "This account cannot open the admin console.",
};
/** Maps a Firebase Auth / Firestore error to the message shown on the login and sign-up pages (exported for tests). */
export function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? "";
  const fromMsg = /\((auth\/[a-z-]+)\)/.exec(e instanceof Error ? e.message : "")?.[1] ?? "";
  const raw = e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Something went wrong";
  return new Error(AUTH_MESSAGES[code] ?? AUTH_MESSAGES[fromMsg] ?? raw);
}

