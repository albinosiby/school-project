// Durable Firebase Messaging outbox. Feed rows and push jobs are committed together.
// FCM accepts messages for delivery; it does not confirm that a device displayed them.
const { createHash, randomUUID } = require("node:crypto");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { schoolTimeZone } = require("./schoolTime");
const { getMessaging } = require("firebase-admin/messaging");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const { audienceClassTest } = require("./classIdentity");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const DEAD = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
const PERMANENT = new Set([...DEAD, "messaging/invalid-argument", "messaging/mismatched-credential"]);

function createAppMessaging({ db, send = (message) => getMessaging().sendEachForMulticast(message), clock = () => Date.now(), accountEnabled = async (uid) => { try { return !(await getAuth().getUser(uid)).disabled; } catch (e) { if (e.code === "auth/user-not-found") return false; throw e; } } }) {
  const school = (sid) => db.collection("schools").doc(sid);
  async function queue(sid, user, source, message, push = true) {
    const uid = user.id, role = user.get("role"), now = new Date(clock()).toISOString();
    const payload = { ...message, title: message.title.slice(0, 120), route: role === "teacher" && message.type === "notice" ? "/circulars" : message.route };
    const id = hash(`${source}:${uid}`), job = school(sid).collection("push_deliveries").doc(id);
    // the feed row names its notice so opening it can count as a read (noticeReceipts.js)
    const noticeId = source.startsWith("notice:") ? source.slice(7) : "";
    const feed = role === "parent" ? school(sid).collection("par_notifications").doc(`app_${id}`)
      : role === "teacher" ? school(sid).collection("hm_notifications").doc(`app_${id}`) : null;
    await db.runTransaction(async (tx) => {
      if ((await tx.get(job)).exists) return;
      if (feed) tx.create(feed, role === "parent"
        ? { uid, studentId: "", type: message.type, title: message.title, body: message.body, route: payload.route, read: false, at: now, ord: clock(), ...(noticeId ? { noticeId } : {}) }
        : { teacherId: user.get("staffId"), ...(noticeId ? { noticeId } : {}), type: message.type === "notice" ? "circular" : "event", category: "Academic", tag: message.urgent ? "Urgent" : "School update", title: message.title, body: message.body, route: payload.route, read: false, at: now, ord: clock() * 1000, updatedAt: now, source: "push" });
      tx.create(job, { uid, role, name: String(user.get("name") ?? ""), ...(user.get("staffId") ? { staffId: user.get("staffId") } : {}), source, message: payload, status: push ? "Pending" : "Muted", createdAt: now, attempts: 0, accepted: 0, failed: 0, outcomes: {} });
    });
  }
  /**
   * Queues a notice for its audience. `targets` ({classIds, studentIds, staffIds}, resolved by the admin web when it is
   * saved) narrows it to the selected classes and people: parents of those students or of children in those classes,
   * and those staff (the classes' class and subject teachers are already in staffIds). Nobody else gets it.
   */
  async function broadcast(sid, source, message, audience, grades = [], targets = null) {
    const tests = grades.map(audienceClassTest).filter(Boolean);
    const set = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
    const tClasses = set(targets?.classIds), tStudents = set(targets?.studentIds), tStaff = set(targets?.staffIds);
    const targeted = tClasses.size + tStudents.size + tStaff.size > 0;
    const regional = await school(sid).collection("set_config").doc("regional").get();
    let count = 0, last;
    for (;;) {
      let query = db.collection("users").where("schoolId", "==", sid).orderBy("__name__").limit(200);
      if (last) query = query.startAfter(last);
      const page = await query.get();
      if (page.empty) break;
      for (let offset = 0; offset < page.docs.length; offset += 15) {
        await Promise.all(page.docs.slice(offset, offset + 15).map(async (user) => {
          const role = user.get("role");
          const targetedParent = targeted && role === "parent" && ((user.get("studentIds") || []).some((id) => tStudents.has(String(id)))
            || (user.get("classIds") || []).some((id) => tClasses.has(String(id))));
          const targetedTeacher = targeted && role === "teacher" && tStaff.has(String(user.get("staffId") || ""));
          const parent = targeted ? targetedParent : role === "parent" && /parent|guardian|all school|whole school|everyone/i.test(audience)
            && (user.get("studentIds") || []).length > 0 && (!grades.length || (user.get("classIds") || []).some((id) => tests.some((test) => test.test(id))));
          const teacher = targeted ? targetedTeacher : role === "teacher" && user.get("staffId") && /staff|teacher|faculty|all school/i.test(audience);
          const crew = !targeted && ["driver", "attendant"].includes(role) && /transport|staff|driver|bus|all|everyone|whole/i.test(audience);
          if (!parent && !teacher && !crew) return;
          let push = true;
          if (teacher && !message.urgent) {
            const prefs = await school(sid).collection("hm_settings").where("teacherId", "==", user.get("staffId")).limit(1).get();
            const p = prefs.docs[0]?.data() || {};
            push = p.classUpdates !== false;
            if (p.dnd && push) {
              const time = new Intl.DateTimeFormat("en-GB", {timeZone: schoolTimeZone(regional.get("timezone")), hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).format(clock()), from = p.dndFrom || "18:00", to = p.dndTo || "07:30";
              push = !(from <= to ? time >= from && time < to : time >= from || time < to);
            }
          }
          await queue(sid, user, source, message, push); count++;
        }));
      }
      last = page.docs.at(-1);
      if (page.size < 200) break;
    }
    return count;
  }
  async function dispatch(ref) {
    const lease = randomUUID(), now = clock();
    const state = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref), data = snap.data();
      if (!data || !["Pending", "Sending"].includes(data.status)) return null;
      if (data.leaseUntil > now) throw new Error("Push delivery is already being processed; retry after its lease.");
      if (data.attempts >= 8 || now - Date.parse(data.createdAt) > 864e5) { tx.update(ref, { status: "Failed", finishedAt: new Date(now).toISOString() }); return null; }
      tx.update(ref, { status: "Sending", lease, leaseUntil: now + 120000, attempts: data.attempts + 1 });
      return data;
    });
    if (!state) return;
    try {
      const sid = ref.parent.parent.id;
      const [schoolState, profile, tokenDocs] = await Promise.all([db.collection("platform_schools").doc(sid).get(), db.collection("users").doc(state.uid).get(), db.collection("users").doc(state.uid).collection("fcm_tokens").get()]);
      if (schoolState.get("status") === "suspended" || profile.get("schoolId") !== sid || profile.get("role") !== state.role || (state.role === "parent" && !(profile.get("studentIds") || []).length) || !(await accountEnabled(state.uid))) {
        await ref.update({ status: "Cancelled", leaseUntil: 0 }); return;
      }
      const app = state.role === "parent" ? "parent" : state.role === "teacher" ? "teacher" : "driver";
      const version = profile.get("parentCredentialVersion");
      const tokens = tokenDocs.docs.filter((d) => (d.get("app") || app) === app && (state.role !== "parent" || !version || d.get("parentCredentialVersion") === version));
      const outcomes = { ...state.outcomes };
      let retry = false;
      for (let offset = 0; offset < tokens.length; offset += 500) {
        const part = tokens.slice(offset, offset + 500).filter((d) => !outcomes[hash(d.id)]);
        if (!part.length) continue;
        const result = await send({ tokens: part.map((d) => d.id), notification: { title: state.message.title, body: state.message.body },
          data: { type: state.message.type, route: state.message.route, notificationId: ref.id },
          android: { priority: "high", notification: { tag: ref.id } }, apns: { headers: { "apns-collapse-id": ref.id }, payload: { aps: { sound: "default" } } } });
        for (let i = 0; i < result.responses.length; i++) {
          const resultItem = result.responses[i], code = resultItem.error?.code;
          if (resultItem.success) outcomes[hash(part[i].id)] = "Accepted";
          else if (PERMANENT.has(code)) { outcomes[hash(part[i].id)] = "Failed"; if (DEAD.has(code)) await part[i].ref.delete(); }
          else retry = true;
        }
        // Save successful device results before retrying transient failures.
        await ref.update({ outcomes });
      }
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.get("lease") !== lease) return;
        tx.update(ref, { status: retry ? "Pending" : tokens.length ? "Completed" : "No devices", leaseUntil: 0, accepted: Object.values(outcomes).filter((value) => value === "Accepted").length,
          failed: Object.values(outcomes).filter((value) => value === "Failed").length, ...(retry ? {} : { finishedAt: new Date(clock()).toISOString() }) });
      });
      if (retry) throw new Error("Some Firebase Messaging requests require retry.");
    } catch (error) {
      await db.runTransaction(async (tx) => { const current = await tx.get(ref); if (current.get("lease") === lease) tx.update(ref, { leaseUntil: 0 }); });
      logger.warn("App push needs retry", { deliveryId: ref.id });
      throw error;
    }
  }
  return { queue, broadcast, dispatch };
}
exports.createAppMessaging = createAppMessaging;
exports.appMessaging = () => createAppMessaging({ db: getFirestore() });
exports.onAppPushQueued = onDocumentCreated({ document: "schools/{sid}/push_deliveries/{id}", retry: true, timeoutSeconds: 180, concurrency: 8 }, async (e) => {
  if (e.data) await exports.appMessaging().dispatch(e.data.ref);
});
