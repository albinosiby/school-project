import { describe, expect, it } from "vitest";
import { audienceCount, audienceReach, dueScheduled, gradeLabel, gradeOfLabel, pct1, reachLabel, statusOf, validateNotice, type NoticeForm } from "./logic";
import { AUDIENCES } from "./types";

describe("audienceReach (same tests as functions/index.js, functions/parent.js and the driver app)", () => {
  it("every composer audience reaches the right apps", () => {
    expect(audienceReach("All School")).toEqual({ staff: true, parents: true, crew: true });
    expect(audienceReach("Parents by Grade")).toEqual({ staff: false, parents: true, crew: false });
    expect(audienceReach("Staff & Teachers")).toEqual({ staff: true, parents: false, crew: true });
    expect(audienceReach("Transport Routes")).toEqual({ staff: false, parents: false, crew: true });
  });
  it("labels the reach", () => {
    expect(reachLabel("Parents by Grade")).toBe("Shown in: Parent app");
    expect(reachLabel("Board members")).toBe("Not shown in any app");
  });
  it("the stored audience strings are exactly the four labels", () => {
    expect(AUDIENCES.map((a) => a.label)).toEqual(["All School", "Parents by Grade", "Staff & Teachers", "Transport Routes"]);
  });
});

describe("audienceCount", () => {
  const ctx = {
    students: [{ id: "s1", grade: "8", status: "Active", busId: "bus_01" }, { id: "s2", grade: "9", status: "Active" }, { id: "s3", grade: "8" }, { id: "s4", grade: "8", status: "Transferred", busId: "bus_01" }],
    staff: [{ id: "t1", status: "Active" }, { id: "t2", status: "On leave" }, { id: "t3", status: "Left" }],
    crew: [{ id: "c1", status: "Active" }, { id: "c2", status: "Inactive" }],
  };
  it("counts active students and staff only", () => {
    expect(audienceCount("All School", ctx)).toBe(5);
    expect(audienceCount("Staff & Teachers", ctx)).toBe(2);
    expect(audienceCount("Transport Routes", ctx)).toBe(2);
    expect(audienceCount("Unknown", ctx)).toBe(0);
  });
  it("Parents by Grade counts the chosen grades (labels or bare grades), all when none chosen", () => {
    expect(audienceCount("Parents by Grade", ctx, ["Grade 8"])).toBe(2);
    expect(audienceCount("Parents by Grade", ctx, ["Grade 8", "9"])).toBe(3);
    expect(audienceCount("Parents by Grade", ctx, [])).toBe(3);
    expect(audienceCount("Parents by Grade", { students: [], staff: [] }, ["Grade 8"])).toBe(0);
  });
  it("grade labels match what the parent app compares ('Grade 8')", () => {
    expect(gradeLabel("8")).toBe("Grade 8");
    expect(gradeOfLabel("Grade 10")).toBe("10");
    expect(gradeOfLabel("Grade 8-A")).toBe("8");
  });
});

describe("validateNotice", () => {
  const now = Date.parse("2026-11-03T10:00:00");
  const f: NoticeForm = { title: "PTM", body: "Saturday 10am", audience: "All School", grades: [], channels: ["Mobile App"], when: "" };
  it("a valid send and a valid draft", () => {
    expect(validateNotice(f, "now", now)).toEqual({});
    expect(validateNotice({ ...f, body: "", channels: [] }, "draft", now)).toEqual({});
  });
  it("title always; body and channels unless draft", () => {
    expect(validateNotice({ ...f, title: " ", body: " ", channels: [] }, "now", now)).toEqual({
      title: "Title is required", body: "Message body is required", channels: "Select at least one channel" });
    expect(validateNotice({ ...f, title: "" }, "draft", now)).toEqual({ title: "Title is required" });
  });
  it("audience must be one of the known strings; Parents by Grade needs a grade", () => {
    expect(validateNotice({ ...f, audience: "" }, "draft", now)).toEqual({ audience: "Choose an audience" });
    expect(validateNotice({ ...f, audience: "Parents by Grade" }, "now", now)).toEqual({ grades: "Select at least one grade" });
    expect(validateNotice({ ...f, audience: "Parents by Grade", grades: ["Grade 8"] }, "now", now)).toEqual({});
  });
  it("schedule needs a time in the future", () => {
    expect(validateNotice(f, "schedule", now).when).toBe("Pick a future date and time");
    expect(validateNotice({ ...f, when: "2026-11-03T09:59" }, "schedule", now).when).toBe("Pick a future date and time");
    expect(validateNotice({ ...f, when: "2026-11-03T10:00" }, "schedule", now).when).toBe("Pick a future date and time");
    expect(validateNotice({ ...f, when: "2026-11-03T10:01" }, "schedule", now)).toEqual({});
  });
  it("status strings are the ones the functions match on", () => {
    expect([statusOf("now"), statusOf("schedule"), statusOf("draft")]).toEqual(["Published", "Scheduled", "Draft"]);
  });
});

describe("dueScheduled / pct1", () => {
  it("only Scheduled notices whose time has passed", () => {
    const now = Date.parse("2026-11-03T10:00:00Z");
    const rows = [
      { id: "due", status: "Scheduled" as const, sentAt: "2026-11-03T09:00:00Z" },
      { id: "exact", status: "Scheduled" as const, sentAt: "2026-11-03T10:00:00Z" },
      { id: "later", status: "Scheduled" as const, sentAt: "2026-11-04T09:00:00Z" },
      { id: "pub", status: "Published" as const, sentAt: "2026-11-01T09:00:00Z" },
      { id: "bad", status: "Scheduled" as const, sentAt: "soon" },
    ];
    expect(dueScheduled(rows, now).map((r) => r.id)).toEqual(["due", "exact"]);
  });
  it("pct1 rounds to one decimal and is 0 for 0 recipients", () => {
    expect(pct1(1, 3)).toBe(33.3);
    expect(pct1(5, 0)).toBe(0);
  });
});
