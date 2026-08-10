(function(){
  const el=id=>document.getElementById(id);

  function triggerSave(){
    const bottom=el('save');
    if(bottom) bottom.click();
  }

  function ensureTopSave(){
    const sheet=document.querySelector('#modal .sheet');
    const grid=document.querySelector('#modal .grid');
    if(!sheet||!grid||el('v1TopSave'))return;
    const wrap=document.createElement('div');
    wrap.className='v1-top-save-wrap';
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='v1TopSave';
    btn.className='btn primary v1-save-large';
    btn.textContent='保存';
    btn.addEventListener('click',triggerSave);
    wrap.appendChild(btn);
    sheet.insertBefore(wrap,grid);
  }

  function enlargeBottomSave(){
    const btn=el('save');
    if(!btn)return;
    btn.classList.add('v1-save-large','v1-bottom-save');
  }

  function setup(){ensureTopSave();enlargeBottomSave();}

  if(typeof open==='function'){
    const oldOpen=open;
    open=function(id=null){oldOpen(id);setup();}
  }
  setup();
})();
