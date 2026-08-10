(function(){
  const VERSION='v1.09';
  function childList(id){ return state.members.filter(x=>x.parentId===id); }
  function buildNode(id,vis,depth){
    const p=id==='self'?state.self:state.members.find(x=>x.id===id);
    if(!p||!vis.has(id)) return '';
    const kids=childList(id).filter(c=>vis.has(c.id));
    return `<div class="v109-node" data-node-id="${id}">${depth===0?'<div class="v109-self-label">自分</div>':''}${renderCard(p)}${kids.length?`<div class="v109-children">${kids.map(c=>buildNode(c.id,vis,depth+1)).join('')}</div>`:''}</div>`;
  }
  function applyTree(){
    const rows=document.getElementById('treeRows');
    if(!rows) return;
    const vis=visibleSet();
    rows.classList.add('v109-tree-root');
    rows.innerHTML=buildNode('self',vis,0) || '<div class="empty-state">表示条件に一致するメンバーがいません</div>';
    rows.querySelectorAll('.member-card').forEach(el=>el.onclick=()=>openModal(el.dataset.id));
    requestAnimationFrame(drawLinesV109);
  }
  function drawLinesV109(){
    const svg=document.getElementById('treeLines');
    const area=document.getElementById('mapCanvasArea');
    const rows=document.getElementById('treeRows');
    if(!svg||!area||!rows) return;
    const rootRect=area.getBoundingClientRect();
    const cards={};
    rows.querySelectorAll('.member-card').forEach(c=>cards[c.dataset.id]=c);
    const w=Math.max(area.scrollWidth,rows.scrollWidth,900), h=Math.max(area.scrollHeight,rows.scrollHeight,400);
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.setAttribute('width',w); svg.setAttribute('height',h);
    let paths='';
    state.members.forEach(ch=>{
      const child=cards[ch.id], parent=cards[ch.parentId||'self']; if(!child||!parent) return;
      const cr=child.getBoundingClientRect(), pr=parent.getBoundingClientRect();
      const x1=pr.left-rootRect.left+pr.width/2, y1=pr.top-rootRect.top+pr.height;
      const x2=cr.left-rootRect.left+cr.width/2, y2=cr.top-rootRect.top;
      const mid=Math.round(y1+(y2-y1)*.48), dir=x2>=x1?1:-1, r=9;
      paths+=`<path d="M ${x1} ${y1} L ${x1} ${mid-r} Q ${x1} ${mid} ${x1+r*dir} ${mid} L ${x2-r*dir} ${mid} Q ${x2} ${mid} ${x2} ${mid+r} L ${x2} ${y2}" fill="none" stroke="#9eb0c8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
      paths+=`<circle cx="${x1}" cy="${y1}" r="2.8" fill="#9eb0c8"/><circle cx="${x2}" cy="${y2}" r="2.8" fill="#9eb0c8"/>`;
    });
    svg.innerHTML=paths;
  }
  function fitCurrent(){
    const area=document.getElementById('mapCanvasArea'), wrap=area?.closest('.map-wrap'); if(!area||!wrap) return;
    area.style.zoom=1; const natural=Math.max(rowsWidth(),900), usable=Math.max(320,wrap.clientWidth-24);
    const z=Math.max(.45,Math.min(1,usable/natural)); area.style.zoom=z;
    const label=document.getElementById('v107ZoomValue'); if(label) label.textContent=Math.round(z*100)+'%';
    requestAnimationFrame(drawLinesV109);
  }
  function rowsWidth(){ const rows=document.getElementById('treeRows'); return rows?rows.scrollWidth:900; }
  function buildExportSurfaceV109(){
    const root=document.getElementById('exportRoot'), s=teamSummary();
    const map=document.getElementById('mapCanvasArea').cloneNode(true);
    map.style.zoom='1'; map.style.transform='none'; map.style.minWidth='0'; map.style.width='auto'; map.style.paddingTop='8px';
    map.querySelectorAll('.member-card').forEach(c=>{c.style.boxShadow='0 4px 12px rgba(31,41,55,.06)';});
    root.innerHTML=`<div class="v109-export-surface"><div class="v109-export-head"><div><div class="v109-export-title">Business Map <span style="font-size:14px;color:#3478f6">${VERSION}</span></div><div class="v109-export-date">${new Date().toLocaleString('ja-JP')}</div></div><div class="v109-export-pills"><span class="v109-export-pill">目標 <b>${fmt(s.teamTarget)}</b></span><span class="v109-export-pill">実績 <b>${fmt(s.teamActual)}</b></span><span class="v109-export-pill">達成率 <b>${s.rate}%</b></span><span class="v109-export-pill">人数 <b>${s.peopleCount}</b></span></div></div><div class="v109-export-map" id="v109ExportMap"></div></div>`;
    document.getElementById('v109ExportMap').appendChild(map);
    return root;
  }
  function wrap(){
    const original=window.renderTree;
    if(typeof original==='function'&&!original.__v109){
      const wrapped=function(){ original.apply(this,arguments); requestAnimationFrame(applyTree); };
      wrapped.__v109=true; window.renderTree=wrapped;
    }
    window.drawLines=drawLinesV109;
    window.buildExportSurface=buildExportSurfaceV109;
    applyTree();
    const fit=document.getElementById('v107ZoomFit'); if(fit) fit.onclick=fitCurrent;
    window.addEventListener('resize',()=>requestAnimationFrame(()=>{drawLinesV109();}));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wrap,{once:true}); else wrap();
})();
