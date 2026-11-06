import {resolve,relative,isAbsolute,dirname,basename,join} from 'node:path';
import {existsSync,realpathSync,statSync} from 'node:fs';
const bad=code=>{throw Error(code)};
// Report only constant codes: never echo config values, subjects or filesystem errors.
function canonical(path){let p=resolve(path),tail=[];while(!existsSync(p)){tail.unshift(basename(p));const parent=dirname(p);if(parent===p)bad('DATA_PATH_INVALID');p=parent;}if(!statSync(p).isDirectory())bad('DATA_PATH_INVALID');return join(realpathSync(p),...tail)}
export function deploymentConfig(env,root){
 const origin=env.SAR_ORIGIN||'',clientId=env.SAR_GOOGLE_CLIENT_ID||'';
 let url;try{url=new URL(origin)}catch{bad('ORIGIN_INVALID')}
 if(origin!==url.origin||url.username||url.password)bad('ORIGIN_INVALID');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))bad('ORIGIN_HTTPS_REQUIRED');
 if(!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId)||/REPLACE|EXAMPLE|YOUR_/i.test(clientId))bad('GOOGLE_CLIENT_INVALID');
 const raw=env.SAR_GOOGLE_ALLOWED_SUBJECTS||'',subjects=raw.split(',').map(x=>x.trim());
 if(subjects.some(x=>!x||x==='*'||x.includes('@')||/\s|REPLACE|EXAMPLE|PREAPPROVED/i.test(x)||x.length>255)||new Set(subjects).size!==subjects.length)bad('GOOGLE_SUBJECTS_INVALID');
 const portText=env.SAR_PORT??'8787';if(!/^\d+$/.test(portText)||Number(portText)<1||Number(portText)>65535)bad('PORT_INVALID');
 const bind=env.SAR_BIND??'127.0.0.1';if(!['127.0.0.1','::1','localhost'].includes(bind))bad('BIND_LOOPBACK_REQUIRED');
 if(url.protocol==='http:'&&Number(url.port||80)!==Number(portText))bad('LOOPBACK_PORT_MISMATCH');
 let dataDirectory,staticDirectory;try{dataDirectory=canonical(env.SAR_DATA_DIR||'./sar-data');staticDirectory=canonical(resolve(root,'public'))}catch{bad('DATA_PATH_INVALID')}
 const inside=(parent,child)=>{const r=relative(parent,child);return r===''||(!r.startsWith('..')&&!isAbsolute(r))};
 if(inside(staticDirectory,dataDirectory)||inside(dataDirectory,staticDirectory))bad('DATA_STATIC_OVERLAP');
 return {origin,clientId,allowedSubjects:subjects,port:Number(portText),bind,dataDirectory,staticDirectory};
}
