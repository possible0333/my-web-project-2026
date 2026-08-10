(function(){
  const VERSION='v1.14';
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
        setTimeout(finish,2500);
      });
    }));
  }

  function ensurePreview(){
    let modal=document.getElementById('v112ImageModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='v112ImageModal';
    modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);display:none;align-items:center;justify-content:center;padding:14px;';
    modal.innerHTML=`
      <div style="width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:14px;box-shadow:0 24px 70px rgba(15,23,42,.25)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:18px;font-weight:900;color:#172033">Business Map画像 ${VERSION}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">Web上のネットワークマップをそのまま画像化</div>
          </div>
          <button type="button" class="btn ghost" id="v112Close">閉じる</button>
        </div>
        <div style="background:#eef2f7;border-radius:14px;padding:8px;overflow:auto"><img id="v112Preview" alt="Business Map画像" style="display:block;max-width:100%;height:auto;margin:auto;border-radius:10px;background:#fff"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px">
          <button type="button" class="btn primary" id="v112Share">共有・保存</button>
          <button type="button" class="btn" id="v112Download">ダウンロード</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('v112Close').onclick=()=>{ modal.style.display='none'; };
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
        console.warn('share failed',e);
      }
    }
    downloadBlob(blob);
    return true;
  }

  function safePixelRatio(node){
    const rect=node.getBoundingClientRect();
    const base=isMobile()?1.6:2;
    const maxPixels=isMobile()?18000000:32000000;
    const area=Math.max(1,rect.width*rect.height);
    const limit=Math.sqrt(maxPixels/area);
    return Math.max(1,Math.min(base,limit));
  }

  async function renderBlob(node){
    const ratio=safePixelRatio(node);
    if(window.htmlToImage && typeof window.htmlToImage.toBlob==='function'){
      return await window.htmlToImage.toBlob(node,{
        backgroundColor:'#ffffff',
        pixelRatio:ratio,
        cacheBust:true,
        includeQueryParams:true
      });
    }
    if(typeof window.html2canvas==='function'){
      const canvas=await window.html2canvas(node,{
        backgroundColor:'#ffffff',
        scale:ratio,
        useCORS:true,
        allowTaint:false,
        logging:false,
        scrollX:0,
        scrollY:0
      });
      return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG変換に失敗しました')),'image/png',1));
    }
    throw new Error('画像保存ライブラリが読み込めませんでした');
  }

  async function captureCurrentMap(){
    if(busy) return;
    busy=true;
    const buttons=[document.getElementById('saveImageBtn'),document.getElementById('mapSaveImageBtn')].filter(Boolean);
    const oldLabels=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{ b.disabled=true; b.textContent='画像作成中…'; });
    try{
      const node=document.querySelector('.map-wrap');
      if(!node) throw new Error('ネットワークマップが見つかりませんでした');

      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      await waitForImages(node);
      if(typeof window.v111ApplyDensity==='function') window.v111ApplyDensity();
      if(typeof window.drawLines==='function') window.drawLines();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

      const blob=await renderBlob(node);
      if(!blob) throw new Error('PNG画像を作成できませんでした');

      const modal=ensurePreview();
      const preview=document.getElementById('v112Preview');
      const url=URL.createObjectURL(blob);
      if(preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.dataset.url=url;
      preview.src=url;
      modal.style.display='flex';
      document.getElementById('v112Share').onclick=()=>shareBlob(blob);
      document.getElementById('v112Download').onclick=()=>downloadBlob(blob);

      if(isMobile() && navigator.share && navigator.canShare){
        const file=new File([blob],`business-map-${VERSION}.png`,{type:'image/png'});
        try{
          if(navigator.canShare({files:[file]})) await navigator.share({files:[file],title:`Business Map ${VERSION}`});
        }catch(e){
          if(!e || e.name!=='AbortError') console.warn(e);
        }
      }
    }catch(e){
      console.error(e);
      alert(`画像保存に失敗しました。\n${e.message||e}`);
    }finally{
      buttons.forEach((b,i)=>{ b.disabled=false; b.textContent=oldLabels[i]||'画像保存'; });
      busy=false;
    }
  }

  function bind(){
    const top=document.getElementById('saveImageBtn');
    const map=document.getElementById('mapSaveImageBtn');
    if(top) top.onclick=captureCurrentMap;
    if(map) map.onclick=captureCurrentMap;
    window.saveImage=captureCurrentMap;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
