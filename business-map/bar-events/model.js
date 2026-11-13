(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const id=()=>crypto.randomUUID();
 const dateOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const plus=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 function candidates(month){
  if(!/^\d{4}-\d{2}$/.test(month)||!dateOK(month+'-01'))return [];
  return Array.from({length:9},(_,i)=>month+'-'+String(i+1).padStart(2,'0')).filter(d=>new Date(d+'T00:00:00Z').getUTCDay()===6);
 }
 function empty(){return {schema:1,people:[],events:[],entries:[],history:[]};}
 function upcoming(events,today){return events.filter(e=>dateOK(e.date)&&e.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;}
 function nextEvent(events,today){
  if(!dateOK(today))throw Error('日付が不正です');
  const dates=[];
  for(let offset=0;offset<2;offset++){
   const month=new Date(today+'T00:00:00Z');month.setUTCDate(1);month.setUTCMonth(month.getUTCMonth()+offset);
   const key=month.toISOString().slice(0,7),options=candidates(key);
   const configured=events.map(e=>e.date).filter(d=>options.includes(d)).sort()[0];
   const first=configured||options[0];dates.push(first,plus(first,14));
  }
  const automatic=dates.filter(d=>d>=today).sort()[0],registered=upcoming(events,today);
  if(registered&&registered.date<=automatic)return registered;
  return {id:automatic,date:automatic,goal:0,prospectGoal:0,groups:{}};
 }
 function pair(db,first){
  if(!dateOK(first)||!candidates(first.slice(0,7)).includes(first))throw Error('10日より前の土曜日を選んでください');
  for(const date of [first,plus(first,14)])if(!db.events.some(e=>e.date===date))db.events.push({id:id(),date,goal:0,prospectGoal:0,groups:{}});
  db.events.sort((a,b)=>a.date.localeCompare(b.date));
 }
 function person(db,p){
  if(!String(p.name||'').trim())throw Error('名前を入力してください');
  if(p.source){const found=db.people.find(x=>x.source===p.source);if(found)return found;}
  const next={id:id(),name:p.name.trim(),kind:p.kind==='member'?'member':'prospect',sponsor:String(p.sponsor||'').trim(),group:String(p.group||'').trim(),source:p.source||''};
  db.people.push(next);return next;
 }
 function add(db,eventId,personId){
  if(!db.events.some(e=>e.id===eventId))throw Error('開催回を選んでください');
  const p=db.people.find(p=>p.id===personId);if(!p)throw Error('参加者が見つかりません');
  if(db.entries.some(e=>e.eventId===eventId&&e.personId===personId))throw Error('この人は今回すでに登録されています');
  db.entries.push({id:id(),eventId,personId,name:p.name,kind:p.kind,sponsor:p.sponsor,group:p.group,status:'pending',slots:[],note:'',arrived:false,cancelled:false});
 }
 function selfPerson(db,owner,mapPerson,create=false){
  if(!owner)return null;
  const saved=db.people.find(p=>p.id===db.selfPeople?.[owner]);
  const mapped=mapPerson?.source&&db.people.find(p=>p.source===mapPerson.source);
  const candidates=db.people.filter(p=>p.name===owner&&p.kind==='member'&&p.sponsor===owner);
  let p=saved||mapped||(candidates.length===1?candidates[0]:null);
  if(!p&&create){
   if(candidates.length>1)throw Error('自分と同名の登録が複数あります。参加者一覧で重複を確認してください');
   p=person(db,{...(mapPerson||{}),name:owner,kind:'member',sponsor:mapPerson?.sponsor||owner});
  }
  if(p&&create){db.selfPeople=db.selfPeople||{};db.selfPeople[owner]=p.id;}
  return p||null;
 }
 function setSelf(db,eventId,owner,mapPerson,values){
  if(!String(owner||'').trim())throw Error('自分の名前を設定してください');
  const p=selfPerson(db,owner,mapPerson,true);
  let entry=db.entries.find(e=>e.eventId===eventId&&e.personId===p.id);
  if(!entry){add(db,eventId,p.id);entry=db.entries.at(-1);}
  change(db,entry.id,values.status==='no'?{...values,slots:[],arrived:false,cancelled:false}:values);
  if(values.status==='yes'){
   entry.selfConfirmedAt=new Date().toISOString();
   entry.cancelled=false;
  }
  entry.kind='member';
  return entry;
 }
 function singleSlot(slots){
  const first=['A','B','C','D'].find(slot=>slots?.includes(slot));
  return first?[first]:[];
 }
 function change(db,entryId,values){
  const entry=db.entries.find(e=>e.id===entryId);if(!entry)throw Error('参加者が見つかりません');
  if(values.status!==undefined){if(!['yes','pending','no'].includes(values.status))throw Error('出欠が不正です');entry.status=values.status;}
  if(values.slots!==undefined)entry.slots=singleSlot(values.slots);
  if(values.cancelled!==undefined){entry.cancelled=values.cancelled===true;if(entry.cancelled)entry.arrived=false;}
  if(values.note!==undefined)entry.note=String(values.note).slice(0,300);
  if(values.arrived!==undefined)entry.arrived=!!values.arrived;
 }
 function summary(entries,goal=0,prospectGoal=0){
  const active=entries.filter(e=>e.name.trim());
  const yes=active.filter(e=>e.status==='yes'&&!e.cancelled),prospects=yes.filter(e=>e.kind==='prospect');
  return {confirmed:yes.length,prospects:prospects.length,pending:active.filter(e=>!e.cancelled&&e.status==='pending').length,
   pendingProspects:active.filter(e=>!e.cancelled&&e.status==='pending'&&e.kind==='prospect').length,
   remaining:Math.max(0,goal-yes.length),prospectRemaining:Math.max(0,prospectGoal-prospects.length),
   cancelled:active.filter(e=>e.cancelled===true).length,
   arrived:active.filter(e=>e.arrived).length,
   slots:Object.fromEntries(['A','B','C','D'].map(s=>[s,yes.filter(e=>e.slots.includes(s)).length])),
   part1:yes.filter(e=>e.slots.some(s=>s==='A'||s==='B')).length,part2:yes.filter(e=>e.slots.some(s=>s==='C'||s==='D')).length,
   missingTime:yes.filter(e=>!e.slots.length).length};
 }
 function past(db,before,owner,all=false){
  const dates=new Map(db.events.map(e=>[e.id,e.date]));const people=new Map();
  for(const e of db.entries){
   const date=dates.get(e.eventId);
   if(!(e.arrived||('cancelled' in e&&e.status==='yes'&&!e.cancelled))||e.cancelled||e.kind!=='prospect'||!date||date>=before||(!all&&e.sponsor!==owner))continue;
   const p=people.get(e.personId)||{...e,count:0,last:date};
   p.count++;if(date>p.last){p.last=date;p.name=e.name;p.sponsor=e.sponsor;p.group=e.group;}
   people.set(e.personId,p);
  }
  return [...people.values()].sort((a,b)=>b.last.localeCompare(a.last));
 }
 root.BarModel={singleSlot,clone,id,empty,pair,person,add,change,summary,past,candidates,plus,upcoming,nextEvent,selfPerson,setSelf};
})(globalThis);
