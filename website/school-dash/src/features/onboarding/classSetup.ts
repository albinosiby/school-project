import { classIdOf, isSeniorGrade, sectionLabel, SENIOR_STREAMS, type StreamId } from "@/lib/academicStreams";

export const SETUP_GRADES = ["LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => String(index + 1))];
export type StreamCfg = { id: StreamId; sections: number; cap: number };
export type GradeCfg = { grade: string; sections: number; cap: number; streams?: StreamCfg[] };
export const gradeName = (grade: string) => isNaN(Number(grade)) ? grade : `Grade ${grade}`;
export const sectionLetters = (count: number) => Array.from({ length: Math.max(0, Math.min(8, count)) }, (_, index) => String.fromCharCode(65 + index));
export const bandOf = (grade: string) => grade === "LKG" || grade === "UKG" ? "Pre-Primary" : Number(grade) <= 5 ? "Primary" : Number(grade) <= 8 ? "Middle" : isSeniorGrade(grade) ? "Senior Secondary" : "Secondary";
export const sectionCount = (row: GradeCfg) => isSeniorGrade(row.grade) && row.streams ? row.streams.reduce((sum, stream) => sum + stream.sections, 0) : row.sections;
export const gradeCapacity = (row: GradeCfg) => isSeniorGrade(row.grade) && row.streams ? row.streams.reduce((sum, stream) => sum + stream.sections * stream.cap, 0) : row.sections * row.cap;

export function sectionsError(rows: GradeCfg[]) {
  for (const row of rows) {
    const groups = isSeniorGrade(row.grade) && row.streams ? row.streams : [row];
    for (const group of groups) {
      if (!Number.isInteger(group.sections) || group.sections < 0 || group.sections > 8) return "Use between 0 and 8 sections per class or stream.";
      if (group.sections && (!Number.isInteger(group.cap) || group.cap < 10 || group.cap > 60)) return "Seat capacity per section should be between 10 and 60.";
    }
  }
  const active = rows.filter((row) => sectionCount(row) > 0);
  if (!active.length) return "Enable at least one grade by giving it one or more sections.";
  for (const row of active) {
    if (isSeniorGrade(row.grade)) {
      if (!row.streams?.some((stream) => stream.sections > 0)) return `Configure at least one stream for ${gradeName(row.grade)}.`;
      const ids = row.streams.map((stream) => stream.id);
      if (new Set(ids).size !== ids.length || ids.some((id) => !SENIOR_STREAMS.some((stream) => stream.id === id))) return `${gradeName(row.grade)}: choose distinct supported streams.`;
    }
  }
  return "";
}

export function classesFor(rows: GradeCfg[]) {
  return rows.flatMap((row) => {
    if (isSeniorGrade(row.grade) && row.streams) return row.streams.flatMap((stream) => sectionLetters(stream.sections).map((section) => ({
      id: classIdOf(row.grade, section, stream.id), grade: row.grade, section, streamId: stream.id, stream: SENIOR_STREAMS.find((item) => item.id === stream.id)!.name,
    })));
    return sectionLetters(row.sections).map((section) => ({ id: classIdOf(row.grade, section), grade: row.grade, section }));
  });
}

export function sectionRowsFor(rows: GradeCfg[]) {
  return rows.flatMap((row) => {
    if (isSeniorGrade(row.grade) && row.streams) return row.streams.filter((stream) => stream.sections > 0).map((stream) => ({
      grade: gradeName(row.grade), stream: SENIOR_STREAMS.find((item) => item.id === stream.id)!.name, streamId: stream.id,
      sections: sectionLetters(stream.sections).map((section) => sectionLabel(row.grade, section, stream.id)), roster: 0, cap: stream.sections * stream.cap,
    }));
    return row.sections > 0 ? [{ grade: gradeName(row.grade), stream: bandOf(row.grade), sections: sectionLetters(row.sections).map((section) => sectionLabel(row.grade, section)), roster: 0, cap: row.sections * row.cap }] : [];
  });
}

export { labelToClassId as classIdOfLabel } from "@/lib/academicStreams";
