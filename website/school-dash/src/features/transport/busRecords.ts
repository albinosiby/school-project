"use client";

import { writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Student } from "@/features/people/StudentsView";
import { planBusEdit, schoolDoc, stamp, stopsOf } from "./shared";
import type { Bus, Crew } from "./types";

export const busDetailsHref = (busId: string) => `/transport/buses/${encodeURIComponent(busId)}`;

/** Keep the bus, rider stop labels and crew bus names in sync in one commit. */
export async function saveBusEdit(bus: Bus, patch: Partial<Bus>, students: Student[], crew: Crew[]) {
  const batch = writeBatch(db);
  const updated = stamp();
  const sync = planBusEdit({ id: bus.id, number: patch.number ?? bus.number, stops: patch.stops ?? stopsOf(bus) }, students, crew);
  batch.update(schoolDoc("tr_buses", bus.id), { ...patch, studentCount: sync.studentCount, ...updated });
  sync.students.forEach((change, id) => batch.update(schoolDoc("students", id), { ...change, ...updated }));
  sync.crew.forEach((change, id) => batch.update(schoolDoc("tr_crew", id), { ...change, ...updated }));
  await batch.commit();
}
