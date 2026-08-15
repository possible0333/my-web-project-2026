(function(){
  const VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.44';
  let mapObserver=null;

  function modalOpen(){
    return !!document.querySelector('.modal.show,.v136-share-modal.is-open,.v136-viewer.is-open,[id$="ImageModal"][style*="display: flex"]');
  }

  function syncBodyLock(){ document.body.classList.toggle('bm-modal-open',modalOpen()); }

  function decorateCards(){
    document.querySelectorAll('.member-card[data-id]').forEach(card=>{
      if(card.dataset.bmAccessible) return;
      card.dataset.bmAccessible='1';
      card.tabIndex=0;
      card.setAttribute('role','button');
      const name=card.querySelector('.card-name')?.textContent?.trim()||'メンバー';
      card.setAttribute('aria-label',`${name}を編集`);
      card.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ') return;
        event.preventDefault(); card.click();
      });
    });
  }

  function syncMapOverflow(){
    const wrap=document.querySelector('.map-wrap');
    if(!wrap) return;
    const canScroll=wrap.scrollWidth>wrap.clientWidth+12;
    wrap.classList.toggle('bm-can-scroll',canScroll);
    if(!canScroll) wrap.classList.remove('bm-scrolled');
  }

  function decorateUi(){
    document.documentElement.dataset.businessMapVersion=VERSION;
    const modal=document.getElementById('modal');
    if(modal){
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.setAttribute('aria-labelledby','modalTitle');
    }
    document.querySelectorAll('.v136-share-modal').forEach(el=>{
      el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
    });
    decorateCards(); syncMapOverflow(); syncBodyLock();
  }

  function diagnostics(){
    const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
    const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
    const required=['selfCard','treeRows','addBtn','editSelfBtn','saveImageBtn','uploadMapBtn','communityMapsBtn'];
    let orphanParents=[]; let cycles=[];
    try{
      const members=Array.isArray(state?.members)?state.members:[];
      const known=new Set(['self',...members.map(x=>x.id)]);
      orphanParents=members.filter(x=>!known.has(x.parentId||'self')).map(x=>x.id);
      const byId=new Map(members.map(x=>[x.id,x]));
      members.forEach(person=>{
        const seen=new Set([person.id]); let cursor=person;
        while(cursor?.parentId&&cursor.parentId!=='self'){
          if(seen.has(cursor.parentId)){ cycles.push(person.id); break; }
          seen.add(cursor.parentId); cursor=byId.get(cursor.parentId);
          if(!cursor) break;
        }
      });
    }catch(e){}
    return {
      version:VERSION,
      duplicateIds,
      missingControls:required.filter(id=>!document.getElementById(id)),
      orphanParents:[...new Set(orphanParents)],
      cycles:[...new Set(cycles)],
      mobile:matchMedia('(max-width:720px)').matches,
      horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2
    };
  }

  function bind(){
    const wrap=document.querySelector('.map-wrap');
    if(wrap){
      wrap.addEventListener('scroll',()=>{
        if(wrap.scrollLeft>18) wrap.classList.add('bm-scrolled');
      },{passive:true});
    }
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape') return;
      const gallery=document.querySelector('.v136-share-modal.is-open');
      if(gallery){ gallery.classList.remove('is-open'); syncBodyLock(); return; }
      const viewer=document.querySelector('.v136-viewer.is-open');
      if(viewer){ viewer.classList.remove('is-open'); syncBodyLock(); return; }
      const modal=document.getElementById('modal');
      if(modal?.classList.contains('show')&&typeof closeModal==='function') closeModal();
      syncBodyLock();
    });
    const rootObserver=new MutationObserver(()=>requestAnimationFrame(decorateUi));
    rootObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
    if(window.ResizeObserver){
      mapObserver=new ResizeObserver(syncMapOverflow);
      if(wrap) mapObserver.observe(wrap);
    }
    window.addEventListener('resize',syncMapOverflow,{passive:true});
    window.businessMapDiagnostics=diagnostics;
    decorateUi();
    const report=diagnostics();
    if(report.duplicateIds.length||report.missingControls.length||report.orphanParents.length||report.cycles.length||report.horizontalOverflow){
      console.warn(`[${VERSION}] Business Map diagnostics`,report);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
