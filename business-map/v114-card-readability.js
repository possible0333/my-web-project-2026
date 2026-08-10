(function(){
  const VERSION='v1.14';

  function profileHtml(p){
    const items=[
      ['年',p.age],
      ['職',p.job],
      ['趣',p.hobby],
      ['他',p.etc]
    ].filter(([,v])=>String(v||'').trim());
    if(!items.length){
      return '<div class="v114-profile-line"><b>情</b><span class="v114-profile-value">未入力</span></div>';
    }
    return items.map(([k,v])=>`<div class="v114-profile-line" title="${escapeHtml(v)}"><b>${k}</b><span class="v114-profile-value">${escapeHtml(v)}</span></div>`).join('');
  }

  function pvValue(v,unsetLabel){
    const n=Number(v||0);
    return unsetLabel && n<=0 ? '未設定' : fmt(n);
  }

  function renderCardV114(p){
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

  function apply(){
    window.renderCard=renderCardV114;
    const subtitle=document.querySelector('.topbar .sub');
    if(subtitle) subtitle.textContent='PV・ネットワーク・GrPV管理';
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('v1.14 rerender failed',e); }
    }
    requestAnimationFrame(()=>{
      if(typeof window.v111ApplyDensity==='function') window.v111ApplyDensity();
      if(typeof window.drawLines==='function') window.drawLines();
    });
  }

  window.renderCardV114=renderCardV114;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
