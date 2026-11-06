import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {writeFileSync} from 'node:fs';
import {googleVerifier} from '../standalone/google-auth.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const clientId='synthetic.apps.googleusercontent.com',client=new OAuth2Client(clientId);
// Test-only cert source. No private key is written or exported, no Google calls.
client.getFederatedSignonCertsAsync=async()=>({certs:{fixture:publicKey.export({type:'spki',format:'pem'})},format:'PEM'});
const verify=googleVerifier(clientId,client),now=Math.floor(Date.now()/1000),results=[];
function jwt(patch={},header={}){const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture',...header})).toString('base64url'),p=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:clientId,sub:'synthetic-A',iat:now,exp:now+3600,nonce:'fixture-nonce',...patch})).toString('base64url');const data=h+'.'+p;return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url')}
async function check(name,fn){await fn();results.push({name,result:'PASS'});console.log('PASS '+name)}
await check('official verifier validates signed fixture and returns stable subject',async()=>assert.deepEqual(await verify(jwt()),{subject:'synthetic-A',nonce:'fixture-nonce'}));
await check('wrong audience rejected',async()=>assert.rejects(()=>verify(jwt({aud:'other'}))));
await check('wrong issuer rejected',async()=>assert.rejects(()=>verify(jwt({iss:'https://untrusted.test'}))));
await check('expired signed token rejected',async()=>assert.rejects(()=>verify(jwt({iat:now-7200,exp:now-3600}))));
await check('missing subject rejected',async()=>assert.rejects(()=>verify(jwt({sub:''}))));
await check('unknown signing key rejected',async()=>assert.rejects(()=>verify(jwt({},{kid:'unknown'}))));
await check('tampered signature rejected',async()=>{const t=jwt();const parts=t.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);await assert.rejects(()=>verify(parts.join('.')))});
writeFileSync('verification/google-verifier.json',JSON.stringify({at:new Date().toISOString(),scope:'Official google-auth-library with ephemeral RSA-signed synthetic fixtures and test-only certificate source. NOT actual Google sign-in, project setup or production trust transport.',passed:results.length,results},null,2));
