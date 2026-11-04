import { describe, expect, it } from "vitest";
import { KEEP, academicYearOf, bootstrapSchool, starterRow } from "./bootstrap";
import { getRow, rowsOf, writes } from "@/test/render";
import { seed as demo } from "@/server/seed";

// transactional or per-person data a new school must never inherit from the demo seed
const TRANSACTIONAL = [
  "adm_enquiries", "adm_applications", "adm_offers", "adm_slots", "adm_reenrolment", "adm_messages", "students", "staff", "classes", "assignments",
  "ops_periods", "ops_attendance", "ops_homework", "ops_substitutions", "exm_cycles", "exm_papers", "exm_candidates", "exm_marks", "fee_invoices",
  "fee_payments", "fee_structure", "com_notices", "calendar_events", "approvals", "staff_leaves", "student_leaves", "notifications", "set_terms",
  "set_sections", "set_audit", "set_exceptions", "dash_alerts", "tr_buses", "users", "onb_data",
];

describe("bootstrap KEEP list", () => {
  it("holds only configuration collections, each present in the seed", () => {
    for (const c of KEEP) expect(TRANSACTIONAL).not.toContain(c);
    for (const c of KEEP) expect(demo[c], c).toBeDefined();
    expect(new Set(KEEP).size).toBe(KEEP.length);
  });
  it("academicYearOf follows April–March", () => {
    expect(academicYearOf(new Date("2026-11-03"))).toBe("2026-27");
    expect(academicYearOf(new Date("2027-01-15"))).toBe("2026-27");
    expect(academicYearOf(new Date("2027-04-02"))).toBe("2027-28");
  });
});

describe("starterRow", () => {
  const now = new Date("2026-11-03T10:00:00");
  it("replaces the demo school's identity, people and counters", () => {
    const profile = starterRow("set_config", { id: "profile", name: "Greenfield International School", email: "x@greenfield.edu.in", phone: "+91", seal: "a.png" }, 0, "Sunrise Academy", "me@sunrise.in", "2026-27", now);
    expect(profile).toMatchObject({ name: "Sunrise Academy", email: "me@sunrise.in", phone: "", seal: "" });
    expect(starterRow("set_config", { id: "meta", academicYear: "2020-21", rolledOver: true }, 0, "S", "e", "2026-27", now)).toMatchObject({ academicYear: "2026-27", rolledOver: false });
    const form = starterRow("adm_form", { id: "form", name: "CBSE AY 2026–27 Admission Form", version: 4, publishedBy: "Dr. Rajiv Sharma", history: [{ version: 4 }] }, 0, "Sunrise Academy", "e", "2026-27", now);
    expect(form).toMatchObject({ name: "Sunrise Academy Admission Form · AY 2026-27", version: 1, publishedBy: "Setup", history: [{ version: 1, by: "Setup" }] });
    expect(starterRow("com_templates", { id: "t", body: "Greenfield Int. informs you" }, 0, "Sunrise", "e", "2026-27", now).body).toBe("Sunrise informs you");
    expect(starterRow("adm_campaign", { id: "campaign", noticesSent: 214 }, 0, "S", "e", "2026-27", now)).toMatchObject({ name: "AY 2026-27 Re-enrolment Drive", opensAt: "2026-11-03", closesAt: "2027-01-02", noticesSent: 0 });
    expect(starterRow("adm_config", { id: "config", appFee: 2500, stats: { scansToday: 68 } }, 0, "S", "e", "2026-27", now)).toMatchObject({ appFee: 2500, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0 } });
    expect(starterRow("setup_steps", { id: "step_1", done: true, doneAt: "2026-01-01" }, 0, "S", "e", "2026-27", now)).toMatchObject({ done: false, doneAt: "" });
    expect(starterRow("dash_stats", { id: "main", enquiries: 420, feesToday: 9 }, 0, "S", "e", "2026-27", now)).toMatchObject({ enquiries: 0, feesToday: 0 });
    expect(starterRow("me_prefs", { id: "me", signature: "R.Sharma", mfaDevice: "Key" }, 0, "S", "e", "2026-27", now)).toMatchObject({ signature: "", mfaDevice: "", term: "AY 2026-27" });
  });
  it("orders rows like the seed (_o descending)", () => {
    expect(starterRow("set_roles", { id: "a" }, 0, "S", "e", "x")._o).toBeGreaterThan(starterRow("set_roles", { id: "b" }, 1, "S", "e", "x")._o as number);
  });
});

describe("bootstrapSchool", () => {
  it("writes users/{uid}, the starter config, school/school and finally the onboarding marker", async () => {
    await bootstrapSchool("uid_new", "Sunrise Academy", "me@sunrise.in");
    expect(getRow("users", "uid_new")).toMatchObject({ schoolId: "uid_new", role: "admin", email: "me@sunrise.in", name: "Sunrise Academy" });
    expect(getRow("school", "school")).toMatchObject({ name: "Sunrise Academy", short: "Sunrise Academy", board: "CBSE", academicYear: academicYearOf(), term: "Term 1" });
    expect(getRow("onboarding", "state")).toEqual({ id: "state", complete: false, completed: [] });
    expect(writes[writes.length - 1]).toMatchObject({ coll: "onboarding", id: "state" });
    const touched = new Set(writes.map((w) => w.coll));
    for (const c of touched) expect([...KEEP, "users", "school", "me", "notifications", "onboarding"]).toContain(c);
    for (const c of TRANSACTIONAL.filter((c) => c !== "users" && c !== "notifications")) expect(rowsOf(c), c).toHaveLength(0);
    expect(rowsOf("set_roles").length).toBe(demo.set_roles!.length);
    expect(JSON.stringify(rowsOf("com_templates"))).not.toContain("Greenfield");
  });
  it("does nothing beyond users/{uid} when the school is already bootstrapped", async () => {
    await bootstrapSchool("uid_new", "Sunrise Academy", "me@sunrise.in");
    const n = writes.length;
    await bootstrapSchool("uid_new", "Sunrise Academy", "me@sunrise.in");
    expect(writes.slice(n).map((w) => w.coll)).toEqual(["users"]);
  });
});
