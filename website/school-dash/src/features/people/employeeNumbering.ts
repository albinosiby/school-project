import { formatAdmissionNumber, validNumberTemplate } from "@/features/admissions/numbering";
import defaults from "../../../../functions/staffNumberingDefaults.json";

export type EmployeeNumbering = { id: string; template: string; start: number; next?: number };
export const defaultEmployeeNumbering: EmployeeNumbering = defaults;

export function formatEmployeeId(template: string, sequence: number) {
  const year = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" });
  return formatAdmissionNumber(template, year, sequence).toUpperCase();
}

export const validGeneratedEmployeeId = (id: string) => /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(id);

export function previewEmployeeId(numbering: EmployeeNumbering, staff: readonly { empId?: string }[]) {
  const { template, start, next = start } = numbering;
  if (typeof template !== "string" || !validNumberTemplate(template) || !Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(next) || next < 1) return "";
  const used = new Set(staff.map((member) => member.empId?.trim().toUpperCase()));
  for (let sequence = Math.max(start, next); sequence < Number.MAX_SAFE_INTEGER; sequence++) {
    const id = formatEmployeeId(template, sequence);
    if (!validGeneratedEmployeeId(id)) return "";
    if (!used.has(id)) return id;
  }
  return "";
}
