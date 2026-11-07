import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
const out='outputs/standalone';mkdirSync(out+'/core',{recursive:true});
mkdirSync(out+'/deploy',{recursive:true});
for(const name of ['sar.service','README.md'])copyFileSync('standalone/deploy/'+name,out+'/deploy/'+name);
for(const name of ['validation','api']){let source=readFileSync(`modules/sar/${name}.ts`,'utf8').replace("from './validation'","from './validation.mjs'");writeFileSync(`${out}/core/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);}
for(const name of ['config','storage','google-auth','runtime','http-adapter','server','launch','data-lock','recovery'])copyFileSync(`standalone/${name}.mjs`,`${out}/${name}.mjs`);
for(const name of ['README.md','.env.example','package-lock.json','START-SAR.cmd','start-sar.sh'])copyFileSync('standalone/'+name,out+'/'+name);
const v=JSON.parse(readFileSync('node_modules/google-auth-library/package.json','utf8')).version;
writeFileSync(out+'/package.json',JSON.stringify({name:'sar-private-standalone',version:'0.5.0',private:true,type:'module',engines:{node:'>=24.22.1'},scripts:{start:'node server.mjs'},dependencies:{'google-auth-library':v}},null,2));
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','standalone/vite.config.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
console.log('Standalone built: '+out);
