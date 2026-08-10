(function(){
  const VERSION='v1.13';
  let raf1=0, raf2=0, timer1=0, timer2=0;

  function boxInArea(el,area){
    let x=0,y=0,node=el,guard=0;
    while(node && node!==area && guard<40){
      x+=node.offsetLeft||0;
      y+=node.offsetTop||0;
      node=node.offsetParent;
      guard++;
    }
    return {x,y,w:el.offsetWidth||0,h:el.offsetHeight||0};
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

    const groups=new Map();
    try{
      state.members.forEach(member=>{
        const child=cards[member.id];
        const parentId=member.parentId||'self';
        const parent=cards[parentId];
        if(!child||!parent) return;
        if(!groups.has(parentId)) groups.set(parentId,[]);
        groups.get(parentId).push(member.id);
      });
    }catch(e){
      console.warn('v1.13 line grouping failed',e);
    }

    let markup='';
    const stroke='#9aadc6';
    const sw=2.2;

    groups.forEach((childIds,parentId)=>{
      const parentCard=cards[parentId];
      if(!parentCard) return;
      const pb=boxInArea(parentCard,area);
      const childBoxes=childIds.map(id=>({id,...boxInArea(cards[id],area)})).filter(b=>b.w>0&&b.h>0);
      if(!childBoxes.length) return;

      const parentX=Math.round(pb.x+pb.w/2);
      const parentY=Math.round(pb.y+pb.h);
      const childTop=Math.min(...childBoxes.map(b=>b.y));
      const childCenters=childBoxes.map(b=>Math.round(b.x+b.w/2));
      const gap=Math.max(10,childTop-parentY);
      let busY=Math.round(parentY+gap*.48);
      busY=Math.max(parentY+6,Math.min(childTop-6,busY));

      if(childBoxes.length===1){
        const cx=childCenters[0];
        const cy=Math.round(childBoxes[0].y);
        if(Math.abs(cx-parentX)<2){
          markup+=`<path d="M ${parentX} ${parentY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
        }else{
          markup+=`<path d="M ${parentX} ${parentY} L ${parentX} ${busY} L ${cx} ${busY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
        markup+=`<circle cx="${parentX}" cy="${parentY}" r="2.4" fill="${stroke}"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="${stroke}"/>`;
        return;
      }

      const minX=Math.min(...childCenters);
      const maxX=Math.max(...childCenters);
      markup+=`<path d="M ${parentX} ${parentY} L ${parentX} ${busY}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      markup+=`<path d="M ${minX} ${busY} L ${maxX} ${busY}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      childBoxes.forEach((b,i)=>{
        const cx=childCenters[i];
        const cy=Math.round(b.y);
        markup+=`<path d="M ${cx} ${busY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
        markup+=`<circle cx="${cx}" cy="${cy}" r="2.3" fill="${stroke}"/>`;
      });
      markup+=`<circle cx="${parentX}" cy="${parentY}" r="2.5" fill="${stroke}"/><circle cx="${parentX}" cy="${busY}" r="2.2" fill="${stroke}"/>`;
    });

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
    window.addEventListener('resize',scheduleRedraw);
    window.addEventListener('orientationchange',scheduleRedraw);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
