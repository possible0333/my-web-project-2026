(function(){
  const VERSION='v1.85';
  let raf1=0, raf2=0, timer1=0, timer2=0;

  function boxInArea(el,area){
    const areaRect=area.getBoundingClientRect(),rect=el.getBoundingClientRect();
    const scaleX=area.offsetWidth?areaRect.width/area.offsetWidth:1;
    const scaleY=area.offsetHeight?areaRect.height/area.offsetHeight:scaleX;
    const sx=Number.isFinite(scaleX)&&scaleX>0?scaleX:1;
    const sy=Number.isFinite(scaleY)&&scaleY>0?scaleY:sx;
    return {x:(rect.left-areaRect.left)/sx,y:(rect.top-areaRect.top)/sy,w:rect.width/sx,h:rect.height/sy};
  }

  function drawLinesV113(){
    const svg=document.getElementById('treeLines');
    const area=document.getElementById('mapCanvasArea');
    const rows=document.getElementById('treeRows');
    if(!svg||!area||!rows) return;

    const cards={};
    rows.querySelectorAll('.member-card[data-id]').forEach(card=>{cards[card.dataset.id]=card;});

    const width=Math.max(area.scrollWidth,rows.scrollWidth,area.offsetWidth,900);
    const height=Math.max(area.scrollHeight,rows.scrollHeight,area.offsetHeight,360);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('width',width);
    svg.setAttribute('height',height);
    svg.style.width=width+'px';
    svg.style.height=height+'px';

    let markup='';
    try{
      state.members.forEach(member=>{
        const child=cards[member.id],parent=cards[member.parentId||'self'];
        if(!child||!parent) return;
        const pb=boxInArea(parent,area),cb=boxInArea(child,area);
        if(!pb.w||!pb.h||!cb.w||!cb.h) return;
        const x1=Math.round(pb.x+pb.w/2),y1=Math.round(pb.y+pb.h),x2=Math.round(cb.x+cb.w/2),y2=Math.round(cb.y);
        const mid=Math.round(y1+Math.max(12,y2-y1)*.5);
        const branch=child.closest('.v185-front-branch')||parent.closest('.v185-front-branch');
        const stroke=branch?.dataset.v185Color||'#8295af';
        const d=`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
        markup+=`<path d="${d}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
        markup+=`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
        markup+=`<circle cx="${x1}" cy="${y1}" r="2.6" fill="${stroke}"/><circle cx="${x2}" cy="${y2}" r="2.6" fill="${stroke}"/>`;
      });
    }catch(e){console.warn('v1.85 line drawing failed',e)}

    svg.innerHTML=markup;
    svg.dataset.lineVersion=VERSION;
  }

  function scheduleRedraw(){
    cancelAnimationFrame(raf1); cancelAnimationFrame(raf2);
    clearTimeout(timer1); clearTimeout(timer2);
    raf1=requestAnimationFrame(()=>{
      raf2=requestAnimationFrame(drawLinesV113);
    });
    timer1=setTimeout(drawLinesV113,70);
    timer2=setTimeout(drawLinesV113,180);
  }

  function wrapRender(){
    const original=window.renderTree;
    if(typeof original!=='function'||original.__v113) return;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      scheduleRedraw();
      return result;
    };
    wrapped.__v113=true;
    window.renderTree=wrapped;
  }

  function bindObservers(){
    const rows=document.getElementById('treeRows');
    const area=document.getElementById('mapCanvasArea');
    if(rows && window.MutationObserver){
      const mo=new MutationObserver(()=>scheduleRedraw());
      mo.observe(rows,{childList:true,subtree:true});
    }
    if(area && window.ResizeObserver){
      const ro=new ResizeObserver(()=>scheduleRedraw());
      ro.observe(area);
      if(rows) ro.observe(rows);
    }
  }

  function bind(){
    wrapRender();
    window.drawLines=drawLinesV113;
    window.v113DrawLines=drawLinesV113;
    bindObservers();
    scheduleRedraw();
    if(document.fonts?.ready) document.fonts.ready.then(scheduleRedraw).catch(()=>{});
    window.addEventListener('resize',scheduleRedraw);
    window.addEventListener('orientationchange',scheduleRedraw);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
