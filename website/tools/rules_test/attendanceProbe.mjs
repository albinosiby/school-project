// Probe: which live condition can make a class teacher's attendance write fail? Mirrors the teacher app's exact payload.
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, setLogLevel } from "firebase/firestore";
setLogLevel("silent");
const port = Number(process.env.RULES_TEST_PORT || 8873);
const env = await initializeTestEnvironment({ projectId: process.env.EMULATOR_PROJECT || "demo-att-probe", firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
const T = "stf_9501fabb-dcb2-4fea-ba34-73cbea79bba3", UID = "uid_t", SID = "S1";
const payload = { date: "2026-11-23", classId: "cls_5B", grade: "5", section: "B", period: 1, total: 30, marks: { stu_1: "A", stu_2: "L" }, submitted: true, teacherId: T, updatedAt: "2026-11-23T04:45:12.123456", updatedBy: UID };
async function scenario(title, seedExtra, expectOk, body = payload) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const seed = {
      [`users/${UID}`]: { schoolId: SID, role: "teacher", staffId: T, staffRole: "teacher", name: "Fathima Beevi" },
      [`schools/${SID}/classes/cls_5B`]: { grade: "5", section: "B", classTeacherId: T, classTeacher: "Fathima Beevi", subjects: ["English"] },
      [`schools/${SID}/assignments/asg_cls_5B__english`]: { subject: "English", teacherId: T, classId: "cls_5B", teacher: "Fathima Beevi" },
      [`schools/${SID}/ops_periods/per_5B_Mon_3`]: { classId: "cls_5B", grade: "5", section: "B", teacherId: T, subject: "English", day: "Mon", period: 3, room: "R-5B" },
      ...seedExtra,
    };
    for (const [p, data] of Object.entries(seed)) await setDoc(doc(db, p), data);
  });
  const as = env.authenticatedContext(UID).firestore();
  const write = setDoc(doc(as, `schools/${SID}/ops_attendance/2026-11-23_cls_5B_1`), body, { mergeFields: Object.keys(body) });
  try { await (expectOk ? assertSucceeds(write) : assertFails(write)); console.log(`ok   ${title}`); }
  catch (e) { console.log(`FAIL ${title}: ${e.message.split("\n")[0]}`); }
}
try {
  await scenario("class teacher, no teaching_access, no set_roles → allowed", {}, true);
  await scenario("… plus teaching_access anchor → allowed", { [`schools/${SID}/teaching_access/cls_5B__${T}`]: { classId: "cls_5B", teacherId: T, assignmentId: "asg_cls_5B__english", periodId: "per_5B_Mon_3", subjects: { English: { assignmentId: "asg_cls_5B__english" } } } }, true);
  await scenario("set_roles/role_teacher WITHOUT Daily Attendance → denied", { [`schools/${SID}/set_roles/role_teacher`]: { name: "Teacher", perms: ["Homework Broadcast"] } }, false);
  await scenario("set_roles/role_teacher WITH Daily Attendance → allowed", { [`schools/${SID}/set_roles/role_teacher`]: { name: "Teacher", perms: ["Daily Attendance"] } }, true);
  await scenario("platform_schools with a rolloverJob → denied", { [`platform_schools/${SID}`]: { status: "active", rolloverJob: "job_1" } }, false);
  await scenario("platform_schools active, no job → allowed", { [`platform_schools/${SID}`]: { status: "active" } }, true);
  await scenario("staffRole hod with role_hod lacking the perm → denied", { [`users/${UID}`]: { schoolId: SID, role: "teacher", staffId: T, staffRole: "hod" }, [`schools/${SID}/set_roles/role_hod`]: { name: "HOD", perms: [] } }, false);
  await scenario("all present: empty marks map → allowed", {}, true, { ...payload, marks: {} });
  await scenario("all present but marks key missing → denied", {}, false, Object.fromEntries(Object.entries(payload).filter(([k]) => k !== "marks")));
  await scenario("not class teacher and no anchor (assignment only) → denied", { [`schools/${SID}/classes/cls_5B`]: { grade: "5", section: "B", classTeacherId: "stf_other" } }, false);
} finally { await env.cleanup(); }
