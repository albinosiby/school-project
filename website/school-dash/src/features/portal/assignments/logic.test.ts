import { describe, expect, it } from "vitest";
import {
  assignmentBoard, assignmentItems, cardLine, dueLabel, emptyForm, formFields, formOf, gradeSubmission, gradingPatch, groupActive, homeworkStats, liveSubmissions,
  markAllIn, markOnPaper, newAssignment, nextToGrade, ownHomework, splitBySize, statusOnSave, timeline, toggledStatus, validateAssignment, type Homework,
} from "./logic";

const NOW = new Date(2026, 10, 23, 12, 0); // Mon 23 Nov 2026, local
const TODAY = "2026-11-23";
const roster = [{ id: "s1", name: "Aarav", roll: 1 }, { id: "s2", name: "Bina", roll: 2 }, { id: "s3", name: "Chen", roll: 3 }];
const hw = (id: string, extra: Partial<Homework> = {}): Homework => ({ id, classId: "cls_10B", title: id, subject: "Maths", due: TODAY, maxMarks: 20, status: "open", teacherId: "t", ...extra });

describe("submissions (HomeworkAdapter.build / write)", () => {
  it("starts every roster student pending when the homework has no entries yet", () => {
    expect(liveSubmissions({}, ["s1", "s2"])).toEqual({ s1: { status: "pending", feedback: "" }, s2: { status: "pending", feedback: "" } });
  });
  it("merges parent hand-ins: an ungraded entry becomes submitted, a graded one stays graded", () => {
    const hi = { files: [{ name: "p.jpg" }], note: "n", submittedAt: "2026-11-23T05:00:00.000Z", late: true };
    const subs = liveSubmissions({ submissions: { s1: { status: "pending", feedback: "" }, s2: { status: "graded", feedback: "ok", marks: 9 } }, handins: { s1: hi, s2: hi, s9: null } }, []);
    expect(subs.s1).toEqual({ status: "submitted", feedback: "", handin: hi });
    expect(subs.s2).toMatchObject({ status: "graded", marks: 9, handin: hi });
    expect(subs.s9).toBeUndefined();
  });
  it("never writes the hand-in copy back, and recounts submitted / total", () => {
    const subs = liveSubmissions({ submissions: { s1: { status: "pending", feedback: "" }, s2: { status: "pending", feedback: "" } }, handins: { s1: { files: [] } } }, []);
    expect(gradingPatch(subs)).toEqual({ submissions: { s1: { status: "submitted", feedback: "" }, s2: { status: "pending", feedback: "" } }, submitted: 1, total: 2 });
  });
  it("grades like HomeworkGradeSaved: gradedAt, gradedBy, previousMarks on a re-grade, no marks when not graded", () => {
    const g = gradeSubmission({ status: "submitted", feedback: "", late: true }, { marks: 7, feedback: " Neat ", by: "Anita", now: "N1" });
    expect(g).toEqual({ status: "graded", feedback: "Neat", marks: 7, gradedAt: "N1", gradedBy: "Anita", late: true });
    expect(gradeSubmission(g, { marks: 9, feedback: "x", by: "Anita", now: "N2" })).toMatchObject({ marks: 9, previousMarks: 7, gradedAt: "N2" });
    expect(gradeSubmission({ status: "submitted", feedback: "" }, { feedback: "", by: "Anita", now: "N" })).toEqual({ status: "graded", feedback: "", gradedAt: "N", gradedBy: "Anita" });
  });
  it("marks on paper and back, and all pending students handed in", () => {
    expect(markOnPaper({ status: "pending", feedback: "f", marks: 3 }, true)).toEqual({ status: "submitted", feedback: "f", marks: 3 });
    expect(markOnPaper({ status: "graded", feedback: "f", marks: 3, gradedAt: "x", gradedBy: "A", previousMarks: 2 }, false)).toEqual({ status: "pending", feedback: "", previousMarks: 2 });
    expect(markAllIn({ s1: { status: "graded", feedback: "", marks: 1 }, s2: { status: "pending", feedback: "" } }, ["s1", "s2", "s3"]))
      .toEqual({ s1: { status: "graded", feedback: "", marks: 1 }, s2: { status: "submitted", feedback: "" }, s3: { status: "submitted", feedback: "" } });
  });
  it("toggles closed → open, scheduled → open (publish now), open → closed", () => {
    expect([toggledStatus("closed"), toggledStatus("scheduled"), toggledStatus("open"), toggledStatus("Published"), toggledStatus("Completed")]).toEqual(["open", "open", "closed", "closed", "open"]);
  });
});

describe("figures (HomeworkStats)", () => {
  const h = hw("a", {
    submissions: { s1: { status: "pending", feedback: "" }, s2: { status: "graded", feedback: "", marks: 19 }, s3: { status: "graded", feedback: "", marks: 7 }, s9: { status: "submitted", feedback: "" } },
    handins: { s1: { files: [{ name: "x" }], late: true } },
  });
  const st = homeworkStats(h, roster, [...roster, { id: "s9", name: "Moved away", roll: 4 }]);
  it("counts hand-ins, grades, late and parent uploads over the roster plus other submissions", () => {
    expect(st.rows.map((r) => r.name)).toEqual(["Aarav", "Bina", "Chen", "Moved away"]);
    expect({ total: st.total, graded: st.graded, toGrade: st.toGrade, turnedIn: st.turnedIn, notSubmitted: st.notSubmitted, late: st.late, uploaded: st.uploaded })
      .toEqual({ total: 4, graded: 2, toGrade: 2, turnedIn: 4, notSubmitted: 0, late: 1, uploaded: 1 });
    expect(st.avg).toBe(13);
    expect(st.bands).toEqual([1, 0, 0, 0, 1]);
  });
  it("finds the next paper to grade, wrapping, null when it is the only one", () => {
    expect(nextToGrade(st.rows)?.id).toBe("s1");
    expect(nextToGrade(st.rows, "s1")?.id).toBe("s9");
    expect(nextToGrade(st.rows, "s9")?.id).toBe("s1");
    expect(nextToGrade(st.rows.filter((r) => r.id !== "s9"), "s1")).toBeNull();
  });
});

describe("the list page", () => {
  const rows = [
    hw("today", { submissions: { s1: { status: "submitted", feedback: "" } } }), hw("over", { due: "2026-11-20", submissions: { s1: { status: "submitted", feedback: "", late: true }, s2: { status: "submitted", feedback: "" } } }),
    hw("week", { due: "2026-11-27" }), hw("later", { due: "2026-12-20", status: "Published" }),
    hw("sched", { status: "scheduled", publishAt: "2026-11-25T02:30:00.000Z", due: "2026-11-28", submissions: { s1: { status: "submitted", feedback: "" } } }),
    hw("draft", { status: "Draft" }), hw("closed", { status: "Completed", due: "2026-11-01" }),
  ];
  const items = assignmentItems(rows, () => roster);
  const board = assignmentBoard(items, TODAY);
  it("splits into tabs and the hero figures; scheduled hand-ins do not count", () => {
    expect(Object.fromEntries(Object.entries(board.lists).map(([k, v]) => [k, v.map((a) => a.hw.id)]))).toEqual({
      active: ["over", "today", "week", "later"], review: ["over", "today"], upcoming: ["sched", "draft"], closed: ["closed"],
    });
    expect({ toReview: board.toReview, dueWeek: board.dueWeek, late: board.late, active: board.active }).toEqual({ toReview: 3, dueWeek: 2, late: 1, active: 4 });
  });
  it("groups active work by due day and labels the cards", () => {
    expect(groupActive(board.lists.active, TODAY).map((g) => [g.group, g.items.map((a) => a.hw.id)])).toEqual([["Overdue", ["over"]], ["Due today", ["today"]], ["This week", ["week"]], ["Later", ["later"]]]);
    const by = (id: string) => items.find((a) => a.hw.id === id)!;
    expect(cardLine(by("draft"), TODAY)).toBe("Draft — not published");
    expect(cardLine(by("sched"), TODAY)).toMatch(/^Publishes 25 Nov, \d+:\d\d (AM|PM)$/);
    expect(cardLine(by("closed"), TODAY)).toBe("Closed");
    expect([dueLabel("2026-11-24", TODAY), dueLabel("2026-11-22", TODAY), dueLabel("2026-11-20", TODAY), dueLabel("2026-11-30", TODAY), dueLabel("", TODAY)])
      .toEqual(["Due tomorrow", "Overdue by 1 day", "Overdue by 3 days", "Due Mon, 30 Nov", "No due date"]);
  });
  it("lists own, not deleted homework newest first", () => {
    expect(ownHomework([hw("x", { createdAt: "2026-11-01" }), hw("y", { createdAt: "2026-11-05" }), hw("z", { deleted: true }), hw("o", { teacherId: "other" })], "t").map((h) => h.id)).toEqual(["y", "x"]);
  });
});

describe("the form (new_homework_screen.dart)", () => {
  const ok = { ...emptyForm(NOW, "cls_10B"), subject: "Maths", title: "Fractions" };
  const ctx = { subjects: ["Maths"], now: NOW, editing: false };
  it("defaults to due tomorrow, 10 marks, late hand-ins on, tomorrow 8 AM when scheduled", () => {
    expect(emptyForm(NOW, "cls_10B")).toMatchObject({ due: "2026-11-24", maxMarks: "10", graded: true, allowLate: true, schedule: false, publishAt: "2026-11-24T08:00" });
  });
  it("validates with the app's messages", () => {
    expect(validateAssignment(ok, ctx)).toEqual({});
    expect(validateAssignment({ ...ok, title: "ab", maxMarks: "0" }, ctx)).toEqual({ title: "Give the assignment a title (at least 3 characters)", maxMarks: "Enter marks from 1 to 1000" });
    expect(validateAssignment({ ...ok, graded: false, maxMarks: "" }, ctx)).toEqual({});
    expect(validateAssignment({ ...ok, schedule: true, publishAt: "2026-11-23T11:00" }, ctx)).toEqual({ publishAt: "Pick a publish time in the future" });
    expect(validateAssignment({ ...ok, schedule: true, publishAt: "2026-11-25T08:00" }, ctx)).toEqual({ publishAt: "Publish on or before the due day" });
    expect(validateAssignment({ ...ok, schedule: true, publishAt: "2026-11-24T23:00" }, ctx)).toEqual({});
    expect(validateAssignment({ ...ok, subject: "Art", due: "2026-11-20" }, ctx)).toEqual({ subject: "Pick a subject you teach in this class", due: "Pick a due date from today on" });
    expect(validateAssignment({ ...ok, due: "2026-11-20" }, { ...ctx, editing: true })).toEqual({});
  });
  it("shows the reminder 2 days before the due day only when it comes after publishing", () => {
    expect(timeline({ ...ok, due: "2026-11-30" }, TODAY).map((s) => s.title)).toEqual(["Published now", "Reminder", "Due"]);
    expect(timeline({ ...ok, due: "2026-11-30" }, TODAY)[1]!.detail).toBe("Sat, 28 Nov, 8 AM • only to those not handed in");
    expect(timeline({ ...ok, due: "2026-11-25" }, TODAY)[1]!.title).toBe("Reminder"); // reminder today, published now
    expect(timeline({ ...ok, due: "2026-11-24" }, TODAY)[1]!.title).toBe("No reminder");
    expect(timeline({ ...ok, due: "2026-11-27", schedule: true, publishAt: "2026-11-25T09:00" }, TODAY)[1]!.title).toBe("No reminder");
  });
  it("builds the app's document: roster pending, maxMarks 0 when not graded, publishAt in UTC when scheduled", () => {
    const f = { ...ok, title: " Fractions ", description: " d ", graded: false, allowLate: false, schedule: true, publishAt: "2026-11-24T08:00", attachments: [{ name: "a.pdf", size: "", kind: "file", url: "u", path: "p", contentType: "application/pdf", bytes: 3 }] };
    expect(newAssignment(f, { staffId: "stf_1", teacherName: "Anita", rosterIds: ["s1"], now: NOW })).toEqual({
      classId: "cls_10B", grade: "10", section: "B", title: "Fractions", subject: "Maths", due: "2026-11-24", maxMarks: 0, description: "d", status: "scheduled",
      allowLate: false, attachments: f.attachments, publishAt: new Date(2026, 10, 24, 8, 0).toISOString(), createdAt: NOW.toISOString(), assigned: TODAY, teacher: "Anita",
      submissions: { s1: { status: "pending", feedback: "" } }, submitted: 0, total: 1, teacherId: "stf_1",
    });
  });
  it("fills from an assignment and keeps a closed one closed", () => {
    const h = hw("a", { maxMarks: 0, allowLate: false, status: "closed", description: "d", due: "2026-11-30", attachments: [{ name: "x" }] });
    const f = formOf(h, NOW);
    expect(f).toMatchObject({ graded: false, maxMarks: "10", allowLate: false, schedule: false, due: "2026-11-30", attachments: [{ name: "x" }], title: "a" });
    expect(formFields(f, h)).toEqual({ title: "a", subject: "Maths", due: "2026-11-30", maxMarks: 0, description: "d", status: "closed", allowLate: false, attachments: [{ name: "x" }] });
    expect([statusOnSave({ schedule: false }), statusOnSave({ schedule: false }, { status: "scheduled" }), statusOnSave({ schedule: true }, { status: "open" }), statusOnSave({ schedule: false }, { status: "Published" })])
      .toEqual(["open", "open", "scheduled", "open"]);
    expect(formOf(hw("b", {}), NOW).maxMarks).toBe("20");
  });
  it("skips files over 15 MB", () => {
    expect(splitBySize([{ size: 15 * 1024 * 1024 }, { size: 15 * 1024 * 1024 + 1 }])).toEqual({ ok: [{ size: 15 * 1024 * 1024 }], skipped: 1 });
  });
});
