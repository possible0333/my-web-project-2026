(function(){
  const APP_VERSION='v1.27';
  const previousRenderTree=window.renderTree;
  let mapPage='all';
  const MAP_PAGES=[
    {id:'all',label:'1枚目 全体図'},
    {id:'front',label:'2枚目 フロントライン'},
    {id:'group',label:'3枚目 グループマップ'},
    {id:'deep',label:'4枚目 グループマップ2'}
  ];

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
  function deadlineOverdue(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(!m) m=s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    if(!m) return false;
    const month=Number(m[1]),day=Number(m[2]);
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const target=new Date(now.getFullYear(),month-1,day);
    return target.getMonth()===month-1&&target.getDate()===day&&target<today;
  }

  function miniCard(p){
    const deadline=deadlineText(p.deadline);
    const action=String(p.nextAction||'').trim();
    const actionText=[deadline?`期限 ${deadline}`:'',action].filter(Boolean).join('｜');
    return `<button type="button" class="v127-mini-card" data-v127-id="${escapeHtml(p.id)}" data-type="${escapeHtml(p.type)}">
      <span class="v127-mini-status" style="background:${currentStatusColor(p)}" title="${escapeHtml(currentStatusLabel(p))}"></span>
      ${Number(p.target||0)>0&&Number(p.actual||0)>=Number(p.target||0)?'<span class="v153-achieved v153-mini-achieved">達成</span>':''}
      ${deadlineOverdue(p.deadline)?'<span class="v169-review-stamp v169-mini-review">要確認</span>':''}
      <img class="v127-mini-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
      <span class="v127-mini-main">
        <span class="v127-mini-name" title="${escapeHtml(p.name||'名称未設定')}">${escapeHtml(p.name||'名称未設定')}</span>
        <span class="v127-mini-meta"><span class="v127-mini-type">${escapeHtml(p.type)}</span><span class="v127-mini-pv"><b>目 ${fmt(p.target||0)}</b><b>実 ${fmt(p.actual||0)}</b></span></span>
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

  function monthlyPvSummaryHtml(){
    const target=Math.max(0,Number(state.self?.monthlyTargetPv||0));
    const gp=typeof groupPvFor==='function'?groupPvFor('self'):{actual:0};
    const actual=Math.max(0,Number(gp?.actual||0));
    const remaining=Math.max(0,target-actual);
    const achieved=target>0&&remaining===0;
    return `<section class="v176-map-pv-summary" aria-label="今月のPV進捗">
      <div><span>今月の目標PV</span><strong>${target?fmt(target):'未設定'}</strong></div>
      <div><span>現在の実績PV<br>（グループ合計）</span><strong>${fmt(actual)}</strong></div>
      <div class="${achieved?'is-achieved':''}"><span>${achieved?'目標達成':'残りPV'}</span><strong>${target?fmt(remaining):'―'}</strong></div>
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

  function buildNodeLimited(id,depth,maxDepth){
    const p=id==='self' ? state.self : getPerson(id);
    if(!p || (id!=='self' && !isCurrent(p))) return '';
    const kids=depth<maxDepth?treeChildren(id):[];
    const card=id==='self' ? selfCardHtml() : renderCard(p);
    return `<div class="v109-node" data-node-id="${escapeHtml(id)}">
      ${id==='self'?'<div class="v127-self-label">MAP OWNER</div>':''}
      ${card}
      ${kids.length?`<div class="v109-children">${kids.map(c=>buildNodeLimited(c.id,depth+1,maxDepth)).join('')}</div>`:''}
    </div>`;
  }

  function directFrontOf(person){
    let cursor=person,guard=0;
    while(cursor&&cursor.parentId&&cursor.parentId!=='self'&&guard++<40) cursor=getPerson(cursor.parentId);
    return cursor?.parentId==='self'?cursor:null;
  }

  function deepGroupsHtml(){
    const fourth=(state.members||[]).filter(p=>isCurrent(p)&&depthOf(p.id)===4);
    const groups=new Map();
    fourth.forEach(p=>{
      const front=directFrontOf(p);
      if(!front) return;
      if(!groups.has(front.id)) groups.set(front.id,{front,nodes:[]});
      groups.get(front.id).nodes.push(p);
    });
    if(!groups.size) return `<div class="v180-deep-empty">フォース以降のメンバーはまだいません</div>`;
    return [...groups.values()].map(({front,nodes})=>`<section class="v180-deep-group">
      <div class="v180-deep-title">${escapeHtml(front.name||'名称未設定')}グループ</div>
      <div class="v180-deep-roots">${nodes.map(p=>buildNode(p.id,4)).join('')}</div>
    </section>`).join('');
  }

  function pageContentsHtml(){
    if(mapPage==='front') return `${monthlyPvSummaryHtml()}${directZoneHtml()}${buildNodeLimited('self',0,1)}`;
    if(mapPage==='group') return `${monthlyPvSummaryHtml()}${buildNodeLimited('self',0,3)}`;
    if(mapPage==='deep') return `${monthlyPvSummaryHtml()}<div class="v180-deep-owner">${buildNodeLimited('self',0,0)}</div>${deepGroupsHtml()}`;
    return `${monthlyPvSummaryHtml()}${directZoneHtml()}${buildNode('self',0)}`;
  }

  function ensurePageControls(){
    if(document.getElementById('v180MapPages')) return;
    const map=document.querySelector('.map-wrap');
    if(!map) return;
    const nav=document.createElement('nav');
    nav.id='v180MapPages'; nav.className='v180-map-pages'; nav.setAttribute('aria-label','マップページ切り替え');
    nav.innerHTML=MAP_PAGES.map(p=>`<button type="button" data-v180-page="${p.id}">${p.label}</button>`).join('');
    map.insertAdjacentElement('beforebegin',nav);
    nav.addEventListener('click',e=>{const button=e.target.closest('[data-v180-page]');if(button) setMapPage(button.dataset.v180Page);});
    updatePageControls();
  }

  function updatePageControls(){
    document.querySelectorAll('[data-v180-page]').forEach(b=>b.classList.toggle('is-active',b.dataset.v180Page===mapPage));
  }

  function setMapPage(next){
    if(!MAP_PAGES.some(p=>p.id===next)) next='all';
    const status=document.getElementById('statusFilter'),type=document.getElementById('typeFilter');
    if(status) status.value='all'; if(type) type.value='all';
    mapPage=next; updatePageControls(); renderNormalTree();
    document.querySelector('.map-wrap')?.scrollTo?.({left:0,top:0,behavior:'smooth'});
    return mapPage;
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

    rows.innerHTML=`<div class="v127-network v180-page-${mapPage}" data-v180-current-page="${mapPage}">${pageContentsHtml()}</div>`;
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
    ensurePageControls();
    window.renderTree=renderTreeV127;
    try{ renderTree=renderTreeV127; }catch(e){}
    window.v127ApplyDensity=applyV127Density;
    window.v180SetMapPage=setMapPage;
    window.v180GetMapPage=()=>mapPage;
    window.v180MapPages=MAP_PAGES.map(p=>({...p}));
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
