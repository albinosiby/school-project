// Fake `firebase/auth`, `firebase/app`, `firebase/storage`, `@/lib/firebase` and `@/lib/authContext`.
import { vi } from "vitest";
import { ADMIN_UID, SCHOOL_ID } from "./fakeDb";

// ---- firebase/auth ------------------------------------------------------------------------------------------
/** emails that already have an Auth account (createUserWithEmailAndPassword rejects them like Firebase does) */
export const authAccounts = new Map<string, string>();
export const sentInvites: string[] = [];
let uidSeq = 0;
export function resetAuth() { authAccounts.clear(); sentInvites.length = 0; uploads.length = 0; uidSeq = 0; }

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
  onAuthStateChanged: vi.fn(() => () => {}),
  updateProfile: vi.fn(async () => {}),
};

export const appModule = {
  getApps: () => [],
  getApp: () => ({ name: "[DEFAULT]" }),
  initializeApp: (_o: unknown, name = "[DEFAULT]") => ({ name }),
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
};

// ---- @/lib/authContext --------------------------------------------------------------------------------------
export const authState = {
  user: { id: ADMIN_UID, email: "admin@school.test", organizationName: "Test School", schoolId: SCHOOL_ID, role: "admin" as const } as null | { id: string; email: string; organizationName: string; schoolId: string; role: "admin" | "owner" },
  isLoading: false,
  blockedMessage: "",
  login: vi.fn<(email: string, password: string) => Promise<void>>(async () => {}),
  signup: vi.fn<(email: string, password: string, org: string) => Promise<void>>(async () => {}),
  resetPassword: vi.fn<(email: string) => Promise<void>>(async () => {}),
  logout: vi.fn(async () => {}),
};
export function resetAuthState() {
  authState.user = { id: ADMIN_UID, email: "admin@school.test", organizationName: "Test School", schoolId: SCHOOL_ID, role: "admin" };
  authState.isLoading = false; authState.blockedMessage = "";
  authState.login.mockReset().mockResolvedValue(undefined); authState.signup.mockReset().mockResolvedValue(undefined);
  authState.resetPassword.mockReset().mockResolvedValue(undefined); authState.logout.mockReset().mockResolvedValue(undefined);
}
export const authContextModule = {
  useAuth: () => authState,
  homeFor: (u: { role: string } | null) => (u?.role === "owner" ? "/owner" : "/dashboard"),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
};
