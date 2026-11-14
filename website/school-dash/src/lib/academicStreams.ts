export const SENIOR_STREAMS = [
  { id: "science", name: "Science" },
  { id: "commerce", name: "Commerce" },
  { id: "humanities", name: "Humanities" },
] as const;
export type CourseId = `course_${string}`;
export type StreamId = typeof SENIOR_STREAMS[number]["id"] | CourseId;
export const isCourseId = (id: string): id is CourseId => /^course_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(id) && id.length <= 56;
export const courseIdOf = (name: string) => {
  const id = "course_" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return isCourseId(id) ? id : "";
};
export const isSeniorGrade = (grade: string) => grade === "11" || grade === "12";
/** School order of grades: LKG, UKG, then 1..12; unknown labels sort after, alphabetically. */
export const gradeOrder = (grade: string) => {
  const key = (grade ?? "").trim().toUpperCase();
  if (key === "LKG") return 0;
  if (key === "UKG") return 1;
  const n = Number(key);
  return Number.isFinite(n) && key !== "" ? 1 + n : 100;
};
export const compareGrades = (a: string, b: string) => gradeOrder(a) - gradeOrder(b) || a.localeCompare(b);
export function streamIdOf(value?: string): StreamId | "" {
  const key = (value ?? "").trim().toLowerCase();
  if (["science", "sci"].includes(key)) return "science";
  if (["commerce", "com"].includes(key)) return "commerce";
  if (["humanities", "arts", "hum"].includes(key)) return "humanities";
  if (isCourseId(key)) return key;
  return "";
}
export const streamName = (id?: string) => {
  const key = streamIdOf(id);
  return isCourseId(key) ? key.slice(7).split("_").map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ")
    : SENIOR_STREAMS.find((stream) => stream.id === key)?.name ?? "";
};
export const classIdOf = (grade: string, section: string, stream?: string) => {
  const g = String(grade ?? "").trim(), s = String(section ?? "").trim().toUpperCase(), id = streamIdOf(stream);
  return isSeniorGrade(g) && id ? `cls_${g}_${id}_${s}` : `cls_${g}${s}`;
};
export const sectionLabel = (grade: string, section: string, stream?: string) => `${grade}${isSeniorGrade(grade) && streamIdOf(stream) ? `-${streamName(stream)}` : ""}-${section}`;
export function labelToClassId(label: string) {
  const parts = label.replace(/^Grade\s+/i, "").split("-");
  const name = parts.slice(1, -1).join("-");
  return classIdOf(parts[0] ?? "", parts.at(-1) ?? "", name ? streamIdOf(name) || courseIdOf(name) : undefined);
}
export const seniorClassParts = (id = "") => /^cls_(11|12)_(science|commerce|humanities|course_[a-z0-9]+(?:_[a-z0-9]+)*)_([A-H])$/.exec(id);
export function classIdLabel(id = "") {
  const senior = seniorClassParts(id);
  if (senior) return sectionLabel(senior[1]!, senior[3]!, senior[2]);
  return id.replace(/^cls_(\d+|LKG|UKG)([A-H])$/, "$1-$2");
}
export const feeScopeKey = (grade: string, stream?: string) => isSeniorGrade(grade) && streamIdOf(stream) ? `${grade}:${streamIdOf(stream)}` : grade;
export function parseFeeScope(key: string) {
  const [grade = "", rawStream] = key.split(":");
  return { grade, streamId: isSeniorGrade(grade) ? streamIdOf(rawStream) : "" };
}
export const feeScopeLabel = (key: string) => {
  const { grade, streamId } = parseFeeScope(key);
  return `${/^\d+$/.test(grade) ? `Grade ${grade}` : grade}${streamId ? ` · ${streamName(streamId)}` : ""}`;
};
export type AcademicClass = { id: string; grade: string; section: string; streamId?: string; stream?: string; capacity?: number; subjects?: string[] };
export const classStream = (row: Pick<AcademicClass, "streamId" | "stream">) => streamIdOf(row.streamId ?? row.stream);
export const streamFromClassId = (id?: string) => streamIdOf(seniorClassParts(id)?.[2]);
export function streamsForGrade(classes: Pick<AcademicClass, "grade" | "streamId" | "stream">[], grade: string) {
  const streams = new Map<StreamId, string>();
  for (const row of classes) {
    const id = classStream(row);
    if (row.grade === grade && id) streams.set(id, row.stream || streamName(id));
  }
  return [...streams].map(([id, name]) => ({ id, name }));
}
export function feeScopesForClasses(classes: AcademicClass[]) {
  const keys = new Set(classes.flatMap((row) => isSeniorGrade(row.grade) && !classStream(row) ? [] : [feeScopeKey(row.grade, classStream(row))]));
  return ["LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => String(index + 1))].flatMap((grade) => {
    if (!isSeniorGrade(grade)) return keys.has(grade) ? [grade] : [];
    const ordered = [...SENIOR_STREAMS.map((s) => s.id), ...streamsForGrade(classes, grade).map((s) => s.id).filter(isCourseId).sort()];
    return ordered.map((id) => feeScopeKey(grade, id)).filter((key) => keys.has(key));
  });
}
/** Never guess between Science A and Commerce A when a legacy student has no stream. */
export function studentStream(student: { classId?: string; grade: string; section: string; streamId?: string; stream?: string }, classes: AcademicClass[]) {
  if (!isSeniorGrade(student.grade)) return "";
  const linked = student.classId ? classes.find((row) => row.id === student.classId && row.grade === student.grade) : undefined;
  if (linked) return classStream(linked);
  const explicit = streamIdOf(student.streamId ?? student.stream) || streamFromClassId(student.classId);
  if (explicit) return explicit;
  return "";
}
