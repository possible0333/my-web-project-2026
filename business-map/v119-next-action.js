(function(){
  const PATCH_VERSION='v1.19';

  function ensureFields(){
    if(document.getElementById('v119ActionField')) return;
    const status=document.querySelector('.v116-status-priority');
    if(!status) return;
    const field=document.createElement('div');
    field.className='field full v119-action-priority';
    field.id='v119ActionField';
    field.innerHTML=`
      <div class="v119-action-head">
        <label>次のアクション</label>
        <span class="v119-action-badge">重要</span>
      </div>
      <div class="v119-action-inputs">
        <div class="v119-mini-field">
          <label for="fDeadline">期限</label>
          <input id="fDeadline" type="date">
        </div>
        <div class="v119-mini-field">
          <label for="fNextAction">何をする</label>
          <input class="text-input" id="fNextAction" placeholder="例：マケアポを取る / 発注確認する">
        </div>
      </div>
      <div class="v119-action-helper">カードには「期限」と「何をする」をセットで表示します。</div>`;
    status.insertAdjacentElement('afterend',field);
  }

  function rawActionMap(raw){
    const out=new Map();
    [raw?.self,...(raw?.members||[])].filter(Boolean).forEach(p=>{
      if(!p.id) return;
      out.set(p.id,{
        deadline:String(p.deadline||''),
        nextAction:String(p.nextAction||'')
      });
    });
    return out;
  }

  function applyActionMap(target,map){
    [target?.self,...(target?.members||[])].filter(Boolean).forEach(p=>{
      const src=map.get(p.id);
      p.deadline=src?.deadline || p.deadline || '';
      p.nextAction=src?.nextAction || p.nextAction || '';
    });
  }

  function restoreFromStorage(){
    try{
      for(const key of STORAGE_KEYS){
        const text=localStorage.getItem(key);
        if(!text) continue;
        const raw=JSON.parse(text);
        if(!raw?.self || !Array.isArray(raw.members)) continue;
        applyActionMap(state,rawActionMap(raw));
        break;
      }
    }catch(e){
      console.warn('[v1.19] action restore skipped',e);
    }
  }

  function patchMigrate(){
    if(typeof migrate!=='function' || migrate.__v119) return;
    const original=migrate;
    const wrapped=function(raw){
      const next=original.apply(this,arguments);
      applyActionMap(next,rawActionMap(raw));
      return next;
    };
    wrapped.__v119=true;
    migrate=wrapped;
  }

  function patchGatherForm(){
    if(typeof gatherForm!=='function' || gatherForm.__v119) return;
    const original=gatherForm;
    const wrapped=function(){
      const data=original.apply(this,arguments);
      data.deadline=String(document.getElementById('fDeadline')?.value||'');
      data.nextAction=String(document.getElementById('fNextAction')?.value||'').trim();
      return data;
    };
    wrapped.__v119=true;
    gatherForm=wrapped;
  }

  function patchOpenModal(){
    if(typeof openModal!=='function' || openModal.__v119) return;
    const original=openModal;
    const wrapped=function(id){
      ensureFields();
      const result=original.apply(this,arguments);
      const p=id ? getPerson(id) : null;
      const deadline=document.getElementById('fDeadline');
      const action=document.getElementById('fNextAction');
      if(deadline) deadline.value=p?.deadline || '';
      if(action) action.value=p?.nextAction || '';
      return result;
    };
    wrapped.__v119=true;
    openModal=wrapped;
  }

  function profileHtml(p){
    const items=[['年',p.age],['職',p.job],['趣',p.hobby],['他',p.etc]].filter(([,v])=>String(v||'').trim());
    if(!items.length) return '<div class="v114-profile-line"><b>情</b><span class="v114-profile-value">未入力</span></div>';
    return items.map(([k,v])=>`<div class="v114-profile-line" title="${escapeHtml(v)}"><b>${k}</b><span class="v114-profile-value">${escapeHtml(v)}</span></div>`).join('');
  }

  function pvValue(v,unsetLabel){
    const n=Number(v||0);
    return unsetLabel && n<=0 ? '未設定' : fmt(n);
  }

  function deadlineLabel(value){
    if(!value) return '';
    const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return String(value);
    return `${Number(m[2])}/${Number(m[3])}まで`;
  }

  function actionHtml(p){
    const deadline=deadlineLabel(p.deadline);
    const action=String(p.nextAction||'').trim();
    if(!deadline && !action) return '';
    return `<div class="v119-card-action">
      <span class="v119-k">期限</span><span class="v119-v v119-deadline">${escapeHtml(deadline || '未設定')}</span>
      <span class="v119-k">何をする</span><span class="v119-v" title="${escapeHtml(action)}">${escapeHtml(action || '未設定')}</span>
    </div>`;
  }

  function renderCardV119(p){
    const gp=groupPvFor(p.id);
    const status=currentStatusLabel(p);
    const target=pvValue(p.target,true);
    const actual=fmt(p.actual);
    const groupTarget=pvValue(gp.target,true);
    const groupActual=fmt(gp.actual);
    const memos=[p.memo1,p.memo2,p.memo3].filter(v=>String(v||'').trim());

    return `<div class="member-card v114-card" data-id="${p.id}" data-type="${p.type}">
      <div class="status-stamp" title="${escapeHtml(status)}" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
      <div class="card-left">
        <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
        <div class="v114-profile">${profileHtml(p)}</div>
      </div>
      <div class="card-main">
        <div class="v114-head">
          <div class="card-name" title="${escapeHtml(p.name||'名称未設定')}">${escapeHtml(p.name||'名称未設定')}</div>
          <span class="type-badge" data-type="${p.type}">${p.type}</span>
        </div>
        ${actionHtml(p)}
        <div class="pv-box v114-pv ${goalState(p)}">
          <div class="v114-pv-row">
            <span class="v114-pv-label">個人PV</span>
            <span class="v114-pv-values"><small>目</small>${target}<i>/</i><small>実</small>${actual}</span>
          </div>
          ${p.type==='ABO' ? `<div class="v114-pv-row"><span class="v114-pv-label">GrPV</span><span class="v114-pv-values"><small>目</small>${groupTarget}<i>/</i><small>実</small>${groupActual}</span></div>` : ''}
        </div>
        ${memos.length ? `<div class="memo-list">${memos.map(v=>`<div class="memo-item" title="${escapeHtml(v)}">${escapeHtml(v)}</div>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.19';
  }

  function bind(){
    ensureFields();
    patchMigrate();
    patchGatherForm();
    patchOpenModal();
    restoreFromStorage();
    window.renderCard=renderCardV119;
    window.renderCardV119=renderCardV119;
    refreshVersionLabel();
    try{ save(); }catch(e){}
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.19] rerender failed',e); }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
