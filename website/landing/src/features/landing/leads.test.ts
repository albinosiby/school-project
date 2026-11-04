import { describe, expect, it } from "vitest";
import { getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { leadMailto, submitLead, validateLead } from "./leads";

const ok = { name: "Priya Nair", school: "Sunrise Public School", email: "priya@sunrise.edu", phone: "+91 98765 43210", message: "1,200 students" };

describe("validateLead", () => {
  it("accepts a complete request and an empty phone / message", () => {
    expect(validateLead(ok)).toEqual({});
    expect(validateLead({ ...ok, phone: "", message: "" })).toEqual({});
  });
  it("names the field with the exact message", () => {
    expect(validateLead({ ...ok, name: " " })).toEqual({ name: "Enter your name." });
    expect(validateLead({ ...ok, school: "A" })).toEqual({ school: "Enter your school's name." });
    expect(validateLead({ ...ok, email: "priya@" })).toEqual({ email: "Enter a valid email address." });
    expect(validateLead({ ...ok, phone: "abc" })).toEqual({ phone: "Enter a valid phone number." });
    expect(validateLead({ ...ok, message: "x".repeat(2001) })).toEqual({ message: "Keep this under 2000 characters." });
  });
});

describe("submitLead", () => {
  it("writes leads/{autoId} with the contract's keys, trimmed, source landing, status new", async () => {
    const id = await submitLead({ ...ok, name: "  Priya Nair ", message: " hi " });
    expect(id).toBeTruthy();
    const rows = (await getDocs(collection(db, "leads"))).docs.map((d) => d.data() as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    const { createdAt, ...rest } = rows[0];
    expect(createdAt).toBeTruthy();
    expect(rest).toEqual({ name: "Priya Nair", school: ok.school, email: ok.email, phone: ok.phone, message: "hi", source: "landing", status: "new" });
  });
});

describe("leadMailto", () => {
  it("carries the same details to the contact address", () => {
    const m = leadMailto("info@example.com", ok);
    expect(m.startsWith("mailto:info@example.com?subject=Demo%20request%20%C2%B7%20Sunrise%20Public%20School&body=")).toBe(true);
    expect(decodeURIComponent(m.split("&body=")[1])).toContain("Email: priya@sunrise.edu");
  });
});
