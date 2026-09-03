(function(){
  const VERSION='v1.05';
  const CARD_W=250;
  const COL_GAP=34;
  const UNIT=CARD_W+COL_GAP;
  const LEFT_PAD=72;
  const TOP_PAD=42;
  const ROW_GAP=205;
  let mapZoom=1;
  let baseWidth=1040;
  let baseHeight=360;

  function directVisibleChildren(id, vis){
    return state.members.filter(x=>x.parentId===id && vis.has(x.id));
  }

  function visibleRoots(vis){
    const roots=[];
    if(vis.has('self')) roots.push(state.self);
    state.members.forEach(p=>{
      if(!vis.has(p.id)) return;
      const pid=p.parentId||'self';
      if(!vis.has(pid)) roots.push(p);
    });
    return roots;
  }

  function measure(id, vis, memo){
    if(memo[id]) return memo[id];
    const kids=directVisibleChildren(id,vis);
    if(!kids.length) return memo[id]=1;
    return memo[id]=kids.reduce((sum,c)=>sum+measure(c.id,vis,memo),0);
  }

  function assignNode(id, startUnit, vis, memo, positions){
    const kids=directVisibleChildren(id,vis);
    const span=measure(id,vis,memo);
    let centerUnit=startUnit+span/2;
    if(kids.length){
      let cursor=startUnit;
      const childCenters=[];
      kids.forEach(c=>{
        const childSpan=measure(c.id,vis,memo);
        assignNode(c.id,cursor,vis,memo,positions);
        childCenters.push(positions[c.id].centerUnit);
        cursor+=childSpan;
      });
      centerUnit=(childCenters[0]+childCenters[childCenters.length-1])/2;
    }
    positions[id]={centerUnit,depth:depthOf(id)};
  }

  function layoutTree(){
    const vis=visibleSet();
    const roots=visibleRoots(vis);
    const memo={};
    const positions={};
    let cursor=0;
    roots.forEach(r=>{
      assignNode(r.id,cursor,vis,memo,positions);
      cursor+=measure(r.id,vis,memo)+0.35;
    });
    const maxDepth=Math.max(0,...Object.values(positions).map(x=>x.depth));
    baseWidth=Math.max(1040,Math.ceil(cursor*UNIT+LEFT_PAD*2));
    baseHeight=Math.max(340,TOP_PAD+(maxDepth+1)*ROW_GAP+30);
    return {vis,positions,maxDepth};
  }

  function renderTreeV105(){
    const rows=$('treeRows');
    const area=$('mapCanvasArea');
    const {vis,positions,maxDepth}=layoutTree();
    area.style.minWidth=baseWidth+'px';
    area.style.width=baseWidth+'px';
    area.style.minHeight=baseHeight+'px';
    rows.style.width=baseWidth+'px';
    rows.style.height=baseHeight+'px';
    let html='';
    for(let d=0;d<=maxDepth;d++){
      const y=TOP_PAD+d*ROW_GAP;
      html+=`<div class="v105-level-label" style="top:${Math.max(4,y-30)}px">${levelName(d)}</div>`;
    }
    const people=allPeople().filter(p=>vis.has(p.id));
    people.forEach(p=>{
      const pos=positions[p.id];
      if(!pos) return;
      const x=LEFT_PAD+pos.centerUnit*UNIT-CARD_W/2;
      const y=TOP_PAD+pos.depth*ROW_GAP;
      html+=renderCard(p).replace('class="member-card"',`class="member-card" style="left:${Math.round(x)}px;top:${Math.round(y)}px"`);
    });
    if(!people.length) html='<div class="empty-state">表示条件に一致するメンバーがいません</div>';
    rows.innerHTML=html;
    rows.querySelectorAll('.member-card').forEach(el=>el.onclick=()=>openModal(el.dataset.id));
    applyZoom(mapZoom,false);
    requestAnimationFrame(drawLinesV105);
  }

  function drawLinesV105(){
    const svg=$('treeLines');
    const rows=$('treeRows');
    if(!svg||!rows) return;
    const vis=visibleSet();
    const byId=Object.fromEntries([...rows.querySelectorAll('.member-card')].map(el=>[el.dataset.id,el]));
    svg.setAttribute('viewBox',`0 0 ${baseWidth} ${baseHeight}`);
    svg.setAttribute('width',baseWidth);
    svg.setAttribute('height',baseHeight);
    svg.style.width=baseWidth+'px';
    svg.style.height=baseHeight+'px';
    let paths='';
    state.members.forEach(p=>{
      if(!vis.has(p.id)) return;
      const child=byId[p.id];
      const parent=byId[p.parentId||'self'];
      if(!child||!parent) return;
      const x1=parent.offsetLeft+parent.offsetWidth/2;
      const y1=parent.offsetTop+parent.offsetHeight-2;
      const x2=child.offsetLeft+child.offsetWidth/2;
      const y2=child.offsetTop+2;
      const mid=y1+(y2-y1)*0.52;
      paths+=`<path d="M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>`;
    });
    svg.innerHTML=paths;
  }

  function zoomSupported(){
    return 'zoom' in document.documentElement.style;
  }

  function applyZoom(next, redraw=true){
    mapZoom=Math.max(0.45,Math.min(1.5,Number(next)||1));
    const area=$('mapCanvasArea');
    const wrap=area?.closest('.map-wrap');
    if(!area||!wrap) return;
    if(zoomSupported()){
      area.style.zoom=mapZoom;
      area.style.transform='none';
      area.style.marginBottom='0';
      area.style.marginRight='0';
    }else{
      area.style.zoom='';
      area.style.transform=`scale(${mapZoom})`;
      area.style.transformOrigin='top left';
      area.style.marginBottom=`${-(1-mapZoom)*baseHeight}px`;
      area.style.marginRight=`${-(1-mapZoom)*baseWidth}px`;
    }
    const value=document.getElementById('v105ZoomValue');
    if(value) value.textContent=Math.round(mapZoom*100)+'%';
    if(redraw) requestAnimationFrame(drawLinesV105);
  }

  function fitZoom(){
    const wrap=document.querySelector('.map-wrap');
    if(!wrap) return;
    const usable=Math.max(320,wrap.clientWidth-30);
    applyZoom(Math.max(0.45,Math.min(1,usable/baseWidth)));
    wrap.scrollLeft=0;
    wrap.scrollTop=0;
  }

  function addZoomControls(){
    const controls=document.querySelector('.section .section-head .controls');
    if(!controls||document.getElementById('v105ZoomControls')) return;
    const group=document.createElement('div');
    group.id='v105ZoomControls';
    group.className='v105-zoom-controls';
    group.innerHTML=`<button type="button" class="btn" id="v105ZoomOut">−</button><span class="v105-zoom-value" id="v105ZoomValue">100%</span><button type="button" class="btn" id="v105ZoomIn">＋</button><button type="button" class="btn v105-fit-btn" id="v105ZoomFit">全体</button>`;
    const imageBtn=document.getElementById('mapSaveImageBtn');
    if(imageBtn&&imageBtn.nextSibling) controls.insertBefore(group,imageBtn.nextSibling);
    else controls.insertBefore(group,controls.firstChild);
    document.getElementById('v105ZoomOut').onclick=()=>applyZoom(mapZoom-0.1);
    document.getElementById('v105ZoomIn').onclick=()=>applyZoom(mapZoom+0.1);
    document.getElementById('v105ZoomFit').onclick=fitZoom;
  }

  function buildExportSurfaceV105(){
    const root=$('exportRoot');
    const s=teamSummary();
    const mapClone=$('mapCanvasArea').cloneNode(true);
    mapClone.style.zoom='1';
    mapClone.style.transform='none';
    mapClone.style.margin='0';
    mapClone.style.minWidth=baseWidth+'px';
    mapClone.style.width=baseWidth+'px';
    mapClone.style.minHeight=baseHeight+'px';
    mapClone.style.paddingTop='82px';
    const chips=STATUS_OPTIONS.map(st=>`<span class="v105-export-status"><span style="color:${st.color}">${st.label}</span> ${s.statusCount[st.id]||0}人</span>`).join('');
    root.innerHTML=`<div class="v105-export-surface"><div class="v105-export-head"><div class="v105-export-title">Business Map <span style="font-size:16px;color:#3478f6">${VERSION}</span></div><div class="v105-export-date">保存日時：${new Date().toLocaleString('ja-JP')}</div></div><div class="v105-export-map"><div class="v105-export-info"><div class="v105-export-info-title">チーム情報</div><div class="v105-export-grid"><div class="v105-export-pill"><div class="l">計画PV</div><div class="v">${fmt(s.teamTarget)}</div></div><div class="v105-export-pill"><div class="l">実績PV</div><div class="v">${fmt(s.teamActual)}</div></div><div class="v105-export-pill"><div class="l">達成率</div><div class="v">${s.rate}%</div></div><div class="v105-export-pill"><div class="l">登録人数</div><div class="v">${s.peopleCount}人</div></div><div class="v105-export-pill"><div class="l">ABO</div><div class="v">${s.typeCount['ABO']||0}人</div></div><div class="v105-export-pill"><div class="l">C/P/小売</div><div class="v">${s.typeCount['カスタマー']||0}/${s.typeCount['プロスペ']||0}/${s.typeCount['小売']||0}</div></div></div><div class="v105-export-statuses">${chips}</div></div><div id="v105ExportMap"></div></div></div>`;
    document.getElementById('v105ExportMap').appendChild(mapClone);
    return root;
  }

  function bind(){
    addZoomControls();
    window.renderTree=renderTreeV105;
    window.drawLines=drawLinesV105;
    window.buildExportSurface=buildExportSurfaceV105;
    try{ renderTreeV105(); }catch(e){ console.error('v1.05 layout init',e); }
    window.addEventListener('resize',()=>{ requestAnimationFrame(drawLinesV105); });
  }

  window.v105ApplyZoom=applyZoom;
  window.v105FitZoom=fitZoom;
  window.drawLinesV105=drawLinesV105;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
