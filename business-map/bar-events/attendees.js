(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const integrated=$('communityParticipants')?.dataset.integrated==='true';
 let activeDate=integrated?$('eventDate')?.dataset.date:'';
 let data=BarModel.empty(),uploads=[],busy=false,lastLoaded='',loadError='';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={A:'A｜1部 17:30〜18:30',B:'B｜1部 18:30〜20:30',C:'C｜2部 21:00〜22:00'};
 function render(){
  $('viewRows').innerHTML='';$('viewCount').textContent='';
  try{
   if(data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.entries))throw Error('参加者データを読み取れません');
   const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
   const event=integrated&&activeDate?(data.events.find(e=>e.date===activeDate)||{id:activeDate,date:activeDate}):BarModel.nextEvent(data.events,today);
   $('viewDate').textContent=event?`${Number(event.date.slice(5,7))}月${Number(event.date.slice(8,10))}日（土）`:'次回の開催日が未登録です';
   const confirmed=event?data.entries.filter(e=>e.eventId===event.id&&e.status==='yes'&&String(e.name||'').trim()):[];
   const query=$('viewSearch').value.trim().toLocaleLowerCase('ja-JP');
   const rows=confirmed.filter(e=>[e.name,e.sponsor].some(v=>String(v||'').toLocaleLowerCase('ja-JP').includes(query))).sort((a,b)=>String(a.sponsor||'').localeCompare(String(b.sponsor||''),'ja')||String(a.name).localeCompare(String(b.name),'ja'));
   $('viewCount').textContent=query?`${rows.length}人／確定${confirmed.length}人`:`参加確定 ${confirmed.length}人`;
   $('viewRows').innerHTML=rows.map(e=>{
    const slots=['A','B','C'].filter(s=>Array.isArray(e.slots)&&e.slots.includes(s));
    return `<tr><td>${esc(e.name)}${e.duplicate?'<small class="time-label warn">重複候補</small>':''}</td><td>${esc(e.sponsor||'未設定')}</td><td>${slots.length?slots.map(s=>`<span class="time-label">${labels[s]}</span>`).join(''):'<span class="time-label warn">時間未定</span>'}</td></tr>`;
   }).join('');
   const current=data.entries.filter(e=>e.eventId===event?.id),sum=BarModel.summary(current);
   $('cloudSummary').textContent=`確定 ${sum.confirmed}人（プロスペ ${sum.prospects}人）／未確定 ${sum.pending}人／来場 ${sum.arrived}人。1部 ${sum.part1}人・2部 ${sum.part2}人。${current.some(e=>e.duplicate)?'重複候補は自動統合していません。担当者間で確認してください。':''}`;
   $('groupSummary').innerHTML=[...new Set(current.map(e=>e.group||'未設定'))].map(g=>{const s=BarModel.summary(current.filter(e=>(e.group||'未設定')===g));return `<p class="muted">${esc(g)}：確定 ${s.confirmed}人（プロスペ ${s.prospects}人）／未確定 ${s.pending}人</p>`;}).join('');
   $('uploadList').innerHTML=uploads.filter(u=>u.date===event?.date).map(u=>`<li>${esc(u.owner||'名称未設定')}：${esc(u.uploadedAt?new Date(u.uploadedAt).toLocaleString('ja-JP'):'日時不明')}（登録${u.count}人）</li>`).join('');
   $('viewStatus').textContent=loadError?`取得に失敗しました：${loadError}。${lastLoaded?'表示は前回取得時点のデータです。':'共有データは未取得です。'}`:`${lastLoaded?'取得：'+lastLoaded+'。':''} `+(rows.length?'閲覧専用です。':query?'該当する参加者はいません。':event?'参加確定者はまだいません。':'次回のアップロードはまだありません。');
  }catch(e){$('viewDate').textContent='読み込みできませんでした';$('viewStatus').textContent=e.message+'。保存データは変更していません。';}
 }
 async function refresh(){
  if(busy)return;busy=true;$('viewRefresh').disabled=true;
  try{const result=await BarCloud.load();data=result.db;uploads=result.uploads;loadError='';lastLoaded=new Date().toLocaleString('ja-JP');}
  catch(e){loadError=e.message;}
  finally{busy=false;$('viewRefresh').disabled=false;render();}
 }
 $('viewSearch').oninput=render;$('viewRefresh').onclick=refresh;
 if(integrated){
  $('viewRefresh').onclick=()=>window.dispatchEvent(new Event('bar-refresh-request'));
  window.addEventListener('bar-active-date',e=>{activeDate=e.detail;render();});
  window.addEventListener('bar-shared-ready',e=>{data=e.detail.db;uploads=e.detail.uploads;loadError='';lastLoaded=new Date().toLocaleString('ja-JP');render();});
  window.addEventListener('bar-shared-error',e=>{loadError=e.detail;render();});
  render();
 }else{
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.setInterval(()=>{if(!document.hidden){render();refresh();}},60000);render();refresh();
 }
})();
