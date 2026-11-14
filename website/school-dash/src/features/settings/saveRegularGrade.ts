import { runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { labelToClassId } from "@/lib/academicStreams";
import { computeSeatRows, type StudentRow } from "@/features/admissions/logic";
import { GRADES, groupOfGrade, type Application, type Offer, type Seat } from "@/features/admissions/types";
import { newScheme, newSchemeSubject, schemeId, type SubjectScheme } from "@/features/exams/assessmentScheme";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { activeStudent, studentClassId } from "@/features/ops/shared";
import { cleanGradeRoom, gradeCapacityError, gradeRoomsError, classRowsFor, newSectionRow, SECTION_LETTERS, type GradeDraft, type SectionRow } from "./gradeSetup";

export type ClassLink = { id: string; classId?: string; grade?: string; section?: string };
export type GradeCapacityData = {
  students: StudentRow[]; applications: Application[]; offers: Offer[]; seats: Seat[];
  assignments?: ClassLink[]; periods?: ClassLink[];
  classes?: { id: string; room?: string }[];
};

/** Keep the grade, its classes and its admission capacity consistent in one commit. */
export async function saveRegularGrade(draft: GradeDraft, data: GradeCapacityData, current?: SectionRow) {
  const { grade, letters, caps } = draft;
  if (!GRADES.some((row) => row.id === grade && row.group !== "senior") || draft.streamId || current?.streamId)
    throw new Error("Choose a regular grade. Senior secondary grades are managed in their department.");
  const problem = gradeCapacityError(draft) || gradeRoomsError(draft, data.classes);
  if (problem) throw new Error(problem);
  if (new Set(letters).size !== letters.length || letters.some((letter) => !SECTION_LETTERS.includes(letter)))
    throw new Error("Choose unique sections from A to H.");

  const next = newSectionRow(grade, "", [...letters].sort(), caps);
  const sectionRef = schoolDoc("set_sections", current?.id ?? next.id);
  const classes = classRowsFor(grade, "", [...letters].sort(), caps);
  const kept = new Set(classes.map((row) => row.id));
  const removed = new Set((current?.sections ?? []).map(labelToClassId).filter((id) => !kept.has(id)));
  const roster = data.students.filter(activeStudent);
  const count = (id: string) => roster.filter((student) => studentClassId(student) === id).length;
  const seat = data.seats.find((row) => row.grade === grade && !row.streamId);
  const seatRef = schoolDoc("adm_seats", seat?.id ?? `adm_seat_${grade.toLowerCase()}`);
  // A missing admissions row still needs to account for existing students and offers.
  const admissionSeat: Seat = seat ?? { id: seatRef.id, grade, group: groupOfGrade(grade), capacity: 0, rteSeats: 0, block: "" };
  const held = computeSeatRows([admissionSeat], data.applications, data.offers, data.students)[0]!;
  const occupied = [...removed].find((id) => count(id) > 0);
  if (occupied) throw new Error(`${occupied.replace(/^cls_/, "")} still has ${count(occupied)} students. Move them before removing the section.`);
  const tooSmall = classes.find((row) => caps[row.section] < count(row.id));
  if (tooSmall) throw new Error(`Capacity of section ${tooSmall.section} cannot be below its ${count(tooSmall.id)} enrolled students.`);
  const minimum = Math.max(held.held, held.rteSeats, roster.filter((student) => String(student.grade) === grade).length);
  if (next.cap < minimum) throw new Error(`Total capacity cannot be below ${minimum} occupied or reserved seats (including live admission offers).`);
  if (seat?.latestReservationId && !data.offers.some((offer) => offer.id === seat.latestReservationId))
    throw new Error("Seat availability changed. Wait for admissions to refresh and try again.");

  const cleanup = [
    ...(data.assignments ?? []).filter((row) => removed.has(row.classId ?? "")).map((row) => ({ collection: "assignments", row })),
    ...(data.periods ?? []).filter((row) => removed.has(studentClassId(row))).map((row) => ({ collection: "ops_periods", row })),
  ];
  if (2 + classes.length + removed.size + cleanup.length + (draft.subjects.length ? 1 : 0) > 500)
    throw new Error("Too many timetable records to remove at once. Remove fewer sections per save.");
  const classIds = [...new Set([...kept, ...removed])];
  const classRefs = classIds.map((id) => schoolDoc("classes", id));
  const schemeRef = schoolDoc("set_subject_schemes", schemeId(`${grade}:`));
  const cleanupRefs = cleanup.map(({ collection, row }) => schoolDoc(collection, row.id));

  await runTransaction(db, async (tx) => {
    const [sectionSnap, seatSnap, classSnaps, schemeSnap, cleanupSnaps] = await Promise.all([
      tx.get(sectionRef), tx.get(seatRef), Promise.all(classRefs.map((ref) => tx.get(ref))),
      draft.subjects.length ? tx.get(schemeRef) : null, Promise.all(cleanupRefs.map((ref) => tx.get(ref))),
    ]);
    if (!current && sectionSnap.exists()) throw new Error("This grade is already configured. Reopen its grade page.");
    if (current && (!sectionSnap.exists() || JSON.stringify(sectionSnap.get("sections")) !== JSON.stringify(current.sections) || sectionSnap.get("cap") !== current.cap))
      throw new Error("This grade changed in another window. Reopen the editor and try again.");
    if (seatSnap.exists() !== !!seat || (seat && (seatSnap.get("capacity") !== seat.capacity
      || (seatSnap.get("rteSeats") ?? 0) !== (seat.rteSeats ?? 0)
      || (seatSnap.get("reservationRevision") ?? 0) !== (seat.reservationRevision ?? 0))))
      throw new Error("Seat availability changed. Reopen the editor and try again.");
    // Recheck server-maintained class totals as well as the loaded student roster.
    for (const [index, id] of classIds.entries()) {
      const enrolled = Math.max(count(id), Number(classSnaps[index]!.get("studentCount")) || 0);
      if (removed.has(id) && enrolled > 0) throw new Error("A section being removed still has students. Refresh the grade and move them first.");
      const cls = classes.find((row) => row.id === id);
      if (cls && caps[cls.section] < enrolled) throw new Error(`Capacity of section ${cls.section} cannot be below its ${enrolled} enrolled students.`);
    }
    for (const [index, { collection }] of cleanup.entries()) {
      const saved = cleanupSnaps[index]!;
      if (saved.exists() && !removed.has(collection === "ops_periods"
        ? studentClassId(saved.data() as ClassLink) : saved.get("classId") ?? ""))
        throw new Error("A teacher assignment or timetable changed. Reopen the editor and try again.");
    }
    const stamp = createStamp();
    tx.set(sectionRef, { ...next, id: sectionRef.id, roster: classes.reduce((sum, row) => sum + count(row.id), 0),
      ...(draft.subjects.length ? { subjects: draft.subjects } : {}), ...stamp }, { merge: true });
    for (const cls of classes) {
      const exists = classSnaps[classIds.indexOf(cls.id)]!.exists();
      tx.set(schoolDoc("classes", cls.id), { ...(exists ? { id: cls.id, capacity: cls.capacity } : cls),
        ...(draft.rooms?.[cls.section] !== undefined ? { room: cleanGradeRoom(draft.rooms[cls.section]) } : {}),
        ...(draft.subjects.length ? { subjects: draft.subjects } : {}), ...stamp }, { merge: true });
    }
    for (const ref of cleanupRefs) tx.delete(ref);
    for (const id of removed) tx.delete(schoolDoc("classes", id));
    tx.set(seatRef, { id: seatRef.id, grade, group: groupOfGrade(grade), capacity: next.cap,
      ...(!seatSnap.exists() ? { rteSeats: 0, block: "" } : {}), ...stamp }, { merge: true });
    if (draft.subjects.length) {
      const saved = schemeSnap?.data() as SubjectScheme | undefined;
      const existing = saved?.subjects ?? [];
      const missing = draft.subjects.filter((name) => !existing.some((row) => row.subject.toLowerCase() === name.toLowerCase()));
      tx.set(schemeRef, { ...(!saved ? newScheme(`${grade}:`) : {}), subjects: [...existing, ...missing.map(newSchemeSubject)], ...stamp }, { merge: true });
    }
  });
  return { ...next, id: sectionRef.id };
}
