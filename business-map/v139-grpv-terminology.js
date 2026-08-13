(function(){
  const baseRenderCard = typeof renderCard==='function' ? renderCard : window.renderCard;

  function simplifiedCard(p){
    if(p?.id==='self' && typeof baseRenderCard==='function') return baseRenderCard(p);

    const gp=groupPvFor(p.id);
    const status=currentStatusLabel(p);
    return `<div class="member-card" data-id="${p.id}" data-type="${p.type}">
      <div class="status-stamp" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
      <div class="card-left">
        <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
        <div class="meta-list">${metaLines(p)}</div>
      </div>
      <div class="card-main">
        <div class="card-name">${escapeHtml(p.name||'名称未設定')}</div>
        <span class="type-badge" data-type="${p.type}">${p.type}</span>
        <div class="pv-box ${goalState(p)}">
          <div><b>個人PV</b></div>
          <div>目 ${fmt(p.target)} / 実 ${fmt(p.actual)}</div>
          ${p.type==='ABO' ? `<div class="g"><b>GrPV</b><br>目 ${fmt(gp.target)} / 実 ${fmt(gp.actual)}</div>` : ''}
        </div>
        <div class="memo-list">
          <div class="memo-item">${escapeHtml(p.memo1||'')}</div>
          <div class="memo-item">${escapeHtml(p.memo2||'')}</div>
          <div class="memo-item">${escapeHtml(p.memo3||'')}</div>
        </div>
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
