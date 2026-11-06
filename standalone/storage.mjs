import {acquireDataLock} from './data-lock.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
export function openStorage(directory){
 const root=resolve(directory);mkdirSync(root,{recursive:true,mode:0o700});
 const release=acquireDataLock(root);let db;
 try{
 const media=join(root,'media');mkdirSync(media,{recursive:true,mode:0o700});
 db=new DatabaseSync(join(root,'sar.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS pilot_cases(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS pilot_reports(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES pilot_cases(id),owner TEXT NOT NULL,payload TEXT NOT NULL,hash TEXT NOT NULL,state TEXT NOT NULL,photo_key TEXT,mime TEXT,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS sar_cases_owner ON pilot_cases(owner);
 CREATE INDEX IF NOT EXISTS sar_reports_case_owner ON pilot_reports(case_id,owner);
 CREATE TABLE IF NOT EXISTS sar_sessions(hash TEXT PRIMARY KEY,subject TEXT NOT NULL,expires INTEGER NOT NULL);
 `);
 const file=k=>{if(!/^pilot\/[a-f0-9-]{36}$/.test(k))throw Error('Invalid object key');return join(media,k.slice(6));};
 const DB={
  prepare(sql){return {
   bind(...values){const q=db.prepare(sql);return {
    async first(){return q.get(...values)||null;},
    async all(){return {results:q.all(...values)};},
    async run(){return {meta:{changes:Number(q.run(...values).changes)}};}
   };}
  };}
 };
 const BUCKET={async put(k,bytes){const final=file(k),temp=final+'.'+randomUUID()+'.part';try{writeFileSync(temp,new Uint8Array(bytes),{mode:0o600});renameSync(temp,final)}catch(error){try{if(existsSync(temp))unlinkSync(temp)}catch{console.error('SAR temporary attachment cleanup failed')}throw error}},async get(k){const f=file(k);return existsSync(f)?{body:readFileSync(f)}:null},async delete(k){const f=file(k);if(existsSync(f))unlinkSync(f)}};
 return {DB,BUCKET,db,close(){try{db.close()}finally{release()}}};
 }catch(error){try{db?.close()}finally{release()}throw error}
}
