import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync('lib/client-response.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readPilotResponse,SessionUnavailable}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const results=[];
async function check(name,fn){await fn();results.push({name,result:'PASS'});console.log('PASS '+name);}
const expired=state=>e=>e instanceof SessionUnavailable&&e.state===state;
await check('401 asks UI to clear loaded private records',async()=>assert.rejects(readPilotResponse(Response.json({error:'Login required'},{status:401})),expired('anonymous')));
await check('403 asks UI to clear loaded private records',async()=>assert.rejects(readPilotResponse(Response.json({error:'Forbidden'},{status:403})),expired('anonymous')));
await check('HTML login gate with HTTP 200 is never treated as success',async()=>assert.rejects(readPilotResponse(new Response('<h1>登入後即可瀏覽</h1>',{headers:{'Content-Type':'text/html'}})),expired('unavailable')));
await check('malformed JSON cannot leave login verified',async()=>assert.rejects(readPilotResponse(new Response('{',{headers:{'Content-Type':'application/json'}})),expired('unavailable')));
await check('valid authenticated payload is preserved',async()=>assert.deepEqual(await readPilotResponse(Response.json({cases:[{id:'DEMO-synthetic'}],reports:[]})),{cases:[{id:'DEMO-synthetic'}],reports:[]}));
await check('closed case conflict is an operation error, not fake logout',async()=>assert.rejects(readPilotResponse(Response.json({error:'closed'},{status:409})),e=>!(e instanceof SessionUnavailable)&&e.message==='closed'));
mkdirSync('verification',{recursive:true});writeFileSync('verification/session-response.json',JSON.stringify({at:new Date().toISOString(),scope:'Client response classifier tested with synthetic HTTP Responses; not OAuth or a real browser session.',passed:results.length,results},null,2));
