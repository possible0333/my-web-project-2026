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

    const top=doc.querySelector('.top');
    if(top){
      top.style.display='flex';
      top.style.alignItems='center';
      top.style.justifyContent='space-between';
      top.style.margin='0 0 8px';
      top.style.minHeight='32px';
    }
    const brand=doc.querySelector('.brand');
    if(brand){brand.style.fontSize='20px';brand.style.lineHeight='1.1';}
    const topActions=doc.querySelector('.top>div:last-child');
    if(topActions) topActions.style.display='none';

    const self=doc.querySelector('#self');
    if(self){
      self.style.marginTop='6px';
      self.style.borderRadius='14px';
      self.style.padding='9px 12px';
      self.style.gridTemplateColumns='52px minmax(0,1fr)';
      self.style.gap='9px';
      self.style.minHeight='0';
    }
    doc.querySelectorAll('#self img').forEach(x=>{
      x.style.width='48px';x.style.height='48px';x.style.borderWidth='2px';
    });
    doc.querySelectorAll('#self h2').forEach(x=>{x.style.fontSize='17px';x.style.lineHeight='1.1';});
    doc.querySelectorAll('#self .kpis').forEach(x=>{
      x.style.marginTop='5px';x.style.gap='5px';x.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';
    });
    doc.querySelectorAll('#self .box').forEach(x=>{x.style.padding='5px 7px';x.style.borderRadius='8px';});
    doc.querySelectorAll('#self .big').forEach(x=>{x.style.fontSize='14px';x.style.lineHeight='1.15';});
    doc.querySelectorAll('#self .small').forEach(x=>{x.style.fontSize='9px';});

    const stats=doc.querySelector('#stats');
    if(stats){
      stats.style.marginTop='6px';
      stats.style.gap='5px';
      stats.style.gridTemplateColumns='repeat(4,minmax(0,1fr))';
    }
    const ranks=doc.querySelector('#ranks');
    if(ranks){
      ranks.style.marginTop='5px';
      ranks.style.gap='5px';
      ranks.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';
    }
    doc.querySelectorAll('#stats .box,#ranks .box').forEach(x=>{x.style.padding='6px 8px';x.style.borderRadius='8px';});
    doc.querySelectorAll('#stats .big,#ranks .big').forEach(x=>{x.style.fontSize='13px';x.style.lineHeight='1.15';});
    doc.querySelectorAll('#stats .small,#ranks .small').forEach(x=>{x.style.fontSize='9px';});

    const types=doc.querySelector('#types');
    if(types){
      types.style.marginTop='5px';
      types.style.gap='5px';
      types.style.flexWrap='nowrap';
    }
    doc.querySelectorAll('#types .chip').forEach(x=>{
      x.style.padding='4px 8px';x.style.fontSize='9px';x.style.borderRadius='12px';
    });

    const section=doc.querySelector('.section');
    if(section){
      section.style.marginTop='10px';
      section.style.background='#fff';
      section.style.borderRadius='16px';
      section.style.padding='12px';
      section.style.boxShadow='0 5px 18px #0001';
    }
    const title=section?.querySelector('.title');
    if(title){
      title.style.margin='0 0 4px';
      title.style.minHeight='30px';
    }
    const h3=title?.querySelector('h3');
    if(h3){
      h3.style.margin='0';
      h3.style.fontSize='19px';
      h3.style.fontWeight='900';
    }

    const w=doc.querySelector('.wrap');
    const t=doc.querySelector('.tree');
    if(w){
      w.style.overflow='visible';
      w.style.maxWidth='none';
      w.style.padding='8px 4px 4px';
      w.style.width=(Math.max(t?.scrollWidth||0,w.scrollWidth)+12)+'px';
      w.style.height='auto';
      w.style.borderRadius='10px';
      w.style.background='#fff';
    }
    if(t){
      const tw=t.scrollWidth;
      t.style.minWidth='0';
      t.style.width=tw+'px';
      t.style.transform='none';
      t.style.zoom='1';
    }
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
// map-main capture layout v2
