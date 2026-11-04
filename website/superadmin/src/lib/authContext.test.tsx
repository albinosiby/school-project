import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getRow, seed } from "@/test/render";

type Real = typeof import("./authContext");
const real = () => vi.importActual<Real>("./authContext");

describe("independent superadmin authentication", () => {
  it("accepts only provisioned platform owners", async () => {
    const { ownerProfile, NOT_OWNER } = await real();
    seed({ platform_admins: [{ id: "owner_1" }], users: [{ id: "school_admin", role: "admin", schoolId: "s1" }] });
    expect(await ownerProfile({ uid: "owner_1", email: "owner@edvio.test" } as never)).toMatchObject({ role: "owner", schoolId: "" });
    await expect(ownerProfile({ uid: "school_admin" } as never)).rejects.toThrow(NOT_OWNER);
    await expect(ownerProfile({ uid: "unknown" } as never)).rejects.toThrow(NOT_OWNER);
    expect(getRow("users", "unknown")).toBeUndefined();
  });

  it("signs out a school admin instead of bootstrapping a school", async () => {
    const { AuthProvider, useAuth, NOT_OWNER } = await real();
    let context: ReturnType<typeof useAuth> | undefined;
    function Probe() { context = useAuth(); return null; }
    render(<AuthProvider><Probe /></AuthProvider>);
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({ user: { uid: "not_an_owner" } } as never);
    await expect(context!.login("admin@school.test", "password")).rejects.toThrow(NOT_OWNER);
    expect(signOut).toHaveBeenCalled();
    expect(getRow("users", "not_an_owner")).toBeUndefined();
  });
});
