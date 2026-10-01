(function(){
  const baseRenderCard = typeof renderCard==='function' ? renderCard : window.renderCard;

  function needsWhenWhat(p){
    return p?.id!=='self' && !String(p?.deadline||'').trim() && !String(p?.nextAction||'').trim();
  }

  function normalizeMonthDay(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(m) return `${m[1]}-${m[2]}`;
    m=s.match(/^(\d{1,2})[-\/]([0-3]?\d)$/);
    if(!m) return '';
    const month=Number(m[1]),day=Number(m[2]);
    if(month<1||month>12||day<1||day>31) return '';
    return `${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function deadlineLabel(value){
    const normalized=normalizeMonthDay(value);
    if(!normalized) return '';
    const [month,day]=normalized.split('-');
    return `${Number(month)}/${Number(day)}`;
  }

  function deadlineUrgency(value){
    const normalized=normalizeMonthDay(value);
    if(!normalized) return {className:'',label:''};
    const [month,day]=normalized.split('-').map(Number);
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const target=new Date(now.getFullYear(),month-1,day);
    if(target.getMonth()!==month-1||target.getDate()!==day) return {className:'',label:''};
    const diff=Math.round((target-today)/86400000);
    if(diff<0) return {className:'v121-danger',label:'超過'};
    if(diff===0) return {className:'v121-danger',label:'今日'};
    if(diff<=3) return {className:'v121-warning',label:`あと${diff}日`};
    return {className:'',label:''};
  }

  function actionHtml(p){
    const deadline=deadlineLabel(p?.deadline);
    const action=String(p?.nextAction||'').trim();
    if(!deadline&&!action) return '';
    const urgency=deadlineUrgency(p?.deadline);
    return `<div class="v119-card-action ${urgency.className}">
      <div class="v120-action-row v120-deadline-row"><span class="v119-k">期限</span><span class="v119-v v119-deadline">${escapeHtml(deadline||'未設定')}${urgency.label?`<em class="v121-urgency-label">${escapeHtml(urgency.label)}</em>`:''}</span></div>
      <div class="v120-action-row"><span class="v119-k">何をする</span><span class="v119-v" title="${escapeHtml(action)}">${escapeHtml(action||'未設定')}</span></div>
    </div>`;
  }

  function simplifiedCard(p){
    if(p?.id==='self' && typeof baseRenderCard==='function') return baseRenderCard(p);

    const gp=groupPvFor(p.id);
    const status=currentStatusLabel(p);
    const missingAction=needsWhenWhat(p);
    return `<div class="member-card v139-simplified-card${missingAction?' v193-missing-action-card':''}" data-id="${p.id}" data-type="${p.type}">
      ${p.id!=='self'&&Number(p.target||0)>0&&Number(p.actual||0)>=Number(p.target||0)?'<span class="v153-achieved">達成</span>':''}
      ${missingAction?'<span class="v193-action-missing-stamp" aria-label="期限と何をするか未設定">いつ何する？</span>':''}
      <div class="v139-card-head">
        <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
        <div class="v139-card-title">
          <div class="card-name">${escapeHtml(p.name||'名称未設定')}</div>
        </div>
      </div>
      <div class="v139-card-badges">
        <span class="type-badge" data-type="${p.type}">${escapeHtml(p.type)}</span>
        <span class="status-stamp" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</span>
      </div>
      <div class="meta-list v139-meta-list">${metaLines(p)}</div>
      <div class="pv-box ${goalState(p)}">
        <div><b>個人PV</b></div>
        <div>計 ${fmt(p.target)} / 実 ${fmt(p.actual)}</div>
        ${p.type==='ABO' ? `<div class="g"><b>GrPV</b><br>計 ${fmt(gp.target)} / 実 ${fmt(gp.actual)}</div>` : ''}
      </div>
      ${actionHtml(p)}
      <div class="memo-list">
        <div class="memo-item">${escapeHtml(p.memo1||'')}</div>
        <div class="memo-item">${escapeHtml(p.memo2||'')}</div>
        <div class="memo-item">${escapeHtml(p.memo3||'')}</div>
      </div>
    </div>`;
  }

  function apply(){
    try{
      window.renderCard=simplifiedCard;
      renderCard=simplifiedCard;
      if(typeof renderTree==='function') renderTree();
    }catch(e){
      console.warn('[v1.39] GrPV terminology patch failed',e);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});
  else setTimeout(apply,0);
})();
