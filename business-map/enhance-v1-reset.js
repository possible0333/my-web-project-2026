(function(){
  const TC={ABO:'#3478f6',CUSTOMER:'#22a06b',PROSPECT:'#f59e0b',RETAIL:'#db2777'};
  const el=id=>document.getElementById(id);
  const typeLabel=t=>t==='ABO'?'ABO':t==='CUSTOMER'?'カスタマー':t==='RETAIL'?'小売':'プロスペ';
  const pvState=p=>{const t=+p.target||0,a=+p.actual||0;if(t<=0)return['v12-unset','計画未設定'];if(a<=0)return['v12-zero','実績0'];if(a>=t)return['v12-achieved','達成'];return['v12-progress','進行中']};
  const sponsorName=p=>p&&p.parentId?(get(p.parentId)?.name||'未設定'):'—';

  function ensureImageSaveButton(){
    const tools=document.querySelector('.section>.title>div');
    if(!tools||el('v1ImageSave'))return;
    const b=document.createElement('button');b.id='v1ImageSave';b.className='btn v1-image-save';b.textContent='画像保存';
    b.addEventListener('click',()=>el('png')?.click());
    tools.prepend(b);
  }

  function ensureMemoFields(){
    const fm=el('fm');if(!fm)return;
    const field=fm.closest('.f');if(field){const lab=field.querySelector('label');if(lab)lab.textContent='メモ1'}
    const grid=document.querySelector('#modal .grid');if(!grid)return;
    const avatarField=el('avs')?.closest('.f');
    if(!el('fm2')){
      const d=document.createElement('div');d.className='f full';d.innerHTML='<label>メモ2</label><textarea id="fm2"></textarea>';grid.insertBefore(d,avatarField||null);
    }
    if(!el('fm3')){
      const d=document.createElement('div');d.className='f full';d.innerHTML='<label>メモ3</label><textarea id="fm3"></textarea>';grid.insertBefore(d,avatarField||null);
    }
  }

  function memoHtml(p){
    const arr=[p.memo,p.memo2,p.memo3].map(x=>(x||'').trim()).filter(Boolean);
    if(!arr.length)return'';
    return `<div class="v1-memo-list">${arr.map(x=>`<div class="v1-memo-line">📝 ${esc(x)}</div>`).join('')}</div>`;
  }

  if(typeof card==='function'){
    card=function(p){
      const g=p.type==='ABO'?gp(p):null,a=A[(p.avatar||0)%36],c=TC[p.type]||TC.ABO,[pc,ps]=pvState(p);
      return`<div class="card" data-type="${p.type}" style="--type-color:${c}" data-id="${p.id}"><span class="rk v12-rank-${p.rank}">${p.rank}</span><img class="av" src="${a}"><div class="head"><div class="nm">${esc(p.name)}</div><div class="meta"><span class="v12-type">${typeLabel(p.type)}</span>${p.id!=='self'?`<span class="v12-sponsor">スポンサー：${esc(sponsorName(p))}</span>`:''}</div></div><div class="pv ${pc}"><b>個人PV</b><span class="v12-pvstatus">${ps}</span><br>計画 ${F(p.target)} / 実績 ${F(p.actual)}${g?`<br><b>Group PV</b> 計画 ${F(g.t)} / 実績 ${F(g.a)}`:''}</div>${memoHtml(p)}</div>`;
    }
  }

  if(typeof open==='function'){
    const oldOpen=open;
    open=function(id=null){
      oldOpen(id);ensureMemoFields();
      const p=id?get(id):null;
      el('fm2').value=p?.memo2||'';
      el('fm3').value=p?.memo3||'';
    }
  }

  function saveThreeMemos(){
    const d={name:fn.value.trim()||'名称未設定',type:ft.value,parentId:fp.value||'self',target:+fg.value||0,actual:+fa.value||0,rank:fr.value,memo:fm.value.trim(),memo2:el('fm2')?.value.trim()||'',memo3:el('fm3')?.value.trim()||'',avatar:SA};
    if(E==='self')Object.assign(S.self,d,{id:'self',type:'ABO',parentId:null});
    else if(E){const p=get(E);Object.assign(p,d);if(desc(E).some(x=>x.id===p.parentId))p.parentId='self'}
    else S.members.push({id:'m_'+Math.random().toString(36).slice(2,9),...d});
    el('modal')?.classList.remove('open');render();
  }

  function afterRender(){ensureImageSaveButton();ensureMemoFields();}
  if(typeof render==='function'){
    const oldRender=render;render=function(){oldRender();afterRender()}
  }

  ensureMemoFields();ensureImageSaveButton();
  const saveBtn=el('save');if(saveBtn)saveBtn.onclick=saveThreeMemos;
})();
