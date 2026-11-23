import { describe, expect, it } from "vitest";
import type { SheetComponents } from "@/features/exams/sheets";
import type { Candidate, Paper } from "@/features/exams/types";
import {
  draftOf, legacyAllocations, liveClassDoc, liveFormErrors, livePhase, markDraftError, markEntryState, messageDoc, messageableStudents, myClassIds, myDuties,
  normalizeMeetLink, numericComponents, paperCandidates, sheetMarkDoc, sheetMarkPatch, sheetRoster, sheetSubmitProblem, subjectsFor, threadDoc, threadRole, type PortalMark,
} from "./exams";

const marks: SheetComponents = { mode: "marks", theory: 80, practical: 0, internal: 20, passMarks: 33, gradeOptions: [] };
const grade: SheetComponents = { mode: "grade", theory: 0, practical: 0, internal: 0, passMarks: 0, gradeOptions: ["A", "B", "C"] };
const sheet = { paperId: "p1", classId: "cls_10B", components: marks, rosterIds: ["s1", "s2"] };
const mark = (patch: Partial<PortalMark>): PortalMark => ({
  id: "p1__cand_s1", paperId: "p1", candId: "cand_s1", studentId: "s1", classId: "cls_10B", theory: null, practical: null, internal: null, gradeValue: "",
  status: "Present", tag: "", note: "", teacherId: "stf_1", enteredAt: "", ...patch,
});

describe("marks helpers", () => {
  it("lists only the components with a maximum, in entry order", () => {
    expect(numericComponents(marks).map((c) => c.key)).toEqual(["theory", "internal"]);
    expect(numericComponents({ theory: 70, practical: 30, internal: 0 }).map((c) => `${c.label} ${c.max}`)).toEqual(["Theory 70", "Practical 30"]);
  });
  it("validates a draft against the sheet's maxima and grade options", () => {
    expect(markDraftError(marks, { ...draftOf(), theory: 80, internal: 20 })).toBe("");
    expect(markDraftError(marks, { ...draftOf(), theory: 81 })).toBe("Theory marks must be between 0 and 80");
    expect(markDraftError(marks, { ...draftOf(), internal: 2.5 })).toBe("Internal marks must be a whole number");
    expect(markDraftError(grade, { ...draftOf(), gradeValue: "A" })).toBe("");
    expect(markDraftError(grade, { ...draftOf(), gradeValue: "Z" })).toBe("Pick a grade from the sheet's options");
  });
  it("builds the exm_marks document with the app's keys and clears components for non-present students", () => {
    const doc = sheetMarkDoc(sheet, "s1", "stf_1", { ...draftOf(), theory: 72, internal: 18, tag: "Consistent", note: "Neat work" }, "2026-11-21T10:00:00.000Z");
    expect(doc).toEqual({ paperId: "p1", candId: "cand_s1", studentId: "s1", classId: "cls_10B", theory: 72, practical: null, internal: 18, gradeValue: "",
      status: "Present", tag: "Consistent", note: "Neat work", teacherId: "stf_1", enteredAt: "2026-11-21T10:00:00.000Z" });
    expect(sheetMarkDoc(sheet, "s1", "stf_1", { ...draftOf(), theory: 72, internal: 18, status: "Absent" }, "t")).toMatchObject({ theory: null, internal: null, status: "Absent" });
    expect(sheetMarkDoc({ ...sheet, components: grade }, "s1", "stf_1", { ...draftOf(), gradeValue: "B", theory: 5 }, "t")).toMatchObject({ theory: null, gradeValue: "B" });
    expect(Object.keys(sheetMarkPatch(sheet, "s1", "stf_1", draftOf(), "t"))).toEqual(["theory", "practical", "internal", "gradeValue", "status", "tag", "note", "enteredAt"]);
  });
  it("derives the entry state and the submit problem like the teacher app", () => {
    expect(markEntryState(marks, undefined)).toBe("pending");
    expect(markEntryState(marks, mark({ theory: 70 }))).toBe("pending");
    expect(markEntryState(marks, mark({ theory: 70, internal: 15 }))).toBe("entered");
    expect(markEntryState(marks, mark({ theory: 90, internal: 15 }))).toBe("invalid");
    expect(markEntryState(marks, mark({ status: "Medical Slip" }))).toBe("absent");
    expect(markEntryState(grade, mark({ gradeValue: "A" }))).toBe("entered");
    const entered = new Map([["s1", mark({ theory: 70, internal: 15 })], ["s2", mark({ studentId: "s2", status: "Absent" })]]);
    expect(sheetSubmitProblem(sheet, entered)).toBeNull();
    expect(sheetSubmitProblem(sheet, new Map([["s1", mark({ theory: 99, internal: 15 })]]))).toBe("1 of 2 students still pending: enter every component or mark them Absent. 1 mark is out of range.");
  });
  it("builds the roster from candidates, then students, sorted by roll", () => {
    const cands = [{ id: "cand_s2", studentId: "s2", name: "Bina", roll: "#10B-02", grn: "G2", cls: "10-B", grade: "10", section: "B" }] as Candidate[];
    expect(sheetRoster(sheet, cands, [{ id: "s1", name: "Aarav", roll: 1, grn: "G1" }])).toEqual([
      { studentId: "s1", name: "Aarav", roll: "1", grn: "G1" }, { studentId: "s2", name: "Bina", roll: "#10B-02", grn: "G2" },
    ]);
  });
  it("lists allocated papers that have no sheet yet", () => {
    const papers = [
      { id: "p1", cycleId: "c1", grade: "10", subject: "Mathematics", classIds: ["cls_10B"] }, { id: "p2", cycleId: "c1", grade: "10", subject: "Mathematics", classIds: ["cls_10A"] },
      { id: "p3", cycleId: "c1", grade: "9", subject: "Science", evaluatorIds: { cls_9A: "stf_1" } }, { id: "p4", cycleId: "c1", grade: "10", subject: "Mathematics", classIds: ["cls_10B"], scheduleStatus: "Cancelled" },
    ] as Paper[];
    const out = legacyAllocations(papers, [{ teacherId: "stf_1", classId: "cls_10B", subject: "Maths" }], [{ paperId: "p1", classId: "cls_10B" }], "stf_1");
    expect(out).toEqual([{ paperId: "p3", classId: "cls_9A", subject: "Science" }]);
  });
});

describe("duty helpers", () => {
  const papers = [{ id: "p1", cycleId: "c1", grade: "10", subject: "Mathematics", code: "MAT", date: "2026-12-01", start: "09:00", duration: 3, venue: "Hall A", classIds: ["cls_10B"], invigilatorId: "stf_1" },
    { id: "p2", cycleId: "c1", grade: "9", subject: "Science", date: "2026-01-05", start: "10:30", duration: 2, venue: "Hall B", invigilatorId: "stf_1" }] as Paper[];
  it("merges exm_duties rows with chief papers, computes end / report times and the upcoming state", () => {
    const rows = myDuties([{ id: "dut_1", paperId: "p1", staffId: "stf_1", role: "Invigilator", hall: "Hall C" }, { id: "dut_x", paperId: "p1", staffId: "stf_2" }, { id: "dut_d", paperId: "p2", staffId: "stf_1", deleted: true }],
      papers, [{ id: "c1", short: "Annual" }], "stf_1", "2026-11-23");
    expect(rows.map((r) => r.id)).toEqual(["chief_p2", "dut_1"]);
    expect(rows[1]).toMatchObject({ paperId: "p1", code: "MAT", subject: "Mathematics", grade: "10", cycle: "Annual", date: "2026-12-01", start: "09:00", end: "12:00", hall: "Hall C", role: "Invigilator", classLabels: ["10-B"], report: "08:30", chief: false, status: "upcoming" });
    expect(rows[0]).toMatchObject({ id: "chief_p2", role: "Chief Invigilator", hall: "Hall B", end: "12:30", status: "completed", chief: true });
  });
  it("picks a paper's candidates by class label (else grade) in roll order", () => {
    const cands = [{ id: "cand_b", name: "B", roll: "#10B-02", cls: "10-B", grade: "10", section: "B" }, { id: "cand_a", name: "A", roll: "#10B-01", cls: "10-B", grade: "10", section: "B" }, { id: "cand_c", name: "C", roll: 1, cls: "10-A", grade: "10", section: "A" }] as Candidate[];
    expect(paperCandidates(papers[0], cands).map((c) => c.id)).toEqual(["cand_a", "cand_b"]);
    expect(paperCandidates({ grade: "10" }, cands).map((c) => c.id)).toEqual(["cand_c", "cand_a", "cand_b"]);
  });
});

describe("live class helpers", () => {
  it("normalizes Google Meet links", () => {
    expect(normalizeMeetLink("meet.google.com/ABC-defg-hij?x=1")).toBe("https://meet.google.com/abc-defg-hij");
    expect(normalizeMeetLink("https://meet.google.com/lookup/maths10b")).toBe("https://meet.google.com/lookup/maths10b");
    expect(normalizeMeetLink("https://zoom.us/j/1")).toBeNull();
  });
  it("validates the form and builds the live_classes document the app writes", () => {
    const form = { classId: "cls_10B", subject: "Mathematics", title: " Algebra ", date: "2026-11-25", time: "16:30", mins: 45, link: "meet.google.com/abc-defg-hij" };
    expect(liveFormErrors(form)).toEqual({});
    expect(liveFormErrors({ ...form, classId: "", title: "", link: "zoom", mins: 2 })).toEqual({ classId: "Pick a class", title: "Enter a title", link: "Use a Google Meet link like https://meet.google.com/abc-defg-hij", mins: "Duration must be 5 to 480 minutes" });
    expect(liveClassDoc(form, "Class 10-B", "now")).toEqual({ title: "Algebra", classId: "cls_10B", audience: "Class 10-B", subject: "Mathematics", category: "", date: "2026-11-25", time: "16:30", mins: 45, room: "",
      medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", record: true, mute: true, studentShare: false, notify: true, material: null, total: 0, tag: "", status: "upcoming", cohost: "",
      meetSpace: "", calendarEventId: "", calendarLink: "", calendarSync: false, createdAt: "now" });
  });
  it("derives the phase from the clock with the 10-minute join lead", () => {
    const row = { date: "2026-11-25", time: "16:30", mins: 45 };
    expect(livePhase(row, new Date("2026-11-25T16:00:00"))).toBe("scheduled");
    expect(livePhase(row, new Date("2026-11-25T16:21:00"))).toBe("open");
    expect(livePhase(row, new Date("2026-11-25T17:15:00"))).toBe("ended");
    expect(livePhase({ ...row, deleted: true }, new Date("2026-11-25T16:00:00"))).toBe("cancelled");
  });
  it("offers the classes and subjects the teacher is anchored to", () => {
    const assignments = [{ teacherId: "stf_1", classId: "cls_10B", subject: "Mathematics" }, { teacherId: "stf_2", classId: "cls_9A", subject: "Hindi" }];
    const periods = [{ teacherId: "stf_1", classId: "cls_10B", subject: "Physics" }, { teacherId: "stf_1", classId: "cls_8C", subject: "Mathematics" }];
    expect(myClassIds("stf_1", assignments, periods, [{ id: "cls_7A", classTeacherId: "stf_1" }])).toEqual(["cls_7A", "cls_8C", "cls_10B"]);
    expect(subjectsFor("cls_10B", "stf_1", assignments, periods)).toEqual(["Mathematics", "Physics"]);
  });
});

describe("message helpers", () => {
  const student = { id: "s1", name: "Aarav Sharma", classId: "cls_10B", guardian: "Rahul Sharma", guardianUids: ["uid_p1", "uid_p2"] };
  it("builds the thread and message documents the rules expect", () => {
    expect(threadDoc(student, "stf_1", "Anita Rao", "Class Teacher", "now")).toEqual({ studentId: "s1", classId: "cls_10B", studentName: "Aarav Sharma", parentUids: ["uid_p1", "uid_p2"], guardian: "Rahul Sharma", teacherId: "stf_1", teacher: "Anita Rao", role: "Class Teacher", createdAt: "now" });
    expect(messageDoc({ id: "thr_s1_stf_1", studentId: "s1", teacherId: "stf_1", parentUids: ["uid_p1"] }, "uid_t", "Anita Rao", "  Hello ", "now"))
      .toEqual({ threadId: "thr_s1_stf_1", studentId: "s1", teacherId: "stf_1", parentUids: ["uid_p1"], from: "teacher", uid: "uid_t", name: "Anita Rao", text: "Hello", at: "now" });
  });
  it("names the teacher's role for the thread", () => {
    expect(threadRole("cls_10B", "stf_1", [{ id: "cls_10B", classTeacherId: "stf_1" }], [])).toBe("Class Teacher");
    expect(threadRole("cls_10B", "stf_1", [], [{ teacherId: "stf_1", classId: "cls_10B", subject: "Mathematics" }])).toBe("Mathematics");
    expect(threadRole("cls_10B", "stf_1", [], [], "Science")).toBe("Science");
  });
  it("lists active students of the teacher's classes and flags those without a parent login", () => {
    const out = messageableStudents([student, { id: "s2", name: "Bina", classId: "cls_10B", guardianUids: [] }, { id: "s3", name: "Other", classId: "cls_9A", guardianUids: ["u"] }, { id: "s4", name: "Gone", classId: "cls_10B", deleted: true }], ["cls_10B"]);
    expect(out.map((s) => [s.id, s.blocked])).toEqual([["s1", ""], ["s2", "No parent app login yet"]]);
  });
});
