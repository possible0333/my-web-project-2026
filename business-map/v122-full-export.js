(function(){
  const VERSION='v1.22';
  let busy=false;

  function isMobile(){
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints||0)>1;
  }

  function waitForImages(root){
    const imgs=[...root.querySelectorAll('img')];
    return Promise.all(imgs.map(img=>{
      if(img.complete && img.naturalWidth>0) return Promise.resolve();
      return new Promise(resolve=>{
        let done=false;
        const finish=()=>{ if(done) return; done=true; resolve(); };
        img.addEventListener('load',finish,{once:true});
        img.addEventListener('error',finish,{once:true});
        setTimeout(finish,3000);
      });
    }));
  }

  function ensurePreview(){
    let modal=document.getElementById('v122ImageModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='v122ImageModal';
    modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);display:none;align-items:center;justify-content:center;padding:14px;';
    modal.innerHTML=`
      <div style="width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:14px;box-shadow:0 24px 70px rgba(15,23,42,.25)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:18px;font-weight:900;color:#172033">Business Map画像 ${VERSION}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">スマホでもネットワークマップ全体を保存します</div>
          </div>
          <button type="button" class="btn ghost" id="v122Close">閉じる</button>
        </div>
        <div style="background:#eef2f7;border-radius:14px;padding:8px;overflow:auto"><img id="v122Preview" alt="Business Map画像" style="display:block;max-width:100%;height:auto;margin:auto;border-radius:10px;background:#fff"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px">
          <button type="button" class="btn primary" id="v122Share">共有・保存</button>
          <button type="button" class="btn" id="v122Download">ダウンロード</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('v122Close').onclick=()=>{ modal.style.display='none'; };
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.style.display='none'; });
    return modal;
  }

  function downloadBlob(blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`business-map-${VERSION}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }

  async function shareBlob(blob){
    const file=new File([blob],`business-map-${VERSION}.png`,{type:'image/png'});
    if(navigator.share && navigator.canShare){
      try{
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:`Business Map ${VERSION}`});
          return true;
        }
      }catch(e){
        if(e && e.name==='AbortError') return false;
        console.warn('[v1.22] share failed',e);
      }
    }
    downloadBlob(blob);
    return true;
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
    const width=Math.max(area.scrollWidth,rows.scrollWidth,area.offsetWidth,920);
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
    }catch(e){ console.warn('[v1.22] clone line grouping failed',e); }

    let markup='';
    const stroke='#9aadc6', sw=2.2;
    groups.forEach((childIds,parentId)=>{
      const parentCard=cards[parentId];
      if(!parentCard) return;
      const pb=boxInArea(parentCard,area);
      const childBoxes=childIds.map(id=>cards[id]?({id,...boxInArea(cards[id],area)}):null).filter(Boolean).filter(b=>b.w>0&&b.h>0);
      if(!childBoxes.length) return;
      const parentX=Math.round(pb.x+pb.w/2);
      const parentY=Math.round(pb.y+pb.h);
      const childTop=Math.min(...childBoxes.map(b=>b.y));
      const childCenters=childBoxes.map(b=>Math.round(b.x+b.w/2));
      const gap=Math.max(10,childTop-parentY);
      let busY=Math.round(parentY+gap*.48);
      busY=Math.max(parentY+6,Math.min(childTop-6,busY));

      if(childBoxes.length===1){
        const cx=childCenters[0], cy=Math.round(childBoxes[0].y);
        if(Math.abs(cx-parentX)<2) markup+=`<path d="M ${parentX} ${parentY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
        else markup+=`<path d="M ${parentX} ${parentY} L ${parentX} ${busY} L ${cx} ${busY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        markup+=`<circle cx="${parentX}" cy="${parentY}" r="2.4" fill="${stroke}"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="${stroke}"/>`;
        return;
      }

      const minX=Math.min(...childCenters), maxX=Math.max(...childCenters);
      markup+=`<path d="M ${parentX} ${parentY} L ${parentX} ${busY}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      markup+=`<path d="M ${minX} ${busY} L ${maxX} ${busY}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      childBoxes.forEach((b,i)=>{
        const cx=childCenters[i], cy=Math.round(b.y);
        markup+=`<path d="M ${cx} ${busY} L ${cx} ${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
        markup+=`<circle cx="${cx}" cy="${cy}" r="2.3" fill="${stroke}"/>`;
      });
      markup+=`<circle cx="${parentX}" cy="${parentY}" r="2.5" fill="${stroke}"/><circle cx="${parentX}" cy="${busY}" r="2.2" fill="${stroke}"/>`;
    });
    svg.innerHTML=markup;
  }

  async function createFullCaptureNode(){
    const source=document.querySelector('.map-wrap');
    const sourceArea=document.getElementById('mapCanvasArea');
    const sourceRows=document.getElementById('treeRows');
    if(!source||!sourceArea||!sourceRows) throw new Error('ネットワークマップが見つかりませんでした');

    const naturalMapWidth=Math.ceil(Math.max(sourceRows.scrollWidth,sourceArea.scrollWidth,sourceRows.offsetWidth,920));
    const captureWidth=Math.max(960,naturalMapWidth+28);

    const host=document.createElement('div');
    host.id='v122CaptureHost';
    host.style.cssText=`position:fixed;left:-100000px;top:0;width:${captureWidth}px;background:#fff;padding:0;margin:0;z-index:-99999;pointer-events:none;overflow:visible;`;

    const clone=source.cloneNode(true);
    clone.style.width=captureWidth+'px';
    clone.style.maxWidth='none';
    clone.style.overflow='visible';
    clone.style.margin='0';
    clone.style.boxShadow='none';

    const area=clone.querySelector('#mapCanvasArea');
    const rows=clone.querySelector('#treeRows');
    if(area){
      area.style.zoom='1';
      area.style.transform='none';
      area.style.width=naturalMapWidth+'px';
      area.style.minWidth=naturalMapWidth+'px';
      area.style.maxWidth='none';
      area.style.overflow='visible';
    }
    if(rows){
      rows.style.zoom='1';
      rows.style.transform='none';
      rows.style.maxWidth='none';
      if(rows.classList.contains('v109-tree-root')){
        rows.style.width='max-content';
        rows.style.minWidth='max-content';
      }else{
        rows.style.width='100%';
        rows.style.minWidth='0';
      }
    }

    clone.querySelectorAll('.member-card').forEach(card=>{
      card.style.transform='none';
      card.style.visibility='visible';
    });

    host.appendChild(clone);
    document.body.appendChild(host);
    await waitForImages(clone);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    drawCloneLines(clone);
    await new Promise(r=>requestAnimationFrame(r));

    const contentWidth=Math.ceil(Math.max(clone.scrollWidth,naturalMapWidth+28));
    clone.style.width=contentWidth+'px';
    host.style.width=contentWidth+'px';
    drawCloneLines(clone);
    await new Promise(r=>requestAnimationFrame(r));

    return {host,clone,width:Math.ceil(clone.scrollWidth),height:Math.ceil(clone.scrollHeight)};
  }

  function safePixelRatio(width,height){
    const base=isMobile()?1.45:1.8;
    const maxPixels=isMobile()?18000000:32000000;
    const area=Math.max(1,width*height);
    const limit=Math.sqrt(maxPixels/area);
    return Math.max(.8,Math.min(base,limit));
  }

  async function renderBlob(node,width,height){
    const ratio=safePixelRatio(width,height);
    if(window.htmlToImage && typeof window.htmlToImage.toBlob==='function'){
      try{
        const blob=await window.htmlToImage.toBlob(node,{
          backgroundColor:'#ffffff',
          pixelRatio:ratio,
          cacheBust:true,
          includeQueryParams:true,
          width,
          height,
          style:{width:width+'px',height:height+'px',overflow:'visible'}
        });
        if(blob) return blob;
      }catch(e){ console.warn('[v1.22] html-to-image fallback',e); }
    }
    if(typeof window.html2canvas==='function'){
      const canvas=await window.html2canvas(node,{
        backgroundColor:'#ffffff',
        scale:ratio,
        useCORS:true,
        allowTaint:false,
        logging:false,
        width,
        height,
        windowWidth:width,
        windowHeight:height,
        scrollX:0,
        scrollY:0
      });
      return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG変換に失敗しました')),'image/png',1));
    }
    throw new Error('画像保存ライブラリが読み込めませんでした');
  }

  async function captureFullMap(){
    if(busy) return;
    busy=true;
    const buttons=[document.getElementById('saveImageBtn'),document.getElementById('mapSaveImageBtn')].filter(Boolean);
    const oldLabels=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{ b.disabled=true; b.textContent='全体画像を作成中…'; });
    let capture=null;
    try{
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      capture=await createFullCaptureNode();
      const blob=await renderBlob(capture.clone,capture.width,capture.height);
      if(!blob) throw new Error('PNG画像を作成できませんでした');

      const modal=ensurePreview();
      const preview=document.getElementById('v122Preview');
      const url=URL.createObjectURL(blob);
      if(preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.dataset.url=url;
      preview.src=url;
      modal.style.display='flex';
      document.getElementById('v122Share').onclick=()=>shareBlob(blob);
      document.getElementById('v122Download').onclick=()=>downloadBlob(blob);

      if(isMobile() && navigator.share && navigator.canShare){
        const file=new File([blob],`business-map-${VERSION}.png`,{type:'image/png'});
        try{
          if(navigator.canShare({files:[file]})) await navigator.share({files:[file],title:`Business Map ${VERSION}`});
        }catch(e){ if(!e || e.name!=='AbortError') console.warn(e); }
      }
    }catch(e){
      console.error(e);
      alert(`画像保存に失敗しました。\n${e.message||e}`);
    }finally{
      if(capture?.host?.parentNode) capture.host.remove();
      buttons.forEach((b,i)=>{ b.disabled=false; b.textContent=oldLabels[i]||'画像保存'; });
      busy=false;
    }
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=VERSION;
    document.title='Business Map v1.22';
  }

  function bind(){
    const top=document.getElementById('saveImageBtn');
    const map=document.getElementById('mapSaveImageBtn');
    if(top) top.onclick=captureFullMap;
    if(map) map.onclick=captureFullMap;
    window.saveImage=captureFullMap;
    window.v122CaptureFullMap=captureFullMap;
    refreshVersionLabel();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
