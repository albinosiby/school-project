import { describe, expect, it } from "vitest";
import { accountError, createAccount, sendInvite } from "./staffAccount";
import { authAccounts, sentInvites } from "@/test/render";

describe("staffAccount", () => {
  it("accountError maps Firebase codes to admin-facing text", () => {
    expect(accountError({ code: "auth/email-already-in-use" })).toBe("This email already has a login (it may belong to another school). Use a different email.");
    expect(accountError({ code: "auth/invalid-email" })).toBe("The email address is not valid.");
    expect(accountError({ code: "auth/network-request-failed" })).toBe("Network error. Check your connection and try again.");
    expect(accountError(new Error("boom"))).toBe("boom");
    expect(accountError("?")).toBe("Could not create the login");
  });
  it("createAccount creates the Auth user; rollback deletes it again", async () => {
    const a = await createAccount(" new.teacher@school.test ");
    expect(authAccounts.get("new.teacher@school.test")).toBe(a.uid);
    await a.rollback();
    expect(authAccounts.has("new.teacher@school.test")).toBe(false);
  });
  it("createAccount rejects an email that already has a login", async () => {
    authAccounts.set("taken@school.test", "uid_x");
    await expect(createAccount("taken@school.test")).rejects.toMatchObject({ code: "auth/email-already-in-use" });
  });
  it("sendInvite sends the password-reset email to the trimmed address", async () => {
    await sendInvite("  t@school.test ");
    expect(sentInvites).toEqual(["t@school.test"]);
  });
});
