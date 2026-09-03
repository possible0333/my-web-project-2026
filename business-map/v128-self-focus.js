(function(){
  const APP_VERSION='v1.28';
  let activeId=null;
  const previousRenderCard=window.renderCard;

  function safe(v){ return String(v||'').trim(); }

  function ensureSelfFields(){
    if(document.getElementById('v128SelfFocusField')) return;
    const pvFields=[...document.querySelectorAll('.v117-pv-priority')];
    const anchor=pvFields[pvFields.length-1] || document.querySelector('.v117-name-priority');
    if(!anchor) return;
    const field=document.createElement('div');
    field.id='v128SelfFocusField';
    field.className='field full v128-self-focus-field hidden';
    field.innerHTML=`
      <div class="v128-edit-head">
        <div>
          <div class="v128-edit-title">今月の目標・意識すること</div>
          <div class="v128-edit-helper">自分カードだけに表示される今月の行動テーマです。</div>
        </div>
        <span class="v128-edit-badge">自分専用</span>
      </div>
      <div class="v128-edit-goals">
        <div><label for="fMonthlyTargetPv">目標PV</label><input id="fMonthlyTargetPv" class="number-input" type="number" inputmode="numeric" min="0" step="1000" placeholder="例：180000"></div>
        <div><label for="fFrontUpGoal">フロントアップ数</label><input id="fFrontUpGoal" class="number-input" type="number" inputmode="numeric" min="0" step="1" placeholder="例：2"></div>
        <div><label for="fGroupUpGoal">グループアップ数</label><input id="fGroupUpGoal" class="number-input" type="number" inputmode="numeric" min="0" step="1" placeholder="例：5"></div>
      </div>
      <div class="v128-focus-inputs">
        <div><label for="fFocus1">意識すること 1</label><input id="fFocus1" class="text-input" placeholder="例：毎日プロスペへ連絡"></div>
        <div><label for="fFocus2">意識すること 2</label><input id="fFocus2" class="text-input" placeholder="例：期限をその場で決める"></div>
        <div><label for="fFocus3">意識すること 3</label><input id="fFocus3" class="text-input" placeholder="例：フォローを翌日に持ち越さない"></div>
      </div>`;
    anchor.insertAdjacentElement('afterend',field);
  }

  function copySelfPlanning(target,raw){
    if(!target?.self) return;
    const src=raw?.self || {};
    target.self.monthlyGoal=String(src.monthlyGoal ?? target.self.monthlyGoal ?? '');
    target.self.monthlyTargetPv=Math.max(0,Number(src.monthlyTargetPv ?? target.self.monthlyTargetPv ?? 0)||0);
    target.self.frontUpGoal=Math.max(0,Number(src.frontUpGoal ?? target.self.frontUpGoal ?? 0)||0);
    target.self.groupUpGoal=Math.max(0,Number(src.groupUpGoal ?? target.self.groupUpGoal ?? 0)||0);
    target.self.focus1=String(src.focus1 ?? target.self.focus1 ?? '');
    target.self.focus2=String(src.focus2 ?? target.self.focus2 ?? '');
    target.self.focus3=String(src.focus3 ?? target.self.focus3 ?? '');
  }

  function restoreFromStorage(){
    try{
      for(const key of STORAGE_KEYS){
        const text=localStorage.getItem(key);
        if(!text) continue;
        const raw=JSON.parse(text);
        if(!raw?.self) continue;
        copySelfPlanning(state,raw);
        break;
      }
    }catch(e){ console.warn('[v1.28] self focus restore skipped',e); }
    state.self.monthlyGoal=String(state.self.monthlyGoal||'');
    state.self.monthlyTargetPv=Math.max(0,Number(state.self.monthlyTargetPv||0));
    state.self.frontUpGoal=Math.max(0,Number(state.self.frontUpGoal||0));
    state.self.groupUpGoal=Math.max(0,Number(state.self.groupUpGoal||0));
    state.self.focus1=String(state.self.focus1||'');
    state.self.focus2=String(state.self.focus2||'');
    state.self.focus3=String(state.self.focus3||'');
  }

  function patchMigrate(){
    if(typeof migrate!=='function' || migrate.__v128) return;
    const original=migrate;
    const wrapped=function(raw){
      const next=original.apply(this,arguments);
      copySelfPlanning(next,raw);
      return next;
    };
    wrapped.__v128=true;
    migrate=wrapped;
  }

  function fillSelfFields(p){
    const values={
      fMonthlyTargetPv:Number(p?.monthlyTargetPv||0)||'',
      fFrontUpGoal:Number(p?.frontUpGoal||0)||'',
      fGroupUpGoal:Number(p?.groupUpGoal||0)||'',
      fFocus1:p?.focus1||'',
      fFocus2:p?.focus2||'',
      fFocus3:p?.focus3||''
    };
    Object.entries(values).forEach(([id,value])=>{
      const el=document.getElementById(id);
      if(el) el.value=value;
    });
  }

  function patchOpenModal(){
    if(typeof openModal!=='function' || openModal.__v128) return;
    const original=openModal;
    const wrapped=function(id){
      activeId=id||null;
      ensureSelfFields();
      const result=original.apply(this,arguments);
      const field=document.getElementById('v128SelfFocusField');
      const isSelf=id==='self';
      if(field) field.classList.toggle('hidden',!isSelf);
      if(isSelf) fillSelfFields(getPerson('self'));
      else fillSelfFields(null);
      return result;
    };
    wrapped.__v128=true;
    openModal=wrapped;
  }

  function patchGatherForm(){
    if(typeof gatherForm!=='function' || gatherForm.__v128) return;
    const original=gatherForm;
    const wrapped=function(){
      const data=original.apply(this,arguments);
      if(activeId==='self'){
        data.monthlyTargetPv=Math.max(0,Number(document.getElementById('fMonthlyTargetPv')?.value||0));
        data.frontUpGoal=Math.max(0,Math.floor(Number(document.getElementById('fFrontUpGoal')?.value||0)));
        data.groupUpGoal=Math.max(0,Math.floor(Number(document.getElementById('fGroupUpGoal')?.value||0)));
        data.focus1=safe(document.getElementById('fFocus1')?.value);
        data.focus2=safe(document.getElementById('fFocus2')?.value);
        data.focus3=safe(document.getElementById('fFocus3')?.value);
      }
      return data;
    };
    wrapped.__v128=true;
    gatherForm=wrapped;
  }

  function profileInline(p){
    const items=[['年',p.age],['職',p.job],['趣',p.hobby],['他',p.etc]].filter(([,v])=>safe(v));
    if(!items.length) return '';
    return `<span class="v121-profile-inline">${items.map(([k,v])=>`<span><b>${k}</b>${escapeHtml(v)}</span>`).join('<i>・</i>')}</span>`;
  }

  function deadlineLabel(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(!m) m=s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    return m?`${Number(m[1])}/${Number(m[2])}`:'';
  }

  function actionBlock(p){
    const deadline=deadlineLabel(p.deadline);
    const action=safe(p.nextAction);
    if(!deadline&&!action) return '';
    return `<div class="v128-self-action"><span><b>期限</b>${escapeHtml(deadline||'未設定')}</span><span><b>次</b>${escapeHtml(action||'未設定')}</span></div>`;
  }

  function planningBlock(p){
    const monthlyTargetPv=Math.max(0,Number(p.monthlyTargetPv||0));
    const frontUpGoal=Math.max(0,Number(p.frontUpGoal||0));
    const groupUpGoal=Math.max(0,Number(p.groupUpGoal||0));
    const focus=[safe(p.focus1),safe(p.focus2),safe(p.focus3)].filter(Boolean);
    return `<div class="v128-plan-panel">
      <div class="v128-plan-section v128-monthly-goal">
        <div class="v128-plan-label">今月の目標</div>
        <div class="v175-goal-grid">
          <div><span>計画PV</span><b>${monthlyTargetPv?fmt(monthlyTargetPv):'未入力'}</b></div>
          <div><span>フロントアップ</span><b>${frontUpGoal?`${fmt(frontUpGoal)}人`:'未入力'}</b></div>
          <div><span>グループアップ</span><b>${groupUpGoal?`${fmt(groupUpGoal)}人`:'未入力'}</b></div>
        </div>
      </div>
      <div class="v128-plan-section v128-focus-list">
        <div class="v128-plan-label">意識すること</div>
        <div class="v128-focus-items">${focus.length?focus.map((v,i)=>`<div><b>${i+1}</b><span>${escapeHtml(v)}</span></div>`).join(''):'<div class="v128-focus-empty">未入力</div>'}</div>
      </div>
    </div>`;
  }

  function pvText(v,unset){
    const n=Number(v||0);
    return unset&&n<=0?'未設定':fmt(n);
  }

  function renderSelfCard(p){
    const gp=groupPvFor('self');
    const status=currentStatusLabel(p);
    const memos=[p.memo1,p.memo2,p.memo3].filter(v=>safe(v));
    return `<div class="member-card v114-card v120-card v121-card v128-self-card-content" data-id="self" data-type="${p.type}">
      <div class="status-stamp" title="${escapeHtml(status)}" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
      <div class="v128-self-main">
        <div class="v128-self-identity">
          <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
          <div class="v128-self-namewrap">
            <div class="card-name">${escapeHtml(p.name||'自分')}</div>
            <div class="v121-meta-row"><span class="type-badge" data-type="${p.type}">${p.type}</span>${profileInline(p)}</div>
          </div>
        </div>
        ${actionBlock(p)}
        <div class="pv-box v114-pv ${goalState(p)}">
          <div class="v114-pv-row"><span class="v114-pv-label">個人PV</span><span class="v114-pv-values"><small>目</small>${pvText(p.target,true)}<i>/</i><small>実</small>${fmt(p.actual)}</span></div>
          <div class="v114-pv-row"><span class="v114-pv-label">GrPV</span><span class="v114-pv-values"><small>目</small>${pvText(gp.target,true)}<i>/</i><small>実</small>${fmt(gp.actual)}</span></div>
        </div>
        ${memos.length?`<div class="memo-list">${memos.map(v=>`<div class="memo-item">${escapeHtml(v)}</div>`).join('')}</div>`:''}
      </div>
      ${planningBlock(p)}
    </div>`;
  }

  function renderCardV128(p){
    if(p?.id==='self') return renderSelfCard(p);
    return typeof previousRenderCard==='function' ? previousRenderCard(p) : '';
  }

  function rerender(){
    window.renderCard=renderCardV128;
    try{ renderCard=renderCardV128; }catch(e){}
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.28] rerender failed',e); }
    }
  }

  function refreshVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function bind(){
    ensureSelfFields();
    patchMigrate();
    patchOpenModal();
    patchGatherForm();
    restoreFromStorage();
    refreshVersion();
    try{ save(); }catch(e){}
    try{ if(typeof renderSelf==='function') renderSelf(); }catch(e){ console.warn('[v1.75] monthly summary rerender failed',e); }
    rerender();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
