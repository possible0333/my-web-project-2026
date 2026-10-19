import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const code=await readFile(new URL('focus-review.js',root),'utf8');
const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
const api=ctx.FocusReview;
const now=new Date('2026-10-19T10:00:00+09:00');
test('JST Monday boundary and year boundary',()=>{
 assert.equal(api.period(new Date('2026-10-18T14:59:59Z')).key,'2026-10/2026-10-12');
 assert.equal(api.period(new Date('2026-10-18T15:00:00Z')).key,'2026-10/2026-10-19');
 assert.equal(api.period(new Date('2027-01-01T00:00:00+09:00')).key,'2027-01/2026-12-28');
});
test('unanswered, negative answers, blanks and changed goals',()=>{
 const p={focus1:'行動',focus2:'学ぶ'};
 assert.equal(api.assess(p,now).needed,true);
 p.focusReview={period:api.period(now).key,items:[{text:'行動',answer:'yes'},{text:'学ぶ',answer:'no'}]};
 assert.equal(api.assess(p,now).needed,false);
 assert.equal(api.assess(p,now).count,2);
 p.focus2='別の目標';assert.equal(api.assess(p,now).needed,true);
 assert.equal(api.assess({},now).needed,false);
});
test('next week and month require fresh scoring; malformed data stays unscored',()=>{
 const p={focus1:'行動',focusReview:{period:api.period(now).key,items:[{text:'行動',answer:'yes'}]}};
 assert.equal(api.assess(p,new Date('2026-10-26T00:00:00+09:00')).needed,true);
 p.focusReview.period=api.period(new Date('2026-10-31T00:00:00+09:00')).key;
 assert.equal(api.assess(p,new Date('2026-11-01T00:00:00+09:00')).needed,true);
 p.focusReview={period:api.period(now).key,items:[{text:'行動',answer:'bad'}]};
 assert.equal(api.assess(p,now).needed,true);
});
test('migration and shared JSON conversion preserve review data',async()=>{
 const core=await readFile(new URL('v103-app-1.js',root),'utf8');
 const app=await readFile(new URL('v103-app-2.js',root),'utf8');
 const share=await readFile(new URL('v136-share.js',root),'utf8');
 ctx.localStorage={getItem:()=>null};ctx.deadlineInfo=()=>({raw:''});
 vm.runInContext(core+'\nthis.migration=migrate;',ctx);
 vm.runInContext(app.slice(app.indexOf('function operationalMapToState('),app.indexOf('function chooseGroupMap(')),ctx);
 vm.runInContext(share.slice(share.indexOf('  function sharedPerson('),share.indexOf('  function buildOperationalMapData(')),ctx);
 const p={id:'self',name:'Test',focus1:'行動',focusReview:{period:api.period(now).key,items:[{text:'行動',answer:'no'}]}};
 const migrated=ctx.migration({self:p,members:[]});
 const exported=ctx.sharedPerson(migrated.self);
 const restored=ctx.operationalMapToState({people:[exported]});
 assert.equal(api.assess(restored.self,now).needed,false);
 assert.equal(restored.self.focusReview.items[0].answer,'no');
});
