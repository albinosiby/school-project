"use client";
import { useSyncExternalStore } from "react";
import { useCollection } from "@/lib/useCollection";

/** true only after hydration, so cache-dependent branches match the server render */
export const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Demo "today" so seeded dates (Oct–Nov 2026) stay meaningful. */
const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const TODAY = ymd(new Date());
/** Local "now" as YYYY-MM-DDTHH:mm:ss (same shape as seeded createdAt values). */
export const nowLocal = () => { const d = new Date(); return `${ymd(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
export const DEMO_NOW = nowLocal();

export type Approval = {
  id: string; requester: string; ref: string; kind: "leave" | "attendance" | "fee" | "marks" | "pass" | "po"; dept: string; title: string; detail: string;
  remark: string; submitted: string; urgency: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  status: "pending" | "approved" | "rejected"; reason?: string; decidedAt?: string; clarification?: string;
  /** mirror rows: the record this approval decides, e.g. source "staff_leaves" + sourceId (see people/leaves.ts) */
  source?: string; sourceId?: string;
};
export type CalEvent = {
  id: string; title: string; category: CatId; start: string; end: string; startTime: string; endTime: string; venue: string; term: string;
  status: "published" | "draft"; instructional: boolean; grades: string[]; notifyApp: boolean; notifyWhatsapp: boolean; lead: string; desc: string; circular?: string;
};
export type Notif = { id: string; category: string; title: string; body: string; createdAt: string; read: boolean; href?: string };
export type SetupStep = { id: string; no: number; title: string; short: string; desc: string; done: boolean; doneAt: string };
export type SetupExc = { id: string; name: string; guardian: string; grade: string; grn: string; status: string; tone: Approval["tone"]; kind: string; issue: string; action: string; resolved: boolean };
export type Stats = {
  id: string; enquiries: number; exam: number; interview: number; enrolled: number; yoy: number; feesToday: number; healthVisits: number; healthFlags: number;
  compliance: number; deadlineDays: number; termStart: string; pipelineVelocity: number; totalCapacity: number; capacity: { label: string; enrolled: number; cap: number }[];
};
export type Alert = { id: string; kind: "substitute" | "fee" | "transit"; title: string; tag: string; body: string; status: "open" | "resolved"; substitute: string };
export type Policy = { id: string; title: string; body: string; enabled: boolean };
export type Student = { id: string; name: string; attendance: number; status: string };
export type Staff = { id: string; name: string; department: string; role: string; status: string };

export type CatId = "exam" | "holiday" | "ptm" | "sports" | "deadline";
export const CATS: { id: CatId; label: string; dot: string; chip: string }[] = [
  { id: "exam", label: "CBSE Examinations", dot: "bg-secondary", chip: "bg-info-container text-secondary" },
  { id: "holiday", label: "Gazetted Holidays", dot: "bg-warning", chip: "bg-warning-container text-warning" },
  { id: "ptm", label: "Parent-Teacher Meet", dot: "bg-success", chip: "bg-success-container text-success" },
  { id: "sports", label: "Sports & Gala", dot: "bg-[#8B5CF6]", chip: "bg-[#EDE5FF] text-[#6D3FD6]" },
  { id: "deadline", label: "Deadlines", dot: "bg-error", chip: "bg-error-container text-on-error-container" },
];
export const catOf = (id: string) => CATS.find((c) => c.id === id) ?? CATS[0]!;

export const KIND_LABEL: Record<Approval["kind"], string> = { leave: "Staff Leave", attendance: "Attendance Regularization", fee: "Fee Concessions", marks: "Marks Entry Unlock", pass: "Gate & Medical Outpass", po: "PO & Purchase" };
export const KIND_ORDER: Approval["kind"][] = ["leave", "attendance", "fee", "marks", "pass", "po"];

export const useApprovals = () => useCollection<Approval>("approvals");
export const useEvents = () => useCollection<CalEvent>("calendar_events");
export const useStats = () => { const c = useCollection<Stats>("dash_stats"); return { ...c, stats: c.rows[0] }; };

/* ---------- date helpers (all ISO yyyy-mm-dd, timezone free) ---------- */
export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y!, m! - 1, d!); };
export const toIso = (d: Date) => iso(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return toIso(d); };
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MON = MONTHS.map((m) => m.slice(0, 3).toUpperCase());
export const eventsOn = (evs: CalEvent[], day: string) => evs.filter((e) => e.start <= day && day <= e.end);
/** Monday-first month grid (6 weeks) */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { iso: toIso(d), day: d.getDate(), inMonth: d.getMonth() === month, dow: i % 7 }; });
}
export function relTime(createdAt: string) {
  const t = new Date(createdAt ?? "").getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
export const fmtSubmitted = (s: string) => {
  const d = new Date(s ?? ""); if (Number.isNaN(d.getTime())) return "—";
  const day = s.slice(0, 10);
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())} IST`;
  return day === TODAY ? `Today, ${t}` : `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}, ${t}`;
};
export const fmtDay = (s: string) => { if (!s) return "—"; const d = parse(s); if (Number.isNaN(d.getTime())) return "—"; return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()}`; };
export const upcomingEvents = (evs: CalEvent[], from = TODAY) =>
  evs.filter((e) => e.status === "published" && e.end >= from).sort((a, b) => a.start.localeCompare(b.start));

/** safe percentage: 0 when the denominator is 0 */
export const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/** Firestore errors (e.g. permission-denied) as a short toast message */
export const errMsg = (e: unknown, what = "Could not save") => `${what}${e instanceof Error && e.message ? `: ${e.message.replace(/^Firebase:\s*/, "")}` : ""}`;

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0);
}
