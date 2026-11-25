const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAppMessaging } = require('./appMessaging');

/** Just enough Firestore for broadcast(): the users page query, school settings and the queue transaction. */
function fakeDb(users) {
  const created = [];
  const doc = (path) => ({ path, get: async () => ({ exists: false, get: () => undefined, data: () => undefined }) });
  const query = (rows) => {
    const q = { where: () => q, orderBy: () => q, limit: () => q, startAfter: () => ({ get: async () => ({ empty: true, docs: [], size: 0 }) }),
      get: async () => ({ empty: rows.length === 0, docs: rows, size: rows.length }) };
    return q;
  };
  const collection = (path) => ({
    doc: (id) => ({ ...doc(`${path}/${id}`), collection: (c) => collection(`${path}/${id}/${c}`) }),
    ...query(path === 'users' ? users.map((u) => ({ id: u.id, get: (k) => u[k] })) : []),
  });
  return {
    created,
    db: { collection, runTransaction: async (fn) => fn({ get: async () => ({ exists: false }), create: (ref, data) => created.push({ path: ref.path, data }) }) },
  };
}

const users = [
  { id: 'par_a', role: 'parent', schoolId: 's1', studentIds: ['stu_1'], classIds: ['cls_8A'] },
  { id: 'par_b', role: 'parent', schoolId: 's1', studentIds: ['stu_9'], classIds: ['cls_9B'] },
  { id: 'par_c', role: 'parent', schoolId: 's1', studentIds: ['stu_5'], classIds: ['cls_7C'] },
  { id: 'tch_ct', role: 'teacher', schoolId: 's1', staffId: 'stf_ct' },
  { id: 'tch_other', role: 'teacher', schoolId: 's1', staffId: 'stf_other' },
  { id: 'drv', role: 'driver', schoolId: 's1' },
];
const jobsFor = (created) => created.filter((c) => c.path.includes('push_deliveries')).map((c) => c.data.uid).sort();
const msg = { type: 'notice', title: 'Lab safety', body: 'Wear goggles', route: '/notifications', urgent: true };

test('a selected classes / people notice reaches only its targets', async () => {
  const f = fakeDb(users);
  const n = await createAppMessaging({ db: f.db, clock: () => 0 }).broadcast('s1', 'notice:n1', msg, 'Selected classes or people', [],
    { classIds: ['cls_8A'], studentIds: ['stu_9'], staffIds: ['stf_ct'] });
  assert.equal(n, 3);
  assert.deepEqual(jobsFor(f.created), ['par_a', 'par_b', 'tch_ct'], 'class 8-A parent, the picked student\'s parent, the class teacher — not other teachers, parents or crew');
});

test('without targets the audience string still decides (All School reaches everyone)', async () => {
  const f = fakeDb(users);
  const n = await createAppMessaging({ db: f.db, clock: () => 0 }).broadcast('s1', 'notice:n2', msg, 'All School', [], { classIds: [], studentIds: [], staffIds: [] });
  assert.equal(n, 6);
});
