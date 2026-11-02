import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const base=new URL('../',import.meta.url),ctx={crypto:webcrypto};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(await readFile(new URL('bar-events/model.js',base),'utf8'),ctx);
vm.runInContext(await readFile(new URL('bar-events/cloud.js',base),'utf8'),ctx);
const M=ctx.BarModel,C=ctx.BarCloud;
const row=(uid,events)=>({user_id:uid,map_data:{schema:C.schema},schedule_data:{barEvents:{schema:C.schema,events}}});
const event=(date,name='同名')=>({date,owner:'担当者',uploadedAt:'2026-11-02T00:00:00Z',entries:[{personId:'p',name,sponsor:'Sponsor',kind:'prospect',status:'yes',slots:['A','C'],arrived:true}]});
test('admin corrections survive reupload, stay scoped, and deletion can be restored',()=>{
 const rows=[row('a',[event('2026-11-07'),event('2026-11-21')]),row('b',[event('2026-11-07')])];
 const correction={uploader_id:'a',event_date:'2026-11-07',person_id:'p',patch:{name:'変更後',kind:'member',slots:['D']},deleted:false,revision:1};
 const changed=C.aggregate(rows,[correction]);
 assert.equal(changed.db.entries.find(e=>e.id==='2026-11-07:a:p').name,'変更後');
 assert.equal(changed.db.entries.find(e=>e.id==='2026-11-07:b:p').name,'同名');
 assert.equal(changed.db.entries.find(e=>e.id==='2026-11-21:a:p').name,'同名');
 rows[0].schedule_data.barEvents.events[0].entries[0].name='再アップロード';
 assert.equal(C.aggregate(rows,[correction]).db.entries[0].name,'変更後');
 correction.deleted=true;const removed=C.aggregate(rows,[correction]);
 assert.equal(removed.db.entries.length,2);assert.equal(removed.deletedEntries.length,1);
 correction.deleted=false;assert.equal(C.aggregate(rows,[correction]).db.entries.length,3);
});
test('D survives upload snapshot and shared aggregation',()=>{
 const db=M.empty();M.pair(db,'2026-11-07');
 M.setSelf(db,db.events[0].id,'Me',null,{status:'yes',slots:['C','D']});
 const snap=C.snapshot(db,db.events[0].id,'Me');
 const result=C.aggregate([row('device',[snap])]);
 assert.equal(result.db.entries[0].slots.join(','),'C,D');
 assert.equal(M.summary(result.db.entries).part2,1);
});
test('snapshot excludes notes and personal map fields, and is stable',()=>{
 const db=M.empty();M.pair(db,'2026-11-07');const p=M.person(db,{name:'Test'});M.add(db,db.events[0].id,p.id);db.entries[0].note='PRIVATE';db.entries[0].target=30000;
 const snap=C.snapshot(db,db.events[0].id,'Owner');assert.ok(!JSON.stringify(snap).includes('PRIVATE'));assert.ok(!JSON.stringify(snap).includes('target'));
 assert.equal(JSON.stringify(C.snapshot(db,db.events[0].id,'Owner')),JSON.stringify(snap));
});
test('aggregate preserves separate devices, flags duplicate candidates and ignores maps',()=>{
 const result=C.aggregate([row('a',[event('2026-11-07')]),row('b',[event('2026-11-07')]),{map_data:{people:[]},schedule_data:{}}]);
 assert.equal(result.db.entries.length,2);assert.ok(result.db.entries.every(e=>e.duplicate));assert.equal(result.db.events.length,1);assert.equal(result.uploads.length,2);
 assert.equal(M.summary(result.db.entries).part1,2);assert.equal(M.summary(result.db.entries).part2,2);
});
test('last snapshot for a device/date wins; duplicates within snapshot count once',()=>{
 const first=event('2026-11-07','old'),latest=event('2026-11-07','new');latest.entries.push({...latest.entries[0]});
 const result=C.aggregate([row('a',[first,latest,event('2026-11-21')])]);
 assert.equal(result.db.entries.length,2);assert.equal(result.db.entries[0].name,'new');
 assert.equal(M.past(result.db,'2026-11-21','',true).length,1);
});
test('empty replacement removes own date entries and keeps other uploads',()=>{
 const result=C.aggregate([row('a',[{...event('2026-11-07'),entries:[]}]),row('b',[event('2026-11-07')])]);assert.equal(result.db.entries.length,1);
 assert.equal(C.aggregate([row('a',[event('bad')])]).db.events.length,0);
});
test('Bar-only rows stay out of the existing maps and schedule gallery',async()=>{
 const source=await readFile(new URL('v136-share.js',base),'utf8');vm.runInContext(source.slice(source.indexOf('  function rowsToItems('),source.indexOf('  async function loadMapsRest(')),ctx);
 assert.equal(ctx.rowsToItems([row('a',[event('2026-11-07')]),{user_id:'map',map_data:{},name:'Map'}]).length,1);
});
