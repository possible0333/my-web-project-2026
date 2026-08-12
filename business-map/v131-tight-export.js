(function(){
  const APP_VERSION='v1.31';
  let busy=false;

  function isMobile(){
    return window.matchMedia('(max-width:720px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  function raf(){ return new Promise(r=>requestAnimationFrame(r)); }
  async function raf2(){ await raf(); await raf(); }
  function version(){ return APP_VERSION; }

  function waitForImages(root){
    return Promise.all([...root.querySelectorAll('img')].map(img=>{
      if(img.complete&&img.naturalWidth>0) return Promise.resolve();
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
    while(node&&node!==area&&guard<60){
      x+=node.offsetLeft||0;
      y+=node.offsetTop||0;
      node=node.offsetParent;
      guard++;
    }
    return {x,y,w:el.offsetWidth||0,h:el.offsetHeight||0};
  }

  function drawLinesOn(area){
    const svg=area.querySelector('#treeLines');
    const rows=area.querySelector('#treeRows');
    if(!svg||!rows) return;
    if(rows.classList.contains('v118-filter-root')||area.classList.contains('v118-filter-mode')){
      svg.innerHTML=''; svg.style.display='none'; return;
    }
    svg.style.display='';
    const cards={};
    rows.querySelectorAll('.member-card[data-id]').forEach(card=>cards[card.dataset.id]=card);
    const width=Math.max(rows.scrollWidth,rows.offsetWidth,720);
    const height=Math.max(rows.scrollHeight,rows.offsetHeight,300);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('width',width);
    svg.setAttribute('height',height);
    svg.style.width=width+'px';
    svg.style.height=height+'px';
    svg.style.position='absolute';
    svg.style.left='0';
    svg.style.top='0';
    const groups=new Map();
    (state.members||[]).forEach(member=>{
      const child=cards[member.id];
      const parentId=member.parentId||'self';
      const parent=cards[parentId];
      if(!child||!parent) return;
      if(!groups.has(parentId)) groups.set(parentId,[]);
      groups.get(parentId).push(member.id);
    });
    let markup='';
    const stroke='#9aadc6', sw=2.2;
    groups.forEach((childIds,parentId)=>{
      const parentCard=cards[parentId];
      if(!parentCard) return;
      const pb=boxInArea(parentCard,area);
      const childBoxes=childIds.map(id=>cards[id]?({id,...boxInArea(cards[id],area)}):null).filter(Boolean).filter(b=>b.w>0&&b.h>0);
      if(!childBoxes.length) return;
      const px=Math.round(pb.x+pb.w/2), py=Math.round(pb.y+pb.h);
      const top=Math.min(...childBoxes.map(b=>b.y));
      const centers=childBoxes.map(b=>Math.round(b.x+b.w/2));
      const gap=Math.max(10,top-py);
      let bus=Math.round(py+gap*.48);
      bus=Math.max(py+6,Math.min(top-6,bus));
      if(childBoxes.length===1){
        const cx=centers[0], cy=Math.round(childBoxes[0].y);
        if(Math.abs(cx-px)<2) markup+=`<path d="M ${px} ${py} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
        else markup+=`<path d="M ${px} ${py} L ${px} ${bus} L ${cx} ${bus} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        return;
      }
      const minX=Math.min(...centers), maxX=Math.max(...centers);
      markup+=`<path d="M ${px} ${py} L ${px} ${bus}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      markup+=`<path d="M ${minX} ${bus} L ${maxX} ${bus}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      childBoxes.forEach((b,i)=>{
        const cx=centers[i], cy=Math.round(b.y);
        markup+=`<path d="M ${cx} ${bus} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      });
    });
    svg.innerHTML=markup;
  }

  function buildCaptureSurface(){
    const sourceRows=document.getElementById('treeRows');
    const sourceArea=document.getElementById('mapCanvasArea');
    const legend=document.getElementById('legend');
    const next=document.getElementById('nextMonthProspects');
    if(!sourceRows||!sourceArea) throw new Error('ネットワークマップが見つかりませんでした');

    const treeWidth=Math.ceil(Math.max(sourceRows.scrollWidth,sourceRows.offsetWidth,720));
    const topWidth=Math.min(Math.max(620,treeWidth),1200);
    const surfaceWidth=Math.ceil(Math.max(treeWidth,topWidth)+32);

    const host=document.createElement('div');
    host.id='v131CaptureHost';
    host.style.cssText=`position:fixed;left:-100000px;top:0;z-index:-99999;width:${surfaceWidth}px;background:#fff;pointer-events:none;overflow:visible;`;

    const surface=document.createElement('div');
    surface.className='v131-export-surface';
    surface.style.cssText=`width:${surfaceWidth}px;background:#fff;padding:14px 16px 18px;box-sizing:border-box;overflow:visible;`;

    const top=document.createElement('div');
    top.className='v131-export-top';
    top.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;';
    if(legend){
      const l=legend.cloneNode(true);
      l.removeAttribute('id');
      l.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0;flex:1;padding:0;margin:0;font-size:11px;color:#64748b;';
      top.appendChild(l);
    }
    if(next){
      const n=next.cloneNode(true);
      n.removeAttribute('id');
      n.style.cssText='position:static!important;inset:auto!important;flex:0 0 auto;width:auto!important;max-width:260px!important;margin:0!important;padding:8px 10px!important;box-shadow:none!important;';
      top.appendChild(n);
    }
    if(top.children.length) surface.appendChild(top);

    const area=sourceArea.cloneNode(true);
    area.removeAttribute('id');
    area.classList.add('v131-export-area');
    area.style.zoom='1';
    area.style.transform='none';
    area.style.position='relative';
    area.style.width=treeWidth+'px';
    area.style.minWidth=treeWidth+'px';
    area.style.maxWidth='none';
    area.style.minHeight='0';
    area.style.padding='0';
    area.style.margin='0 auto';
    area.style.overflow='visible';

    const rows=area.querySelector('#treeRows');
    if(rows){
      rows.style.zoom='1';
      rows.style.transform='none';
      rows.style.width='max-content';
      rows.style.minWidth='max-content';
      rows.style.maxWidth='none';
      rows.style.margin='0 auto';
      rows.style.paddingTop='6px';
      const direct=rows.querySelector('.v127-direct-zone');
      if(direct){
        const directWidth=Math.min(760,Math.max(360,treeWidth-40));
        direct.style.width=directWidth+'px';
        direct.style.minWidth='0';
        direct.style.maxWidth=directWidth+'px';
        const cards=direct.querySelector('.v127-direct-cards');
        if(cards){ cards.style.flexWrap='wrap'; cards.style.maxWidth='100%'; }
      }
    }
    surface.appendChild(area);
    host.appendChild(surface);
    document.body.appendChild(host);
    return {host,surface,area,treeWidth};
  }

  function pixelRatio(w,h){
    const base=isMobile()?1.45:1.8;
    const maxPixels=isMobile()?18000000:32000000;
    const limit=Math.sqrt(maxPixels/Math.max(1,w*h));
    return Math.max(.85,Math.min(base,limit));
  }

  async function renderSurface(surface){
    await waitForImages(surface);
    await raf2();
    const area=surface.querySelector('.v131-export-area');
    if(area){ drawLinesOn(area); await raf2(); }
    const width=Math.ceil(surface.scrollWidth);
    const height=Math.ceil(surface.scrollHeight);
    const ratio=pixelRatio(width,height);
    if(window.htmlToImage&&typeof window.htmlToImage.toBlob==='function'){
      try{
        const blob=await window.htmlToImage.toBlob(surface,{backgroundColor:'#fff',pixelRatio:ratio,cacheBust:true,includeQueryParams:true,width,height,style:{width:width+'px',height:height+'px',overflow:'visible'}});
        if(blob) return blob;
      }catch(e){ console.warn('[v1.31] html-to-image fallback',e); }
    }
    if(typeof window.html2canvas==='function'){
      const canvas=await window.html2canvas(surface,{backgroundColor:'#fff',scale:ratio,useCORS:true,allowTaint:false,logging:false,width,height,windowWidth:width,windowHeight:height,scrollX:0,scrollY:0});
      return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG変換に失敗しました')),'image/png',1));
    }
    throw new Error('画像保存ライブラリが読み込めませんでした');
  }

  function ensurePreview(){
    let modal=document.getElementById('v131ImageModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='v131ImageModal';
    modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);display:none;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML=`<div style="width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px"><div><b style="font-size:17px;color:#172033">Business Map画像 ${APP_VERSION}</b><div style="font-size:10px;color:#64748b;margin-top:2px">余白を詰めてマップ全体を保存</div></div><button type="button" class="btn ghost" id="v131Close">閉じる</button></div><div style="background:#eef2f7;border-radius:12px;padding:6px;overflow:auto"><img id="v131Preview" style="display:block;max-width:100%;height:auto;margin:auto;background:#fff"></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:9px"><button type="button" class="btn primary" id="v131Share">共有・保存</button><button type="button" class="btn" id="v131Download">ダウンロード</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('v131Close').onclick=()=>modal.style.display='none';
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
    return modal;
  }

  function downloadBlob(blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`business-map-${APP_VERSION}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  async function shareBlob(blob){
    const file=new File([blob],`business-map-${APP_VERSION}.png`,{type:'image/png'});
    if(navigator.share&&navigator.canShare){
      try{
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:`Business Map ${APP_VERSION}`});
          return;
        }
      }catch(e){ if(e?.name==='AbortError') return; }
    }
    downloadBlob(blob);
  }

  async function capture(){
    if(busy) return;
    busy=true;
    const buttons=[document.getElementById('saveImageBtn'),document.getElementById('mapSaveImageBtn'),document.getElementById('v130QuickSave')].filter(Boolean);
    const labels=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{b.disabled=true;b.textContent='画像作成中…';});
    let cap=null;
    try{
      if(typeof window.v126Recalculate==='function') window.v126Recalculate();
      if(document.fonts?.ready) await document.fonts.ready;
      await raf2();
      cap=buildCaptureSurface();
      const blob=await renderSurface(cap.surface);
      const modal=ensurePreview();
      const preview=document.getElementById('v131Preview');
      const url=URL.createObjectURL(blob);
      if(preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.dataset.url=url;
      preview.src=url;
      modal.style.display='flex';
      document.getElementById('v131Share').onclick=()=>shareBlob(blob);
      document.getElementById('v131Download').onclick=()=>downloadBlob(blob);
      if(isMobile()&&navigator.share&&navigator.canShare){
        const file=new File([blob],`business-map-${APP_VERSION}.png`,{type:'image/png'});
        try{ if(navigator.canShare({files:[file]})) await navigator.share({files:[file],title:`Business Map ${APP_VERSION}`}); }catch(e){ if(e?.name!=='AbortError') console.warn(e); }
      }
    }catch(e){
      console.error(e);
      alert(`画像保存に失敗しました。\n${e.message||e}`);
    }finally{
      if(cap?.host?.parentNode) cap.host.remove();
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=labels[i]||'画像保存';});
      busy=false;
    }
  }

  function applyVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function bind(){
    applyVersion();
    const top=document.getElementById('saveImageBtn');
    const map=document.getElementById('mapSaveImageBtn');
    const quick=document.getElementById('v130QuickSave');
    if(top) top.onclick=capture;
    if(map) map.onclick=capture;
    if(quick) quick.onclick=capture;
    window.saveImage=capture;
    window.v131Capture=capture;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
