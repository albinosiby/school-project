import { isIsoDate } from "./logic";
import { COMPLIANCE_FIELDS } from "./vehicleDetails";
import type { Bus } from "./types";

export type ComplianceKey = (typeof COMPLIANCE_FIELDS)[number]["key"];
export type ComplianceValues = Record<ComplianceKey, string>;
export type ComplianceChange = { field: ComplianceKey; before: string; after: string };
export type ComplianceHistory = {
  id: string; busId: string; changes: ComplianceChange[];
  updatedAt: string; updatedBy: string; editor: string;
};

export const complianceValues = (bus: Partial<Bus>): ComplianceValues => Object.fromEntries(
  COMPLIANCE_FIELDS.map(({ key }) => [key, bus[key] ?? ""]),
) as ComplianceValues;

export function validateCompliance(values: ComplianceValues) {
  const errors: Partial<Record<ComplianceKey, string>> = {};
  for (const { key, kind } of COMPLIANCE_FIELDS) {
    const value = values[key].trim();
    if (kind === "date" && value && (!isIsoDate(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) {
      errors[key] = "Enter a valid date";
    }
  }
  if (values.registrationDate && values.registrationValidUntil && values.registrationValidUntil < values.registrationDate) {
    errors.registrationValidUntil ??= "Registration expiry cannot precede the registration date";
  }
  return errors;
}

export function complianceChanges(bus: Partial<Bus>, patch: Partial<Bus>): ComplianceChange[] {
  return COMPLIANCE_FIELDS.flatMap(({ key }) => {
    if (patch[key] === undefined) return [];
    const before = bus[key] ?? "", after = patch[key]?.trim() ?? "";
    return before === after ? [] : [{ field: key, before, after }];
  });
}
