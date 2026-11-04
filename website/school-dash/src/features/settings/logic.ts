// Pure rules of Settings (terms, grading bands, school/school sync). Data contract section 3.

type TermLike = { id: string; name: string; start: string; end: string; status?: string };
const ymd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

/** Calendar days from start to end inclusive (0 when the dates are invalid or reversed). */
export function termDays(start: string, end: string) {
  if (!ymd(start) || !ymd(end) || end < start) return 0;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 864e5) + 1;
}

/** First problem with a term draft, or "" (name required + unique, end after start, no overlap, one In Progress term). */
export function termError(t: TermLike, all: TermLike[]): string {
  const name = t.name.trim();
  if (!name) return "Term name is required";
  if (!ymd(t.start) || !ymd(t.end) || t.end <= t.start) return "Pick a start and an end date after it";
  const others = all.filter((x) => x.id !== t.id);
  if (others.some((x) => x.name.trim().toLowerCase() === name.toLowerCase())) return "Another term already has this name";
  const clash = others.find((x) => ymd(x.start) && ymd(x.end) && x.start <= t.end && x.end >= t.start);
  if (clash) return `Dates overlap ${clash.name}`;
  if (t.status === "In Progress" && others.some((x) => x.status === "In Progress")) return "Only one term can be In Progress. Close the current term first";
  return "";
}

type BandLike = { id: string; grade: string; min: number; point: number };
/** Grading bands: whole numbers 0–100, and a higher grade (more points) needs a strictly higher minimum. "" when valid. */
export function bandsError(bands: BandLike[]): string {
  if (bands.some((b) => !Number.isInteger(b.min) || b.min < 0 || b.min > 100)) return "Minimum percentages must be whole numbers from 0 to 100";
  const sorted = [...bands].sort((a, b) => b.point - a.point);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.min >= sorted[i - 1]!.min) return `${sorted[i - 1]!.grade} must need a higher percentage than ${sorted[i]!.grade}`;
  }
  return "";
}

type School = { name?: string; short?: string; affiliation?: string; term?: string; academicYear?: string };
/** The school/school fields that change (empty values never overwrite a stored one); null when nothing changes. */
export function schoolPatch(cur: School | undefined, next: School): School | null {
  const out: School = {};
  for (const [k, v] of Object.entries(next) as [keyof School, string | undefined][]) {
    if (typeof v !== "string" || !v.trim()) continue;
    if ((cur?.[k] ?? "") !== v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}
