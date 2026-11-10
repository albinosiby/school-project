"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createStamp, schoolDoc, stamp } from "@/features/fees/logic";
import { isCourseId, streamFromClassId } from "@/lib/academicStreams";
import { nextStudentId } from "@/features/people/studentLogic";
import { useCollection } from "@/lib/useCollection";
import { type Application, type AppStatus, type Config, type DocKey, type Enquiry, type EnqStage, type Message, type Offer, type Seat, type Slot, admissionCohorts, STAFF } from "./types";
import {
  type ClassRef, type SeatRow, type StudentRow, buildOffer, computeSeatRows, csvText, docsComplete, docPatch, enrolmentStudent, nextRef, offerBlocker, OFFERABLE, stageMoveError, tokenFor,
} from "./logic";

// local calendar date (toISOString is UTC: IST before 05:30 would be "yesterday")
const localIso = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const todayISO = () => localIso();
/** Client-safe "today" (Next prerender forbids reading the clock during render). */
const noopSub = () => () => {};
export function useToday() {
  return useSyncExternalStore(noopSub, () => localIso(), () => "2026-10-22");
}
export { addDays, ageOn, csvText, docsComplete, isEmail, isPhone, nextRef, pct, rankValue, type SeatRow } from "./logic";

export function downloadCsv(name: string, rows: (string | number | boolean | null | undefined)[][]) {
  const blob = new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy"); t.remove(); return ok;
  }
}

type Student = StudentRow & { guardian?: string; phone?: string; attendance?: number };
type StaffRef = { id: string; name: string; status?: string; department?: string };

/** Counsellor names: the school's active staff (falls back to the legacy demo names only when no staff exist yet). */
export function useCounsellors(current = "") {
  const staff = useCollection<StaffRef>("staff").rows;
  return useMemo(() => {
    const names = staff.filter((s) => s.name && s.status !== "Inactive").map((s) => s.name).sort((a, b) => a.localeCompare(b));
    const list = names.length ? names : [...STAFF];
    return current && !list.includes(current) ? [current, ...list] : list;
  }, [staff, current]);
}

export function useAdm() {
  const enq = useCollection<Enquiry>("adm_enquiries");
  const apps = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const slots = useCollection<Slot>("adm_slots");
  const seats = useCollection<Seat>("adm_seats");
  const msgs = useCollection<Message>("adm_messages");
  const cfg = useCollection<Config>("adm_config");
  const students = useCollection<Student>("students");
  const classes = useCollection<ClassRef & { classTeacherId?: string; room?: string; wing?: string }>("classes");
  const config = cfg.rows.find((row) => row.id === "config");

  const ready = enq.ready && apps.ready && offers.ready && slots.ready && seats.ready && cfg.ready && students.ready;

  const cohorts = useMemo(() => admissionCohorts(seats.rows), [seats.rows]);
  const seatRows: SeatRow[] = useMemo(() => computeSeatRows(seats.rows, apps.rows, offers.rows, students.rows), [seats.rows, apps.rows, offers.rows, students.rows]);

  const logMessage = useCallback((kind: string, to: string, text: string) =>
    msgs.create({ kind, to, text, at: new Date().toISOString() }), [msgs]);

  const createEnquiry = useCallback(async (d: Partial<Enquiry> & Pick<Enquiry, "name" | "grade" | "guardian" | "phone">) => {
    return enq.create({
      ref: nextRef("ENQ", enq.rows, 1, new Date().getFullYear()), dob: "", prevSchool: "", relation: "Father", email: "", area: "", source: "Walk-In", stage: "new",
      assignee: "", followUp: "", note: "", sibling: false, createdAt: todayISO(), submittedTs: new Date().toISOString(), applicationId: "", lostReason: "", ...d,
    } as Omit<Enquiry, "id">);
  }, [enq]);

  const applicationDraft = useCallback((draft: Pick<Application, "name" | "grade" | "guardian" | "phone" | "email" | "dob">, enquiry?: Enquiry): Omit<Application, "id"> => ({
    name: draft.name, grade: draft.grade, guardian: draft.guardian, phone: draft.phone, email: draft.email, dob: draft.dob,
    ref: nextRef("APP", apps.rows, 1, new Date().getFullYear()), enquiryId: enquiry?.id ?? "", gender: enquiry?.gender || enquiry?.answers?.gender || "",
    tag: enquiry?.sibling ? "sibling" : "general", status: "submitted", submittedAt: todayISO(), feePaid: false, feeMode: "",
    docs: { birth: "pending", idProof: "pending", immunisation: "pending", tc: ["Nursery", "LKG", "UKG", "1"].includes(draft.grade) ? "na" : "pending" },
    testSlotId: "", interviewSlotId: "", writtenScore: null, panelStatus: null, panelist: "", waitlistNo: 0, offerId: "", notes: "",
  }), [apps.rows]);

  const createApplication = useCallback((draft: Parameters<typeof applicationDraft>[0]) =>
    apps.create(applicationDraft(draft)), [apps, applicationDraft]);

  const issueApplication = useCallback(async (e: Enquiry) => {
    const enquiryRef = schoolDoc("adm_enquiries", e.id);
    const appRef = schoolDoc("adm_applications", `from_${e.id}`);
    return runTransaction(db, async (tx) => {
      const saved = await tx.get(enquiryRef);
      if (!saved.exists()) throw new Error("The enquiry no longer exists");
      const current = { ...saved.data(), id: saved.id } as Enquiry;
      if (current.applicationId) return { id: current.applicationId };
      if (current.stage === "lost") throw new Error("Reopen the enquiry before creating an application");
      const draft = { ...applicationDraft(current, current), id: appRef.id };
      tx.set(appRef, { ...draft, ...createStamp() });
      tx.update(enquiryRef, { stage: "app_issued", applicationId: appRef.id, ...stamp() });
      return draft;
    });
  }, [applicationDraft]);

  const moveEnquiry = useCallback(async (e: Enquiry, stage: EnqStage, lostReason = "") => {
    if (stage === "app_issued") return issueApplication(e);
    await enq.update(e.id, { stage, lostReason: stage === "lost" ? lostReason.trim() || "Closed by admissions desk" : "" });
  }, [enq, issueApplication]);

  const deleteEnquiry = useCallback(async (id: string) => {
    const ref = schoolDoc("adm_enquiries", id);
    await runTransaction(db, async (tx) => {
      const saved = await tx.get(ref);
      if (!saved.exists()) return;
      const enquiry = saved.data() as Enquiry;
      if (enquiry.applicationId) {
        const appRef = schoolDoc("adm_applications", enquiry.applicationId);
        const app = await tx.get(appRef);
        if (app.get("enquiryId") === id) {
          tx.update(appRef, {
            enquiryId: "",
            relation: app.get("relation") || enquiry.relation || "",
            dob: app.get("dob") || enquiry.dob || "",
            email: app.get("email") || enquiry.email || "",
            gender: app.get("gender") || enquiry.gender || enquiry.answers?.gender || "",
            ...stamp(),
          });
        }
      }
      tx.delete(ref);
    });
  }, []);

  /** The cohort revision prevents two offer requests using the same seat snapshot. */
  const generateOffer = useCallback(async (a: Application) => {
    const why = offerBlocker(a, seatRows, offers.rows);
    if (why) throw new Error(why);
    const seat = seatRows.find((row) => row.grade === a.grade)!;
    if (seat.latestReservationId && !offers.rows.some((offer) => offer.id === seat.latestReservationId)) {
      throw new Error("Seat availability changed. Try again.");
    }
    const seatRef = schoolDoc("adm_seats", seat.id);
    const appRef = schoolDoc("adm_applications", a.id);
    const offerRef = schoolDoc("adm_offers", `for_${a.id}`);
    const enquiryRef = a.enquiryId ? schoolDoc("adm_enquiries", a.enquiryId) : null;
    const draft = { ...buildOffer(a, offers.rows, todayISO(), config?.offerValidityDays), id: offerRef.id };
    return runTransaction(db, async (tx) => {
      const [app, savedSeat, prior, enquiry, newStudent] = await Promise.all([
        tx.get(appRef), tx.get(seatRef), tx.get(offerRef), enquiryRef ? tx.get(enquiryRef) : null,
        tx.get(schoolDoc("students", nextStudentId(students.rows.map((row) => row.id)))),
      ]);
      if (!app.exists() || !OFFERABLE.includes(app.get("status")) || app.get("grade") !== a.grade || !docsComplete({ docs: app.get("docs") }) || app.get("offerId") || prior.exists()) {
        throw new Error("This application is no longer eligible for a new offer");
      }
      const revision = seat.reservationRevision ?? 0;
      if (newStudent.exists() || !savedSeat.exists() || savedSeat.get("capacity") !== seat.capacity || (savedSeat.get("reservationRevision") ?? 0) !== revision) {
        throw new Error("Seat availability changed. Try again.");
      }
      tx.set(offerRef, { ...draft, ...createStamp() });
      tx.update(appRef, { status: "offered", offerId: offerRef.id, waitlistNo: 0, ...stamp() });
      tx.update(seatRef, { reservationRevision: revision + 1, latestReservationId: offerRef.id });
      if (enquiryRef && enquiry?.exists()) tx.update(enquiryRef, { stage: "offered", ...stamp() });
      return draft;
    });
  }, [seatRows, offers.rows, config, students.rows]);

  const changeOffer = useCallback(async (offer: Offer, status: "accepted" | "declined" | "lapsed", extra: Partial<Offer> = {}) => {
    const offerRef = schoolDoc("adm_offers", offer.id);
    const appRef = schoolDoc("adm_applications", offer.applicationId);
    const seat = seats.rows.find((row) => row.grade === offer.grade);
    const seatRef = seat ? schoolDoc("adm_seats", seat.id) : null;
    await runTransaction(db, async (tx) => {
      const [saved, app, savedSeat] = await Promise.all([tx.get(offerRef), tx.get(appRef), seatRef ? tx.get(seatRef) : null]);
      const currentStatus = saved.get("status");
      if (saved.get("applicationId") !== offer.applicationId || (currentStatus !== "pending" && !(status === "declined" && currentStatus === "accepted"))) {
        throw new Error("This offer has already changed. Refresh the application and try again.");
      }
      if (status === "accepted" && saved.get("expiresAt") && saved.get("expiresAt") < todayISO()) throw new Error("This offer has expired");
      const enquiryId = app.get("enquiryId") as string | undefined;
      const enquiryRef = status !== "accepted" && enquiryId ? schoolDoc("adm_enquiries", enquiryId) : null;
      const enquiry = enquiryRef ? await tx.get(enquiryRef) : null;
      tx.update(offerRef, { ...extra, status, ...stamp() });
      if (status !== "accepted") {
        if (app.exists()) tx.update(appRef, { status: status === "declined" ? "withdrawn" : "lapsed", ...stamp() });
        if (enquiryRef && enquiry?.exists()) tx.update(enquiryRef, { stage: "lost", lostReason: status === "declined" ? "Offer declined" : "Offer lapsed", ...stamp() });
        if (seatRef && savedSeat?.exists()) tx.update(seatRef, { reservationRevision: (savedSeat.get("reservationRevision") ?? 0) + 1 });
      }
    });
  }, [seats.rows]);

  const acceptOffer = useCallback((o: Offer, { recordToken = true } = {}) =>
    changeOffer(o, "accepted", recordToken ? { tokenPaid: tokenFor(config?.tokenAmount), tokenPaidAt: todayISO() } : {}), [changeOffer, config]);
  const declineOffer = useCallback((o: Offer, reason = "Declined by parent") =>
    changeOffer(o, "declined", { reason: reason.trim() || "Declined by parent" }), [changeOffer]);
  const lapseOffer = useCallback((o: Offer) => changeOffer(o, "lapsed"), [changeOffer]);

  const enrolOffer = useCallback(async (o: Offer) => {
    const offerRef = schoolDoc("adm_offers", o.id);
    const appRef = schoolDoc("adm_applications", o.applicationId);
    return runTransaction(db, async (tx) => {
      const [saved, app] = await Promise.all([tx.get(offerRef), tx.get(appRef)]);
      if (!app.exists() || saved.get("applicationId") !== o.applicationId || saved.get("status") !== "accepted") {
        throw new Error("Only an accepted offer can be enrolled");
      }
      const application = { ...app.data(), id: app.id } as Application;
      const enquiryRef = application.enquiryId ? schoolDoc("adm_enquiries", application.enquiryId) : null;
      const enquiry = enquiryRef ? await tx.get(enquiryRef) : null;
      const original = enquiry?.exists() ? { ...enquiry.data(), id: enquiry.id } as Enquiry : undefined;
      const existing = students.rows.find((s) => s.offerId === o.id);
      const body = existing ?? enrolmentStudent({ ...saved.data(), id: saved.id } as Offer, application, original, students.rows, classes.rows, todayISO());
      const studentRef = schoolDoc("students", body.id);
      const classRef = body.classId ? schoolDoc("classes", body.classId) : null;
      const [student, cls] = await Promise.all([tx.get(studentRef), classRef ? tx.get(classRef) : null]);
      if (student.exists() && student.get("offerId") !== o.id) throw new Error("Another student was just added. Try again.");
      if (classRef && isCourseId(streamFromClassId(classRef.id)) && !student.exists() &&
          (!cls?.exists() || cls.get("capacity") !== classes.rows.find((row) => row.id === classRef.id)?.capacity)) {
        throw new Error("The course section changed. Refresh the application and try again.");
      }
      if (classRef && !cls?.exists()) tx.set(classRef, { id: classRef.id, grade: body.grade, section: body.section, classTeacherId: "", room: "", wing: "", ...createStamp() });
      if (!student.exists()) tx.set(studentRef, { ...body, ...createStamp() });
      tx.update(offerRef, { status: "enrolled", studentId: body.id, ...stamp() });
      tx.update(appRef, { status: "enrolled", ...stamp() });
      if (enquiryRef && enquiry?.exists()) tx.update(enquiryRef, { stage: "enrolled", ...stamp() });
      return body as Student & { grn: string };
    });
  }, [students.rows, classes.rows]);

  const moveApplication = useCallback(async (id: string, status: AppStatus) => {
    const ref = schoolDoc("adm_applications", id);
    await runTransaction(db, async (tx) => {
      const saved = await tx.get(ref);
      if (!saved.exists()) throw new Error("The application no longer exists");
      const current = saved.data() as Application;
      const error = stageMoveError(current, status);
      if (error) throw new Error(error);
      tx.update(ref, { status, ...stamp() });
    });
  }, []);

  const setDoc = useCallback(async (a: Application, key: DocKey, state: Application["docs"][DocKey]) => {
    const ref = schoolDoc("adm_applications", a.id);
    await runTransaction(db, async (tx) => {
      const saved = await tx.get(ref);
      if (!saved.exists()) throw new Error("The application no longer exists");
      const current = saved.data() as Application;
      if (["offered", "enrolled", "withdrawn", "lapsed"].includes(current.status)) {
        throw new Error("The document checklist is locked at this stage.");
      }
      tx.update(ref, { ...docPatch(current, key, state), ...stamp() });
    });
  }, []);

  return { enq, apps, offers, slots, seats, msgs, config, cfg, students, classes, ready, cohorts, seatRows, logMessage, createEnquiry, createApplication, issueApplication, moveEnquiry, deleteEnquiry, generateOffer, acceptOffer, declineOffer, lapseOffer, enrolOffer, moveApplication, setDoc };
}

export const statusTone = (s: string) =>
  (({ enrolled: "success", offered: "brand", shortlisted: "brand", verified: "success", approved: "success", docs_pending: "warning", submitted: "neutral", test_scheduled: "info", tested: "info", waitlisted: "neutral", rejected: "danger", withdrawn: "danger", lapsed: "danger" }) as Record<string, "success" | "brand" | "warning" | "neutral" | "info" | "danger">)[s] ?? "neutral";
