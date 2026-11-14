const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createRequire}=require('node:module');
const {test,after}=require('node:test');
const r=createRequire(require.resolve('../../functions/academicRollover'));
const {initializeApp,deleteApp}=r('firebase-admin/app'),{getFirestore}=r('firebase-admin/firestore');
assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-')&&process.env.FIRESTORE_EMULATOR_HOST,'Use an isolated emulator.');
const app=initializeApp({projectId:process.env.GCLOUD_PROJECT}),db=getFirestore();
const {createRollover,buildPlan}=require('../../functions/academicRollover'),{requireAdminSession}=require('../../functions/adminSession');
const sid=`rollover_${randomUUID()}`,uid=`admin_${randomUUID()}`,school=db.doc(`schools/${sid}`),service=createRollover({db}),auth={uid,token:{}},params={sectionPolicy:'preserve',grade10Targets:{g10:'cls_11_science_A'}};
const call=(action,data={})=>service.call({auth,data:{action,...params,...data}});
after(async()=>{await db.terminate();await deleteApp(app)});
test('resumable academic rollover',async t=>{
 await db.doc(`users/${uid}`).set({schoolId:sid,role:'admin'});
 await school.collection('school').doc('school').set({academicYear:'2026-27',term:'Term 2'});
 const classes=[{id:'cls_UKGA',grade:'UKG',section:'A'},{id:'cls_1A',grade:'1',section:'A'},{id:'cls_2A',grade:'2',section:'A'},{id:'cls_11_science_A',grade:'11',section:'A',streamId:'science',stream:'Science'},{id:'cls_12_science_A',grade:'12',section:'A',streamId:'science',stream:'Science'}];
 let batch=db.batch();for(const c of classes)batch.set(school.collection('classes').doc(c.id),c);
 for(let i=0;i<105;i++)batch.set(school.collection('students').doc(`student_${String(i).padStart(3,'0')}`),{name:`Synthetic ${i}`,grade:'1',section:'A',classId:'cls_1A',status:'Active',roll:i+1,academicYear:'2026-27'});
 for(const [id,grade]of[['lkg','LKG'],['g10','10'],['g11','11'],['g12','12']])batch.set(school.collection('students').doc(id),{name:id,grade,section:'A',status:'Active',streamId:'science',classId:grade==='11'?'cls_11_science_A':'',roll:1});
 batch.set(school.collection('students').doc('inactive'),{name:'Inactive',grade:'1',status:'Transferred'});
 batch.set(school.collection('fee_invoices').doc('invoice'),{amount:100,paid:20,balance:80});
 batch.set(school.collection('ops_attendance').doc('historical'),{date:'2026-11-11',classId:'cls_1A',marks:{student_000:'P'}});
 batch.set(school.collection('set_terms').doc('term2'),{name:'Term 2',status:'In Progress'});await batch.commit();
 let plan,request;
 await t.test('Grade 10 needs a senior course; preview changes no student data',async()=>{
  const missing=await call('preview',{grade10Targets:{}});assert.equal(missing.issues.length,1);
  assert.equal((await school.collection('students').doc('student_000').get()).get('grade'),'1');
  const unassigned=buildPlan([{id:'s',name:'S',grade:'2',section:'A'}],[],'2026-27',{sectionPolicy:'unassigned'});assert.equal(unassigned.moves[0].classId,'');assert.equal(unassigned.moves[0].toGrade,'3');
 });
 await t.test('stale previews cannot start the worker',async()=>{
  const stale=await call('preview');await school.collection('students').doc('student_000').update({name:'Changed after review'});
  await assert.rejects(call('execute',{fromYear:stale.fromYear,planHash:stale.planHash,signed:true,confirm:'ROLLOVER'}),e=>e.code==='failed-precondition');
  assert.equal((await db.doc(`platform_schools/${sid}`).get()).get('rolloverJob'),undefined);
 });
 await t.test('execution is idempotent and locks other administrative changes',async()=>{
  plan=await call('preview');assert.equal(plan.issues.length,0);assert.equal(plan.promoted,108);assert.equal(plan.graduated,1);
  request={fromYear:plan.fromYear,planHash:plan.planHash,signed:true,confirm:'ROLLOVER'};
  const results=await Promise.all([call('execute',request),call('execute',request)]);assert.equal(results[0].id,results[1].id);
  await assert.rejects(requireAdminSession({auth}),e=>e.code==='failed-precondition');
 });
 await t.test('the worker archives before promotion and resumes its exact cursor',async()=>{
  const job=school.collection('academic_rollovers').doc('2026-27');
  await job.update({lease:'synthetic-worker',leaseUntil:0});
  await service.step(job,'synthetic-worker');
  assert.equal((await school.collection('academic_archives').doc('2026-27').collection('students').get()).size,100);
  assert.equal((await school.collection('students').doc('student_000').get()).get('grade'),'1');
  await job.update({leaseUntil:0}); // Simulate the first worker exiting after a committed chunk.
  await service.run(job);
  assert.equal((await job.get()).get('status'),'Completed');
  assert.equal((await job.get()).get('processed'),109);
 });
 await t.test('promotion, graduation, roll reset and financial/history preservation are correct',async()=>{
  const promoted=await school.collection('students').doc('student_000').get();assert.equal(promoted.get('grade'),'2');assert.equal(promoted.get('classId'),'cls_2A');assert.equal(promoted.get('roll'),'');
  assert.equal((await school.collection('students').doc('lkg').get()).get('grade'),'UKG');
  assert.equal((await school.collection('students').doc('g10').get()).get('classId'),'cls_11_science_A');
  assert.equal((await school.collection('students').doc('g11').get()).get('classId'),'cls_12_science_A');
  assert.equal((await school.collection('students').doc('g12').get()).get('status'),'Graduated');
  assert.equal((await school.collection('students').doc('inactive').get()).get('grade'),'1');
  const archive=school.collection('academic_archives').doc('2026-27');assert.equal((await archive.collection('students').doc('student_000').get()).get('grade'),'1');
  assert.equal((await archive.collection('ops_attendance').doc('historical').get()).get('classId'),'cls_1A');
  assert.equal((await school.collection('fee_invoices').doc('invoice').get()).get('balance'),80);
  assert.equal((await archive.collection('fee_invoices').doc('invoice').get()).get('paid'),20);
  assert.equal((await school.collection('school').doc('school').get()).get('academicYear'),'2027-28');
  assert.equal((await db.doc(`platform_schools/${sid}`).get()).get('rolloverJob'),undefined);
  await requireAdminSession({auth});
 });
 await t.test('replaying a completed request cannot promote a student twice',async()=>{
  assert.equal((await call('execute',request)).status,'Completed');
  assert.equal((await school.collection('students').doc('student_000').get()).get('grade'),'2');
 });
});
