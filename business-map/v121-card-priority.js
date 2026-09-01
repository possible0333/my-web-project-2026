(function(){
  const PATCH_VERSION='v1.21';

  function pvValue(v,unsetLabel){
    const n=Number(v||0);
    return unsetLabel && n<=0 ? '未設定' : fmt(n);
  }

  function normalizeMonthDay(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(m) return `${m[1]}-${m[2]}`;
    m=s.match(/^(\d{1,2})[-\/]([0-3]?\d)$/);
    if(!m) return '';
    const month=Number(m[1]);
    const day=Number(m[2]);
    if(month<1 || month>12 || day<1 || day>31) return '';
    return `${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function deadlineLabel(value){
    const s=normalizeMonthDay(value);
    if(!s) return '';
    const [m,d]=s.split('-');
    return `${Number(m)}/${Number(d)}`;
  }

  function deadlineUrgency(value){
    const s=normalizeMonthDay(value);
    if(!s) return {className:'',label:''};
    const [m,d]=s.split('-').map(Number);
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const target=new Date(now.getFullYear(),m-1,d);
    if(target.getMonth()!==m-1 || target.getDate()!==d) return {className:'',label:''};
    const diff=Math.round((target-today)/86400000);
    if(diff<0) return {className:'v121-danger',label:'超過'};
    if(diff===0) return {className:'v121-danger',label:'今日'};
    if(diff<=3) return {className:'v121-warning',label:`あと${diff}日`};
    return {className:'',label:''};
  }

  function profileInlineHtml(p){
    const items=[
      ['年',p.age],
      ['職',p.job],
      ['趣',p.hobby],
      ['他',p.etc]
    ].filter(([,v])=>String(v||'').trim());
    if(!items.length) return '';
    const full=items.map(([k,v])=>`${k}:${String(v).trim()}`).join(' / ');
    return `<span class="v121-profile-inline" title="${escapeHtml(full)}">${items.map(([k,v])=>`<span><b>${k}</b>${escapeHtml(v)}</span>`).join('<i>・</i>')}</span>`;
  }

  function actionHtml(p){
    const deadline=deadlineLabel(p.deadline);
    const action=String(p.nextAction||'').trim();
    if(!deadline && !action) return '';
    const urgency=deadlineUrgency(p.deadline);
    return `<div class="v119-card-action ${urgency.className}">
      <div class="v120-action-row v120-deadline-row">
        <span class="v119-k">期限</span>
        <span class="v119-v v119-deadline">${escapeHtml(deadline || '未設定')}${urgency.label ? `<em class="v121-urgency-label">${escapeHtml(urgency.label)}</em>` : ''}</span>
      </div>
      <div class="v120-action-row">
        <span class="v119-k">何をする</span>
        <span class="v119-v" title="${escapeHtml(action)}">${escapeHtml(action || '未設定')}</span>
      </div>
    </div>`;
  }

  function renderCardV121(p){
    const gp=groupPvFor(p.id);
    const status=currentStatusLabel(p);
    const target=pvValue(p.target,true);
    const actual=fmt(p.actual);
    const groupTarget=pvValue(gp.target,true);
    const groupActual=fmt(gp.actual);
    const memos=[p.memo1,p.memo2,p.memo3].filter(v=>String(v||'').trim());
    const urgency=deadlineUrgency(p.deadline);
    const overdue=urgency.label==='超過';

    return `<div class="member-card v114-card v120-card v121-card${overdue?' v169-overdue-card':''}" data-id="${p.id}" data-type="${p.type}">
      ${overdue?'<span class="v169-review-stamp" aria-label="期限切れ・要確認">要確認</span>':''}
      <div class="status-stamp" title="${escapeHtml(status)}" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
      <div class="v120-card-head">
        <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
        <div class="v120-name-wrap">
          <div class="card-name" title="${escapeHtml(p.name||'名称未設定')}">${escapeHtml(p.name||'名称未設定')}</div>
          <div class="v121-meta-row">
            <span class="type-badge" data-type="${p.type}">${p.type}</span>
            ${profileInlineHtml(p)}
          </div>
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
    </div>`;
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.21';
  }

  function apply(){
    window.renderCard=renderCardV121;
    window.renderCardV121=renderCardV121;
    refreshVersionLabel();
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.21] rerender failed',e); }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
