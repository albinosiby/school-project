// Owner console (DATA_CONTRACT section 16): pure helpers, no Firebase. Exported for tests.

/** platform_schools/{schoolId}: what the platform keeps about a school. */
export interface PlatformSchool {
  id: string; name?: string; status?: "active" | "suspended"; plan?: string; note?: string; reason?: string;
  adminEmail?: string; adminName?: string; city?: string; board?: string; phone?: string; leadId?: string;
  createdAt?: string; createdBy?: string; updatedAt?: string; updatedBy?: string;
}
/** users/{uid} of any login (the console lists the admins of every school). */
export interface PlatformUser { id: string; schoolId: string; role: string; email?: string; name?: string; createdAt?: string }
/** schools/{sid}/school/school plus the setup state, as far as the console reads them. */
export interface SchoolProfile { name?: string; short?: string; city?: string; board?: string; academicYear?: string; setupComplete?: boolean; exists: boolean }
export interface SchoolCounts { students: number; staff: number; classes: number }

export type LeadStatus = "new" | "contacted" | "demo" | "converted" | "closed";
export interface Lead { id: string; name: string; school: string; email: string; phone?: string; message?: string; source?: string; status: LeadStatus; notes?: string; schoolId?: string; createdAt?: Date | null }

export const LEAD_STATUSES: { value: LeadStatus; label: string; tone: "info" | "warning" | "brand" | "success" | "neutral" }[] = [
  { value: "new", label: "New", tone: "info" },
  { value: "contacted", label: "Contacted", tone: "warning" },
  { value: "demo", label: "Demo booked", tone: "brand" },
  { value: "converted", label: "Converted", tone: "success" },
  { value: "closed", label: "Closed", tone: "neutral" },
];
export const leadStatus = (s: string | undefined) => LEAD_STATUSES.find((x) => x.value === s) ?? LEAD_STATUSES[0]!;

export const PLANS = ["Trial", "Basic", "Standard", "Premium"] as const;
export const BOARDS = ["CBSE", "ICSE", "State Board", "IB", "Cambridge"] as const;

/** One row of the schools table: a school known from an admin login, a platform_schools doc, or both. */
export interface SchoolRow {
  id: string; name: string; city: string; board: string; plan: string; status: "active" | "suspended"; reason: string;
  adminEmail: string; adminName: string; admins: PlatformUser[]; createdAt: string; setupComplete: boolean | null;
  counts: SchoolCounts | null; registered: boolean;
}

/**
 * Every school the platform knows: schools with an admin login (also those that signed up themselves and have no
 * platform_schools doc yet) and every platform_schools doc. Sorted newest first, then by name.
 */
export function mergeSchools(users: PlatformUser[], platform: PlatformSchool[], profiles: Record<string, SchoolProfile | undefined> = {},
  counts: Record<string, SchoolCounts | undefined> = {}): SchoolRow[] {
  const admins = new Map<string, PlatformUser[]>();
  users.filter((u) => u.role === "admin" && u.schoolId).forEach((u) => admins.set(u.schoolId, [...(admins.get(u.schoolId) ?? []), u]));
  const byId = new Map(platform.map((p) => [p.id, p]));
  const ids = [...new Set([...admins.keys(), ...byId.keys()])];
  return ids.map((id): SchoolRow => {
    const p = byId.get(id), prof = profiles[id], a = admins.get(id) ?? [];
    // the school's first admin is the one whose uid is the school id (contract 1); otherwise the earliest
    const first = a.find((u) => u.id === id) ?? [...a].sort((x, y) => (x.createdAt ?? "").localeCompare(y.createdAt ?? ""))[0];
    return {
      id, name: prof?.name || p?.name || first?.name || "Unnamed school", city: prof?.city || p?.city || "", board: prof?.board || p?.board || "",
      plan: p?.plan || "", status: p?.status === "suspended" ? "suspended" : "active", reason: p?.reason ?? "",
      adminEmail: first?.email || p?.adminEmail || "", adminName: p?.adminName || first?.name || "", admins: a,
      createdAt: p?.createdAt || first?.createdAt || "", setupComplete: prof ? !!prof.setupComplete : null, counts: counts[id] ?? null, registered: !!p,
    };
  }).sort((x, y) => y.createdAt.localeCompare(x.createdAt) || x.name.localeCompare(y.name));
}

export interface OwnerStats { schools: number; active: number; suspended: number; setupPending: number; students: number; staff: number; newLeads: number; openLeads: number; converted: number }
export function ownerStats(rows: SchoolRow[], leads: Pick<Lead, "status">[]): OwnerStats {
  return {
    schools: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
    setupPending: rows.filter((r) => r.setupComplete === false).length,
    students: rows.reduce((n, r) => n + (r.counts?.students ?? 0), 0),
    staff: rows.reduce((n, r) => n + (r.counts?.staff ?? 0), 0),
    newLeads: leads.filter((l) => l.status === "new").length,
    openLeads: leads.filter((l) => l.status !== "converted" && l.status !== "closed").length,
    converted: leads.filter((l) => l.status === "converted").length,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Schools added per month for the last `n` months, oldest first (ISO createdAt; rows without a date are left out). */
export function schoolsByMonth(rows: Pick<SchoolRow, "createdAt">[], n = 6, now = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { label: MONTHS[d.getMonth()]!, value: rows.filter((r) => r.createdAt.startsWith(key)).length };
  });
}

export interface NewSchoolInput { name: string; city: string; board: string; plan: string; phone: string; adminName: string; adminEmail: string; password: string }
export type NewSchoolErrors = Partial<Record<keyof NewSchoolInput, string>>;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_ADMIN_PASSWORD = 8;

/** Field errors for "Add school"; empty when it can be created. */
export function validateNewSchool(v: NewSchoolInput): NewSchoolErrors {
  const e: NewSchoolErrors = {};
  if (v.name.trim().length < 2) e.name = "Enter the school's name.";
  else if (v.name.trim().length > 120) e.name = "Keep the name under 120 characters.";
  if (v.adminName.trim().length < 2) e.adminName = "Enter the admin's name.";
  if (!EMAIL.test(v.adminEmail.trim())) e.adminEmail = "Enter a valid email. The admin signs in with it.";
  if (v.password.length < MIN_ADMIN_PASSWORD) e.password = `Use at least ${MIN_ADMIN_PASSWORD} characters.`;
  else if (v.password.length > 128) e.password = "Keep the password under 128 characters.";
  if (v.phone.trim() && !/^[+\d][\d\s().-]{5,}$/.test(v.phone.trim())) e.phone = "Enter a valid phone number.";
  return e;
}

/** A readable first password for a new admin: 12 letters and digits without look-alikes (no 0/O, 1/l/I). */
export function generatePassword(len = 12, rand: (n: number) => number = (n) => {
  const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0]! % n;
}) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789"];
  const all = sets.join("");
  const chars = sets.map((s) => s[rand(s.length)]!);
  while (chars.length < len) chars.push(all[rand(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) { const j = rand(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

/** Prefill of "Add school" from a demo request. */
export const fromLead = (l: Pick<Lead, "name" | "school" | "email" | "phone">): Partial<NewSchoolInput> =>
  ({ name: l.school, adminName: l.name, adminEmail: l.email, phone: l.phone ?? "" });

export const fmtDate = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
