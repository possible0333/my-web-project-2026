(function(){
  const INFO={
    S:{label:'ほぼ確定',color:'#c98b11'},
    A:{label:'確度高め',color:'#7c3aed'},
    B:{label:'アポ決まっている',color:'#0f8c8c'},
    C:{label:'アポ未確定',color:'#64748b'},
    D:{label:'見込みなし',color:'#d95050'}
  };
  const el=id=>document.getElementById(id);

  function renamePvLabels(){
    document.querySelectorAll('#modal .f label').forEach(l=>{if(l.textContent.trim()==='目標PV')l.textContent='目標個人PV'});
    document.querySelectorAll('#self .small').forEach(x=>{if(x.textContent.trim()==='目標PV')x.textContent='目標個人PV'});
  }

  function teamSummary(){
    const self=el('self'); if(!self)return;
    const body=self.children[1]; if(!body)return;
    body.querySelector('.v13-team-kpis')?.remove();
    const people=all(),teamTarget=people.reduce((s,p)=>s+(+p.target||0),0),teamActual=people.reduce((s,p)=>s+(+p.actual||0),0);
    const box=document.createElement('div');box.className='v13-team-kpis';
    box.innerHTML=`
      <div class="v13-team-kpi"><div class="v13-kpi-label">チーム目標PV</div><div class="v13-kpi-value">${F(teamTarget)}</div></div>
      <div class="v13-team-kpi"><div class="v13-kpi-label">チーム実績PV</div><div class="v13-kpi-value">${F(teamActual)}</div></div>
      <div class="v13-team-kpi"><div class="v13-kpi-label">チーム達成率</div><div class="v13-kpi-value">${PC(teamActual,teamTarget)}%</div></div>
      <div class="v13-team-kpi"><div class="v13-kpi-label">登録人数</div><div class="v13-kpi-value">${people.length}人</div></div>`;
    body.appendChild(box);
  }

  function prospectSummary(){
    const ranks=el('ranks'); if(!ranks)return;
    let head=el('v13ProspectHead');
    if(!head){head=document.createElement('div');head.id='v13ProspectHead';head.className='v13-prospect-head';ranks.parentNode.insertBefore(head,ranks)}
    head.innerHTML='<strong>見込み内訳</strong><span>S〜Dは見込み確度</span>';
    const counts={S:0,A:0,B:0,C:0,D:0};S.members.forEach(p=>{if(counts[p.rank]!==undefined)counts[p.rank]++});
    ranks.className='ranks v13-prospects';
    ranks.innerHTML=['S','A','B','C','D'].map(r=>`<div class="v13-prospect-card" data-rank="${r}"><div class="v13-prospect-code"><span>${r}</span><span class="v13-prospect-count">${counts[r]}人</span></div><div class="v13-prospect-desc">${INFO[r].label}</div></div>`).join('');
  }

  function rankHints(){
    document.querySelectorAll('.card[data-id]').forEach(c=>{const p=get(c.dataset.id),r=c.querySelector('.rk');if(p&&r&&INFO[p.rank])r.title=`${p.rank}：${INFO[p.rank].label}`});
    const sr=document.querySelector('.v12-self-rank');if(sr&&INFO[S.self.rank])sr.title=`${S.self.rank}：${INFO[S.self.rank].label}`;
  }

  async function exportJsonMobile(){
    const text=JSON.stringify(S,null,2),blob=new Blob([text],{type:'application/json'}),date=new Date().toISOString().slice(0,10).replace(/-/g,''),name=`business_map_backup_${date}.json`;
    let file=null;try{file=new File([blob],name,{type:'application/json'})}catch(e){}
    try{
      if(file&&navigator.share){
        const shareData={files:[file],title:'Business Mapバックアップ'};
        if(!navigator.canShare||navigator.canShare(shareData)){await navigator.share(shareData);return}
      }
    }catch(e){if(e&&e.name==='AbortError')return}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function afterRender(){renamePvLabels();teamSummary();prospectSummary();rankHints();}

  if(typeof render==='function'){
    const oldRender=render;render=function(){oldRender();afterRender()}
  }
  if(typeof open==='function'){
    const oldOpen=open;open=function(id=null){oldOpen(id);renamePvLabels()}
  }
  if(typeof exp==='function')exp=exportJsonMobile;
  const ex=el('ex');if(ex)ex.onclick=exportJsonMobile;
  afterRender();
})();
