(function(){
  const TC={ABO:'#3478f6',CUSTOMER:'#22a06b',PROSPECT:'#f59e0b'};
  let branch='all', zoom=1;
  const el=id=>document.getElementById(id);
  const pvState=p=>{const t=+p.target||0,a=+p.actual||0;if(t<=0)return['v12-unset','目標未設定'];if(a<=0)return['v12-zero','実績0'];if(a>=t)return['v12-achieved','達成'];return['v12-progress','進行中']};
  const sponsor=p=>p&&p.parentId?(get(p.parentId)?.name||'未設定'):'—';

  function replaceEditorLabel(){
    document.querySelectorAll('#modal .f label').forEach(l=>{if(l.textContent.trim()==='親メンバー')l.textContent='スポンサー'});
    const b=el('close'); if(b){b.onclick=null;b.addEventListener('click',e=>{e.preventDefault();el('modal')?.classList.remove('open')})}
  }

  function createTools(){
    const wrap=document.querySelector('.wrap'); if(!wrap||el('v12Branch'))return;
    const tools=document.createElement('div');tools.className='v12-tools';tools.innerHTML=`<select id="v12Branch"><option value="all">全フロントを表示</option></select><button class="btn" id="v12ZoomOut">−</button><button class="btn" id="v12Fit">全体</button><button class="btn" id="v12ZoomIn">＋</button><span class="v12-zoom" id="v12ZoomVal">100%</span>`;
    const legend=document.createElement('div');legend.className='v12-legend';legend.innerHTML='<span><i class="v12-dot" style="background:#3478f6"></i>ABO</span><span><i class="v12-dot" style="background:#22a06b"></i>カスタマー</span><span><i class="v12-dot" style="background:#f59e0b"></i>プロスペ</span><span><i class="v12-line-sample"></i>スポンサーライン</span><span>🟢達成 / 🔴実績0 / 🟡目標未設定</span>';
    wrap.parentNode.insertBefore(tools,wrap);wrap.parentNode.insertBefore(legend,wrap);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='v12Lines';svg.classList.add('v12-lines');wrap.insertBefore(svg,wrap.firstChild);
    el('v12Branch').addEventListener('change',e=>{branch=e.target.value;applyBranch();scheduleLines()});
    el('v12ZoomOut').addEventListener('click',()=>setZoom(Math.max(.55,zoom-.1)));
    el('v12ZoomIn').addEventListener('click',()=>setZoom(Math.min(1.35,zoom+.1)));
    el('v12Fit').addEventListener('click',()=>{const n=kids('self').length;setZoom(n<=4?1:n<=6?.85:n<=9?.7:.58)});
    wrap.addEventListener('scroll',scheduleLines,{passive:true});window.addEventListener('resize',scheduleLines);
  }
  function setZoom(z){zoom=Math.round(z*100)/100;const tree=el('tree');if(tree)tree.style.zoom=zoom;el('v12ZoomVal').textContent=Math.round(zoom*100)+'%';scheduleLines()}
  function updateTools(){
    createTools();const fronts=kids('self').slice();const sel=el('v12Branch');if(sel){const keep=branch;sel.innerHTML='<option value="all">全フロントを表示</option>'+fronts.map(x=>`<option value="${x.id}">${esc(x.name)} 系列</option>`).join('');if(fronts.some(x=>x.id===keep))sel.value=keep;else{branch='all';sel.value='all'}}
    document.querySelector('.wrap')?.classList.toggle('v12-compact',fronts.length>4);
  }
  function visibleIds(){if(branch==='all')return null;const root=get(branch);return root?new Set(['self',root.id,...desc(root.id).map(x=>x.id)]):null}
  function applyBranch(){const ids=visibleIds();const tree=el('tree');if(!tree)return;tree.querySelectorAll('.card[data-id]').forEach(c=>{c.style.display=!ids||ids.has(c.dataset.id)?'':'none'});tree.querySelectorAll('.level').forEach(row=>{row.style.display=[...row.querySelectorAll('.card[data-id]')].some(c=>c.style.display!=='none')?'':'none'})}
  function enhanceSelf(){const b=document.querySelector('#self b');if(!b)return;b.className='v12-self-rank v12-rank-'+b.textContent.trim()}
  function drawLines(){
    const wrap=document.querySelector('.wrap'),svg=el('v12Lines'),tree=el('tree');if(!wrap||!svg||!tree)return;const wr=wrap.getBoundingClientRect(),cards=[...tree.querySelectorAll('.card[data-id]')].filter(c=>c.style.display!=='none');let maxX=Math.max(wrap.clientWidth,tree.scrollWidth*zoom),maxY=Math.max(wrap.clientHeight,tree.scrollHeight*zoom);svg.setAttribute('width',maxX);svg.setAttribute('height',maxY);svg.setAttribute('viewBox',`0 0 ${maxX} ${maxY}`);let out='';const pos={};cards.forEach(c=>{const r=c.getBoundingClientRect();pos[c.dataset.id]={x:r.left-wr.left+wrap.scrollLeft,y:r.top-wr.top+wrap.scrollTop,w:r.width,h:r.height}});cards.forEach(c=>{const p=get(c.dataset.id);if(!p?.parentId||!pos[p.parentId])return;const a=pos[p.parentId],b=pos[p.id],x1=a.x+a.w/2,y1=a.y+a.h,x2=b.x+b.w/2,y2=b.y,mid=(y1+y2)/2;out+=`<path d="M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}" fill="none" stroke="#9fb0c8" stroke-width="2"/>`});svg.innerHTML=out;
  }
  let raf=0;function scheduleLines(){cancelAnimationFrame(raf);raf=requestAnimationFrame(drawLines)}

  if(typeof card==='function'){
    card=function(p){const g=p.type==='ABO'?gp(p):null,a=A[(p.avatar||0)%36],c=TC[p.type]||TC.ABO,[pc,ps]=pvState(p);return`<div class="card" style="--type-color:${c}" data-id="${p.id}"><span class="rk v12-rank-${p.rank}">${p.rank}</span><img class="av" src="${a}"><div class="head"><div class="nm">${esc(p.name)}</div><div class="meta"><span class="v12-type">${L(p.type)}</span>${p.id!=='self'?`<span class="v12-sponsor">スポンサー：${esc(sponsor(p))}</span>`:''}</div></div><div class="pv ${pc}"><b>個人PV</b><span class="v12-pvstatus">${ps}</span><br>目標 ${F(p.target)} / 実績 ${F(p.actual)}${g?`<br><b>Group PV</b> 目標 ${F(g.t)} / 実績 ${F(g.a)}`:''}</div>${p.memo?`<div class="memo">📝 ${esc(p.memo)}</div>`:''}</div>`}
  }
  if(typeof render==='function'){
    const oldRender=render;render=function(){oldRender();replaceEditorLabel();updateTools();applyBranch();enhanceSelf();scheduleLines()}
  }
  if(typeof open==='function'){
    const oldOpen=open;open=function(id=null){oldOpen(id);replaceEditorLabel();if(id&&id!=='self'){const invalid=new Set([id,...desc(id).map(x=>x.id)]);const fp=el('fp'),p=get(id);if(fp){fp.innerHTML=all().filter(x=>!invalid.has(x.id)).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');fp.value=p?.parentId||'self'}}}
  }
  replaceEditorLabel();createTools();
})();
