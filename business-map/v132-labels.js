(function(){
  const APP_VERSION='v1.32';

  function setText(el,text){ if(el && el.textContent!==text) el.textContent=text; }

  function relabel(root=document){
    // Self summary: shorten only PV labels, not planning text such as "今月の目標".
    root.querySelectorAll('.kpi-label').forEach(el=>{
      const t=(el.textContent||'').trim();
      const map={
        '目標個人PV':'目 個人PV',
        '実績PV':'実 個人PV',
        'チーム目標PV':'GrPV 目',
        'チーム実績PV':'GrPV 実'
      };
      if(map[t]) setText(el,map[t]);
    });

    // Direct customer / retail mini cards.
    root.querySelectorAll('.v127-mini-pv').forEach(el=>{
      el.textContent=(el.textContent||'').replace(/^実績\s*/,'実 ');
    });

    // Any legacy/fallback PV card markup that may still appear in filtered mode.
    root.querySelectorAll('.pv-box').forEach(box=>{
      const walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node=>{
        let t=node.nodeValue||'';
        t=t.replace(/Group\s*PV/gi,'GrPV');
        t=t.replace(/グループ\s*PV/g,'GrPV');
        t=t.replace(/目標(?=\s*[\d未])/g,'目');
        t=t.replace(/実績(?=\s*[\d未])/g,'実');
        node.nodeValue=t;
      });
    });
  }

  function applyVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function patchRender(name){
    let fn;
    try{ fn=window[name]; }catch(e){ return; }
    if(typeof fn!=='function' || fn.__v132) return;
    const wrapped=function(){
      const result=fn.apply(this,arguments);
      requestAnimationFrame(()=>relabel(document));
      return result;
    };
    wrapped.__v132=true;
    window[name]=wrapped;
    try{ globalThis[name]=wrapped; }catch(e){}
  }

  function bind(){
    applyVersion();
    patchRender('render');
    patchRender('renderSelf');
    patchRender('renderTree');
    relabel(document);
    requestAnimationFrame(()=>relabel(document));
    setTimeout(()=>relabel(document),150);

    // Late DOM updates from older patch layers are normalized too.
    const observer=new MutationObserver(()=>relabel(document));
    observer.observe(document.body,{childList:true,subtree:true});
    window.v132Relabel=relabel;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
