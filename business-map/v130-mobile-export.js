(function(){
  const APP_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.42';
  let busy=false;
  let fittedOnce=false;

  function isMobile(){
    return window.matchMedia('(max-width:720px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  function version(){ return APP_VERSION; }
  function raf(){ return new Promise(r=>requestAnimationFrame(r)); }
  async function raf2(){ await raf(); await raf(); }

  function applyVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function clickExisting(id){
    const el=document.getElementById(id);
    if(el && !el.disabled){ el.click(); return true; }
    return false;
  }

  function fitMap(){
    if(clickExisting('v107ZoomFit')) return;
    const area=document.getElementById('mapCanvasArea');
    const wrap=area?.closest('.map-wrap');
    if(!area||!wrap) return;
    area.style.zoom='1';
    const natural=Math.max(area.scrollWidth,920);
    const usable=Math.max(300,wrap.clientWidth-16);
    const next=Math.max(.5,Math.min(1,usable/natural));
    area.style.zoom=next;
    const value=document.getElementById('v107ZoomValue');
    if(value) value.textContent=Math.round(next*100)+'%';
    wrap.scrollLeft=0;
    wrap.scrollTop=0;
    requestAnimationFrame(()=>{ if(typeof window.drawLines==='function') window.drawLines(); });
  }

  function ensureMobileBar(){
    const mobile=isMobile();
    let bar=document.getElementById('v130MobileBar');
    if(!mobile){ if(bar) bar.remove(); return; }
    if(bar) return;
    bar=document.createElement('nav');
    bar.id='v130MobileBar';
    bar.setAttribute('aria-label','スマホ用クイック操作');
    bar.innerHTML=`
      <button type="button" data-v130-action="fit">全体</button>
      <button type="button" data-v130-action="add">＋追加</button>
      <button type="button" data-v130-action="self">自分</button>
      <button type="button" data-v130-action="save">画像保存</button>`;
    document.body.appendChild(bar);
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('[data-v130-action]');
      if(!btn) return;
      const action=btn.dataset.v130Action;
      if(action==='fit') fitMap();
      if(action==='add') clickExisting('addBtn');
      if(action==='self') clickExisting('editSelfBtn');
      if(action==='save') captureFullMap();
    });
  }

  function mobileInitialFit(){
    if(!isMobile() || fittedOnce) return;
    fittedOnce=true;
    setTimeout(fitMap,260);
    setTimeout(fitMap,760);
  }

  function waitForImages(root){
    return Promise.all([...root.querySelectorAll('img')].map(img=>{
      if(img.complete && img.naturalWidth>0) return Promise.resolve();
      return new Promise(resolve=>{
        let done=false;
        const finish=()=>{ if(done)return; done=true; resolve(); };
        img.addEventListener('load',finish,{once:true});
        img.addEventListener('error',finish,{once:true});
        setTimeout(finish,2500);
      });
    }));
  }

  function boxInArea(el,area){
    let x=0,y=0,node=el,guard=0;
    while(node && node!==area && guard<50){
      x+=node.offsetLeft||0;
      y+=node.offsetTop||0;
      node=node.offsetParent;
      guard++;
    }
    return {x,y,w:el.offsetWidth||0,h:el.offsetHeight||0};
  }

  function drawCloneLines(clone){
    const svg=clone.querySelector('#treeLines');
    const area=clone.querySelector('#mapCanvasArea');
    const rows=clone.querySelector('#treeRows');
    if(!svg||!area||!rows) return;
    if(clone.querySelector('.v118-filter-root') || area.classList.contains('v118-filter-mode')){
      svg.innerHTML='';
      svg.style.display='none';
      return;
    }
    svg.style.display='';
    const cards={};
    rows.querySelectorAll('.member-card[data-id]').forEach(card=>{ cards[card.dataset.id]=card; });
    const width=Math.max(area.scrollWidth,rows.scrollWidth,area.offsetWidth,420);
    const height=Math.max(area.scrollHeight,rows.scrollHeight,area.offsetHeight,300);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('width',width);
    svg.setAttribute('height',height);
    svg.style.width=width+'px';
    svg.style.height=height+'px';

    const groups=new Map();
    try{
      (state.members||[]).forEach(member=>{
        const child=cards[member.id];
        const parentId=member.parentId||'self';
        const parent=cards[parentId];
        if(!child||!parent) return;
        if(!groups.has(parentId)) groups.set(parentId,[]);
        groups.get(parentId).push(member.id);
      });
    }catch(e){ console.warn('[v1.30] clone line grouping failed',e); }

    let markup='';
    const stroke='#9aadc6',sw=2.2;
    groups.forEach((childIds,parentId)=>{
      const parentCard=cards[parentId];
      if(!parentCard) return;
      const pb=boxInArea(parentCard,area);
      const childBoxes=childIds.map(id=>cards[id]?({id,...boxInArea(cards[id],area)}):null).filter(Boolean).filter(b=>b.w>0&&b.h>0);
      if(!childBoxes.length) return;
      const parentX=Math.round(pb.x+pb.w/2);
      const parentY=Math.round(pb.y+pb.h);
      const childTop=Math.min(...childBoxes.map(b=>b.y));
      const centers=childBoxes.map(b=>Math.round(b.x+b.w/2));
      const gap=Math.max(10,childTop-parentY);
      let busY=Math.round(parentY+gap*.48);
      busY=Math.max(parentY+6,Math.min(childTop-6,busY));
      if(childBoxes.length===1){
        const cx=centers[0],cy=Math.round(childBoxes[0].y);
        if(Math.abs(cx-parentX)<2) markup+=`<path d="M ${parentX} ${parentY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
        else markup+=`<path d="M ${parentX} ${parentY} L ${parentX} ${busY} L ${cx} ${busY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        markup+=`<circle cx="${parentX}" cy="${parentY}" r="2.4" fill="${stroke}"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="${stroke}"/>`;
        return;
      }
      const minX=Math.min(...centers),maxX=Math.max(...centers);
      markup+=`<path d="M ${parentX} ${parentY} L ${parentX} ${busY}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      markup+=`<path d="M ${minX} ${busY} L ${maxX} ${busY}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      childBoxes.forEach((b,i)=>{
        const cx=centers[i],cy=Math.round(b.y);
        markup+=`<path d="M ${cx} ${busY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="2.3" fill="${stroke}"/>`;
      });
      markup+=`<circle cx="${parentX}" cy="${parentY}" r="2.5" fill="${stroke}"/><circle cx="${parentX}" cy="${busY}" r="2.2" fill="${stroke}"/>`;
    });
    svg.innerHTML=markup;
  }

  function naturalTreeWidth(rows){
    const normalRoot=rows.querySelector('.v127-network > .v109-node');
    if(normalRoot){
      return Math.ceil(Math.max(normalRoot.scrollWidth,normalRoot.offsetWidth,normalRoot.getBoundingClientRect().width,360));
    }
    const filtered=rows.querySelector('.v118-filter-root');
    if(filtered) return Math.ceil(Math.max(filtered.scrollWidth,filtered.offsetWidth,420));
    const cards=[...rows.querySelectorAll('.member-card')];
    if(!cards.length) return 420;
    const rr=rows.getBoundingClientRect();
    let left=Infinity,right=-Infinity;
    cards.forEach(card=>{
      const r=card.getBoundingClientRect();
      left=Math.min(left,r.left-rr.left);
      right=Math.max(right,r.right-rr.left);
    });
    return Math.ceil(Math.max(420,right-left));
  }

  async function createCapture(){
    if(typeof window.v126Recalculate==='function'){
      try{ window.v126Recalculate(); }catch(e){ console.warn('[v1.30] recalc skipped',e); }
    }
    await raf2();
    const source=document.querySelector('.map-wrap');
    if(!source) throw new Error('ネットワークマップが見つかりませんでした');

    const host=document.createElement('div');
    host.id='v130CaptureHost';
    host.style.cssText='position:fixed;left:-100000px;top:0;width:1800px;background:#fff;padding:0;margin:0;z-index:-99999;pointer-events:none;overflow:visible;';

    const clone=source.cloneNode(true);
    clone.classList.add('v130-export-clone');
    clone.style.setProperty('position','relative','important');
    clone.style.setProperty('overflow','visible','important');
    clone.style.setProperty('margin','0','important');
    clone.style.setProperty('box-shadow','none','important');
    clone.style.setProperty('max-width','none','important');

    const legend=clone.querySelector('.legend');
    const panel=clone.querySelector('.v116-next-panel');
    const area=clone.querySelector('#mapCanvasArea');
    const rows=clone.querySelector('#treeRows');
    if(!area||!rows) throw new Error('マップ本体が見つかりませんでした');

    if(legend && panel){
      const top=document.createElement('div');
      top.className='v130-export-top';
      top.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:12px;width:100%;margin:0 0 8px;';
      clone.insertBefore(top,area);
      top.appendChild(legend);
      top.appendChild(panel);
      legend.style.setProperty('padding-right','0','important');
      legend.style.setProperty('margin-bottom','0','important');
      legend.style.setProperty('flex','1 1 auto','important');
      panel.style.setProperty('position','relative','important');
      panel.style.setProperty('top','auto','important');
      panel.style.setProperty('right','auto','important');
      panel.style.setProperty('width','210px','important');
      panel.style.setProperty('max-width','210px','important');
      panel.style.setProperty('margin','0','important');
      panel.style.setProperty('flex','0 0 210px','important');
    }

    area.style.setProperty('zoom','1','important');
    area.style.setProperty('transform','none','important');
    area.style.setProperty('min-width','0','important');
    area.style.setProperty('max-width','none','important');
    area.style.setProperty('overflow','visible','important');
    rows.style.setProperty('zoom','1','important');
    rows.style.setProperty('transform','none','important');
    rows.style.setProperty('min-width','0','important');
    rows.style.setProperty('max-width','none','important');

    host.appendChild(clone);
    document.body.appendChild(host);
    await waitForImages(clone);
    await raf2();

    let treeWidth=naturalTreeWidth(rows);
    const direct=rows.querySelector('.v127-direct-zone');
    if(direct){
      const directWidth=Math.min(isMobile()?480:720,Math.max(340,treeWidth));
      direct.style.setProperty('width',directWidth+'px','important');
      direct.style.setProperty('min-width','0','important');
      direct.style.setProperty('max-width',directWidth+'px','important');
      const directCards=direct.querySelector('.v127-direct-cards');
      if(directCards && isMobile()){
        directCards.style.setProperty('display','grid','important');
        directCards.style.setProperty('grid-template-columns','repeat(2,minmax(0,1fr))','important');
      }
      direct.querySelectorAll('.v127-mini-card').forEach(card=>card.style.setProperty('width','100%','important'));
      await raf();
      treeWidth=Math.max(treeWidth,Math.ceil(direct.scrollWidth));
    }

    const contentWidth=Math.max(420,Math.ceil(treeWidth+28));
    rows.style.setProperty('width',contentWidth+'px','important');
    area.style.setProperty('width',contentWidth+'px','important');
    area.style.setProperty('min-width',contentWidth+'px','important');
    const captureWidth=Math.max(440,contentWidth+16);
    clone.style.setProperty('width',captureWidth+'px','important');
    host.style.width=captureWidth+'px';

    await raf2();
    drawCloneLines(clone);
    await raf2();

    const finalWidth=Math.ceil(Math.max(captureWidth,clone.scrollWidth));
    clone.style.setProperty('width',finalWidth+'px','important');
    host.style.width=finalWidth+'px';
    drawCloneLines(clone);
    await raf();

    return {host,clone,width:finalWidth,height:Math.ceil(clone.scrollHeight)};
  }

  function pixelRatio(w,h){
    const base=isMobile()?1.55:1.85;
    const maxPixels=isMobile()?18000000:32000000;
    const limit=Math.sqrt(maxPixels/Math.max(1,w*h));
    return Math.max(.9,Math.min(base,limit));
  }

  async function toBlob(node,w,h){
    const ratio=pixelRatio(w,h);
    if(window.htmlToImage && typeof window.htmlToImage.toBlob==='function'){
      try{
        const b=await window.htmlToImage.toBlob(node,{
          backgroundColor:'#fff',pixelRatio:ratio,cacheBust:true,includeQueryParams:true,
          width:w,height:h,style:{width:w+'px',height:h+'px',overflow:'visible'}
        });
        if(b) return b;
      }catch(e){ console.warn('[v1.30] html-to-image fallback',e); }
    }
    if(typeof window.html2canvas==='function'){
      const canvas=await window.html2canvas(node,{
        backgroundColor:'#fff',scale:ratio,useCORS:true,allowTaint:false,logging:false,
        width:w,height:h,windowWidth:w,windowHeight:h,scrollX:0,scrollY:0
      });
      return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG変換に失敗しました')),'image/png',1));
    }
    throw new Error('画像保存ライブラリが読み込めませんでした');
  }

  function ensurePreview(){
    let modal=document.getElementById('v130ImageModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='v130ImageModal';
    modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);display:none;align-items:center;justify-content:center;padding:10px;';
    modal.innerHTML=`<div style="width:min(980px,100%);max-height:94dvh;overflow:auto;background:#fff;border-radius:18px;padding:11px;box-shadow:0 24px 70px rgba(15,23,42,.25)">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px"><div><div id="v130ImageTitle" style="font-size:17px;font-weight:900;color:#172033"></div><div style="font-size:10px;color:#64748b;margin-top:2px">余白を抑えてネットワーク全体を保存します</div></div><button type="button" class="btn ghost" id="v130Close">閉じる</button></div>
      <div style="background:#eef2f7;border-radius:12px;padding:6px;overflow:auto"><img id="v130Preview" alt="Business Map画像" style="display:block;width:100%;height:auto;margin:auto;border-radius:8px;background:#fff"></div>
      <div style="position:sticky;bottom:0;display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px;padding-top:7px;background:#fff"><button type="button" class="btn primary" id="v130Share">共有・保存</button><button type="button" class="btn" id="v130Download">ダウンロード</button></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('v130Close').onclick=()=>modal.style.display='none';
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.style.display='none'; });
    return modal;
  }

  function downloadBlob(blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`business-map-${version()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }

  async function shareBlob(blob){
    const file=new File([blob],`business-map-${version()}.png`,{type:'image/png'});
    if(navigator.share && navigator.canShare){
      try{
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:`Business Map ${version()}`});
          return true;
        }
      }catch(e){ if(e?.name==='AbortError') return false; }
    }
    downloadBlob(blob);
    return true;
  }

  async function captureFullMap(){
    if(busy) return;
    busy=true;
    const buttons=[document.getElementById('saveImageBtn'),document.getElementById('mapSaveImageBtn')].filter(Boolean);
    const labels=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{ b.disabled=true; b.textContent='画像を最適化中…'; });
    let cap=null;
    try{
      if(document.fonts?.ready) await document.fonts.ready;
      cap=await createCapture();
      const blob=await toBlob(cap.clone,cap.width,cap.height);
      if(!blob) throw new Error('PNG画像を作成できませんでした');
      const modal=ensurePreview();
      const preview=document.getElementById('v130Preview');
      const url=URL.createObjectURL(blob);
      if(preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.dataset.url=url;
      preview.src=url;
      document.getElementById('v130ImageTitle').textContent=`Business Map画像 ${version()}`;
      modal.style.display='flex';
      document.getElementById('v130Share').onclick=()=>shareBlob(blob);
      document.getElementById('v130Download').onclick=()=>downloadBlob(blob);
    }catch(e){
      console.error(e);
      alert(`画像保存に失敗しました。\n${e.message||e}`);
    }finally{
      if(cap?.host?.parentNode) cap.host.remove();
      buttons.forEach((b,i)=>{ b.disabled=false; b.textContent=labels[i]||'画像保存'; });
      busy=false;
    }
  }

  function bindSaveButtons(){
    const top=document.getElementById('saveImageBtn');
    const map=document.getElementById('mapSaveImageBtn');
    if(top) top.onclick=captureFullMap;
    if(map) map.onclick=captureFullMap;
    window.saveImage=captureFullMap;
    window.v130CaptureFullMap=captureFullMap;
  }

  function bind(){
    applyVersion();
    bindSaveButtons();
    ensureMobileBar();
    mobileInitialFit();
    window.addEventListener('resize',()=>{
      ensureMobileBar();
      if(isMobile()) setTimeout(fitMap,160);
    });
    window.addEventListener('orientationchange',()=>{ if(isMobile()) setTimeout(fitMap,260); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
