const VERSION = window.BUSINESS_MAP_CONFIG?.version || 'v1.43';
const STORAGE_KEYS = ['business_map_v1_03','business_map_v1_02','business_map_v1_01','business_map_v1','business_map_v8_clean_icons'];
const ICONS = Array.from({length:36}, (_,i)=>`icons/avatar-${String(i+1).padStart(2,'0')}.png?v=20260810e`);
const TYPE_COLORS = {ABO:'#3478f6','カスタマー':'#16a34a','プロスペ':'#f59e0b','小売':'#ec4899'};
const STATUS_OPTIONS = [
  {id:'ordered', label:'発注済み', color:'#16a34a'},
  {id:'forecast', label:'発注見込み', color:'#0ea5a8'},
  {id:'appointment-set', label:'アポ確定', color:'#7c3aed'},
  {id:'appointment-open', label:'アポ未定', color:'#64748b'},
  {id:'prospecting', label:'アポ取り中', color:'#2563eb'},
  {id:'befriend', label:'仲良くなる', color:'#f59e0b'},
  {id:'next-month', label:'来月以降', color:'#ef4444'},
  {id:'custom', label:'自由入力', color:'#334155'}
];
const DEFAULT_SELF = {id:'self',name:'自分',type:'ABO',parentId:null,target:30000,actual:0,status:'appointment-open',customStatus:'',memo1:'',memo2:'',memo3:'',age:'',job:'',hobby:'',etc:'',avatar:0};
let state = {self:{...DEFAULT_SELF}, members:[]};
let editingId = null;
let selectedAvatar = 0;

const $ = id => document.getElementById(id);
const fmt = n => Number(n||0).toLocaleString('ja-JP');
const uid = () => 'm' + Math.random().toString(36).slice(2,10);
const statusMap = Object.fromEntries(STATUS_OPTIONS.map(x=>[x.id,x]));

function currentStatusLabel(p){
  if(!p) return '';
  if(p.status==='custom') return p.customStatus?.trim() || '自由入力';
  return statusMap[p.status]?.label || '未設定';
}
function currentStatusColor(p){
  return statusMap[p.status]?.color || '#334155';
}
function isGroupEligible(p){ return p && p.status !== 'next-month'; }
function allPeople(){ return [state.self, ...state.members]; }
function getPerson(id){ return id==='self' ? state.self : state.members.find(x=>x.id===id); }
function childrenOf(id){ return state.members.filter(x=>x.parentId===id); }
function descendants(id){
  const out=[]; const visited=new Set([id]);
  const walk=(pid)=>{ childrenOf(pid).forEach(c=>{
    if(!c?.id || visited.has(c.id)) return;
    visited.add(c.id); out.push(c); walk(c.id);
  }); };
  walk(id); return out;
}
function depthOf(id){
  let p=getPerson(id), depth=0, guard=0;
  while(p && p.parentId && p.parentId!=='self' && guard<30){ depth++; p=getPerson(p.parentId); guard++; }
  if(getPerson(id)?.parentId==='self') depth=1;
  return id==='self'?0:depth;
}
function levelName(d){ return ['自分','フロント','セカンド','サード','フォース','フィフス','シックス'][d] || `${d}段目`; }
function goalState(p){
  const target=Number(p.target||0), actual=Number(p.actual||0);
  if(target<=0) return 'unset';
  if(actual>=target) return 'success';
  if(actual===0) return 'zero';
  return '';
}
function visiblePeople(){
  const statusFilter = $('statusFilter').value;
  const typeFilter = $('typeFilter').value;
  return allPeople().filter(p=>{
    if(typeFilter !== 'all' && p.type !== typeFilter) return false;
    if(statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });
}
function visibleSet(){ return new Set(visiblePeople().map(x=>x.id)); }
function groupPvFor(id){
  const nodes = [getPerson(id), ...descendants(id)].filter(Boolean).filter(isGroupEligible);
  return {
    target: nodes.reduce((s,x)=>s+Number(x.target||0),0),
    actual: nodes.reduce((s,x)=>s+Number(x.actual||0),0)
  };
}
function teamSummary(){
  const all = allPeople();
  const teamTarget = all.reduce((s,x)=>s+Number(x.target||0),0);
  const teamActual = all.reduce((s,x)=>s+Number(x.actual||0),0);
  const peopleCount = all.length;
  const typeCount = {ABO:0,'カスタマー':0,'プロスペ':0,'小売':0};
  const statusCount = Object.fromEntries(STATUS_OPTIONS.map(s=>[s.id,0]));
  all.forEach(p=>{ typeCount[p.type]=(typeCount[p.type]||0)+1; statusCount[p.status]=(statusCount[p.status]||0)+1; });
  return {teamTarget, teamActual, rate: teamTarget ? Math.round(teamActual/teamTarget*100) : 0, peopleCount, typeCount, statusCount};
}
function migrate(raw){
  const people = [raw.self, ...(raw.members||[])].filter(Boolean);
  const convertStatus = (rankOrStatus) => {
    if(statusMap[rankOrStatus]) return rankOrStatus;
    const map = {S:'ordered',A:'forecast',B:'appointment-set',C:'appointment-open',D:'next-month'};
    return map[rankOrStatus] || 'appointment-open';
  };
  const migrated = people.map((p,idx)=>({
    id: p.id || (idx===0?'self':uid()),
    name: p.name || (idx===0?'自分':'名称未設定'),
    type: p.type || 'ABO',
    parentId: idx===0 ? null : (p.parentId||'self'),
    target: Number(p.target||0),
    actual: Number(p.actual||0),
    status: convertStatus(p.status || p.rank),
    customStatus: p.customStatus || '',
    memo1: p.memo1 || p.memo || '',
    memo2: p.memo2 || '',
    memo3: p.memo3 || '',
    age: p.age || '',
    job: p.job || p.occupation || '',
    hobby: p.hobby || '',
    etc: p.etc || '',
    avatar: Number.isFinite(+p.avatar) ? +p.avatar : 0
  }));
  const self = {...DEFAULT_SELF, ...(migrated.find(x=>x.id==='self') || migrated[0] || DEFAULT_SELF), id:'self', type:'ABO', parentId:null};
  const members = migrated.filter(x=>x.id!=='self');
  const seenIds = new Set(['self']);
  members.forEach(p=>{
    if(!p.id || seenIds.has(p.id)) p.id=uid();
    seenIds.add(p.id);
  });
  const byId = new Map(members.map(p=>[p.id,p]));
  members.forEach(p=>{
    if(!p.parentId || p.parentId===p.id || (p.parentId!=='self'&&!byId.has(p.parentId))) p.parentId='self';
    const visited=new Set([p.id]);
    let cursor=p;
    while(cursor?.parentId && cursor.parentId!=='self'){
      if(visited.has(cursor.parentId)){ p.parentId='self'; break; }
      visited.add(cursor.parentId);
      cursor=byId.get(cursor.parentId);
      if(!cursor){ p.parentId='self'; break; }
    }
  });
  return {self, members};
}
function load(){
  for(const key of STORAGE_KEYS){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      const parsed = JSON.parse(raw);
      if(parsed && parsed.self && Array.isArray(parsed.members)) { state = migrate(parsed); break; }
    }catch(e){}
  }
}
function save(){ localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(state)); }

async function preloadIcons(){
  const results = await Promise.all(ICONS.map(src => new Promise(res=>{ const img=new Image(); img.onload=()=>res(true); img.onerror=()=>res(false); img.src=src; })));
  if(results.some(x=>!x)) throw new Error('アイコンの読み込みに失敗しました');
}
function renderLegend(){
  $('legend').innerHTML = [
    ['ABO',TYPE_COLORS.ABO], ['カスタマー',TYPE_COLORS['カスタマー']], ['プロスペ',TYPE_COLORS['プロスペ']], ['小売',TYPE_COLORS['小売']], ['発注済み','#16a34a'], ['来月以降','#ef4444']
  ].map(([t,c])=>`<span><i style="background:${c}"></i>${t}</span>`).join('');
}
function renderSelf(){
  const s = teamSummary();
  const self = state.self;
  const rate = self.target ? Math.min(100, Math.round((self.actual||0)/self.target*100)) : 0;
  $('selfCard').innerHTML = `
    <div class="self-grid">
      <img class="self-avatar" src="${ICONS[self.avatar||0]}" alt="avatar">
      <div>
        <div class="self-name">${escapeHtml(self.name||'自分')}</div>
        <div class="self-kpis">
          <div class="self-kpi"><div class="kpi-label">目標個人PV</div><div class="kpi-value">${fmt(self.target)}</div></div>
          <div class="self-kpi"><div class="kpi-label">実績PV</div><div class="kpi-value">${fmt(self.actual)}</div></div>
          <div class="self-kpi"><div class="kpi-label">達成率</div><div class="kpi-value">${rate}%</div></div>
        </div>
        <div class="progress"><span style="width:${rate}%"></span></div>
        <div class="team-kpis">
          <div class="team-kpi"><div class="kpi-label">チーム目標PV</div><div class="kpi-value">${fmt(s.teamTarget)}</div></div>
          <div class="team-kpi"><div class="kpi-label">チーム実績PV</div><div class="kpi-value">${fmt(s.teamActual)}</div></div>
          <div class="team-kpi"><div class="kpi-label">チーム達成率</div><div class="kpi-value">${s.rate}%</div></div>
          <div class="team-kpi"><div class="kpi-label">登録人数</div><div class="kpi-value">${s.peopleCount}人</div></div>
        </div>
      </div>
      <div class="self-rank" style="background:${currentStatusColor(self)}">${escapeHtml(shortStatus(currentStatusLabel(self),4))}</div>
    </div>`;
}
function shortStatus(text,n=5){ return String(text||'').length>n ? String(text).slice(0,n)+'…' : String(text||''); }
function renderStatusSummary(){
  $('statusSummary').innerHTML = STATUS_OPTIONS.map(st=>`
    <div class="sum-card" style="border-top-color:${st.color}">
      <div class="name">${st.label}</div>
      <div class="count" style="color:${st.color}">${teamSummary().statusCount[st.id]||0}人</div>
      <div class="desc">ステータス内訳</div>
    </div>`).join('');
}
function renderTypeSummary(){
  const s = teamSummary();
  const items = ['ABO','カスタマー','プロスペ','小売'];
  $('typeSummary').innerHTML = items.map(type=>`
    <div class="chip"><span class="chip-dot" style="background:${TYPE_COLORS[type]}"></span>${type} ${s.typeCount[type]||0}人</div>
  `).join('');
}
function metaLines(p){
  const arr = [
    ['年齢', p.age], ['職業', p.job], ['趣味', p.hobby], ['etc', p.etc]
  ].filter(x=>x[1]);
  if(!arr.length) return '<div class="meta-line"><span class="meta-label">情報</span><span class="meta-value">未入力</span></div>';
  return arr.map(([k,v])=>`<div class="meta-line"><span class="meta-label">${k}</span><span class="meta-value">${escapeHtml(v)}</span></div>`).join('');
}
function renderCard(p){
  const gp = groupPvFor(p.id);
  const status = currentStatusLabel(p);
  return `<div class="member-card" data-id="${p.id}" data-type="${p.type}">
    <div class="status-stamp" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
    <div class="card-left">
      <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
      <div class="meta-list">${metaLines(p)}</div>
    </div>
    <div class="card-main">
      <div class="card-name">${escapeHtml(p.name||'名称未設定')}</div>
      <span class="type-badge" data-type="${p.type}">${p.type}</span>
      <div class="pv-box ${goalState(p)}">
        <div><b>個人PV</b> ${goalStateText(p)}</div>
        <div>目標 ${fmt(p.target)} / 実績 ${fmt(p.actual)}</div>
        ${p.type==='ABO' ? `<div class="g"><b>Group PV</b> 目標 ${fmt(gp.target)} / 実績 ${fmt(gp.actual)}</div>` : ''}
      </div>
      <div class="memo-list">
        <div class="memo-item">${escapeHtml(p.memo1||'')}</div>
        <div class="memo-item">${escapeHtml(p.memo2||'')}</div>
        <div class="memo-item">${escapeHtml(p.memo3||'')}</div>
      </div>
    </div>
  </div>`;
}
function goalStateText(p){
  const s = goalState(p);
  if(s==='success') return '達成';
  if(s==='zero') return '実績0';
  if(s==='unset') return '目標未設定';
  return '進捗中';
}
function renderFilters(){
  $('statusFilter').innerHTML = `<option value="all">全ステータス</option>` + STATUS_OPTIONS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
  $('typeFilter').innerHTML = `<option value="all">全区分</option>` + ['ABO','カスタマー','プロスペ','小売'].map(t=>`<option value="${t}">${t}</option>`).join('');
}
