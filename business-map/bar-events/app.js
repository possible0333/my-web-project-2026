(function(){
 'use strict';
 const M=BarModel,$=id=>document.getElementById(id),KEY='business_map_bar_preview_v1',OWNER=KEY+'_owner',UNDO=KEY+'_undo';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 let db=M.empty(),raw=null,owner='',tab='list',selected='',mapPeople=[],blocked=false,submit=null;
 let sharedDb=M.empty(),uploadBusy=false,sharedBusy=false;
 const RECEIPTS=KEY+'_receipts';
 function uploadStatus(){
  if(!event()){$('uploadState').textContent='開催日を登録してください';return;}
  try{const receipt=JSON.parse(localStorage.getItem(RECEIPTS)||'{}')[event().date];
   const current=JSON.stringify(BarCloud.snapshot(db,selected,owner));
   $('uploadState').textContent=receipt?.fingerprint===current?`アップロード済み：${new Date(receipt.uploadedAt).toLocaleString('ja-JP')}`:'未アップロードの変更があります';
  }catch(e){$('uploadState').textContent='担当者名を設定してアップロードしてください';}
 }
 let messageTimer;
 function message(s){$('message').textContent=s;clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('message').textContent='',5000);}
 function loadMap(){
  mapPeople=[];
  const keys=['business_map_v1_03','business_map_v1_02','business_map_v1_01','business_map_v1','business_map_v8_clean_icons'];
  for(const key of keys){
   const text=localStorage.getItem(key);if(!text)continue;
   const map=JSON.parse(text);if(!map.self||!Array.isArray(map.members))continue;
   const all=[{...map.self,id:'self'},...map.members],byId=new Map(all.map(p=>[p.id,p]));
   mapPeople=all.filter(p=>String(p.name||'').trim()).map(p=>{
    let front=p,seen=new Set();while(front.parentId&&front.parentId!=='self'&&byId.has(front.parentId)&&!seen.has(front.id)){seen.add(front.id);front=byId.get(front.parentId);}
    return {isFront:p.id!=='self'&&p.parentId==='self',mapType:p.type||'',name:p.name,kind:p.type==='プロスペ'?'prospect':'member',sponsor:p.id==='self'?p.name:byId.get(p.parentId)?.name||map.self.name||'',group:p.id==='self'||p.parentId==='self'&&p.type!=='ABO'?`${map.self.name}パーソナル`:`${front.name}Gr`,source:`map:${p.sharedSourceUserId||'local'}:${p.sharedSourcePersonId||p.id}`};
   });
   if(!owner)$('owner').value=map.self.name||'';break;
  }
 }
 function ensureOwner(){
  const name=$('owner').value.trim();
  if(!name){$('identityPanel').open=true;$('owner').focus();throw Error('自分の名前を入力してください');}
  localStorage.setItem(OWNER,name);owner=name;
 }
 function commit(label,fn,system=false){
  if(blocked)throw Error('保存データを読み込めません。既存データを保護するため編集を停止しています');
  if(!system)ensureOwner();
  if(selected&&event()?.date<today()){render();throw Error('開催日が過ぎたため次回表示に切り替えました。内容を確認して再操作してください');}
  if(localStorage.getItem(KEY)!==raw)throw Error('別タブで更新されています。再読み込みしてから操作してください');
  const next=M.clone(db);fn(next);
  next.history=[{at:new Date().toISOString(),actor:system?'共有受信':owner,label},...next.history].slice(0,20);
  const nextRaw=JSON.stringify(next);
  // Write the rollback copy before the primary data; do not mutate memory on failure.
  localStorage.setItem(UNDO,JSON.stringify({expected:nextRaw,before:db}));
  localStorage.setItem(KEY,nextRaw);db=next;raw=nextRaw;render();message(label+'しました');
 }
 function guard(fn){try{fn();}catch(e){if(!blocked)render();const msg=e.message||String(e);message(msg);if($('dialog').open){let error=$('dialogError');if(!error){error=document.createElement('p');error.id='dialogError';error.setAttribute('role','alert');$('fields').prepend(error);}error.textContent=msg;}}}
 function event(){return db.events.find(e=>e.id===selected);}
 function entries(){return db.entries.filter(e=>e.eventId===selected);}
 function match(p){const q=$('search').value.trim().toLowerCase();return (!q||[p.name,p.sponsor,p.group].some(x=>String(x).toLowerCase().includes(q)))&&($('scope').value==='all'||p.sponsor===owner);}
 function modal(title,html,fn){$('dialogTitle').textContent=title;$('fields').innerHTML=html;submit=fn;$('dialog').showModal();}
 function needEvent(){if(!event())throw Error('開催回を先に作成してください');}
 function selfMap(){return mapPeople.find(p=>p.name===owner&&p.source==='map:local:self')||null;}
 function selfEntry(){const p=M.selfPerson(db,owner,selfMap());return p?entries().find(e=>e.personId===p.id):null;}
 function renderSelf(){
  const e=selfEntry();
  $('selfDate').textContent=`${Number(event().date.slice(5,7))}月${Number(event().date.slice(8,10))}日（土）`;
  $('selfControls').innerHTML=`<div class="status self-status">${[['yes','参加'],['no','不参加']].map(([key,label])=>`<button data-self-status="${key}" aria-pressed="${e?.status===key}">${label}</button>`).join('')}</div><fieldset class="self-times" ${e?.status==='no'?'disabled':''}><legend>参加時間（1つ選択）</legend><div class="checks time-chips">${[['A','17:30〜18:30'],['B','18:30〜20:30'],['C','21:00〜22:00'],['D','22:00〜23:00']].map(([key,time])=>`<label><input type="radio" name="selfSlot" data-self-slot="${key}" ${e?.slots.includes(key)?'checked':''}><span><b>${key}</b><small>${time}</small></span></label>`).join('')}</div></fieldset>`;
  $('selfSaveState').textContent=!owner?'初回だけ、自分の名前を設定してください。':!e?'参加／不参加、または参加時間を選んでください。':`${e.cancelled?'当キャン':e.status==='yes'?'参加'+(e.slots.length?'：'+e.slots.join('・'):'（時間を選択してください）'):e.status==='no'?'不参加':'未確定'}を端末に保存済み。${$('uploadState').textContent}。アップロードは他の入力分も含みます。`;
 }
 function render(){
  const next=M.nextEvent(db.events,today());
  if(!db.events.some(e=>e.id===next.id))db.events.push(next);
  selected=next.id;
  uploadStatus();
  renderSelf();
  $('scope').options[0].textContent=tab==='past'?'全体プロスペ（共有分）':'この端末の登録分';
  $('eventDate').textContent=next?`${Number(next.date.slice(5,7))}月${Number(next.date.slice(8,10))}日（土）`:'次回の開催日を登録してください';
  $('eventDate').dataset.date=next?.date||'';
  window.dispatchEvent(new CustomEvent('bar-active-date',{detail:next.date}));
  const ev=event(),sum=M.summary(entries(),ev?.goal,ev?.prospectGoal);
  $('totals').innerHTML=[['参加確定',sum.confirmed,`目標 ${ev?.goal||0} ／ あと ${sum.remaining}`],['うちプロスペ',sum.prospects,`目標 ${ev?.prospectGoal||0} ／ あと ${sum.prospectRemaining}`],['未確定',sum.pending,`うちプロスペ ${sum.pendingProspects}`],['当キャン',sum.cancelled,'参加人数には含みません']].map(([label,note,sub])=>`<div class="stat">${label}<b>${note}<small>人</small></b><small>${sub}</small></div>`).join('');
  $('times').textContent=`確定者の入場枠：A ${sum.slots.A}人 ／ B ${sum.slots.B}人 ／ C ${sum.slots.C}人 ／ D ${sum.slots.D}人｜1部 ${sum.part1}人・2部 ${sum.part2}人｜時間未定 ${sum.missingTime}人`;
  $('ownerState').textContent=owner?`入力担当：${owner} ▾ 変更`:'入力担当者を設定（閲覧だけなら不要）';
  $('quickHint').textContent=owner?`スポンサーは「${owner}」。名前だけで続けて追加できます。`:'一覧の閲覧は担当者設定なしでできます。入力前に担当者を設定してください。';
  $('actions').hidden=tab!=='list';
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  $('history').innerHTML=db.history.map(h=>`<li>${esc(new Date(h.at).toLocaleString('ja-JP'))} ${esc(h.actor)}：${esc(h.label)}</li>`).join('');
  if(tab==='past'){
   const all=$('scope').value==='all',people=M.past(all?sharedDb:db,ev?.date||today(),owner,all).filter(match);
   const registered=p=>entries().some(e=>e.personId===p.personId||db.people.find(x=>x.id===e.personId)?.source==='bar:'+p.personId);
   $('content').innerHTML='<p class="muted">過去の参加登録（当キャンを除く）があるプロスペ。全体はアップロード済みの履歴、自分はこの端末の履歴です。</p>'+people.map(p=>`<article class="card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.sponsor)} ／ ${esc(p.group)}<br>最終参加 ${esc(p.last)} ／ ${p.count}回</p><button data-past="${esc(p.personId)}" data-shared="${all}" ${registered(p)?'disabled':''}>${registered(p)?'今回登録済み':'今回に追加'}</button></article>`).join('');
   if(!people.length)$('content').innerHTML+='<p class="empty">該当する過去参加者はいません</p>';
  }else if(tab==='summary'){
   const data=entries().filter(match),groups=[...new Set(data.map(e=>e.group||'未設定'))];
   const sponsors=[...new Set(data.map(e=>e.sponsor||'未設定'))];
   const table=(keys,field)=>`<div class="table-scroll"><table class="summary-table"><thead><tr><th>${field==='group'?'グループ':'スポンサー'}</th><th>目標</th><th>確定</th><th>うちプロスペ</th><th>残数</th><th>未確定</th><th>当キャン</th></tr></thead><tbody>${keys.map(key=>{const goal=field==='group'?ev?.groups?.[key]?.goal||0:0;const s=M.summary(data.filter(e=>(e[field]||'未設定')===key),goal);return `<tr><td>${esc(key)}</td><td>${field==='group'?goal:'—'}</td><td>${s.confirmed}</td><td>${s.prospects}</td><td>${field==='group'?s.remaining:'—'}</td><td>${s.pending}</td><td>${s.cancelled}</td></tr>`;}).join('')}</tbody></table></div>`;
   $('content').innerHTML='<p class="muted">全体目標は独立した目標値です。グループの合計とは自動連動しません。</p><button id="targets">目標を設定</button><h3>グループ別</h3>'+table(groups,'group')+'<h3>スポンサー別</h3>'+table(sponsors,'sponsor');
  }else{
   const list=entries().filter(match);
   $('content').innerHTML=list.map(e=>`<article class="card compact-card" data-entry="${esc(e.id)}"><div class="person-row"><div class="person-name"><h3><span class="${e.cancelled?'cancelled-name':''}">${esc(e.name)}</span>${e.cancelled?'<span class="cancelled-badge">当キャン</span>':''}<span class="badge">${e.kind==='prospect'?'プ':'メ'}</span></h3><div class="muted">${esc(e.sponsor||'担当未設定')} · ${esc(e.group||'所属未設定')}</div></div><div class="status">${[['yes','○','参加確定'],['pending','△','未確定'],['no','×','不参加']].map(([key,label,title])=>`<button data-status="${key}" aria-label="${esc(e.name)} ${title}" title="${title}" aria-pressed="${e.status===key}">${label}</button>`).join('')}</div></div><div class="checks time-chips">${[['A','A 17:30'],['B','B 18:30'],['C','C 21:00'],['D','D 22:00']].map(([key,label])=>`<label><input type="radio" name="slot-${esc(e.id)}" data-slot="${key}" ${e.slots.includes(key)?'checked':''}><span>${label}</span></label>`).join('')}<label class="arrival-chip"><input type="checkbox" data-cancelled ${e.cancelled?'checked':''}><span>当キャン</span></label></div><details class="entry-more"><summary>備考${e.note?'あり':''}・詳細${e.status==='yes'&&!e.slots.length?' ／ 時間未定':''}</summary><p class="muted">A：1部17:30〜18:30 ／ B：1部18:30〜20:30 ／ C：2部21:00〜22:00 ／ D：2部22:00〜23:00（1つ選択）</p><label>今回の備考<input data-note maxlength="300" value="${esc(e.note)}" placeholder="遅刻など"></label><button data-remove>今回の登録を外す</button></details></article>`).join('')||'<p class="empty">まだ参加者がいません。<br>名前を入力するか、マップからまとめて選択してください。</p>';
  }
 }
 $('selfControls').onclick=e=>guard(()=>{const b=e.target.closest('[data-self-status]');if(b)commit('自分の出欠を保存',d=>M.setSelf(d,selected,owner,selfMap(),{status:b.dataset.selfStatus}));});
 $('selfControls').onchange=e=>guard(()=>{if(!e.target.hasAttribute('data-self-slot'))return;const slots=[...$('selfControls').querySelectorAll('[data-self-slot]:checked')].map(x=>x.dataset.selfSlot);commit('自分の参加時間を保存',d=>M.setSelf(d,selected,owner,selfMap(),{status:'yes',slots}));});
 $('selfUpload').onclick=()=>$('uploadBar').click();
 $('remember').onclick=()=>guard(()=>{const name=$('owner').value.trim();if(!name)throw Error('名前を入力してください');localStorage.setItem(OWNER,name);owner=name;$('identityPanel').open=false;render();});
 $('quickAdd').onsubmit=e=>{e.preventDefault();guard(()=>{
  needEvent();ensureOwner();const name=$('quickName').value.trim(),kind=$('quickKind').value;
  if(!name)throw Error('名前を入力してください');
  const same=db.people.find(p=>p.name===name&&p.sponsor===owner);
  if(same&&entries().some(e=>e.personId===same.id))throw Error('同じ名前・スポンサーが今回登録済みです。別人の場合は「スポンサーを指定して追加」から登録してください');
  if(same&&!confirm('以前の同じ名前・スポンサーの人として追加しますか？ 別人なら詳細入力を使ってください。'))return;
  const group=mapPeople.find(p=>p.name===owner)?.group||'';
  commit('参加者を追加',d=>{const p=same?d.people.find(p=>p.id===same.id):M.person(d,{name,kind,sponsor:owner,group});M.add(d,selected,p.id);d.entries.at(-1).kind=kind;});
  $('quickName').value='';$('quickName').focus();
 });};
 $('scope').onchange=render;$('search').oninput=render;
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
 $('close').onclick=()=>$('dialog').close();
 $('form').onsubmit=e=>{e.preventDefault();guard(()=>{submit();$('dialog').close();});};
 $('newEvent').onclick=()=>{
  modal('開催日の設定','<label>開催月<input id="month" type="month" value="'+today().slice(0,7)+'" required></label><label>初回（土曜・10日より前）<select id="first"></select></label><p class="muted" id="second"></p><p class="muted">登録した日程のうち、今日以降で最も近い開催回だけを表示します。過去の参加記録は残ります。</p>',()=>{const first=$('first').value;commit('開催回を作成',d=>M.pair(d,first));});
  const update=()=>{$('first').innerHTML=M.candidates($('month').value).map(d=>`<option>${d}</option>`).join('');next();};
  const next=()=>{$('second').textContent=$('first').value?'2回目：'+M.plus($('first').value,14):'開催月を選択してください';};$('month').onchange=update;$('first').onchange=next;update();
 };
 $('fromMap').onclick=()=>guard(()=>{
  needEvent();loadMap();ensureOwner();
  const candidates=mapPeople.filter(p=>p.isFront);
  modal('マップからまとめて参加','<div class="batch-times"><strong>参加時間（1つ選択）</strong><p class="muted">選んだ人を参加確定にします。時間を選ばない場合は登録済みの時間を保ちます。</p><div class="checks time-chips">'+[['A','17:30〜18:30'],['B','18:30〜20:30'],['C','21:00〜22:00'],['D','22:00〜23:00']].map(([key,time])=>`<label><input type="radio" name="batchSlot" value="${key}"><span><b>${key}</b><small>${time}</small></span></label>`).join('')+'</div></div><p class="muted">自分に直接つながる人だけを表示します。分類はマップから自動設定します。</p>'+(candidates.length?candidates.map((p,i)=>`<div class="card"><label class="candidate"><input type="checkbox" name="mapPick" value="${i}">${esc(p.name)}<span class="badge">${esc(p.mapType||'メンバー')}</span></label><p class="muted">${esc(p.sponsor)} ／ イベント：${p.kind==='prospect'?'プロスペ':'メンバー'}</p></div>`).join(''):'<p class="empty">追加できるフロントラインがありません。同じブラウザの自分のマップを確認してください。</p>'),()=>{
   const picked=[...document.querySelectorAll('[name=mapPick]:checked')].map(el=>Number(el.value));if(!picked.length)throw Error('追加する人を選んでください');
   const slots=[...$('fields').querySelectorAll('[name=batchSlot]:checked')].map(el=>el.value);
   commit('マップから参加を登録',d=>{for(const i of picked){const candidate=candidates[i],p=M.person(d,candidate);p.kind=candidate.kind;let entry=d.entries.find(e=>e.eventId===selected&&e.personId===p.id);if(!entry){M.add(d,selected,p.id);entry=d.entries.at(-1);}entry.kind=candidate.kind;M.change(d,entry.id,{status:'yes',...(slots.length?{slots}:{})});}});
  });
 });
 $('manual').onclick=()=>guard(()=>{
  needEvent();modal('名前を直接入力','<label>参加者名<input id="pName" required maxlength="80"></label><label>分類<select id="pKind"><option value="prospect">プロスペ</option><option value="member">メンバー</option></select></label><label>スポンサー<input id="pSponsor" required maxlength="80" value="'+esc(owner)+'"></label><label>グループ<input id="pGroup" maxlength="80" placeholder="例：楓Gr"></label><p class="muted">マップには追加されません。</p>',()=>{
   const data={name:$('pName').value,kind:$('pKind').value,sponsor:$('pSponsor').value,group:$('pGroup').value};
   const same=db.people.find(p=>p.name===data.name.trim()&&p.sponsor===data.sponsor.trim());
   let existing=false;if(same){existing=confirm('同じ名前・スポンサーの登録があります。同じ人として追加しますか？\nキャンセルの場合は別人として登録するか次に確認します。');if(!existing&&!confirm('別人として新しく登録しますか？'))return;}
   commit('参加者を追加',d=>{const p=existing?d.people.find(p=>p.id===same.id):M.person(d,data);M.add(d,selected,p.id);});
  });
 });
 $('content').onclick=e=>guard(()=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.past){needEvent();commit('過去参加者を追加',d=>{const remote=b.dataset.shared==='true'?sharedDb.people.find(p=>p.id===b.dataset.past):null;const id=remote?M.person(d,{...remote,source:'bar:'+remote.id}).id:b.dataset.past;M.add(d,selected,id);});return;}
  if(b.id==='targets'){
   needEvent();const ev=event(),groups=[...new Set(entries().map(e=>e.group||'未設定'))];
   modal('動員目標','<label>全体目標<input id="goal" type="number" min="0" step="1" value="'+ev.goal+'" required></label><label>うちプロスペ目標<input id="pGoal" type="number" min="0" step="1" value="'+ev.prospectGoal+'" required></label>'+groups.map((g,i)=>`<label>${esc(g)} の目標<input id="g${i}" type="number" min="0" step="1" value="${ev.groups[g]?.goal||0}" required></label>`).join(''),()=>{
    const goal=Number($('goal').value),prospectGoal=Number($('pGoal').value),values=groups.map((g,i)=>[g,{goal:Number($('g'+i).value)}]);
    if(prospectGoal>goal)throw Error('プロスペ目標は全体目標以下にしてください');
    commit('動員目標を変更',d=>{const target=d.events.find(e=>e.id===selected);target.goal=goal;target.prospectGoal=prospectGoal;target.groups=Object.fromEntries(values);});
   });return;
  }
  const card=b.closest('[data-entry]');if(!card)return;const id=card.dataset.entry;
  if(b.dataset.status)commit('出欠を変更',d=>M.change(d,id,{status:b.dataset.status}));
  if(b.hasAttribute('data-remove')&&confirm('今回の登録だけを外します。過去の記録は残ります。よろしいですか？'))commit('今回の登録を解除',d=>{d.entries=d.entries.filter(e=>e.id!==id);});
 });
 $('content').onchange=e=>guard(()=>{
  const el=e.target,card=el.closest('[data-entry]');if(!card)return;
  const values={};if(el.hasAttribute('data-note'))values.note=el.value;
  if(el.hasAttribute('data-cancelled'))values.cancelled=el.checked;
  if(el.hasAttribute('data-slot'))values.slots=[...card.querySelectorAll('[data-slot]:checked')].map(x=>x.dataset.slot);
  if(Object.keys(values).length)commit('参加情報を変更',d=>M.change(d,card.dataset.entry,values));
 });
 $('undo').onclick=()=>guard(()=>{
  const prev=JSON.parse(localStorage.getItem(UNDO)||'null');
  if(!prev||prev.expected!==raw||localStorage.getItem(KEY)!==raw)throw Error('取り消せる直前の変更がありません');
  if(!confirm('直前の変更を取り消しますか？'))return;
  const next=JSON.stringify(prev.before);localStorage.setItem(KEY,next);db=prev.before;raw=next;localStorage.removeItem(UNDO);render();message('直前の変更を取り消しました');
 });
 $('backup').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='bar-events-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 async function refreshShared(){
  if(sharedBusy)return;sharedBusy=true;$('refreshShared').disabled=true;$('viewRefresh').disabled=true;
  try{
   const result=await BarCloud.load();sharedDb=result.db;
   const missing=sharedDb.events.filter(e=>e.date>=today()&&!db.events.some(x=>x.date===e.date));
   render();if(missing.length)commit('共有された開催日を追加',d=>{d.events.push(...missing.map(e=>({...e,id:M.id()})));d.events.sort((a,b)=>a.date.localeCompare(b.date));},true);
   $('sharedState').textContent=`共有データ取得済み：${result.uploads.length}件の開催回別アップロード`;render();
   window.BarSharedSnapshot=result;
   window.dispatchEvent(new CustomEvent('bar-shared-ready',{detail:result}));
  }catch(e){$('sharedState').textContent='共有データを取得できませんでした：'+e.message;window.dispatchEvent(new CustomEvent('bar-shared-error',{detail:e.message}));}
  finally{sharedBusy=false;$('refreshShared').disabled=false;$('viewRefresh').disabled=false;}
 }
 $('refreshShared').onclick=refreshShared;
 window.addEventListener('bar-refresh-request',refreshShared);
 $('uploadBar').onclick=()=>guard(()=>{sessionStorage.setItem('barUploadRequested','1');const version=new URL(document.querySelector('script[src*="app.js"]').src).searchParams.get('v');location.href='../index.html?uploadFrom=bar&v='+encodeURIComponent(version);});

 try{
  raw=localStorage.getItem(KEY);if(raw){const stored=JSON.parse(raw);if(stored.schema!==1||!['people','events','entries','history'].every(k=>Array.isArray(stored[k])))throw Error('形式不明のイベントデータがあります');db=stored;for(const entry of db.entries)entry.slots=M.singleSlot(entry.slots);}
  owner=localStorage.getItem(OWNER)||'';$('owner').value=owner;loadMap();if(!owner&&$('owner').value.trim())ensureOwner();
  $('ownerNames').innerHTML=[...new Set(mapPeople.map(p=>p.name))].map(n=>`<option value="${esc(n)}"></option>`).join('');render();
 }catch(e){blocked=true;message('データを保護するため編集を停止しました：'+e.message);}
 if(!blocked){
  refreshShared();let displayedDay=today();
  const updateDay=()=>{if(!document.hidden&&displayedDay!==today()&&!$('dialog').open){displayedDay=today();render();}};
  document.addEventListener('visibilitychange',()=>{updateDay();if(!document.hidden)refreshShared();});
  window.setInterval(()=>{updateDay();if(!document.hidden)refreshShared();},60000);
 }
})();
