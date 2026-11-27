// Class resources: teachers keep them in cl_resources; parents read only those marked for parents in their child's class.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, query, where, setLogLevel } from 'firebase/firestore';
setLogLevel('silent');
const [h, p] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: process.env.EMULATOR_PROJECT ?? 'demo-class-resources',
  firestore: { host: h, port: Number(p), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let checks = 0;
const check = async (name, pr) => { await pr; checks++; console.log(`ok ${name}`); };
const S = 'schools/S1';
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries({
      'users/p1': { role: 'parent', schoolId: 'S1', studentIds: ['stu1'], classIds: ['cls_5B'] },
      'users/t1': { role: 'teacher', schoolId: 'S1', staffId: 'stf1' },
      'users/t2': { role: 'teacher', schoolId: 'S1', staffId: 'stf2' },
      'platform_schools/S1': { status: 'active' },
      [`${S}/cl_resources/r1`]: { teacherId: 'stf1', classId: 'cls_5B', title: 'Fractions video', kind: 'youtube', visibility: 'parents' },
      [`${S}/cl_resources/r2`]: { teacherId: 'stf1', classId: 'cls_5B', title: 'My notes', kind: 'file', visibility: 'private' },
      [`${S}/cl_resources/r3`]: { teacherId: 'stf1', classId: 'cls_6A', title: 'Other class', kind: 'link', visibility: 'parents' },
    })) await setDoc(doc(db, path), data);
  });
  const fs = (uid) => env.authenticatedContext(uid).firestore();
  await check('parent reads a resource shared with their child\'s class', assertSucceeds(getDoc(doc(fs('p1'), `${S}/cl_resources/r1`))));
  await check('parent cannot read a private resource', assertFails(getDoc(doc(fs('p1'), `${S}/cl_resources/r2`))));
  await check('parent cannot read another class\'s resource', assertFails(getDoc(doc(fs('p1'), `${S}/cl_resources/r3`))));
  await check('the parent app query (class + parents) is allowed',
    assertSucceeds(getDocs(query(collection(fs('p1'), `${S}/cl_resources`), where('classId', '==', 'cls_5B'), where('visibility', '==', 'parents')))));
  await check('an unfiltered parent query is refused', assertFails(getDocs(collection(fs('p1'), `${S}/cl_resources`))));
  await check('parent cannot write resources', assertFails(setDoc(doc(fs('p1'), `${S}/cl_resources/r9`), { classId: 'cls_5B', visibility: 'parents' })));
  await check('the owning teacher shares a new resource', assertSucceeds(setDoc(doc(fs('t1'), `${S}/cl_resources/r4`), { teacherId: 'stf1', classId: 'cls_5B', title: 'Worksheet', kind: 'file', visibility: 'parents' })));
  await check('another teacher cannot read a private resource', assertFails(getDoc(doc(fs('t2'), `${S}/cl_resources/r2`))));
  assert.equal(checks, 8);
  console.log(`${checks} class resource checks passed`);
} finally { await env.cleanup(); }
