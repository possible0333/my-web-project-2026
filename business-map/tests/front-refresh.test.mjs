import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../v136-share.js',import.meta.url),'utf8');
test('front button retrieves the selected upload again and aborts on a missing or failed read',async()=>{
  const merged=[],ids=[];
  const oldMap={people:[{name:'old'}]},newMap={people:[{name:'new'}]};
  let response={data:{user_id:'front',map_data:newMap}};
  const query={select(){return this},eq(column,id){assert.equal(column,'user_id');ids.push(id);return this},async maybeSingle(){return response}};
  const ctx={client:{from(){return query}},oldMap,confirm:()=>true,alert(){},console:{error(){}},document:{readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},v179MergeSharedFront(id,map){merged.push(map);return {}}};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(source.replace('  let frontBusy=false;',`  currentItems=[{id:'front',mapData:window.oldMap}];supa={client:window.client};window.press=addSharedFront;let frontBusy=false;`),ctx);
  await ctx.press('front');response={data:null};await ctx.press('front');response={error:new Error('offline')};await ctx.press('front');
  assert.deepEqual(ids,['front','front','front']);assert.deepEqual(merged,[newMap]);
});

