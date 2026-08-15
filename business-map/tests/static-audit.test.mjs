import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');

test('the public entrypoint loads the central version first',async()=>{
  const html=await read('index.html');
  assert.match(html,/<script src="config\/version\.js\?v=1\.44"><\/script>/);
  assert.equal((html.match(/Business Map v1\.44/g)||[]).length,1);
  assert.match(html,/css\/product-ui\.css\?v=1\.44/);
  assert.match(html,/css\/share-controls\.css\?v=1\.44/);
  assert.match(html,/js\/ui\/product-shell\.js\?v=1\.44/);
});

test('PNG export uses compact direct-customer grids',async()=>{
  for(const file of ['v130-mobile-export.js','v135-export.js']){
    const source=await read(file);
    assert.match(source,/count<=3\?count:count<=6\?3:4/);
    assert.match(source,/grid-template-columns/);
  }
});

test('mobile and export modules share the central version',async()=>{
  for(const file of ['v103-app-1.js','v130-mobile-export.js','v135-export.js','v136-share.js']){
    const source=await read(file);
    assert.match(source,/BUSINESS_MAP_CONFIG\?\.version/);
  }
});

test('gallery deletion is owner-scoped and removes storage objects',async()=>{
  const source=await read('v136-share.js');
  assert.match(source,/x\.user_id===s\.user\.id/);
  assert.match(source,/storage\.from\(BUCKET\)\.remove\(paths\)/);
  assert.match(source,/\.delete\(\)\.in\('user_id'/);
  assert.match(source,/id="v136DeleteSelected"/);
});

test('new sponsor choices exclude customer and retail members',async()=>{
  const source=await read('v103-app-2.js');
  assert.match(source,/p\.type==='ABO' \|\| p\.type==='プロスペ'/);
  assert.match(source,/p\.id===currentParent/);
});

test('product shell exposes non-destructive diagnostics',async()=>{
  const source=await read('js/ui/product-shell.js');
  assert.match(source,/window\.businessMapDiagnostics=diagnostics/);
  assert.match(source,/duplicateIds/);
  assert.match(source,/orphanParents/);
  assert.match(source,/horizontalOverflow/);
});

test('runtime modules use the central version',async()=>{
  for(const file of ['v132-grpv-terminology.js','v135-export.js','v136-share.js']){
    const source=await read(file);
    assert.match(source,/BUSINESS_MAP_CONFIG\?\.version/);
  }
});

test('legacy localStorage keys remain available',async()=>{
  const source=await read('v103-app-1.js');
  for(const key of ['business_map_v1_03','business_map_v1_02','business_map_v1_01','business_map_v1']){
    assert.match(source,new RegExp(key));
  }
});

test('hierarchy traversal guards duplicate and cyclic ids',async()=>{
  const source=await read('v103-app-1.js');
  assert.match(source,/const visited=new Set\(\[id\]\)/);
  assert.match(source,/seenIds\.has\(p\.id\)/);
});

test('migration repairs cycles and GrPV counts every person once',async()=>{
  const source=await read('v103-app-1.js');
  const sandbox={console,localStorage:{getItem(){return null},setItem(){}}};
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__api={migrate,groupPvFor,descendants,setState:v=>state=v};`,sandbox);
  const migrated=sandbox.__api.migrate({
    self:{id:'self',name:'Owner',actual:10},
    members:[
      {id:'a',name:'A',parentId:'b',type:'ABO',actual:20},
      {id:'b',name:'B',parentId:'a',type:'ABO',actual:30},
      {id:'b',name:'duplicate',parentId:'self',type:'ABO',actual:40},
      {id:'orphan',name:'Orphan',parentId:'missing',type:'ABO',actual:50}
    ]
  });
  assert.equal(new Set(migrated.members.map(x=>x.id)).size,migrated.members.length);
  assert.ok(migrated.members.every(x=>x.parentId==='self'||migrated.members.some(p=>p.id===x.parentId)));
  sandbox.__api.setState(migrated);
  assert.equal(sandbox.__api.groupPvFor('self').actual,150);
  assert.equal(new Set(sandbox.__api.descendants('self').map(x=>x.id)).size,4);
});
