(function(){
  const APP_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.50';

  function eligibleForCurrentMonth(p){
    return Boolean(p) && p.status!=='next-month';
  }

  // Current map GrPV:
  // own personal PV + every direct child line recursively.
  // A descendant is counted only inside its parent/front line, so there is no double count.
  function calculateGroupPv(id,trail){
    const seen=trail || new Set();
    if(seen.has(id)) return {target:0,actual:0};
    const person=getPerson(id);
    if(!person) return {target:0,actual:0};
    seen.add(id);

    const ownCounts=id==='self' || eligibleForCurrentMonth(person);
    let target=ownCounts ? Number(person.target||0) : 0;
    let actual=ownCounts ? Number(person.actual||0) : 0;

    const children=(state.members||[]).filter(p=>p.parentId===id);
    children.forEach(child=>{
      const line=calculateGroupPv(child.id,new Set(seen));
      target+=Number(line.target||0);
      actual+=Number(line.actual||0);
    });
    return {target,actual};
  }

  function currentTeamSummary(){
    const all=allPeople();
    const gp=calculateGroupPv('self');
    const typeCount={ABO:0,'カスタマー':0,'プロスペ':0,'小売':0};
    const statusCount=Object.fromEntries(STATUS_OPTIONS.map(s=>[s.id,0]));
    all.forEach(p=>{
      typeCount[p.type]=(typeCount[p.type]||0)+1;
      statusCount[p.status]=(statusCount[p.status]||0)+1;
    });
    const teamTarget=Number(gp.target||0);
    const teamActual=Number(gp.actual||0);
    return {
      teamTarget,
      teamActual,
      rate:teamTarget?Math.round(teamActual/teamTarget*100):0,
      peopleCount:all.length,
      typeCount,
      statusCount
    };
  }

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
    const month=Number(m[1]), day=Number(m[2]);
    if(month<1||month>12||day<1||day>31) return '';
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
    if(target.getMonth()!==m-1||target.getDate()!==d) return {className:'',label:''};
    const diff=Math.round((target-today)/86400000);
    if(diff<0) return {className:'v121-danger',label:'超過'};
    if(diff===0) return {className:'v121-danger',label:'今日'};
    if(diff<=3) return {className:'v121-warning',label:`あと${diff}日`};
    return {className:'',label:''};
  }

  function profileInlineHtml(p){
    const items=[['年',p.age],['職',p.job],['趣',p.hobby],['他',p.etc]].filter(([,v])=>String(v||'').trim());
    if(!items.length) return '';
    const full=items.map(([k,v])=>`${k}:${String(v).trim()}`).join(' / ');
    return `<span class="v121-profile-inline" title="${escapeHtml(full)}">${items.map(([k,v])=>`<span><b>${k}</b>${escapeHtml(v)}</span>`).join('<i>・</i>')}</span>`;
  }

  function actionHtml(p){
    const deadline=deadlineLabel(p.deadline);
    const action=String(p.nextAction||'').trim();
    if(!deadline&&!action) return '';
    const urgency=deadlineUrgency(p.deadline);
    return `<div class="v119-card-action ${urgency.className}">
      <div class="v120-action-row v120-deadline-row"><span class="v119-k">期限</span><span class="v119-v v119-deadline">${escapeHtml(deadline||'未設定')}${urgency.label?`<em class="v121-urgency-label">${escapeHtml(urgency.label)}</em>`:''}</span></div>
      <div class="v120-action-row"><span class="v119-k">何をする</span><span class="v119-v" title="${escapeHtml(action)}">${escapeHtml(action||'未設定')}</span></div>
    </div>`;
  }

  function renderCardV126(p){
    const gp=calculateGroupPv(p.id);
    const status=currentStatusLabel(p);
    const target=pvValue(p.target,true);
    const actual=fmt(p.actual);
    const groupTarget=pvValue(gp.target,true);
    const groupActual=fmt(gp.actual);
    const memos=[p.memo1,p.memo2,p.memo3].filter(v=>String(v||'').trim());
    return `<div class="member-card v114-card v120-card v121-card" data-id="${p.id}" data-type="${p.type}">
      ${p.id!=='self'&&Number(p.target||0)>0&&Number(p.actual||0)>=Number(p.target||0)?'<span class="v153-achieved">達成</span>':''}
      <div class="status-stamp" title="${escapeHtml(status)}" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
      <div class="v120-card-head">
        <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
        <div class="v120-name-wrap">
          <div class="card-name" title="${escapeHtml(p.name||'名称未設定')}">${escapeHtml(p.name||'名称未設定')}</div>
          <div class="v121-meta-row"><span class="type-badge" data-type="${p.type}">${p.type}</span>${profileInlineHtml(p)}</div>
        </div>
      </div>
      ${actionHtml(p)}
      <div class="pv-box v114-pv ${goalState(p)}">
        <div class="v114-pv-row"><span class="v114-pv-label">個人PV</span><span class="v114-pv-values"><small>目</small>${target}<i>/</i><small>実</small>${actual}</span></div>
        ${p.type==='ABO'?`<div class="v114-pv-row"><span class="v114-pv-label">GrPV</span><span class="v114-pv-values"><small>目</small>${groupTarget}<i>/</i><small>実</small>${groupActual}</span></div>`:''}
      </div>
      ${memos.length?`<div class="memo-list">${memos.map(v=>`<div class="memo-item" title="${escapeHtml(v)}">${escapeHtml(v)}</div>`).join('')}</div>`:''}
    </div>`;
  }

  function renderSelfV126(){
    const box=document.getElementById('selfCard');
    if(!box) return;
    const s=currentTeamSummary();
    const self=state.self;
    const rate=self.target?Math.min(100,Math.round(Number(self.actual||0)/Number(self.target||0)*100)):0;
    box.innerHTML=`<div class="self-grid">
      <img class="self-avatar" src="${ICONS[self.avatar||0]}" alt="avatar">
      <div>
        <div class="self-name">${escapeHtml(self.name||'自分')}</div>
        <div class="self-kpis">
          <div class="self-kpi"><div class="kpi-label">目標個人PV</div><div class="kpi-value">${fmt(self.target)}</div></div>
          <div class="self-kpi"><div class="kpi-label">実績PV</div><div class="kpi-value">${fmt(self.actual)}</div></div>
          <div class="self-kpi"><div class="kpi-label">達成率</div><div class="kpi-value">${rate}%</div></div>
        </div>
        <div class="progress"><span style="width:${rate}%"></span></div>
        <div class="team-kpis">
          <div class="team-kpi"><div class="kpi-label">目標GrPV</div><div class="kpi-value">${fmt(s.teamTarget)}</div></div>
          <div class="team-kpi"><div class="kpi-label">実績GrPV</div><div class="kpi-value">${fmt(s.teamActual)}</div></div>
          <div class="team-kpi"><div class="kpi-label">GrPV達成率</div><div class="kpi-value">${s.rate}%</div></div>
          <div class="team-kpi"><div class="kpi-label">登録人数</div><div class="kpi-value">${s.peopleCount}人</div></div>
        </div>
      </div>
      <div class="self-rank" style="background:${currentStatusColor(self)}">${escapeHtml(shortStatus(currentStatusLabel(self),4))}</div>
    </div>`;
  }

  function forceRecalculateAndRender(){
    try{ window.groupPvFor=calculateGroupPv; groupPvFor=calculateGroupPv; }catch(e){ window.groupPvFor=calculateGroupPv; }
    try{ window.teamSummary=currentTeamSummary; teamSummary=currentTeamSummary; }catch(e){ window.teamSummary=currentTeamSummary; }
    try{ window.renderCard=renderCardV126; renderCard=renderCardV126; }catch(e){ window.renderCard=renderCardV126; }
    try{ window.renderSelf=renderSelfV126; renderSelf=renderSelfV126; }catch(e){ window.renderSelf=renderSelfV126; }

    renderSelfV126();
    if(typeof renderStatusSummary==='function') renderStatusSummary();
    if(typeof renderTypeSummary==='function') renderTypeSummary();
    if(typeof window.renderTree==='function') window.renderTree();
    if(typeof window.v116RenderNextMonthPanel==='function') window.v116RenderNextMonthPanel();
    requestAnimationFrame(()=>{
      if(typeof window.v111ApplyDensity==='function') window.v111ApplyDensity();
      if(typeof window.drawLines==='function') window.drawLines();
    });
  }

  function refreshVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function bind(){
    refreshVersion();
    forceRecalculateAndRender();
    window.v126Recalculate=forceRecalculateAndRender;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
