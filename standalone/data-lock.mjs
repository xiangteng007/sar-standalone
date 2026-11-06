import {openSync,closeSync,fstatSync,lstatSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
export function acquireDataLock(root){
 if(existsSync(join(root,'.recovery-incomplete')))throw Error('RECOVERY_INCOMPLETE');
 const path=join(root,'.sar-lock');let fd;
 try{fd=openSync(path,'wx',0o600)}catch{throw Error('DATA_LOCK_UNAVAILABLE')}
 const identity=fstatSync(fd);let released=false;
 return ()=>{if(released)return;released=true;try{const current=lstatSync(path);closeSync(fd);fd=undefined;if(current.dev===identity.dev&&current.ino===identity.ino)unlinkSync(path)}finally{if(fd!==undefined)closeSync(fd)}};
}
