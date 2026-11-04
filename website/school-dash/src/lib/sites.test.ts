import { describe, expect, it } from "vitest";
import { schoolConsoleUrl, selectedSchool, siteUrls } from "./sites";
import { allowed } from "@/components/AuthGuard";
import { passwordErrors } from "./password";

describe("independent frontend sites", () => {
  it("uses separate local app ports", () => {
    expect(siteUrls({ protocol: "http:", hostname: "localhost", port: "3000" })).toEqual({
      admin: "http://localhost:3000", owner: "http://localhost:3002", landing: "http://localhost:3001",
    });
  });
  it("uses production hosting sites away from localhost", () => {
    expect(siteUrls({ protocol: "https:", hostname: "edvio-owner.web.app", port: "" })).toEqual({
      admin: "https://school-admin-tatos-2610.web.app", owner: "https://edvio-owner.web.app", landing: "https://edvio-landing.web.app",
    });
  });
  it("passes only a school id to the admin app", () => {
    expect(schoolConsoleUrl("school_123")).toBe("http://localhost:3000/dashboard?school=school_123");
    expect(selectedSchool("?school=school_123")).toBe("school_123");
    expect(selectedSchool("?school=../other")).toBe("");
    expect(selectedSchool("?school=https://example.test")).toBe("");
    expect(selectedSchool("?school=")).toBe("");
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
