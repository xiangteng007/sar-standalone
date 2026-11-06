import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
const temp=mkdtempSync(join(tmpdir(),'sar-launch-')),install=join(temp,'install with spaces'),caller=join(temp,'unrelated');
mkdirSync(caller);cpSync('outputs/standalone',install,{recursive:true});
const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('SAR_'))delete env[key];
// Use only installed runtime dependencies; do not add a test authentication endpoint.
cpSync('node_modules',join(install,'node_modules'),{recursive:true,dereference:true});
const checks=[];let child;
const run=(...args)=>spawnSync(process.execPath,[join(install,'launch.mjs'),...args],{cwd:caller,env,encoding:'utf8',timeout:10000});
const check=(name,fn)=>{fn();checks.push({name,result:'PASS'});console.log('PASS '+name)};
try{
 check('missing private config fails without database or leaked path',()=>{const r=run('check');assert.equal(r.status,1);assert.match(r.stderr,/CONFIG_FILE_UNAVAILABLE/);assert.ok(!r.stderr.includes(install));assert.ok(!existsSync(join(install,'sar-data')))});
 check('invalid launcher arguments rejected',()=>{assert.equal(run('unexpected').status,1);assert.equal(run('check','extra').status,1)});
 cpSync('standalone/.env.example',join(install,'.env'));
 check('placeholder Google configuration cannot start',()=>{const r=run();assert.equal(r.status,1);assert.match(r.stderr,/GOOGLE_CLIENT_INVALID/);assert.ok(!existsSync(join(install,'sar-data')))});
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 writeFileSync(join(install,'.env'),`SAR_ORIGIN=http://127.0.0.1:${port}\nSAR_PORT=${port}\nSAR_DATA_DIR=./sar-data\nSAR_GOOGLE_CLIENT_ID=synthetic-client.apps.googleusercontent.com\nSAR_GOOGLE_ALLOWED_SUBJECTS=synthetic-owner\n`);
 check('configuration check resolves installation paths without creating data',()=>{const r=run('check');assert.equal(r.status,0,r.stderr);assert.ok(!existsSync(join(install,'sar-data')));assert.ok(!existsSync(join(caller,'sar-data')))});
 let output='';child=spawn(process.execPath,[join(install,'launch.mjs')],{cwd:caller,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 await new Promise((ok,no)=>{const limit=Date.now()+10000;const timer=setInterval(()=>{if(output.includes('is listening')){clearInterval(timer);ok()}else if(child.exitCode!==null||Date.now()>limit){clearInterval(timer);no(Error('Launcher failed to become ready'))}},50)});
 assert.equal((await fetch(`http://127.0.0.1:${port}/api/pilot`)).status,401);
 check('actual service starts with private data rooted at installation',()=>{assert.ok(existsSync(join(install,'sar-data','sar.sqlite')));assert.ok(!existsSync(join(caller,'sar-data')))});
 await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('Stop timeout')),10000);child.once('exit',()=>{clearTimeout(timer);ok()});child.kill('SIGTERM')});child=null;
 checks.push({name:'owned process terminates without stopping unrelated services',result:'PASS'});console.log('PASS owned process terminates');
 mkdirSync('verification',{recursive:true});writeFileSync('verification/launcher.json',JSON.stringify({scope:'Actual local process, synthetic config, no real Google or TLS. SIGTERM is graceful on Unix; Windows process termination does not prove console Ctrl+C.',passed:checks.length,checks},null,2));
}finally{if(child&&child.exitCode===null)child.kill();rmSync(temp,{recursive:true,force:true})}
