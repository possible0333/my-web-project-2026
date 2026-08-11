(function(){
  const PATCH_VERSION='v1.15';

  function normalizePerson(person){
    if(person && typeof person.nextMonthProspect !== 'boolean'){
      person.nextMonthProspect = Boolean(person.nextMonthProspect);
    }
    return person;
  }

  function normalizeState(){
    try{
      normalizePerson(state.self);
      (state.members || []).forEach(normalizePerson);
    }catch(e){
      console.warn('[v1.15] next-month normalization skipped', e);
    }
  }

  function ensureFormField(){
    if(document.getElementById('nextMonthField')) return;
    const statusField=document.getElementById('fStatus')?.closest('.field');
    if(!statusField) return;
    const field=document.createElement('div');
    field.className='field';
    field.id='nextMonthField';
    field.innerHTML=`
      <label>来月見込み</label>
      <label class="v115-toggle" for="fNextMonthProspect">
        <input type="checkbox" id="fNextMonthProspect">
        <span class="v115-switch" aria-hidden="true"></span>
        <span class="v115-toggle-text">来月のアップ候補として表示</span>
      </label>`;
    statusField.insertAdjacentElement('afterend', field);
  }

  function ensurePanel(){
    let panel=document.getElementById('nextMonthProspects');
    if(panel) return panel;
    const wrap=document.querySelector('.map-wrap');
    if(!wrap) return null;
    panel=document.createElement('aside');
    panel.id='nextMonthProspects';
    panel.className='v115-next-panel';
    panel.setAttribute('aria-label','来月見込み');
    const canvas=wrap.querySelector('.map-canvas');
    if(canvas) wrap.insertBefore(panel, canvas);
    else wrap.appendChild(panel);
    return panel;
  }

  function nextMonthPeople(){
    try{
      return (state.members || []).filter(p=>p.nextMonthProspect);
    }catch(e){
      return [];
    }
  }

  function highlightPerson(id){
    const card=document.querySelector(`.member-card[data-id="${CSS.escape(id)}"]`);
    if(!card) return;
    card.classList.remove('v115-highlight');
    void card.offsetWidth;
    card.classList.add('v115-highlight');
    try{ card.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); }catch(e){}
    setTimeout(()=>card.classList.remove('v115-highlight'),1600);
  }

  function renderNextMonthPanel(){
    const panel=ensurePanel();
    if(!panel) return;
    const people=nextMonthPeople();
    panel.innerHTML=`
      <div class="v115-next-title"><span class="v115-calendar">📅</span>来月見込み <b>${people.length}人</b></div>
      <div class="v115-next-names">
        ${people.map(p=>`<button type="button" class="v115-next-name" data-next-id="${escapeHtml(p.id)}">${escapeHtml(p.name || '名称未設定')}</button>`).join('')}
      </div>`;
    panel.classList.toggle('is-empty', people.length===0);
    panel.querySelectorAll('[data-next-id]').forEach(btn=>{
      btn.onclick=e=>{
        e.stopPropagation();
        highlightPerson(btn.dataset.nextId);
      };
    });
  }

  function patchMigrate(){
    if(typeof migrate!=='function' || migrate.__v115) return;
    const original=migrate;
    const wrapped=function(raw){
      const next=original.apply(this,arguments);
      normalizePerson(next.self);
      (next.members || []).forEach(normalizePerson);
      return next;
    };
    wrapped.__v115=true;
    migrate=wrapped;
  }

  function patchGatherForm(){
    if(typeof gatherForm!=='function' || gatherForm.__v115) return;
    const original=gatherForm;
    const wrapped=function(){
      const data=original.apply(this,arguments);
      const checkbox=document.getElementById('fNextMonthProspect');
      data.nextMonthProspect = editingId==='self' ? false : Boolean(checkbox?.checked);
      return data;
    };
    wrapped.__v115=true;
    gatherForm=wrapped;
  }

  function patchOpenModal(){
    if(typeof openModal!=='function' || openModal.__v115) return;
    const original=openModal;
    const wrapped=function(id){
      original.apply(this,arguments);
      ensureFormField();
      const field=document.getElementById('nextMonthField');
      const checkbox=document.getElementById('fNextMonthProspect');
      const person=id ? getPerson(id) : null;
      if(field) field.style.display = id==='self' ? 'none' : '';
      if(checkbox) checkbox.checked = id==='self' ? false : Boolean(person?.nextMonthProspect);
    };
    wrapped.__v115=true;
    openModal=wrapped;
  }

  function patchRender(){
    if(typeof render!=='function' || render.__v115) return;
    const original=render;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      renderNextMonthPanel();
      return result;
    };
    wrapped.__v115=true;
    render=wrapped;
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.15';
  }

  function bind(){
    ensureFormField();
    patchMigrate();
    patchGatherForm();
    patchOpenModal();
    patchRender();
    normalizeState();
    refreshVersionLabel();
    renderNextMonthPanel();
    try{ save(); }catch(e){}

    if(typeof saveForm==='function'){
      document.querySelectorAll('.save-action').forEach(el=>{ el.onclick=saveForm; });
    }

    window.v115RenderNextMonthPanel=renderNextMonthPanel;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
