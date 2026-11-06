import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const issues=[];
const deny=/(^|\/)(?:node_modules|outputs|verification|\.openai|\.git|sar-data|backups|integrations)(\/|$)|\.(?:sqlite\w*|db|pem|key|pfx|p12|png|jpe?g|zip|log)$/i;
const checks=[
 ['private-workspace-link',/https?:\/\/(?:app\.notion\.com|[^/]+\.chatgpt\.site)\//i],
 ['provider-secret',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16})\b/],
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['live-google-client',/\b\d{6,}-[a-z0-9-]+\.apps\.googleusercontent\.com/i],
 ['personal-email',/[A-Z0-9._%+-]+@(?:gmail|outlook|hotmail|yahoo|icloud)\.[A-Z.]+/i],
 ['private-site-id',/\bappg(?:prj|dep|ver)_[a-z0-9]+/i],
 ['nonportable-path',/(?:[A-Z]:\\|\/(?:home|Users|workspace)\/)[^\s"']+/],
];
for(const p of paths){
 if(deny.test(p)||(/(^|\/)\.env(?:\.|$)/.test(p)&&!p.endsWith('.env.example')))issues.push([p,'forbidden-path']);
 if(!lstatSync(p).isFile()){issues.push([p,'not-regular-file']);continue;}
 const b=readFileSync(p);if(b.includes(0)){issues.push([p,'binary-file']);continue;}
 for(const[label,re]of checks)if(re.test(b.toString('utf8')))issues.push([p,label]);
}
for(const lock of ['package-lock.json','standalone/package-lock.json']){
 const packages=JSON.parse(readFileSync(lock,'utf8')).packages;
 for(const [name,p] of Object.entries(packages))if(p.link||(p.resolved&&!p.resolved.startsWith('https://registry.npmjs.org/')))issues.push([lock,'nonportable-dependency']);
}
if(!paths.length)throw Error('No tracked source files to inspect');
if(issues.length){for(const[p,label]of issues)console.error(`${p}: ${label}`);process.exit(1);}
console.log(`Public-source guard passed: ${paths.length} tracked text files. Manual review still required.`);
