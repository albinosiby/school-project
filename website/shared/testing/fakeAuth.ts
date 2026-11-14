// Fake `firebase/auth`, `firebase/app`, `firebase/storage`, `@/lib/firebase` and `@/lib/authContext`.
import { vi } from "vitest";
import { ADMIN_UID, SCHOOL_ID, getRow, guard, rawSet, rawUpdate } from "./fakeDb";

// ---- firebase/auth ------------------------------------------------------------------------------------------
/** emails that already have an Auth account (createUserWithEmailAndPassword rejects them like Firebase does) */
export const authAccounts = new Map<string, string>();
export const sentInvites: string[] = [];
let uidSeq = 0;
export function resetAuth() { authAccounts.clear(); sentInvites.length = 0; uploads.length = 0; callableCalls.length = 0; uidSeq = 0; }

const err = (code: string) => Object.assign(new Error(code), { code });
export const authModule = {
  getAuth: () => ({ currentUser: { uid: ADMIN_UID } }),
  connectAuthEmulator: () => {},
  createUserWithEmailAndPassword: vi.fn(async (_a: unknown, email: string) => {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw err("auth/invalid-email");
    if (authAccounts.has(email.toLowerCase())) throw err("auth/email-already-in-use");
    const uid = `uid_new_${++uidSeq}`;
    authAccounts.set(email.toLowerCase(), uid);
    return { user: { uid, email, delete: async () => { authAccounts.delete(email.toLowerCase()); } } };
  }),
  sendPasswordResetEmail: vi.fn(async (_a: unknown, email: string) => { sentInvites.push(email); }),
  signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: ADMIN_UID } })),
  signOut: vi.fn(async () => {}),
  signInWithCustomToken: vi.fn(async () => ({ user: { uid: ADMIN_UID } })),
  getIdTokenResult: vi.fn(async () => ({ claims: {}, signInProvider: "password" })),
  reauthenticateWithCredential: vi.fn(async () => ({})),
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  onAuthStateChanged: vi.fn(() => () => {}),
  updateProfile: vi.fn(async () => {}),
};

export const appModule = {
  getApps: () => [],
  getApp: () => ({ name: "[DEFAULT]" }),
  initializeApp: (_o: unknown, name = "[DEFAULT]") => ({ name }),
  deleteApp: async () => {},
};

// ---- firebase/functions -------------------------------------------------------------------------------------
/** calls made to callable functions: [name, data] */
export const callableCalls: [string, unknown][] = [];
export const functionsModule = {
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => {},
  httpsCallable: (_f: unknown, name: string) => async (data: unknown) => {
    callableCalls.push([name, data]);
    if (name === "manageExamination") {
      const { fakeExamAction } = await import("./fakeExams");
      return { data: fakeExamAction(data as Record<string, unknown>) };
    }
    if (name === "manageAcademicRollover") {
      const request = data as { action: string; fromYear?: string };
      if (request.action === "preview") return { data: { fromYear: "2026-27", toYear: "2027-28", planHash: "reviewed-test-plan", promoted: 0, graduated: 0, moves: [], issues: [] } };
      rawSet("academic_rollovers", request.fromYear || "2026-27", { fromYear: "2026-27", toYear: "2027-28", status: "Running", phase: "Archive", total: 0, processed: 0, createdAt: new Date().toISOString() });
      return { data: { id: request.fromYear, status: "Running" } };
    }
    if (name === "manageAdminMfa") return { data: { enabled: false, verified: true, credentials: [] } };
    if (name === "recordFeePayment") {
      const { fakeRecordPayment } = await import("./fakePayments");
      return { data: fakeRecordPayment(data as Parameters<typeof fakeRecordPayment>[0]) };
    }
    if (name === "setClassTeacher") {
      guard();
      const input = data as { classId: string; teacherId: string; create?: Record<string, unknown> };
      const teacher = getRow<{ name: string }>("staff", input.teacherId);
      const patch = { classTeacherId: input.teacherId, classTeacher: teacher?.name || "", updatedAt: new Date().toISOString(), updatedBy: ADMIN_UID };
      if (input.create) rawSet("classes", input.classId, { ...input.create, id: input.classId, ...patch });
      else rawUpdate("classes", input.classId, patch);
      return { data: patch };
    }
    if (name === "setParentAppAccess") {
      const access = data as { enabled: boolean; email?: string };
      return { data: access.enabled ? { state: "issued", email: access.email, password: "024681" } : { state: "off" } };
    }
    if (name === "revealParentPassword") {
      const { version } = data as { version: string };
      return { data: version === "hash-only" ? { state: "replacement-required" } : { state: "revealed", password: "024681" } };
    }
    if (name === "createSchoolStaff" || name === "resendSchoolStaffInvite") return { data: { created: true, emailSent: true } };
    if (name === "saveStaffProfile") return { data: { staffId: "stf_new_profile", empId: "EMP-1001" } };
    if (name === "manageStaffPayroll") return { data: { account: null, payments: [] } };
    if (name === "setStaffAppLogin") {
      const { email, password } = data as { email: string; password?: string };
      return { data: { email, password: password ?? "024681" } };
    }
    if (name === "revealStaffAppPassword") return { data: { state: "revealed", email: "driver@example.test", password: "024681" } };
    return { data: { ok: true, logins: 1, files: 0 } };
  },
};

// ---- firebase/storage ---------------------------------------------------------------------------------------
export const uploads: { path: string; size: number; type: string }[] = [];
export const storageModule = {
  getStorage: () => ({}),
  connectStorageEmulator: () => {},
  ref: (_s: unknown, path: string) => ({ fullPath: path }),
  uploadBytes: vi.fn(async (r: { fullPath: string }, f: Blob) => { uploads.push({ path: r.fullPath, size: f.size, type: f.type }); return { ref: r }; }),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(async (r: { fullPath: string }) => `https://files.test/${r.fullPath}`),
  deleteObject: vi.fn(async () => {}),
};

// ---- @/lib/firebase -----------------------------------------------------------------------------------------
export const libFirebaseModule = {
  useEmulator: false,
  firebaseOptions: {},
  withEmulator: <T,>(a: T) => a,
  auth: { currentUser: { uid: ADMIN_UID, email: "admin@school.test" } },
  db: { __fake: true },
  storage: {},
  functions: {},
  firestoreFor: () => ({ __fake: true }),
};

// ---- @/lib/authContext --------------------------------------------------------------------------------------
export const authState = {
  user: { id: ADMIN_UID, email: "admin@school.test", organizationName: "Test School", schoolId: SCHOOL_ID, role: "admin" as const } as null | { id: string; email: string; organizationName: string; schoolId: string; role: "admin" | "owner" | "staff"; staffRole?: string },
  isLoading: false,
  actAs: vi.fn<(sid: string | null) => void>(),
  blockedMessage: "",
  login: vi.fn<(email: string, password: string) => Promise<void>>(async () => {}),
  signup: vi.fn<(email: string, password: string, org: string) => Promise<void>>(async () => {}),
  resetPassword: vi.fn<(email: string) => Promise<void>>(async () => {}),
  completeAdminMfa: vi.fn(async () => {}), logout: vi.fn(async () => {}),
};
export function resetAuthState() {
  authState.user = { id: ADMIN_UID, email: "admin@school.test", organizationName: "Test School", schoolId: SCHOOL_ID, role: "admin" };
  authState.isLoading = false; authState.blockedMessage = ""; authState.actAs.mockReset();
  authState.login.mockReset().mockResolvedValue(undefined); authState.signup.mockReset().mockResolvedValue(undefined);
  authState.completeAdminMfa.mockReset().mockResolvedValue(undefined);
  authState.resetPassword.mockReset().mockResolvedValue(undefined); authState.logout.mockReset().mockResolvedValue(undefined);
}
export const authContextModule = {
  useAuth: () => authState,
  homeFor: (u: { role: string; schoolId?: string } | null) => (u?.role === "staff" ? "/staff-access" : u?.role === "owner" && !u.schoolId ? "/owner" : "/dashboard"),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
};
