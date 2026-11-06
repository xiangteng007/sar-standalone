// Offline maintenance of trusted local backups. Never reads deployment credentials.
import {mkdirSync,readdirSync,lstatSync,existsSync,readFileSync,writeFileSync,copyFileSync,chmodSync,mkdtempSync,rmSync,unlinkSync,constants,createReadStream} from 'node:fs';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {acquireDataLock} from './data-lock.mjs';
const fail=code=>{throw Error(code)};
function safePath(input){const p=resolve(input);for(let q=p;;q=dirname(q)){if(existsSync(q)&&lstatSync(q).isSymbolicLink())fail('SYMLINK_REJECTED');if(dirname(q)===q)break;}return p;}
function disjoint(a,b){const within=(x,y)=>{const r=relative(x,y);return r===''||(!r.startsWith('..')&&!isAbsolute(r))};if(within(a,b)||within(b,a))fail('PATH_OVERLAP');}
function regular(p){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)fail('UNSAFE_FILE');return s;}
async function digest(p){regular(p);const h=createHash('sha256');for await(const c of createReadStream(p))h.update(c);return h.digest('hex');}
async function inventory(root,ignoreLock=false){
 const files=[];
 for(const name of readdirSync(root).sort()){
  if(ignoreLock&&name==='.sar-lock')continue;
  const p=join(root,name),s=lstatSync(p);
  if(name==='media'&&s.isDirectory()&&!s.isSymbolicLink()){
   for(const n of readdirSync(p).sort()){if(!/^[a-f0-9-]{36}$/.test(n))fail('UNEXPECTED_MEDIA');files.push('media/'+n);}
  }else if(/^sar\.sqlite(?:-wal|-shm)?$/.test(name)&&s.isFile())files.push(name);
  else fail('UNEXPECTED_DATA_FILE');
 }
 if(!files.includes('sar.sqlite')||files.length>100000)fail('DATA_INVENTORY_INVALID');
 const result=[];for(const name of files.sort()){const p=join(root,name),s=regular(p);result.push({name,size:s.size,sha256:await digest(p)});}return result;
}
function copyInventory(source,dest,items){mkdirSync(join(dest,'media'),{mode:0o700});for(const item of items){const from=join(source,item.name),to=join(dest,item.name);regular(from);copyFileSync(from,to,constants.COPYFILE_EXCL);chmodSync(to,0o600);}}
function inspect(root,clearSessions=false){
 const db=new DatabaseSync(join(root,'sar.sqlite'),{readOnly:!clearSessions});
 try{
  db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)fail('DATABASE_INVALID');
  db.prepare('SELECT id,owner,status FROM pilot_cases LIMIT 0').all();
  db.prepare('SELECT hash,subject,expires FROM sar_sessions LIMIT 0').all();
  for(const r of db.prepare('SELECT photo_key FROM pilot_reports WHERE photo_key IS NOT NULL').all()){
   if(!/^pilot\/[a-f0-9-]{36}$/.test(r.photo_key))fail('PHOTO_KEY_INVALID');
   if(regular(join(root,'media',r.photo_key.slice(6))).size===0)fail('PHOTO_MISSING');
  }
  if(clearSessions){db.exec('DELETE FROM sar_sessions');if(db.prepare('SELECT count(*) n FROM sar_sessions').get().n!==0)fail('SESSION_CLEAR_FAILED');}
 }finally{db.close();}
}
async function readBackup(input){
 const root=safePath(input);if(!lstatSync(root).isDirectory())fail('BACKUP_INVALID');
 const names=readdirSync(root).sort();if(JSON.stringify(names)!==JSON.stringify(['manifest.json','payload']))fail('BACKUP_INCOMPLETE');
 const payload=join(root,'payload');if(lstatSync(payload).isSymbolicLink()||!lstatSync(payload).isDirectory())fail('UNSAFE_BACKUP');
 const m=join(root,'manifest.json');if(regular(m).size>16000000)fail('MANIFEST_TOO_LARGE');
 const manifest=JSON.parse(readFileSync(m,'utf8'));
 if(manifest.format!=='sar-offline-v1'||!Array.isArray(manifest.files))fail('MANIFEST_INVALID');
 const actual=await inventory(payload);
 if(JSON.stringify(actual)!==JSON.stringify(manifest.files))fail('BACKUP_HASH_MISMATCH');
 return {root,payload,files:actual};
}
export async function backupData(source,target){
 const from=safePath(source),to=safePath(target);disjoint(from,to);
 if(!lstatSync(from).isDirectory()||existsSync(to))fail('DESTINATION_OR_SOURCE_INVALID');
 const release=acquireDataLock(from);
 try{
  const before=await inventory(from,true);
  mkdirSync(to,{mode:0o700});writeFileSync(join(to,'.recovery-incomplete'),'incomplete',{flag:'wx',mode:0o600});
  const payload=join(to,'payload');mkdirSync(payload,{mode:0o700});copyInventory(from,payload,before);
  if(JSON.stringify(await inventory(payload))!==JSON.stringify(before)||JSON.stringify(await inventory(from,true))!==JSON.stringify(before))fail('SOURCE_CHANGED');
  // Inspection is on our owned copy, never on source or a sealed backup.
  inspect(payload);
  const files=await inventory(payload);
  writeFileSync(join(to,'manifest.json'),JSON.stringify({format:'sar-offline-v1',files},null,2),{flag:'wx',mode:0o600});
  unlinkSync(join(to,'.recovery-incomplete'));
  return {files:files.length};
 }finally{release();}
}
export async function verifyBackup(source){
 const backup=await readBackup(source),probe=mkdtempSync(join(tmpdir(),'sar-verify-'));chmodSync(probe,0o700);
 try{copyInventory(backup.payload,probe,backup.files);if(JSON.stringify(await inventory(probe))!==JSON.stringify(backup.files))fail('VERIFY_COPY_MISMATCH');inspect(probe);return {files:backup.files.length};}
 finally{rmSync(probe,{recursive:true,force:true});}
}
export async function restoreBackup(source,target){
 const backup=await readBackup(source),to=safePath(target);disjoint(backup.root,to);
 if(existsSync(to))fail('DESTINATION_EXISTS');
 mkdirSync(to,{mode:0o700});
 const release=acquireDataLock(to);
 try{
  writeFileSync(join(to,'.recovery-incomplete'),'incomplete',{flag:'wx',mode:0o600});
  copyInventory(backup.payload,to,backup.files);
  // Exclude only our maintenance markers while checking the copied inventory.
  for(const f of backup.files){const p=join(to,f.name);if(regular(p).size!==f.size||await digest(p)!==f.sha256)fail('RESTORE_HASH_MISMATCH');}
  inspect(to,true); // Old cookies must not become valid again after rollback.
  unlinkSync(join(to,'.recovery-incomplete'));return {files:backup.files.length,sessionsCleared:true};
 }finally{release();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [command,source,target,confirm,...extra]=process.argv.slice(2);
 try{
  let result;
  if(command==='verify'&&source&&!target)result=await verifyBackup(source);
  else if(['backup','restore'].includes(command)&&source&&target&&confirm==='--stopped'&&!extra.length)result=await (command==='backup'?backupData:restoreBackup)(source,target);
  else fail('USAGE');
  console.log(JSON.stringify({status:'ok',operation:command,...result}));
 }catch{console.error('SAR recovery failed; verify arguments, stopped service, lock, inventory and destination. No existing destination is overwritten.');process.exitCode=1;}
}
