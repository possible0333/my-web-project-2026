(function(){
 'use strict';
 const SCHEMA='bar-events-upload-v1',AUTH='business-map-bar-auth-v1',TABLE='business_maps';
 const text=v=>String(v??'').trim(),validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 let connecting;
 async function connect(){
  if(!connecting)connecting=(async()=>{
   const cfg=window.BUSINESS_MAP_SUPABASE_CONFIG;
   if(!cfg?.url||!cfg?.publishableKey)throw Error('共有接続の設定がありません');
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.111.0');
   const client=createClient(cfg.url,cfg.publishableKey,{auth:{storageKey:AUTH,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
   const session=await client.auth.getSession();if(session.error)throw session.error;
   let user=session.data.session?.user;
   if(!user){const signed=await client.auth.signInAnonymously();if(signed.error)throw signed.error;user=signed.data.user;}
   if(!user)throw Error('共有用の端末認証に失敗しました');
   return {client,userId:user.id};
  })().catch(e=>{connecting=null;throw e;});
  return connecting;
 }
 function snapshot(db,eventId,owner){
  const ev=db.events.find(e=>e.id===eventId);if(!ev||!validDate(ev.date))throw Error('開催日を登録してください');
  if(!text(owner))throw Error('担当者を設定してください');
  return {date:ev.date,owner:text(owner).slice(0,80),entries:db.entries.filter(e=>e.eventId===eventId&&text(e.name)).map(e=>({
   personId:text(e.personId),name:text(e.name).slice(0,80),sponsor:text(e.sponsor).slice(0,80),group:text(e.group).slice(0,80),kind:e.kind==='prospect'?'prospect':'member',
   status:['yes','pending','no'].includes(e.status)?e.status:'pending',slots:['A','B','C','D'].filter(s=>e.slots?.includes(s)),arrived:!!e.arrived
  })).sort((a,b)=>a.personId.localeCompare(b.personId))};
 }
 function parse(data){
  if(data?.schema!==SCHEMA||!Array.isArray(data.events))return [];
  return data.events.filter(e=>validDate(e?.date)&&Array.isArray(e.entries));
 }
 async function upload(db,eventId,owner){
  const snap=snapshot(db,eventId,owner),fingerprint=JSON.stringify(snap),{client,userId}=await connect();
  const run=async()=>{
   const read=await client.from(TABLE).select('user_id,map_data,schedule_data,updated_at').eq('user_id',userId).maybeSingle();if(read.error)throw read.error;
   const old=read.data;
   if(old&&old.map_data?.schema!==SCHEMA)throw Error('保存先がBar専用ではないため、上書きを中止しました');
   const updatedAt=new Date(Math.max(Date.now(),Date.parse(old?.updated_at||0)+1||0)).toISOString();
   const event={...snap,uploadedAt:updatedAt};
   const events=parse(old?.schedule_data?.barEvents).filter(e=>e.date!==snap.date);events.push(event);events.sort((a,b)=>a.date.localeCompare(b.date));
   const row={user_id:userId,name:text(owner).slice(0,80),comment:'Barイベント専用',image_url:'',image_path:'',client_updated_at:Date.now(),updated_at:updatedAt,version:'bar-v1',map_data:{schema:SCHEMA},schedule_data:{barEvents:{schema:SCHEMA,events}}};
   if(JSON.stringify(row).length>1500000)throw Error('共有データ量が上限を超えています。管理者に確認してください');
   const query=old?client.from(TABLE).update(row).eq('user_id',userId).eq('updated_at',old.updated_at):client.from(TABLE).insert(row);
   const saved=await query.select('user_id,updated_at');if(saved.error)throw saved.error;
   if(saved.data?.length!==1)throw Error('別タブで更新されました。再読み込みして確認後、再アップロードしてください');
   return {date:snap.date,fingerprint,uploadedAt:updatedAt,userId};
  };
  return navigator.locks?navigator.locks.request('business-map-bar-upload',run):run();
 }
 function aggregate(rows,overrides=[]){
  const overrideKey=(uid,date,id)=>JSON.stringify([uid,date,id]);
  const corrections=new Map(overrides.map(o=>[overrideKey(o.uploader_id,o.event_date,o.person_id),o]));
  const deletedEntries=[];
  const db=BarModel.empty(),events=new Map(),people=new Map(),uploads=[];
  for(const row of rows){
   if(row.map_data?.schema!==SCHEMA)continue;
   const byDate=new Map(parse(row.schedule_data?.barEvents).map(e=>[e.date,e]));
   for(const [date,event] of byDate){
    if(!events.has(date))events.set(date,{id:date,date,goal:0,prospectGoal:0,groups:{}});
    uploads.push({date,owner:text(event.owner),uploadedAt:text(event.uploadedAt),userId:row.user_id,count:event.entries.length});
    const seen=new Set();
    for(const original of event.entries){
     const personId=text(original?.personId);if(!personId||!text(original.name)||seen.has(personId))continue;seen.add(personId);
     const correction=corrections.get(overrideKey(row.user_id,date,personId));
     const raw={...original,...correction?.patch};
     const id=String(row.user_id)+':'+personId;
     const p={id,name:text(raw.name).slice(0,80),sponsor:text(raw.sponsor).slice(0,80),group:text(raw.group).slice(0,80),kind:raw.kind==='prospect'?'prospect':'member',source:'bar:'+id};people.set(id,p);
     const entry={...p,id:date+':'+id,personId:id,eventId:date,status:['yes','pending','no'].includes(raw.status)?raw.status:'pending',slots:['A','B','C','D'].filter(s=>raw.slots?.includes(s)),arrived:raw.arrived===true,note:'',uploadedBy:text(event.owner),uploadedAt:text(event.uploadedAt),uploaderId:row.user_id,sourcePersonId:personId,sourceUpdatedAt:row.updated_at,adminRevision:correction?.revision||0,adminDeleted:!!correction?.deleted};
     if(entry.adminDeleted)deletedEntries.push(entry);else db.entries.push(entry);
    }
   }
  }
  db.events=[...events.values()].sort((a,b)=>a.date.localeCompare(b.date));db.people=[...people.values()];
  const counts=new Map();for(const e of db.entries){const k=[e.eventId,e.name.normalize('NFKC').toLowerCase(),e.sponsor.normalize('NFKC').toLowerCase()].join('|');counts.set(k,(counts.get(k)||0)+1);}
  for(const e of db.entries){const k=[e.eventId,e.name.normalize('NFKC').toLowerCase(),e.sponsor.normalize('NFKC').toLowerCase()].join('|');e.duplicate=counts.get(k)>1;}
  return {db,uploads,deletedEntries};
 }
 async function load(){
  const {client}=await connect(),rows=[];
  for(let offset=0;;offset+=500){
   const result=await client.from(TABLE).select('user_id,map_data,schedule_data,updated_at').eq('map_data->>schema',SCHEMA).order('user_id').range(offset,offset+499);
   if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<500)break;
  }
  const overrides=[];
  for(let offset=0;;offset+=500){
   const result=await client.from('bar_attendance_overrides').select('uploader_id,event_date,person_id,patch,deleted,revision').order('uploader_id').order('event_date').order('person_id').range(offset,offset+499);
   if(result.error)throw result.error;overrides.push(...result.data);if(result.data.length<500)break;
  }
  return aggregate(rows,overrides);
 }
 async function verifyAdmin(password){const {client}=await connect();const r=await client.rpc('admin_verify_business_maps',{p_password:password});if(r.error)throw r.error;return r.data===true;}
 async function moderate(password,entry,action,patch={}){
  const {client}=await connect();const r=await client.rpc('bar_admin_moderate',{p_password:password,p_uploader_id:entry.uploaderId,p_event_date:entry.eventId,p_person_id:entry.sourcePersonId,p_expected_updated_at:entry.sourceUpdatedAt,p_revision:entry.adminRevision||0,p_action:action,p_patch:patch});
  if(r.error)throw r.error;if(!r.data?.ok)throw Error(r.data?.error||'管理者操作に失敗しました');return r.data;
 }
 window.BarCloud={connect,snapshot,upload,load,aggregate,verifyAdmin,moderate,schema:SCHEMA};
})();
