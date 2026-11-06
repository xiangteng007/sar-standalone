import {createServer} from 'node:http';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStorage} from './storage.mjs';
import {googleVerifier} from './google-auth.mjs';
import {createRuntime} from './runtime.mjs';
import {httpHandler} from './http-adapter.mjs';
const root=dirname(fileURLToPath(import.meta.url));
import {deploymentConfig} from './config.mjs';
let config;
try{config=deploymentConfig(process.env,root)}catch(error){console.error('SAR configuration rejected: '+error.message);process.exit(1)}
if(process.argv.includes('--check-config')){console.log('SAR configuration syntax/path checks passed; Google approval, TLS, permissions and capacity NOT verified.');process.exit(0)}
const {origin,clientId}=config;
let storage,runtime;
try{storage=openStorage(config.dataDirectory);runtime=createRuntime({...config,storage,verifyCredential:googleVerifier(clientId)})}catch{storage?.close();console.error('SAR startup failed: STORAGE_OR_RUNTIME_UNAVAILABLE');process.exit(1)}
const server=createServer(httpHandler(()=>runtime,origin));
server.requestTimeout=30000;server.headersTimeout=15000;server.listen(config.port,config.bind,()=>console.log('SAR standalone is listening; synthetic private mode.'));
server.on('error',()=>{console.error('SAR startup failed: LISTENER_UNAVAILABLE');storage.close();process.exit(1)});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{storage.close();process.exit(0)}));
