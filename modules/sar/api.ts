import {validateReport,feature,imageMime,type Report} from './validation';
type SarStatement={bind(...values:any[]):SarStatement;first<T=Record<string,any>>():Promise<T|null>;all<T=Record<string,any>>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>};
export type SarBindings={DB?:{prepare(sql:string):SarStatement},BUCKET?:any};
/** Identity MUST be derived by a trusted host adapter, never from client fields. */
export function createSarApi(env:SarBindings,identity:(request:Request)=>string|null){
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function json(data:any,status=200){return Response.json(data,{status,headers});}
function owner(req:Request){return identity(req)?.trim()||null;}
function fail(message:string,status=400){return json({error:message},status);}
async function caseFor(id:string,u:string){return env.DB!.prepare('SELECT * FROM pilot_cases WHERE id=? AND owner=?').bind(id,u).first<any>();}
async function GET(req:Request){
 const u=owner(req);if(!u)return fail('請先登入此私人試驗台',401);
 if(!env.DB||!env.BUCKET)return fail('測試資料服務尚未就緒',503);
 const url=new URL(req.url),photo=url.searchParams.get('photo'),exportId=url.searchParams.get('export');
 if(photo){const row=await env.DB.prepare('SELECT photo_key,mime FROM pilot_reports WHERE id=? AND owner=?').bind(photo,u).first<any>();if(!row?.photo_key)return fail('找不到附件',404);const object=await env.BUCKET.get(row.photo_key);if(!object)return fail('附件尚未就緒',404);return new Response(object.body,{headers:{...headers,'Content-Type':row.mime,'Content-Disposition':'inline; filename="test-photo"'}});}
 if(exportId){const c=await caseFor(exportId,u);if(!c)return fail('找不到案件',404);if(c.status!=='active')return fail('案件已結案，成果匯出已停止',409);const result=await env.DB.prepare('SELECT payload,state FROM pilot_reports WHERE case_id=? AND owner=?').bind(c.id,u).all<any>();return json({type:'FeatureCollection',features:result.results.map((r:any)=>feature(JSON.parse(r.payload),r.state,c.mode,c.status)).filter(Boolean)});}
 const cases=await env.DB.prepare('SELECT id,title,mode,status,created FROM pilot_cases WHERE owner=? ORDER BY created DESC').bind(u).all();
 const rows=await env.DB.prepare('SELECT id,case_id,payload,state,photo_key,created FROM pilot_reports WHERE owner=? ORDER BY created DESC LIMIT 200').bind(u).all<any>();
 return json({cases:cases.results,reports:rows.results.map(r=>({id:r.id,caseId:r.case_id,data:JSON.parse(r.payload),state:r.state,hasPhoto:!!r.photo_key,created:r.created})),limit:200});
}
async function POST(req:Request){
 const u=owner(req);if(!u)return fail('請先登入此私人試驗台',401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return fail('來源不符',403);
 if(!env.DB||!env.BUCKET)return fail('測試資料服務尚未就緒',503);
 if(Number(req.headers.get('content-length')||0)>6*1024*1024)return fail('檔案過大',413);
 try{
  if(req.headers.get('content-type')?.includes('multipart/form-data')){
   const f=await req.formData(),text=f.get('payload');if(typeof text!=='string'||text.length>180000)return fail('回報內容無效');
   const r=JSON.parse(text) as Report,c=await caseFor(r.caseId,u);if(!c)return fail('找不到案件',404);if(c.status!=='active')return fail('案件已結案，停止收件',409);
   const error=validateReport(r,c.mode);if(error)return fail(error);
   const p=f.get('photo');let bytes:ArrayBuffer|null=null,mime:string|null=null;
   if(p instanceof File&&p.size){if(p.size>5*1024*1024)return fail('照片限 5 MB',413);bytes=await p.arrayBuffer();mime=imageMime(new Uint8Array(bytes));if(!mime)return fail('此試驗版只接受 JPEG 或 PNG；HEIC 尚未支援');if(r.photoPurpose==='none')return fail('請選擇照片用途');}else if(r.photoPurpose!=='none')return fail('已選照片用途但附件未收到');
   const sha=async(b:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b as ArrayBuffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const hash=await sha(new TextEncoder().encode(JSON.stringify(r)+(bytes?await sha(bytes):'')));
   const old=await env.DB.prepare('SELECT owner,hash FROM pilot_reports WHERE id=?').bind(r.id).first<any>();if(old)return old.owner===u&&old.hash===hash?json({id:r.id,state:'received',duplicate:true}):fail('相同回報編號已有不同內容，請建立新回報',409);
   const key=bytes?`pilot/${crypto.randomUUID()}`:null;if(key&&bytes)await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime!}});
   let saved;
   try{saved=await env.DB.prepare("INSERT OR IGNORE INTO pilot_reports(id,case_id,owner,payload,hash,state,photo_key,mime,created) SELECT ?,?,?,?,?,'pending',?,?,? WHERE EXISTS(SELECT 1 FROM pilot_cases WHERE id=? AND owner=? AND status='active')").bind(r.id,c.id,u,JSON.stringify(r),hash,key,mime,new Date().toISOString(),c.id,u).run();}catch(e){if(key)await env.BUCKET.delete(key);throw e;}
   if(!saved.meta.changes){if(key)await env.BUCKET.delete(key);const current=await caseFor(c.id,u);if(current?.status!=='active')return fail('案件已結案，停止收件',409);const same=await env.DB.prepare('SELECT hash,owner FROM pilot_reports WHERE id=?').bind(r.id).first<any>();return same?.owner===u&&same.hash===hash?json({id:r.id,state:'received',duplicate:true}):fail('重複送件發生衝突',409);}
   return json({id:r.id,state:'received',duplicate:false},201);
  }
  const b=await req.json() as any;
  if(b.action==='create_case'){if(!['mountain','human','animal'].includes(b.mode))return fail('案件模式無效');const count=await env.DB.prepare('SELECT count(*) AS n FROM pilot_cases WHERE owner=?').bind(u).first<any>();if(count.n>=30)return fail('試驗版最多 30 件');const id='DEMO-'+crypto.randomUUID();await env.DB.prepare('INSERT INTO pilot_cases(id,owner,title,mode,status,created) VALUES(?,?,?,?,?,?)').bind(id,u,String(b.title||'模擬案件').slice(0,80),b.mode,'active',new Date().toISOString()).run();return json({id},201);}
  if(b.action==='close'){const c=await caseFor(b.caseId,u);if(!c)return fail('找不到案件',404);await env.DB.prepare("UPDATE pilot_cases SET status='closed' WHERE id=? AND owner=?").bind(c.id,u).run();return json({status:'closed'});}
  if(b.action==='review'){if(!['approved','rejected'].includes(b.decision))return fail('審核狀態無效');const r=await env.DB.prepare('SELECT * FROM pilot_reports WHERE id=? AND owner=?').bind(b.id,u).first<any>();if(!r)return fail('找不到回報',404);const c=await caseFor(r.case_id,u);if(c?.status!=='active')return fail('結案後不能變更審核',409);const result=await env.DB.prepare("UPDATE pilot_reports SET state=? WHERE id=? AND owner=? AND EXISTS(SELECT 1 FROM pilot_cases WHERE id=? AND owner=? AND status='active')").bind(b.decision,r.id,u,c.id,u).run();return result.meta.changes?json({state:b.decision}):fail('案件已結案',409);}
  return fail('不支援的操作');
 }catch(e){console.error('pilot request failed',e instanceof Error?e.name:'unknown');return fail('資料格式或儲存失敗，尚未確認收件，請保留原資料後重試',400);}
}

return {GET,POST};
}
