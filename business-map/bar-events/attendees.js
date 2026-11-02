(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const integrated=$('communityParticipants')?.dataset.integrated==='true';
 let activeDate=integrated?$('eventDate')?.dataset.date:'';
 let data=BarModel.empty(),uploads=[],deletedEntries=[],busy=false,lastLoaded='',loadError='',adminPassword='',adminUntil=0,adminSaving=false;
 let editing=null;
 const adminActive=()=>!!adminPassword&&Date.now()<adminUntil;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={A:'A｜1部 17:30〜18:30',B:'B｜1部 18:30〜20:30',C:'C｜2部 21:00〜22:00',D:'D｜2部 22:00〜23:00'};
 const collator=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
 const sponsor=e=>String(e.sponsor||'').trim();
 $('cloudSummary').insertAdjacentHTML('beforebegin','<div class="bar-admin-toolbar"><button id="barAdminToggle">🔒 管理者モード</button><span id="barAdminState" class="muted">通常モード</span><label id="barDeletedWrap" hidden><input id="barShowDeleted" type="checkbox">削除済みも表示</label></div>');
 document.body.insertAdjacentHTML('beforeend','<dialog id="barAdminDialog"><form id="barAdminForm"><div class="row"><h2 id="barAdminTitle" class="grow"></h2><button id="barAdminClose" type="button">閉じる</button></div><div id="barAdminFields"></div><p id="barAdminError" role="alert"></p><button id="barAdminSave" class="primary" type="submit">保存</button></form></dialog>');
 function adminUi(){
  if(!adminActive()){adminPassword='';adminUntil=0;}
  $('barAdminToggle').textContent=adminActive()?'🔓 管理者モードを終了':'🔒 管理者モード';
  $('barAdminState').textContent=adminActive()?'全登録者を編集可能。修正は再アップロード後も優先されます。':'通常モード';
  $('barDeletedWrap').hidden=!adminActive();
 }
 function showAdmin(title,fields,entry=null){editing=entry;$('barAdminTitle').textContent=title;$('barAdminFields').innerHTML=fields;$('barAdminError').textContent='';$('barAdminSave').textContent=entry?'変更を保存':'管理者モードに入る';$('barAdminDialog').showModal();}
 $('barAdminClose').onclick=()=>{if(!adminSaving)$('barAdminDialog').close();};
 $('barAdminToggle').onclick=()=>{if(adminActive()){adminPassword='';adminUntil=0;$('barAdminDialog').close();render();return;}showAdmin('管理者モード','<label>管理者パスワード<input id="barAdminPassword" type="password" autocomplete="off" required></label>');};
 $('barShowDeleted').onchange=render;
 async function reloadShared(){if(integrated)window.dispatchEvent(new Event('bar-refresh-request'));else await refresh();}
 $('barAdminForm').onsubmit=async ev=>{ev.preventDefault();if(adminSaving)return;adminSaving=true;$('barAdminSave').disabled=true;$('barAdminClose').disabled=true;
  try{if(!editing){const password=$('barAdminPassword').value;if(!await BarCloud.verifyAdmin(password))throw Error('パスワードが違うか、一時的に制限されています');adminPassword=password;adminUntil=Date.now()+15*60000;$('barAdminPassword').value='';}
   else{if(!adminActive())throw Error('管理者モードの有効期限が切れました。再認証してください');
    const patch={name:$('barEditName').value.trim(),sponsor:$('barEditSponsor').value.trim(),group:$('barEditGroup').value.trim(),kind:$('barEditKind').value,status:$('barEditStatus').value,slots:[...document.querySelectorAll('[data-admin-slot]:checked')].map(e=>e.dataset.adminSlot),arrived:$('barEditArrived').checked};
    if(patch.status==='no'){patch.slots=[];patch.arrived=false;}await BarCloud.moderate(adminPassword,editing,'edit',patch);await reloadShared();
   }$('barAdminDialog').close();render();
  }catch(e){$('barAdminError').textContent=e.message;}finally{adminSaving=false;$('barAdminSave').disabled=false;$('barAdminClose').disabled=false;}
 };
 $('viewRows').onclick=async ev=>{
  const b=ev.target.closest('[data-admin-action]');if(!b||!adminActive()||adminSaving)return;
  const entry=[...data.entries,...deletedEntries].find(e=>e.id===b.dataset.entry);if(!entry)return;
  if(b.dataset.adminAction==='edit'){
   showAdmin('参加者を編集',`<label>名前<input id="barEditName" maxlength="80" required value="${esc(entry.name)}"></label><label>スポンサー<input id="barEditSponsor" maxlength="80" value="${esc(entry.sponsor)}"></label><label>グループ<input id="barEditGroup" maxlength="80" value="${esc(entry.group)}"></label><label>区分<select id="barEditKind"><option value="member">メンバー</option><option value="prospect">プロスペ</option></select></label><label>出欠<select id="barEditStatus"><option value="yes">参加</option><option value="pending">未確定</option><option value="no">不参加</option></select></label><div class="checks">${Object.entries(labels).map(([key,label])=>`<label><input type="checkbox" data-admin-slot="${key}" ${entry.slots.includes(key)?'checked':''}>${label}</label>`).join('')}</div><label class="candidate"><input type="checkbox" id="barEditArrived" ${entry.arrived?'checked':''}>来場済み</label>`,entry);$('barEditKind').value=entry.kind;$('barEditStatus').value=entry.status;return;
  }
  const action=b.dataset.adminAction;if(!confirm(entry.name+(action==='delete'?'を今回の共有参加者から削除します。管理者モードで復元できます。':'を復元します。')))return;
  adminSaving=true;b.disabled=true;try{await BarCloud.moderate(adminPassword,entry,action);await reloadShared();}catch(e){alert(e.message);}finally{adminSaving=false;b.disabled=false;}
 };
 window.setInterval(()=>{if(adminPassword&&!adminActive()){adminPassword='';$('barAdminDialog').close();render();}},15000);

 function render(){
  adminUi();$('viewRows').innerHTML='';$('viewCount').textContent='';
  try{
   if(data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.entries))throw Error('参加者データを読み取れません');
   const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
   const event=integrated&&activeDate?(data.events.find(e=>e.date===activeDate)||{id:activeDate,date:activeDate}):BarModel.nextEvent(data.events,today);
   $('viewDate').textContent=event?`${Number(event.date.slice(5,7))}月${Number(event.date.slice(8,10))}日（土）`:'次回の開催日が未登録です';
   const confirmed=event?data.entries.filter(e=>e.eventId===event.id&&e.status==='yes'&&String(e.name||'').trim()):[];
   const query=$('viewSearch').value.trim().toLocaleLowerCase('ja-JP');
   const kind=$('viewKind').value,slot=$('viewSlot').value,filtered=!!query||kind!=='all'||slot!=='all';
   const shown=adminActive()?[...data.entries,...($('barShowDeleted').checked?deletedEntries:[])].filter(e=>e.eventId===event?.id):confirmed;
   const rows=shown.filter(e=>[e.name,e.sponsor].some(v=>String(v||'').toLocaleLowerCase('ja-JP').includes(query))&&(kind==='all'||e.kind===kind)&&(slot==='all'||(slot==='unset'?!e.slots?.length:e.slots?.includes(slot)))).sort((a,b)=>Number(!sponsor(a))-Number(!sponsor(b))||collator.compare(sponsor(a),sponsor(b))||collator.compare(String(a.name),String(b.name)));
   $('viewCount').textContent=adminActive()?`登録者 ${rows.length}人`:filtered?`${rows.length}人／確定${confirmed.length}人`:`参加確定 ${confirmed.length}人`;
   const groups=new Map();for(const e of rows){const key=sponsor(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
   $('viewRows').innerHTML=[...groups].map(([name,people])=>`<section class="sponsor-group"><h3><span><small>スポンサー</small>${esc(name||'未設定')}</span><span class="sponsor-count">${people.length}人${filtered?'（表示中）':''}</span></h3><table class="participant-table"><thead><tr><th scope="col">名前・区分</th><th scope="col">参加時間</th></tr></thead><tbody>${people.map(e=>{
    const slots=['A','B','C','D'].filter(s=>Array.isArray(e.slots)&&e.slots.includes(s));
    return `<tr><td><strong class="attendee-name">${esc(e.name)}</strong><span class="kind-badge ${e.kind==='prospect'?'prospect':'member'}">${e.kind==='prospect'?'プロスペ':'メンバー'}</span>${adminActive()?`<small class="time-label">${e.adminDeleted?'削除済み':e.status==='yes'?'参加':e.status==='no'?'不参加':'未確定'}</small><div class="admin-entry-actions">${e.adminDeleted?'':`<button data-admin-action="edit" data-entry="${esc(e.id)}">編集</button>`}<button data-admin-action="${e.adminDeleted?'restore':'delete'}" data-entry="${esc(e.id)}">${e.adminDeleted?'復元':'削除'}</button></div>`:''}${e.duplicate?'<small class="time-label warn">重複候補</small>':''}</td><td>${slots.length?slots.map(s=>`<span class="slot-badge slot-${s}" title="${labels[s]}"><b>${s}</b>${labels[s].split(' ').at(-1)}</span>`).join(''):'<span class="time-label warn">時間未定</span>'}</td></tr>`;
   }).join('')}</tbody></table></section>`).join('')||'<p class="empty">'+(filtered?'条件に合う参加者はいません。':'参加確定者はまだいません。')+'</p>';
   const current=data.entries.filter(e=>e.eventId===event?.id),sum=BarModel.summary(current);
   $('cloudSummary').innerHTML='<div class="community-stats">'+[['参加確定',sum.confirmed],['メンバー',sum.confirmed-sum.prospects],['プロスペ',sum.prospects]].map(([label,count])=>`<div><span>${label}</span><strong>${count}<small>人</small></strong></div>`).join('')+`</div><p class="muted">全体：1部 ${sum.part1}人・2部 ${sum.part2}人 ／ 未確定 ${sum.pending}人 ／ 来場 ${sum.arrived}人</p>`+(current.some(e=>e.duplicate)?'<p class="warn">重複候補があります。担当者間で確認してください。</p>':'');
   const byGroup=new Map();for(const e of current){const g=e.group||'未設定';if(!byGroup.has(g))byGroup.set(g,[]);byGroup.get(g).push(e);}
   $('groupSummary').innerHTML=[...byGroup].sort(([a],[b])=>collator.compare(a,b)).map(([g,people])=>{const s=BarModel.summary(people);return `<p class="muted">${esc(g)}：確定 ${s.confirmed}人（プロスペ ${s.prospects}人）／未確定 ${s.pending}人</p>`;}).join('');
   $('uploadList').innerHTML=uploads.filter(u=>u.date===event?.date).map(u=>`<li>${esc(u.owner||'名称未設定')}：${esc(u.uploadedAt?new Date(u.uploadedAt).toLocaleString('ja-JP'):'日時不明')}（登録${u.count}人）</li>`).join('');
   $('viewStatus').textContent=loadError?`取得に失敗しました：${loadError}。${lastLoaded?'表示は前回取得時点のデータです。':'共有データは未取得です。'}`:`${lastLoaded?'取得：'+lastLoaded+'。':''} `+(rows.length?(adminActive()?'管理者モードです。':'閲覧専用です。'):filtered?'該当する参加者はいません。':event?'参加確定者はまだいません。':'次回のアップロードはまだありません。');
  }catch(e){$('viewDate').textContent='読み込みできませんでした';$('viewStatus').textContent=e.message+'。保存データは変更していません。';}
 }
 async function refresh(){
  if(busy)return;busy=true;$('viewRefresh').disabled=true;
  try{const result=await BarCloud.load();data=result.db;uploads=result.uploads;deletedEntries=result.deletedEntries||[];loadError='';lastLoaded=new Date().toLocaleString('ja-JP');}
  catch(e){loadError=e.message;}
  finally{busy=false;$('viewRefresh').disabled=false;render();}
 }
 $('viewSearch').oninput=render;$('viewRefresh').onclick=refresh;
 $('viewKind').onchange=render;$('viewSlot').onchange=render;
 if(integrated){
  if(window.BarSharedSnapshot){const cached=window.BarSharedSnapshot;data=cached.db;uploads=cached.uploads;deletedEntries=cached.deletedEntries||[];lastLoaded=new Date().toLocaleString('ja-JP');}
  $('viewRefresh').onclick=()=>window.dispatchEvent(new Event('bar-refresh-request'));
  window.addEventListener('bar-active-date',e=>{if(activeDate!==e.detail){activeDate=e.detail;render();}});
  window.addEventListener('bar-shared-ready',e=>{data=e.detail.db;uploads=e.detail.uploads;deletedEntries=e.detail.deletedEntries||[];loadError='';lastLoaded=new Date().toLocaleString('ja-JP');render();});
  window.addEventListener('bar-shared-error',e=>{loadError=e.detail;render();});
  render();
 }else{
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.setInterval(()=>{if(!document.hidden){render();refresh();}},60000);render();refresh();
 }
})();
