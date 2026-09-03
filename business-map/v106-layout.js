(function(){
  const VERSION='v1.06';
  const CARD_W=250;
  const SIBLING_GAP=42;
  const ROOT_GAP=70;
  const LEFT_PAD=86;
  const TOP_PAD=44;
  const ROW_GAP=205;
  let zoom=1;
  let baseWidth=1040;
  let baseHeight=360;
  let observer=null;
  let scheduled=false;
  let normalizing=false;

  function visSet(){
    try{return visibleSet();}catch(e){return new Set(allPeople().map(x=>x.id));}
  }
  function children(id,vis){return state.members.filter(x=>x.parentId===id&&vis.has(x.id));}
  function roots(vis){
    const out=[];
    if(vis.has('self')) out.push(state.self);
    state.members.forEach(p=>{
      if(!vis.has(p.id)) return;
      const pid=p.parentId||'self';
      if(!vis.has(pid)) out.push(p);
    });
    return out;
  }
  function subtreeWidth(id,vis,memo){
    if(memo[id]!=null) return memo[id];
    const kids=children(id,vis);
    if(!kids.length) return memo[id]=CARD_W;
    const sum=kids.reduce((s,c)=>s+subtreeWidth(c.id,vis,memo),0)+SIBLING_GAP*(kids.length-1);
    return memo[id]=Math.max(CARD_W,sum);
  }
  function assign(id,left,displayDepth,vis,memo,pos){
    const width=subtreeWidth(id,vis,memo);
    const kids=children(id,vis);
    pos[id]={left:left+(width-CARD_W)/2,top:TOP_PAD+displayDepth*ROW_GAP,depth:displayDepth,width};
    if(!kids.length) return;
    const childrenTotal=kids.reduce((s,c)=>s+subtreeWidth(c.id,vis,memo),0)+SIBLING_GAP*(kids.length-1);
    let cursor=left+(width-childrenTotal)/2;
    kids.forEach(c=>{
      assign(c.id,cursor,displayDepth+1,vis,memo,pos);
      cursor+=subtreeWidth(c.id,vis,memo)+SIBLING_GAP;
    });
  }
  function computeLayout(){
    const vis=visSet();
    const rs=roots(vis);
    const memo={};
    const pos={};
    let cursor=LEFT_PAD;
    rs.forEach((r,i)=>{
      assign(r.id,cursor,0,vis,memo,pos);
      cursor+=subtreeWidth(r.id,vis,memo)+(i<rs.length-1?ROOT_GAP:0);
    });
    const maxDepth=Math.max(0,...Object.values(pos).map(p=>p.depth));
    baseWidth=Math.max(1040,Math.ceil(cursor+LEFT_PAD));
    baseHeight=Math.max(360,TOP_PAD+(maxDepth+1)*ROW_GAP+28);
    return {vis,pos,maxDepth};
  }
  function redrawLines(){
    const svg=document.getElementById('treeLines');
    const rows=document.getElementById('treeRows');
    if(!svg||!rows) return;
    const vis=visSet();
    const byId=Object.fromEntries([...rows.querySelectorAll(':scope > .member-card')].map(el=>[el.dataset.id,el]));
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
      const y1=parent.offsetTop+parent.offsetHeight-1;
      const x2=child.offsetLeft+child.offsetWidth/2;
      const y2=child.offsetTop+1;
      const mid=y1+(y2-y1)*0.50;
      paths+=`<path d="M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>`;
    });
    svg.innerHTML=paths;
  }
  function renderStable(){
    if(normalizing) return;
    normalizing=true;
    if(observer) observer.disconnect();
    try{
      const rows=document.getElementById('treeRows');
      const area=document.getElementById('mapCanvasArea');
      if(!rows||!area) return;
      const {vis,pos,maxDepth}=computeLayout();
      area.style.minWidth=baseWidth+'px';
      area.style.width=baseWidth+'px';
      area.style.minHeight=baseHeight+'px';
      rows.style.width=baseWidth+'px';
      rows.style.height=baseHeight+'px';
      let html='';
      for(let d=0;d<=maxDepth;d++) html+=`<div class="v106-level-label" style="top:${Math.max(4,TOP_PAD+d*ROW_GAP-30)}px">${levelName(d)}</div>`;
      allPeople().filter(p=>vis.has(p.id)).forEach(p=>{
        const q=pos[p.id];
        if(!q) return;
        html+=renderCard(p).replace('class="member-card"',`class="member-card" style="left:${Math.round(q.left)}px;top:${Math.round(q.top)}px"`);
      });
      if(!Object.keys(pos).length) html='<div class="empty-state">表示条件に一致するメンバーがいません</div>';
      rows.innerHTML=html;
      rows.querySelectorAll(':scope > .member-card').forEach(el=>el.onclick=()=>openModal(el.dataset.id));
      applyZoom(zoom,false);
      requestAnimationFrame(redrawLines);
    }finally{
      normalizing=false;
      if(observer){const rows=document.getElementById('treeRows'); if(rows) observer.observe(rows,{childList:true,subtree:true});}
    }
  }
  function scheduleStable(){
    if(normalizing||scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{scheduled=false;renderStable();}));
  }
  function zoomSupported(){return 'zoom' in document.documentElement.style;}
  function applyZoom(next,redraw=true){
    zoom=Math.max(.45,Math.min(1.5,Number(next)||1));
    const area=document.getElementById('mapCanvasArea');
    if(!area) return;
    if(zoomSupported()){
      area.style.zoom=zoom;
      area.style.transform='none';
      area.style.marginBottom='0';
      area.style.marginRight='0';
    }else{
      area.style.zoom='';
      area.style.transform=`scale(${zoom})`;
      area.style.transformOrigin='top left';
      area.style.marginBottom=`${-(1-zoom)*baseHeight}px`;
      area.style.marginRight=`${-(1-zoom)*baseWidth}px`;
    }
    const v=document.getElementById('v106ZoomValue');
    if(v) v.textContent=Math.round(zoom*100)+'%';
    if(redraw) requestAnimationFrame(redrawLines);
  }
  function fitZoom(){
    const wrap=document.querySelector('.map-wrap');
    if(!wrap) return;
    const usable=Math.max(320,wrap.clientWidth-28);
    applyZoom(Math.max(.45,Math.min(1,usable/baseWidth)));
    wrap.scrollLeft=0; wrap.scrollTop=0;
  }
  function addZoomControls(){
    document.getElementById('v105ZoomControls')?.remove();
    const controls=document.querySelector('.section .section-head .controls');
    if(!controls||document.getElementById('v106ZoomControls')) return;
    const group=document.createElement('div');
    group.id='v106ZoomControls'; group.className='v106-zoom-controls';
    group.innerHTML='<button type="button" class="btn" id="v106ZoomOut">−</button><span class="v106-zoom-value" id="v106ZoomValue">100%</span><button type="button" class="btn" id="v106ZoomIn">＋</button><button type="button" class="btn v106-fit-btn" id="v106ZoomFit">全体</button>';
    const imageBtn=document.getElementById('mapSaveImageBtn');
    if(imageBtn&&imageBtn.nextSibling) controls.insertBefore(group,imageBtn.nextSibling); else controls.insertBefore(group,controls.firstChild);
    document.getElementById('v106ZoomOut').onclick=()=>applyZoom(zoom-.1);
    document.getElementById('v106ZoomIn').onclick=()=>applyZoom(zoom+.1);
    document.getElementById('v106ZoomFit').onclick=fitZoom;
  }
  function buildExportSurfaceV106(){
    const root=document.getElementById('exportRoot');
    const s=teamSummary();
    const mapClone=document.getElementById('mapCanvasArea').cloneNode(true);
    mapClone.style.zoom='1'; mapClone.style.transform='none'; mapClone.style.margin='0';
    mapClone.style.minWidth=baseWidth+'px'; mapClone.style.width=baseWidth+'px'; mapClone.style.minHeight=baseHeight+'px'; mapClone.style.paddingTop='82px';
    const chips=STATUS_OPTIONS.map(st=>`<span class="v105-export-status"><span style="color:${st.color}">${st.label}</span> ${s.statusCount[st.id]||0}人</span>`).join('');
    root.innerHTML=`<div class="v105-export-surface"><div class="v105-export-head"><div class="v105-export-title">Business Map <span style="font-size:16px;color:#3478f6">${VERSION}</span></div><div class="v105-export-date">保存日時：${new Date().toLocaleString('ja-JP')}</div></div><div class="v105-export-map"><div class="v105-export-info"><div class="v105-export-info-title">チーム情報</div><div class="v105-export-grid"><div class="v105-export-pill"><div class="l">計画PV</div><div class="v">${fmt(s.teamTarget)}</div></div><div class="v105-export-pill"><div class="l">実績PV</div><div class="v">${fmt(s.teamActual)}</div></div><div class="v105-export-pill"><div class="l">達成率</div><div class="v">${s.rate}%</div></div><div class="v105-export-pill"><div class="l">登録人数</div><div class="v">${s.peopleCount}人</div></div><div class="v105-export-pill"><div class="l">ABO</div><div class="v">${s.typeCount['ABO']||0}人</div></div><div class="v105-export-pill"><div class="l">C/P/小売</div><div class="v">${s.typeCount['カスタマー']||0}/${s.typeCount['プロスペ']||0}/${s.typeCount['小売']||0}</div></div></div><div class="v105-export-statuses">${chips}</div></div><div id="v106ExportMap"></div></div></div>`;
    document.getElementById('v106ExportMap').appendChild(mapClone);
    return root;
  }
  function bind(){
    addZoomControls();
    window.drawLines=redrawLines;
    window.buildExportSurface=buildExportSurfaceV106;
    observer=new MutationObserver(scheduleStable);
    const rows=document.getElementById('treeRows');
    if(rows) observer.observe(rows,{childList:true,subtree:true});
    document.getElementById('statusFilter')?.addEventListener('change',scheduleStable);
    document.getElementById('typeFilter')?.addEventListener('change',scheduleStable);
    window.addEventListener('resize',()=>{requestAnimationFrame(redrawLines);});
    renderStable();
  }
  window.v106RenderStable=renderStable;
  window.v106ApplyZoom=applyZoom;
  window.v106FitZoom=fitZoom;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
