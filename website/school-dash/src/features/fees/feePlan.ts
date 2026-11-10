import { classStream, feeScopeKey, feeScopeLabel, isSeniorGrade, parseFeeScope, streamName } from "@/lib/academicStreams";

export const FEE_FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Term-wise", "Annual", "One-time"] as const;
export type FeeFrequency = typeof FEE_FREQUENCIES[number];
export type FeeItem = {
  id: string; name: string; amount: number; grades: string[]; frequency: FeeFrequency;
  dueDate: string; mandatory: boolean; newStudentsOnly: boolean;
};
export type FeePlan = {
  schemaVersion: 2; academicYear: string; termsPerYear: number; grades: string[]; items: FeeItem[];
  late: number; upi: boolean; card: boolean;
};
export type GradeFeePlan = { grade: string; streamId?: string; stream?: string; academicYear?: string; schemaVersion?: number; termsPerYear?: number; items?: FeeItem[]; tuition: number; lab: number; activity: number; library: number; transport: number };
type LegacySetup = {
  fees?: Record<string, { tuition: number; lab: number; activity: number; library: number }>;
  dueDay?: number; late?: number; upi?: boolean; card?: boolean;
};
const GRADE_BANDS = [
  { id: "pre", grades: ["LKG", "UKG"] }, { id: "pri", grades: ["1", "2", "3", "4", "5"] },
  { id: "mid", grades: ["6", "7", "8"] }, { id: "sec", grades: ["9", "10", "11", "12"] },
];
const HEADS = ["tuition", "lab", "activity", "library"] as const;
const NAMES = { tuition: "Tuition", lab: "Laboratory", activity: "Activities", library: "Library" };
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Older plans had free-text transport items; bus pricing now belongs to tr_buses only. */
export const isTransportFee = (item: Pick<FeeItem, "name">) => /\b(?:transport(?:ation)?|bus)\b/i.test(item.name);
export const classLabel = feeScopeLabel;
export const gradePlanScope = (row: Pick<GradeFeePlan, "grade" | "streamId" | "stream">) => feeScopeKey(row.grade, classStream(row));
export const annualOccurrences = (frequency: FeeFrequency, terms: number) => ({ Monthly: 12, Quarterly: 4, "Half-yearly": 2, "Term-wise": terms, Annual: 1, "One-time": 0 })[frequency];
export const annualFee = (item: FeeItem, terms: number) => money(item.amount * annualOccurrences(item.frequency, terms));
export const recurringTotal = (items: FeeItem[], terms: number) => money(items.filter((item) => !isTransportFee(item) && item.mandatory && !item.newStudentsOnly).reduce((sum, item) => sum + annualFee(item, terms), 0));

export function initialFeePlan(saved: (Partial<FeePlan> & LegacySetup) | undefined, rows: GradeFeePlan[], defaults: { grades: string[]; academicYear: string; termsPerYear: number }): FeePlan {
  const base: FeePlan = { schemaVersion: 2, ...defaults, items: [], late: saved?.late ?? 0, upi: saved?.upi ?? true, card: saved?.card ?? true };
  if (saved?.schemaVersion === 2 && Array.isArray(saved.items)) return { ...base, ...saved, grades: defaults.grades, items: saved.items.filter((item) => !isTransportFee(item)).map((item) => ({ ...item, grades: defaults.grades.filter((key) => item.grades.includes(key) || item.grades.includes(parseFeeScope(key).grade)) })) };
  // A saved setup used annual amounts; existing Fees & Payments rows used per-term amounts.
  const sources = saved?.fees
    ? GRADE_BANDS.flatMap((band) => defaults.grades.filter((key) => band.grades.includes(parseFeeScope(key).grade)).map((grade) => ({ grade, ...saved.fees![band.id]!, transport: 0 })))
    : defaults.grades.flatMap((key) => {
      const { grade } = parseFeeScope(key);
      const row = rows.find((item) => gradePlanScope(item) === key) ?? rows.find((item) => item.grade === grade && !classStream(item));
      return row ? [{ ...row, grade: key }] : [];
    });
  const grouped = new Map<string, FeeItem>();
  for (const row of sources) {
    const configured = "schemaVersion" in row && row.schemaVersion === 2 && "items" in row && Array.isArray(row.items) ? row.items : null;
    if (configured) {
      for (const item of configured.filter((item) => !isTransportFee(item))) {
        const key = JSON.stringify({ ...item, id: "", grades: [] });
        const existing = grouped.get(key);
        if (existing) existing.grades.push(row.grade);
        else grouped.set(key, { ...item, id: `fee_${grouped.size + 1}`, grades: [row.grade] });
      }
      continue;
    }
    for (const head of HEADS) {
      const amount = row[head];
      if (!(amount > 0)) continue;
      const frequency: FeeFrequency = saved?.fees ? "Annual" : "Term-wise";
      const key = `${head}:${amount}:${frequency}`;
      const existing = grouped.get(key);
      if (existing) existing.grades.push(row.grade);
      else grouped.set(key, { id: `fee_${grouped.size + 1}`, name: NAMES[head], amount, frequency, grades: [row.grade], dueDate: "", mandatory: true, newStudentsOnly: false });
    }
  }
  return { ...base, items: [...grouped.values()] };
}

export function feePlanError(plan: FeePlan) {
  if (!/^\d{4}-\d{2}$/.test(plan.academicYear) || Number(plan.academicYear.slice(5)) !== (Number(plan.academicYear.slice(0, 4)) + 1) % 100) return "Enter an academic year such as 2026-27.";
  if (!Number.isInteger(plan.termsPerYear) || plan.termsPerYear < 1 || plan.termsPerYear > 4) return "Use between 1 and 4 terms per year.";
  if (!plan.grades.length || new Set(plan.grades).size !== plan.grades.length) return "Choose the classes covered by this fee plan.";
  if (plan.grades.some((key) => { const scope = parseFeeScope(key); return isSeniorGrade(scope.grade) && !scope.streamId; })) return "Choose a configured stream for Grades 11 and 12.";
  if (!plan.items.length) return "Add at least one fee item.";
  const ids = new Set<string>();
  for (const [index, item] of plan.items.entries()) {
    const label = item.name.trim() || `Fee item ${index + 1}`;
    if (!item.id || ids.has(item.id)) return "Fee items must have unique identifiers.";
    ids.add(item.id);
    if (!item.name.trim() || item.name.trim().length > 80) return `Fee item ${index + 1}: enter a name of up to 80 characters.`;
    if (isTransportFee(item)) return "Set transportation fees per bus under Transport → Buses.";
    if (!Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 10_000_000 || Math.abs(item.amount * 100 - Math.round(item.amount * 100)) > 0.00001) return `${label}: enter an amount above ₹0, with at most two decimal places.`;
    if (!FEE_FREQUENCIES.includes(item.frequency)) return `${label}: choose a collection frequency.`;
    if (!item.grades.length || item.grades.some((grade) => !plan.grades.includes(grade)) || new Set(item.grades).size !== item.grades.length) return `${label}: choose at least one applicable class.`;
    if (item.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) || !Number.isFinite(Date.parse(item.dueDate)) || new Date(item.dueDate).toISOString().slice(0, 10) !== item.dueDate)) return `${label}: choose a valid first due date or leave it blank.`;
  }
  for (let index = 0; index < plan.items.length; index++) {
    const current = plan.items[index]!;
    if (plan.items.slice(0, index).some((item) => item.name.trim().toLowerCase() === current.name.trim().toLowerCase() && item.grades.some((grade) => current.grades.includes(grade)))) return `${current.name.trim()}: another fee with this name already covers the same class.`;
  }
  if (!Number.isFinite(plan.late) || plan.late < 0 || plan.late > 10) return "Late fee should be between 0% and 10%.";
  return "";
}

export function normalizedFeePlan(plan: FeePlan): FeePlan {
  return { ...plan, items: plan.items.map((item) => ({ ...item, name: item.name.trim(), amount: money(item.amount), grades: plan.grades.filter((grade) => item.grades.includes(grade)) })) };
}

export function gradeFeeRecord(plan: FeePlan, key: string) {
  const { grade, streamId } = parseFeeScope(key);
  return { grade, ...(streamId ? { streamId, stream: streamName(streamId) } : {}), schemaVersion: 2, academicYear: plan.academicYear, termsPerYear: plan.termsPerYear, items: plan.items.filter((item) => !isTransportFee(item) && item.grades.includes(key)).map((item) => ({ ...item, grades: [key] })) };
}

/** Only required, general fees belong in a whole-class batch; opt-in and admission charges are billed individually. */
export function batchFeeItems(row: GradeFeePlan, frequency: FeeFrequency): FeeItem[] {
  return (row.items ?? []).filter((item) => !isTransportFee(item) && item.frequency === frequency && item.mandatory && !item.newStudentsOnly);
}
