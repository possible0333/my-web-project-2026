const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

// Exercise the actual zoom handlers with a scale set by the separate auto-fit module.
const elements={mapCanvasArea:{style:{zoom:.45}},v107ZoomValue:{textContent:''},v107ZoomOut:{},v107ZoomIn:{},v107ZoomFit:{}};
const controls={insertBefore(el){elements.v107ZoomControls=el}};
const document={readyState:'loading',addEventListener(){},getElementById:id=>elements[id],querySelector:()=>controls,createElement:()=>({})};
const context={document,window:{},requestAnimationFrame(){}};
vm.createContext(context);
vm.runInContext(read('v107-stable.js').replace('window.v107ApplyStableLayout=applyStableLayout;','window.testAddControls=addControls;'),context);
context.window.testAddControls();
elements.v107ZoomIn.onclick();
assert.equal(elements.v107ZoomValue.textContent,'55%');
elements.v107ZoomOut.onclick();
assert.equal(elements.v107ZoomValue.textContent,'45%');
elements.v107ZoomOut.onclick();
assert.equal(elements.v107ZoomValue.textContent,'35%');
elements.mapCanvasArea.style.zoom=.42;
elements.v107ZoomIn.onclick();
assert.equal(elements.v107ZoomValue.textContent,'52%');
for(let i=0;i<30;i++)elements.v107ZoomOut.onclick();
assert.equal(elements.v107ZoomValue.textContent,'10%');

// Check that schedule modals participate in the same background-scroll lock.
let selector='';
const shellContext={window:{},document:{readyState:'loading',addEventListener(){},querySelector(s){selector=s;return {};}}};
vm.createContext(shellContext);
vm.runInContext(read('js/ui/product-shell.js').replace('let mapObserver=null;','let mapObserver=null;window.testModalOpen=modalOpen;'),shellContext);
assert.equal(shellContext.window.testModalOpen(),true);
assert(selector.includes('.v156-modal.open'));

const css=read('mobile-polish.css');
assert.match(css,/#prospectActivityNote\[hidden\]\{display:none!important\}/);
assert.match(css,/\.app \.map-overview-header\{[^}]*min-width:0/);
assert.match(css,/\.app \.map-favorites-footer \.v195-favorites-list\{[^}]*overflow-x:auto/);

// Chronological rendering must be stable and must not mutate saved schedule order.
const schedule=read('v156-schedule.js');
const sortFunction=schedule.slice(schedule.indexOf('  function chronologicalPlans('),schedule.indexOf('  function load()'));
const sorter={};vm.createContext(sorter);vm.runInContext(sortFunction,sorter);
const input=[{start:'18:00',id:1},{start:'',id:2},{start:'09:00',id:3},{start:'09:00',id:4}];
assert.deepEqual(Array.from(sorter.chronologicalPlans(input),p=>p.id),[3,4,1,2]);
assert.deepEqual(input.map(p=>p.id),[1,2,3,4]);
console.log('Zoom after auto-fit, modal scroll lock, mobile scope, hidden note, schedule ordering: passed');
