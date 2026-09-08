(function(){
  const APP_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.96';
  let activeId=null;
  const previousRenderCard=window.renderCard;

  function safe(v){ return String(v||'').trim(); }
  function normalizeFavorites(value){
    const list=Array.isArray(value)?value:[];
    return Array.from({length:5},(_,index)=>{
      const item=list[index]||{};
      return {
        name:safe(item.name),
        reasons:Array.from({length:3},(_,reasonIndex)=>safe(Array.isArray(item.reasons)?item.reasons[reasonIndex]:''))
      };
    });
  }
  function normalizeProspectPlans(value,legacy){
    const hasPlans=Array.isArray(value);
    const list=hasPlans?value:[];
    const old=legacy||{};
    return Array.from({length:3},(_,index)=>{
      const item=list[index]||{};
      return {
        method:safe(item.method ?? (!hasPlans&&index===0?old.method:'')),
        deadline:safe(item.deadline ?? (!hasPlans&&index===0?old.deadline:'')),
        action:safe(item.action ?? (!hasPlans&&index===0?old.action:''))
      };
    });
  }
  function prospectPlansOf(p){
    return normalizeProspectPlans(p?.prospectPlans,{
      method:p?.prospectMethod,
      deadline:p?.prospectDeadline,
      action:p?.prospectAction
    });
  }

  function ensureSelfFields(){
    if(document.getElementById('v128SelfFocusField')) return;
    const pvFields=[...document.querySelectorAll('.v117-pv-priority')];
    const anchor=pvFields[pvFields.length-1] || document.querySelector('.v117-name-priority');
    if(!anchor) return;
    const field=document.createElement('div');
    field.id='v128SelfFocusField';
    field.className='field full v128-self-focus-field hidden';
    field.innerHTML=`
      <div class="v128-edit-head">
        <div>
          <div class="v128-edit-title">今月の目標・意識すること</div>
          <div class="v128-edit-helper">自分カードだけに表示される今月の行動テーマです。</div>
        </div>
        <span class="v128-edit-badge">自分専用</span>
      </div>
      <div class="v128-edit-goals">
        <div><label for="fMonthlyTargetPv">目標PV</label><input id="fMonthlyTargetPv" class="number-input" type="number" inputmode="numeric" min="0" step="1000" placeholder="例：180000"></div>
        <div><label for="fFrontUpGoal">フロントアップ数</label><input id="fFrontUpGoal" class="number-input" type="number" inputmode="numeric" min="0" step="1" placeholder="例：2"></div>
        <div><label for="fGroupUpGoal">グループアップ数</label><input id="fGroupUpGoal" class="number-input" type="number" inputmode="numeric" min="0" step="1" placeholder="例：5"></div>
      </div>
      <div class="v128-focus-inputs">
        <div><label for="fFocus1">意識すること 1</label><input id="fFocus1" class="text-input" placeholder="例：毎日プロスペへ連絡"></div>
        <div><label for="fFocus2">意識すること 2</label><input id="fFocus2" class="text-input" placeholder="例：期限をその場で決める"></div>
        <div><label for="fFocus3">意識すること 3</label><input id="fFocus3" class="text-input" placeholder="例：フォローを翌日に持ち越さない"></div>
      </div>
      <div class="v194-prospect-edit">
        <div class="v194-prospect-edit-head">
          <strong>プロスペ探し</strong>
          <span>3候補まで、手段と「いつまでに何をするか」を決められます。</span>
        </div>
        <div class="v194-prospect-inputs">
          ${Array.from({length:3},(_,index)=>`<section class="v196-prospect-candidate">
            <div class="v196-prospect-rank">候補 ${index+1}</div>
            <div class="v196-prospect-fields">
              <div><label for="fProspect${index+1}Method">手段</label><input id="fProspect${index+1}Method" class="text-input" maxlength="80" placeholder="例：友人への連絡・イベント参加"></div>
              <div><label for="fProspect${index+1}Deadline">いつまでに</label><input id="fProspect${index+1}Deadline" class="text-input" type="date"></div>
              <div><label for="fProspect${index+1}Action">何をする</label><input id="fProspect${index+1}Action" class="text-input" maxlength="100" placeholder="例：候補者を10人書き出す"></div>
            </div>
          </section>`).join('')}
        </div>
      </div>
      <div class="v195-favorites-edit">
        <div class="v195-favorites-edit-head">
          <strong>今のお気に入り製品 TOP5</strong>
          <span>製品名と、お気に入りの理由を3つまで入力できます。</span>
        </div>
        <div class="v195-favorite-products">
          ${Array.from({length:5},(_,index)=>`<section class="v195-favorite-product">
            <div class="v195-favorite-rank">${index+1}位</div>
            <label for="fFavoriteProduct${index+1}Name">製品名</label>
            <input id="fFavoriteProduct${index+1}Name" class="text-input" maxlength="60" placeholder="お気に入り製品を入力">
            <div class="v195-favorite-reasons">
              ${Array.from({length:3},(_,reasonIndex)=>`<div><label for="fFavoriteProduct${index+1}Reason${reasonIndex+1}">理由 ${reasonIndex+1}</label><input id="fFavoriteProduct${index+1}Reason${reasonIndex+1}" class="text-input" maxlength="80" placeholder="お気に入りの理由"></div>`).join('')}
            </div>
          </section>`).join('')}
        </div>
      </div>`;
    anchor.insertAdjacentElement('afterend',field);
  }

  function copySelfPlanning(target,raw){
    if(!target?.self) return;
    const src=raw?.self || {};
    target.self.monthlyGoal=String(src.monthlyGoal ?? target.self.monthlyGoal ?? '');
    target.self.monthlyTargetPv=Math.max(0,Number(src.monthlyTargetPv ?? target.self.monthlyTargetPv ?? 0)||0);
    target.self.frontUpGoal=Math.max(0,Number(src.frontUpGoal ?? target.self.frontUpGoal ?? 0)||0);
    target.self.groupUpGoal=Math.max(0,Number(src.groupUpGoal ?? target.self.groupUpGoal ?? 0)||0);
    target.self.focus1=String(src.focus1 ?? target.self.focus1 ?? '');
    target.self.focus2=String(src.focus2 ?? target.self.focus2 ?? '');
    target.self.focus3=String(src.focus3 ?? target.self.focus3 ?? '');
    target.self.prospectMethod=String(src.prospectMethod ?? target.self.prospectMethod ?? '');
    target.self.prospectDeadline=String(src.prospectDeadline ?? target.self.prospectDeadline ?? '');
    target.self.prospectAction=String(src.prospectAction ?? target.self.prospectAction ?? '');
    target.self.prospectPlans=normalizeProspectPlans(src.prospectPlans,{
      method:src.prospectMethod ?? target.self.prospectMethod,
      deadline:src.prospectDeadline ?? target.self.prospectDeadline,
      action:src.prospectAction ?? target.self.prospectAction
    });
    target.self.favoriteProducts=normalizeFavorites(src.favoriteProducts ?? target.self.favoriteProducts);
  }

  function restoreFromStorage(){
    try{
      for(const key of STORAGE_KEYS){
        const text=localStorage.getItem(key);
        if(!text) continue;
        const raw=JSON.parse(text);
        if(!raw?.self) continue;
        copySelfPlanning(state,raw);
        break;
      }
    }catch(e){ console.warn('[v1.28] self focus restore skipped',e); }
    state.self.monthlyGoal=String(state.self.monthlyGoal||'');
    state.self.monthlyTargetPv=Math.max(0,Number(state.self.monthlyTargetPv||0));
    state.self.frontUpGoal=Math.max(0,Number(state.self.frontUpGoal||0));
    state.self.groupUpGoal=Math.max(0,Number(state.self.groupUpGoal||0));
    state.self.focus1=String(state.self.focus1||'');
    state.self.focus2=String(state.self.focus2||'');
    state.self.focus3=String(state.self.focus3||'');
    state.self.prospectMethod=String(state.self.prospectMethod||'');
    state.self.prospectDeadline=String(state.self.prospectDeadline||'');
    state.self.prospectAction=String(state.self.prospectAction||'');
    state.self.prospectPlans=prospectPlansOf(state.self);
    state.self.favoriteProducts=normalizeFavorites(state.self.favoriteProducts);
  }

  function patchMigrate(){
    if(typeof migrate!=='function' || migrate.__v128) return;
    const original=migrate;
    const wrapped=function(raw){
      const next=original.apply(this,arguments);
      copySelfPlanning(next,raw);
      return next;
    };
    wrapped.__v128=true;
    migrate=wrapped;
  }

  function fillSelfFields(p){
    const values={
      fMonthlyTargetPv:Number(p?.monthlyTargetPv||0)||'',
      fFrontUpGoal:Number(p?.frontUpGoal||0)||'',
      fGroupUpGoal:Number(p?.groupUpGoal||0)||'',
      fFocus1:p?.focus1||'',
      fFocus2:p?.focus2||'',
      fFocus3:p?.focus3||''
    };
    Object.entries(values).forEach(([id,value])=>{
      const el=document.getElementById(id);
      if(el) el.value=value;
    });
    prospectPlansOf(p).forEach((plan,index)=>{
      const number=index+1;
      const method=document.getElementById(`fProspect${number}Method`);
      const deadline=document.getElementById(`fProspect${number}Deadline`);
      const action=document.getElementById(`fProspect${number}Action`);
      if(method) method.value=plan.method;
      if(deadline) deadline.value=plan.deadline;
      if(action) action.value=plan.action;
    });
    normalizeFavorites(p?.favoriteProducts).forEach((product,index)=>{
      const name=document.getElementById(`fFavoriteProduct${index+1}Name`);
      if(name) name.value=product.name;
      product.reasons.forEach((reason,reasonIndex)=>{
        const input=document.getElementById(`fFavoriteProduct${index+1}Reason${reasonIndex+1}`);
        if(input) input.value=reason;
      });
    });
  }

  function patchOpenModal(){
    if(typeof openModal!=='function' || openModal.__v128) return;
    const original=openModal;
    const wrapped=function(id){
      activeId=id||null;
      ensureSelfFields();
      const result=original.apply(this,arguments);
      const field=document.getElementById('v128SelfFocusField');
      const isSelf=id==='self';
      if(field) field.classList.toggle('hidden',!isSelf);
      if(isSelf) fillSelfFields(getPerson('self'));
      else fillSelfFields(null);
      return result;
    };
    wrapped.__v128=true;
    openModal=wrapped;
  }

  function patchGatherForm(){
    if(typeof gatherForm!=='function' || gatherForm.__v128) return;
    const original=gatherForm;
    const wrapped=function(){
      const data=original.apply(this,arguments);
      if(activeId==='self'){
        data.monthlyTargetPv=Math.max(0,Number(document.getElementById('fMonthlyTargetPv')?.value||0));
        data.frontUpGoal=Math.max(0,Math.floor(Number(document.getElementById('fFrontUpGoal')?.value||0)));
        data.groupUpGoal=Math.max(0,Math.floor(Number(document.getElementById('fGroupUpGoal')?.value||0)));
        data.focus1=safe(document.getElementById('fFocus1')?.value);
        data.focus2=safe(document.getElementById('fFocus2')?.value);
        data.focus3=safe(document.getElementById('fFocus3')?.value);
        data.prospectPlans=Array.from({length:3},(_,index)=>{
          const number=index+1;
          return {
            method:safe(document.getElementById(`fProspect${number}Method`)?.value),
            deadline:safe(document.getElementById(`fProspect${number}Deadline`)?.value),
            action:safe(document.getElementById(`fProspect${number}Action`)?.value)
          };
        });
        data.prospectMethod=data.prospectPlans[0].method;
        data.prospectDeadline=data.prospectPlans[0].deadline;
        data.prospectAction=data.prospectPlans[0].action;
        data.favoriteProducts=Array.from({length:5},(_,index)=>({
          name:safe(document.getElementById(`fFavoriteProduct${index+1}Name`)?.value),
          reasons:Array.from({length:3},(_,reasonIndex)=>safe(document.getElementById(`fFavoriteProduct${index+1}Reason${reasonIndex+1}`)?.value))
        }));
      }
      return data;
    };
    wrapped.__v128=true;
    gatherForm=wrapped;
  }

  function profileInline(p){
    const items=[['年',p.age],['職',p.job],['趣',p.hobby],['他',p.etc]].filter(([,v])=>safe(v));
    if(!items.length) return '';
    return `<span class="v121-profile-inline">${items.map(([k,v])=>`<span><b>${k}</b>${escapeHtml(v)}</span>`).join('<i>・</i>')}</span>`;
  }

  function deadlineLabel(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(!m) m=s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    return m?`${Number(m[1])}/${Number(m[2])}`:'';
  }

  function actionBlock(p){
    const deadline=deadlineLabel(p.deadline);
    const action=safe(p.nextAction);
    if(!deadline&&!action) return '';
    return `<div class="v128-self-action"><span><b>期限</b>${escapeHtml(deadline||'未設定')}</span><span><b>次</b>${escapeHtml(action||'未設定')}</span></div>`;
  }

  function planningBlock(p){
    const monthlyTargetPv=Math.max(0,Number(p.monthlyTargetPv||0));
    const frontUpGoal=Math.max(0,Number(p.frontUpGoal||0));
    const groupUpGoal=Math.max(0,Number(p.groupUpGoal||0));
    return `<div class="v128-plan-section v128-monthly-goal">
      <div class="v128-plan-label">今月の目標</div>
      <div class="v175-goal-grid">
        <div><span>計画PV</span><b>${monthlyTargetPv?fmt(monthlyTargetPv):'未入力'}</b></div>
        <div><span>フロントアップ</span><b>${frontUpGoal?`${fmt(frontUpGoal)}人`:'未入力'}</b></div>
        <div><span>グループアップ</span><b>${groupUpGoal?`${fmt(groupUpGoal)}人`:'未入力'}</b></div>
      </div>
    </div>`;
  }

  function focusPanel(p){
    const focus=[safe(p.focus1),safe(p.focus2),safe(p.focus3)];
    const empty=focus.every(v=>!v);
    return `<aside class="v194-self-side v194-focus-panel" aria-label="今月意識すること">
      ${empty?'<span class="v194-empty-stamp">未記入</span>':''}
      <div class="v194-side-title">今月意識すること</div>
      <div class="v128-focus-items">${focus.map((v,i)=>`<div class="${v?'':'is-empty'}"><b>${i+1}</b><span>${escapeHtml(v||'未入力')}</span></div>`).join('')}</div>
    </aside>`;
  }

  function prospectPanel(p){
    const plans=prospectPlansOf(p);
    return `<aside class="v194-self-side v194-prospect-panel" aria-label="プロスペ探し">
      <div class="v194-side-title">プロスペ探し</div>
      <div class="v196-prospect-list">${plans.map((plan,index)=>{
        const method=safe(plan.method),deadline=deadlineLabel(plan.deadline),action=safe(plan.action);
        return `<section class="v196-prospect-candidate-view"><strong>候補 ${index+1}</strong><div class="v194-prospect-values">
          <div><span>手段</span><b class="${method?'':'is-empty'}">${escapeHtml(method||'未入力')}</b></div>
          <div><span>いつまでに</span><b class="${deadline?'':'is-empty'}">${escapeHtml(deadline||'未入力')}</b></div>
          <div><span>何をする</span><b class="${action?'':'is-empty'}">${escapeHtml(action||'未入力')}</b></div>
        </div></section>`;
      }).join('')}</div>
    </aside>`;
  }

  function pvText(v,unset){
    const n=Number(v||0);
    return unset&&n<=0?'未設定':fmt(n);
  }

  function renderSelfCard(p){
    const gp=groupPvFor('self');
    const status=currentStatusLabel(p);
    const memos=[p.memo1,p.memo2,p.memo3].filter(v=>safe(v));
    return `<div class="v194-self-hub">
      ${focusPanel(p)}
      <div class="member-card v114-card v120-card v121-card v128-self-card-content" data-id="self" data-type="${p.type}">
        <div class="status-stamp" title="${escapeHtml(status)}" style="background:${currentStatusColor(p)}">${escapeHtml(status)}</div>
        <div class="v128-self-main">
          <div class="v128-self-identity">
            <img class="card-avatar" src="${ICONS[p.avatar||0]}" alt="avatar">
            <div class="v128-self-namewrap">
              <div class="card-name">${escapeHtml(p.name||'自分')}</div>
              <div class="v121-meta-row"><span class="type-badge" data-type="${p.type}">${p.type}</span>${profileInline(p)}</div>
            </div>
          </div>
          ${actionBlock(p)}
          <div class="pv-box v114-pv ${goalState(p)}">
            <div class="v114-pv-row"><span class="v114-pv-label">個人PV</span><span class="v114-pv-values"><small>計</small>${pvText(p.target,true)}<i>/</i><small>実</small>${fmt(p.actual)}</span></div>
            <div class="v114-pv-row"><span class="v114-pv-label">GrPV</span><span class="v114-pv-values"><small>計</small>${pvText(gp.target,true)}<i>/</i><small>実</small>${fmt(gp.actual)}</span></div>
          </div>
          ${planningBlock(p)}
          ${memos.length?`<div class="memo-list">${memos.map(v=>`<div class="memo-item">${escapeHtml(v)}</div>`).join('')}</div>`:''}
        </div>
      </div>
      ${prospectPanel(p)}
    </div>`;
  }

  function renderCardV128(p){
    if(p?.id==='self') return renderSelfCard(p);
    return typeof previousRenderCard==='function' ? previousRenderCard(p) : '';
  }

  function rerender(){
    window.renderCard=renderCardV128;
    try{ renderCard=renderCardV128; }catch(e){}
    if(typeof window.renderTree==='function'){
      try{ window.renderTree(); }catch(e){ console.warn('[v1.28] rerender failed',e); }
    }
  }

  function refreshVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function bind(){
    ensureSelfFields();
    patchMigrate();
    patchOpenModal();
    patchGatherForm();
    restoreFromStorage();
    refreshVersion();
    try{ save(); }catch(e){}
    try{ if(typeof renderSelf==='function') renderSelf(); }catch(e){ console.warn('[v1.75] monthly summary rerender failed',e); }
    rerender();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
