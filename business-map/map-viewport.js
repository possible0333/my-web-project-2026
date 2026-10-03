/* One coordinate system for the overview, network, products and legend. */
(function(){
  // Start at 100%. Automatic fit is opt-in through the 「全体」 button.
  let manual=true,frame=0,pinch=null,suppressClickUntil=0;
  const byId=id=>document.getElementById(id);
  const current=()=>Number(byId('mapCanvasArea')?.style.zoom)||1;
  const clamp=value=>Math.max(.4,Math.min(1.5,Number.isFinite(Number(value))?Number(value):1));
  function metrics(){
    const wrap=document.querySelector('.map-wrap'),area=byId('mapCanvasArea'),rows=byId('treeRows');
    if(!wrap||!area||!rows||!wrap.clientWidth)return null;
    const style=getComputedStyle(wrap);
    const available=Math.max(1,wrap.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0));
    const network=rows.querySelector('.v127-network')||rows;
    // Measure content, not the canvas/SVG, which retain the previous layout width.
    const natural=Math.ceil(Math.max(1120,network.scrollWidth+16,network.getBoundingClientRect().width/current()+16));
    return {wrap,area,available,natural};
  }
  function syncLayout(){
    const m=metrics();if(!m)return;
    const zoom=current(),width=Math.ceil(Math.max(m.natural,m.available/zoom))+'px';
    let changed=false;
    for(const el of [byId('mapTopStage'),m.area,byId('v196FavoriteDock'),byId('mapLegendFooter')]){
      if(!el)continue;
      if(el.style.zoom!==String(zoom))el.style.zoom=String(zoom);
      if(el.style.width!==width){el.style.setProperty('width',width,'important');changed=true;}
      el.style.boxSizing='border-box';
    }
    const label=byId('v107ZoomValue');if(label)label.textContent=Math.round(zoom*100)+'%';
    if(changed)redraw();
  }
  function redraw(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      // An absolute SVG otherwise keeps its old width in scrollWidth after shrinking.
      const svg=byId('treeLines');
      if(svg){svg.style.width='0px';svg.style.height='0px';svg.setAttribute('width','0');svg.setAttribute('height','0');}
      window.drawLines?.();
    });
  }
  function setZoom(value,user=true){
    const area=byId('mapCanvasArea');if(!area)return;
    if(user)manual=true;
    area.style.zoom=String(clamp(value));
    syncLayout();redraw();
  }
  function fit(){
    const m=metrics();if(!m)return;
    manual=false;
    setZoom(Math.min(1,m.available/m.natural),false);
    m.wrap.scrollLeft=0;m.wrap.scrollTop=0;
  }
  function autoFit(){if(!manual)fit();else syncLayout();}
  function distance(touches){return Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);}
  function bind(){
    const wrap=document.querySelector('.map-wrap');if(!wrap)return;
    setZoom(1,false);
    let viewportWidth=window.innerWidth;
    window.addEventListener('resize',()=>{
      // Mobile browser chrome and keyboards change height, not map width.
      if(window.innerWidth!==viewportWidth){viewportWidth=window.innerWidth;autoFit();}
    },{passive:true});
    wrap.addEventListener('touchstart',event=>{
      if(event.touches.length!==2)return;
      const gap=distance(event.touches);if(!gap)return;
      event.preventDefault();
      const rect=wrap.getBoundingClientRect();
      pinch={gap,zoom:current(),x:(event.touches[0].clientX+event.touches[1].clientX)/2-rect.left,scroll:wrap.scrollLeft};
    },{passive:false});
    wrap.addEventListener('touchmove',event=>{
      if(!pinch||event.touches.length!==2)return;
      event.preventDefault();
      setZoom(pinch.zoom*distance(event.touches)/pinch.gap);
      wrap.scrollLeft=(pinch.scroll+pinch.x)*current()/pinch.zoom-pinch.x;
      suppressClickUntil=Date.now()+400;
    },{passive:false});
    const end=event=>{if(event.touches.length<2)pinch=null;};
    wrap.addEventListener('touchend',end,{passive:true});
    wrap.addEventListener('touchcancel',end,{passive:true});
    wrap.addEventListener('click',event=>{
      if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    requestAnimationFrame(autoFit);
  }
  window.MapViewport={setZoom,fit,autoFit,syncLayout};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
