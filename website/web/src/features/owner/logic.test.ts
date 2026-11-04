import { describe, expect, it } from "vitest";
import { fromLead, generatePassword, mergeSchools, ownerStats, schoolsByMonth, validateNewSchool, type NewSchoolInput } from "./logic";

const ok: NewSchoolInput = { name: "Greenfield", city: "Kochi", board: "CBSE", plan: "Trial", phone: "+91 98470 00000", adminName: "Asha", adminEmail: "asha@gf.test", password: "secret123" };

describe("mergeSchools", () => {
  it("lists self-signed-up schools (admin login only) and console-added schools (platform doc)", () => {
    const rows = mergeSchools(
      [{ id: "s1", schoolId: "s1", role: "admin", email: "a@one.test", name: "One", createdAt: "2026-10-01" },
        { id: "t1", schoolId: "s1", role: "teacher", email: "t@one.test" },
        { id: "x2", schoolId: "s2", role: "admin", email: "office@two.test", createdAt: "2026-11-02" },
        { id: "s2", schoolId: "s2", role: "admin", email: "principal@two.test", createdAt: "2026-11-01" }],
      [{ id: "s2", name: "Two School", status: "suspended", plan: "Premium", reason: "unpaid", createdAt: "2026-11-01T10:00:00Z" },
        { id: "s3", name: "Three", status: "active", adminEmail: "a@three.test", createdAt: "2026-09-01" }],
      { s1: { name: "One Public School", city: "Kochi", setupComplete: true, exists: true } },
      { s1: { students: 120, staff: 14, classes: 6 } },
    );
    expect(rows.map((r) => r.id)).toEqual(["s2", "s1", "s3"]);
    const [two, one, three] = rows;
    expect(two).toMatchObject({ name: "Two School", status: "suspended", plan: "Premium", reason: "unpaid", registered: true, adminEmail: "principal@two.test", setupComplete: null });
    expect(two!.admins).toHaveLength(2);
    expect(one).toMatchObject({ name: "One Public School", city: "Kochi", status: "active", registered: false, adminEmail: "a@one.test", setupComplete: true, counts: { students: 120, staff: 14, classes: 6 } });
    expect(one!.admins).toHaveLength(1); // the teacher is not an admin
    expect(three).toMatchObject({ adminEmail: "a@three.test", admins: [] });
  });
});

describe("ownerStats / schoolsByMonth", () => {
  const rows = mergeSchools([], [
    { id: "a", status: "active", createdAt: "2026-11-02" }, { id: "b", status: "suspended", createdAt: "2026-10-20" }, { id: "c", createdAt: "2026-06-01" },
  ], { a: { exists: true, setupComplete: false }, b: { exists: true, setupComplete: true } }, { a: { students: 10, staff: 2, classes: 1 }, b: { students: 5, staff: 1, classes: 1 } });
  it("counts schools, people and the demo request pipeline", () => {
    expect(ownerStats(rows, [{ status: "new" }, { status: "new" }, { status: "contacted" }, { status: "converted" }, { status: "closed" }]))
      .toEqual({ schools: 3, active: 2, suspended: 1, setupPending: 1, students: 15, staff: 3, newLeads: 2, openLeads: 3, converted: 1 });
  });
  it("groups new schools by month, oldest first", () => {
    expect(schoolsByMonth(rows, 6, new Date(2026, 10, 4))).toEqual([
      { label: "Jun", value: 1 }, { label: "Jul", value: 0 }, { label: "Aug", value: 0 }, { label: "Sep", value: 0 }, { label: "Oct", value: 1 }, { label: "Nov", value: 1 },
    ]);
  });
});

describe("validateNewSchool", () => {
  it("accepts a complete school", () => { expect(validateNewSchool(ok)).toEqual({}); });
  it("explains each missing or invalid field", () => {
    expect(validateNewSchool({ ...ok, name: " ", adminName: "", adminEmail: "asha", password: "short", phone: "abc" })).toEqual({
      name: "Enter the school's name.", adminName: "Enter the admin's name.", adminEmail: "Enter a valid email. The admin signs in with it.",
      password: "Use at least 8 characters.", phone: "Enter a valid phone number.",
    });
  });
  it("allows an empty phone", () => { expect(validateNewSchool({ ...ok, phone: "" })).toEqual({}); });
});

describe("generatePassword", () => {
  it("is 12 characters with an upper case letter, a lower case letter and a digit, without look-alikes", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[2-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});

it("prefills a school from a demo request", () => {
  expect(fromLead({ name: "Asha", school: "Greenfield", email: "asha@gf.test", phone: "+91 1" })).toEqual({ name: "Greenfield", adminName: "Asha", adminEmail: "asha@gf.test", phone: "+91 1" });
});
