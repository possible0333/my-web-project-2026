(function(){
  const PATCH_VERSION='v1.24';
  const previousGroupPvFor=window.groupPvFor || groupPvFor;

  function groupPvForV124(id){
    if(id!=='self') return previousGroupPvFor(id);

    // v1.23で算出した「直フロント各ラインのGrPV合計」に、
    // 自分自身の個人PVを1回だけ加算する。
    const frontLines=previousGroupPvFor('self') || {target:0,actual:0};
    const self=state.self || {};
    return {
      target:Number(self.target||0)+Number(frontLines.target||0),
      actual:Number(self.actual||0)+Number(frontLines.actual||0)
    };
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.24';
  }

  function apply(){
    window.groupPvFor=groupPvForV124;
    try{ groupPvFor=groupPvForV124; }catch(e){}
    refreshVersionLabel();
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.24] self GrPV rerender failed',e); }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
