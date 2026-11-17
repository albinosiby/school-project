"use client";

import { runTransaction } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Student } from "@/features/people/StudentsView";
import { complianceChanges, complianceValues, validateCompliance } from "./complianceRecords";
import { maintenanceChanges, maintenanceValue, maintenanceValues, validateMaintenance, MAINTENANCE_RECORD_FIELDS } from "./maintenanceRecords";
import { COMPLIANCE_FIELDS } from "./vehicleDetails";
import { planBusEdit, schoolDoc, stamp, stopsOf } from "./shared";
import type { Bus, Crew } from "./types";

export const busDetailsHref = (busId: string) => `/transport/buses/${encodeURIComponent(busId)}`;

/** Keep the bus, rider stop labels and crew bus names in sync in one commit. */
export async function saveBusEdit(bus: Bus, patch: Partial<Bus>, students: Student[], crew: Crew[]) {
  const intendedChanges = complianceChanges(bus, patch);
  const historyRef = intendedChanges.length ? schoolDoc("tr_bus_compliance_history", crypto.randomUUID()) : null;
  const maintenance = maintenanceChanges(bus, patch);
  const maintenanceHistoryRef = maintenance.length ? schoolDoc("tr_bus_maintenance_history", crypto.randomUUID()) : null;
  // Omit untouched compliance and maintenance fields so a vehicle-only edit cannot overwrite a renewal from another window.
  const update = { ...patch };
  for (const { key } of COMPLIANCE_FIELDS) delete update[key];
  for (const change of intendedChanges) update[change.field] = change.after;
  for (const { key } of MAINTENANCE_RECORD_FIELDS) delete update[key];
  for (const change of maintenance) Object.assign(update, { [change.field]: change.after });
  await runTransaction(db, async (transaction) => {
    const ref = schoolDoc("tr_buses", bus.id);
    const saved = await transaction.get(ref);
    if (!saved.exists()) throw new Error("This bus no longer exists.");
    const current = saved.data() as Bus;
    for (const change of intendedChanges) {
      if ((current[change.field] ?? "") !== change.before) {
        throw new Error("Compliance details changed in another window. Cancel and reopen the editor to review them.");
      }
    }
    if (intendedChanges.length) {
      const errors = validateCompliance(complianceValues({ ...current, ...update }));
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    }
    for (const change of maintenance) {
      if (!Object.is(maintenanceValue(current, change.field), change.before)) throw new Error("Maintenance details changed in another window. Cancel and reopen the editor to review them.");
    }
    if (maintenance.length) {
      const errors = validateMaintenance(maintenanceValues({ ...current, ...update }));
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    }
    const updated = stamp();
    const sync = planBusEdit({ id: bus.id, number: update.number ?? current.number, stops: update.stops ?? stopsOf(current) }, students, crew);
    transaction.update(ref, { ...update, studentCount: sync.studentCount, ...updated });
    sync.students.forEach((change, id) => transaction.update(schoolDoc("students", id), { ...change, ...updated }));
    sync.crew.forEach((change, id) => transaction.update(schoolDoc("tr_crew", id), { ...change, ...updated }));
    if (maintenanceHistoryRef) transaction.set(maintenanceHistoryRef, { id: maintenanceHistoryRef.id, busId: bus.id, changes: maintenance,
      editor: auth.currentUser?.displayName || auth.currentUser?.email || updated.updatedBy, ...updated });
    if (historyRef) transaction.set(historyRef, { id: historyRef.id, busId: bus.id, changes: intendedChanges,
      editor: auth.currentUser?.displayName || auth.currentUser?.email || updated.updatedBy, ...updated });
  });
}
