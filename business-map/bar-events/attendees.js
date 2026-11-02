(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const integrated=$('communityParticipants')?.dataset.integrated==='true';
 let activeDate=integrated?$('eventDate')?.dataset.date:'';
 let data=BarModel.empty(),uploads=[],busy=false,lastLoaded='',loadError='';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={A:'A｜1部 17:30〜18:30',B:'B｜1部 18:30〜20:30',C:'C｜2部 21:00〜22:00',D:'D｜2部 22:00〜23:00'};
 const collator=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
 const sponsor=e=>String(e.sponsor||'').trim();
 function render(){
  $('viewRows').innerHTML='';$('viewCount').textContent='';
  try{
   if(data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.entries))throw Error('参加者データを読み取れません');
   const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
   const event=integrated&&activeDate?(data.events.find(e=>e.date===activeDate)||{id:activeDate,date:activeDate}):BarModel.nextEvent(data.events,today);
   $('viewDate').textContent=event?`${Number(event.date.slice(5,7))}月${Number(event.date.slice(8,10))}日（土）`:'次回の開催日が未登録です';
   const confirmed=event?data.entries.filter(e=>e.eventId===event.id&&e.status==='yes'&&String(e.name||'').trim()):[];
   const query=$('viewSearch').value.trim().toLocaleLowerCase('ja-JP');
   const kind=$('viewKind').value,slot=$('viewSlot').value,filtered=!!query||kind!=='all'||slot!=='all';
   const rows=confirmed.filter(e=>[e.name,e.sponsor].some(v=>String(v||'').toLocaleLowerCase('ja-JP').includes(query))&&(kind==='all'||e.kind===kind)&&(slot==='all'||(slot==='unset'?!e.slots?.length:e.slots?.includes(slot)))).sort((a,b)=>Number(!sponsor(a))-Number(!sponsor(b))||collator.compare(sponsor(a),sponsor(b))||collator.compare(String(a.name),String(b.name)));
   $('viewCount').textContent=filtered?`${rows.length}人／確定${confirmed.length}人`:`参加確定 ${confirmed.length}人`;
   const groups=new Map();for(const e of rows){const key=sponsor(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
   $('viewRows').innerHTML=[...groups].map(([name,people])=>`<section class="sponsor-group"><h3><span><small>スポンサー</small>${esc(name||'未設定')}</span><span class="sponsor-count">${people.length}人${filtered?'（表示中）':''}</span></h3><table class="participant-table"><thead><tr><th scope="col">名前・区分</th><th scope="col">参加時間</th></tr></thead><tbody>${people.map(e=>{
    const slots=['A','B','C','D'].filter(s=>Array.isArray(e.slots)&&e.slots.includes(s));
    return `<tr><td><strong class="attendee-name">${esc(e.name)}</strong><span class="kind-badge ${e.kind==='prospect'?'prospect':'member'}">${e.kind==='prospect'?'プロスペ':'メンバー'}</span>${e.duplicate?'<small class="time-label warn">重複候補</small>':''}</td><td>${slots.length?slots.map(s=>`<span class="slot-badge slot-${s}" title="${labels[s]}"><b>${s}</b>${labels[s].split(' ').at(-1)}</span>`).join(''):'<span class="time-label warn">時間未定</span>'}</td></tr>`;
   }).join('')}</tbody></table></section>`).join('')||'<p class="empty">'+(filtered?'条件に合う参加者はいません。':'参加確定者はまだいません。')+'</p>';
   const current=data.entries.filter(e=>e.eventId===event?.id),sum=BarModel.summary(current);
   $('cloudSummary').innerHTML='<div class="community-stats">'+[['参加確定',sum.confirmed],['メンバー',sum.confirmed-sum.prospects],['プロスペ',sum.prospects]].map(([label,count])=>`<div><span>${label}</span><strong>${count}<small>人</small></strong></div>`).join('')+`</div><p class="muted">全体：1部 ${sum.part1}人・2部 ${sum.part2}人 ／ 未確定 ${sum.pending}人 ／ 来場 ${sum.arrived}人</p>`+(current.some(e=>e.duplicate)?'<p class="warn">重複候補があります。担当者間で確認してください。</p>':'');
   const byGroup=new Map();for(const e of current){const g=e.group||'未設定';if(!byGroup.has(g))byGroup.set(g,[]);byGroup.get(g).push(e);}
   $('groupSummary').innerHTML=[...byGroup].sort(([a],[b])=>collator.compare(a,b)).map(([g,people])=>{const s=BarModel.summary(people);return `<p class="muted">${esc(g)}：確定 ${s.confirmed}人（プロスペ ${s.prospects}人）／未確定 ${s.pending}人</p>`;}).join('');
   $('uploadList').innerHTML=uploads.filter(u=>u.date===event?.date).map(u=>`<li>${esc(u.owner||'名称未設定')}：${esc(u.uploadedAt?new Date(u.uploadedAt).toLocaleString('ja-JP'):'日時不明')}（登録${u.count}人）</li>`).join('');
   $('viewStatus').textContent=loadError?`取得に失敗しました：${loadError}。${lastLoaded?'表示は前回取得時点のデータです。':'共有データは未取得です。'}`:`${lastLoaded?'取得：'+lastLoaded+'。':''} `+(rows.length?'閲覧専用です。':filtered?'該当する参加者はいません。':event?'参加確定者はまだいません。':'次回のアップロードはまだありません。');
  }catch(e){$('viewDate').textContent='読み込みできませんでした';$('viewStatus').textContent=e.message+'。保存データは変更していません。';}
 }
 async function refresh(){
  if(busy)return;busy=true;$('viewRefresh').disabled=true;
  try{const result=await BarCloud.load();data=result.db;uploads=result.uploads;loadError='';lastLoaded=new Date().toLocaleString('ja-JP');}
  catch(e){loadError=e.message;}
  finally{busy=false;$('viewRefresh').disabled=false;render();}
 }
 $('viewSearch').oninput=render;$('viewRefresh').onclick=refresh;
 $('viewKind').onchange=render;$('viewSlot').onchange=render;
 if(integrated){
  $('viewRefresh').onclick=()=>window.dispatchEvent(new Event('bar-refresh-request'));
  window.addEventListener('bar-active-date',e=>{if(activeDate!==e.detail){activeDate=e.detail;render();}});
  window.addEventListener('bar-shared-ready',e=>{data=e.detail.db;uploads=e.detail.uploads;loadError='';lastLoaded=new Date().toLocaleString('ja-JP');render();});
  window.addEventListener('bar-shared-error',e=>{loadError=e.detail;render();});
  render();
 }else{
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.setInterval(()=>{if(!document.hidden){render();refresh();}},60000);render();refresh();
 }
})();
