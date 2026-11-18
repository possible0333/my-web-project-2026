import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../upload-all.js',import.meta.url),'utf8');
function setup(raw,fail=false){
 const store=new Map(),key='business_map_bar_preview_v1';let uploaded=0;
 if(raw!==undefined)store.set(key,raw);
 store.set(key+'_owner','Test');
 const ctx={localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},BarModel:{nextEvent:db=>({id:'next'})},BarCloud:{connect:async()=>({userId:'u'}),upload:async()=>{uploaded++;if(fail)throw Error('network error');return {date:'next',userId:'u',fingerprint:'ok'};}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script,ctx);
 return {api:ctx.BusinessUploadAll,store,key,cloud:ctx.BarCloud,count:()=>uploaded};
}
const valid=JSON.stringify({schema:1,people:[],events:[{id:'next'}],entries:[],history:[]});
test('upload all sends Bar even when map fails, and records its receipt',async()=>{
 const x=setup(valid),r=await x.api.run(async()=>{throw Error('map failed');});
 assert.equal(r[1].status,'failed');assert.equal(r[0].status,'success');assert.equal(x.count(),1);assert.ok(x.store.has(x.key+'_receipts'));
});
test('partial failure reports exactly which service failed',async()=>{
 const x=setup(valid,true),r=await x.api.run(async()=>({status:'success',message:'shared'}));
 assert.equal(r[1].status,'success');assert.equal(r[0].status,'failed');assert.ok(!x.store.has(x.key+'_receipts'));
});
test('unregistered Bar skips, malformed data fails without upload',async()=>{
 const missing=setup(),broken=setup('{');
 assert.equal((await missing.api.uploadBar()).status,'skipped');await assert.rejects(broken.api.uploadBar());assert.equal(broken.count(),0);
});
test('changed device identity blocks duplicate upload',async()=>{
 const x=setup(valid);x.store.set(x.key+'_receipts',JSON.stringify({past:{userId:'other'}}));
 await assert.rejects(x.api.uploadBar(),/ID/);assert.equal(x.count(),0);
});
test('Bar upload finishes before slow map rendering begins',async()=>{
 const x=setup(valid);let release;
 const blocked=new Promise(resolve=>release=resolve);
 const run=x.api.run(async()=>{assert.equal(x.count(),1);await blocked;return {status:'success'};});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(x.count(),1);
 release();await run;
});
test('verification checks invited participants as well as self and rejects hidden entries',async()=>{
 const raw=JSON.stringify({schema:1,people:[],events:[{id:'next'}],entries:[{eventId:'next',personId:'guest',name:'Guest',status:'yes'}],history:[]});
 const x=setup(raw);
 x.cloud.loadUpload=async(userId,date)=>{assert.equal(userId,'u');assert.equal(date,'next');return {db:{entries:[]}};};
 await assert.rejects(x.api.uploadBar(),/Guest/);
 assert.equal(x.store.has(x.key+'_receipts'),false);
 x.cloud.loadUpload=async()=>({db:{entries:[{uploaderId:'u',eventId:'next',sourcePersonId:'guest',status:'yes'}]}});
 assert.equal((await x.api.uploadBar()).status,'success');
});
