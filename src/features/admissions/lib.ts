"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCollection } from "@/lib/useCollection";
import {
  type Application, type Config, type DocKey, type Enquiry, type EnqStage, type Message, type Offer, type Seat, type Slot,
  gradeLabel, studentGrade, GRADES,
} from "./types";

// local calendar date (toISOString is UTC: IST before 05:30 would be "yesterday")
const localIso = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const todayISO = () => localIso();
/** Client-safe "today" (Next prerender forbids reading the clock during render). */
const noopSub = () => () => {};
export function useToday() {
  return useSyncExternalStore(noopSub, () => localIso(), () => "2026-10-22");
}
export const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString().slice(0, 10);
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const nextRef = (prefix: string, rows: { ref: string }[], start = 1) => {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.ref.split("-").pop()) || 0), start - 1);
  return `${prefix}-2026-${String(max + 1).padStart(4, "0")}`;
};
/** 10–13 digits, optional leading +, spaces/dashes allowed (old regex accepted "----------"). */
export const isPhone = (v: string) => /^\+?[\d\s-]+$/.test(v.trim()) && /^\d{10,13}$/.test(v.replace(/\D/g, ""));
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function ageOn(dob: string, ref = new Date()) {
  const d = new Date(dob);
  if (isNaN(+d)) return null;
  let months = (ref.getFullYear() - d.getFullYear()) * 12 + ref.getMonth() - d.getMonth();
  if (ref.getDate() < d.getDate()) months--;
  return { years: Math.floor(months / 12), months: months % 12, total: months };
}

export function downloadCsv(name: string, rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
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

type Student = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number };
export type SeatRow = Seat & { enrolled: number; held: number; free: number; gen: number; rte: number; sib: number; waitlisted: number };

export function useAdm() {
  const enq = useCollection<Enquiry>("adm_enquiries");
  const apps = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const slots = useCollection<Slot>("adm_slots");
  const seats = useCollection<Seat>("adm_seats");
  const msgs = useCollection<Message>("adm_messages");
  const cfg = useCollection<Config>("adm_config");
  const students = useCollection<Student>("students");
  const config = cfg.rows[0];

  const ready = enq.ready && apps.ready && offers.ready && slots.ready && seats.ready && cfg.ready;

  const seatRows: SeatRow[] = useMemo(() => {
    return GRADES.map((g) => seats.rows.find((s) => s.grade === g.id)).filter((s): s is Seat => !!s).map((s) => {
      const enrolled = apps.rows.filter((a) => a.grade === s.grade && a.status === "enrolled");
      const live = offers.rows.filter((o) => o.grade === s.grade && (o.status === "pending" || o.status === "accepted"));
      const liveApps = live.map((o) => apps.rows.find((a) => a.id === o.applicationId)).filter(Boolean) as Application[];
      const all = [...enrolled, ...liveApps];
      return {
        ...s, enrolled: enrolled.length, held: enrolled.length + live.length, free: s.capacity - enrolled.length - live.length,
        gen: all.filter((a) => a.tag === "general" || a.tag === "staff").length, rte: all.filter((a) => a.tag === "rte").length,
        sib: all.filter((a) => a.tag === "sibling").length, waitlisted: apps.rows.filter((a) => a.grade === s.grade && a.status === "waitlisted").length,
      };
    });
  }, [seats.rows, apps.rows, offers.rows]);

  const logMessage = useCallback((kind: string, to: string, text: string) =>
    msgs.create({ kind, to, text, at: new Date().toISOString() }), [msgs]);

  const createEnquiry = useCallback(async (d: Partial<Enquiry> & Pick<Enquiry, "name" | "grade" | "guardian" | "phone">) => {
    return enq.create({
      ref: nextRef("ENQ", enq.rows), dob: "", prevSchool: "", relation: "Father", email: "", area: "", source: "Walk-In", stage: "new",
      assignee: "", followUp: "", note: "", sibling: false, createdAt: todayISO(), applicationId: "", lostReason: "", ...d,
    } as Omit<Enquiry, "id">);
  }, [enq]);

  const issueApplication = useCallback(async (e: Enquiry) => {
    if (e.applicationId) return apps.rows.find((a) => a.id === e.applicationId);
    const noTc = ["Nursery", "LKG", "UKG", "1"].includes(e.grade);
    const app = await apps.create({
      ref: nextRef("APP", apps.rows), enquiryId: e.id, name: e.name, gender: e.answers?.gender ?? "", dob: e.dob, guardian: e.guardian, phone: e.phone, email: e.email,
      grade: e.grade, tag: e.sibling ? "sibling" : "general", status: "submitted", submittedAt: todayISO(), feePaid: false, feeMode: "",
      docs: { birth: "pending", idProof: "pending", immunisation: "pending", tc: noTc ? "na" : "pending" },
      testSlotId: "", interviewSlotId: "", writtenScore: null, panelStatus: null, panelist: "", waitlistNo: 0, offerId: "", notes: "",
    });
    await enq.update(e.id, { stage: "app_issued", applicationId: app.id });
    return app;
  }, [apps, enq]);

  const moveEnquiry = useCallback(async (e: Enquiry, stage: EnqStage, lostReason = "") => {
    if (stage === "app_issued") return issueApplication(e);
    await enq.update(e.id, { stage, lostReason: stage === "lost" ? lostReason || "Closed by admissions desk" : "" });
  }, [enq, issueApplication]);

  /** Generate an offer for an application if a seat is free in the grade. Throws a user-facing Error when not possible. */
  const generateOffer = useCallback(async (a: Application) => {
    const seat = seatRows.find((s) => s.grade === a.grade);
    if (!seat) throw new Error("No seat matrix configured for this grade");
    if (seat.free <= 0) throw new Error(`No free seat in ${gradeLabel(a.grade)} — increase capacity or release an offer`);
    if (a.offerId && offers.rows.find((o) => o.id === a.offerId && (o.status === "pending" || o.status === "accepted"))) throw new Error("An active offer already exists");
    const issuedAt = todayISO();
    const o = await offers.create({
      ref: nextRef("OFF", offers.rows, 801), applicationId: a.id, name: a.name, guardian: a.guardian, phone: a.phone, grade: a.grade,
      issuedAt, expiresAt: addDays(issuedAt, config?.offerValidityDays ?? 7), status: "pending", tokenPaid: 0, tokenPaidAt: "", studentId: "", reason: "",
    });
    await apps.update(a.id, { status: "offered", offerId: o.id, waitlistNo: 0 });
    if (a.enquiryId) await enq.update(a.enquiryId, { stage: "offered" }).catch(() => {});
    return o;
  }, [seatRows, offers, apps, enq, config]);

  const acceptOffer = useCallback(async (o: Offer) => {
    await offers.update(o.id, { status: "accepted", tokenPaid: config?.tokenAmount ?? 50000, tokenPaidAt: todayISO() });
  }, [offers, config]);

  const declineOffer = useCallback(async (o: Offer, reason = "Declined by parent") => {
    await offers.update(o.id, { status: "declined", reason });
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

  /** Enrolling creates a record in the shared `students` collection. */
  const enrolOffer = useCallback(async (o: Offer) => {
    const a = apps.rows.find((x) => x.id === o.applicationId);
    const max = students.rows.reduce((m, s) => Math.max(m, Number(s.grn.split("-").pop()) || 0), 8800);
    const st = await students.create({
      name: o.name, grn: `GIS-${max + 1}`, grade: studentGrade(o.grade), section: "A", guardian: o.guardian, phone: o.phone,
      status: "Active", attendance: 100,
    } as Omit<Student, "id">);
    await offers.update(o.id, { status: "enrolled", studentId: st.id });
    await apps.update(o.applicationId, { status: "enrolled" });
    if (a?.enquiryId) await enq.update(a.enquiryId, { stage: "enrolled" }).catch(() => {});
    return st;
  }, [apps, students, offers, enq]);

  const setDoc = useCallback(async (a: Application, key: DocKey, state: Application["docs"][DocKey]) => {
    const docs = { ...a.docs, [key]: state };
    const complete = Object.values(docs).every((s) => s === "verified" || s === "na");
    const patch: Partial<Application> = { docs };
    if (complete && (a.status === "submitted" || a.status === "docs_pending")) patch.status = "verified";
    if (!complete && a.status === "verified") patch.status = "docs_pending";
    if (!complete && a.status === "submitted" && Object.values(docs).some((s) => s === "verified")) patch.status = "docs_pending";
    await apps.update(a.id, patch);
  }, [apps]);

  return { enq, apps, offers, slots, seats, msgs, config, cfg, students, ready, seatRows, logMessage, createEnquiry, issueApplication, moveEnquiry, generateOffer, acceptOffer, declineOffer, lapseOffer, enrolOffer, setDoc };
}

export const docsComplete = (a: Application) => Object.values(a.docs).every((s) => s === "verified" || s === "na");
export const rankValue = (a: Application) => ({ rte: 3, sibling: 2, staff: 1, general: 0 }[a.tag] * 1000 + (a.writtenScore ?? 0));
export const statusTone = (s: string) =>
  (({ enrolled: "success", offered: "brand", shortlisted: "brand", verified: "success", docs_pending: "warning", submitted: "neutral", test_scheduled: "info", tested: "info", waitlisted: "neutral", rejected: "danger", withdrawn: "danger", lapsed: "danger" }) as Record<string, "success" | "brand" | "warning" | "neutral" | "info" | "danger">)[s] ?? "neutral";
