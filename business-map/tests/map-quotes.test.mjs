import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const dataScript=await readFile(new URL('map-quotes-data.js',root),'utf8');
const script=await readFile(new URL('map-quotes.js',root),'utf8');
function setup(storage=new Map(),random=()=>0,blocked=false){
  const context={Math:Object.assign(Object.create(Math),{random}),localStorage:{getItem(k){if(blocked)throw Error();return storage.get(k)},setItem(k,v){if(blocked)throw Error();storage.set(k,v)}}};
  context.window=context;vm.createContext(context);vm.runInContext(dataScript,context);vm.runInContext(script,context);return context;
}
test('300 unique source-linked records with explicit summary labels',()=>{
  const {BUSINESS_MAP_QUOTES:qs}=setup();
  assert.equal(qs.length,300);assert.equal(new Set(qs.map(q=>q.id)).size,300);
  assert.equal(new Set(qs.map(q=>q.text)).size,300);
  assert.equal(new Set(qs.map(q=>q.author)).size,54);
  assert.equal(qs.filter(q=>q.kind==='発言要旨').length,278);
  for(const q of qs){assert.equal(new URL(q.sourceUrl).protocol,'https:');assert.ok(q.text&&q.author&&q.sourceTitle&&q.context);}
});
test('stable within a page, different on reopening, unrelated storage unchanged',()=>{
  const store=new Map([['business_map_v1_03','original member data']]);
  const a=setup(store),first=a.MapQuotes.current();
  assert.equal(a.MapQuotes.current(),first);
  const b=setup(store);assert.notEqual(b.MapQuotes.current().id,first.id);
  assert.equal(store.get('business_map_v1_03'),'original member data');
});
test('all 300 candidates can be selected; disabled storage does not break the map',()=>{
  const ids=new Set();for(let i=0;i<300;i++)ids.add(setup(new Map(),()=>(i+.5)/300).MapQuotes.current().id);
  assert.equal(ids.size,300);assert.ok(setup(new Map(),()=>.99,true).MapQuotes.current());
});
test('missing data degrades to no quote',()=>{
  const ctx=setup();ctx.BUSINESS_MAP_QUOTES=[];assert.equal(ctx.MapQuotes.current(),null);
});
test('safe text rendering, single mount, no second random choice during export',()=>{
  const ctx=setup();
  const node=()=>({children:[],dataset:{},setAttribute(){},appendChild(n){this.children.push(n)},prepend(n){this.children.unshift(n)},querySelector(){return this.children.find(n=>n.className==='map-quote-panel')}});
  ctx.document={createElement:node};const stage=node();
  ctx.BUSINESS_MAP_QUOTES=[{id:'test',text:'<img onerror=bad>',author:'Test',kind:'発言要旨',sourceUrl:'https://example.com/',sourceTitle:'Source',context:'Context'}];
  ctx.MapQuotes.mount(stage);ctx.MapQuotes.mount(stage);
  assert.equal(stage.children.length,1);
  const panel=stage.children[0];assert.equal(panel.children[1].textContent,'<img onerror=bad>');
  assert.ok(panel.children.some(n=>n.textContent==='発言要旨（短く要約）'));
  assert.equal(panel.children.at(-1).rel,'noopener noreferrer');
});
test('data and component load before map renderer; export clones the complete stage',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8');
  assert.ok(html.indexOf('map-quotes-data.js')<html.indexOf('map-quotes.js'));
  assert.ok(html.indexOf('map-quotes.js')<html.indexOf('v127-direct-zone.js'));
  assert.match(await readFile(new URL('v127-direct-zone.js',root),'utf8'),/MapQuotes\?\.mount\(stage\)/);
  assert.match(await readFile(new URL('v135-export.js',root),'utf8'),/overview\?overview\.cloneNode\(true\)/);
});
