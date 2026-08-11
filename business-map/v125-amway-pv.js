(function(){
  const PATCH_VERSION='v1.25';

  function eligibleForCurrentMonth(p){
    return Boolean(p) && p.status!=='next-month';
  }

  // Amway-style group PV aggregation for this map:
  // GrPV = own personal PV + each direct child line's GrPV.
  // This recursive structure counts every current-month person exactly once,
  // so second/third-level PV stays inside the corresponding front line.
  function groupPvForAmway(id){
    const person=getPerson(id);
    if(!person) return {target:0,actual:0};

    let target=eligibleForCurrentMonth(person) ? Number(person.target||0) : 0;
    let actual=eligibleForCurrentMonth(person) ? Number(person.actual||0) : 0;

    const children=(state.members||[]).filter(p=>p.parentId===id && eligibleForCurrentMonth(p));
    children.forEach(child=>{
      const line=groupPvForAmway(child.id);
      target+=Number(line.target||0);
      actual+=Number(line.actual||0);
    });

    return {target,actual};
  }

  function performanceBonusRateForPv(pv){
    const n=Number(pv||0);
    if(n>=1500000) return 21;
    if(n>=1000000) return 18;
    if(n>=600000) return 15;
    if(n>=360000) return 12;
    if(n>=180000) return 9;
    if(n>=90000) return 6;
    if(n>=30000) return 3;
    return 0;
  }

  const originalTeamSummary=window.teamSummary || teamSummary;
  function teamSummaryAmway(){
    const base=originalTeamSummary();
    const gp=groupPvForAmway('self');
    return {
      ...base,
      teamTarget:Number(gp.target||0),
      teamActual:Number(gp.actual||0),
      rate:Number(gp.target||0)>0 ? Math.round(Number(gp.actual||0)/Number(gp.target||0)*100) : 0,
      performanceRate:performanceBonusRateForPv(gp.actual)
    };
  }

  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.25';
  }

  function apply(){
    window.groupPvFor=groupPvForAmway;
    window.teamSummary=teamSummaryAmway;
    window.performanceBonusRateForPv=performanceBonusRateForPv;
    try{ groupPvFor=groupPvForAmway; }catch(e){}
    try{ teamSummary=teamSummaryAmway; }catch(e){}
    refreshVersionLabel();

    if(typeof window.render==='function'){
      try{ window.render(); return; }catch(e){ console.warn('[v1.25] full rerender failed',e); }
    }
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.25] tree rerender failed',e); }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
