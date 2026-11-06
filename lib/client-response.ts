// A private Sites gate may return an HTML login page even for an API URL.
export class SessionUnavailable extends Error {
 constructor(message:string,public state:'anonymous'|'unavailable'){super(message);this.name='SessionUnavailable';}
}
export async function readPilotResponse(res:Response):Promise<any>{
 if(res.status===401||res.status===403)throw new SessionUnavailable('尚未登入、登入已失效或沒有存取權，請重新登入。','anonymous');
 if(!(res.headers.get('content-type')||'').includes('application/json'))throw new SessionUnavailable('無法確認登入狀態；請重新登入或稍後重新檢查。','unavailable');
 let data:any;try{data=await res.json();}catch{throw new SessionUnavailable('服務回應不完整，無法確認登入與操作結果，請稍後重新檢查。','unavailable');}
 if(!res.ok)throw Error(data.error||'服務暫時無法回應');
 return data;
}
