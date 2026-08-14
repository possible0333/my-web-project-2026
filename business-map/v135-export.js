(function(){
  const APP_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.42';
  let busy=false;

  const raf=()=>new Promise(r=>requestAnimationFrame(r));
  async function raf2(){ await raf(); await raf(); }
  function isMobile(){ return matchMedia('(max-width:720px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

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

    const treeWidth=Math.ceil(Math.max(sourceRows.scrollWidth,sourceRows.offsetWidth,720));
    const width=Math.ceil(Math.max(treeWidth,620)+32);
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
      if(direct){
        const directWidth=Math.min(760,Math.max(360,treeWidth-40));
        direct.style.setProperty('width',directWidth+'px','important');
        direct.style.setProperty('min-width','0','important');
        direct.style.setProperty('max-width',directWidth+'px','important');
        const cards=direct.querySelector('.v127-direct-cards');
        if(cards){ cards.style.flexWrap='wrap'; cards.style.maxWidth='100%'; }
      }
    }
    surface.appendChild(area);
    host.appendChild(surface);
    document.body.appendChild(host);
    return {host,surface};
  }

  function ratio(w,h){
    const base=isMobile()?1.4:1.8;
    const max=isMobile()?18000000:32000000;
    return Math.max(.85,Math.min(base,Math.sqrt(max/Math.max(1,w*h))));
  }

  async function render(surface){
    await waitImages(surface);
    await raf2();
    const w=Math.ceil(surface.scrollWidth), h=Math.ceil(surface.scrollHeight), scale=ratio(w,h);
    if(window.htmlToImage?.toBlob){
      try{
        const blob=await htmlToImage.toBlob(surface,{backgroundColor:'#fff',pixelRatio:scale,cacheBust:true,includeQueryParams:true,width:w,height:h,style:{width:w+'px',height:h+'px',overflow:'visible'}});
        if(blob) return blob;
      }catch(e){ console.warn(`[${APP_VERSION}] html-to-image fallback`,e); }
    }
    if(window.html2canvas){
      const canvas=await html2canvas(surface,{backgroundColor:'#fff',scale,useCORS:true,allowTaint:false,logging:false,width:w,height:h,windowWidth:w,windowHeight:h,scrollX:0,scrollY:0});
      return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG変換に失敗しました')),'image/png',1));
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
      modal.innerHTML=`<div style="width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px"><div><b style="font-size:17px;color:#172033">Business Map画像 ${APP_VERSION}</b><div style="font-size:10px;color:#64748b;margin-top:2px">マップ全体を余白少なめで保存</div></div><button class="btn ghost" id="v135Close">閉じる</button></div><div style="background:#eef2f7;border-radius:12px;padding:6px;overflow:auto"><img id="v135Preview" style="display:block;max-width:100%;height:auto;margin:auto;background:#fff"></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:9px"><button class="btn primary" id="v135Share">共有・保存</button><button class="btn" id="v135Download">ダウンロード</button></div></div>`;
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

    document.addEventListener('click',e=>{
      const btn=e.target.closest('#v130MobileBar [data-v130-action="save"]');
      if(!btn) return;
      e.preventDefault(); e.stopImmediatePropagation(); capture();
    },true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
