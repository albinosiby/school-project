// Deterministic demo fixture generator (contract section 8). Plain node, no deps.
//   node website/tools/demo_fixture/build.mjs
// Writes:
//   website/web/src/server/seed/demo_fixture.json          (admin seed input)
//   mobile app/teacher/lib/di/demo_fixture.g.dart           (teacher app seed input)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const JSON_OUT = resolve(here, "../../web/src/server/seed/demo_fixture.json");
const DART_OUT = resolve(here, "../../../mobile app/teacher/lib/di/demo_fixture.g.dart");

/* ---------------- school ---------------- */
const school = {
  id: "school", name: "Greenfield International School", short: "Greenfield Int.", board: "CBSE",
  affiliation: "#1930281", city: "New Delhi", academicYear: "2026-27", term: "Term 2",
};

/* ---------------- staff (timetable teachers; the other 18 admin staff stay as seeded) ---------------- */
const emailOf = (name) => `${name.replace(/^(Mr|Mrs|Ms|Dr)\.? /, "").toLowerCase().replace(/\s+/g, ".")}@greenfield.edu`;
const baseStaff = [
  { id: "stf_002", name: "Mr. Meera Rao", empId: "EMP-1003", department: "Hindi", role: "PGT", status: "Active", phone: "+91 8645153748" },
  { id: "stf_003", name: "Dr. Myra Sharma", empId: "EMP-1006", department: "Science", role: "HOD", status: "Active", phone: "+91 8757696806" },
  { id: "stf_006", name: "Mrs. Kavya Mehta", empId: "EMP-1015", department: "Physical Education", role: "HOD", status: "Active", phone: "+91 8177895777" },
  { id: "stf_008", name: "Mr. Om Patel", empId: "EMP-1021", department: "English", role: "Lab Assistant", status: "Active", phone: "+91 8253522529" },
  { id: "stf_010", name: "Dr. Isha Joshi", empId: "EMP-1027", department: "Social Science", role: "TGT", status: "Active", phone: "+91 8653626718" },
  { id: "stf_023", name: "Mrs. Kabir Nair", empId: "EMP-1066", department: "Mathematics", role: "PRT", status: "Active", phone: "+91 8116477768" },
].map((s) => ({ ...s, email: emailOf(s.name) }));
const anita = {
  id: "stf_025", name: "Mrs. Anita Sharma", empId: "EMP-2041", department: "Mathematics", role: "PGT", status: "Active",
  phone: "+91 98765 40012", email: "anita.sharma@greenfield.edu", designation: "Senior Faculty", subjects: "Math & Science", joined: "2014-06-02",
};
const staff = [anita, ...baseStaff].sort((a, b) => a.id.localeCompare(b.id));
const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
const ANITA = "stf_025";
// teacher -> the subject they teach in the generated timetable
const SUBJ = { stf_023: "Mathematics", stf_008: "English", stf_003: "Science", stf_010: "Social Science", stf_002: "Hindi", stf_006: "Physical Education" };
const POOL = Object.keys(SUBJ); // 6 non-Anita teachers
const ABSENT = "stf_003"; // teacher absent on the three substitution slots

/* ---------------- classes ---------------- */
const classDefs = [
  // id order for display; roster order for students is ROSTER_ORDER below
  { g: "8", s: "A", count: 38, classTeacherId: "stf_010", room: "Room 112", wing: "South Wing" },
  { g: "8", s: "B", count: 36, classTeacherId: "stf_008", room: "Room 114", wing: "South Wing" },
  { g: "8", s: "C", count: 40, classTeacherId: "stf_002", room: "Room 118", wing: "South Wing" },
  { g: "9", s: "A", count: 38, classTeacherId: "stf_003", room: "Lab 2", wing: "Science Block" },
  { g: "10", s: "A", count: 48, classTeacherId: "stf_023", room: "Room 201", wing: "North Wing" },
  { g: "10", s: "B", count: 42, classTeacherId: ANITA, room: "Room 204", wing: "North Wing" },
];
const classes = classDefs.map((c) => ({
  id: `cls_${c.g}${c.s}`, grade: c.g, section: c.s, classTeacherId: c.classTeacherId, room: c.room, wing: c.wing, studentCount: c.count,
}));
const cls = Object.fromEntries(classes.map((c) => [c.id, c]));

/* ---------------- students (teacher app generator logic, ids stu_101.. in class order) ---------------- */
const FIRST = ["Aarav", "Ananya", "Vihaan", "Diya", "Aditya", "Isha", "Arjun", "Meera", "Kabir", "Saanvi", "Rohan", "Tara", "Ishaan", "Kavya", "Reyansh", "Anika", "Dev", "Myra", "Yash", "Riya", "Neel", "Zoya", "Karan", "Navya", "Aryan", "Pari", "Veer", "Sara", "Om", "Aisha"];
const LAST = ["Sharma", "Mehta", "Kapoor", "Rao", "Iyer", "Nair", "Singh", "Gupta", "Reddy", "Verma", "Joshi", "Khan", "Patel", "Das", "Menon"];
const ROSTER_ORDER = ["cls_10B", "cls_9A", "cls_8C", "cls_10A", "cls_8A", "cls_8B"];
const students = [];
let n = 0;
for (const cid of ROSTER_ORDER) {
  const c = cls[cid];
  for (let i = 0; i < c.studentCount; i++, n++) {
    students.push({
      id: `stu_${101 + n}`,
      name: `${FIRST[n % FIRST.length]} ${LAST[(n * 7 + i) % LAST.length]}`,
      grn: `GIS-${9200 + n}`,
      grade: c.grade, section: c.section, classId: cid, roll: i + 1,
      guardian: `${n % 2 === 0 ? "Mr." : "Mrs."} ${LAST[(n * 3) % LAST.length]}`,
      phone: `+91 98${String(10000000 + n * 137).substring(0, 3)}${String(10000 + n * 37).padStart(5, "0").substring(0, 5)}`,
      status: "Active",
      attendance: 78 + ((n * 7) % 22),
      perfGrade: ["A1", "A2", "B1", "B2"][(n * 5) % 4],
    });
  }
}

/* ---------------- timetable ---------------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Anita's week from the teacher app home seed (_week): Mon..Sat x P1..P6. S = substitution duty (8-C), R = remedial lab (10-B), P = free
const WEEK = [
  ["10A", "9A", "10B", "9A", "S", "P"],
  ["10B", "10A", "P", "8C", "10B", "R"],
  ["R", "10B", "10A", "9A", "8C", "10A"],
  ["9A", "10A", "10B", "8C", "R", "10B"],
  ["10B", "P", "10A", "9A", "10A", "S"],
  ["10A", "9A", "R", "10B", "S", "P"],
];
const ANITA_CLASS = {
  "10A": { classId: "cls_10A", subject: "Mathematics", room: "Room 201", topic: "Quadratic Equations" },
  "10B": { classId: "cls_10B", subject: "Mathematics", room: "Room 204", topic: "Coordinate Geometry" },
  "9A": { classId: "cls_9A", subject: "Science", room: "Lab 2", topic: "Force & Motion" },
  "8C": { classId: "cls_8C", subject: "Physics", room: "Room 118", topic: "Light & Optics" },
};
// classes where Anita owns a subject: the same-subject colleague must not also teach it there
const BLOCKED = { cls_10A: ["stf_023"], cls_10B: ["stf_023"], cls_9A: ["stf_003"], cls_8C: ["stf_003"] };

const tally = Object.fromEntries(classes.map((c) => [c.id, {}]));
const periodRows = []; // id -> row, grid[classId][day][period]
const busy = new Map(); // `${day}_${p}` -> Set(teacherId)
const put = (classId, day, period, subject, teacherId, room) => {
  const c = cls[classId];
  periodRows.push({
    id: `per_${c.grade}${c.section}_${day}_${period}`, classId, grade: c.grade, section: c.section, day, period,
    subject, teacher: staffById[teacherId].name, teacherId, room,
  });
  const k = `${day}_${period}`;
  if (!busy.has(k)) busy.set(k, new Set());
  if (busy.get(k).has(teacherId)) throw new Error(`clash ${teacherId} ${k}`);
  busy.get(k).add(teacherId);
};

DAYS.forEach((day, d) => {
  for (let p = 1; p <= 6; p++) {
    const code = WEEK[d][p - 1];
    const forced = new Map(); // classId -> {teacherId, subject, room}
    if (code === "S") forced.set("cls_8C", { teacherId: ABSENT, subject: "Physics", room: "Science Lab 2" });
    else if (code === "R") forced.set("cls_10B", { teacherId: ANITA, subject: "Remedial Lab", room: "Math Lab" });
    else if (code !== "P") { const a = ANITA_CLASS[code]; forced.set(a.classId, { teacherId: ANITA, subject: a.subject, room: a.room }); }
    for (const [cid, f] of forced) put(cid, day, p, f.subject, f.teacherId, f.room);
    const taken = new Set([...forced.values()].map((f) => f.teacherId));
    const free = classes.map((c) => c.id).filter((c) => !forced.has(c));
    const avail = POOL.filter((t) => !taken.has(t));
    const off = (d * 7 + p * 3) % POOL.length;
    const pref = (t) => (POOL.indexOf(t) - off + POOL.length) % POOL.length;
    const ordered = [...avail].sort((a, b) => pref(a) - pref(b));
    const pick = (i, used) => {
      if (i === free.length) return [];
      const cid = free[i];
      const rot = ordered.slice((i + d) % ordered.length).concat(ordered.slice(0, (i + d) % ordered.length));
      // balance: least-used teacher in this class first (stable, keeps the rotation as tiebreak)
      rot.sort((a, b) => (tally[cid][a] ?? 0) - (tally[cid][b] ?? 0));
      for (const t of rot) {
        if (used.has(t) || (BLOCKED[cid] ?? []).includes(t)) continue;
        used.add(t);
        const rest = pick(i + 1, used);
        if (rest) return [[cid, t], ...rest];
        used.delete(t);
      }
      return null;
    };
    const asg = pick(0, new Set());
    if (!asg) throw new Error(`no assignment for ${day} P${p}`);
    for (const [cid, t] of asg) { put(cid, day, p, SUBJ[t], t, cls[cid].room); tally[cid][t] = (tally[cid][t] ?? 0) + 1; }
  }
});

/* ---------------- assignments (who teaches what) ---------------- */
const asgMap = new Map(); // `${classId}|${subject}` -> {teacherId, n}
for (const r of periodRows) {
  if (r.subject === "Remedial Lab") continue;
  if (r.classId === "cls_8C" && r.teacherId === ABSENT) continue; // substituted slots belong to the absent teacher, not an assignment
  const k = `${r.classId}|${r.subject}`;
  const e = asgMap.get(k) ?? { classId: r.classId, subject: r.subject, teacherId: r.teacherId, n: 0 };
  if (e.teacherId !== r.teacherId) throw new Error(`two teachers for ${k}`);
  e.n++; asgMap.set(k, e);
}
const topics = { "cls_10A|Mathematics": "Quadratic Equations", "cls_10B|Mathematics": "Coordinate Geometry", "cls_9A|Science": "Force & Motion", "cls_8C|Physics": "Light & Optics" };
const assignments = [...asgMap.values()]
  .sort((a, b) => a.classId.localeCompare(b.classId, "en", { numeric: true }) || a.subject.localeCompare(b.subject))
  .map((e, i) => ({
    id: `asg_${String(i + 1).padStart(3, "0")}`, classId: e.classId, subject: e.subject, teacherId: e.teacherId,
    ...(topics[`${e.classId}|${e.subject}`] ? { topic: topics[`${e.classId}|${e.subject}`] } : {}), periodsPerWeek: e.n,
  }));

/* ---------------- substitutions (current week: Mon 2026-10-26 .. Sat 2026-10-31) ---------------- */
const substitutions = [
  { id: "sub_1", date: "2026-10-26", day: "Mon", period: 5, classId: "cls_8C", subject: "Physics", absentTeacherId: ABSENT, substituteTeacherId: ANITA, status: "Assigned", topic: "Friction & Force Dynamics", note: "Practical verification in Science Lab 2. Safety goggles mandatory." },
  { id: "sub_2", date: "2026-10-30", day: "Fri", period: 6, classId: "cls_8C", subject: "Physics", absentTeacherId: ABSENT, substituteTeacherId: ANITA, status: "Accepted", topic: "Ch. 6 Light & Reflection", note: "Revise laws of reflection with ray diagram sheets." },
  { id: "sub_3", date: "2026-10-31", day: "Sat", period: 5, classId: "cls_8C", subject: "Physics", absentTeacherId: ABSENT, substituteTeacherId: ANITA, status: "Assigned", topic: "Ch. 7 Electricity", note: "Supervised self-study with chapter-end questions." },
];
for (const s of substitutions) {
  const slot = periodRows.find((r) => r.classId === s.classId && r.day === s.day && r.period === s.period);
  if (!slot || slot.teacherId !== s.absentTeacherId) throw new Error(`substitution ${s.id} does not match timetable`);
}

/* ---------------- exams ---------------- */
const candidates = students.map((s) => ({
  id: `cand_${s.id}`, studentId: s.id, name: s.name,
  roll: `#${s.grade}${s.section}-${String(s.roll).padStart(2, "0")}`, grn: s.grn,
  cls: `${s.grade}-${s.section}`, grade: s.grade, section: s.section,
}));
const paperClassIds = {};
for (const c of classes) (paperClassIds[c.grade] ??= []).push(c.id);

/* ---------------- sanity ---------------- */
for (const c of classes) {
  const cnt = students.filter((s) => s.classId === c.id).length;
  if (cnt !== c.studentCount) throw new Error(`roster ${c.id}: ${cnt}`);
  for (const d of DAYS) for (let p = 1; p <= 6; p++) if (!periodRows.some((r) => r.classId === c.id && r.day === d && r.period === p)) throw new Error(`hole ${c.id} ${d} ${p}`);
}

const fixture = {
  school, classes, staff, assignments, students, periods: periodRows, substitutions,
  exm_candidates: candidates, paperClassIds, rosteredClassIds: classes.map((c) => c.id),
};
mkdirSync(dirname(JSON_OUT), { recursive: true });
writeFileSync(JSON_OUT, JSON.stringify(fixture, null, 1) + "\n");

/* ---------------- Dart ---------------- */
const dq = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$").replace(/\n/g, "\\n")}'`;
const lit = (v, ind) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return dq(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const pad = "  ".repeat(ind + 1), end = "  ".repeat(ind);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + lit(x, ind + 1)).join(",\n")},\n${end}]` : "[]";
  const e = Object.entries(v);
  return e.length ? `{\n${e.map(([k, x]) => `${pad}${dq(k)}: ${lit(x, ind + 1)}`).join(",\n")},\n${end}}` : "{}";
};
const dart = `// GENERATED by website/tools/demo_fixture/build.mjs – do not edit
// ignore_for_file: lines_longer_than_80_chars

const Map<String, dynamic> fixtureSchool = ${lit(school, 0)};

const List<Map<String, dynamic>> fixtureClasses = ${lit(classes, 0)};

const List<Map<String, dynamic>> fixtureStaff = ${lit(staff, 0)};

const List<Map<String, dynamic>> fixtureStudents = ${lit(students, 0)};

const List<Map<String, dynamic>> fixtureAssignments = ${lit(assignments, 0)};

const List<Map<String, dynamic>> fixturePeriods = ${lit(periodRows, 0)};

const List<Map<String, dynamic>> fixtureSubstitutions = ${lit(substitutions, 0)};
`;
mkdirSync(dirname(DART_OUT), { recursive: true });
writeFileSync(DART_OUT, dart);
console.log(`fixture: ${classes.length} classes, ${staff.length} staff, ${students.length} students, ${assignments.length} assignments, ${periodRows.length} periods, ${substitutions.length} substitutions`);
