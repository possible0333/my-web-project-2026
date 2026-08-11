(function(){
  const PATCH_VERSION='v1.16';

  function isNextMonth(person){
    return Boolean(person && person.id!=='self' && person.status==='next-month');
  }

  function nextMonthPeople(){
    try{
      return (state.members || []).filter(isNextMonth);
    }catch(e){
      return [];
    }
  }

  function ensurePanel(){
    let panel=document.getElementById('nextMonthProspects');
    if(panel) return panel;
    const wrap=document.querySelector('.map-wrap');
    if(!wrap) return null;
    panel=document.createElement('aside');
    panel.id='nextMonthProspects';
    panel.className='v116-next-panel';
    panel.setAttribute('aria-label','来月以降');
    const canvas=wrap.querySelector('.map-canvas');
    if(canvas) wrap.insertBefore(panel,canvas);
    else wrap.appendChild(panel);
    return panel;
  }

  function renderNextMonthPanel(){
    const panel=ensurePanel();
    if(!panel) return;
    const people=nextMonthPeople();
    panel.innerHTML=`
      <div class="v116-next-title"><span aria-hidden="true">📅</span>来月以降 <b>${people.length}人</b></div>
      <div class="v116-next-names">
        ${people.map(p=>`<button type="button" class="v116-next-name" data-next-id="${escapeHtml(p.id)}">${escapeHtml(p.name || '名称未設定')}</button>`).join('')}
      </div>
      ${people.length ? '' : '<div class="v116-next-empty">該当者なし</div>'}`;
    panel.querySelectorAll('[data-next-id]').forEach(btn=>{
      btn.onclick=e=>{
        e.stopPropagation();
        if(typeof openModal==='function') openModal(btn.dataset.nextId);
      };
    });
  }

  function patchVisiblePeople(){
    if(typeof visiblePeople!=='function' || visiblePeople.__v116) return;
    const original=visiblePeople;
    const wrapped=function(){
      return original.apply(this,arguments).filter(p=>!isNextMonth(p));
    };
    wrapped.__v116=true;
    visiblePeople=wrapped;
  }

  function patchRender(){
    if(typeof render!=='function' || render.__v116) return;
    const original=render;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      renderNextMonthPanel();
      return result;
    };
    wrapped.__v116=true;
    render=wrapped;
  }

  function patchStatusChange(){
    const select=document.getElementById('fStatus');
    if(!select || select.dataset.v116Bound==='1') return;
    select.dataset.v116Bound='1';
    select.addEventListener('change',()=>{
      const box=select.closest('.v116-status-priority');
      if(box) box.classList.toggle('is-next-month',select.value==='next-month');
    });
  }

  function patchOpenModal(){
    if(typeof openModal!=='function' || openModal.__v116) return;
    const original=openModal;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      const select=document.getElementById('fStatus');
      const box=select?.closest('.v116-status-priority');
      if(box) box.classList.toggle('is-next-month',select.value==='next-month');
      patchStatusChange();
      return result;
    };
    wrapped.__v116=true;
    openModal=wrapped;
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.16';
  }

  function bind(){
    patchVisiblePeople();
    patchRender();
    patchOpenModal();
    patchStatusChange();
    refreshVersionLabel();
    renderNextMonthPanel();
    if(typeof renderTree==='function') renderTree();

    window.v116RenderNextMonthPanel=renderNextMonthPanel;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
