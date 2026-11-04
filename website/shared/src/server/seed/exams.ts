import type { Seed } from "./index";
import { fx } from "./demo";

// One candidate per student of the rostered classes: id = cand_{studentId} (demo fixture).
const candidates = fx.exm_candidates;

const SUBJECTS: [string, string, string][] = [
  ["Mathematics", "MATH", "041"], ["Science", "SCI", "086"], ["Social Science", "SST", "087"],
  ["English Lang & Lit", "ENG", "184"], ["Hindi Course A", "HIN", "002"], ["Computer Applications", "CMP", "165"],
];
const TEACH = ["Mrs. Sunita Verma", "Dr. Manoj Kaushik", "Mr. Arvind Nambiar", "Ms. Ananya Sen", "Dr. Prabha Sharma", "Mr. Rakesh Dutta"];

type P = Record<string, unknown> & { id: string };
const papers: P[] = [];
[6, 7, 8, 9].forEach((g, gi) => SUBJECTS.forEach(([subject, pre, num], si) => {
  const g8 = g === 8 && si < 3;
  const day = g8 ? 24 + si * 2 : 6 + gi * 2 + si * 3 % 5 + (si > 2 ? 4 : 0);
  const completed = !(g === 8 && (si === 1 || si === 2));
  papers.push({
    id: `pap_c1_${g}_${si}`, cycleId: "cyc_1", grade: String(g), subject, code: `${pre}-${num}`,
    date: `2026-10-${String(Math.min(day, 30)).padStart(2, "0")}`, start: "09:00", duration: 2.5, theory: 80,
    internal: 20, internalType: si === 1 ? "Practical" : "Internal",
    venue: si === 1 ? "Exam Hall 3 & Physics Lab" : "Exam Hall 3 (Seats 01–40)", invigilator: TEACH[si], classIds: fx.paperClassIds[String(g)] ?? [],
    status: completed ? "Completed" : "Scheduled", marksEntered: completed, published: [] as string[],
  });
}));
const c2: [string, string, string, string, string, string][] = [
  ["Mathematics", "MATH-041", "2026-11-18", "Exam Hall 1 & 2", "Mrs. Sunita Verma", "8"],
  ["Science", "SCI-086", "2026-11-21", "Hall 1 & Physics Lab", "Dr. Manoj Kaushik", "8"],
  ["Social Science", "SST-087", "2026-11-25", "Exam Hall 3", "Mr. Arvind Nambiar", "8"],
  ["English Lang & Lit", "ENG-184", "2026-11-28", "Exam Hall 1 & 2", "Ms. Ananya Sen", "8"],
  ["Hindi Course A", "HIN-002", "2026-12-02", "Exam Hall 1", "Dr. Prabha Sharma", "8"],
  // Term 2 Pre-Board also covers grades 9 and 10 (the demo teacher's classes)
  ["Mathematics", "MATH-041", "2026-11-18", "Exam Hall 4 & 5", "Mrs. Kabir Nair", "10"],
  ["Science", "SCI-086", "2026-11-21", "Physics Lab & Hall 6", "Dr. Myra Sharma", "9"],
];
c2.forEach(([subject, code, date, venue, invigilator, grade], i) => papers.push({
  id: `pap_c2_${i}`, cycleId: "cyc_2", grade, subject, code, date, start: "09:00", duration: 2.5, theory: 80, internal: 20,
  internalType: "Internal", venue, invigilator, classIds: fx.paperClassIds[grade] ?? [], status: "Scheduled", marksEntered: false, published: [] as string[],
}));

// Mathematics (Grade 8) marks for section A, as in the design
const mathPaper = "pap_c1_8_0";
const seedMarks: Record<number, [number | null, number | null, string?]> = {
  0: [74, 18], 1: [78, 20], 2: [31, 14], 3: [null, 16, "medical"], 4: [82, 19], 5: [62, 16],
};
const marks = candidates.filter((c) => c.cls === "8-A").map((c, i) => {
  const s = seedMarks[i] ?? [38 + ((i * 17) % 40), 11 + ((i * 3) % 9)];
  return {
    id: `${mathPaper}__${c.id}`, paperId: mathPaper, candId: c.id, studentId: c.studentId, theory: s[0], internal: s[1],
    medical: s[2] === "medical", verified: i < 2 || i === 5 || (i > 5 && i % 3 !== 0),
  };
});
(papers.find((p) => p.id === mathPaper) as P).published = [];

export const exams: Seed = {
  exm_cycles: [
    { id: "cyc_1", title: "Term 1 Mid-Term 2026", short: "Term 1 Mid-Term 2026", term: "Term 1 (Autumn) · AY 2026-27", category: "Internal", start: "2026-10-06", end: "2026-10-30", declaration: "2026-11-10", instructions: "Candidates must report to designated halls at 08:30 AM with admit card and school ID.", circular: "", grades: ["6", "7", "8", "9"], sections: "all", enforceAttendance: true, theoryMax: 80, internalMax: 20, internalParts: [5, 5, 5, 5], scale: "CBSE 9-Point Scale (A1 to E2)", passRule: "Min 33% independently in Theory & Practical (Bylaws §14.2)", grace: "Up to 5 Marks (Council Approval Req.)", qr: true, sealed: true, biometric: false, status: "Live" },
    { id: "cyc_2", title: "Term 2 Pre-Board Examinations 2026-27", short: "Term 2 Pre-Board", term: "Term 2 (Spring) · AY 2026-27", category: "CBSE Board", start: "2026-11-15", end: "2026-12-02", declaration: "2026-12-18", instructions: "All candidates must report to designated examination halls at 08:30 AM with authorized digital admit card and school ID. 15 minutes of mandatory question reading time applies as per CBSE Bye-Laws §22.", circular: "Circular_T2_PreBoard_2026.pdf", grades: ["8", "9", "10"], sections: "all", enforceAttendance: true, theoryMax: 80, internalMax: 20, internalParts: [5, 5, 5, 5], scale: "CBSE 9-Point Scale (A1 to E2)", passRule: "Min 33% independently in Theory & Practical (Bylaws §14.2)", grace: "Up to 5 Marks (Council Approval Req.)", qr: true, sealed: true, biometric: true, status: "Scheduled" },
    { id: "cyc_3", title: "Annual Board Examination 2027", short: "Annual Board 2027", term: "Term 2 (Spring) · AY 2026-27", category: "CBSE Board", start: "2027-02-15", end: "2027-03-30", declaration: "2027-05-10", instructions: "", circular: "", grades: ["10", "12"], sections: "all", enforceAttendance: true, theoryMax: 80, internalMax: 20, internalParts: [5, 5, 5, 5], scale: "CBSE 9-Point Scale (A1 to E2)", passRule: "Min 33% independently in Theory & Practical (Bylaws §14.2)", grace: "Up to 5 Marks (Council Approval Req.)", qr: true, sealed: true, biometric: true, status: "Draft" },
  ],
  exm_papers: papers,
  exm_candidates: candidates,
  exm_marks: marks,
};
