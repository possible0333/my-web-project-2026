(function(){
  const APP_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.49';
  let busy=false;

  const raf=()=>new Promise(r=>requestAnimationFrame(r));
  async function raf2(){ await raf(); await raf(); }
  function isMobile(){ return matchMedia('(max-width:720px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

  function directGridMetrics(count){
    const columns=count<=0?0:count<=3?count:count<=6?3:4;
    const cardWidth=172,gap=8,padding=24;
    return {columns,width:columns?columns*cardWidth+(columns-1)*gap+padding:0};
  }

  function applyDirectGrid(direct){
    const cards=[...direct.querySelectorAll('.v127-mini-card')];
    const metrics=directGridMetrics(cards.length);
    if(!metrics.columns) return metrics;
    direct.style.setProperty('width',metrics.width+'px','important');
    direct.style.setProperty('min-width','0','important');
    direct.style.setProperty('max-width',metrics.width+'px','important');
    const grid=direct.querySelector('.v127-direct-cards');
    if(grid){
      grid.style.setProperty('display','grid','important');
      grid.style.setProperty('grid-template-columns',`repeat(${metrics.columns},minmax(0,1fr))`,'important');
      grid.style.setProperty('gap','8px','important');
      grid.style.setProperty('justify-content','center','important');
    }
    cards.forEach(card=>{
      card.style.setProperty('width','100%','important');
      card.style.setProperty('min-width','0','important');
      card.style.setProperty('box-sizing','border-box','important');
    });
    return metrics;
  }

  function applyVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function waitImages(root){
    return Promise.all([...root.querySelectorAll('img')].map(img=>{
      if(img.complete&&img.naturalWidth) return Promise.resolve();
      return new Promise(resolve=>{
        const done=()=>resolve();
        img.addEventListener('load',done,{once:true});
        img.addEventListener('error',done,{once:true});
        setTimeout(done,2000);
      });
    }));
  }

  function buildSurface(){
    const sourceRows=document.getElementById('treeRows');
    const sourceArea=document.getElementById('mapCanvasArea');
    const legend=document.getElementById('legend');
    const next=document.getElementById('nextMonthProspects');
    if(!sourceRows||!sourceArea) throw new Error('ネットワークマップが見つかりませんでした');

    const directCount=sourceRows.querySelectorAll('.v127-direct-zone .v127-mini-card').length;
    const directWidth=directGridMetrics(directCount).width;
    const provisionalWidth=Math.max(20000,directWidth+2000);
    const treeWidth=provisionalWidth;
    const width=provisionalWidth;
    const host=document.createElement('div');
    host.id='v135CaptureHost';
    host.style.cssText=`position:fixed;left:-100000px;top:0;width:${width}px;background:#fff;z-index:-99999;pointer-events:none;overflow:visible;`;

    const surface=document.createElement('div');
    surface.style.cssText=`width:${width}px;background:#fff;padding:14px 16px 18px;box-sizing:border-box;overflow:visible;`;

    const top=document.createElement('div');
    top.style.cssText='display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;';
    if(legend){
      const l=legend.cloneNode(true); l.removeAttribute('id');
      l.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex:1;padding:0;margin:0;font-size:11px;color:#64748b;';
      top.appendChild(l);
    }
    if(next){
      const n=next.cloneNode(true); n.removeAttribute('id');
      n.style.cssText='position:static!important;inset:auto!important;width:auto!important;max-width:260px!important;margin:0!important;padding:8px 10px!important;box-shadow:none!important;flex:0 0 auto;';
      top.appendChild(n);
    }
    if(top.children.length) surface.appendChild(top);

    const area=sourceArea.cloneNode(true);
    area.removeAttribute('id');
    area.style.cssText=`position:relative;width:${treeWidth}px;min-width:${treeWidth}px;max-width:none;min-height:0;padding:0;margin:0 auto;overflow:visible;zoom:1;transform:none;`;
    const rows=area.querySelector('#treeRows');
    if(rows){
      rows.style.cssText='width:max-content;min-width:max-content;max-width:none;margin:0 auto;padding-top:6px;zoom:1;transform:none;';
      const direct=rows.querySelector('.v127-direct-zone');
      if(direct) applyDirectGrid(direct);
    }
    surface.appendChild(area);
    host.appendChild(surface);
    document.body.appendChild(host);

    // Measure only the cloned content. The live map may retain a very large
    // scrollWidth after zooming, resizing, or rendering many members.
    const network=rows?.querySelector('.v127-network') || rows;
    const measuredTree=Math.ceil(Math.max(
      network?.getBoundingClientRect().width||0,
      network?.scrollWidth||0,
      directWidth
    ));
    const finalWidth=Math.max(620,measuredTree+32);
    host.style.width=finalWidth+'px';
    surface.style.width=finalWidth+'px';
    top.style.width=(finalWidth-32)+'px';
    top.style.marginLeft='auto';
    top.style.marginRight='auto';
    area.style.width=(finalWidth-32)+'px';
    area.style.minWidth=(finalWidth-32)+'px';
    if(rows){
      rows.style.width='max-content';
      rows.style.minWidth='max-content';
      rows.style.margin='0 auto';
    }
    return {host,surface};
  }

  function ratio(w,h){
    const base=isMobile()?1.4:1.8;
    const max=isMobile()?18000000:32000000;
    return Math.max(.85,Math.min(base,Math.sqrt(max/Math.max(1,w*h))));
  }

  async function trimBlob(blob,centerHint){
    const bitmap=await createImageBitmap(blob);
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width; canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0);
    bitmap.close?.();
    const {data,width,height}=ctx.getImageData(0,0,canvas.width,canvas.height);
    let minX=width,minY=height,maxX=-1,maxY=-1;
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4;
        const visible=data[i+3]>12 && (data[i]<247 || data[i+1]<247 || data[i+2]<247);
        if(!visible) continue;
        if(x<minX) minX=x; if(x>maxX) maxX=x;
        if(y<minY) minY=y; if(y>maxY) maxY=y;
      }
    }
    if(maxX<minX||maxY<minY) return blob;
    const pad=Math.max(12,Math.round(width*.008));
    // The capture surface centers MAP OWNER. Crop equal distances from that
    // center so the saved image keeps the owner visually centered.
    const center=Number.isFinite(centerHint)?Math.max(0,Math.min(width,centerHint)):width/2;
    const half=Math.max(center-minX,maxX-center)+pad;
    const sx=Math.max(0,Math.floor(center-half));
    const ex=Math.min(width,Math.ceil(center+half));
    const sy=Math.max(0,minY-pad), ey=Math.min(height,maxY+pad+1);
    const out=document.createElement('canvas');
    out.width=Math.max(1,ex-sx); out.height=Math.max(1,ey-sy);
    out.getContext('2d').drawImage(canvas,sx,sy,out.width,out.height,0,0,out.width,out.height);
    return await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('画像トリムに失敗しました')),'image/png',1));
  }

  async function render(surface){
    await waitImages(surface);
    await raf2();
    const w=Math.ceil(surface.scrollWidth), h=Math.ceil(surface.scrollHeight), scale=ratio(w,h);
    const sr=surface.getBoundingClientRect();
    const owner=surface.querySelector('[data-id="self"]')?.getBoundingClientRect();
    const ownerCenter=owner?((owner.left+owner.width/2)-sr.left)*scale:null;
    if(window.htmlToImage?.toBlob){
      try{
        const blob=await htmlToImage.toBlob(surface,{backgroundColor:'#fff',pixelRatio:scale,cacheBust:true,includeQueryParams:true,width:w,height:h,style:{width:w+'px',height:h+'px',overflow:'visible'}});
        if(blob) return await trimBlob(blob,ownerCenter);
      }catch(e){ console.warn(`[${APP_VERSION}] html-to-image fallback`,e); }
    }
    if(window.html2canvas){
      const canvas=await html2canvas(surface,{backgroundColor:'#fff',scale,useCORS:true,allowTaint:false,logging:false,width:w,height:h,windowWidth:w,windowHeight:h,scrollX:0,scrollY:0});
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG変換に失敗しました')),'image/png',1));
      return await trimBlob(blob,ownerCenter);
    }
    throw new Error('画像保存ライブラリが読み込めませんでした');
  }

  async function createBlob(){
    let cap;
    try{
      if(typeof window.v126Recalculate==='function') window.v126Recalculate();
      if(document.fonts?.ready) await document.fonts.ready;
      await raf2();
      cap=buildSurface();
      return await render(cap.surface);
    }finally{
      cap?.host?.remove();
    }
  }

  function download(blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`business-map-${APP_VERSION}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }

  async function share(blob){
    const file=new File([blob],`business-map-${APP_VERSION}.png`,{type:'image/png'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{ await navigator.share({files:[file],title:`Business Map ${APP_VERSION}`}); return; }
      catch(e){ if(e?.name==='AbortError') return; }
    }
    download(blob);
  }

  function preview(blob){
    let modal=document.getElementById('v135ImageModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='v135ImageModal';
      modal.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.52);display:none;align-items:center;justify-content:center;padding:12px;';
      modal.innerHTML=`<div style="width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px"><div><b style="font-size:17px;color:#172033">Business Map画像 ${APP_VERSION}</b><div style="font-size:10px;color:#64748b;margin-top:2px">実コンテンツに合わせてトリム・自分を中央に配置</div></div><button class="btn ghost" id="v135Close">閉じる</button></div><div style="background:#eef2f7;border-radius:12px;padding:6px;overflow:auto"><img id="v135Preview" style="display:block;max-width:100%;height:auto;margin:auto;background:#fff"></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:9px"><button class="btn primary" id="v135Share">共有・保存</button><button class="btn" id="v135Download">ダウンロード</button></div></div>`;
      document.body.appendChild(modal);
      document.getElementById('v135Close').onclick=()=>modal.style.display='none';
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.style.display='none'; });
    }
    const img=document.getElementById('v135Preview');
    if(img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    const url=URL.createObjectURL(blob); img.dataset.url=url; img.src=url;
    document.getElementById('v135Share').onclick=()=>share(blob);
    document.getElementById('v135Download').onclick=()=>download(blob);
    modal.style.display='flex';
  }

  async function capture(){
    if(busy) return;
    busy=true;
    const buttons=[document.getElementById('saveImageBtn'),document.getElementById('mapSaveImageBtn')].filter(Boolean);
    const old=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{b.disabled=true;b.textContent='画像作成中…';});
    try{
      const blob=await createBlob();
      preview(blob);
      return blob;
    }catch(e){
      console.error(e); alert(`画像保存に失敗しました。\n${e.message||e}`);
      throw e;
    }finally{
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]||'画像保存';});
      busy=false;
    }
  }

  function bind(){
    applyVersion();
    const top=document.getElementById('saveImageBtn');
    const map=document.getElementById('mapSaveImageBtn');
    if(top) top.onclick=capture;
    if(map) map.onclick=capture;
    window.saveImage=capture;
    window.v135Capture=capture;
    window.v135CreateBlob=createBlob;
    window.v135DirectGridMetrics=directGridMetrics;

    document.addEventListener('click',e=>{
      const btn=e.target.closest('#v130MobileBar [data-v130-action="save"]');
      if(!btn) return;
      e.preventDefault(); e.stopImmediatePropagation(); capture();
    },true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
