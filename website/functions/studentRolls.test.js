const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rollPlan, assignDivisionRolls } = require('./studentRolls');

test('an unnumbered division is numbered 1..n in name order, ignoring inactive and deleted students', () => {
  const plan = rollPlan([
    { id: 'c', name: 'Chetan Das' }, { id: 'a', name: 'aarav Mehta' }, { id: 'b', name: 'Bina Rao', roll: 0 },
    { id: 'x', name: 'Alumni', status: 'Graduated' }, { id: 'y', name: 'Gone', deleted: true },
  ], '2026-27');
  assert.deepEqual(plan, [{ id: 'a', roll: 1 }, { id: 'b', roll: 2 }, { id: 'c', roll: 3 }]);
});

test('newcomers to a numbered division continue after the highest number; existing numbers never move', () => {
  const plan = rollPlan([
    { id: 'z', name: 'Zara', roll: 2, rollAcademicYear: '2026-27' }, { id: 'a', name: 'Aarav', roll: 1, rollAcademicYear: '2026-27' },
    { id: 'n2', name: 'Meera' }, { id: 'n1', name: 'Dev', roll: '' },
    { id: 'old', name: 'Old Year', roll: 7, rollAcademicYear: '2025-26' },
  ], '2026-27');
  assert.deepEqual(plan, [{ id: 'n1', roll: 3 }, { id: 'n2', roll: 4 }, { id: 'old', roll: 5 }]);
  assert.deepEqual(rollPlan([{ id: 'a', name: 'A', roll: 1 }], ''), [], 'nothing to do');
});

function fakeDb(seed) {
  const data = new Map(Object.entries(seed));
  const ref = (path) => ({ path, id: path.split('/').at(-1), collection: (name) => query(`${path}/${name}`),
    get: async () => snapshot(path), update: async (value) => data.set(path, { ...data.get(path), ...value }) });
  const snapshot = (path) => { const row = data.get(path); return { id: path.split('/').at(-1), exists: !!row, ref: ref(path), data: () => row, get: (key) => row?.[key] }; };
  const query = (path, filters = []) => ({ doc: (id) => ref(`${path}/${id}`), where: (key, op, val) => query(path, [...filters, [key, val]]),
    get: async () => ({ docs: [...data.keys()].filter((k) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map(snapshot).filter((d) => filters.every(([k, v]) => d.get(k) === v)) }) });
  return { data, collection: (path) => query(path), runTransaction: async (fn) => fn({ getAll: async (...refs) => Promise.all(refs.map((r) => r.get())), get: async (t) => t.get(), update: (t, v) => t.update(v) }) };
}

test('the division transaction numbers the pending students and bumps the class revision, unless rolls are manual or a rollover runs', async () => {
  const seed = {
    'schools/s1/school/school': { academicYear: '2026-27' },
    'schools/s1/classes/cls_10B': { grade: '10', section: 'B', rollRevision: 2 },
    'schools/s1/students/s1': { name: 'Bina', classId: 'cls_10B', roll: '' },
    'schools/s1/students/s2': { name: 'Aarav', classId: 'cls_10B', roll: '' },
    'schools/s1/students/s3': { name: 'Other class', classId: 'cls_9A', roll: '' },
  };
  const db = fakeDb(seed);
  assert.equal(await assignDivisionRolls(db, 's1', 'cls_10B'), 2);
  assert.equal(db.data.get('schools/s1/students/s2').roll, 1);
  assert.equal(db.data.get('schools/s1/students/s1').roll, 2);
  assert.equal(db.data.get('schools/s1/students/s1').rollAcademicYear, '2026-27');
  assert.equal(db.data.get('schools/s1/students/s3').roll, '', 'other divisions untouched');
  assert.ok(db.data.get('schools/s1/classes/cls_10B').rollRevision, 'revision bumped');
  assert.equal(await assignDivisionRolls(db, 's1', 'cls_10B'), 0, 'idempotent');

  const manual = fakeDb({ ...seed, 'schools/s1/set_config/rolls': { auto: false } });
  assert.equal(await assignDivisionRolls(manual, 's1', 'cls_10B'), 0);
  assert.equal(manual.data.get('schools/s1/students/s2').roll, '');
  const locked = fakeDb({ ...seed, 'platform_schools/s1': { rolloverJob: '2027-28' } });
  assert.equal(await assignDivisionRolls(locked, 's1', 'cls_10B'), 0);
});
