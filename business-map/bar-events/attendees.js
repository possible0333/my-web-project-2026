(function(){
 'use strict';
 const KEY='business_map_bar_preview_v1',$=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={A:'A｜1部 17:30〜18:30',B:'B｜1部 18:30〜20:30',C:'C｜2部 21:00〜22:00'};
 function render(){
  $('viewRows').innerHTML='';$('viewCount').textContent='';
  try{
   const data=JSON.parse(localStorage.getItem(KEY)||'null')||BarModel.empty();
   if(data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.entries))throw Error('参加者データを読み取れません');
   const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
   const event=BarModel.upcoming(data.events,today);
   $('viewDate').textContent=event?`${Number(event.date.slice(5,7))}月${Number(event.date.slice(8,10))}日（土）`:'次回の開催日が未登録です';
   const confirmed=event?data.entries.filter(e=>e.eventId===event.id&&e.status==='yes'&&String(e.name||'').trim()):[];
   const query=$('viewSearch').value.trim().toLocaleLowerCase('ja-JP');
   const rows=confirmed.filter(e=>[e.name,e.sponsor].some(v=>String(v||'').toLocaleLowerCase('ja-JP').includes(query))).sort((a,b)=>String(a.sponsor||'').localeCompare(String(b.sponsor||''),'ja')||String(a.name).localeCompare(String(b.name),'ja'));
   $('viewCount').textContent=query?`${rows.length}人／確定${confirmed.length}人`:`参加確定 ${confirmed.length}人`;
   $('viewRows').innerHTML=rows.map(e=>{
    const slots=['A','B','C'].filter(s=>Array.isArray(e.slots)&&e.slots.includes(s));
    return `<tr><td>${esc(e.name)}</td><td>${esc(e.sponsor||'未設定')}</td><td>${slots.length?slots.map(s=>`<span class="time-label">${labels[s]}</span>`).join(''):'<span class="time-label warn">時間未定</span>'}</td></tr>`;
   }).join('');
   $('viewStatus').textContent=rows.length?'閲覧専用です。出欠の変更は「入力画面へ」から。':query?'該当する参加者はいません。':event?'参加確定者はまだいません。':'入力画面で開催日を登録してください。';
  }catch(e){$('viewDate').textContent='読み込みできませんでした';$('viewStatus').textContent=e.message+'。保存データは変更していません。';}
 }
 $('viewSearch').oninput=render;$('viewRefresh').onclick=render;
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null)render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
 window.setInterval(render,60000);render();
})();
