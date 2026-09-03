(function(){
  const PATCH_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.87';
  let normalRenderTree=null;

  function filtersActive(){
    const status=document.getElementById('statusFilter')?.value || 'all';
    const type=document.getElementById('typeFilter')?.value || 'all';
    return status!=='all' || type!=='all';
  }

  function filteredMembers(){
    const status=document.getElementById('statusFilter')?.value || 'all';
    const type=document.getElementById('typeFilter')?.value || 'all';
    return (state.members || []).filter(p=>{
      // 「来月以降」は通常マップには戻さず、右上の専用枠で管理する。
      if(p.status==='next-month') return false;
      if(status!=='all' && p.status!==status) return false;
      if(type!=='all' && p.type!==type) return false;
      return true;
    });
  }

  function memberDepth(id){
    let person=getPerson(id);
    let depth=0;
    let guard=0;
    while(person && person.id!=='self' && guard<40){
      depth++;
      person=getPerson(person.parentId || 'self');
      guard++;
    }
    return Math.max(1,depth);
  }

  function bindCardClicks(root){
    root.querySelectorAll('.member-card').forEach(el=>{
      el.onclick=()=>openModal(el.dataset.id);
    });
  }

  function renderFilteredHierarchy(){
    const rows=document.getElementById('treeRows');
    const svg=document.getElementById('treeLines');
    const area=document.getElementById('mapCanvasArea');
    if(!rows || !svg || !area) return;

    const people=filteredMembers();
    const selectedStatus=document.getElementById('statusFilter')?.value || 'all';

    rows.classList.remove('v109-tree-root','v127-tree-root','v111-density-1','v111-density-2','v111-density-3','v111-density-4','v185-dense-tree');
    rows.classList.add('v118-filter-root');
    area.classList.add('v118-filter-mode');
    svg.innerHTML='';
    svg.style.display='none';

    if(!people.length){
      const message=selectedStatus==='next-month'
        ? '「来月以降」のメンバーは右上の専用枠に表示されています'
        : '表示条件に一致するメンバーがいません';
      rows.innerHTML=`<div class="v118-filter-empty">${escapeHtml(message)}</div>`;
      return;
    }

    const maxDepth=Math.max(1,...people.map(p=>memberDepth(p.id)));
    let html='';
    for(let depth=1; depth<=maxDepth; depth++){
      const group=people.filter(p=>memberDepth(p.id)===depth);
      html+=`
        <section class="v118-filter-level ${group.length?'':'is-empty'}" data-depth="${depth}">
          <div class="v118-filter-level-head">
            <span>${escapeHtml(levelName(depth))}</span>
            <b>${group.length}人</b>
          </div>
          <div class="v118-filter-cards">
            ${group.length ? group.map(renderCard).join('') : '<div class="v118-filter-none">該当なし</div>'}
          </div>
        </section>`;
    }
    rows.innerHTML=html;
    bindCardClicks(rows);
  }

  function restoreNormalTree(){
    const rows=document.getElementById('treeRows');
    const svg=document.getElementById('treeLines');
    const area=document.getElementById('mapCanvasArea');
    rows?.classList.remove('v118-filter-root');
    area?.classList.remove('v118-filter-mode');
    if(svg) svg.style.display='';
    if(typeof normalRenderTree==='function') return normalRenderTree();
  }

  window.v118RenderFilteredHierarchy=renderFilteredHierarchy;
  window.v118FiltersActive=filtersActive;

  function patchRenderTree(){
    if(typeof window.renderTree!=='function' || window.renderTree.__v118) return;
    normalRenderTree=window.renderTree;
    const wrapped=function(){
      if(filtersActive()) return renderFilteredHierarchy();
      return restoreNormalTree();
    };
    wrapped.__v118=true;
    window.renderTree=wrapped;
  }

  function bindFilters(){
    const status=document.getElementById('statusFilter');
    const type=document.getElementById('typeFilter');
    if(status) status.onchange=()=>window.renderTree();
    if(type) type.onchange=()=>window.renderTree();
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.18';
  }

  function bind(){
    patchRenderTree();
    bindFilters();
    refreshVersionLabel();
    if(typeof window.renderTree==='function') window.renderTree();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
