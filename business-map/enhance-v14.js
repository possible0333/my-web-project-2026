(function(){
  const RR={S:5,A:4,B:3,C:2,D:1};
  const TYPE_COLOR={ABO:'#3478f6',CUSTOMER:'#22a06b',PROSPECT:'#f59e0b',RETAIL:'#db2777'};
  let rankFilter='all';
  const el=id=>document.getElementById(id);
  const typeLabel=t=>t==='ABO'?'ABO':t==='CUSTOMER'?'カスタマー':t==='RETAIL'?'小売':'プロスペ';
  const pvState=p=>{const t=+p.target||0,a=+p.actual||0;if(t<=0)return['v12-unset','計画未設定'];if(a<=0)return['v12-zero','実績0'];if(a>=t)return['v12-achieved','達成'];return['v12-progress','進行中']};
  const sponsorName=p=>p&&p.parentId?(get(p.parentId)?.name||'未設定'):'—';

  function ensureRetailOption(){
    const ft=el('ft');if(!ft)return;
    if(![...ft.options].some(o=>o.value==='RETAIL')){
      const o=document.createElement('option');o.value='RETAIL';o.textContent='小売';ft.appendChild(o);
    }
  }

  function ensureRankFilter(){
    const tools=document.querySelector('.v12-tools');if(!tools||el('v14RankFilter'))return;
    const sel=document.createElement('select');sel.id='v14RankFilter';sel.className='v14-rank-filter';
    sel.innerHTML='<option value="all">全見込みを表示</option><option value="S">Sのみ</option><option value="A">A以上</option><option value="B">B以上</option><option value="C">C以上</option>';
    const branch=el('v12Branch');if(branch&&branch.nextSibling)tools.insertBefore(sel,branch.nextSibling);else tools.prepend(sel);
    sel.addEventListener('change',e=>{rankFilter=e.target.value;applyFilters();setTimeout(()=>window.dispatchEvent(new Event('resize')),0)});
    if(branch)branch.addEventListener('change',()=>setTimeout(applyFilters,0));
  }

  function branchAllowedIds(){
    const b=el('v12Branch')?.value||'all';
    if(b==='all')return null;
    const root=get(b);return root?new Set(['self',root.id,...desc(root.id).map(x=>x.id)]):null;
  }

  function applyFilters(){
    const tree=el('tree');if(!tree)return;
    const threshold=rankFilter==='all'?0:RR[rankFilter]||0,allowed=branchAllowedIds();
    tree.querySelectorAll('.card[data-id]').forEach(c=>{
      const p=get(c.dataset.id);if(!p)return;
      const branchOk=!allowed||allowed.has(p.id);
      const rankOk=p.id==='self'||rankFilter==='all'||(RR[p.rank]||0)>=threshold;
      c.style.display=branchOk&&rankOk?'':'none';
    });
    tree.querySelectorAll('.level').forEach(row=>{
      const cards=[...row.querySelectorAll('.card[data-id]')];
      if(cards.length)row.style.display=cards.some(c=>c.style.display!=='none')?'':'none';
    });
  }

  function renderTypes(){
    const box=el('types');if(!box)return;
    const c={ABO:0,CUSTOMER:0,PROSPECT:0,RETAIL:0};
    all().forEach(p=>{if(c[p.type]!==undefined)c[p.type]++});
    box.innerHTML=`<span class="chip" style="border-left:4px solid ${TYPE_COLOR.ABO}">ABO ${c.ABO}人</span><span class="chip" style="border-left:4px solid ${TYPE_COLOR.CUSTOMER}">カスタマー ${c.CUSTOMER}人</span><span class="chip" style="border-left:4px solid ${TYPE_COLOR.PROSPECT}">プロスペ ${c.PROSPECT}人</span><span class="chip v14-retail-chip">小売 ${c.RETAIL}人</span>`;
  }

  if(typeof card==='function'){
    card=function(p){
      const g=p.type==='ABO'?gp(p):null,a=A[(p.avatar||0)%36],c=TYPE_COLOR[p.type]||TYPE_COLOR.ABO,[pc,ps]=pvState(p);
      return`<div class="card" data-type="${p.type}" style="--type-color:${c}" data-id="${p.id}"><span class="rk v12-rank-${p.rank}">${p.rank}</span><img class="av" src="${a}"><div class="head"><div class="nm">${esc(p.name)}</div><div class="meta"><span class="v12-type">${typeLabel(p.type)}</span>${p.id!=='self'?`<span class="v12-sponsor">スポンサー：${esc(sponsorName(p))}</span>`:''}</div></div><div class="pv ${pc}"><b>個人PV</b><span class="v12-pvstatus">${ps}</span><br>計画 ${F(p.target)} / 実績 ${F(p.actual)}${g?`<br><b>Group PV</b> 計画 ${F(g.t)} / 実績 ${F(g.a)}`:''}</div>${p.memo?`<div class="memo">📝 ${esc(p.memo)}</div>`:''}</div>`;
    }
  }

  function afterRender(){ensureRetailOption();ensureRankFilter();renderTypes();applyFilters();}
  if(typeof render==='function'){
    const oldRender=render;render=function(){oldRender();afterRender()}
  }
  if(typeof open==='function'){
    const oldOpen=open;open=function(id=null){ensureRetailOption();oldOpen(id);ensureRetailOption();if(id&&id!=='self'){const p=get(id);if(p?.type==='RETAIL')el('ft').value='RETAIL'}}
  }
  ensureRetailOption();ensureRankFilter();renderTypes();applyFilters();
})();
