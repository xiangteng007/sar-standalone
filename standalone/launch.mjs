import {loadEnvFile} from 'node:process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const action=process.argv[2]||'start';
if(process.argv.length>3||!['start','check'].includes(action)){
 console.error('SAR launcher: use start or check');process.exit(1);
}
// Anchor relative data paths to the installation, not a shortcut's working directory.
try{process.chdir(root);loadEnvFile(join(root,'.env'));}
catch{console.error('SAR launcher: CONFIG_FILE_UNAVAILABLE');process.exit(1);}
process.argv=[process.execPath,join(root,'server.mjs'),...(action==='check'?['--check-config']:[])];
try{await import('./server.mjs');}
catch{console.error('SAR launcher: STARTUP_UNAVAILABLE');process.exit(1);}
