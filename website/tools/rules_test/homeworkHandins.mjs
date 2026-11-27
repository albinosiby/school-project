// Homework hand-ins from the parent app: par_hw_submissions (Firestore) and the files (Storage).
//   EMULATOR_PROJECT=demo-hw-handins tools/emulator_exec.sh firestore,storage "cd tools/rules_test && node homeworkHandins.mjs"
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, setLogLevel } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
setLogLevel('silent');
const host = (v, d) => { const [h, p] = (process.env[v] ?? d).split(':'); return { host: h, port: Number(p) }; };
const env = await initializeTestEnvironment({
  projectId: process.env.EMULATOR_PROJECT ?? 'demo-hw-handins',
  firestore: { ...host('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080'), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  storage: { ...host('FIREBASE_STORAGE_EMULATOR_HOST', '127.0.0.1:9199'), rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8') },
});
let checks = 0;
const check = async (name, p) => { await p; checks++; console.log(`ok ${name}`); };
const S = 'schools/S1';
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const docs = {
      'users/p1': { role: 'parent', schoolId: 'S1', studentIds: ['stu1'], classIds: ['cls_5B'] },
      'users/p2': { role: 'parent', schoolId: 'S1', studentIds: ['stu2'], classIds: ['cls_5B'] },
      'users/t1': { role: 'teacher', schoolId: 'S1', staffId: 'stf1' },
      'users/t2': { role: 'teacher', schoolId: 'S1', staffId: 'stf2' },
      'platform_schools/S1': { status: 'active' },
      [`${S}/ops_homework/hw1`]: { classId: 'cls_5B', teacherId: 'stf1', status: 'open', title: 'Fractions' },
      [`${S}/ops_homework/hw2`]: { classId: 'cls_5B', teacherId: 'stf1', status: 'closed', title: 'Old' },
      [`${S}/par_homework/stu1_hw1`]: { studentId: 'stu1', homeworkId: 'hw1', status: 'open', submission: { status: 'pending' } },
      [`${S}/par_homework/stu1_hw2`]: { studentId: 'stu1', homeworkId: 'hw2', status: 'closed', submission: { status: 'pending' } },
      [`${S}/par_homework/stu1_hw3`]: { studentId: 'stu1', homeworkId: 'hw3', status: 'open', submission: { status: 'graded', marks: 9 } },
    };
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
  const fs = (uid) => env.authenticatedContext(uid).firestore();
  const sub = (studentId, homeworkId, extra = {}) => ({
    studentId, homeworkId, uid: 'p1', note: 'Page 2 has the diagram', submittedAt: '2026-11-26T10:00:00Z', updatedAt: '2026-11-26T10:00:00Z',
    files: [{ name: 'a.jpg', url: 'https://x/a.jpg', path: `${S}/homework/${homeworkId}/${studentId}/1_a.jpg`, type: 'image/jpeg', size: 3 }], ...extra,
  });
  const put = (uid, id, data) => setDoc(doc(fs(uid), `${S}/par_hw_submissions/${id}`), data);

  await check('guardian hands in for own child on an open homework', assertSucceeds(put('p1', 'stu1_hw1', sub('stu1', 'hw1'))));
  await check('guardian replaces the hand-in', assertSucceeds(put('p1', 'stu1_hw1', sub('stu1', 'hw1', { note: 'v2' }))));
  await check('guardian reads own hand-in', assertSucceeds(getDoc(doc(fs('p1'), `${S}/par_hw_submissions/stu1_hw1`))));
  await check('another parent cannot read it', assertFails(getDoc(doc(fs('p2'), `${S}/par_hw_submissions/stu1_hw1`))));
  await check('another parent cannot hand in for someone else\'s child', assertFails(put('p2', 'stu1_hw1', { ...sub('stu1', 'hw1'), uid: 'p2' })));
  await check('closed homework refuses hand-ins', assertFails(put('p1', 'stu1_hw2', sub('stu1', 'hw2'))));
  await check('graded homework refuses hand-ins', assertFails(put('p1', 'stu1_hw3', sub('stu1', 'hw3'))));
  await check('a doc id that does not match the child and homework is refused', assertFails(put('p1', 'stu1_hwX', sub('stu1', 'hw1'))));
  await check('no files is refused', assertFails(put('p1', 'stu1_hw1', sub('stu1', 'hw1', { files: [] }))));
  await check('extra fields (e.g. a grade) are refused', assertFails(put('p1', 'stu1_hw1', sub('stu1', 'hw1', { marks: 10 }))));
  await check('uid must be the signed-in parent', assertFails(put('p1', 'stu1_hw1', sub('stu1', 'hw1', { uid: 'p2' }))));
  await check('a teacher cannot write hand-ins', assertFails(put('t1', 'stu1_hw1', sub('stu1', 'hw1'))));

  const st = (uid) => { const s = env.authenticatedContext(uid).storage(); s.setMaxUploadRetryTime(1500); return s; };
  const up = (uid, path, mime = 'image/jpeg', bytes = new Uint8Array([1, 2, 3])) => uploadBytes(ref(st(uid), path), bytes, { contentType: mime });
  const file = `${S}/homework/hw1/stu1/1700000000000_page1.jpg`;
  await check('guardian uploads a photo', assertSucceeds(up('p1', file)));
  await check('guardian uploads a PDF', assertSucceeds(up('p1', `${S}/homework/hw1/stu1/1700000000001_work.pdf`, 'application/pdf')));
  await check('other files types are refused', assertFails(up('p1', `${S}/homework/hw1/stu1/1700000000002_x.html`, 'text/html')));
  await check('another parent cannot upload into this child\'s folder', assertFails(up('p2', `${S}/homework/hw1/stu1/1700000000003_y.jpg`)));
  await check('files above 15 MB are refused', assertFails(up('p1', `${S}/homework/hw1/stu1/1700000000004_big.jpg`, 'image/jpeg', new Uint8Array(15 * 1024 * 1024 + 1))));
  await check('the homework\'s teacher reads the hand-in', assertSucceeds(getBytes(ref(st('t1'), file))));
  await check('another teacher cannot read it', assertFails(getBytes(ref(st('t2'), file))));
  await check('another parent cannot read it', assertFails(getBytes(ref(st('p2'), file))));
  assert.equal(checks, 20);
  console.log(`${checks} homework hand-in checks passed`);
} finally {
  await env.cleanup();
}
