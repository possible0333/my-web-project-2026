(function(){
  const APP_VERSION='v1.27';
  const previousRenderTree=window.renderTree;

  function filtersActive(){
    const status=document.getElementById('statusFilter')?.value || 'all';
    const type=document.getElementById('typeFilter')?.value || 'all';
    return status!=='all' || type!=='all';
  }

  function isCurrent(p){
    return Boolean(p) && p.status!=='next-month';
  }

  function isDirectManaged(p){
    if(!p || p.parentId!=='self') return false;
    if(p.type!=='カスタマー' && p.type!=='小売') return false;
    // Safety for legacy data: if a customer/retail member somehow has children,
    // keep the branch in the normal tree rather than orphaning descendants.
    return !(state.members||[]).some(x=>x.parentId===p.id && isCurrent(x));
  }

  function directManagedPeople(){
    return (state.members||[]).filter(p=>isCurrent(p) && isDirectManaged(p));
  }

  function treeChildren(id){
    return (state.members||[]).filter(p=>{
      if(!isCurrent(p) || p.parentId!==id) return false;
      if(id==='self' && isDirectManaged(p)) return false;
      return true;
    });
  }

  function deadlineText(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(m) return `${Number(m[1])}/${Number(m[2])}`;
    m=s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    if(!m) return '';
    return `${Number(m[1])}/${Number(m[2])}`;
  }

  function deadlineUrgent(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(!m) m=s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    if(!m) return false;
    const month=Number(m[1]), day=Number(m[2]);
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const target=new Date(now.getFullYear(),month-1,day);
    if(target.getMonth()!==month-1 || target.getDate()!==day) return false;
    const diff=Math.round((target-today)/86400000);
    return diff<=3;
  }

  function miniCard(p){
    const deadline=deadlineText(p.deadline);
    const action=String(p.nextAction||'').trim();
    const actionText=[deadline?`期限 ${deadline}`:'',action].filter(Boolean).join('｜');
    return `<button type="button" class="v127-mini-card" data-v127-id="${escapeHtml(p.id)}" data-type="${escapeHtml(p.type)}">
      <span class="v127-mini-status" style="background:${currentStatusColor(p)}" title="${escapeHtml(currentStatusLabel(p))}"></span>
      <img class="v127-mini-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
      <span class="v127-mini-main">
        <span class="v127-mini-name" title="${escapeHtml(p.name||'名称未設定')}">${escapeHtml(p.name||'名称未設定')}</span>
        <span class="v127-mini-meta"><span class="v127-mini-type">${escapeHtml(p.type)}</span><span class="v127-mini-pv">実績 ${fmt(p.actual||0)}PV</span></span>
        ${actionText?`<span class="v127-mini-action ${deadlineUrgent(p.deadline)?'is-urgent':''}" title="${escapeHtml(actionText)}">${escapeHtml(actionText)}</span>`:''}
      </span>
    </button>`;
  }

  function directZoneHtml(){
    const people=directManagedPeople();
    if(!people.length) return '';
    return `<section class="v127-direct-zone" aria-label="直カスタマー・小売">
      <div class="v127-direct-head"><span>👥 直カスタマー・小売</span><b>${people.length}人</b></div>
      <div class="v127-direct-cards">${people.map(miniCard).join('')}</div>
    </section>`;
  }

  function selfCardHtml(){
    let html=renderCard(state.self);
    html=html.replace('class="member-card ', 'class="member-card v127-self-map-card ');
    html=html.replace('<div class="status-stamp"', '<div class="v127-self-badge">自分</div><div class="status-stamp"');
    return html;
  }

  function buildNode(id,depth){
    const p=id==='self' ? state.self : getPerson(id);
    if(!p || (id!=='self' && !isCurrent(p))) return '';
    const kids=treeChildren(id);
    const card=id==='self' ? selfCardHtml() : renderCard(p);
    return `<div class="v109-node" data-node-id="${escapeHtml(id)}">
      ${id==='self'?'<div class="v127-self-label">MAP OWNER</div>':''}
      ${card}
      ${kids.length?`<div class="v109-children">${kids.map(c=>buildNode(c.id,depth+1)).join('')}</div>`:''}
    </div>`;
  }

  function applyV127Density(){
    const rows=document.getElementById('treeRows');
    if(!rows || filtersActive()) return;
    const count=treeChildren('self').length;
    rows.classList.remove('v111-density-1','v111-density-2','v111-density-3','v111-density-4');
    rows.classList.add(count>=9?'v111-density-4':count>=7?'v111-density-3':count>=5?'v111-density-2':'v111-density-1');
    rows.dataset.frontCount=String(count);
  }

  function bindClicks(rows){
    rows.querySelectorAll('.member-card[data-id]').forEach(el=>{
      el.onclick=()=>openModal(el.dataset.id);
    });
    rows.querySelectorAll('[data-v127-id]').forEach(el=>{
      el.onclick=e=>{
        e.stopPropagation();
        openModal(el.dataset.v127Id);
      };
    });
  }

  function renderNormalTree(){
    const rows=document.getElementById('treeRows');
    const area=document.getElementById('mapCanvasArea');
    const svg=document.getElementById('treeLines');
    if(!rows || !area || !svg) return;

    rows.classList.remove('v118-filter-root');
    rows.classList.add('v109-tree-root','v127-tree-root');
    area.classList.remove('v118-filter-mode');
    svg.style.display='';

    rows.innerHTML=`<div class="v127-network">${directZoneHtml()}${buildNode('self',0)}</div>`;
    bindClicks(rows);
    applyV127Density();

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(typeof window.drawLines==='function') window.drawLines();
    }));
  }

  function renderTreeV127(){
    if(filtersActive() && typeof previousRenderTree==='function'){
      return previousRenderTree.apply(this,arguments);
    }
    return renderNormalTree();
  }

  function refreshVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function stabilizeNormal(){
    if(filtersActive()) return;
    renderNormalTree();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!filtersActive()) renderNormalTree();
    }));
    setTimeout(()=>{ if(!filtersActive()) renderNormalTree(); },120);
  }

  function bind(){
    window.renderTree=renderTreeV127;
    try{ renderTree=renderTreeV127; }catch(e){}
    window.v127ApplyDensity=applyV127Density;
    refreshVersion();
    stabilizeNormal();
    window.addEventListener('resize',()=>{
      if(!filtersActive()){
        applyV127Density();
        requestAnimationFrame(()=>{ if(typeof window.drawLines==='function') window.drawLines(); });
      }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
