import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createSarApi} from './core/api.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(req,name)=>{const match=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return match?.slice(name.length+1)||'';};
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const h={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(b,s=200)=>Response.json(b,{status:s,headers:h});
const html=s=>new Response(s,{headers:{...h,'Content-Type':'text/html; charset=utf-8'}});
const shell=(title,body)=>`<!doctype html><html lang="zh-Hant"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px system-ui;max-width:560px;margin:10vh auto;padding:24px;color:#203b30;background:#f4f4ee}button,a{display:inline-block;padding:14px}p{line-height:1.8}</style><h1>${title}</h1>${body}</html>`;
/** verifyCredential is an injected server dependency. The executable always uses Google's verifier. */
export function createRuntime({storage,origin,clientId,allowedSubjects,verifyCredential,staticDirectory,clock=Date.now}){
 const base=new URL(origin);if(base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw Error('Origin must contain only scheme and host');
 if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw Error('HTTPS required outside loopback');
 if(!Array.isArray(allowedSubjects)||!allowedSubjects.length||allowedSubjects.some(x=>typeof x!=='string'||!x||x==='*'))throw Error('Explicit subject allowlist required');
 const allowed=new Set(allowedSubjects),challenges=new Map(),attempts=new Map(),secure=base.protocol==='https:'?'; Secure':'';
 const setCookie=(name,value,maxAge)=>`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
 function principal(req){const token=cookie(req,'sar_session');if(!/^[a-f0-9]{64}$/.test(token))return null;const row=storage.db.prepare('SELECT subject,expires FROM sar_sessions WHERE hash=?').get(hash(token));if(!row||row.expires<=clock()||!allowed.has(row.subject))return null;return 'google:'+row.subject;}
 const api=createSarApi(storage,principal);
 const sameOrigin=req=>req.headers.get('origin')===base.origin;
 function sweep(){const now=clock();for(const [k,v]of challenges)if(v.expires<=now)challenges.delete(k);for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);storage.db.prepare('DELETE FROM sar_sessions WHERE expires<=?').run(now);}
 async function handle(req){
  const u=new URL(req.url);if(u.origin!==base.origin)return json({error:'Host not allowed'},403);
  if(req.method!=='GET'&&req.method!=='HEAD'&&!sameOrigin(req))return json({error:'Origin rejected'},403);
  if(u.pathname==='/healthz')return json({service:'sar-standalone',version:'0.4',status:'ready',scope:'private-synthetic'});
  if(u.pathname==='/auth/google'&&req.method==='GET'){
   sweep();if(challenges.size>=1000)return json({error:'請稍後再試'},429);
   const nonce=randomBytes(32).toString('hex'),key=randomBytes(32).toString('hex');challenges.set(hash(key),{nonce,expires:clock()+300000});
   const response=html(shell('登入協尋工作區','<p>使用已獲准的 Google 帳號登入。這是私人合成資料演練環境。</p><div id="google"></div><p id="result" role="status"></p><a href="/">回到首頁</a><script src="/auth/login.js" defer></script>'));
   response.headers.set('Set-Cookie',setCookie('sar_login',key,300));return response;
  }
  if(u.pathname==='/auth/login.js'&&req.method==='GET'){
   const challenge=challenges.get(hash(cookie(req,'sar_login')));if(!challenge||challenge.expires<=clock())return json({error:'請重新開啟登入頁'},401);
   const js=`const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=()=>{google.accounts.id.initialize({client_id:${JSON.stringify(clientId)},nonce:${JSON.stringify(challenge.nonce)},callback:async r=>{const el=document.querySelector('#result');el.textContent='正在確認登入…';try{const res=await fetch('/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:r.credential})});if(res.ok)location.assign('/');else el.textContent='登入未完成或帳號尚未獲准，請重新登入。';}catch{el.textContent='連線中斷，尚未確認登入。'}}});google.accounts.id.renderButton(document.querySelector('#google'),{type:'standard',size:'large',text:'signin_with'});};script.onerror=()=>document.querySelector('#result').textContent='Google 登入暫時無法載入。';document.head.append(script);`;
   return new Response(js,{headers:{...h,'Content-Type':'text/javascript; charset=utf-8'}});
  }
  if(u.pathname==='/auth/session'&&req.method==='POST'){
   sweep();const key=hash(cookie(req,'sar_login')),challenge=challenges.get(key);if(!challenge||challenge.expires<=clock())return json({error:'登入請求已失效'},401);
   const a=attempts.get(key)||{n:0,until:clock()+300000};a.n++;attempts.set(key,a);if(a.n>5)return json({error:'請重新開始登入'},429);
   try{const b=await req.json();if(typeof b.credential!=='string'||b.credential.length>16384)return json({error:'憑證無效'},400);const verified=await verifyCredential(b.credential);if(!equal(verified.nonce,challenge.nonce)||!allowed.has(verified.subject))return json({error:'登入或存取權限無效'},403);
    // Consume after verification: concurrent duplicate callbacks cannot create sessions.
    if(!challenges.delete(key))return json({error:'登入請求已使用'},409);
    const token=randomBytes(32).toString('hex');storage.db.prepare('INSERT INTO sar_sessions(hash,subject,expires) VALUES(?,?,?)').run(hash(token),verified.subject,clock()+3600000);
    const response=json({authenticated:true});response.headers.set('Set-Cookie',setCookie('sar_session',token,3600));return response;
   }catch{return json({error:'登入驗證失敗'},401)}
  }
  if(u.pathname==='/auth/logout'&&req.method==='GET')return html(shell('登出私人工作區','<form method="post" action="/auth/logout"><button>確認登出</button></form><a href="/">回到首頁</a>'));
  if(u.pathname==='/auth/logout'&&req.method==='POST'){storage.db.prepare('DELETE FROM sar_sessions WHERE hash=?').run(hash(cookie(req,'sar_session')));return new Response(null,{status:303,headers:{...h,Location:'/', 'Set-Cookie':setCookie('sar_session','',0)}});}
  if(u.pathname==='/api/pilot'){if(req.method==='GET')return api.GET(req);if(req.method==='POST')return api.POST(req);return json({error:'Method not allowed'},405);}
  if(u.pathname.startsWith('/auth/')||u.pathname.startsWith('/api/'))return json({error:'Not found'},404);
  if(!['GET','HEAD'].includes(req.method))return json({error:'Method not allowed'},405);
  const root=resolve(staticDirectory),path=resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(path!==root&&!path.startsWith(root+sep))return json({error:'Not found'},404);
  if(!existsSync(path))return json({error:'Not found'},404);
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
  return new Response(req.method==='HEAD'?null:readFileSync(path),{headers:{...h,'Content-Type':types[extname(path)]||'application/octet-stream'}});
 }
 return {handle,principal};
}
