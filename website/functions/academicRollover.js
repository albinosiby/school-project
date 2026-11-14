const { createHash, randomUUID } = require("node:crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const { requireAdminSession, verifiedAdminSession } = require("./adminSession");
const ARCHIVE = ["students", "classes", "assignments", "ops_periods", "ops_attendance", "exm_cycles", "exm_papers", "exm_marks", "staff_attendance", "staff_leaves", "set_terms", "set_exceptions", "fee_invoices", "fee_payments"];
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function yearAfter(year) { const match = /^(20\d{2})-(\d{2})$/.exec(year || ""); if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) throw new HttpsError("failed-precondition", "Set a valid academic year before rollover."); return `${Number(match[1])+1}-${String(Number(match[1])+2).slice(-2)}`; }
function buildPlan(students, classes, fromYear, params) {
  const toYear = yearAfter(fromYear), sectionPolicy = params?.sectionPolicy, targets = params?.grade10Targets || {};
  if (!["preserve", "unassigned"].includes(sectionPolicy) || typeof targets !== "object" || Array.isArray(targets) || JSON.stringify(targets).length > 250000) throw new HttpsError("invalid-argument", "Choose how sections will be assigned next year.");
  const moves = [], issues = [], byId = new Map(classes.map((c) => [c.id, c]));
  for (const student of students.filter((s) => !s.deleted && (!s.status || s.status === "Active"))) {
    const grade = String(student.grade || ""), section = student.section || byId.get(student.classId)?.section || "";
    const nextGrade = grade === "LKG" ? "UKG" : grade === "UKG" ? "1" : /^([1-9]|1[01])$/.test(grade) ? String(Number(grade) + 1) : grade === "12" ? "12" : "";
    if (!nextGrade) { issues.push({ studentId: student.id, name: student.name || student.id, message: "Choose a valid current grade." }); continue; }
    const graduated = grade === "12";
    let target;
    if (!graduated && grade === "10") {
      target = byId.get(targets[student.id]);
      if (!target || String(target.grade) !== "11" || !target.streamId) { issues.push({ studentId: student.id, name: student.name || student.id, message: "Select a Grade 11 course and class." }); continue; }
    } else if (!graduated && sectionPolicy === "preserve") {
      const stream = student.streamId || byId.get(student.classId)?.streamId || "";
      const candidates = classes.filter((c) => String(c.grade) === nextGrade && c.section === section && (nextGrade !== "12" || (c.streamId || "") === stream));
      if (candidates.length !== 1) { issues.push({ studentId: student.id, name: student.name || student.id, message: `Configure a unique ${nextGrade}${section ? `-${section}` : ""} class, or leave sections unassigned.` }); continue; }
      target = candidates[0];
    }
    const streamId = target?.streamId || (nextGrade === "12" && !graduated ? student.streamId || byId.get(student.classId)?.streamId || "" : "");
    if (!graduated && nextGrade === "12" && !streamId) { issues.push({studentId:student.id,name:student.name || student.id,message:"Select the student's senior course before promotion."}); continue; }
    moves.push({ studentId: student.id, name: student.name || student.id, fromGrade: grade, toGrade: nextGrade, graduated,
      classId: graduated || sectionPolicy === "unassigned" ? "" : target.id, section: graduated || sectionPolicy === "unassigned" ? "" : target.section,
      streamId: graduated ? "" : streamId, stream: graduated ? "" : target?.stream || student.stream || "" });
  }
  const planHash = hash([fromYear,params,students,classes]);
  return { fromYear, toYear, sectionPolicy, planHash, moves, issues, promoted: moves.filter((m) => !m.graduated).length, graduated: moves.filter((m) => m.graduated).length };
}
async function sources(reader, school) {
  const get = (ref) => typeof reader.get === "function" ? reader.get(ref) : ref.get();
  const [schoolDoc, meta, students, classes, exceptions] = await Promise.all([
    get(school.collection("school").doc("school")), get(school.collection("set_config").doc("meta")),
    get(school.collection("students").select("name","grade","section","classId","streamId","stream","status","deleted","academicYear")),
    get(school.collection("classes").select("grade","section","streamId","stream")), get(school.collection("set_exceptions").select("text","kind","resolved")),
  ]);
  return { exceptions: exceptions.docs.map(d=>({id:d.id,...d.data()})), fromYear: schoolDoc.get("academicYear") || meta.get("academicYear"), students: students.docs.map((d)=>({id:d.id,...d.data()})), classes: classes.docs.map((d)=>({id:d.id,...d.data()})) };
}
function review(data, params) {
  const plan=buildPlan(data.students,data.classes,data.fromYear,params);
  plan.issues.push(...data.exceptions.filter(x=>!x.resolved).map(x=>({studentId:`exception:${x.id}`,name:x.kind || "School exception",message:x.text || "Resolve this school exception before rollover."})));
  plan.planHash=hash([plan.planHash,data.exceptions]);
  return plan;
}
function createRollover({ db }) {
  async function call(req) {
    await requireAdminSession(req, undefined, true);
    const uid = req.auth.uid, actor = await db.doc(`users/${uid}`).get(), sid = actor.get("schoolId");
    if (actor.get("role") !== "admin" || !sid) throw new HttpsError("permission-denied", "Only a school administrator can roll over an academic year.");
    const school = db.collection("schools").doc(sid), platform = db.doc(`platform_schools/${sid}`), input = req.data || {};
    if ((await platform.get()).get("status") === "suspended") throw new HttpsError("permission-denied", "This school is suspended.");
    const params = { sectionPolicy: input.sectionPolicy, grade10Targets: input.grade10Targets || {} };
    if (input.action === "preview") { const data = await sources(db, school); return review(data,params); }
    if (!["execute","resume"].includes(input.action)) throw new HttpsError("invalid-argument", "Choose preview or execute.");
    if (input.confirm !== "ROLLOVER" || input.signed !== true) throw new HttpsError("failed-precondition", "Review the promotion plan and confirm ROLLOVER.");
    const year = input.fromYear; yearAfter(year);
    const jobRef = school.collection("academic_rollovers").doc(year), now = new Date().toISOString();
    return db.runTransaction(async tx => {
      const [currentActor, state, prior] = await tx.getAll(actor.ref,platform,jobRef);
      if (!verifiedAdminSession(req.auth, currentActor.data()) || state.get("status") === "suspended" || currentActor.get("role") !== "admin" || currentActor.get("schoolId") !== sid) throw new HttpsError("permission-denied", "Your account no longer manages this school.");
      if (prior.exists) {
        if (prior.get("status") === "Failed" && input.action === "resume") { if (state.get("rolloverJob") !== year) throw new HttpsError("failed-precondition", "The rollover lock changed. Contact support before resuming this job."); tx.update(jobRef,{status:"Running",error:"",leaseUntil:0,updatedAt:now}); return {id:jobRef.id,status:"Running"}; }
        if (["Running","Completed"].includes(prior.get("status"))) return {id:jobRef.id,status:prior.get("status")};
        throw new HttpsError("failed-precondition", "Review the existing rollover before starting another.");
      }
      if (state.get("rolloverJob")) throw new HttpsError("failed-precondition", "Another academic rollover is in progress.");
      const data = await sources(tx,school), plan = review(data,params);
      if (plan.fromYear !== year || plan.planHash !== input.planHash || plan.issues.length) throw new HttpsError("failed-precondition", "The roster or configuration changed. Review the promotion plan again.");
      tx.create(jobRef,{fromYear:year,toYear:plan.toYear,params,status:"Running",phase:"Archive",archiveIndex:0,cursor:"",processed:0,total:plan.moves.length,promoted:plan.promoted,graduated:plan.graduated,createdAt:now,updatedAt:now,actor:uid,leaseUntil:0});
      tx.set(platform,{rolloverJob:year},{merge:true});
      tx.create(school.collection("set_audit").doc(),{at:now,actor:uid,action:"Started academic rollover",detail:`${year} → ${plan.toYear}; ${plan.promoted} promotions; ${plan.graduated} graduates`,kind:"academic"});
      return {id:jobRef.id,status:"Running"};
    });
  }
  async function step(jobRef, lease) {
    const school = jobRef.parent.parent, platform = db.doc(`platform_schools/${school.id}`);
    return db.runTransaction(async tx => {
      const [jobDoc,platformDoc] = await tx.getAll(jobRef,platform), job = jobDoc.data();
      if (job?.status !== "Running" || job.lease !== lease) return false;
      if (platformDoc.get("status") === "suspended") throw new Error("The school was suspended during rollover.");
      const archive = school.collection("academic_archives").doc(job.fromYear), now = new Date().toISOString();
      if (job.phase === "Archive") {
        const collection = ARCHIVE[job.archiveIndex];
        if (!collection) { tx.update(jobRef,{phase:"Promote",cursor:"",updatedAt:now}); return true; }
        let query = school.collection(collection).orderBy("__name__").limit(100);
        if (job.cursor) query=query.startAfter(job.cursor);
        const page = await tx.get(query);
        for (const record of page.docs) tx.create(archive.collection(collection).doc(record.id),{...record.data(),_archivedAt:now,_sourceUpdateTime:record.updateTime.toDate().toISOString()});
        tx.set(archive,{fromYear:job.fromYear,toYear:job.toYear,status:"Archiving",createdAt:job.createdAt,actor:job.actor},{merge:true});
        tx.update(jobRef,{archiveIndex:page.size < 100 ? job.archiveIndex+1:job.archiveIndex,cursor:page.size < 100 ? "":page.docs.at(-1).id,updatedAt:now,leaseUntil:Date.now()+480000});
        return true;
      }
      if (job.phase === "Promote") {
        let query=archive.collection("students").orderBy("__name__").limit(100);if(job.cursor)query=query.startAfter(job.cursor);
        const [page,classes] = await Promise.all([tx.get(query),tx.get(archive.collection("classes"))]);
        const plan=buildPlan(page.docs.map(d=>({id:d.id,...d.data()})),classes.docs.map(d=>({id:d.id,...d.data()})),job.fromYear,job.params);
        if(plan.issues.length)throw new Error("An archived student no longer has a valid promotion target.");
        for(const move of plan.moves) tx.update(school.collection("students").doc(move.studentId),{grade:move.toGrade,classId:move.classId,section:move.section,streamId:move.streamId,stream:move.stream,roll:"",rollAcademicYear:"",academicYear:job.toYear,rolloverId:job.fromYear,...(move.graduated?{status:"Graduated",graduatedAcademicYear:job.fromYear}:{}),updatedAt:now,updatedBy:job.actor});
        tx.update(jobRef,{processed:job.processed+plan.moves.length,cursor:page.size<100?"":page.docs.at(-1).id,phase:page.size<100?"Finalize":"Promote",updatedAt:now,leaseUntil:Date.now()+480000});
        return true;
      }
      if(job.phase === "Finalize") {
        const terms=await tx.get(school.collection("set_terms"));
        if(terms.size>350)throw new Error("Too many academic terms to finalize safely.");
        for(const term of terms.docs)tx.update(term.ref,{status:"Closed",updatedAt:now,updatedBy:job.actor});
        tx.set(school.collection("school").doc("school"),{academicYear:job.toYear,term:"",updatedAt:now,updatedBy:job.actor},{merge:true});
        tx.set(school.collection("set_config").doc("meta"),{academicYear:job.toYear,rolledOver:false,rolloverStep:1,lastRolloverId:job.fromYear,updatedAt:now,updatedBy:job.actor},{merge:true});
        tx.update(archive,{status:"Completed",completedAt:now});
        tx.update(jobRef,{status:"Completed",phase:"Completed",completedAt:now,updatedAt:now,leaseUntil:0});
        tx.update(platform,{rolloverJob:FieldValue.delete()});
        tx.create(school.collection("set_audit").doc(),{at:now,actor:job.actor,action:"Completed academic rollover",detail:`${job.fromYear} → ${job.toYear}; ${job.processed} student records processed; financial ledger retained`,kind:"academic"});
        return false;
      }
      throw new Error("Unknown academic rollover phase.");
    });
  }
  async function run(jobRef) {
    const lease=randomUUID();
    const start=await db.runTransaction(async tx=>{const job=await tx.get(jobRef);if(job.get("status")!=="Running" || job.get("leaseUntil")>Date.now())return false;tx.update(jobRef,{lease,leaseUntil:Date.now()+480000});return true;});
    if(!start)return;
    try { const deadline=Date.now()+420000;while(await step(jobRef,lease)){if(Date.now()>deadline){await jobRef.update({leaseUntil:0});throw Object.assign(new Error("Continue rollover on the next worker attempt."),{resumable:true});}} }
    catch(error){if(error.resumable)throw error;logger.error("Academic rollover paused for recovery",{job:jobRef.path,error:error.message});await jobRef.update({status:"Failed",error:"Rollover paused. The source-year archive is retained. Resume the job after checking the server logs.",leaseUntil:0,updatedAt:new Date().toISOString()});}
  }
  return {call,step,run};
}
exports.buildPlan=buildPlan;exports.createRollover=createRollover;
exports.manageAcademicRollover=onCall({timeoutSeconds:120,memory:"512MiB"},async req=>createRollover({db:getFirestore()}).call(req));
exports.onAcademicRolloverStarted=onDocumentWritten({document:"schools/{sid}/academic_rollovers/{year}",timeoutSeconds:540,memory:"512MiB",retry:true},async event=>{const before=event.data?.before?.data(),after=event.data?.after?.data();if(after?.status!=="Running" || before?.status==="Running")return;await createRollover({db:getFirestore()}).run(event.data.after.ref);});
