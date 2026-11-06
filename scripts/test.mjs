import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
mkdirSync('verification',{recursive:true});
for(const name of ['launcher','standalone-http','standalone-process','google-verifier','backup-restore','deployment-config','storage-failure','field-reliability','session-response']){
 const r=spawnSync(process.execPath,[`tests/${name}.mjs`],{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status||1);
}
