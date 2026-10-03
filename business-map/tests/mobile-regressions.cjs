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
assert.doesNotMatch(css,/\.map-top-stage[^}]*grid-template-columns:minmax\(0,1fr\)/);
assert.doesNotMatch(css,/#nextMonthProspects[^}]*grid-row:1/);
assert.match(css,/touch-action:pan-x pan-y/);

// Chronological rendering must be stable and must not mutate saved schedule order.
const schedule=read('v156-schedule.js');
const sortFunction=schedule.slice(schedule.indexOf('  function chronologicalPlans('),schedule.indexOf('  function load()'));
const sorter={};vm.createContext(sorter);vm.runInContext(sortFunction,sorter);
const input=[{start:'18:00',id:1},{start:'',id:2},{start:'09:00',id:3},{start:'09:00',id:4}];
assert.deepEqual(Array.from(sorter.chronologicalPlans(input),p=>p.id),[3,4,1,2]);
assert.deepEqual(input.map(p=>p.id),[1,2,3,4]);
console.log('Zoom after auto-fit, modal scroll lock, mobile scope, hidden note, schedule ordering: passed');

// The next-month dock tracks the whole visible map, including wide and zoomed trees.
const layout=read('v127-direct-zone.js');
const sync=layout.slice(layout.indexOf('  function syncOverviewWidth(){'),layout.indexOf('  function renderMapHeader(){'));
let canvasWidth=3000,networkWidth=3600,mobile=false;
const stage={style:{}};
const wrap={clientWidth:1300};
const area={getBoundingClientRect:()=>({width:canvasWidth})};
const rows={querySelector:()=>({getBoundingClientRect:()=>({width:networkWidth})})};
const layoutContext={window:{},document:{getElementById:id=>({mapTopStage:stage,mapCanvasArea:area,treeRows:rows})[id],querySelector:()=>wrap},getComputedStyle:()=>({paddingLeft:'14',paddingRight:'14'}),cancelAnimationFrame(){},requestAnimationFrame(fn){fn();return 1;}};
vm.createContext(layoutContext);vm.runInContext('let overviewLayoutFrame=0;'+sync,layoutContext);
layoutContext.syncOverviewWidth();assert.equal(stage.style.width,'3600px');
canvasWidth=1000;networkWidth=900;
layoutContext.syncOverviewWidth();assert.equal(stage.style.width,'1272px');
wrap.clientWidth=390;layoutContext.syncOverviewWidth();assert.equal(stage.style.width,'1120px');
assert.match(layout,/if\(next\)stage\.appendChild\(next\)/);
assert.match(read('v135-export.js'),/getElementById\('mapTopStage'\)/);
console.log('Independent right-edge dock: wide map, shrink, mobile and export source: passed');
