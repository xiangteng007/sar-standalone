export type Geometry={type:'Point'|'LineString'|'Polygon',coordinates:any};
export type Report={id:string,caseId:string,kind:string,observedAt:string,endedAt?:string,source:string,photoPurpose:string,photoTakenAt?:string,locationConfirmed:boolean,geometry:Geometry,notes:string,synthetic:boolean};
export function validDate(s:unknown){return typeof s==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));}
export function validGeometry(g:any):boolean{
 const point=(p:any)=>Array.isArray(p)&&p.length===2&&p.every((n:any)=>typeof n==='number'&&Number.isFinite(n))&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 if(!g)return false;
 if(g.type==='Point')return point(g.coordinates);
 if(g.type==='LineString')return Array.isArray(g.coordinates)&&g.coordinates.length>=2&&g.coordinates.length<=2000&&g.coordinates.every(point);
 if(g.type==='Polygon')return Array.isArray(g.coordinates)&&g.coordinates.length===1&&Array.isArray(g.coordinates[0])&&g.coordinates[0].length>=4&&g.coordinates[0].length<=2000&&g.coordinates[0].every(point)&&JSON.stringify(g.coordinates[0][0])===JSON.stringify(g.coordinates[0].at(-1));
 return false;
}
export function validateReport(r:any,mode:string):string|null{
 if(!r||r.synthetic!==true)return '只接受已確認的模擬測試資料';
 if(typeof r.id!=='string'||!/^[0-9a-f-]{36}$/.test(r.id))return '回報編號無效';
 if(!['coverage','plan','environment','animal_sighting','reference'].includes(r.kind))return '回報種類無效';
 if(mode!=='animal'&&['animal_sighting','reference'].includes(r.kind))return '人員模式不收動物目擊或參考照';
 if(!validDate(r.observedAt))return '請填寫含時區的實際觀察時間';
 if(r.kind==='coverage'&&(!validDate(r.endedAt)||Date.parse(r.endedAt)<Date.parse(r.observedAt)))return '搜尋結束時間不得早於開始';
 if(!['manual','device'].includes(r.source)||r.locationConfirmed!==true)return '請確認觀察位置及來源';
 if(!validGeometry(r.geometry))return '請完成有效的點、線或封閉範圍';
 if(!['none','reference','observation','environment','evidence'].includes(r.photoPurpose))return '照片用途無效';
 if(r.kind==='animal_sighting'&&r.photoPurpose==='reference')return '舊參考照不能當成當次目擊';
 if(r.photoTakenAt&&!validDate(r.photoTakenAt))return '照片拍攝時間無效';
 if(typeof r.notes!=='string'||r.notes.length>1500)return '說明最多 1500 字';
 return null;
}
export function feature(r:Report,state:string,mode:string,caseStatus:string){
 if(state!=='approved'||caseStatus!=='active'||validateReport(r,mode)||['plan','reference'].includes(r.kind))return null;
 if(mode!=='animal'&&r.kind!=='coverage')return null;
 return {type:'Feature',geometry:r.geometry,properties:{report_id:r.id,kind:r.kind,observed_at:r.observedAt,ended_at:r.endedAt||null,meaning:r.kind==='coverage'?'曾搜尋不代表排除':'經審核的模擬回報'}};
}
export function imageMime(b:Uint8Array){if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';return null;}
