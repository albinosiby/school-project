// Creates the starting data for a freshly signed-up school: default configuration
// rows only (roles, grading bands, templates…). Everything transactional starts empty
// and is filled by the 8-step setup wizard and day-to-day use.
import { doc, getDoc, setDoc, writeBatch, type Firestore } from "firebase/firestore";
import { db } from "./firebase";

// local wall-clock time without a zone, like the rest of the feed (createdAt is shown as local time)
const nowLocal = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Configuration collections copied from the seed into a new school. Nothing transactional (enquiries, students, fees…). */
export const KEEP = [
  "set_roles", "set_grading", "set_leave_policy", "set_integrations", "approval_policies", "com_templates", "com_reports",
  "adm_form", "adm_seats", "set_config", "adm_config", "adm_campaign", "dash_prefs", "dash_stats", "setup_steps", "me_prefs",
] as const;

/** Academic year label for `d` (Apr–Mar, as in the setup wizard): Nov 2026 → "2026-27", Feb 2027 → "2026-27". */
export const academicYearOf = (d = new Date()) => { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };

type Row = Record<string, unknown> & { id: string };
/**
 * The seed row as a new school's starting doc: the demo school's names, people and counters are replaced, the rest is the
 * default configuration. Pure (exported for tests).
 */
export function starterRow(c: (typeof KEEP)[number], r: Row, i: number, org: string, email: string, ay: string, now = new Date()): Row {
  let v: Row = { ...r, _o: 1e12 - i };
  const swapName = (s: unknown) => (typeof s === "string" ? s.replace(/Greenfield International School|Greenfield Int\.|Greenfield/g, org) : s);
  if (c === "setup_steps") v = { ...v, done: false, doneAt: "" };
  if (c === "set_config" && r.id === "profile") v = { ...v, name: org, email, affiliation: "", schoolCode: "", phone: "", address: "", seal: "", digitalKey: "" };
  if (c === "set_config" && r.id === "meta") v = { ...v, academicYear: ay, rolledOver: false };
  if (c === "adm_config") v = { ...v, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: Array(24).fill(0) } };
  if (c === "adm_campaign") v = { ...v, name: `AY ${ay} Re-enrolment Drive`, opensAt: localDay(now), closesAt: localDay(new Date(now.getTime() + 60 * 864e5)), noticesSent: 0, lastReminderAt: "" };
  if (c === "adm_form") {
    const at = now.toISOString();
    v = { ...v, name: `${org} Admission Form · AY ${ay}`, version: 1, status: "published", publishedAt: at, publishedBy: "Setup", history: [{ version: 1, at, by: "Setup", note: "Default admission form" }] };
  }
  if (c === "dash_stats") v = { ...v, enquiries: 0, exam: 0, interview: 0, enrolled: 0, yoy: 0, feesToday: 0, healthVisits: 0, healthFlags: 0, compliance: 0, pipelineVelocity: 0, totalCapacity: 0, capacity: [] };
  if (c === "com_reports") v = { ...v, lastGenerated: "Never", meta: "0 Records" };
  if (c === "com_templates") v = { ...v, body: swapName(v.body) };
  if (c === "me_prefs") v = { ...v, signature: "", mfaDevice: "", term: `AY ${ay}` };
  return v;
}

/** What the owner console knows about a school it adds (contract 16); sign-up passes nothing. */
export interface SchoolDetails { adminName?: string; city?: string; board?: string; phone?: string }

/**
 * `uid` is the school id (new schools use the admin's uid). Also writes users/{uid} = {schoolId, role: "admin"} (contract
 * section 1). `fs` is the Firestore of the app signed in as that admin: the default app at sign-up, the owner console's
 * secondary app when it adds a school.
 */
export async function bootstrapSchool(uid: string, org: string, email: string, details: SchoolDetails = {}, fs: Firestore = db) {
  // users/{uid}: the rules and both apps find the school through this doc (contract section 1)
  await setDoc(doc(fs, "users", uid), { schoolId: uid, role: "admin", email, name: details.adminName || org, createdAt: new Date().toISOString() }, { merge: true });
  const marker = doc(fs, "schools", uid, "onboarding", "state");
  if ((await getDoc(marker)).exists()) return; // already bootstrapped
  const { seed } = await import("../server/seed");
  const ay = academicYearOf();
  const writes: [string, Record<string, unknown>][] = [];
  const put = (c: string, id: string, v: Record<string, unknown>) => writes.push([`${c}/${id}`, { ...v, id }]);

  for (const c of KEEP) ((seed[c] ?? []) as Row[]).forEach((r, i) => writes.push([`${c}/${r.id}`, starterRow(c, r, i, org, email, ay)]));
  put("school", "school", { name: org, short: org, board: details.board || "CBSE", affiliation: "", city: details.city || "", academicYear: ay, term: "Term 1" });
  put("me", "me", { name: details.adminName || email.split("@")[0], title: "Administrator", role: "Super Admin", email, phone: details.phone || "" });
  put("notifications", "welcome", { category: "ops", title: "Welcome", body: "Your school console is ready. Start by adding students and staff.", createdAt: nowLocal(), read: false, href: "/dashboard", _o: Date.now() });

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(fs);
    writes.slice(i, i + 400).forEach(([path, data]) => { const [c, id] = path.split("/"); batch.set(doc(fs, "schools", uid, c!, id!), data); });
    await batch.commit();
  }
  // written last: its presence marks the school as fully bootstrapped
  const done = writeBatch(fs);
  done.set(marker, { id: "state", complete: false, completed: [] });
  await done.commit();
}
