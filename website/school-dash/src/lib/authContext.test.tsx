// authContext is mocked for every other test; here the real module is loaded to test its error mapping and the
// login guard (data contract sections 1 and 7: parent accounts are refused; school staff land in the staff portal).
import { describe, expect, it, vi } from "vitest";
import { act, render, waitFor, screen } from "@testing-library/react";
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, getIdTokenResult, signOut } from "firebase/auth";
import { getRow, seed } from "@/test/render";

type Real = typeof import("./authContext");
const real = () => vi.importActual<Real>("./authContext");

describe("friendly()", () => {
  it("maps Firebase codes to the messages the login and sign-up pages show", async () => {
    const { friendly } = await real();
    const err = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
    expect(friendly(err("auth/invalid-credential")).message).toBe("Incorrect email or password.");
    expect(friendly(err("auth/wrong-password")).message).toBe("Incorrect email or password.");
    expect(friendly(err("auth/user-not-found")).message).toBe("No account found for this email.");
    expect(friendly(err("auth/invalid-email")).message).toBe("Enter a valid email address.");
    expect(friendly(err("auth/email-already-in-use")).message).toBe("An account with this email already exists. Sign in instead.");
    expect(friendly(err("auth/weak-password")).message).toBe("Password must be at least 6 characters.");
    expect(friendly(err("auth/too-many-requests")).message).toBe("Too many attempts. Try again in a few minutes.");
    expect(friendly(err("auth/network-request-failed")).message).toBe("Network error. Check your connection.");
    expect(friendly(err("auth/user-disabled")).message).toBe("This account has been disabled. Contact your school administrator.");
  });
  it("reads the code from the message, strips the Firebase prefix, and never throws on odd input", async () => {
    const { friendly } = await real();
    expect(friendly(new Error("Firebase: Error (auth/missing-password).")).message).toBe("Enter your password.");
    expect(friendly(new Error("Firebase: something odd")).message).toBe("something odd");
    expect(friendly("boom").message).toBe("Something went wrong");
    expect(friendly(undefined).message).toBe("Something went wrong");
    expect(friendly(Object.assign(new Error("x"), { code: "unavailable" })).message).toBe("Network error. Check your connection.");
  });
});

/** Renders the real provider and returns its live context. */
async function mount() {
  const { AuthProvider, useAuth } = await real();
  const box: { ctx: ReturnType<Real["useAuth"]> | null } = { ctx: null };
  function Probe() { box.ctx = useAuth(); return null; }
  render(<AuthProvider><Probe /></AuthProvider>);
  return box;
}
const signInAs = (uid: string) => vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({ user: { uid, email: `${uid}@s.in`, displayName: "" } } as never);

describe("school selection from the independent owner app", () => {
  it("retains selection through sign-in and applies it only after owner membership is verified", async () => {
    window.history.replaceState({}, "", "/dashboard?school=selected_school");
    seed({ platform_admins: [{ id: "handoff_owner" }] });
    let observer: (user: unknown) => void = () => {};
    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => { observer = callback as typeof observer; return () => {}; });
    const box = await mount();
    await act(async () => observer(null));
    window.history.replaceState({}, "", "/login");
    await act(async () => observer({ uid: "handoff_owner", email: "owner@edvio.test" }));
    await waitFor(() => expect(box.ctx!.user).toMatchObject({ role: "owner", schoolId: "selected_school" }));
    expect(sessionStorage.getItem("edvio.owner.pendingSchool")).toBeNull();
  });

  it("does not let a school admin select another school through the URL", async () => {
    window.history.replaceState({}, "", "/dashboard?school=another_school");
    seed({ users: [{ id: "handoff_admin", schoolId: "own_school", role: "admin" }] });
    let observer: (user: unknown) => void = () => {};
    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => { observer = callback as typeof observer; return () => {}; });
    const box = await mount();
    await act(async () => observer({ uid: "handoff_admin", email: "admin@school.test" }));
    await waitFor(() => expect(box.ctx!.user).toMatchObject({ role: "admin", schoolId: "own_school" }));
    expect(sessionStorage.getItem("edvio.owner.pendingSchool")).toBeNull();
  });
});

describe("login guard", () => {
  it("admits a teacher account into the staff portal with its staff id", async () => {
    const { homeFor } = await real();
    seed({ users: [{ id: "uid_teacher", schoolId: "sch_test", role: "teacher", staffId: "stf_001", staffRole: "teacher", name: "Anita" }] });
    let observer: (user: unknown) => void = () => {};
    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => { observer = callback as typeof observer; return () => {}; });
    const box = await mount();
    await act(async () => observer({ uid: "uid_teacher", email: "t@s.in" }));
    expect(box.ctx!.user).toMatchObject({ role: "teacher", staffId: "stf_001", staffRole: "teacher", name: "Anita", schoolId: "sch_test" });
    expect(homeFor(box.ctx!.user)).toBe("/me");
    expect(signOut).not.toHaveBeenCalled();
  });
  it("refuses a parent account", async () => {
    const { NOT_ADMIN } = await real();
    seed({ users: [{ id: "uid_parent", schoolId: "sch_test", role: "parent", studentIds: ["stu_001"] }] });
    const box = await mount();
    signInAs("uid_parent");
    await expect(box.ctx!.login("p@s.in", "pw")).rejects.toThrow(NOT_ADMIN);
  });
  it("refuses a login with no users doc and no school data, without leaving a doc behind", async () => {
    const { NO_SCHOOL } = await real();
    const box = await mount();
    signInAs("uid_stranger");
    await expect(box.ctx!.login("x@s.in", "pw")).rejects.toThrow(NO_SCHOOL);
    expect(getRow("users", "uid_stranger")).toBeUndefined();
  });
  it("accepts an admin of the school", async () => {
    seed({ users: [{ id: "uid_admin2", schoolId: "sch_test", role: "admin" }] });
    const box = await mount();
    signInAs("uid_admin2");
    await act(async () => { await box.ctx!.login(" a@s.in ", "pw"); });
    expect(signInWithEmailAndPassword).toHaveBeenLastCalledWith(expect.anything(), "a@s.in", "pw");
  });
  it("shows the friendly text for a wrong password", async () => {
    const box = await mount();
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(Object.assign(new Error("Firebase: Error (auth/invalid-credential)."), { code: "auth/invalid-credential" }));
    await expect(box.ctx!.login("a@s.in", "nope")).rejects.toThrow("Incorrect email or password.");
  });
  it("loads a delegated staff role and directs it to the staff portal", async () => {
    const { homeFor } = await real();
    seed({ users: [{ id: "uid_principal", schoolId: "sch_test", role: "staff", staffRole: "principal" }] });
    let observer: (user: unknown) => void = () => {};
    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => {
      observer = callback as typeof observer;
      return () => {};
    });
    const box = await mount();
    await act(async () => observer({ uid: "uid_principal", email: "principal@s.in" }));
    expect(box.ctx!.user).toMatchObject({ role: "staff", staffRole: "principal", schoolId: "sch_test" });
    expect(homeFor(box.ctx!.user)).toBe("/me");
  });
});


describe("administrator MFA gate", () => {
  it("keeps the school closed until a verified second-factor token is installed", async () => {
    const uid="mfa_admin_ui", account={uid,email:"mfa@example.test",displayName:""};
    seed({users:[{id:uid,schoolId:"mfa_school",role:"admin",mfaVersion:"security-v1"}]});
    let observer: (user: unknown) => void=()=>{};
    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth,callback)=>{observer=callback as typeof observer;return()=>{}});
    const box=await mount();
    await act(async()=>observer(account));
    await screen.findByRole("heading",{name:"Verify administrator access"});
    expect(box.ctx!.user).toBeNull();
    vi.mocked(signInWithCustomToken).mockResolvedValueOnce({user:account} as never);
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({claims:{adminMfaVersion:"security-v1",adminMfaAt:Math.floor(Date.now()/1000)},signInProvider:"custom"} as never);
    await act(async()=>box.ctx!.completeAdminMfa("verified-test-token",["RECOVERY-CODE-SHOWN-ONCE"]));
    expect(box.ctx!.user).toMatchObject({id:uid,schoolId:"mfa_school"});
    expect(screen.getByText("RECOVERY-CODE-SHOWN-ONCE")).toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:"Verify administrator access"})).not.toBeInTheDocument();
  });
});
