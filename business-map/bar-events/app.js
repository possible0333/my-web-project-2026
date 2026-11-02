(function(){
 'use strict';
 const M=BarModel,$=id=>document.getElementById(id),KEY='business_map_bar_preview_v1',OWNER=KEY+'_owner',UNDO=KEY+'_undo';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 let db=M.empty(),raw=null,owner='',tab='list',selected='',mapPeople=[],blocked=false,submit=null;
 function message(s){$('message').textContent=s;}
 function loadMap(){
  const keys=['business_map_v1_03','business_map_v1_02','business_map_v1_01','business_map_v1','business_map_v8_clean_icons'];
  for(const key of keys){
   const text=localStorage.getItem(key);if(!text)continue;
   const map=JSON.parse(text);if(!map.self||!Array.isArray(map.members))continue;
   const all=[{...map.self,id:'self'},...map.members],byId=new Map(all.map(p=>[p.id,p]));
   mapPeople=all.filter(p=>String(p.name||'').trim()).map(p=>{
    let front=p,seen=new Set();while(front.parentId&&front.parentId!=='self'&&byId.has(front.parentId)&&!seen.has(front.id)){seen.add(front.id);front=byId.get(front.parentId);}
    return {name:p.name,kind:p.type==='プロスペ'?'prospect':'member',sponsor:p.id==='self'?p.name:byId.get(p.parentId)?.name||map.self.name||'',group:p.id==='self'||p.parentId==='self'&&p.type!=='ABO'?`${map.self.name}パーソナル`:`${front.name}Gr`,source:`map:${p.sharedSourceUserId||'local'}:${p.sharedSourcePersonId||p.id}`};
   });
   if(!owner)$('owner').value=map.self.name||'';break;
  }
 }
 function commit(label,fn){
  if(blocked)throw Error('保存データを読み込めません。既存データを保護するため編集を停止しています');
  if(!owner)throw Error('最初に自分（担当者）の名前を設定してください');
  if(localStorage.getItem(KEY)!==raw)throw Error('別タブで更新されています。再読み込みしてから操作してください');
  const next=M.clone(db);fn(next);
  next.history=[{at:new Date().toISOString(),actor:owner,label},...next.history].slice(0,20);
  const nextRaw=JSON.stringify(next);
  // Write the rollback copy before the primary data; do not mutate memory on failure.
  localStorage.setItem(UNDO,JSON.stringify({expected:nextRaw,before:db}));
  localStorage.setItem(KEY,nextRaw);db=next;raw=nextRaw;render();message(label+'しました');
 }
 function guard(fn){try{fn();}catch(e){message(e.message||String(e));}}
 function event(){return db.events.find(e=>e.id===selected);}
 function entries(){return db.entries.filter(e=>e.eventId===selected);}
 function match(p){const q=$('search').value.trim().toLowerCase();return (!q||[p.name,p.sponsor,p.group].some(x=>String(x).toLowerCase().includes(q)))&&($('scope').value==='all'||p.sponsor===owner);}
 function modal(title,html,fn){$('dialogTitle').textContent=title;$('fields').innerHTML=html;submit=fn;$('dialog').showModal();}
 function needEvent(){if(!event())throw Error('開催回を先に作成してください');}
 function render(){
  if(!db.events.some(e=>e.id===selected))selected=db.events.find(e=>e.date>=today())?.id||db.events.at(-1)?.id||'';
  $('event').innerHTML=db.events.map(e=>`<option value="${esc(e.id)}">${esc(e.date)}（土）</option>`).join('')||'<option>開催回がありません</option>';
  $('event').value=selected;
  const ev=event(),sum=M.summary(entries(),ev?.goal,ev?.prospectGoal);
  $('totals').innerHTML=[['参加確定',sum.confirmed,`目標 ${ev?.goal||0} ／ あと ${sum.remaining}`],['うちプロスペ',sum.prospects,`目標 ${ev?.prospectGoal||0} ／ あと ${sum.prospectRemaining}`],['未確定',sum.pending,`うちプロスペ ${sum.pendingProspects}`],['実際の来場',sum.arrived,'来場チェック済み']].map(([label,note,sub])=>`<div class="stat">${label}<b>${note}<small>人</small></b><small>${sub}</small></div>`).join('');
  $('times').textContent=`確定者の入場枠：A ${sum.slots.A}人 ／ B ${sum.slots.B}人 ／ C ${sum.slots.C}人｜1部 ${sum.part1}人・2部 ${sum.part2}人｜時間未定 ${sum.missingTime}人`;
  $('ownerState').textContent=owner?`担当者：${owner}（本人認証ではありません）`:'名前を確認して「この名前で使う」を押してください';
  $('actions').hidden=tab!=='list';
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  $('history').innerHTML=db.history.map(h=>`<li>${esc(new Date(h.at).toLocaleString('ja-JP'))} ${esc(h.actor)}：${esc(h.label)}</li>`).join('');
  if(tab==='past'){
   const people=M.past(db,ev?.date||today(),owner,$('scope').value==='all').filter(match);
   $('content').innerHTML='<p class="muted">選択中の開催日より前に、来場チェックが付いたプロスペのみ。現在の端末に保存された履歴です。</p>'+people.map(p=>`<article class="card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.sponsor)} ／ ${esc(p.group)}<br>最終参加 ${esc(p.last)} ／ ${p.count}回</p><button data-past="${esc(p.personId)}" ${entries().some(e=>e.personId===p.personId)?'disabled':''}>${entries().some(e=>e.personId===p.personId)?'今回登録済み':'今回に追加'}</button></article>`).join('');
   if(!people.length)$('content').innerHTML+='<p class="empty">該当する過去参加者はいません</p>';
  }else if(tab==='summary'){
   const data=entries().filter(match),groups=[...new Set(data.map(e=>e.group||'未設定'))];
   const sponsors=[...new Set(data.map(e=>e.sponsor||'未設定'))];
   const table=(keys,field)=>`<div class="table-scroll"><table class="summary-table"><thead><tr><th>${field==='group'?'グループ':'スポンサー'}</th><th>目標</th><th>確定</th><th>うちプロスペ</th><th>残数</th><th>未確定</th><th>来場</th></tr></thead><tbody>${keys.map(key=>{const goal=field==='group'?ev?.groups?.[key]?.goal||0:0;const s=M.summary(data.filter(e=>(e[field]||'未設定')===key),goal);return `<tr><td>${esc(key)}</td><td>${field==='group'?goal:'—'}</td><td>${s.confirmed}</td><td>${s.prospects}</td><td>${field==='group'?s.remaining:'—'}</td><td>${s.pending}</td><td>${s.arrived}</td></tr>`;}).join('')}</tbody></table></div>`;
   $('content').innerHTML='<p class="muted">全体目標は独立した目標値です。グループの合計とは自動連動しません。</p><button id="targets">目標を設定</button><h3>グループ別</h3>'+table(groups,'group')+'<h3>スポンサー別</h3>'+table(sponsors,'sponsor');
  }else{
   const list=entries().filter(match);
   $('content').innerHTML=list.map(e=>`<article class="card" data-entry="${esc(e.id)}"><h3>${esc(e.name)}<span class="badge">${e.kind==='prospect'?'プロスペ':'メンバー'}</span></h3><div class="muted">スポンサー：${esc(e.sponsor||'未設定')} ／ ${esc(e.group||'所属未設定')}</div><div class="status">${[['yes','○ 参加確定'],['pending','△ 未確定'],['no','× 不参加']].map(([key,label])=>`<button data-status="${key}" aria-pressed="${e.status===key}">${label}</button>`).join('')}</div><div class="checks">${[['A','A 17:30〜18:30'],['B','B 18:30〜20:30'],['C','C 21:00〜22:00']].map(([key,label])=>`<label><input type="checkbox" data-slot="${key}" ${e.slots.includes(key)?'checked':''}>${label}</label>`).join('')}</div><label>今回の備考<input data-note maxlength="300" value="${esc(e.note)}" placeholder="遅刻・紹介時の補足など"></label><div class="row"><label class="checks"><input type="checkbox" data-arrived ${e.arrived?'checked':''}>来場チェック</label><button data-remove>今回の登録を外す</button></div>${e.status==='yes'&&!e.slots.length?'<p class="muted warn">入場時間を選択してください</p>':''}</article>`).join('')||'<p class="empty">まだ参加者がいません。<br>マップ・手入力・過去参加者から追加できます。</p>';
  }
 }
 $('remember').onclick=()=>guard(()=>{const name=$('owner').value.trim();if(!name)throw Error('名前を入力してください');localStorage.setItem(OWNER,name);owner=name;render();});
 $('event').onchange=()=>{selected=$('event').value;render();};$('scope').onchange=render;$('search').oninput=render;
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
 $('close').onclick=()=>$('dialog').close();
 $('form').onsubmit=e=>{e.preventDefault();guard(()=>{submit();$('dialog').close();});};
 $('newEvent').onclick=()=>{
  modal('月2回の開催回を作る','<label>開催月<input id="month" type="month" value="'+today().slice(0,7)+'" required></label><label>初回（土曜・10日より前）<select id="first"></select></label><p class="muted" id="second"></p>',()=>{const first=$('first').value;commit('開催回を作成',d=>M.pair(d,first));selected=db.events.find(e=>e.date===first).id;render();});
  const update=()=>{$('first').innerHTML=M.candidates($('month').value).map(d=>`<option>${d}</option>`).join('');next();};
  const next=()=>{$('second').textContent=$('first').value?'2回目：'+M.plus($('first').value,14):'開催月を選択してください';};$('month').onchange=update;$('first').onchange=next;update();
 };
 $('fromMap').onclick=()=>guard(()=>{
  needEvent();loadMap();
  modal('自分のマップから追加','<p class="muted">同じブラウザに保存されたマップを読み取ります。マップの内容は変更しません。分類は追加前に確認できます。</p>'+mapPeople.map((p,i)=>`<div class="card"><label class="candidate"><input type="checkbox" name="mapPick" value="${i}">${esc(p.name)} ／ ${esc(p.sponsor)}</label><label>イベントの分類<select id="kind${i}"><option value="member" ${p.kind==='member'?'selected':''}>メンバー</option><option value="prospect" ${p.kind==='prospect'?'selected':''}>プロスペ</option></select></label></div>`).join(''),()=>{
   const picked=[...document.querySelectorAll('[name=mapPick]:checked')].map(el=>Number(el.value));if(!picked.length)throw Error('追加する人を選んでください');
   const kinds=new Map(picked.map(i=>[i,$('kind'+i).value]));
   commit('マップから参加者を追加',d=>{for(const i of picked){const p=M.person(d,{...mapPeople[i],kind:kinds.get(i)});if(!d.entries.some(e=>e.eventId===selected&&e.personId===p.id)){M.add(d,selected,p.id);d.entries.at(-1).kind=kinds.get(i);}}});
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
  if(b.dataset.past){needEvent();commit('過去参加者を追加',d=>M.add(d,selected,b.dataset.past));return;}
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
  if(el.hasAttribute('data-arrived'))values.arrived=el.checked;
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
 try{
  raw=localStorage.getItem(KEY);if(raw){const stored=JSON.parse(raw);if(stored.schema!==1||!['people','events','entries','history'].every(k=>Array.isArray(stored[k])))throw Error('形式不明のイベントデータがあります');db=stored;}
  owner=localStorage.getItem(OWNER)||'';$('owner').value=owner;loadMap();
  $('ownerNames').innerHTML=[...new Set(mapPeople.map(p=>p.name))].map(n=>`<option value="${esc(n)}"></option>`).join('');render();
 }catch(e){blocked=true;message('データを保護するため編集を停止しました：'+e.message);}
})();
