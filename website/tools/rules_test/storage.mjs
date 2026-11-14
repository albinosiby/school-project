import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
setLogLevel('silent');
const env=await initializeTestEnvironment({projectId:'demo-dashboard-storage',firestore:{host:'127.0.0.1',port:8874,rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')},storage:{host:'127.0.0.1',port:9198,rules:readFileSync(new URL('../../storage.rules',import.meta.url),'utf8')}});
let checks=0;
const check=async(name,promise)=>{await promise;checks++;console.log(`ok ${name}`)};
try{
 await env.withSecurityRulesDisabled(async ctx=>{for(const [id,data] of Object.entries({admin:{role:'admin',schoolId:'S1'},teacher:{role:'teacher',schoolId:'S1',staffId:'t1'},other:{role:'admin',schoolId:'S2'}})) await setDoc(doc(ctx.firestore(),`users/${id}`),data)});
 const path='schools/S1/calendar-documents/00000000-0000-4000-8000-000000000001';
 const upload=(uid,p=path,mime='application/pdf',bytes=new Uint8Array([1,2,3]))=>{ const storage=uid?env.authenticatedContext(uid).storage():env.unauthenticatedContext().storage();storage.setMaxUploadRetryTime(1500);return uploadBytes(ref(storage,p),bytes,{contentType:mime});};
 await check('school administrator can upload a PDF circular',assertSucceeds(upload('admin')));
 await check('teacher cannot upload school circulars',assertFails(upload('teacher')));
 await check('another school cannot upload the circular',assertFails(upload('other')));
 await check('anonymous upload denied',assertFails(upload(null)));
 await check('executable or HTML files denied',assertFails(upload('admin',path.replace(/1$/,'2'),'text/html')));
 await check('zero-size files denied',assertFails(upload('admin',path.replace(/1$/,'3'),'application/pdf',new Uint8Array())));
 await check('files above the size limit denied',assertFails(upload('admin',path.replace(/1$/,'4'),'application/pdf',new Uint8Array(15*1024*1024+1))));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'users/admin'),{role:'admin',schoolId:'S1',mfaVersion:'v1'})});
 await check('password-only administrator cannot upload after MFA enrollment',assertFails(upload('admin',path.replace(/1$/,'5'))));
 const verified=env.authenticatedContext('admin',{firebase:{sign_in_provider:'custom'},adminMfaVersion:'v1',adminMfaAt:Math.floor(Date.now()/1000)}).storage();verified.setMaxUploadRetryTime(1500);
 await check('verified passkey session can upload the circular',assertSucceeds(uploadBytes(ref(verified,path.replace(/1$/,'6')),new Uint8Array([1]),{contentType:'application/pdf'})));
 assert.equal(checks,9);console.log(`${checks} Storage authorization checks passed`);
}finally{await env.cleanup()}
