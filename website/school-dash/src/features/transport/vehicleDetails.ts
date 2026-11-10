import { isIsoDate, validateBusIdentity } from "./logic";
import { FUEL_TYPES, VEHICLE_TYPES, type Bus } from "./types";

export const COMPLIANCE_FIELDS = [
  { key: "registrationDate", label: "Registration date", kind: "date" },
  { key: "registrationValidUntil", label: "Registration valid until", kind: "date" },
  { key: "fitnessCertificateNumber", label: "Fitness certificate number", kind: "text" },
  { key: "fitnessExpiryDate", label: "Fitness expiry date", kind: "date" },
  { key: "insurancePolicyNumber", label: "Insurance policy number", kind: "text" },
  { key: "insuranceProvider", label: "Insurance provider", kind: "text" },
  { key: "insuranceExpiryDate", label: "Insurance expiry date", kind: "date" },
  { key: "permitNumber", label: "Permit number", kind: "text" },
  { key: "permitType", label: "Permit type", kind: "select" },
  { key: "permitExpiryDate", label: "Permit expiry date", kind: "date" },
  { key: "pollutionCertificateNumber", label: "Pollution certificate number", kind: "text" },
  { key: "pucExpiryDate", label: "PUC expiry date", kind: "date" },
  { key: "roadTaxValidUntil", label: "Road tax valid until", kind: "date" },
] as const;

export const EQUIPMENT_FIELDS = [
  ["acAvailable", "AC available"], ["gpsInstalled", "GPS installed"], ["cctvInstalled", "CCTV installed"],
  ["firstAidKit", "First aid kit"], ["fireExtinguisher", "Fire extinguisher"],
] as const;

export const MAINTENANCE_FIELDS = [
  { key: "lastServiceDate", label: "Last service date", kind: "date" },
  { key: "nextServiceDate", label: "Next service date", kind: "date" },
  { key: "odometerKm", label: "Current odometer reading (km)", kind: "number" },
  { key: "serviceIntervalKm", label: "Service interval (km)", kind: "number" },
  { key: "lastInspectionDate", label: "Last inspection date", kind: "date" },
] as const;

const DETAILS_FIELDS = [...COMPLIANCE_FIELDS, ...MAINTENANCE_FIELDS] as const;
export type VehicleInput = Record<
  "number" | "regNo" | "displayName" | "vehicleType" | "model" | "manufacturingYear" | "chassisNumber" |
  "engineNumber" | "fuelType" | "endPoint" | "capacity" | "totalSeats" | "maintenanceNotes" |
  (typeof DETAILS_FIELDS)[number]["key"] | (typeof EQUIPMENT_FIELDS)[number][0], string
>;

export function vehicleInput(bus?: Bus): VehicleInput {
  return {
    number: bus?.number ?? "", regNo: bus?.regNo ?? "", displayName: bus?.displayName ?? "",
    vehicleType: bus?.vehicleType ?? "", model: bus?.model ?? "", manufacturingYear: String(bus?.manufacturingYear ?? ""),
    chassisNumber: bus?.chassisNumber ?? "", engineNumber: bus?.engineNumber ?? "", fuelType: bus?.fuelType ?? "",
    endPoint: bus?.endPoint ?? "", totalSeats: String(bus?.totalSeats ?? bus?.capacity ?? ""),
    capacity: String(bus?.capacity ?? ""), maintenanceNotes: bus?.maintenanceNotes ?? "",
    ...Object.fromEntries(DETAILS_FIELDS.map(({ key }) => [key, String(bus?.[key] ?? "")])),
    ...Object.fromEntries(EQUIPMENT_FIELDS.map(([key]) => [key, bus?.[key] ? "yes" : "no"])),
  } as VehicleInput;
}

const integer = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

export function validateVehicle(f: VehicleInput, buses: Bus[], year: number, edit?: Bus, assigned = 0) {
  const errors = validateBusIdentity(f, buses, edit?.id, assigned);
  for (const [key, label] of [
    ["model", "Model"], ["chassisNumber", "Chassis number"], ["engineNumber", "Engine number"], ["endPoint", "End-point location"],
  ] as const) {
    if (!f[key].trim()) errors[key] = `${label} is required`;
  }
  const vehicleType = VEHICLE_TYPES.find((value) => value === f.vehicleType);
  const fuelType = FUEL_TYPES.find((value) => value === f.fuelType);
  if (!vehicleType) errors.vehicleType = "Choose a vehicle type";
  if (!fuelType) errors.fuelType = "Choose a fuel type";
  if (!integer(f.manufacturingYear) || Number(f.manufacturingYear) < 1900 || Number(f.manufacturingYear) > year) {
    errors.manufacturingYear = `Enter a year from 1900 to ${year}`;
  }
  if (!integer(f.totalSeats) || Number(f.totalSeats) < 1 || Number(f.totalSeats) > 120) {
    errors.totalSeats = "Enter a whole number from 1 to 120";
  } else if (!errors.capacity && Number(f.capacity) > Number(f.totalSeats)) {
    errors.capacity = "Student seating cannot exceed total seating";
  }
  for (const { key, kind } of DETAILS_FIELDS) {
    const value = f[key].trim();
    if (!value) continue;
    if (kind === "date" && (!isIsoDate(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) {
      errors[key] = "Enter a valid date";
    }
    if (kind === "number" && (!integer(value) || (key === "serviceIntervalKm" && Number(value) === 0))) {
      errors[key] = key === "serviceIntervalKm" ? "Enter a positive whole number" : "Enter a nonnegative whole number";
    }
  }
  if (f.registrationDate && f.registrationValidUntil && f.registrationValidUntil < f.registrationDate) {
    errors.registrationValidUntil ??= "Registration expiry cannot precede the registration date";
  }
  if (f.lastServiceDate && f.nextServiceDate && f.nextServiceDate < f.lastServiceDate) {
    errors.nextServiceDate ??= "Next service cannot precede the last service";
  }
  if (Object.keys(errors).length || !vehicleType || !fuelType) return { errors };

  const details = Object.fromEntries(DETAILS_FIELDS.map(({ key, kind }) => [
    key, kind === "number" ? (f[key].trim() ? Number(f[key]) : null) : f[key].trim(),
  ]));
  const equipment = Object.fromEntries(EQUIPMENT_FIELDS.map(([key]) => [key, f[key] === "yes"]));
  const values = {
    ...details, ...equipment,
    number: f.number.trim(), regNo: f.regNo.trim().toUpperCase().replace(/\s+/g, "-"),
    displayName: f.displayName.trim(), vehicleType, fuelType, model: f.model.trim(),
    manufacturingYear: Number(f.manufacturingYear), chassisNumber: f.chassisNumber.trim(),
    engineNumber: f.engineNumber.trim(), endPoint: f.endPoint.trim(), capacity: Number(f.capacity),
    totalSeats: Number(f.totalSeats), maintenanceNotes: f.maintenanceNotes.trim(),
  } satisfies Partial<Bus>;
  return { values, errors };
}
