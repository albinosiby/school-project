const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash, generateKeyPairSync, sign } = require('node:crypto');
const { createRequire } = require('node:module');
const { test, after } = require('node:test');
const r = createRequire(require.resolve('../../functions/adminMfa'));
const { initializeApp, deleteApp } = r('firebase-admin/app');
const { getFirestore } = r('firebase-admin/firestore');
const { encodeCBOR } = r('@levischuck/tiny-cbor');
const encode = (value) => Buffer.from(encodeCBOR(value));
assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST,'Use an isolated emulator.');
const app=initializeApp({projectId:process.env.GCLOUD_PROJECT}),db=getFirestore();
const { createAdminMfa }=require('../../functions/adminMfa');
const { verifiedAdminSession, requireAdminSession }=require('../../functions/adminSession');
const origin='http://localhost:3000',uid=`admin_${randomUUID()}`,sid=`school_${randomUUID()}`,now=Date.now(),issued=[];
const b64=(b)=>Buffer.from(b).toString('base64url'),sha=(b)=>createHash('sha256').update(b).digest();
const keyPair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=keyPair.publicKey.export({format:'jwk'}),credentialId=randomBytes(24);
const cred={id:b64(credentialId),rawId:b64(credentialId),type:'public-key',clientExtensionResults:{},authenticatorAttachment:'cross-platform'};
const baseAuth={uid,token:{auth_time:Math.floor(now/1000),firebase:{sign_in_provider:'password'}}};
const client=(type,challenge,site=origin)=>Buffer.from(JSON.stringify({type,challenge,origin:site,crossOrigin:false}));
function registration(challenge,site=origin){
 const cose=encode(new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x,'base64url')],[-3,Buffer.from(jwk.y,'base64url')]]));
 const length=Buffer.alloc(2);length.writeUInt16BE(credentialId.length);
 const authData=Buffer.concat([sha('localhost'),Buffer.from([0x45]),Buffer.alloc(4),Buffer.alloc(16),length,credentialId,cose]);
 return {...cred,response:{clientDataJSON:b64(client('webauthn.create',challenge,site)),attestationObject:b64(encode(new Map([['fmt','none'],['authData',authData],['attStmt',new Map()]]))),transports:['usb']}};
}
function assertion(challenge,counter=1){
 const count=Buffer.alloc(4);count.writeUInt32BE(counter);
 const data=Buffer.concat([sha('localhost'),Buffer.from([0x05]),count]),json=client('webauthn.get',challenge);
 return {...cred,response:{clientDataJSON:b64(json),authenticatorData:b64(data),signature:b64(sign('sha256',Buffer.concat([data,sha(json)]),keyPair.privateKey)),userHandle:b64(Buffer.from(uid))}};
}
after(async()=>{await db.terminate();await deleteApp(app)});
test('administrator WebAuthn MFA with real cryptographic responses',async t=>{
 const webauthn=await import('../../functions/node_modules/@simplewebauthn/server/esm/index.js');
 const handler=createAdminMfa({db,auth:{createCustomToken:async(id,claims)=>{issued.push({id,claims});return 'synthetic-token'}},webauthn,clock:()=>now,origins:()=>[origin]});
 const call=(action,data={},auth=baseAuth,site=origin)=>handler({auth,data:{action,...data},rawRequest:{headers:{origin:site}}});
 await db.doc(`users/${uid}`).set({schoolId:sid,role:'admin',email:'synthetic@example.test'});
 let recovery,version,session;
 await t.test('a generated challenge alone never enables MFA',async()=>{
  const begin=await call('beginRegistration');
  assert.ok(begin.options.challenge);
  assert.equal((await db.doc(`users/${uid}`).get()).get('mfaVersion'),undefined);
 });
 await t.test('a forged origin fails registration',async()=>{
  const begin=await call('beginRegistration');
  await assert.rejects(call('finishRegistration',{challengeId:begin.challengeId,response:registration(begin.options.challenge,'https://evil.example')}));
  assert.equal((await call('status')).enabled,false);
 });
 await t.test('verified hardware response enables MFA and stores only hashed recovery codes',async()=>{
  const begin=await call('beginRegistration'),result=await call('finishRegistration',{challengeId:begin.challengeId,response:registration(begin.options.challenge),label:'Synthetic security key'});
  recovery=result.recoveryCodes;assert.equal(recovery.length,8);
  version=(await db.doc(`users/${uid}`).get()).get('mfaVersion');assert.ok(version);
  session={uid,token:{...baseAuth.token,firebase:{sign_in_provider:'custom'},...issued.at(-1).claims}};
  const stored=JSON.stringify((await db.doc(`admin_security/${uid}`).get()).data());
  for(const code of recovery)assert.ok(!stored.includes(code));
  assert.equal((await call('status')).credentials.length,1);
 });
 await t.test('password-only sessions cannot access administrative services after enrollment',async()=>{
  assert.equal(verifiedAdminSession(baseAuth,{mfaVersion:version},now),false);
  await assert.rejects(requireAdminSession({auth:baseAuth}),e=>e.code==='permission-denied');
  await assert.rejects(call('beginRegistration'),e=>e.code==='permission-denied');
 });
 await t.test('valid assertions update the counter and cannot be replayed',async()=>{
  const begin=await call('beginAuthentication'),response=assertion(begin.options.challenge);
  await call('finishAuthentication',{challengeId:begin.challengeId,response});
  await assert.rejects(call('finishAuthentication',{challengeId:begin.challengeId,response}));
  assert.equal((await db.doc(`admin_security/${uid}`).collection('credentials').get()).docs[0].get('counter'),1);
  assert.equal(verifiedAdminSession(session,{mfaVersion:version},now),true);
  assert.equal(verifiedAdminSession(session,{mfaVersion:version},now+13*3600e3),false);
 });
 await t.test('one-time recovery codes cannot be used twice, including concurrently',async()=>{
  const results=await Promise.allSettled([1,2].map(()=>call('recover',{code:recovery[0]})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 });
 await t.test('an unapproved HTTP origin is rejected before generating a challenge',async()=>{
  await assert.rejects(call('beginAuthentication',{},baseAuth,'https://evil.example'),e=>e.code==='failed-precondition');
 });
 await t.test('only a verified administrator session can disable MFA',async()=>{
  await assert.rejects(call('disable'),e=>e.code==='permission-denied');
  await call('disable',{},session);
  assert.equal((await db.doc(`users/${uid}`).get()).get('mfaVersion'),undefined);
  assert.equal((await call('status')).credentials.length,0);
 });
});
