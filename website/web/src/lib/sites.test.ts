import { describe, expect, it } from "vitest";
import { isOwnerHost, pathSite, siteUrls } from "./sites";
import { allowed } from "@/components/AuthGuard";
import { passwordErrors } from "./password";

describe("two hosting sites", () => {
  it("knows the owner site by its host name", () => {
    expect(isOwnerHost("edvio-owner.web.app")).toBe(true);
    expect(isOwnerHost("edvio-owner.firebaseapp.com")).toBe(true);
    expect(isOwnerHost("owner.localhost")).toBe(true);
    expect(isOwnerHost("school-admin-tatos-2610.web.app")).toBe(false);
    expect(isOwnerHost("localhost")).toBe(false);
  });
  it("links both sites, keeping the port locally", () => {
    expect(siteUrls({ protocol: "http:", hostname: "localhost", port: "3005" })).toEqual({ owner: "http://owner.localhost:3005", admin: "http://localhost:3005" });
    expect(siteUrls({ protocol: "https:", hostname: "edvio-owner.web.app", port: "" })).toEqual({ owner: "https://edvio-owner.web.app", admin: "https://school-admin-tatos-2610.web.app" });
  });
  it("keeps the owner console on the owner site and the landing page and sign-up on the admin site", () => {
    expect(pathSite("/owner")).toBe("owner");
    expect(pathSite("/owner/schools/abc")).toBe("owner");
    expect(pathSite("/owners")).toBe("both");
    expect(pathSite("/landing")).toBe("admin");
    expect(pathSite("/signup")).toBe("admin");
    expect(pathSite("/login")).toBe("both");
    expect(pathSite("/students")).toBe("both");
  });
});

describe("AuthGuard roles", () => {
  it("lets an owner into the school console only while inside a school", () => {
    expect(allowed({ role: "owner", schoolId: "" }, "owner")).toBe(true);
    expect(allowed({ role: "owner", schoolId: "" }, "admin")).toBe(false);
    expect(allowed({ role: "owner", schoolId: "s1" }, "admin")).toBe(true);
    expect(allowed({ role: "admin", schoolId: "s1" }, "admin")).toBe(true);
    expect(allowed({ role: "admin", schoolId: "s1" }, "owner")).toBe(false);
  });
});

describe("change password form", () => {
  it("checks the current password, length, reuse and confirmation", () => {
    expect(passwordErrors({ current: "", next: "short", confirm: "x" })).toEqual({ current: "Enter your current password.", next: "Use at least 8 characters.", confirm: "The two new passwords do not match." });
    expect(passwordErrors({ current: "samesame1", next: "samesame1", confirm: "samesame1" })).toEqual({ next: "Choose a password you have not used here." });
    expect(passwordErrors({ current: "old-pass", next: "new-pass-1", confirm: "new-pass-1" })).toEqual({});
  });
});
