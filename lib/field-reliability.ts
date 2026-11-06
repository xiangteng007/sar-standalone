/** Browser-independent logic: tests use synthetic sensors/transports, never real identities. */
export type LocationFix={lat:number,lon:number,accuracy:number,capturedAt:number};
export type LocationState={status:'idle'|'locating'|'ready'|'error',fix?:LocationFix,message?:string};
type Clock={now:()=>number,set:(fn:()=>void,ms:number)=>unknown,clear:(id:unknown)=>void};
const clock:Clock={now:Date.now,set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};
export const FIX_MAX_AGE_MS=120000;
export function isFreshFix(fix:LocationFix,at=Date.now()){
 return Number.isFinite(fix.capturedAt)&&at-fix.capturedAt<=FIX_MAX_AGE_MS&&fix.capturedAt<=at+1000;
}
export function createLocationController(geo:Pick<Geolocation,'getCurrentPosition'>|undefined,emit:(state:LocationState)=>void,timer:Clock=clock){
 let generation=0,watchdog:unknown;
 function cancel(){generation++;timer.clear(watchdog);watchdog=undefined;}
 function clear(){cancel();emit({status:'idle'});}
 function start(){
  cancel();const current=generation;emit({status:'locating'});
  const finish=(state:LocationState)=>{if(current!==generation)return;cancel();emit(state);};
  if(!geo){finish({status:'error',message:'此瀏覽器不支援定位，請手動標記位置。'});return;}
  watchdog=timer.set(()=>finish({status:'error',message:'定位逾時，舊定位已清除。請移至安全且開闊處重試，或手動標記。'}),16000);
  try{geo.getCurrentPosition(p=>{
   const fix={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:p.timestamp};
   if(!Number.isFinite(fix.lat)||Math.abs(fix.lat)>90||!Number.isFinite(fix.lon)||Math.abs(fix.lon)>180||!Number.isFinite(fix.accuracy)||fix.accuracy<0||!isFreshFix(fix,timer.now())){
    finish({status:'error',message:'定位資料無效或過期，請重新取得或手動標記。'});return;
   }
   finish({status:'ready',fix});
  },e=>finish({status:'error',message:e.code===1?'定位權限被拒絕。可手動標記，或在瀏覽器／系統設定允許定位後重試。':e.code===3?'定位逾時，舊定位已清除。請重試或手動標記。':'目前無法取得位置，舊定位已清除。請重試或手動標記。'}),{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
  catch{finish({status:'error',message:'目前無法使用定位服務，請手動標記位置。'});}
 }
 return {start,clear,dispose:cancel};
}

export type Receipt={id:string,state:'received',duplicate:boolean};
/** A timeout means the receipt is unknown; abort does not imply server rollback. */
export async function sendReport(options:{request:typeof fetch,url:string,form:FormData,id:string,readResponse:(response:Response)=>Promise<any>,timeoutMs?:number}):Promise<Receipt>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   (async()=>{
    const response=await options.request(options.url,{method:'POST',body:options.form,signal:controller.signal});
    const receipt=await options.readResponse(response);
    if(receipt?.id!==options.id||receipt?.state!=='received'||typeof receipt.duplicate!=='boolean')throw Error('收件回執不完整；請保留原編號核對，勿建立重複回報。');
    return receipt as Receipt;
   })(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(Error('連線逾時，無法確認是否收件。請恢復連線後核對或以原編號重試。'));controller.abort();},options.timeoutMs??30000);})
  ]);
 }finally{if(timer)clearTimeout(timer);}
}
/** A list-refresh failure must never undo an acknowledged receipt. */
export async function finishReceived(receipt:Receipt,onReceived:(receipt:Receipt)=>void,refresh:()=>Promise<unknown>){
 onReceived(receipt);
 try{await refresh();return {receipt,refreshError:null};}
 catch(e){return {receipt,refreshError:e instanceof Error?e.message:'清單尚未更新'};}
}
export function coverageDuration(start:string,end?:string){
 if(!end)return null;
 const duration=Date.parse(end)-Date.parse(start);if(!Number.isFinite(duration)||duration<0)return null;
 const minutes=Math.round(duration/60000);
 return {minutes,long:duration>24*60*60000,text:`${Math.floor(minutes/60)} 小時 ${minutes%60} 分鐘`};
}
