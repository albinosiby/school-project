import { describe, expect, it } from "vitest";
import type { AttRec, Period } from "@/features/ops/logic";
import {
  addressPatch, contactsError, contactsFormOf, contactsPatch, healthError, homeAddress, parseDetails,
} from "./details";
import {
  attendanceSummary, classDays, classMarks, classRecords, classSubjects, classTimetable, dailyRecords, dayRate, dayState, daySummary, decidedLeaves, decisionNoteError,
  decisionPatch, examAverages, leaveCovers, markedLabel, marksBands, monthCells, myClasses, needsSupport, overallRate, pendingLeaves, slotsOn, standings,
  studentSubjectAttendance, subjectAttendance, subjectMarks, teachingClasses,
} from "./logic";

const per = (day: string, period: number, subject: string, teacher = "Anita", classId = "cls_10B"): Period =>
  ({ id: `per_${classId}_${day}_${period}`, classId, grade: "10", section: "B", day, period, subject, teacher, teacherId: `stf_${teacher}`, room: "" });
const reg = (date: string, period: number, marks: Record<string, string> = {}, extra: Partial<AttRec> = {}): AttRec =>
  ({ id: `${date}_cls_10B_${period}`, date, classId: "cls_10B", period, total: 4, marks, submitted: true, ...extra });

// Mon: Maths P1, English P2, Maths P3; Tue: Science P1, Maths P2
const timetable = classTimetable([per("Mon", 1, "Mathematics"), per("Mon", 2, "English", "Ravi"), per("Mon", 3, "Mathematics"), per("Tue", 1, "Science", "Meena"),
  per("Tue", 2, "Mathematics"), per("Mon", 1, "Hindi", "X", "cls_9A")], "cls_10B");
const records = classRecords([
  reg("2026-11-23", 1, { stu_1: "A" }), reg("2026-11-23", 2, { stu_1: "L", stu_2: "A" }),
  reg("2026-11-24", 1), reg("2026-11-24", 2, { stu_1: "E" }),
  reg("2026-11-25", 4, { stu_3: "A" }), // Wednesday: nothing on the timetable
  reg("2026-11-23", 3, {}, { submitted: false }), reg("2026-11-24", 3, {}, { deleted: true }), reg("2026-11-24", 5, {}, { classId: "cls_9A" }),
], "cls_10B");

describe("classes list", () => {
  const classes = [{ id: "cls_9A", grade: "9", section: "A", classTeacherId: "stf_2" }, { id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_1" }, { id: "cls_7C", grade: "7", section: "C", classTeacherId: "stf_1" }];
  const data = { classes, assignments: [{ id: "a", classId: "cls_9A", subject: "English", teacherId: "stf_1" }, { id: "b", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_1" }], periods: [] };
  it("puts the class teacher's classes first and lists her own class under classes she teaches only when she teaches a subject there", () => {
    const rows = myClasses("stf_1", data);
    expect(rows.map((c) => `${c.id}:${c.classTeacher}:${c.subjects.join("/")}`)).toEqual(["cls_10B:true:Mathematics", "cls_7C:true:", "cls_9A:false:English"]);
    expect(teachingClasses(rows).map((c) => c.id)).toEqual(["cls_10B", "cls_9A"]);
  });
});

describe("class attendance", () => {
  it("reads the class timetable and keeps only submitted, live registers of the class", () => {
    expect(timetable.map((p) => `${p.day}.${p.period}:${p.subject}`)).toEqual(["1.1:Mathematics", "1.2:English", "1.3:Mathematics", "2.1:Science", "2.2:Mathematics"]);
    expect(records.map((r) => r.id)).toEqual(["2026-11-23_cls_10B_1", "2026-11-23_cls_10B_2", "2026-11-24_cls_10B_1", "2026-11-24_cls_10B_2", "2026-11-25_cls_10B_4"]);
  });

  it("sums every period of a day and labels how many of the timetable's periods were marked", () => {
    const days = classDays(records);
    expect(days.map((d) => [d.date, d.periods, d.present, d.late, d.absent, d.excused, d.total, d.absentees.join(",")])).toEqual([
      ["2026-11-23", 2, 5, 1, 2, 0, 8, "stu_1,stu_2"], ["2026-11-24", 2, 7, 0, 0, 1, 8, ""], ["2026-11-25", 1, 3, 0, 1, 0, 4, "stu_3"],
    ]);
    expect(dayRate(days[0]!)).toBe(75);
    expect(markedLabel(days[0]!, timetable)).toBe("2 of 3 periods marked");
    expect(markedLabel(days[1]!, timetable)).toBe("2 periods marked");
    expect(markedLabel(days[2]!, timetable)).toBe("1 period marked");
    expect(overallRate(days)).toBeCloseTo((16 * 100) / 20);
    expect(overallRate([])).toBeNull();
  });

  it("gives attendance per subject for every subject of the timetable (null without a register)", () => {
    const subjects = classSubjects(timetable, [], records);
    expect(subjects).toEqual(["Mathematics", "English", "Science", "Period 4"]);
    expect(subjectAttendance(records, timetable, [...subjects, "Art"])).toEqual([
      { subject: "Mathematics", rate: 75, registers: 2, weekly: 3 }, // Mon P1 3/4, Tue P2 3/4 (excused is not present)
      { subject: "English", rate: 75, registers: 1, weekly: 1 },
      { subject: "Science", rate: 100, registers: 1, weekly: 1 },
      { subject: "Period 4", rate: 75, registers: 1, weekly: 0 },
      { subject: "Art", rate: null, registers: 0, weekly: 0 },
    ]);
    expect(studentSubjectAttendance({ id: "stu_1" }, records, timetable, subjects)).toEqual([
      { subject: "Mathematics", attended: 0, total: 2, rate: 0 }, { subject: "English", attended: 1, total: 1, rate: 100 },
      { subject: "Science", attended: 1, total: 1, rate: 100 }, { subject: "Period 4", attended: 1, total: 1, rate: 100 },
    ]);
    expect(studentSubjectAttendance({ id: "stu_1", admissionDate: "2026-11-24" }, records, timetable, subjects)[0]).toEqual({ subject: "Mathematics", attended: 0, total: 1, rate: 0 });
  });
});

describe("marks and standings", () => {
  const papers = [
    { id: "p_m1", cycleId: "c_ut1", subject: "Mathematics", date: "2026-07-10", theory: 40, practical: 0, internal: 10 },
    { id: "p_e1", cycleId: "c_ut1", subject: "English", date: "2026-07-11", theory: 50 },
    { id: "p_m2", cycleId: "c_hy", subject: "Mathematics", date: "2026-09-20", theory: 80, internal: 20 },
    { id: "p_g", cycleId: "c_hy", subject: "Art", assessmentMode: "grade" },
    { id: "p_del", cycleId: "c_hy", subject: "Hindi", theory: 50, deleted: true },
  ];
  const cycles = [{ id: "c_ut1", title: "Unit Test 1", short: "UT1" }, { id: "c_hy", title: "Half Yearly" }];
  const marks = classMarks([
    { id: "m1", paperId: "p_m1", studentId: "stu_1", theory: 30, internal: 10 }, { id: "m2", paperId: "p_e1", candId: "cand_stu_1", theory: 15 },
    { id: "m3", paperId: "p_m2", studentId: "stu_1", theory: 60, internal: 18 }, { id: "m4", paperId: "p_m1", studentId: "stu_2", theory: 20, internal: 5 },
    { id: "m5", paperId: "p_m2", studentId: "stu_2", status: "Absent" }, { id: "m6", paperId: "p_g", studentId: "stu_2", gradeValue: "A" },
    { id: "m7", paperId: "p_del", studentId: "stu_1", theory: 40 }, { id: "m8", paperId: "p_m1", studentId: "stu_other", theory: 40 },
  ], papers, cycles, ["stu_1", "stu_2", "stu_3"]);

  it("joins marks with the paper's subject and maximum and the exam's short name", () => {
    expect(marks.map((m) => `${m.studentId}:${m.subject}:${m.exam}:${m.score}/${m.max}:${m.status}:${m.pct}`)).toEqual([
      "stu_1:Mathematics:UT1:40/50:Present:80", "stu_1:English:UT1:15/50:Present:30", "stu_1:Mathematics:Half Yearly:78/100:Present:78",
      "stu_2:Mathematics:UT1:25/50:Present:50", "stu_2:Mathematics:Half Yearly:null/100:Absent:null", "stu_2:Art:Half Yearly:null/0:Present:null",
    ]);
    expect(examAverages(marks)).toEqual([{ exam: "UT1", cycleId: "c_ut1", avg: (80 + 30 + 50) / 3 }, { exam: "Half Yearly", cycleId: "c_hy", avg: 78 }]);
    expect(subjectMarks(marks, ["Mathematics", "English", "Science"])).toEqual([
      { subject: "Mathematics", avg: (80 + 78 + 50) / 3, exams: 2 }, { subject: "English", avg: 30, exams: 1 }, { subject: "Science", avg: null, exams: 0 },
    ]);
  });

  it("ranks students into bands, top performers and those needing support", () => {
    const roster = [{ id: "stu_1", name: "Asha", roll: 1 }, { id: "stu_2", name: "Bala", roll: 2 }, { id: "stu_3", name: "Chitra", roll: 3, admissionDate: "2026-11-24" }, { id: "stu_4", name: "Dev", roll: 4 }];
    const rows = standings(roster, records, marks);
    expect(rows.map((r) => [r.student.id, r.attendance, r.marks, r.absences])).toEqual([
      ["stu_1", 60, (80 + 30 + 78) / 3, 1], ["stu_2", 80, 50, 1], ["stu_3", (2 * 100) / 3, null, 1], ["stu_4", 100, null, 0],
    ]);
    expect(marksBands(rows)).toEqual([0, 1, 1, 0, 0]);
    expect(needsSupport(rows, 75).map((r) => r.student.id)).toEqual(["stu_1", "stu_3"]); // 60% attendance (marks 62.7) before 66.7% attendance
  });
});

describe("student profile attendance", () => {
  it("keeps one register per day: the latest written, else the later period", () => {
    const rows = [reg("2026-11-23", 1, {}, { updatedAt: "2026-11-23T05:00:00Z" }), reg("2026-11-23", 2, { stu_1: "A" }, { updatedAt: "2026-11-23T04:00:00Z" }),
      reg("2026-11-24", 1, { stu_1: "L" }), reg("2026-11-24", 2, { stu_1: "A" }), reg("2026-11-20", 1)];
    const daily = dailyRecords(rows, "2026-11-21");
    expect(daily.map((r) => r.id)).toEqual(["2026-11-23_cls_10B_1", "2026-11-24_cls_10B_2"]);
    expect(attendanceSummary(daily, "stu_1")).toEqual({ days: 2, present: 1, absent: 1, late: 0, excused: 0, rate: 50 });
  });

  it("gives one dot per period of the day: the timetable's periods plus any other marked one, with subject, teacher and mark", () => {
    const monday = slotsOn("2026-11-23", timetable, records, "stu_1");
    expect(monday).toEqual([
      { period: 1, subject: "Mathematics", teacher: "Anita", code: "A" }, { period: 2, subject: "English", teacher: "Ravi", code: "L" },
      { period: 3, subject: "Mathematics", teacher: "Anita", code: null },
    ]);
    expect(dayState(monday)).toBe("absent");
    expect(daySummary(monday)).toBe("Absent in 1 of 3 periods");
    const wednesday = slotsOn("2026-11-25", timetable, records, "stu_1");
    expect(wednesday).toEqual([{ period: 4, subject: "Period 4", teacher: "", code: "P" }]);
    expect([dayState(wednesday), daySummary(wednesday)]).toEqual(["present", "Present in every marked period"]);
    const nextMonday = slotsOn("2026-11-30", timetable, records, "stu_1");
    expect([nextMonday.length, dayState(nextMonday), daySummary(nextMonday)]).toEqual([3, "unmarked", "Not marked yet"]);
    expect([dayState(slotsOn("2026-11-29", timetable, records, "stu_1")), daySummary([])]).toEqual(["none", "No periods on the timetable"]);
  });

  it("lays a month out Monday first", () => {
    const cells = monthCells("2026-11");
    expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(cells.length).toBe(36);
  });
});

describe("leave decisions", () => {
  const leaves = [
    { id: "l1", studentId: "stu_1", classId: "cls_10B", from: "2026-11-26", status: "Pending" }, { id: "l2", studentId: "stu_2", classId: "cls_10B", from: "2026-11-20" },
    { id: "l3", studentId: "stu_3", classId: "cls_10B", from: "2026-11-10", to: "2026-11-12", status: "Approved", decidedAt: "2026-11-09T00:00:00Z" },
    { id: "l4", studentId: "stu_4", classId: "cls_9A", from: "2026-11-01" }, { id: "l5", studentId: "stu_5", classId: "cls_10B", from: "2026-11-01", deleted: true },
  ];
  it("lists pending requests oldest first and decided ones newest first, only of the class teacher's classes", () => {
    expect(pendingLeaves(leaves, ["cls_10B"]).map((l) => l.id)).toEqual(["l2", "l1"]);
    expect(decidedLeaves(leaves, ["cls_10B"]).map((l) => l.id)).toEqual(["l3"]);
    expect([leaveCovers(leaves[2]!, "2026-11-11"), leaveCovers(leaves[2]!, "2026-11-13"), leaveCovers(leaves[0]!, "2026-11-26")]).toEqual([true, false, false]);
  });
  it("writes only the decision fields, with the note trimmed and at most 2000 characters", () => {
    expect(decisionPatch("Rejected", "  too long  ", "stf_1", "2026-11-23T06:00:00.000Z")).toEqual({ status: "Rejected", decisionNote: "too long", decidedBy: "stf_1", decidedAt: "2026-11-23T06:00:00.000Z" });
    expect(decisionNoteError("x".repeat(2001))).toBe("Note is at most 2000 characters");
    expect(decisionNoteError("ok")).toBe("");
  });
});

describe("student details", () => {
  const answer = {
    exists: true, gender: "Female", dob: "2012-04-02", religion: "secret", caste: "secret", category: "secret", bankAccount: "123",
    contacts: { father: { name: "Ravi", phone: "9876500001", email: "" }, guardian: { name: "Uncle Joe", phone: "9876500003", relationship: "Uncle" } },
    primary: "father", secondary: "father", residence: { addressLine1: "12 MG Road", city: "Kochi", pin: "682001" }, address: "old address", bloodGroup: "O+",
  };
  it("reads only whitelisted fields and drops a second contact equal to the primary", () => {
    const d = parseDetails(answer);
    expect(Object.keys(d)).not.toEqual(expect.arrayContaining(["religion"]));
    expect(JSON.stringify(d)).not.toMatch(/secret|bank|123"/);
    expect([d.primary, d.secondary, d.contacts.mother.name, homeAddress(d)]).toEqual(["father", "", "", "12 MG Road, Kochi, 682001"]);
    expect(homeAddress(parseDetails({ address: "Flat 2, Lake View" }))).toBe("Flat 2, Lake View");
  });
  it("checks contacts like the server and sends only the changed ones", () => {
    const d = parseDetails(answer);
    const f = contactsFormOf(d);
    f.contacts.mother = { ...f.contacts.mother, phone: "98765" };
    expect(contactsError(f)).toBe("Enter a valid mobile number for the mother.");
    f.contacts.mother = { ...f.contacts.mother, phone: "9876500002" };
    expect(contactsError(f)).toBe("Enter the mother's name.");
    f.contacts.mother = { ...f.contacts.mother, name: " Lata " };
    f.secondary = "father";
    expect(contactsError(f)).toBe("Choose a different second contact.");
    f.secondary = "mother";
    expect(contactsError({ ...f, primary: "guardian", contacts: { ...f.contacts, guardian: { ...f.contacts.guardian, phone: "" } } })).toBe("The primary contact needs a name and a valid mobile number.");
    expect(contactsError(f)).toBe("");
    expect(contactsPatch(d, f)).toEqual({
      contacts: { mother: { name: "Lata", phone: "9876500002", email: "", occupation: "", relationship: "", address: "" } }, primary: "father", secondary: "mother", emergencyPhone: "",
    });
  });
  it("builds the address and health updates", () => {
    const d = parseDetails(answer);
    expect(addressPatch(d, { addressLine1: " 14 MG Road ", addressLine2: "", city: "Kochi", district: "Ernakulam", state: "Kerala", pin: "682001" }))
      .toEqual({ residence: { addressLine1: "14 MG Road", addressLine2: "", city: "Kochi", district: "Ernakulam", state: "Kerala", pin: "682001", country: "IN" } });
    expect(healthError({ bloodGroup: "Z+", conditions: "", assistance: "" })).toBe("Choose a blood group.");
    expect(healthError({ bloodGroup: "AB-", conditions: "Asthma", assistance: "" })).toBe("");
  });
});
