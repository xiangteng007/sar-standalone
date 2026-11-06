import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
const dir=mkdtempSync(join(tmpdir(),'sar-clean-install-'));let child;
const results=[];const record=name=>{results.push({name,result:'PASS'});console.log('PASS '+name)};
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin='http://127.0.0.1:'+port;
async function start(){let output='';child=spawn(process.execPath,['server.mjs'],{cwd:dir,env:{...process.env,SAR_ORIGIN:origin,SAR_PORT:String(port),SAR_BIND:'127.0.0.1',SAR_DATA_DIR:join(dir,'data'),SAR_GOOGLE_CLIENT_ID:'synthetic-client.apps.googleusercontent.com',SAR_GOOGLE_ALLOWED_SUBJECTS:'synthetic-owner'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);await new Promise((resolve,reject)=>{const deadline=Date.now()+8000;const poll=setInterval(()=>{if(output.includes('is listening')){clearInterval(poll);resolve()}else if(child.exitCode!==null||Date.now()>deadline){clearInterval(poll);reject(Error('CLI did not start: '+output));}},50)});}
async function stop(){if(!child||child.exitCode!==null)return;const p=child;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM')});child=null;}
try{
 cpSync('outputs/standalone',dir,{recursive:true});const install=spawnSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:dir,encoding:'utf8',timeout:90000});assert.equal(install.status,0,install.stderr);record('clean directory npm ci from delivered lockfile');
 await start();assert.equal((await fetch(origin+'/healthz')).status,200);assert.match(await(await fetch(origin)).text(),/id="root"/);assert.equal((await fetch(origin+'/api/pilot',{headers:{'oai-authenticated-user-id':'forged'}})).status,401);record('actual standalone CLI serves UI and denies unauthenticated data');
 await stop();await start();assert.equal((await(await fetch(origin+'/healthz')).json()).version,'0.4');record('actual process stops and restarts successfully');
 writeFileSync('verification/standalone-process.json',JSON.stringify({at:new Date().toISOString(),scope:'Fresh temporary install, actual CLI process start/restart, unauthenticated HTTP. Google credentials placeholders; no actual OAuth or authenticated state seeded.',passed:results.length,results},null,2));
}finally{await stop();rmSync(dir,{recursive:true,force:true})}
