// Pure helpers for the teaching-staff portal views that mirror the teacher app's exam, duty, live-class and parent
// message modules (docs/STAFF_PORTAL_CONTRACT.md §3). Document shapes follow
// mobile app/teacher/lib/utils/services/firebase/store_adapters.dart (MarksAdapter, ExamsAdapter, ExamDutiesAdapter,
// ExamCandidatesAdapter, LiveClassesAdapter, MessagesAdapter). Nothing here touches Firestore.
import { classIdLabel } from "@/lib/academicStreams";
import { isSheetOpen, type Sheet, type SheetComponents } from "@/features/exams/sheets";
import type { Candidate, Paper } from "@/features/exams/types";
import { studentIdOf, subjectCovers } from "@/features/exams/logic";

// ---- marks (exm_sheets / exm_marks) ----------------------------------------------------------------------------------
/** exm_marks/{paperId}__cand_{studentId} */
export const markDocId = (paperId: string, studentId: string) => `${paperId}__cand_${studentId}`;
/** the attendance statuses the teacher app offers on a mark (marks_entry_screen.dart) */
export const MARK_STATUSES = ["Present", "Absent", "Medical Slip", "Disqualified"] as const;
export type MarkStatus = (typeof MARK_STATUSES)[number];
/** the aptitude tags the teacher app offers */
export const MARK_TAGS = ["Consistent", "Formula Weakness", "Exceptional", "Needs Practice", "Calculation Slip"] as const;

/** exm_marks as the teacher app writes it (MarksAdapter.write, sheet branch) */
export type PortalMark = {
  id: string; paperId: string; candId: string; studentId: string; classId: string;
  theory: number | null; practical: number | null; internal: number | null; gradeValue: string;
  status: string; tag: string; note: string; teacherId: string; enteredAt: string; updatedAt?: string; updatedBy?: string;
  verified?: boolean; medical?: boolean;
};
export type NumericComponent = { key: "theory" | "practical" | "internal"; label: string; max: number };
/** the numeric components of a sheet in entry order (max 0 ones are not part of the sheet), like ExamComponents.numeric */
export function numericComponents(c: Pick<SheetComponents, "theory" | "practical" | "internal">): NumericComponent[] {
  return [
    ...(c.theory > 0 ? [{ key: "theory" as const, label: "Theory", max: c.theory }] : []),
    ...(c.practical > 0 ? [{ key: "practical" as const, label: "Practical", max: c.practical }] : []),
    ...(c.internal > 0 ? [{ key: "internal" as const, label: "Internal", max: c.internal }] : []),
  ];
}
export const maxTotalOf = (c: Pick<SheetComponents, "theory" | "practical" | "internal">) => c.theory + c.practical + c.internal;

/** what the teacher edits on one row */
export type MarkDraft = { theory: number | null; practical: number | null; internal: number | null; gradeValue: string; status: string; tag: string; note: string };
export const draftOf = (mark?: Partial<PortalMark> | null): MarkDraft => ({
  theory: mark?.theory ?? null, practical: mark?.practical ?? null, internal: mark?.internal ?? null, gradeValue: mark?.gradeValue ?? "",
  status: mark?.status || "Present", tag: mark?.tag ?? "", note: mark?.note ?? "",
});

/** "" when a draft can be written to a sheet (each component blank or 0..max, grade from the sheet's options), else why not */
export function markDraftError(c: SheetComponents, draft: MarkDraft) {
  if (c.mode === "grade") {
    return draft.gradeValue && c.gradeOptions.length && !c.gradeOptions.includes(draft.gradeValue) ? "Pick a grade from the sheet's options" : "";
  }
  for (const comp of numericComponents(c)) {
    const v = draft[comp.key];
    if (v === null) continue;
    if (!Number.isInteger(v)) return `${comp.label} marks must be a whole number`;
    if (v < 0 || v > comp.max) return `${comp.label} marks must be between 0 and ${comp.max}`;
  }
  return "";
}

/** the full exm_marks document the teacher app creates for a sheet (keys exactly as MarksAdapter.write sends them) */
export function sheetMarkDoc(sheet: Pick<Sheet, "paperId" | "classId" | "components">, studentId: string, staffId: string, draft: MarkDraft, now: string) {
  const grade = sheet.components.mode === "grade";
  const present = draft.status === "Present";
  return {
    paperId: sheet.paperId, candId: `cand_${studentId}`, studentId, classId: sheet.classId,
    theory: present && !grade && sheet.components.theory > 0 ? draft.theory : null,
    practical: present && !grade && sheet.components.practical > 0 ? draft.practical : null,
    internal: present && !grade && sheet.components.internal > 0 ? draft.internal : null,
    gradeValue: present && grade ? draft.gradeValue : "",
    status: draft.status, tag: draft.tag, note: draft.note, teacherId: staffId, enteredAt: now,
  };
}
/** the keys a teacher may change on an existing mark of an opened sheet (`validSheetMarks`, update branch) */
export function sheetMarkPatch(sheet: Pick<Sheet, "paperId" | "classId" | "components">, studentId: string, staffId: string, draft: MarkDraft, now: string) {
  const { theory, practical, internal, gradeValue, status, tag, note, enteredAt } = sheetMarkDoc(sheet, studentId, staffId, draft, now);
  return { theory, practical, internal, gradeValue, status, tag, note, enteredAt };
}

export type MarkEntryState = "pending" | "entered" | "absent" | "invalid";
/** how one rostered student stands on a sheet (the app's StudentMark.entered / sheetSubmitProblem logic) */
export function markEntryState(c: SheetComponents, mark?: Pick<PortalMark, "theory" | "practical" | "internal" | "gradeValue" | "status"> | null): MarkEntryState {
  if (!mark) return "pending";
  if (mark.status && mark.status !== "Present") return "absent";
  if (c.mode === "grade") return !mark.gradeValue ? "pending" : c.gradeOptions.length && !c.gradeOptions.includes(mark.gradeValue) ? "invalid" : "entered";
  let blank = false;
  for (const comp of numericComponents(c)) {
    const v = mark[comp.key];
    if (v === null || v === undefined) blank = true;
    else if (v < 0 || v > comp.max) return "invalid";
  }
  return blank ? "pending" : "entered";
}
export function sheetProgress(sheet: Pick<Sheet, "rosterIds" | "components">, marks: Map<string, PortalMark>) {
  const counts = { total: sheet.rosterIds.length, entered: 0, absent: 0, pending: 0, invalid: 0 };
  for (const id of sheet.rosterIds) counts[markEntryState(sheet.components, marks.get(id))]++;
  return counts;
}
/** why a sheet cannot be submitted yet (null when complete), the same check the teacher app runs before `submit` */
export function sheetSubmitProblem(sheet: Pick<Sheet, "rosterIds" | "components">, marks: Map<string, PortalMark>) {
  const p = sheetProgress(sheet, marks);
  if (!p.pending && !p.invalid) return null;
  return [
    p.pending ? `${p.pending} of ${p.total} students still pending: enter every component or mark them Absent.` : "",
    p.invalid ? `${p.invalid} ${p.invalid === 1 ? "mark is" : "marks are"} out of range.` : "",
  ].filter(Boolean).join(" ");
}
/** total of the numeric components (null when nothing is entered) */
export const markTotal = (m?: Pick<PortalMark, "theory" | "practical" | "internal"> | null) =>
  !m || (m.theory === null && m.practical === null && m.internal === null) ? null : (m.theory ?? 0) + (m.practical ?? 0) + (m.internal ?? 0);
/** the sheet transition a teacher may write (`teacherSheetSubmit`): status, submittedAt, submittedBy (+ the stamp) */
export const sheetSubmitPatch = (staffId: string, now: string) => ({ status: "Submitted" as const, submittedAt: now, submittedBy: staffId });
export const canSubmitSheet = (sheet: Pick<Sheet, "status">) => isSheetOpen(sheet.status);

/** display rows of a sheet's roster: the exm_candidates row, else the students row, else the bare id */
export type RosterRow = { studentId: string; name: string; roll: string; grn: string };
export function sheetRoster(sheet: Pick<Sheet, "rosterIds">, candidates: Candidate[], students: { id: string; name?: string; roll?: number | string; grn?: string }[]): RosterRow[] {
  const byCand = new Map(candidates.map((c) => [studentIdOf(c), c]));
  const byStudent = new Map(students.map((s) => [s.id, s]));
  return sheet.rosterIds.map((studentId) => {
    const c = byCand.get(studentId), s = byStudent.get(studentId);
    return { studentId, name: c?.name || s?.name || studentId, roll: c?.roll || (s?.roll !== undefined && s.roll !== "" ? String(s.roll) : ""), grn: c?.grn || s?.grn || "" };
  }).sort((a, b) => rollNumber(a.roll) - rollNumber(b.roll) || a.name.localeCompare(b.name));
}
/** roll as a number: 12, "12" or the admin's "#10B-12" */
export const rollNumber = (roll: unknown) => (typeof roll === "number" ? roll : Number(/(\d+)\D*$/.exec(String(roll ?? ""))?.[1] ?? 0) || 0);

/** papers the teacher is allocated to (assignments / evaluatorIds, as ExamsAdapter.build lists them) that have no sheet */
export type Allocation = { paperId: string; classId: string; subject: string };
export function legacyAllocations(papers: Paper[], assignments: { teacherId?: string; classId?: string; subject?: string }[], sheets: Pick<Sheet, "paperId" | "classId">[], staffId: string): Allocation[] {
  const sheeted = new Set(sheets.map((s) => `${s.paperId}__${s.classId}`));
  const out: Allocation[] = [];
  for (const p of papers) {
    if (p.scheduleStatus === "Cancelled") continue;
    const listed = p.classIds ?? [];
    const evaluators = p.evaluatorIds ?? {};
    const allocations = [
      ...assignments.filter((a) => a.teacherId === staffId && a.classId),
      ...Object.entries(evaluators).filter(([, id]) => id === staffId).map(([classId]) => ({ classId, subject: p.subject })),
    ];
    const included = new Set<string>();
    for (const a of allocations) {
      const classId = String(a.classId);
      const inPaper = listed.length ? listed.includes(classId) : classIdLabel(classId).split("-")[0] === p.grade;
      if (evaluators[classId] && evaluators[classId] !== staffId) continue;
      if (!inPaper || !subjectCovers(p.subject ?? "", a.subject ?? "") || included.has(classId)) continue;
      included.add(classId);
      if (sheeted.has(`${p.id}__${classId}`)) continue;
      out.push({ paperId: p.id, classId, subject: p.subject });
    }
  }
  return out;
}

// ---- exam duties (exm_duties / ed_duty_state / ed_cand_state) -------------------------------------------------------
export type DutyDoc = {
  id: string; paperId: string; cycleId?: string; staffId: string; role?: string; hall?: string; venue?: string; date?: string; start?: string; end?: string;
  grade?: string; subject?: string; code?: string; classIds?: string[]; status?: string; note?: string; reportBy?: string; control?: string; candidates?: number; deleted?: boolean;
};
export type DutyRow = {
  id: string; paperId: string; code: string; subject: string; grade: string; cycle: string; note: string; date: string; start: string; end: string; hall: string;
  role: string; classLabels: string[]; report: string; control: string; chief: boolean; status: "upcoming" | "completed";
};
/** teacher-private overlay ids carry the staff id (the duty / candidate ids are shared by the teachers of a hall) */
export const overlayId = (id: string, staffId: string) => `${id}_${staffId}`;
/** ed_duty_state keys the app stores */
export type DutyState = { swap: string; swapWith: string; swapReason: string; checked: number[]; submitted: boolean };
export const emptyDutyState = (): DutyState => ({ swap: "", swapWith: "", swapReason: "", checked: [], submitted: false });
/** ed_cand_state keys the app stores */
export type CandState = { status: "present" | "absent"; supp: number; suppCode: string; malpractice: string; absentReason: string };
export const emptyCandState = (): CandState => ({ status: "present", supp: 0, suppCode: "", malpractice: "", absentReason: "" });
export const dutyStateDoc = (dutyId: string, state: DutyState) => ({ dutyId, ...state });
export const candStateDoc = (dutyId: string, candId: string, state: CandState) => ({ dutyId, candId, ...state });
/** the invigilation checklist of the app's duty detail screen (indexes stored in `checked`) */
export const DUTY_CHECKLIST = ["Briefing: collect sealed envelopes and attendance rolls", "Commence: distribute papers and verify admit cards", "Conclusion: collect scripts, seal the bundle and hand over"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const hhmm = (minutes: number) => { const t = ((minutes % 1440) + 1440) % 1440; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
/** paper classes as labels ("10-B"); empty = every class of the grade */
export const paperLabels = (p: Pick<Paper, "classIds">) => (p.classIds ?? []).map((id) => classIdLabel(id));

/** the teacher's duties: her exm_duties rows plus papers she is `invigilatorId` of without a row (ExamDutiesAdapter) */
export function myDuties(duties: DutyDoc[], papers: Paper[], cycles: { id: string; short?: string; title?: string }[], staffId: string, today: string): DutyRow[] {
  const papersById = new Map(papers.map((p) => [p.id, p]));
  const withRow = new Set<string>();
  const sources: { id: string; duty: Partial<DutyDoc>; paper?: Paper }[] = [];
  for (const d of duties) {
    if (d.staffId !== staffId || d.deleted) continue;
    withRow.add(d.paperId);
    sources.push({ id: d.id, duty: d, paper: papersById.get(d.paperId) });
  }
  for (const p of papers) if (p.invigilatorId === staffId && !withRow.has(p.id)) sources.push({ id: `chief_${p.id}`, duty: { paperId: p.id, role: "Chief Invigilator", hall: p.venue ?? "" }, paper: p });
  const rows = sources.map(({ id, duty, paper }) => {
    const d = duty as Record<string, unknown>, p = (paper ?? {}) as Record<string, unknown>;
    const f = (key: string, dflt = "") => String(d[key] ?? p[key] ?? dflt);
    const start = f("start", "09:00");
    const date = f("date");
    const cycle = cycles.find((c) => c.id === f("cycleId"));
    const role = duty.role || "Invigilator";
    return {
      id, paperId: String(duty.paperId), code: f("code"), subject: f("subject"), grade: f("grade"), cycle: cycle?.short || cycle?.title || "", note: duty.note ?? "",
      date, start, end: duty.end || hhmm(minutesOf(start) + Math.round((paper?.duration ?? 3) * 60)), hall: duty.hall || paper?.venue || "",
      role, classLabels: paper ? paperLabels(paper) : [], report: duty.reportBy || hhmm(minutesOf(start) - 30), control: duty.control || "Exam Control Room",
      chief: role === "Chief Invigilator", status: (duty.status === "completed" || (date && date < today) ? "completed" : "upcoming") as DutyRow["status"],
    };
  });
  return rows.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}
/** candidates of a paper (its classes, else its grade) in class + roll order, like ExamCandidatesAdapter */
export function paperCandidates(paper: Pick<Paper, "classIds" | "grade"> | undefined, candidates: Candidate[]) {
  if (!paper) return [];
  const labels = paperLabels(paper);
  const label = (c: Candidate) => c.cls || `${c.grade}-${c.section}`;
  return candidates.filter((c) => (labels.length ? labels.includes(label(c)) : String(c.grade) === String(paper.grade)))
    .sort((a, b) => label(a).localeCompare(label(b)) || rollNumber(a.roll) - rollNumber(b.roll));
}

// ---- live classes (live_classes) -----------------------------------------------------------------------------------
export type LiveClassDoc = {
  id: string; title: string; classId: string; audience?: string; subject?: string; category?: string; date: string; time: string; mins: number;
  room?: string; medium?: string; link?: string; record?: boolean; mute?: boolean; studentShare?: boolean; notify?: boolean; joined?: number; total?: number;
  tag?: string; status?: string; cohost?: string; teacherId?: string; deleted?: boolean; createdAt?: string; updatedAt?: string;
};
export type LiveForm = { classId: string; subject: string; title: string; date: string; time: string; mins: number; link: string };
export const JOIN_LEAD_MINUTES = 10;
const meetCode = /^(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[?#/].*)?$/i;
const meetLookup = /^(?:https?:\/\/)?meet\.google\.com\/lookup\/([A-Za-z0-9_-]+)(?:[?#].*)?$/i;
/** the https form of a valid Google Meet link (live_class_rules.dart), or null */
export function normalizeMeetLink(input: string) {
  const s = input.trim();
  const code = meetCode.exec(s);
  if (code) return `https://meet.google.com/${code[1]!.toLowerCase()}`;
  const lookup = meetLookup.exec(s);
  return lookup ? `https://meet.google.com/lookup/${lookup[1]}` : null;
}
/** field errors of the schedule form ({} when it can be saved) */
export function liveFormErrors(f: LiveForm): Partial<Record<keyof LiveForm, string>> {
  const e: Partial<Record<keyof LiveForm, string>> = {};
  if (!f.classId) e.classId = "Pick a class";
  if (!f.subject.trim()) e.subject = "Pick a subject";
  const title = f.title.trim();
  if (!title) e.title = "Enter a title";
  else if (title.length > 200) e.title = "Keep the title under 200 characters";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = "Pick a date";
  if (!/^\d{2}:\d{2}$/.test(f.time)) e.time = "Pick a start time";
  if (!Number.isInteger(f.mins) || f.mins < 5 || f.mins > 480) e.mins = "Duration must be 5 to 480 minutes";
  if (!f.link.trim()) e.link = "Paste the Google Meet link";
  else if (!normalizeMeetLink(f.link)) e.link = "Use a Google Meet link like https://meet.google.com/abc-defg-hij";
  return e;
}
/** the live_classes document the teacher app writes (LiveSession.toJson + LiveClassesAdapter.write) */
export function liveClassDoc(f: LiveForm, audience: string, now: string) {
  return {
    title: f.title.trim(), classId: f.classId, audience, subject: f.subject.trim(), category: "", date: f.date, time: f.time, mins: f.mins, room: "",
    medium: "Google Meet", link: normalizeMeetLink(f.link) ?? f.link.trim(), record: true, mute: true, studentShare: false, notify: true, material: null,
    total: 0, tag: "", status: "upcoming", cohost: "", meetSpace: "", calendarEventId: "", calendarLink: "", calendarSync: false, createdAt: now,
  };
}
/** cancel = soft delete (hard delete is admin-only) */
export const liveCancelPatch = () => ({ deleted: true, status: "cancelled" });
export const liveStart = (row: Pick<LiveClassDoc, "date" | "time">) => { const d = new Date(`${row.date}T${row.time.length === 5 ? `${row.time}:00` : row.time}`); return Number.isNaN(+d) ? null : d; };
export type LivePhase = "scheduled" | "open" | "ended" | "cancelled";
/** where a session is on the clock (join opens 10 minutes before the start, like the app) */
export function livePhase(row: Pick<LiveClassDoc, "date" | "time" | "mins" | "status" | "deleted">, now: Date): LivePhase {
  if (row.deleted || row.status === "cancelled") return "cancelled";
  const start = liveStart(row);
  if (!start) return row.status === "past" ? "ended" : "scheduled";
  const end = +start + (row.mins || 45) * 60000;
  if (+now >= end) return "ended";
  if (+now >= +start - JOIN_LEAD_MINUTES * 60000) return "open";
  return "scheduled";
}
/** subjects the teacher teaches a class (assignments and own periods): what `teachesSubject` accepts on a live class */
export function subjectsFor(classId: string, staffId: string, assignments: { teacherId?: string; classId?: string; subject?: string }[], periods: { teacherId?: string; classId?: string; subject?: string }[]) {
  const out = new Set<string>();
  for (const row of [...assignments, ...periods]) if (row.teacherId === staffId && row.classId === classId && row.subject) out.add(row.subject);
  return [...out].sort();
}
/** class ids the teacher teaches (assignments, own periods, class teacher) */
export function myClassIds(staffId: string, assignments: { teacherId?: string; classId?: string }[], periods: { teacherId?: string; classId?: string }[], classes: { id: string; classTeacherId?: string }[]) {
  const ids = new Set<string>();
  for (const row of [...assignments, ...periods]) if (row.teacherId === staffId && row.classId) ids.add(row.classId);
  for (const c of classes) if (c.classTeacherId === staffId) ids.add(c.id);
  return [...ids].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

// ---- parent messages (msg_threads / msg_messages) --------------------------------------------------------------------
export type ThreadDoc = {
  id: string; studentId: string; classId: string; studentName?: string; parentUids: string[]; guardian?: string; teacherId: string; teacher?: string; role?: string;
  lastMessage?: string; lastAt?: string; lastFrom?: string; unreadTeacher?: number; unreadParent?: number; createdAt?: string; updatedAt?: string;
};
export type MessageDoc = { id: string; threadId: string; studentId: string; teacherId: string; parentUids?: string[]; from: "teacher" | "parent"; uid: string; name?: string; text: string; at: string };
export type StudentDoc = { id: string; name: string; classId?: string; grade?: string; section?: string; roll?: number | string; grn?: string; guardian?: string; guardianUids?: string[]; status?: string; deleted?: boolean };
export const threadIdOf = (studentId: string, staffId: string) => `thr_${studentId}_${staffId}`;
/** "Class Teacher" for the student's class teacher, else the subject the teacher teaches that class (MessagesAdapter.roleFor) */
export function threadRole(classId: string, staffId: string, classes: { id: string; classTeacherId?: string }[], assignments: { teacherId?: string; classId?: string; subject?: string }[], fallback = "Teacher") {
  if (classes.find((c) => c.id === classId)?.classTeacherId === staffId) return "Class Teacher";
  return assignments.find((a) => a.teacherId === staffId && a.classId === classId && a.subject)?.subject || fallback;
}
/** a new msg_threads/thr_{studentId}_{staffId} document (keys per MessagesAdapter.write; `newThreadOk` wants no lastMessage / unread keys) */
export function threadDoc(student: StudentDoc, staffId: string, teacherName: string, role: string, now: string) {
  return {
    studentId: student.id, classId: student.classId ?? "", studentName: student.name ?? "", parentUids: [...(student.guardianUids ?? [])], guardian: student.guardian ?? "",
    teacherId: staffId, teacher: teacherName, role, createdAt: now,
  };
}
/** a msg_messages document from the teacher (parentUids / studentId / teacherId must equal the thread's: `messageMatchesThread`) */
export function messageDoc(thread: Pick<ThreadDoc, "id" | "studentId" | "teacherId" | "parentUids">, uid: string, teacherName: string, text: string, now: string) {
  return { threadId: thread.id, studentId: thread.studentId, teacherId: thread.teacherId, parentUids: [...thread.parentUids], from: "teacher" as const, uid, name: teacherName, text: text.trim(), at: now };
}
/** the only thread update a teacher may write: resetting her own unread counter (+ the stamp) */
export const threadReadPatch = () => ({ unreadTeacher: 0 });
/** a thread's messages oldest first */
export const threadMessages = (messages: MessageDoc[], threadId: string) =>
  messages.filter((m) => m.threadId === threadId).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
/** students a teacher can start a thread with: active students of her classes that have a parent login */
export function messageableStudents(students: StudentDoc[], classIds: string[]) {
  return students.filter((s) => !s.deleted && (s.status ?? "Active") === "Active" && s.classId && classIds.includes(s.classId))
    .map((s) => ({ ...s, blocked: (s.guardianUids ?? []).length ? "" : "No parent app login yet" }))
    .sort((a, b) => (a.classId ?? "").localeCompare(b.classId ?? "", "en", { numeric: true }) || rollNumber(a.roll) - rollNumber(b.roll) || a.name.localeCompare(b.name));
}
export const today = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
