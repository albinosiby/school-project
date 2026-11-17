import { isIsoDate } from "./logic";
import { MAINTENANCE_FIELDS } from "./vehicleDetails";
import type { Bus } from "./types";

export const MAINTENANCE_RECORD_FIELDS = [...MAINTENANCE_FIELDS, { key: "maintenanceNotes", label: "Maintenance notes", kind: "text" }] as const;
export type MaintenanceKey = (typeof MAINTENANCE_RECORD_FIELDS)[number]["key"];
export type MaintenanceValues = Record<MaintenanceKey, string>;
export type MaintenanceChange = { field: MaintenanceKey; before: string | number | null; after: string | number | null };
export type MaintenanceHistory = { id: string; busId: string; changes: MaintenanceChange[]; updatedAt: string; updatedBy: string; editor: string };

export const maintenanceValues = (bus: Partial<Bus>): MaintenanceValues => Object.fromEntries(
  MAINTENANCE_RECORD_FIELDS.map(({ key }) => [key, String(bus[key] ?? "")]),
) as MaintenanceValues;

export function validateMaintenance(values: MaintenanceValues) {
  const errors: Partial<Record<MaintenanceKey, string>> = {};
  for (const { key, kind } of MAINTENANCE_RECORD_FIELDS) {
    const value = values[key].trim();
    if (!value) continue;
    if (kind === "date" && (!isIsoDate(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) errors[key] = "Enter a valid date";
    if (kind === "number" && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || (key === "serviceIntervalKm" && Number(value) === 0))) {
      errors[key] = key === "serviceIntervalKm" ? "Enter a positive whole number" : "Enter a nonnegative whole number";
    }
  }
  if (values.lastServiceDate && values.nextServiceDate && values.nextServiceDate < values.lastServiceDate) errors.nextServiceDate ??= "Next service cannot precede the last service";
  return errors;
}

export const maintenancePatch = (values: MaintenanceValues): Partial<Bus> => Object.fromEntries(
  MAINTENANCE_RECORD_FIELDS.map(({ key, kind }) => [key, kind === "number" ? (values[key].trim() ? Number(values[key]) : null) : values[key].trim()]),
);

export function maintenanceValue(bus: Partial<Bus>, key: MaintenanceKey): string | number | null {
  const value = bus[key];
  return typeof value === "string" ? value.trim() : value ?? (key === "odometerKm" || key === "serviceIntervalKm" ? null : "");
}

export function maintenanceChanges(bus: Partial<Bus>, patch: Partial<Bus>): MaintenanceChange[] {
  return MAINTENANCE_RECORD_FIELDS.flatMap(({ key }) => {
    if (patch[key] === undefined) return [];
    const before = maintenanceValue(bus, key), after = maintenanceValue(patch, key);
    return before === after ? [] : [{ field: key, before, after }];
  });
}
