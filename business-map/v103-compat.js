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
