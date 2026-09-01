function renderTree(){
  const vis = visibleSet();
  const allVisible = allPeople().filter(p=>vis.has(p.id));
  const maxDepth = Math.max(0, ...allVisible.filter(x=>x.id!=='self').map(x=>depthOf(x.id)));
  let html='';
  for(let d=0; d<=maxDepth; d++){
    const arr = d===0 ? (vis.has('self')?[state.self]:[]) : state.members.filter(x=>depthOf(x.id)===d && vis.has(x.id));
    html += `<div class="level" data-depth="${d}"><div class="level-label">${levelName(d)}</div>${arr.map(renderCard).join('')}</div>`;
  }
  if(!html) html = `<div class="empty-state">表示条件に一致するメンバーがいません</div>`;
  $('treeRows').innerHTML = html;
  document.querySelectorAll('.member-card').forEach(el=>el.onclick=()=>openModal(el.dataset.id));
  requestAnimationFrame(drawLines);
}
function drawLines(){
  const svg = $('treeLines');
  const wrap = $('mapCanvasArea');
  const vis = visibleSet();
  const cards = [...document.querySelectorAll('.member-card')];
  const byId = Object.fromEntries(cards.map(el=>[el.dataset.id, el]));
  const wrapRect = wrap.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${wrap.scrollWidth} ${wrap.scrollHeight}`);
  svg.setAttribute('width', wrap.scrollWidth);
  svg.setAttribute('height', wrap.scrollHeight);
  let paths='';
  state.members.forEach(p=>{
    if(!vis.has(p.id)) return;
    const childEl = byId[p.id];
    const parentEl = byId[p.parentId||'self'];
    if(!childEl || !parentEl) return;
    const cr = childEl.getBoundingClientRect();
    const pr = parentEl.getBoundingClientRect();
    const x1 = pr.left - wrapRect.left + pr.width/2 + wrap.scrollLeft;
    const y1 = pr.top - wrapRect.top + pr.height + wrap.scrollTop - 6;
    const x2 = cr.left - wrapRect.left + cr.width/2 + wrap.scrollLeft;
    const y2 = cr.top - wrapRect.top + wrap.scrollTop + 6;
    const midY = y1 + (y2-y1)/2;
    paths += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>`;
  });
  svg.innerHTML = paths;
}
function render(){
  save();
  renderLegend(); renderSelf(); renderStatusSummary(); renderTypeSummary(); renderTree();
}
function populateSelects(){
  $('fType').innerHTML = ['ABO','カスタマー','プロスペ','小売'].map(t=>`<option value="${t}">${t}</option>`).join('');
  $('fStatus').innerHTML = STATUS_OPTIONS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
}
function buildSponsorOptions(currentId){
  const invalid = new Set([currentId, ...descendants(currentId||'').map(x=>x.id)]);
  const currentParent=currentId?getPerson(currentId)?.parentId:null;
  const list = [{id:'self', name:state.self.name, type:'ABO'}, ...state.members].filter(p=>
    !invalid.has(p.id) && (p.id==='self' || p.type==='ABO' || p.type==='プロスペ' || p.id===currentParent)
  );
  $('fSponsor').innerHTML = list.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}
function renderAvatarPicker(){
  $('avatarPicker').innerHTML = ICONS.map((src,i)=>`<div class="avatar-option ${selectedAvatar===i?'selected':''}" data-idx="${i}"><img src="${src}" alt="avatar"></div>`).join('');
  document.querySelectorAll('.avatar-option').forEach(el=>el.onclick=()=>{selectedAvatar=+el.dataset.idx; renderAvatarPicker();});
}
function openModal(id){
  editingId = id || null;
  const p = id ? getPerson(id) : {id:null,name:'',type:'ABO',parentId:'self',target:0,actual:0,status:'appointment-open',customStatus:'',age:'',job:'',hobby:'',etc:'',memo1:'',memo2:'',memo3:'',avatar:0};
  $('modalTitle').textContent = id==='self' ? '自分を編集' : (id ? 'メンバー編集' : 'メンバー追加');
  $('deleteBtnTop').style.display = $('deleteBtnBottom').style.display = (id && id!=='self') ? '' : 'none';
  $('sponsorField').style.display = id==='self' ? 'none' : '';
  $('fName').value = p.name || '';
  $('fType').value = p.type || 'ABO';
  buildSponsorOptions(id);
  if(id!=='self') $('fSponsor').value = p.parentId || 'self';
  $('fTarget').value = p.target ?? 0;
  $('fActual').value = p.actual ?? 0;
  $('fStatus').value = p.status || 'appointment-open';
  $('fCustomStatus').value = p.customStatus || '';
  $('fAge').value = p.age || '';
  $('fJob').value = p.job || '';
  $('fHobby').value = p.hobby || '';
  $('fEtc').value = p.etc || '';
  $('fMemo1').value = p.memo1 || '';
  $('fMemo2').value = p.memo2 || '';
  $('fMemo3').value = p.memo3 || '';
  selectedAvatar = Number.isFinite(+p.avatar) ? +p.avatar : 0;
  renderAvatarPicker();
  updateCustomStatusVisibility();
  $('modal').classList.add('show');
}
function closeModal(){ $('modal').classList.remove('show'); }
function updateCustomStatusVisibility(){ $('customStatusWrap').classList.toggle('hidden', $('fStatus').value !== 'custom'); }
function gatherForm(){
  return {
    name: $('fName').value.trim() || '名称未設定',
    type: $('fType').value,
    parentId: editingId==='self' ? null : $('fSponsor').value,
    target: Math.max(0, Number($('fTarget').value||0)),
    actual: Math.max(0, Number($('fActual').value||0)),
    status: $('fStatus').value,
    customStatus: $('fCustomStatus').value.trim(),
    age: $('fAge').value.trim(),
    job: $('fJob').value.trim(),
    hobby: $('fHobby').value.trim(),
    etc: $('fEtc').value.trim(),
    memo1: $('fMemo1').value.trim(),
    memo2: $('fMemo2').value.trim(),
    memo3: $('fMemo3').value.trim(),
    avatar: selectedAvatar
  };
}
function saveForm(){
  const data = gatherForm();
  if(editingId==='self'){
    state.self = {...state.self, ...data, id:'self', type:'ABO', parentId:null};
  }else if(editingId){
    const idx = state.members.findIndex(x=>x.id===editingId);
    if(idx>=0){
      state.members[idx] = {...state.members[idx], ...data};
      if(descendants(editingId).some(x=>x.id===data.parentId)) state.members[idx].parentId='self';
    }
  }else{
    state.members.push({id:uid(), ...data});
  }
  closeModal();
  render();
}
function resetAllActualPv(){
  const people=[state.self,...(state.members||[])].filter(Boolean);
  const affected=people.filter(p=>Number(p.actual||0)!==0).length;
  if(!affected){
    alert('全員の実績PVはすでに0です。');
    return;
  }
  if(!confirm(`自分を含む全員（${people.length}人）の実績PVを0にします。\n\n目標PV・期限・やること・メモは変更されません。\nこの操作を実行しますか？`)) return;
  people.forEach(p=>{ p.actual=0; });
  render();
  alert(`${affected}人分の実績PVをリセットしました。`);
}
function deleteCurrent(){
  if(!editingId || editingId==='self') return;
  const current = getPerson(editingId);
  const fallback = current?.parentId || 'self';
  state.members.forEach(x=>{ if(x.parentId===editingId) x.parentId=fallback; });
  state.members = state.members.filter(x=>x.id!==editingId);
  closeModal(); render();
}
async function exportJSON(){
  const payload={...state,scheduleData:typeof window.v156BuildScheduleData==='function'?window.v156BuildScheduleData():undefined};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const filename=`business_map_${VERSION}.json`;
  const file=new File([blob],filename,{type:'application/json'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    try{ await navigator.share({files:[file],title:'Business Mapバックアップ'}); return; }
    catch(e){ if(e?.name==='AbortError') return; }
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url; link.download=filename; link.style.display='none';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function parseImportedJson(text){
  try{ return JSON.parse(text); }
  catch(firstError){
    // Repair the known broken tail produced by an interrupted/edited group export:
    // one extra object closer and/or a trailing comma immediately before maps[] closes.
    const repaired=String(text||'')
      .replace(/,\s*}\s*,\s*]\s*}\s*$/, '\n]}')
      .replace(/,\s*]\s*}\s*$/, '\n]}');
    if(repaired===text) throw firstError;
    return JSON.parse(repaired);
  }
}
function operationalMapToState(mapData){
  const people=Array.isArray(mapData?.people)?mapData.people:[];
  if(!people.length) throw new Error('個人マップデータがありません');
  const owner=people.find(p=>p?.id==='self')||people[0];
  const ownerSourceId=String(owner?.id||'self');
  const convert=(p,isSelf)=>({
    id:isSelf?'self':String(p?.id||uid()),
    name:String(p?.name|| (isSelf?'自分':'名称未設定')),
    type:isSelf?'ABO':String(p?.type||'ABO'),
    parentId:isSelf?null:(String(p?.parentId||'self')===ownerSourceId?'self':String(p?.parentId||'self')),
    target:Math.max(0,Number(p?.targetPv??p?.target??0)),
    actual:Math.max(0,Number(p?.actualPv??p?.actual??0)),
    status:String(p?.status||'appointment-open'),
    customStatus:String(p?.customStatus||''),
    deadline:String(p?.deadline?.raw??p?.deadline??''),
    nextAction:String(p?.nextAction||''),
    age:String(p?.age||''),
    job:String(p?.job||''),
    hobby:String(p?.hobby||''),
    etc:String(p?.etc||''),
    memo1:String(p?.memo1??p?.memos?.[0]??''),
    memo2:String(p?.memo2??p?.memos?.[1]??''),
    memo3:String(p?.memo3??p?.memos?.[2]??''),
    avatar:Number.isFinite(Number(p?.avatar))?Number(p.avatar):0
  });
  return {
    self:convert(owner,true),
    members:people.filter(p=>p!==owner).map(p=>convert(p,false))
  };
}
function chooseGroupMap(group){
  const candidates=(group?.maps||[]).filter(m=>Array.isArray(m?.mapData?.people)&&m.mapData.people.length);
  if(!candidates.length) throw new Error('復元できる個人マップがありません');
  if(candidates.length===1) return candidates[0];
  const guide=candidates.map((m,i)=>`${i+1}: ${m.name||m.mapData?.owner?.name||'名称未設定'}`).join('\n');
  const answer=window.prompt(`読み込む個人マップの番号を入力してください。\n\n${guide}`,'1');
  if(answer===null) return null;
  const index=Number(answer)-1;
  if(!Number.isInteger(index)||index<0||index>=candidates.length) throw new Error('選択番号が正しくありません');
  return candidates[index];
}
function normalizeImportedState(parsed){
  if(parsed?.self && Array.isArray(parsed.members)) return parsed;
  if(parsed?.schema==='business-map-operational') return operationalMapToState(parsed);
  if(parsed?.schema==='business-map-group-export'){
    const selected=chooseGroupMap(parsed);
    return selected?operationalMapToState(selected.mapData):null;
  }
  if(Array.isArray(parsed?.people)) return operationalMapToState(parsed);
  throw new Error('対応していないJSON形式です');
}
function importJSON(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed=parseImportedJson(reader.result);
      if(parsed?.scheduleData&&typeof window.v156SetScheduleData==='function') window.v156SetScheduleData(parsed.scheduleData);
      const normalized=normalizeImportedState(parsed);
      if(!normalized) return;
      state=migrate(normalized);
      render();
      alert('個人マップとして読み込みました');
    }catch(e){
      console.error(e);
      alert(`JSONファイルを読み込めませんでした。\n${e.message||e}`);
    }
  };
  reader.readAsText(file, 'utf-8');
}
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function buildExportSurface(){
  const root = $('exportRoot');
  const s = teamSummary();
  const mapClone = $('mapCanvasArea').cloneNode(true);
  mapClone.style.minWidth = '0';
  mapClone.style.width = '100%';
  mapClone.style.paddingTop = '8px';
  root.innerHTML = `
    <div class="export-surface">
      <div class="export-title">Business Map <span style="font-size:18px;color:#3478f6">${VERSION}</span></div>
      <div class="export-sub">保存日時：${new Date().toLocaleString('ja-JP')}</div>
      <div class="export-summary">
        <div class="export-box">
          <h3>チーム情報</h3>
          <div class="export-stats">
            <div class="export-mini"><div class="l">チーム目標PV</div><div class="v">${fmt(s.teamTarget)}</div></div>
            <div class="export-mini"><div class="l">チーム実績PV</div><div class="v">${fmt(s.teamActual)}</div></div>
            <div class="export-mini"><div class="l">達成率</div><div class="v">${s.rate}%</div></div>
            <div class="export-mini"><div class="l">登録人数</div><div class="v">${s.peopleCount}人</div></div>
            <div class="export-mini"><div class="l">ABO</div><div class="v">${s.typeCount['ABO']||0}人</div></div>
            <div class="export-mini"><div class="l">カスタマー / プロスペ / 小売</div><div class="v">${(s.typeCount['カスタマー']||0)} / ${(s.typeCount['プロスペ']||0)} / ${(s.typeCount['小売']||0)}</div></div>
          </div>
        </div>
        <div class="export-box">
          <h3>ステータス内訳</h3>
          <div class="export-status-grid">
            ${STATUS_OPTIONS.map(st=>`<div class="export-mini"><div class="l" style="color:${st.color}">${st.label}</div><div class="v">${s.statusCount[st.id]||0}人</div></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="export-map-area" id="exportMapWrap"></div>
    </div>`;
  $('exportMapWrap').appendChild(mapClone);
  return root;
}
async function saveImage(){
  try{
    const root = buildExportSurface();
    const canvas = await html2canvas(root, {backgroundColor:'#ffffff', scale:2, useCORS:true, logging:false, windowWidth:1600});
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `business-map-${VERSION}.png`;
    a.click();
  }catch(e){
    console.error(e);
    alert('画像保存に失敗しました');
  }
}

$('jsonExportBtn').onclick = exportJSON;
$('jsonImportBtn').onclick = ()=>$('fileInput').click();
$('fileInput').onchange = e=>{ const f=e.target.files[0]; if(f) importJSON(f); e.target.value=''; };
$('addBtn').onclick = ()=>openModal(null);
$('editSelfBtn').onclick = ()=>openModal('self');
document.addEventListener('click',e=>{
  const button=e.target.closest?.('#resetActualPvBtn');
  if(!button) return;
  e.preventDefault();
  resetAllActualPv();
});
$('saveImageBtn').onclick = saveImage;
$('statusFilter').onchange = renderTree;
$('typeFilter').onchange = renderTree;
$('fStatus').onchange = updateCustomStatusVisibility;
$('deleteBtnTop').onclick = $('deleteBtnBottom').onclick = deleteCurrent;
document.querySelectorAll('.save-action').forEach(el=>el.onclick = saveForm);
document.querySelectorAll('.close-action').forEach(el=>el.onclick = closeModal);
$('modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });

(async function init(){
  try{
    populateSelects(); renderFilters(); load(); await preloadIcons(); render();
  }catch(e){
    document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#b91c1c"><h2>読み込みエラー</h2><pre>${escapeHtml(e.message||String(e))}</pre></div>`;
  }
})();
