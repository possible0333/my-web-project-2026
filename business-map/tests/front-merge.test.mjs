import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const core=await readFile(new URL('v103-app-1.js',root),'utf8');
const source=await readFile(new URL('v103-app-2.js',root),'utf8');
function setup(members=[]){
 const storage=new Map();const ctx={console,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(core+'\nthis.api={set:s=>state=s,get:()=>state,migrate};',ctx);
 vm.runInContext(source.slice(source.indexOf('function operationalMapToState('),source.indexOf('function chooseGroupMap(')),ctx);
 ctx.normalizeImportedState=ctx.operationalMapToState;ctx.render=()=>{};
 vm.runInContext(source.slice(source.indexOf('window.v179SharedFrontMode='),source.indexOf('function escapeHtml(')),ctx);
 ctx.api.set({self:{id:'self',name:'Owner'},members});ctx.storage=storage;return ctx;
}
const member=(id,person,parentId='self',extra={})=>({id,name:person,type:'カスタマー',parentId,sharedSourceUserId:'source-a',sharedSourcePersonId:person,...extra});
const incoming={people:[{id:'self',name:'Front',type:'ABO'},{id:'abo',name:'ABO',type:'ABO',parentId:'self',status:'appointment-set'},{id:'customer',name:'Customer',type:'カスタマー',parentId:'abo',targetPv:10000,status:'ordered'}]};
test('reimports consolidate detached duplicates, preserve branch IDs and sponsors',()=>{
 const initial=[member('front','self','self',{type:'ABO'}),member('abo-old','abo','front',{type:'ABO'}),member('detached','customer'),member('correct','customer','abo-old'),{id:'local',name:'Local',type:'カスタマー',parentId:'detached'},member('absent','absent','front'),member('other','customer','self',{sharedSourceUserId:'other-source'})];
 const ctx=setup(initial);ctx.v179MergeSharedFront('source-a',incoming);
 let list=ctx.api.get().members;
 assert.equal(list.filter(p=>p.sharedSourceUserId==='source-a'&&p.sharedSourcePersonId==='customer').length,1);
 assert.equal(list.find(p=>p.id==='correct').parentId,'abo-old');
 assert.equal(list.find(p=>p.id==='local').parentId,'correct');
 assert.ok(list.some(p=>p.id==='absent'));assert.ok(list.some(p=>p.id==='other'));
 assert.equal(JSON.parse(ctx.storage.get('business_map_before_front_merge')).state.members.length,initial.length);
 const ids=list.map(p=>p.id).sort();
 for(let i=0;i<3;i++)ctx.v179MergeSharedFront('source-a',incoming);
 list=ctx.api.get().members;assert.deepEqual(list.map(p=>p.id).sort(),ids);
 assert.equal(ctx.api.migrate(ctx.api.get()).members.find(p=>p.id==='correct').parentId,'abo-old');
});
test('re-add after root removal reuses detached identities instead of duplicating',()=>{
 const ctx=setup([member('detached','customer')]);ctx.v179MergeSharedFront('source-a',incoming);
 assert.equal(ctx.api.get().members.length,3);
 assert.equal(ctx.api.get().members.find(p=>p.id==='detached').parentId,ctx.api.get().members.find(p=>p.sharedSourcePersonId==='abo').id);
});
test('same names from different sources are never merged',()=>{
 const ctx=setup();ctx.v179MergeSharedFront('source-a',incoming);ctx.v179MergeSharedFront('source-b',incoming);
 assert.equal(ctx.api.get().members.length,6);
});
test('invalid incoming relationships and duplicate source IDs fail before mutation',()=>{
 for(const people of [
  [{id:'self'},{id:'a',parentId:'missing'}],
  [{id:'self'},{id:'a',parentId:'b'},{id:'b',parentId:'a'}],
  [{id:'self'},{id:'a'},{id:'a'}]
 ]){
  const ctx=setup([member('original','customer')]);const before=JSON.stringify(ctx.api.get());
  assert.throws(()=>ctx.v179MergeSharedFront('source-a',{people}));assert.equal(JSON.stringify(ctx.api.get()),before);assert.equal(ctx.storage.size,0);
 }
});
test('backup failure does not partially mutate the map',()=>{
 const ctx=setup([member('original','customer')]);const before=JSON.stringify(ctx.api.get());ctx.localStorage.setItem=()=>{throw Error('quota')};
 assert.throws(()=>ctx.v179MergeSharedFront('source-a',incoming));assert.equal(JSON.stringify(ctx.api.get()),before);
});
test('unreachable members and all descendants are excluded without changing sponsors',()=>{
 const ctx=setup();
 const data={people:[...incoming.people,
  {id:'blocked',type:'プロスペ',parentId:'self',status:'appointment-open'},
  {id:'child',parentId:'blocked',status:'ordered'},
  {id:'grandchild',parentId:'child',status:'appointment-set'},
  {id:'later',type:'プロスペ',parentId:'self',status:'next-month'},
  {id:'friend',type:'プロスペ',parentId:'self',status:'befriend'}]};
 for(let i=0;i<3;i++)ctx.v179MergeSharedFront('source-a',data);
 const list=ctx.api.get().members;
 assert.equal(list.length,3);
 for(const id of ['blocked','child','grandchild','later','friend'])assert.ok(!list.some(p=>p.sharedSourcePersonId===id));
 assert.equal(list.find(p=>p.sharedSourcePersonId==='customer').parentId,list.find(p=>p.sharedSourcePersonId==='abo').id);
});
test('updates remove existing excluded copies and their subtree, with a backup',()=>{
 const initial=[member('existing','blocked'),member('duplicate','blocked'),member('child','child','existing'),{id:'local-child',parentId:'child'},member('other','blocked','self',{sharedSourceUserId:'other-source'}),{id:'unrelated',parentId:'self'}];
 const ctx=setup(initial);
 const data={people:[...incoming.people,{id:'blocked',type:'プロスペ',parentId:'self',status:'appointment-open'},{id:'child',parentId:'blocked',status:'ordered'}]};
 ctx.v179MergeSharedFront('source-a',data);
 assert.equal(JSON.parse(ctx.storage.get('business_map_before_front_merge')).state.members.length,initial.length);
 for(let i=0;i<3;i++)ctx.v179MergeSharedFront('source-a',data);
 const list=ctx.api.get().members;
 for(const id of ['existing','duplicate','child','local-child'])assert.ok(!list.some(p=>p.id===id));
 for(const id of ['other','unrelated'])assert.ok(list.some(p=>p.id===id));
 assert.equal(list.length,5);
 assert.ok(list.every(p=>p.parentId==='self'||list.some(parent=>parent.id===p.parentId)));
 // A person made reachable again can be imported normally.
 data.people.find(p=>p.id==='blocked').status='appointment-set';
 ctx.v179MergeSharedFront('source-a',data);
 assert.equal(ctx.api.get().members.length,7);
});
test('latest source parent rescues a person moved out of an excluded subtree',()=>{
 const ctx=setup([member('blocked-local','blocked'),member('customer-local','customer','blocked-local')]);
 ctx.v179MergeSharedFront('source-a',{people:[...incoming.people,{id:'blocked',type:'プロスペ',parentId:'self',status:'appointment-open'}]});
 const list=ctx.api.get().members;
 assert.ok(!list.some(p=>p.id==='blocked-local'));
 assert.equal(list.find(p=>p.id==='customer-local').parentId,list.find(p=>p.sharedSourcePersonId==='abo').id);
});
test('legacy appointment-open status displays the new label',()=>{
 const ctx=setup();
 assert.equal(vm.runInContext("currentStatusLabel({status:'appointment-open'})",ctx),'連絡不通');
});

test('only prospects with the four supported statuses import, and updates remove every newly excluded status',()=>{
 const allowed=['ordered','forecast','appointment-set','prospecting'];
 const rejected=['appointment-open','befriend','next-month','custom','',undefined,'unknown'];
 for(const status of rejected){
  const ctx=setup();
  const data={people:[{id:'self',name:'Front',type:'ABO'},...allowed.map((status,i)=>({id:'p'+i,name:'P'+i,type:'プロスペ',parentId:'self',status}))]};
  ctx.v179MergeSharedFront('source-a',data);assert.equal(ctx.api.get().members.length,5);
  data.people[1].status=status;
  ctx.v179MergeSharedFront('source-a',data);
  assert.equal(ctx.api.get().members.length,4);
  assert.ok(!ctx.api.get().members.some(p=>p.sharedSourcePersonId==='p0'));
  const fresh=setup();fresh.v179MergeSharedFront('source-a',data);assert.equal(fresh.api.get().members.length,4);
 }
});

test('front customers stay under their original sponsor after update and storage reload',()=>{
 const ctx=setup([{id:'my-customer',name:'Mine',type:'カスタマー',parentId:'self',status:'ordered'}]);
 const data={people:[...incoming.people,{id:'direct-customer',name:'Front customer',type:'カスタマー',parentId:'self',status:'forecast'}]};
 for(let i=0;i<3;i++){
  ctx.v179MergeSharedFront('source-a',data);
  ctx.api.set(ctx.api.migrate(JSON.parse(JSON.stringify(ctx.api.get()))));
  const members=ctx.api.get().members;
  const find=id=>members.find(p=>p.sharedSourceUserId==='source-a'&&p.sharedSourcePersonId===id);
  assert.equal(find('direct-customer').parentId,find('self').id);
  assert.equal(find('customer').parentId,find('abo').id);
  assert.equal(members.filter(p=>p.type==='カスタマー'&&p.parentId==='self').map(p=>p.id).join(','),'my-customer');
  assert.equal(members.length,5);
 }
});

test('ABO, customers and retail import regardless of status and return after the old filter removed them',()=>{
 const statuses=['ordered','forecast','appointment-set','prospecting','appointment-open','befriend','next-month','custom','',undefined,'unknown'];
 for(const type of ['ABO','カスタマー','小売']){
  const ctx=setup();const data={people:[{id:'self',name:'Front',type:'ABO'},...statuses.map((status,i)=>({id:'m'+i,name:'Member'+i,parentId:'self',type,status}))]};
  for(let i=0;i<2;i++){ctx.v179MergeSharedFront('source-a',data);assert.equal(ctx.api.get().members.length,statuses.length+1);}
  data.people[1].type='プロスペ';data.people[1].status='next-month';ctx.v179MergeSharedFront('source-a',data);assert.equal(ctx.api.get().members.length,statuses.length);
  data.people[1].type=type;ctx.v179MergeSharedFront('source-a',data);assert.equal(ctx.api.get().members.length,statuses.length+1);
 }
});
