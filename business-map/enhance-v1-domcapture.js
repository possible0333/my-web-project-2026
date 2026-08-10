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
        let doneCalled=false;
        const done=()=>{if(doneCalled)return;doneCalled=true;res();};
        img.addEventListener('load',done,{once:true});
        img.addEventListener('error',done,{once:true});
        setTimeout(done,2500);
      });
    }));
  }

  function captureTarget(){
    return document.querySelector('.app');
  }

  function compactText(el){
    return (el?.innerText||'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  }

  function addMapSummary(doc,wrap){
    if(!wrap || doc.getElementById('v102CaptureSummary')) return;

    const stats=[...doc.querySelectorAll('#stats .box')].map(box=>{
      const label=compactText(box.querySelector('.small'));
      const value=compactText(box.querySelector('.big'));
      return {label,value};
    });
    const ranks=[...doc.querySelectorAll('#ranks .box')].map(box=>{
      const label=compactText(box.querySelector('.small'));
      const value=compactText(box.querySelector('.big'));
      return {label,value};
    });
    const types=[...doc.querySelectorAll('#types .chip')].map(x=>compactText(x)).filter(Boolean);

    const summary=doc.createElement('div');
    summary.id='v102CaptureSummary';
    summary.style.position='absolute';
    summary.style.inset='0';
    summary.style.pointerEvents='none';
    summary.style.zIndex='4';

    const left=doc.createElement('div');
    left.style.position='absolute';
    left.style.left='18px';
    left.style.top='54px';
    left.style.width='260px';
    left.style.padding='12px 14px';
    left.style.border='1px solid #dbe3ef';
    left.style.borderRadius='14px';
    left.style.background='rgba(255,255,255,.96)';
    left.style.boxShadow='0 5px 18px #0001';
    left.innerHTML='<div style="font-size:12px;font-weight:900;color:#172033;margin-bottom:7px">チーム状況</div>'+stats.map(x=>'<div style="display:flex;justify-content:space-between;gap:12px;font-size:10px;line-height:1.75"><span style="color:#697386">'+x.label+'</span><b style="color:#172033">'+x.value+'</b></div>').join('')+(types.length?'<div style="margin-top:7px;padding-top:7px;border-top:1px solid #edf1f5;font-size:9px;line-height:1.7;color:#586273">'+types.join('　')+'</div>':'');

    const right=doc.createElement('div');
    right.style.position='absolute';
    right.style.right='18px';
    right.style.top='54px';
    right.style.width='260px';
    right.style.padding='12px 14px';
    right.style.border='1px solid #dbe3ef';
    right.style.borderRadius='14px';
    right.style.background='rgba(255,255,255,.96)';
    right.style.boxShadow='0 5px 18px #0001';
    right.innerHTML='<div style="font-size:12px;font-weight:900;color:#172033;margin-bottom:7px">見込み内訳</div>'+ranks.map(x=>'<div style="display:flex;justify-content:space-between;gap:12px;font-size:10px;line-height:1.75"><span style="color:#697386">'+x.label+'</span><b style="color:#172033">'+x.value+'</b></div>').join('');

    summary.appendChild(left);
    summary.appendChild(right);
    wrap.appendChild(summary);
  }

  function applyCaptureLayout(doc,targetWidth){
    doc.querySelectorAll('.modal.open').forEach(x=>x.classList.remove('open'));
    doc.querySelectorAll('#ex,#im,#png,#v1ImageSave,#v1SaveOpen,.v1-save-panel,.v1-savebar,.v1-savebar .btn,#add,#editSelf').forEach(x=>x.style.display='none');

    const app=doc.querySelector('.app');
    if(app){
      app.style.maxWidth='none';
      app.style.width=targetWidth+'px';
      app.style.padding='18px 20px 28px';
      app.style.background='#f4f7fb';
    }

    /* 保存画像ではマップより上の情報をカット */
    ['.top','#self','#stats','#ranks','#types'].forEach(sel=>doc.querySelectorAll(sel).forEach(x=>x.style.display='none'));

    const section=doc.querySelector('.section');
    if(section){
      section.style.marginTop='0';
      section.style.background='#fff';
      section.style.borderRadius='18px';
      section.style.padding='12px';
      section.style.boxShadow='0 5px 18px #0001';
    }

    /* 見出し・フィルター・凡例も保存画像では非表示 */
    doc.querySelectorAll('.section>.title,.v12-tools,.v12-legend').forEach(x=>x.style.display='none');

    const w=doc.querySelector('.wrap');
    const t=doc.querySelector('.tree');
    if(w){
      w.style.position='relative';
      w.style.overflow='visible';
      w.style.maxWidth='none';
      w.style.padding='8px 4px 4px';
      w.style.width=(Math.max(t?.scrollWidth||0,w.scrollWidth)+12)+'px';
      w.style.height='auto';
      w.style.borderRadius='12px';
      w.style.background='#fff';
    }
    if(t){
      const tw=t.scrollWidth;
      t.style.minWidth='0';
      t.style.width=tw+'px';
      t.style.transform='none';
      t.style.zoom='1';
    }

    /* マップ中央はそのまま、左右の余白へサマリーを配置 */
    addMapSummary(doc,w);

    doc.querySelectorAll('.level').forEach(x=>{
      x.style.paddingTop='24px';
      x.style.paddingBottom='14px';
      x.style.gap='12px';
    });

    const footer=doc.querySelector('footer');
    if(footer) footer.style.display='none';
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
      const targetWidth=Math.max(mapWidth+56,960);
      const scale=Math.max(2,Math.min(3,window.devicePixelRatio||2));

      const canvas=await html2canvas(root,{
        backgroundColor:'#f4f7fb',
        scale,
        useCORS:true,
        allowTaint:false,
        logging:false,
        width:targetWidth,
        windowWidth:targetWidth,
        scrollX:0,
        scrollY:-window.scrollY,
        onclone:(doc)=>applyCaptureLayout(doc,targetWidth)
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
    if(png){
      png.onclick=domCapture;
      if(png.textContent!=='画像保存') png.textContent='画像保存';
    }
    const visible=document.getElementById('v1ImageSave');
    if(visible){
      visible.onclick=domCapture;
      if(visible.textContent!=='画像保存') visible.textContent='画像保存';
    }
  }

  function bindWithRetries(){
    bind();
    setTimeout(bind,300);
    setTimeout(bind,1000);
    setTimeout(bind,2500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindWithRetries,{once:true});
  else bindWithRetries();
})();
// map-main capture layout v3 / Business Map v1.02
