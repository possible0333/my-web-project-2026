(function(){
 'use strict';
 const KEY='business_map_bar_preview_v1';
 async function uploadBar(){
  const raw=localStorage.getItem(KEY);
  if(!raw)return {status:'skipped',message:'未登録のため送信なし'};
  const db=JSON.parse(raw);
  if(db.schema!==1||!['people','events','entries','history'].every(k=>Array.isArray(db[k])))throw Error('Bar動員の保存データを読み取れません');
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),ev=BarModel.nextEvent(db.events,today);
  if(!db.events.some(e=>e.id===ev.id))return {status:'skipped',message:'次回の登録がないため送信なし'};
  const owner=localStorage.getItem(KEY+'_owner')||'';
  if(!owner.trim())throw Error('Bar動員の担当者名を設定してください');
  const {userId}=await BarCloud.connect(),receipts=JSON.parse(localStorage.getItem(KEY+'_receipts')||'{}');
  if(Object.values(receipts).some(r=>r.userId&&r.userId!==userId))throw Error('Bar動員の共有IDが変わっています。旧データを確認してください');
  const result=await BarCloud.upload(db,ev.id,owner);
  const selfId=db.selfPeople?.[owner];
  if(selfId && db.entries.some(e=>e.eventId===ev.id && e.personId===selfId && e.status==='yes' && !e.cancelled)){
   const shared=await BarCloud.load();
   const visible=shared.db.entries.some(e=>e.uploaderId===userId && e.eventId===result.date && e.sourcePersonId===selfId && e.status==='yes' && !e.cancelled);
   if(!visible)throw Error('送信済みですが、自分の参加は共有一覧に反映されていません。管理者に登録状況を確認してください');
  }
  receipts[result.date]=result;
  try{localStorage.setItem(KEY+'_receipts',JSON.stringify(receipts));}catch(e){return {status:'success',message:'共有済み（端末への送信履歴保存は失敗）'};}
  return {status:'success',message:'共有済み'};
 }
 async function run(mapTask,progress=()=>{}){
  const results=[];
  for(const [label,task] of [['マップ・スケジュール',mapTask],['Bar動員',uploadBar]]){
   progress(label);
   try{const result=await task();results.push({label,...result});}
   catch(e){results.push({label,status:'failed',message:e.message||String(e)});}
  }
  return results;
 }
 window.BusinessUploadAll={run,uploadBar};
})();
