// Business Map v1.03 compatibility layer for existing v1/v10 data and WebP avatars.
if (!STORAGE_KEYS.includes('business_map_v10')) STORAGE_KEYS.splice(1, 0, 'business_map_v10');
for (let i=0;i<ICONS.length;i++) ICONS[i]=ICONS[i].replace('.png','.webp');
const __v103BaseMigrate = migrate;
migrate = function(raw){
  const next = __v103BaseMigrate(raw);
  const typeMap = {ABO:'ABO',CUSTOMER:'カスタマー',PROSPECT:'プロスペ',RETAIL:'小売','カスタマー':'カスタマー','プロスペ':'プロスペ','小売':'小売'};
  next.self.type='ABO';
  next.members.forEach(p=>{ p.type = typeMap[p.type] || 'ABO'; });
  return next;
};
teamSummary = function(){
  const all = allPeople();
  const eligible = all.filter(isGroupEligible);
  const teamTarget = eligible.reduce((s,x)=>s+Number(x.target||0),0);
  const teamActual = eligible.reduce((s,x)=>s+Number(x.actual||0),0);
  const peopleCount = all.length;
  const typeCount = {ABO:0,'カスタマー':0,'プロスペ':0,'小売':0};
  const statusCount = Object.fromEntries(STATUS_OPTIONS.map(s=>[s.id,0]));
  all.forEach(p=>{ typeCount[p.type]=(typeCount[p.type]||0)+1; statusCount[p.status]=(statusCount[p.status]||0)+1; });
  return {teamTarget, teamActual, rate: teamTarget ? Math.round(teamActual/teamTarget*100) : 0, peopleCount, typeCount, statusCount};
};
