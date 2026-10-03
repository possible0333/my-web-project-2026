(function(root){
  'use strict';
  const LIMIT=21*24*60*60*1000;
  function timestamp(value,now=Date.now()){
    const time=typeof value==='number'?value:typeof value==='string'&&value.trim()?Date.parse(value):NaN;
    return Number.isFinite(time)&&time>0&&time<=now?time:now;
  }
  function sweep(state,now=Date.now()){
    let changed=false;
    for(const p of state.members||[]){
      const date=timestamp(p.cardUpdatedAt,now);
      if(p.cardUpdatedAt!==date){p.cardUpdatedAt=date;changed=true;}
      if(p.type==='プロスペ'&&p.status!=='next-month'&&now-date>=LIMIT){
        p.status='next-month';changed=true;
      }
    }
    return changed;
  }
  root.ProspectActivity={timestamp,sweep,LIMIT};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ProspectActivity;
})(typeof window!=='undefined'?window:globalThis);
