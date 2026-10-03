(function(root){
  'use strict';
  // FY2027 Business Support pp.10–17; contract pp.24–32,39–43,50–53.
  // Monetary incentives are already tax-inclusive. Never apply VAT twice.
  const BV_PER_PV=1.446, TAX=1.1;
  const number=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const count=v=>Math.min(12,Math.floor(number(v)));
  const yen=v=>Math.round(Math.max(0,v));
  const rate=pv=>pv>=1500000?21:pv>=1000000?18:pv>=600000?15:pv>=360000?12:pv>=180000?9:pv>=90000?6:pv>=30000?3:0;
  const eligibleType=p=>p?.type==='ABO'||p?.type==='カスタマー';
  function fields(p={}){
    return {bsiEligible:p.bsiEligible===true&&eligibleType(p),bronze9Count:count(p.bronze9Count),bronze15Count:count(p.bronze15Count),
      repeatOrderEligible:p.repeatOrderEligible===true,repeatOrderMonth:count(p.repeatOrderMonth),
      spBonusEligible:p.spBonusEligible===true,otherMonthlyBonus:yen(number(p.otherMonthlyBonus))};
  }
  function bronze(previous,base){return previous>=12?0:base+Math.floor(previous/3)*5000;}
  function calculate(state){
    const people=[{...state.self,id:'self'},...(state.members||[])];
    const ids=new Map(),children=new Map(),warnings=[];
    for(const p of people){
      if(!p.id||ids.has(p.id)){warnings.push('重複・欠落したメンバーIDがあります');continue;}
      ids.set(p.id,p);
      if(p.id!=='self'){
        const parent=p.parentId||'self';
        if(!children.has(parent)) children.set(parent,[]);
        children.get(parent).push(p);
      }
    }
    const visited=new Set(),active=new Set(),cache=new Map();
    const zero=()=>({award:0,total:0,percent:0,performance:0,leadership:0,passUp:0,sp:'',branches:[]});
    function visit(p){
      if(active.has(p.id)){warnings.push('スポンサー関係に循環があります');return zero();}
      if(cache.has(p.id)) return cache.get(p.id);
      visited.add(p.id);active.add(p.id);
      const kids=(children.get(p.id)||[]).map(child=>({p:child,result:visit(child)}));
      const own=p.id==='self'||p.status!=='next-month'?number(p.target):0;
      // Non-ABO purchases accrue to the nearest ABO; no customer bonus deduction.
      const branches=kids.flatMap(({p:child,result:r})=>child.type==='ABO'?[r]:r.branches);
      const local=own+kids.filter(k=>k.p.type!=='ABO').reduce((s,k)=>s+k.result.local,0);
      const award=local+branches.filter(b=>b.percent<21).reduce((s,b)=>s+b.award,0);
      const breakaways=branches.filter(b=>b.percent===21);
      const percent=breakaways.length?21:rate(award);
      const sp=award>=1500000?'I':breakaways.length&&award>=600000?'II':breakaways.length>=2?'III':'';
      const performanceGross=award*percent/100*BV_PER_PV*TAX;
      // Deduct each direct ABO branch's GROSS entitlement (including its downline),
      // not just that ABO's net payout; otherwise deeper ABOs are paid twice.
      const performanceDistributed=branches.filter(b=>b.percent<21).reduce((s,b)=>s+b.award*b.percent/100*BV_PER_PV*TAX,0);
      const performance=yen(performanceGross-performanceDistributed);
      const incoming=breakaways.reduce((s,b)=>s+b.passUp,0);
      const ownPass=award*BV_PER_PV*TAX*.06;
      const minimum=1500000*BV_PER_PV*TAX*.06;
      const leadership=sp?yen(Math.max(0,incoming-Math.max(0,minimum-ownPass))):0;
      const passUp=percent===21?ownPass+incoming-leadership:0;
      const result={local,award,total:own+kids.reduce((s,k)=>s+k.result.total,0),percent,performance,performanceGross,performanceDistributed,leadership,passUp,sp,branches};
      active.delete(p.id);cache.set(p.id,result);return result;
    }
    const tree=visit(ids.get('self'));
    if(visited.size!==ids.size) warnings.push('自分につながっていないメンバーは試算対象外です');
    const self=ids.get('self'),f=fields(self),own=number(self.target);
    const bsiCount=(children.get('self')||[]).filter(p=>fields(p).bsiEligible&&p.status!=='next-month'&&number(p.target)>=10000).length;
    const bsi=own>=10000?[0,2000,4000,9000,12000,15000,18000][Math.min(6,bsiCount)]:0;
    const directAbos=(children.get('self')||[]).filter(p=>p.type==='ABO'&&p.status!=='next-month');
    const bronze9Legs=directAbos.filter(p=>cache.get(p.id)?.percent>=3).length;
    const bronze15Legs=directAbos.filter(p=>cache.get(p.id)?.percent>=6).length;
    const bronze9=tree.percent>=9&&own>=10000&&bronze9Legs>=3?bronze(f.bronze9Count,5000):0;
    const bronze15=tree.percent>=15&&own>=10000&&bronze15Legs>=3?bronze(f.bronze15Count,30000):0;
    const repeatOrder=f.repeatOrderEligible&&own>=10000?({3:1000,6:2000,9:3000,12:6000}[f.repeatOrderMonth]||0):0;
    const leadership=f.spBonusEligible?tree.leadership:0;
    const monthlyQ=f.spBonusEligible&&own>=10000?(tree.sp==='I'?100000:tree.sp==='II'?20000:0):0;
    if(tree.percent===21&&!f.spBonusEligible) warnings.push('SP資格条件未確認：リーダーシップ・月次Q強化は未加算');
    const items={performance:tree.performance,bsi,bronze9,bronze15,leadership,monthlyQ,repeatOrder,other:f.otherMonthlyBonus};
    return {...tree,bsiCount,bronze9Legs,bronze15Legs,items,totalIncome:Object.values(items).reduce((s,n)=>s+n,0),warnings:[...new Set(warnings)],fields:f};
  }
  root.BonusPlan={calculate,fields,rate,bronze,BV_PER_PV,TAX};
  if(typeof module!=='undefined'&&module.exports) module.exports=root.BonusPlan;
})(typeof window!=='undefined'?window:globalThis);
