// Vehicle expiry reminders for the designated school administrator.
const { createHash } = require("node:crypto");

const EXPIRIES = {
  registrationValidUntil: "Registration",
  fitnessExpiryDate: "Fitness certificate",
  insuranceExpiryDate: "Insurance",
  permitExpiryDate: "Permit",
  pucExpiryDate: "PUC",
  roadTaxValidUntil: "Road tax",
};

function isoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}

function dueExpiries(bus, today) {
  const start = isoDate(today);
  if (!start) throw new Error("Expected an ISO calendar date");
  return Object.entries(EXPIRIES).flatMap(([field, label]) => {
    const expiry = bus[field];
    const date = isoDate(expiry);
    if (!date) return [];
    const days = (+date - +start) / 86_400_000;
    return days >= 0 && days <= 30 ? [{ field, label, expiry, days }] : [];
  });
}

async function sendExpiryReminders(db, today) {
  const end = isoDate(today);
  if (!end) throw new Error("Expected an ISO calendar date");
  end.setUTCDate(end.getUTCDate() + 30);
  const through = end.toISOString().slice(0, 10);
  let sent = 0;

  for (const school of await db.collection("schools").listDocuments()) {
    const settingsRef = school.collection("tr_settings").doc("expiry_notifications");
    const initialRecipient = (await settingsRef.get()).get("recipientUid");
    if (typeof initialRecipient !== "string" || !initialRecipient || initialRecipient.includes("/")) continue;

    const buses = school.collection("tr_buses");
    const matches = await Promise.all(Object.keys(EXPIRIES).map((field) =>
      buses.where(field, ">=", today).where(field, "<=", through).get(),
    ));
    const candidates = new Map(matches.flatMap((snap) => snap.docs.map((bus) => [bus.id, bus.ref])));
    for (const [busId, busRef] of candidates) {
      sent += await db.runTransaction(async (tx) => {
        const [bus, settings] = await tx.getAll(busRef, settingsRef);
        const uid = settings.get("recipientUid");
        if (!bus.exists || typeof uid !== "string" || !uid || uid.includes("/")) return 0;
        const profile = await tx.get(db.collection("users").doc(uid));
        if (profile.get("schoolId") !== school.id || profile.get("role") !== "admin") return 0;

        const data = bus.data();
        const due = dueExpiries(data, today);
        if (!due.length) return 0;
        const registration = String(data.regNo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const items = due.map((expiry) => {
          const key = createHash("sha256").update(JSON.stringify([busId, registration, expiry.field, expiry.expiry])).digest("hex");
          return { ...expiry, key, receipt: school.collection("tr_expiry_receipts").doc(key) };
        });
        const receipts = await tx.getAll(...items.map(({ receipt }) => receipt));
        const now = new Date();
        let count = 0;
        for (const [index, item] of items.entries()) {
          if (receipts[index].exists) continue;
          const busName = data.displayName ? `${data.displayName} (Bus ${data.number})` : `Bus ${data.number || busId}`;
          const when = item.days === 0 ? "expires today" : `expires in ${item.days} day${item.days === 1 ? "" : "s"}`;
          tx.create(item.receipt, { busId, field: item.field, expiry: item.expiry, createdAt: now.toISOString() });
          tx.create(school.collection("notifications").doc(`transport_expiry_${item.key}`), {
            category: "urgent", source: "transport", recipientUid: uid, read: false,
            title: `${item.label} ${when}`,
            body: `${busName}${data.regNo ? ` · ${data.regNo}` : ""} · ${item.expiry}`,
            href: `/transport?bus=${encodeURIComponent(busId)}`, createdAt: now.toISOString(), _o: now.getTime(),
          });
          count++;
        }
        return count;
      });
    }
  }
  return sent;
}

module.exports = { dueExpiries, sendExpiryReminders };
