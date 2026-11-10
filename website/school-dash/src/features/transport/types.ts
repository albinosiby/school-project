// Transport module types, data contract section 14 (schools/{sid}/tr_* collections).
export type CrewRole = "driver" | "attendant";
export type CrewStatus = "Active" | "On leave" | "Inactive";
/** tr_crew/{crw_001} */
export type Crew = { id: string; name: string; role: CrewRole; empId: string; phone: string; email: string; authUid?: string; staffId?: string; status: CrewStatus; busId?: string; bus?: string;
  licenseNo?: string; licenseExpiry?: string; joined?: string; address?: string; emergencyName?: string; emergencyPhone?: string; photoUrl?: string; leaveFrom?: string; leaveTo?: string; leaveReason?: string };

/** one entry of tr_buses.stops, in route order (the school is not a stop) */
export type BusStop = { id: string; name: string; pickupTime: string; dropTime: string; landmark?: string };
export const VEHICLE_TYPES = ["School Bus", "Mini Bus", "Van", "Traveller", "Other"] as const;
export const FUEL_TYPES = ["Diesel", "Petrol", "CNG", "Electric", "Hybrid"] as const;
export const PERMIT_TYPES = ["School transport", "Contract carriage", "Other"] as const;

export type VehicleDetails = {
  displayName?: string; vehicleType?: (typeof VEHICLE_TYPES)[number]; manufacturingYear?: number;
  chassisNumber?: string; engineNumber?: string; fuelType?: (typeof FUEL_TYPES)[number];
  endPoint?: string; totalSeats?: number;
  registrationDate?: string; registrationValidUntil?: string;
  fitnessCertificateNumber?: string; fitnessExpiryDate?: string;
  insurancePolicyNumber?: string; insuranceProvider?: string; insuranceExpiryDate?: string;
  permitNumber?: string; permitType?: string; permitExpiryDate?: string;
  pollutionCertificateNumber?: string; pucExpiryDate?: string; roadTaxValidUntil?: string;
  acAvailable?: boolean; gpsInstalled?: boolean; cctvInstalled?: boolean; firstAidKit?: boolean; fireExtinguisher?: boolean;
  lastServiceDate?: string; nextServiceDate?: string; odometerKm?: number | null; serviceIntervalKm?: number | null;
  lastInspectionDate?: string; maintenanceNotes?: string;
};

export type BusStatus = "Active" | "Maintenance" | "Inactive";
/** tr_buses/{bus_01} */
export type Bus = VehicleDetails & { id: string; number: string; regNo: string; capacity: number; model?: string; routeName: string; driverId?: string; driver?: string; attendantId?: string; attendant?: string;
  stops: BusStop[]; pickupStart: string; dropStart: string; status: BusStatus; studentCount: number; note?: string;
  /** Monthly amount per assigned student. Missing/null means not configured; 0 means free transport. */
  monthlyFee?: number | null };

export type TripKind = "pickup" | "drop";
export type TripStatus = "scheduled" | "active" | "completed";
export type Checklist = { brakes: boolean; lights: boolean; tyres: boolean; fuel: boolean; firstAid: boolean; cleanliness: boolean };
/** tr_trips/{date}_{busId}_{kind} */
export type Trip = { id: string; busId: string; bus: string; routeName: string; date: string; kind: TripKind; status: TripStatus; driverId?: string; driver?: string; attendantId?: string; attendant?: string;
  total: number; boarded: number; dropped: number; absent: number; startedAt?: string; startedBy?: string; endedAt?: string; endedBy?: string; checklist?: Checklist; checklistAt?: string;
  odometerStart?: number; odometerEnd?: number; note?: string; currentStopId?: string };

export type MarkStatus = "boarded" | "absent" | "dropped";
export type Mark = { status: MarkStatus; at: string; by: string; byName?: string; stopId?: string };
/** tr_attendance/{date}_{busId}_{kind} (same id as the trip) */
export type TripAttendance = { id: string; tripId: string; busId: string; bus: string; date: string; kind: TripKind; total: number; marks: Record<string, Mark>; boarded: number; dropped: number; absent: number };

export type CrewAttStatus = "Present" | "Late" | "Absent" | "Leave";
/** tr_crew_attendance/{date}_{crewId} */
export type CrewAttendance = { id: string; crewId: string; name: string; role: CrewRole; busId?: string; date: string; in: string | null; out: string | null; status: CrewAttStatus; source: "app" | "admin"; note?: string };

export type LeaveStatus = "Pending" | "Approved" | "Rejected";
/** tr_crew_leaves/{id} */
export type CrewLeave = { id: string; crewId: string; name: string; role: CrewRole; busId?: string; type: string; from: string; to: string; days: number; reason: string; status: LeaveStatus; appliedAt?: string; decidedBy?: string; decidedAt?: string; decisionNote?: string };

/** tr_settings/policy */
export type TransportSettings = { id: string; checkInBy: string };
