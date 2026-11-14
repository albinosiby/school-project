import { courseIdOf, streamIdOf } from "@/lib/academicStreams";
import type { SchoolDepartment } from "@/lib/schoolSubjects";

/** Display one choice per department name without migrating existing staff identifiers. */
export function departmentChoices(departments: SchoolDepartment[], selectedId = "") {
  const groups = new Map<string, { label: string; ids: string[] }>();
  const seenIds = new Set<string>();
  for (const department of departments) {
    const name = department.name.trim().replace(/\s+/g, " ");
    if (!department.id || !name || seenIds.has(department.id)) continue;
    seenIds.add(department.id);
    const key = name.toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.ids.push(department.id);
    else groups.set(key, { label: name.split(" ").map((word) => word === word.toLowerCase()
      ? word.replace(/\p{L}/u, (letter) => letter.toUpperCase()) : word).join(" "), ids: [department.id] });
  }
  return [...groups.values()].map(({ label, ids }) => {
    const setupId = streamIdOf(label) || courseIdOf(label);
    return { label, value: ids.includes(selectedId) ? selectedId : ids.find((id) => id === setupId) ?? ids[0]! };
  });
}
