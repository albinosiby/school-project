/* Circulars sent to selected classes and people (contract 10: com_notices.target*).
 * A class reaches its students' parents, its class teacher and every teacher assigned to it; a student reaches that
 * student's parents; a staff member reaches that person. The teacher ids are resolved when the circular is saved
 * (targetStaffIds), so the apps and the push function do not have to recompute who teaches a class. */

export const TARGETED = "Selected classes or people";

export type Target = { type: "class" | "student" | "staff"; id: string; label: string; sub: string };

export type Roster = {
  classes: { id: string; grade?: string | number; section?: string; classTeacherId?: string; classTeacher?: string }[];
  students: { id: string; name?: string; classId?: string; grade?: string | number; section?: string; status?: string }[];
  staff: { id: string; name?: string; role?: string; designation?: string; staffRole?: string; status?: string }[];
  assignments: { classId?: string; teacherId?: string }[];
};

const active = (s: { status?: string }) => !s.status || /^active$/i.test(s.status);
const activeStaff = (s: { status?: string }) => !/^(left|inactive|resigned|relieved)$/i.test(s.status ?? "");

export const classTitle = (c: { id: string; grade?: string | number; section?: string }) =>
  c.grade != null && c.grade !== "" ? `Class ${c.grade}${c.section ? `-${c.section}` : ""}` : c.id.replace(/^cls_/, "Class ");

const studentClass = (s: Roster["students"][number], classes: Map<string, Roster["classes"][number]>) => {
  const c = s.classId ? classes.get(s.classId) : undefined;
  if (c) return classTitle(c).replace(/^Class /, "");
  return s.grade != null && s.grade !== "" ? `${s.grade}${s.section ? `-${s.section}` : ""}` : "";
};

const staffRole = (s: Roster["staff"][number]) => s.designation || s.role || (s.staffRole ? s.staffRole.replace(/_/g, " ") : "Staff");

/** Suggestions for a search: matching classes first, then students and staff by name. */
export function suggest(query: string, roster: Roster, selected: Target[] = [], limit = 8): Target[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const taken = new Set(selected.map((t) => `${t.type}:${t.id}`));
  const classes = new Map(roster.classes.map((c) => [c.id, c]));
  const out: Target[] = [];
  const add = (t: Target) => { if (!taken.has(`${t.type}:${t.id}`) && out.length < limit) out.push(t); };
  const compact = q.replace(/^(class|grade|std)\s*/, "").replace(/[\s-]/g, "");
  for (const c of roster.classes) {
    const title = classTitle(c);
    const key = title.toLowerCase().replace(/^class /, "").replace(/[\s-]/g, "");
    if (title.toLowerCase().includes(q) || (compact && key.startsWith(compact))) {
      const n = roster.students.filter((s) => s.classId === c.id && active(s)).length;
      add({ type: "class", id: c.id, label: title, sub: `Class · ${n} student${n === 1 ? "" : "s"}${c.classTeacher ? ` · ${c.classTeacher}` : ""}` });
    }
  }
  const words = q.split(" ");
  const nameHit = (name?: string) => !!name && words.every((w) => name.toLowerCase().split(/\s+/).some((p) => p.startsWith(w)) || name.toLowerCase().includes(q));
  for (const s of roster.students) if (active(s) && nameHit(s.name)) add({ type: "student", id: s.id, label: s.name!, sub: `Student · ${studentClass(s, classes) || "No class"}` });
  for (const s of roster.staff) if (activeStaff(s) && nameHit(s.name)) add({ type: "staff", id: s.id, label: s.name!, sub: staffRole(s) });
  return out;
}

/** Who a set of targets reaches: student ids (their parents get it) and staff ids (teachers of the classes included). */
export function resolveTargets(targets: Target[], roster: Roster) {
  const classIds = targets.filter((t) => t.type === "class").map((t) => t.id);
  const students = new Set(targets.filter((t) => t.type === "student").map((t) => t.id));
  const staff = new Set(targets.filter((t) => t.type === "staff").map((t) => t.id));
  const cls = new Set(classIds);
  for (const s of roster.students) if (s.classId && cls.has(s.classId) && active(s)) students.add(s.id);
  for (const c of roster.classes) if (cls.has(c.id) && c.classTeacherId) staff.add(c.classTeacherId);
  for (const a of roster.assignments) if (a.classId && cls.has(a.classId) && a.teacherId) staff.add(a.teacherId);
  return {
    classIds,
    studentIds: [...students],
    staffIds: [...staff],
    /** students (their parents) + staff */
    count: students.size + staff.size,
    summary: targets.map((t) => (t.type === "student" ? `${t.label} (${t.sub.replace(/^Student · /, "")})` : t.label)).join(", "),
  };
}
