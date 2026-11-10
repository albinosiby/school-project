const assert = require("node:assert/strict");
const test = require("node:test");
const { dueExpiries, sendExpiryReminders } = require("./transportExpiry");

test("includes exactly 30 days and catches up inside the window, excluding expired or invalid dates", () => {
  const due = dueExpiries({
    insuranceExpiryDate: "2026-12-10", fitnessExpiryDate: "2026-11-11",
    registrationValidUntil: "2026-11-10", permitExpiryDate: "2026-12-11",
    pucExpiryDate: "2026-11-09", roadTaxValidUntil: "2026-11-31",
  }, "2026-11-10");
  assert.deepEqual(due.map(({ field, days }) => [field, days]), [
    ["registrationValidUntil", 0], ["fitnessExpiryDate", 1], ["insuranceExpiryDate", 30],
  ]);
});

function fakeDb(records) {
  const data = new Map(Object.entries(records));
  function doc(path) {
    const snapshot = () => ({
      id: path.split("/").at(-1), ref: doc(path), exists: data.has(path),
      get: (key) => data.get(path)?.[key], data: () => data.get(path),
    });
    return { id: path.split("/").at(-1), path, get: async () => snapshot(), collection: (name) => collection(`${path}/${name}`) };
  }
  function collection(path, conditions = []) {
    const own = [...data.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/"));
    return {
      doc: (id) => doc(`${path}/${id}`),
      listDocuments: async () => own.map(doc),
      where: (field, op, value) => collection(path, [...conditions, [field, op, value]]),
      get: async () => ({
        docs: await Promise.all(own.filter((key) => conditions.every(([field, op, value]) => {
          const fieldValue = data.get(key)[field];
          return op === ">=" ? fieldValue >= value : fieldValue <= value;
        })).map((key) => doc(key).get())),
      }),
    };
  }
  return {
    data, collection,
    async runTransaction(fn) {
      const writes = [];
      const result = await fn({
        get: (ref) => ref.get(),
        getAll: (...refs) => Promise.all(refs.map((ref) => ref.get())),
        create: (ref, body) => writes.push([ref.path, body]),
      });
      for (const [path, body] of writes) {
        assert.ok(!data.has(path), `duplicate create: ${path}`);
        data.set(path, body);
      }
      return result;
    },
  };
}

test("sends one reminder to the designated administrator, ignores other schools and handles renewal", async () => {
  const busPath = "schools/north/tr_buses/bus_01";
  const db = fakeDb({
    "schools/north": {}, "schools/south": {},
    "users/admin-north": { schoolId: "north", role: "admin" },
    "schools/north/tr_settings/expiry_notifications": { recipientUid: "admin-north" },
    "schools/south/tr_settings/expiry_notifications": { recipientUid: "admin-north" },
    [busPath]: { number: "14", regNo: "KL-07-AB-2026", insuranceExpiryDate: "2026-12-10", fitnessExpiryDate: "2026-12-10" },
    "schools/south/tr_buses/bus_02": { number: "15", insuranceExpiryDate: "2026-12-10" },
  });
  const notices = () => [...db.data.entries()].filter(([path]) => path.includes("/notifications/"));
  assert.equal(await sendExpiryReminders(db, "2026-11-10"), 2);
  assert.equal(notices().length, 2);
  assert.deepEqual(notices().map(([, n]) => n.title).sort(), [
    "Fitness certificate expires in 30 days", "Insurance expires in 30 days",
  ]);
  for (const [path, notice] of notices()) {
    assert.match(path, /^schools\/north\//);
    assert.equal(notice.recipientUid, "admin-north");
    assert.equal(notice.href, "/transport?bus=bus_01");
  }

  db.data.delete(notices()[0][0]);
  assert.equal(await sendExpiryReminders(db, "2026-11-11"), 0, "deleting a notice does not resend it");
  db.data.set(busPath, { ...db.data.get(busPath), insuranceExpiryDate: "2027-12-10" });
  assert.equal(await sendExpiryReminders(db, "2027-11-10"), 1, "a renewed date receives its own reminder");
});
