(function(){
  const H2C='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  let loading=null;

  function loadHtml2Canvas(){
    if(typeof window.html2canvas==='function') return Promise.resolve(window.html2canvas);
    if(loading) return loading;
    loading=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=H2C;
      s.async=true;
      s.onload=()=>typeof window.html2canvas==='function'?resolve(window.html2canvas):reject(new Error('html2canvas unavailable'));
      s.onerror=()=>reject(new Error('html2canvas load failed'));
      document.head.appendChild(s);
    });
    return loading;
  }

  function waitImages(root){
    const imgs=[...root.querySelectorAll('img')];
    return Promise.all(imgs.map(img=>{
      if(img.complete && img.naturalWidth>0) return Promise.resolve();
      return new Promise(res=>{
        const done=()=>res();
        img.addEventListener('load',done,{once:true});
        img.addEventListener('error',done,{once:true});
        setTimeout(done,2500);
      });
    }));
  }

  function captureTarget(){
    return document.querySelector('.app');
  }

  async function domCapture(){
    const root=captureTarget();
    if(!root){alert('保存対象が見つかりませんでした');return;}
    try{
      const html2canvas=await loadHtml2Canvas();
      if(document.fonts?.ready) await document.fonts.ready;
      await waitImages(root);

      const wrap=root.querySelector('.wrap');
      const tree=root.querySelector('.tree');
      const mapWidth=Math.max(tree?.scrollWidth||0,wrap?.scrollWidth||0);
      const targetWidth=Math.max(root.scrollWidth,mapWidth+40,900);
      const scale=Math.max(2,Math.min(3,window.devicePixelRatio||2));

      const canvas=await html2canvas(root,{
        backgroundColor:getComputedStyle(document.body).backgroundColor||'#f4f7fb',
        scale,
        useCORS:true,
        allowTaint:false,
        logging:false,
        width:targetWidth,
        windowWidth:targetWidth,
        scrollX:0,
        scrollY:-window.scrollY,
        onclone:(doc)=>{
          doc.querySelectorAll('.modal.open').forEach(x=>x.classList.remove('open'));
          const app=doc.querySelector('.app');
          if(app){
            app.style.maxWidth='none';
            app.style.width=targetWidth+'px';
            app.style.paddingBottom='28px';
          }
          const w=doc.querySelector('.wrap');
          const t=doc.querySelector('.tree');
          if(w){
            w.style.overflow='visible';
            w.style.maxWidth='none';
            w.style.width=(Math.max(t?.scrollWidth||0,w.scrollWidth)+20)+'px';
            w.style.height='auto';
          }
          if(t){
            const tw=t.scrollWidth;
            t.style.minWidth='0';
            t.style.width=tw+'px';
            t.style.transform='none';
          }
          // 保存用画像では操作ボタンだけ非表示。情報カードやフィルター、マップのデザインはそのまま残す。
          doc.querySelectorAll('#ex,#im,#png,#v1ImageSave,#v1SaveOpen,.v1-save-panel,.v1-savebar .btn,#add,#editSelf').forEach(x=>x.style.display='none');
          const topActions=doc.querySelector('.top>div:last-child');
          if(topActions && !topActions.textContent.trim()) topActions.style.display='none';
          const footer=doc.querySelector('footer');
          if(footer) footer.style.display='none';
        }
      });

      const dataUrl=canvas.toDataURL('image/png');
      window.PIMG=dataUrl;
      window.__businessMapPng=dataUrl;
      const preview=document.getElementById('pi');
      if(preview) preview.src=dataUrl;
      const modal=document.getElementById('pm');
      if(modal) modal.classList.add('open');
    }catch(e){
      console.error(e);
      alert('画像化に失敗しました。通信環境を確認してもう一度お試しください。');
    }
  }

  function bind(){
    const png=document.getElementById('png');
    if(png){png.onclick=domCapture;png.textContent='画像保存';}
    const visible=document.getElementById('v1ImageSave');
    if(visible){visible.onclick=domCapture;visible.textContent='画像保存';}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,0));
  else setTimeout(bind,0);
  // render拡張でボタンが再生成されるケースにも対応
  const mo=new MutationObserver(()=>bind());
  mo.observe(document.body,{childList:true,subtree:true});
})();
