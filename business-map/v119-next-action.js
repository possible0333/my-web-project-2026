(function(){
  const PATCH_VERSION='v1.20';

  function pad2(n){ return String(Number(n)||0).padStart(2,'0'); }
  function normalizeDeadline(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(m) return `${m[1]}-${m[2]}`;
    m=s.match(/^(\d{1,2})[-\/]([0-3]?\d)$/);
    if(m){
      const month=Math.max(1,Math.min(12,Number(m[1])));
      const day=Math.max(1,Math.min(31,Number(m[2])));
      return `${pad2(month)}-${pad2(day)}`;
    }
    return '';
  }

  function ensureFields(){
    if(document.getElementById('v119ActionField')) return;
    const status=document.querySelector('.v116-status-priority');
    if(!status) return;
    const monthOptions=['<option value="">月</option>',...Array.from({length:12},(_,i)=>`<option value="${pad2(i+1)}">${i+1}月</option>`)].join('');
    const dayOptions=['<option value="">日</option>',...Array.from({length:31},(_,i)=>`<option value="${pad2(i+1)}">${i+1}日</option>`)].join('');
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
          <label>期限</label>
          <div class="v120-deadline-selects">
            <select class="select" id="fDeadlineMonth">${monthOptions}</select>
            <select class="select" id="fDeadlineDay">${dayOptions}</select>
          </div>
        </div>
        <div class="v119-mini-field">
          <label for="fNextAction">何をする</label>
          <input class="text-input" id="fNextAction" placeholder="例：マケアポを取る / 発注確認する">
        </div>
      </div>
      <div class="v119-action-helper">期限は月日のみ。カードには「期限」と「何をする」をセットで表示します。</div>`;
    status.insertAdjacentElement('afterend',field);
  }

  function rawActionMap(raw){
    const out=new Map();
    [raw?.self,...(raw?.members||[])].filter(Boolean).forEach(p=>{
      if(!p.id) return;
      out.set(p.id,{
        deadline:normalizeDeadline(p.deadline),
        nextAction:String(p.nextAction||'')
      });
    });
    return out;
  }

  function applyActionMap(target,map){
    [target?.self,...(target?.members||[])].filter(Boolean).forEach(p=>{
      const src=map.get(p.id);
      p.deadline=src?.deadline || normalizeDeadline(p.deadline);
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
      console.warn('[v1.20] action restore skipped',e);
    }
  }

  function patchMigrate(){
    if(typeof migrate!=='function' || migrate.__v120) return;
    const original=migrate;
    const wrapped=function(raw){
      const next=original.apply(this,arguments);
      applyActionMap(next,rawActionMap(raw));
      return next;
    };
    wrapped.__v120=true;
    migrate=wrapped;
  }

  function patchGatherForm(){
    if(typeof gatherForm!=='function' || gatherForm.__v120) return;
    const original=gatherForm;
    const wrapped=function(){
      const data=original.apply(this,arguments);
      const month=String(document.getElementById('fDeadlineMonth')?.value||'');
      const day=String(document.getElementById('fDeadlineDay')?.value||'');
      data.deadline=(month&&day)?`${month}-${day}`:'';
      data.nextAction=String(document.getElementById('fNextAction')?.value||'').trim();
      return data;
    };
    wrapped.__v120=true;
    gatherForm=wrapped;
  }

  function patchOpenModal(){
    if(typeof openModal!=='function' || openModal.__v120) return;
    const original=openModal;
    const wrapped=function(id){
      ensureFields();
      const result=original.apply(this,arguments);
      const p=id ? getPerson(id) : null;
      const normalized=normalizeDeadline(p?.deadline);
      const parts=normalized ? normalized.split('-') : ['',''];
      const month=document.getElementById('fDeadlineMonth');
      const day=document.getElementById('fDeadlineDay');
      const action=document.getElementById('fNextAction');
      if(month) month.value=parts[0]||'';
      if(day) day.value=parts[1]||'';
      if(action) action.value=p?.nextAction || '';
      return result;
    };
    wrapped.__v120=true;
    openModal=wrapped;
  }

  function profileFooterHtml(p){
    const items=[['年齢',p.age],['職業',p.job],['趣味',p.hobby],['他',p.etc]].filter(([,v])=>String(v||'').trim());
    if(!items.length) return '';
    return `<div class="v120-profile-footer">${items.map(([k,v])=>`<span class="v120-profile-chip" title="${escapeHtml(v)}"><b>${k}</b>${escapeHtml(v)}</span>`).join('')}</div>`;
  }

  function pvValue(v,unsetLabel){
    const n=Number(v||0);
    return unsetLabel && n<=0 ? '未設定' : fmt(n);
  }

  function deadlineLabel(value){
    const s=normalizeDeadline(value);
    if(!s) return '';
    const [m,d]=s.split('-');
    return `${Number(m)}/${Number(d)}`;
  }

  function actionHtml(p){
    const deadline=deadlineLabel(p.deadline);
    const action=String(p.nextAction||'').trim();
    if(!deadline && !action) return '';
    return `<div class="v119-card-action">
      <div class="v120-action-row v120-deadline-row"><span class="v119-k">期限</span><span class="v119-v v119-deadline">${escapeHtml(deadline || '未設定')}</span></div>
      <div class="v120-action-row"><span class="v119-k">何をする</span><span class="v119-v" title="${escapeHtml(action)}">${escapeHtml(action || '未設定')}</span></div>
    </div>`;
  }

  function renderCardV120(p){
    const gp=groupPvFor(p.id);
    const status=currentStatusLabel(p);
    const target=pvValue(p.target,true);
    const actual=fmt(p.actual);
    const groupTarget=pvValue(gp.target,true);
    const groupActual=fmt(gp.actual);
    const memos=[p.memo1,p.memo2,p.memo3].filter(v=>String(v||'').trim());

    return `<div class="member-card v114-card v120-card" data-id="${p.id}" data-type="${p.type}">
      <div class="status-stamp" title="${escapeHtml(status)}" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
      <div class="v120-card-head">
        <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
        <div class="v120-name-wrap">
          <div class="card-name" title="${escapeHtml(p.name||'名称未設定')}">${escapeHtml(p.name||'名称未設定')}</div>
          <span class="type-badge" data-type="${p.type}">${p.type}</span>
        </div>
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
      ${profileFooterHtml(p)}
    </div>`;
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.20';
  }

  function bind(){
    ensureFields();
    patchMigrate();
    patchGatherForm();
    patchOpenModal();
    restoreFromStorage();
    window.renderCard=renderCardV120;
    window.renderCardV119=renderCardV120;
    window.renderCardV120=renderCardV120;
    refreshVersionLabel();
    try{ save(); }catch(e){}
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.20] rerender failed',e); }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
