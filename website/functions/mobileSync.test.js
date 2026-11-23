const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mobileSync } = require('./mobileSync');
const domain = require('./mobileFeeDomain');

function fakeDb(seed) {
  const data = new Map(Object.entries(seed));
  const db = { doc: path => ref(path), collection: path => query(path), getAll: async (...refs) => Promise.all(refs.map(r => r.get())), runTransaction: async build => build({get: async target => target.get(), update: (target, value) => target.update(value), set: (target, value) => target.set(value)}) };
  function ref(path) {
    return { path, id: path.split('/').at(-1), collection: name => query(`${path}/${name}`),
      get: async () => snapshot(path), set: async value => data.set(path, structuredClone(value)),
      update: async value => data.set(path, { ...data.get(path), ...structuredClone(value) }) };
  }
  function snapshot(path) {
    const row = data.get(path);
    return { id: path.split('/').at(-1), exists: !!row, data: () => row, ref: ref(path),
      get: key => key.split('.').reduce((v, k) => v?.[k], row) };
  }
  function query(path, filters = [], cap = Infinity) {
    return { doc: id => ref(`${path}/${id}`), where: (key, op, val) => query(path, [...filters, [key,op,val]], cap), limit: n => query(path, filters, n),
      get: async () => ({ docs: [...data.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1)
        .map(snapshot).filter(d => filters.every(([key,op,val]) => op === 'in' ? val.includes(d.get(key)) : op === '>=' ? d.get(key) >= val : op === '<=' ? d.get(key) <= val : d.get(key) === val)).slice(0,cap) }) };
  }
  return db;
}
const base = 'schools/s1/';
function fixture(extra = {}) {
  return fakeDb({
    'users/p1': { schoolId: 's1', role: 'parent', studentIds: ['kid'] },
    [base+'students/kid']: { name: 'Synthetic Student', grn: 'G1', grade: 'UKG', classId: 'cls_UKGA', admissionDate: '2026-04-02', busId: 'bus1', busAssignmentRevision: 2 },
    [base+'school/school']: { name: 'Synthetic School', academicYear: '2026-27' },
    [base+'set_terms/t1']: { start: '2026-04-01', end: '2027-03-31' },
    [base+'set_config/bell']: { start: '09:00', end: '13:00', periodCount: 3, periodLength: 40, breaks: [{ name: 'Lunch', start: '10:20', duration: 30 }] },
    [base+'set_config/attendance_policy']: { minimumPercent: 82.5, privateNote: 'hidden' },
    [base+'set_config/profile']: { digitalKey: 'secret' },
    [base+'set_config/fee_policy']: { transportFrequency: 'Annual' },
    [base+'fee_structure/ukg']: { grade: 'UKG', academicYear: '2026-27', schemaVersion: 2, termsPerYear: 1, items: [
      { id: 'tuition', name: 'Tuition', grades: ['UKG'], amount: 10000, frequency: 'Annual', mandatory: true, newStudentsOnly: false }] },
    [base+'student_transport_fees/kid']: { studentId: 'kid', busId: 'bus1', busAssignmentRevision: 2, amount: 1200 },
    [base+'fee_concessions/c1']: { grn: 'G1', type: 'Other', amount: 1000, status: 'Approved', academicYear: '2026-27' },
    ...extra,
  });
}
const request = (data = {}, uid = 'p1') => ({ auth: { uid, token: {} }, data });

test('mobile settings match the dashboard bell schedule and expose only safe configuration', async () => {
  const value = await mobileSync(fixture()).getMobileSchoolContext.run(request());
  assert.equal(value.minimumAttendance, 82.5);
  assert.deepEqual(value.schedule.map(s => s.label), ['Period 1', 'Period 2', 'Lunch', 'Period 3']);
  assert.equal(value.schedule.at(-1).start, '10:50');
  assert.equal(value.academicRange.start, '2026-04-01');
  assert.ok(!JSON.stringify(value).includes('secret'));
  assert.ok(!JSON.stringify(value).includes('privateNote'));
});
test('repeated settings refreshes and out-of-order retry events preserve the latest fee revision', async () => {
  const db = fixture(), service = mobileSync(db);
  const first = await service.getMobileSchoolContext.run(request());
  assert.deepEqual(await service.getMobileSchoolContext.run(request()), first);
  await service.onMobileFeePlanChanged.run({ params: { sid: 's1' }, time: '2026-11-21T10:00:00Z' });
  await service.onMobileFeePlanChanged.run({ params: { sid: 's1' }, time: '2026-11-20T10:00:00Z' });
  assert.equal((await db.doc(base+'school/mobile').get()).get('feeRevision'), '2026-11-21T10:00:00Z');
});
test('a parent sees annual fees including transport and concessions before an invoice exists', async () => {
  const value = await mobileSync(fixture()).getMobileStudentFees.run(request({ studentId: 'kid' }));
  assert.equal(value.complete, true); assert.equal(value.net, 10200); assert.equal(value.payable, 10200); assert.equal(value.paid, 0);
  assert.deepEqual(value.invoiceIds, []);
});
test('recorded partial payments reduce annual balance without applying a concession twice', async () => {
  const value = await mobileSync(fixture({ [base+'fee_invoices/i1']: { studentId: 'kid', grn: 'G1', academicYear: '2026-27', amount: 9000, paid: 3000,
    issued: '2026-04-02', lines: [{ feeItemId: 'tuition', label: 'Tuition', amount: 10000, quantity: 1 }] } })).getMobileStudentFees.run(request({ studentId: 'kid' }));
  assert.equal(value.net, 10200); assert.equal(value.payable, 7200); assert.equal(value.paid, 3000);
});
test('foreign students, stale credentials and suspended schools cannot access mobile financial data', async () => {
  await assert.rejects(() => mobileSync(fixture()).getMobileStudentFees.run(request({ studentId: 'other' })), /not linked/);
  await assert.rejects(() => mobileSync(fixture({ 'users/p1': { role: 'parent', schoolId: 's1', studentIds: ['kid'], parentCredentialVersion: 'v2' } })).getMobileStudentFees.run(request({ studentId: 'kid' })), /Sign in again/);
  await assert.rejects(() => mobileSync(fixture({ 'platform_schools/s1': { status: 'suspended' } })).getMobileSchoolContext.run(request()), /unavailable/);
});
test('a transport fee from an old bus assignment is not billed', async () => {
  const value = await mobileSync(fixture({ [base+'student_transport_fees/kid']: { busId: 'bus1', busAssignmentRevision: 1, amount: 1200 } })).getMobileStudentFees.run(request({ studentId: 'kid' }));
  assert.equal(value.complete, false); assert.match(value.issues.join(' '), /transport/);
});
test('staff certificate list is scoped to the linked staff identity', async () => {
  const value = await mobileSync(fixture({ 'users/t1': { role: 'teacher', schoolId: 's1', staffId: 'st1' },
    [base+'staff/st1']: { authUid: 't1' },
    [base+'certificates/a']: { staffId: 'st1', recipientKind: 'staff', type: 'salary', status: 'Issued' },
    [base+'certificates/b']: { staffId: 'st2', recipientKind: 'staff', type: 'salary', status: 'Issued' },
  })).getMobileStaffCertificates.run(request({}, 't1'));
  assert.deepEqual(value.certificates.map(c => c.id), ['a']);
});
test('mobile document creation checks invoice ownership, rather than trusting the supplied id', async () => {
  await assert.rejects(() => mobileSync(fixture()).downloadMobileFeeDocument.run(request({ studentId: 'kid', kind: 'invoice', documentId: 'foreign' })), /not linked/);
});
test('the bundled academic attendance rules exclude other years, pre-admission days and unmarked days', () => {
  const result = domain.recordedAttendance([{ studentId: 'kid', days: { '2025-04-01': 'P', '2026-04-01': 'P', '2026-04-02': 'P', '2026-04-03': 'L', '2026-04-04': 'E', '2026-04-05': '?' } }],
    [{ id: 'kid', admissionDate: '2026-04-02' }], { start: '2026-04-01', end: '2027-03-31' }).get('kid');
  assert.equal(result.days, 3); assert.equal(result.attended, 2); assert.equal(result.pct, 66.7);
});

test('regional settings handle Dubai and a Sunday-to-Thursday school week', () => {
  const { workingDays, utcOffsetMinutes } = require('./mobileSettings');
  assert.deepEqual(workingDays('Sun – Thu'), [7,1,2,3,4]);
  assert.deepEqual(workingDays('Mon, Wed, Fri'), [1,3,5]);
  assert.deepEqual(workingDays('Mon – Sat (2nd & 4th Saturday Off)'), [1,2,3,4,5,6]);
  assert.deepEqual(workingDays('Monday to Friday'), [1,2,3,4,5]);
  assert.deepEqual(workingDays('Mon-Sat'), [1,2,3,4,5,6]);
  assert.equal(utcOffsetMinutes('GST · UTC+04:00 (Dubai)'), 240);
  assert.equal(utcOffsetMinutes('IST · UTC+05:30 (New Delhi)'), 330);
});
test('dated substitutions expose only the linked child class and omit private notes', async () => {
  const db = fixture({ [base+'staff/t1']: { name: 'Substitute A', salary: 45000 },
    [base+'ops_substitutions/s1']: { classId: 'cls_UKGA', date: '2026-11-23', period: 2, subject: 'English', substituteTeacherId: 't1', reason: 'Private medical information' },
    [base+'ops_substitutions/s2']: { classId: 'cls_UKGB', date: '2026-11-23', period: 2, substituteTeacherId: 't1' },
    [base+'ops_substitutions/s3']: { classId: 'cls_UKGA', date: '2026-11-23', period: 1, substituteTeacherId: 't1', status: 'Declined' },
  });
  const result = await mobileSync(db).getMobileStudentTimetable.run(request({ studentId: 'kid', weekStart: '2026-11-23' }));
  assert.equal(result.substitutions.length, 1); assert.equal(result.substitutions[0].teacher, 'Substitute A');
  assert.ok(!JSON.stringify(result).includes('medical')); assert.ok(!JSON.stringify(result).includes('45000'));
});
test('official certificate PDFs are accessible to their own staff recipient only', async () => {
  const { authorisedCertificate } = require('./certificateManagement');
  const db = fixture({ 'users/t1': { role: 'teacher', schoolId: 's1', staffId: 'st1' },
    'users/t2': { role: 'teacher', schoolId: 's1', staffId: 'st2' },
    [base+'staff/st1']: { authUid: 't1' },
    [base+'certificates/c1']: { staffId: 'st1', recipientKind: 'staff', status: 'Issued', pdfPath: 'schools/s1/certificate-files/c1/file.pdf' },
  });
  const data = { schoolId: 's1', certificateId: 'c1' };
  assert.equal((await authorisedCertificate(db, request(data, 't1'))).staffId, 'st1');
  await assert.rejects(() => authorisedCertificate(db, request(data, 't2')), /cannot download/);
  await assert.rejects(() => authorisedCertificate(db, request(data, 'p1')), /cannot download/);
});
test('mobile invoice/receipt PDFs are A4 and keep large ledgers on multiple pages', async () => {
  const { renderFeeDocument } = require('./mobileFeePdf');
  const { PDFDocument } = require('../node_modules/pdf-lib');
  const pdf = await renderFeeDocument({ school: { name: 'Synthetic School' }, student: { name: 'Synthetic Student', grade: '8' }, invoice: {
    no: 'INV-1', amount: 40000, paid: 1000, lines: Array.from({ length: 40 }, (_, i) => ({ label: `Synthetic fee item ${i + 1}`, amount: 1000 })),
  } });
  const doc = await PDFDocument.load(pdf); assert.ok(doc.getPageCount() > 1);
  for (const page of doc.getPages()) { assert.ok(Math.abs(page.getWidth() - 595.28) < .1); assert.ok(Math.abs(page.getHeight() - 841.89) < .1); }
});
