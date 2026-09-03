(function(){
  const VERSION='v1.07';
  let zoom=1;

  function applyStableLayout(){
    const rows=document.getElementById('treeRows');
    const area=document.getElementById('mapCanvasArea');
    if(!rows||!area) return;
    rows.style.position='relative';
    rows.style.width='auto';
    rows.style.height='auto';
    rows.querySelectorAll('.member-card').forEach(card=>{
      card.style.position='relative';
      card.style.left='auto';
      card.style.top='auto';
      card.style.margin='0';
    });
    rows.querySelectorAll('.level').forEach(level=>{
      level.style.display='flex';
      level.style.justifyContent='center';
      level.style.alignItems='flex-start';
      level.style.gap='16px';
      level.style.flexWrap='wrap';
      level.style.position='relative';
      level.style.minHeight='160px';
      level.style.padding='30px 8px 24px';
    });
    requestAnimationFrame(()=>{ if(typeof window.drawLines==='function') window.drawLines(); });
  }

  function applyZoom(next){
    zoom=Math.max(.5,Math.min(1.5,Number(next)||1));
    const area=document.getElementById('mapCanvasArea');
    if(!area) return;
    area.style.zoom=zoom;
    const value=document.getElementById('v107ZoomValue');
    if(value) value.textContent=Math.round(zoom*100)+'%';
    requestAnimationFrame(()=>{ if(typeof window.drawLines==='function') window.drawLines(); });
  }

  function fitZoom(){
    const area=document.getElementById('mapCanvasArea');
    const wrap=area?.closest('.map-wrap');
    if(!area||!wrap) return;
    area.style.zoom=1;
    const natural=Math.max(area.scrollWidth,920);
    const usable=Math.max(320,wrap.clientWidth-20);
    applyZoom(Math.max(.5,Math.min(1,usable/natural)));
    wrap.scrollLeft=0; wrap.scrollTop=0;
  }

  function addControls(){
    const controls=document.querySelector('.section .section-head .controls');
    if(!controls||document.getElementById('v107ZoomControls')) return;
    const group=document.createElement('div');
    group.id='v107ZoomControls';
    group.className='v107-zoom-controls';
    group.innerHTML='<button type="button" class="btn" id="v107ZoomOut">−</button><span class="v107-zoom-value" id="v107ZoomValue">100%</span><button type="button" class="btn" id="v107ZoomIn">＋</button><button type="button" class="btn" id="v107ZoomFit">全体</button>';
    const imageBtn=document.getElementById('mapSaveImageBtn');
    if(imageBtn&&imageBtn.nextSibling) controls.insertBefore(group,imageBtn.nextSibling); else controls.insertBefore(group,controls.firstChild);
    document.getElementById('v107ZoomOut').onclick=()=>applyZoom(zoom-.1);
    document.getElementById('v107ZoomIn').onclick=()=>applyZoom(zoom+.1);
    document.getElementById('v107ZoomFit').onclick=fitZoom;
  }

  function buildExportSurfaceV107(){
    const root=document.getElementById('exportRoot');
    const s=teamSummary();
    const mapClone=document.getElementById('mapCanvasArea').cloneNode(true);
    mapClone.style.zoom='1';
    mapClone.style.transform='none';
    mapClone.style.width='100%';
    mapClone.style.minWidth='1040px';
    mapClone.style.paddingTop='80px';
    mapClone.querySelectorAll('.member-card').forEach(card=>{card.style.position='relative';card.style.left='auto';card.style.top='auto';});
    mapClone.querySelectorAll('.level').forEach(level=>{level.style.display='flex';level.style.justifyContent='center';level.style.gap='16px';level.style.flexWrap='wrap';level.style.position='relative';});
    const chips=STATUS_OPTIONS.map(st=>`<span class="v107-export-status"><span style="color:${st.color}">${st.label}</span> ${s.statusCount[st.id]||0}人</span>`).join('');
    root.innerHTML=`<div class="v107-export-surface"><div class="v107-export-head"><div class="v107-export-title">Business Map <span style="font-size:16px;color:#3478f6">${VERSION}</span></div><div class="v107-export-date">保存日時：${new Date().toLocaleString('ja-JP')}</div></div><div class="v107-export-map"><div class="v107-export-info"><div class="v107-export-grid"><div class="v107-export-pill"><div class="l">計画PV</div><div class="v">${fmt(s.teamTarget)}</div></div><div class="v107-export-pill"><div class="l">実績PV</div><div class="v">${fmt(s.teamActual)}</div></div><div class="v107-export-pill"><div class="l">達成率</div><div class="v">${s.rate}%</div></div><div class="v107-export-pill"><div class="l">登録人数</div><div class="v">${s.peopleCount}人</div></div><div class="v107-export-pill"><div class="l">ABO</div><div class="v">${s.typeCount['ABO']||0}人</div></div><div class="v107-export-pill"><div class="l">C/P/小売</div><div class="v">${s.typeCount['カスタマー']||0}/${s.typeCount['プロスペ']||0}/${s.typeCount['小売']||0}</div></div></div><div class="v107-export-statuses">${chips}</div></div><div id="v107ExportMap"></div></div></div>`;
    document.getElementById('v107ExportMap').appendChild(mapClone);
    return root;
  }

  function wrapRender(){
    const original=window.renderTree;
    if(typeof original!=='function'||original.__v107) return;
    const wrapped=function(){
      original.apply(this,arguments);
      requestAnimationFrame(applyStableLayout);
    };
    wrapped.__v107=true;
    window.renderTree=wrapped;
  }

  function bind(){
    addControls();
    wrapRender();
    window.buildExportSurface=buildExportSurfaceV107;
    applyStableLayout();
    window.addEventListener('resize',()=>{applyStableLayout();});
  }

  window.v107ApplyStableLayout=applyStableLayout;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
