(function(){
  const PATCH_VERSION='v1.23';
  const originalGroupPvFor=window.groupPvFor || groupPvFor;

  function groupPvForV123(id){
    if(id!=='self') return originalGroupPvFor(id);

    // 自分のGrPVは「直フロント各ラインのGrPV合計」で算出する。
    // 自分自身の個人PVは加算しない。セカンド以下は各フロントGrPVの内数。
    const fronts=(state.members||[]).filter(p=>p.parentId==='self' && isGroupEligible(p));
    return fronts.reduce((sum,front)=>{
      const gp=originalGroupPvFor(front.id);
      sum.target+=Number(gp?.target||0);
      sum.actual+=Number(gp?.actual||0);
      return sum;
    },{target:0,actual:0});
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.23';
  }

  function apply(){
    window.groupPvFor=groupPvForV123;
    try{ groupPvFor=groupPvForV123; }catch(e){}
    refreshVersionLabel();
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.23] GrPV rerender failed',e); }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
