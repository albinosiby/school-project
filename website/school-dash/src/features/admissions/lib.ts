"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCollection } from "@/lib/useCollection";
import { type Application, type Config, type DocKey, type Enquiry, type EnqStage, type Message, type Offer, type Seat, type Slot, STAFF } from "./types";
import {
  type ClassRef, type SeatRow, type StudentRow, buildOffer, computeSeatRows, csvText, docPatch, enrolmentStudent, nextRef, offerBlocker, tokenFor,
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
  const config = cfg.rows[0];

  const ready = enq.ready && apps.ready && offers.ready && slots.ready && seats.ready && cfg.ready;

  const seatRows: SeatRow[] = useMemo(() => computeSeatRows(seats.rows, apps.rows, offers.rows), [seats.rows, apps.rows, offers.rows]);

  const logMessage = useCallback((kind: string, to: string, text: string) =>
    msgs.create({ kind, to, text, at: new Date().toISOString() }), [msgs]);

  const createEnquiry = useCallback(async (d: Partial<Enquiry> & Pick<Enquiry, "name" | "grade" | "guardian" | "phone">) => {
    return enq.create({
      ref: nextRef("ENQ", enq.rows, 1, new Date().getFullYear()), dob: "", prevSchool: "", relation: "Father", email: "", area: "", source: "Walk-In", stage: "new",
      assignee: "", followUp: "", note: "", sibling: false, createdAt: todayISO(), submittedTs: new Date().toISOString(), applicationId: "", lostReason: "", ...d,
    } as Omit<Enquiry, "id">);
  }, [enq]);

  const issueApplication = useCallback(async (e: Enquiry) => {
    if (e.applicationId) return apps.rows.find((a) => a.id === e.applicationId);
    const noTc = ["Nursery", "LKG", "UKG", "1"].includes(e.grade);
    const app = await apps.create({
      ref: nextRef("APP", apps.rows, 1, new Date().getFullYear()), enquiryId: e.id, name: e.name, gender: e.answers?.gender ?? "", dob: e.dob, guardian: e.guardian, phone: e.phone, email: e.email,
      grade: e.grade, tag: e.sibling ? "sibling" : "general", status: "submitted", submittedAt: todayISO(), feePaid: false, feeMode: "",
      docs: { birth: "pending", idProof: "pending", immunisation: "pending", tc: noTc ? "na" : "pending" },
      testSlotId: "", interviewSlotId: "", writtenScore: null, panelStatus: null, panelist: "", waitlistNo: 0, offerId: "", notes: "",
    });
    await enq.update(e.id, { stage: "app_issued", applicationId: app.id });
    return app;
  }, [apps, enq]);

  const moveEnquiry = useCallback(async (e: Enquiry, stage: EnqStage, lostReason = "") => {
    if (stage === "app_issued") return issueApplication(e);
    await enq.update(e.id, { stage, lostReason: stage === "lost" ? lostReason.trim() || "Closed by admissions desk" : "" });
  }, [enq, issueApplication]);

  /** Generate an offer for an application if a seat is free in the grade. Throws a user-facing Error when not possible. */
  const generateOffer = useCallback(async (a: Application) => {
    const why = offerBlocker(a, seatRows, offers.rows);
    if (why) throw new Error(why);
    const o = await offers.create(buildOffer(a, offers.rows, todayISO(), config?.offerValidityDays));
    await apps.update(a.id, { status: "offered", offerId: o.id, waitlistNo: 0 });
    if (a.enquiryId) await enq.update(a.enquiryId, { stage: "offered" }).catch(() => {});
    return o;
  }, [seatRows, offers, apps, enq, config]);

  const acceptOffer = useCallback(async (o: Offer) => {
    if (o.status !== "pending") throw new Error("Only a pending offer can be accepted");
    await offers.update(o.id, { status: "accepted", tokenPaid: tokenFor(config?.tokenAmount), tokenPaidAt: todayISO() });
  }, [offers, config]);

  const declineOffer = useCallback(async (o: Offer, reason = "Declined by parent") => {
    await offers.update(o.id, { status: "declined", reason: reason.trim() || "Declined by parent" });
    await apps.update(o.applicationId, { status: "withdrawn" });
    const a = apps.rows.find((x) => x.id === o.applicationId);
    if (a?.enquiryId) await enq.update(a.enquiryId, { stage: "lost", lostReason: "Offer declined" }).catch(() => {});
  }, [offers, apps, enq]);

  const lapseOffer = useCallback(async (o: Offer) => {
    await offers.update(o.id, { status: "lapsed" });
    await apps.update(o.applicationId, { status: "lapsed" });
    const a = apps.rows.find((x) => x.id === o.applicationId);
    if (a?.enquiryId) await enq.update(a.enquiryId, { stage: "lost", lostReason: "Offer lapsed" }).catch(() => {});
  }, [offers, apps, enq]);

  /**
   * Enrolling creates the record in the shared `students` collection (contract section 3: `stu_NNN`, classId `cls_{grade}{SECTION}`,
   * int roll, string grade/section, status "Active") and the class doc when that class does not exist yet. Re-running after a
   * partial failure reuses the student already created for this offer.
   */
  const enrolOffer = useCallback(async (o: Offer) => {
    if (o.status !== "accepted") throw new Error("Only an accepted offer can be enrolled");
    const a = apps.rows.find((x) => x.id === o.applicationId);
    const e = a?.enquiryId ? enq.rows.find((x) => x.id === a.enquiryId) : undefined;
    let st = students.rows.find((s) => s.offerId === o.id) as (Student & { grn: string }) | undefined;
    if (!st) {
      const body = enrolmentStudent(o, a, e, students.rows, classes.rows, todayISO());
      if (!classes.rows.some((c) => c.id === body.classId)) await classes.create({ id: body.classId, grade: body.grade, section: body.section, classTeacherId: "", room: "", wing: "" });
      st = (await students.create(body as never)) as Student & { grn: string };
    }
    await offers.update(o.id, { status: "enrolled", studentId: st.id });
    await apps.update(o.applicationId, { status: "enrolled" });
    if (a?.enquiryId) await enq.update(a.enquiryId, { stage: "enrolled" }).catch(() => {});
    return st;
  }, [apps, enq, students, classes, offers]);

  const setDoc = useCallback(async (a: Application, key: DocKey, state: Application["docs"][DocKey]) => {
    await apps.update(a.id, docPatch(a, key, state));
  }, [apps]);

  return { enq, apps, offers, slots, seats, msgs, config, cfg, students, classes, ready, seatRows, logMessage, createEnquiry, issueApplication, moveEnquiry, generateOffer, acceptOffer, declineOffer, lapseOffer, enrolOffer, setDoc };
}

export const statusTone = (s: string) =>
  (({ enrolled: "success", offered: "brand", shortlisted: "brand", verified: "success", docs_pending: "warning", submitted: "neutral", test_scheduled: "info", tested: "info", waitlisted: "neutral", rejected: "danger", withdrawn: "danger", lapsed: "danger" }) as Record<string, "success" | "brand" | "warning" | "neutral" | "info" | "danger">)[s] ?? "neutral";
