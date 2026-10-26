// Creates the starting data for a freshly signed-up school: default configuration
// rows only (roles, grading bands, templates…). Everything transactional starts empty
// and is filled by the 8-step setup wizard and day-to-day use.
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// local wall-clock time without a zone, like the rest of the feed (createdAt is shown as local time)
const nowLocal = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

const KEEP = [
  "set_roles", "set_grading", "set_leave_policy", "set_integrations", "approval_policies", "com_templates", "com_reports",
  "adm_form", "adm_seats", "set_config", "adm_config", "adm_campaign", "dash_prefs", "dash_stats", "setup_steps", "me_prefs",
] as const;

/** `uid` is the school id (new schools use the admin's uid). users/{uid} = {schoolId, role: "admin"} is written by the caller before this. */
export async function bootstrapSchool(uid: string, org: string, email: string) {
  // users/{uid}: the rules and both apps find the school through this doc (contract section 1)
  await setDoc(doc(db, "users", uid), { schoolId: uid, role: "admin", email, name: org, createdAt: new Date().toISOString() }, { merge: true });
  const marker = doc(db, "schools", uid, "onboarding", "state");
  if ((await getDoc(marker)).exists()) return; // already bootstrapped
  const { seed } = await import("@/server/seed");
  const year = new Date().getFullYear();
  const ay = `${year}-${String(year + 1).slice(2)}`;
  const writes: [string, Record<string, unknown>][] = [];
  const put = (c: string, id: string, v: Record<string, unknown>) => writes.push([`${c}/${id}`, { ...v, id }]);

  for (const c of KEEP) (seed[c] ?? []).forEach((r, i) => {
    let v: Record<string, unknown> = { ...r, _o: 1e12 - i };
    if (c === "setup_steps") v = { ...v, done: false, doneAt: "" };
    if (c === "set_config" && r.id === "profile") v = { ...v, name: org, email, affiliation: "", schoolCode: "", phone: "", address: "", seal: "", digitalKey: "" };
    if (c === "adm_config") v = { ...v, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: Array(24).fill(0) } };
    if (c === "adm_campaign") v = { ...v, noticesSent: 0, lastReminderAt: "" };
    if (c === "dash_stats") v = { ...v, enquiries: 0, exam: 0, interview: 0, enrolled: 0, yoy: 0, feesToday: 0, healthVisits: 0, healthFlags: 0, compliance: 0, pipelineVelocity: 0, totalCapacity: 0, capacity: [] };
    if (c === "com_reports") v = { ...v, lastGenerated: "Never", meta: "0 Records" };
    if (c === "me_prefs") v = { ...v, signature: "", mfaDevice: "" };
    writes.push([`${c}/${r.id}`, v]);
  });
  put("school", "school", { name: org, short: org, board: "CBSE", affiliation: "", city: "", academicYear: ay, term: "Term 1" });
  put("me", "me", { name: email.split("@")[0], title: "Administrator", role: "Super Admin", email, phone: "" });
  put("notifications", "welcome", { category: "ops", title: "Welcome", body: "Your school console is ready. Start by adding students and staff.", createdAt: nowLocal(), read: false, href: "/dashboard", _o: Date.now() });

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach(([path, data]) => { const [c, id] = path.split("/"); batch.set(doc(db, "schools", uid, c!, id!), data); });
    await batch.commit();
  }
  // written last: its presence marks the school as fully bootstrapped
  const done = writeBatch(db);
  done.set(marker, { id: "state", complete: false, completed: [] });
  await done.commit();
}
