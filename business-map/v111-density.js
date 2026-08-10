(function(){
  const VERSION='v1.11';
  let raf=0;

  function directFrontCount(){
    try{return state.members.filter(x=>x.parentId==='self').length;}catch(e){return 0;}
  }

  function densityClass(count){
    if(count>=9) return 'v111-density-4';
    if(count>=7) return 'v111-density-3';
    if(count>=5) return 'v111-density-2';
    return 'v111-density-1';
  }

  function applyDensity(){
    const rows=document.getElementById('treeRows');
    const area=document.getElementById('mapCanvasArea');
    if(!rows||!area) return;
    rows.classList.remove('v111-density-1','v111-density-2','v111-density-3','v111-density-4');
    const count=directFrontCount();
    rows.classList.add(densityClass(count));
    rows.dataset.frontCount=String(count);
    requestAnimationFrame(()=>{
      if(typeof window.drawLines==='function') window.drawLines();
    });
  }

  function fitForFronts(){
    const area=document.getElementById('mapCanvasArea');
    const wrap=area?.closest('.map-wrap');
    const rows=document.getElementById('treeRows');
    if(!area||!wrap||!rows) return;
    area.style.zoom=1;
    const natural=Math.max(rows.scrollWidth,900);
    const usable=Math.max(320,wrap.clientWidth-24);
    const count=directFrontCount();
    let minZoom=.45;
    if(count>=9) minZoom=.42;
    const z=Math.max(minZoom,Math.min(1,usable/natural));
    area.style.zoom=z;
    const label=document.getElementById('v107ZoomValue');
    if(label) label.textContent=Math.round(z*100)+'%';
    requestAnimationFrame(()=>{ if(typeof window.drawLines==='function') window.drawLines(); });
  }

  function refresh(autoFit=false){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      applyDensity();
      requestAnimationFrame(()=>{
        if(autoFit) fitForFronts();
      });
    });
  }

  function wrapRender(){
    const original=window.renderTree;
    if(typeof original!=='function'||original.__v111) return;
    const wrapped=function(){
      original.apply(this,arguments);
      requestAnimationFrame(()=>requestAnimationFrame(()=>refresh(true)));
    };
    wrapped.__v111=true;
    window.renderTree=wrapped;
  }

  function patchFitButton(){
    const fit=document.getElementById('v107ZoomFit');
    if(fit) fit.onclick=fitForFronts;
  }

  function patchExport(){
    const original=window.buildExportSurface;
    if(typeof original!=='function'||original.__v111) return;
    const wrapped=function(){
      applyDensity();
      const root=original.apply(this,arguments);
      const clonedRows=root?.querySelector('#treeRows');
      if(clonedRows){
        clonedRows.classList.remove('v111-density-1','v111-density-2','v111-density-3','v111-density-4');
        clonedRows.classList.add(densityClass(directFrontCount()));
        clonedRows.dataset.frontCount=String(directFrontCount());
      }
      return root;
    };
    wrapped.__v111=true;
    window.buildExportSurface=wrapped;
  }

  function bind(){
    wrapRender();
    patchFitButton();
    patchExport();
    refresh(true);
    window.addEventListener('resize',()=>refresh(true));
  }

  window.v111ApplyDensity=applyDensity;
  window.v111FitForFronts=fitForFronts;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
