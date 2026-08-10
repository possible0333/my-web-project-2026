(function(){
  const VERSION='v1.05';
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
    let modal=document.getElementById('v104ImageModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='v104ImageModal';
    modal.innerHTML=`
      <div class="v104-image-sheet">
        <div class="v104-image-head">
          <div>
            <div class="v104-image-title">Business Map画像</div>
            <div class="v104-image-note">スマホは「共有・保存」から写真アプリ等へ保存できます</div>
          </div>
          <button type="button" class="btn ghost" id="v104ImageClose">閉じる</button>
        </div>
        <div class="v104-image-preview-wrap"><img id="v104ImagePreview" alt="Business Map画像"></div>
        <div class="v104-image-actions">
          <button type="button" class="btn primary" id="v104ShareImage">共有・保存</button>
          <button type="button" class="btn" id="v104DownloadImage">ダウンロード</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('v104ImageClose').onclick=()=>modal.classList.remove('open');
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.remove('open'); });
    return modal;
  }

  function blobFromCanvas(canvas){
    return new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG変換に失敗しました')),'image/png',1);
    });
  }

  async function shareOrDownload(blob, preferShare=true){
    const file=new File([blob],`business-map-${VERSION}.png`,{type:'image/png'});
    if(preferShare && navigator.share && navigator.canShare){
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
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`business-map-${VERSION}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    return true;
  }

  async function createImage(){
    if(busy) return;
    busy=true;
    const buttons=[document.getElementById('saveImageBtn'),document.getElementById('mapSaveImageBtn')].filter(Boolean);
    const oldLabels=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{b.disabled=true;b.textContent='画像作成中…';});
    try{
      if(typeof window.html2canvas!=='function') throw new Error('画像保存ライブラリが読み込めませんでした');
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      if(typeof window.drawLines==='function') window.drawLines();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      if(typeof window.buildExportSurface!=='function') throw new Error('保存画像の作成処理が見つかりませんでした');
      const root=window.buildExportSurface();
      await waitForImages(root);
      const width=Math.max(root.scrollWidth,1500);
      const canvas=await window.html2canvas(root,{
        backgroundColor:'#ffffff',
        scale:isMobile()?1.7:2,
        useCORS:true,
        allowTaint:false,
        logging:false,
        width,
        windowWidth:width,
        scrollX:0,
        scrollY:0
      });
      const blob=await blobFromCanvas(canvas);
      const modal=ensurePreview();
      const preview=document.getElementById('v104ImagePreview');
      const previewUrl=URL.createObjectURL(blob);
      if(preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.dataset.url=previewUrl;
      preview.src=previewUrl;
      modal.classList.add('open');
      document.getElementById('v104ShareImage').onclick=()=>shareOrDownload(blob,true);
      document.getElementById('v104DownloadImage').onclick=()=>shareOrDownload(blob,false);
      if(isMobile() && navigator.share && navigator.canShare){
        const file=new File([blob],`business-map-${VERSION}.png`,{type:'image/png'});
        if(navigator.canShare({files:[file]})){
          try{ await navigator.share({files:[file],title:`Business Map ${VERSION}`}); }
          catch(e){ if(!e || e.name!=='AbortError') console.warn(e); }
        }
      }
    }catch(e){
      console.error(e);
      alert(`画像保存に失敗しました。\n${e.message||e}`);
    }finally{
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=oldLabels[i]||'画像保存';});
      busy=false;
    }
  }

  function addMapButton(){
    const sectionHead=document.querySelector('.section .section-head');
    if(!sectionHead || document.getElementById('mapSaveImageBtn')) return;
    const controls=sectionHead.querySelector('.controls');
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='mapSaveImageBtn';
    btn.className='btn dark map-save-image-btn';
    btn.textContent='画像保存';
    btn.onclick=createImage;
    if(controls) controls.insertBefore(btn,controls.firstChild);
    else sectionHead.appendChild(btn);
  }

  function bind(){
    addMapButton();
    const top=document.getElementById('saveImageBtn');
    if(top) top.onclick=createImage;
  }

  window.saveImage=createImage;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
