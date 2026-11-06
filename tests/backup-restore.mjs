// Synthetic offline disaster-recovery drill. No existing data or credentials read.
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openStorage} from '../outputs/standalone/storage.mjs';
import {createRuntime} from '../outputs/standalone/runtime.mjs';

const root=mkdtempSync(join(tmpdir(),'sar-restore-'));
const live=join(root,'live'),backup=join(root,'backup'),restored=join(root,'restored');
const origin='http://127.0.0.1:8787',checks=[],claims=new Map();
const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
const sha=b=>createHash('sha256').update(b).digest('hex');
let storage=openStorage(live),runtime;
const boot=()=>{runtime=createRuntime({storage,origin,clientId:'synthetic.apps.googleusercontent.com',allowedSubjects:['synthetic-A','synthetic-B'],verifyCredential:async c=>{if(!claims.has(c))throw Error('invalid fixture');return claims.get(c)},staticDirectory:resolve('outputs/standalone/public')})};
boot();
const call=(path,cookie='',body)=>runtime.handle(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,...(body===undefined||body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}));
async function login(subject){const r=await call('/auth/google');const c=r.headers.get('set-cookie').split(';')[0];const js=await(await call('/auth/login.js',c)).text();const nonce=js.match(/nonce:"([a-f0-9]+)"/)[1];const token=randomUUID();claims.set(token,{subject,nonce});const s=await call('/auth/session',c,{credential:token});assert.equal(s.status,200);return s.headers.get('set-cookie').split(';')[0]}
const manifest=dir=>Object.fromEntries(readdirSync(dir,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const p=join(e.parentPath,e.name);return [p.slice(dir.length+1).replaceAll('\\','/'),sha(readFileSync(p))]}).sort(([a],[b])=>a.localeCompare(b)));
function verify(dir,expected){assert.deepEqual(manifest(dir),expected,'backup file inventory/hash mismatch');const probe=mkdtempSync(join(root,'verify-'));cpSync(dir,probe,{recursive:true});const db=new DatabaseSync(join(probe,'sar.sqlite'),{readOnly:true});try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);for(const r of db.prepare('SELECT photo_key FROM pilot_reports WHERE photo_key IS NOT NULL').all()){assert.match(r.photo_key,/^pilot\/[a-f0-9-]{36}$/);assert.ok(readFileSync(join(dir,'media',r.photo_key.slice(6))).length>0)}}finally{db.close();rmSync(probe,{recursive:true,force:true})}}
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS '+name)}
let a,b,cases=[],reports=[],before,expected;
try{
 await check('seed two cases and pending/approved/rejected reports with actual disk photos',async()=>{
  a=await login('synthetic-A');b=await login('synthetic-B');
  for(let i=0;i<2;i++){const r=await call('/api/pilot',a,{action:'create_case',mode:'animal',title:'SYNTHETIC RESTORE '+i});assert.equal(r.status,201);cases.push((await r.json()).id)}
  for(const [index,state]of ['pending','approved','rejected'].entries()){
   const payload={id:randomUUID(),caseId:cases[index===2?1:0],kind:'coverage',observedAt:'2026-11-05T00:00:00Z',endedAt:'2026-11-05T00:10:00Z',source:'manual',locationConfirmed:true,photoPurpose:'evidence',geometry:{type:'Point',coordinates:[120.295,22.648]},notes:'SYNTHETIC ONLY',synthetic:true};
   const f=new FormData();f.set('payload',JSON.stringify(payload));f.set('photo',new File([photo],'synthetic.png',{type:'image/png'}));assert.equal((await call('/api/pilot',a,f)).status,201);reports.push(payload.id);
   if(state!=='pending')assert.equal((await call('/api/pilot',a,{action:'review',id:payload.id,decision:state})).status,200);
  }
  assert.equal((await call('/api/pilot',a,{action:'close',caseId:cases[1]})).status,200);before=await(await call('/api/pilot',a)).json();
 });
 await check('quiescent whole-directory backup matches inventory and SQLite integrity',async()=>{
  storage.close();storage=null;cpSync(live,backup,{recursive:true,errorOnExist:true,force:false});expected=manifest(live);verify(backup,expected);
 });
 await check('missing attachment is detected before opening restored service',async()=>{
  const bad=join(root,'missing');cpSync(backup,bad,{recursive:true});const file=Object.keys(expected).find(p=>p.startsWith('media/'));assert.ok(file);rmSync(join(bad,file));assert.throws(()=>verify(bad,expected),/inventory\/hash mismatch/);
 });
 await check('modified attachment and corrupt database are detected before service',async()=>{
  for(const key of [Object.keys(expected).find(p=>p.startsWith('media/')),'sar.sqlite']){const bad=join(root,'tamper-'+randomUUID());cpSync(backup,bad,{recursive:true});writeFileSync(join(bad,key),Buffer.from('corrupt fixture'));assert.throws(()=>verify(bad,expected),/inventory\/hash mismatch/)}
 });
 await check('restore to a separate directory preserves original and invalidates old sessions',async()=>{
  cpSync(backup,restored,{recursive:true,errorOnExist:true,force:false});verify(restored,expected);
  storage=openStorage(restored);assert.ok(storage.db.prepare('SELECT count(*) n FROM sar_sessions').get().n>0);
  // Mandatory recovery procedure BEFORE exposure: backup sessions may predate logout/revocation.
  storage.db.exec('DELETE FROM sar_sessions');boot();assert.equal((await call('/api/pilot',a)).status,401);assert.equal((await call('/api/pilot',b)).status,401);
  a=await login('synthetic-A');b=await login('synthetic-B');assert.deepEqual(await(await call('/api/pilot',a)).json(),before);assert.deepEqual(manifest(live),expected);
 });
 await check('restored attachments retain exact SHA256 and second owner remains isolated',async()=>{
  for(const id of reports){const r=await call('/api/pilot?photo='+id,a);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(photo));assert.equal((await call('/api/pilot?photo='+id,b)).status,404)}
  const data=await(await call('/api/pilot',b)).json();assert.equal(data.cases.length,0);assert.equal(data.reports.length,0);
 });
 await check('approval export and closed-case write restrictions survive restore',async()=>{
  const r=await call('/api/pilot?export='+cases[0],a);assert.equal(r.status,200);const data=await r.json();assert.equal(data.features.length,1);assert.equal(data.features[0].properties.report_id,reports[1]);assert.ok(!JSON.stringify(data).includes('SYNTHETIC ONLY'));
  assert.equal((await call('/api/pilot?export='+cases[1],a)).status,409);assert.equal((await call('/api/pilot',a,{action:'review',id:reports[2],decision:'approved'})).status,409);
 });
 await check('restored service restart preserves data and backup stays unmodified',async()=>{
  storage.close();storage=openStorage(restored);boot();assert.deepEqual(await(await call('/api/pilot',a)).json(),before);verify(backup,expected);
 });
 writeFileSync('verification/backup-restore.json',JSON.stringify({at:new Date().toISOString(),platform:process.platform,node:process.version,scope:'Synthetic offline whole-directory backup to a distinct restore directory; real SQLite/filesystem and Request/Response runtime. Google verification synthetic; NOT live backup, power-loss recovery, external disk/NAS, HTTPS or actual Google login.',passed:checks.length,photoSha256:sha(photo),sessionsClearedBeforeExposure:true,results:checks},null,2));
}finally{storage?.close();rmSync(root,{recursive:true,force:true})}
