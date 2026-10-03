(function(){
  const $=id=>document.getElementById(id);
  const money=n=>Math.round(n).toLocaleString('ja-JP')+'円';
  function ensure(){
    if($('bonusFields')) return;
    const field=document.createElement('div');field.id='bonusFields';field.className='field full bonus-fields';
    field.innerHTML=`<section id="bonusMember"><label><input type="checkbox" id="fBsiEligible"> BSI対象者</label><small>登録・入会月を含め13カ月以内のABO／プライムカスタマーにチェック。直スポンサーの試算では、本人の計画PVが1万以上の場合に集計します。</small></section>
      <section id="bonusSelf"><h3>計画上の収入（ボーナス）</h3><div class="bonus-input-grid">
      <label>ブロンズ9 過去の獲得回数<input class="number-input" id="fBronze9Count" type="number" min="0" max="12" step="1"></label>
      <label>ブロンズ15 過去の獲得回数<input class="number-input" id="fBronze15Count" type="number" min="0" max="12" step="1"></label></div>
      <small>今月分を含めず入力。0回なら次は1回目、12回で受給終了。9％／15％到達と回数だけで試算し、系列数・個人PV・期間・過去資格の条件は判定しません。</small>
      <label class="bonus-check"><input type="checkbox" id="fSpBonusEligible"> SPの資格条件を満たす前提でリーダーシップ・月次Q強化を試算する</label>
      <small>国内系列のPV構成からSPタイプを判定。本人・系列下位の資格審査等は別途確認が必要です。</small>
      <details><summary>その他の月次ボーナス設定</summary>
      <label class="bonus-check"><input type="checkbox" id="fRepeatOrderEligible"> リピート・オーダーの対象条件を確認済み</label>
      <label>今月までの連続1万PV達成月数<input class="number-input" id="fRepeatOrderMonth" type="number" min="0" max="12" step="1"></label>
      <small>2026年9月以降の登録・資格切替、初回達成期限等を確認してください。今月3・6・9・12カ月目かつ個人計画1万PV以上の場合だけ加算します。</small>
      <label>その他の月次ボーナス（税込・手入力）<input class="number-input" id="fOtherMonthlyBonus" type="number" min="0" step="1"></label>
      <small>ルビー・デプス・海外／フォスター・SBI等は自動計算対象外。別途確認した金額のみ入力。年次ボーナス・一時金・小売利益は含めません。</small></details></section>`;
    $('sponsorField').insertAdjacentElement('afterend',field);
    $('fType').addEventListener('change',visibility);
  }
  function visibility(){
    const self=editingId==='self';
    $('bonusSelf').hidden=!self;
    $('bonusMember').hidden=self||!['ABO','カスタマー'].includes($('fType').value);
    $('bonusFields').hidden=$('bonusSelf').hidden&&$('bonusMember').hidden;
  }
  function fill(p){
    ensure();const f=BonusPlan.fields(p||{});
    for(const key of Object.keys(f)){
      const el=$('f'+key[0].toUpperCase()+key.slice(1));if(!el)continue;
      if(el.type==='checkbox')el.checked=f[key];else el.value=f[key];
    }
    visibility();
  }
  function gather(){
    if(!$('bonusFields'))return {};
    const p={type:$('fType').value};
    for(const key of Object.keys(BonusPlan.fields())){
      const el=$('f'+key[0].toUpperCase()+key.slice(1));
      p[key]=el.type==='checkbox'?el.checked:el.value;
    }
    const f=BonusPlan.fields(p);
    return editingId==='self'?{...f,bsiEligible:false}:{bsiEligible:f.bsiEligible};
  }
  function badge(p){return p?.id!=='self'&&BonusPlan.fields(p).bsiEligible?'<span class="bonus-bsi-badge" title="BSI対象としてチェック済み">BSI</span>':'';}
  function panel(state){
    const r=BonusPlan.calculate(state);
    const names={performance:'成績別',bsi:`BSI（${r.bsiCount}組）`,bronze9:'ブロンズ9',bronze15:'ブロンズ15',leadership:'リーダーシップ',monthlyQ:'月次Q強化',repeatOrder:'リピート・オーダー',other:'その他（手入力）'};
    return `<section class="bonus-summary" aria-label="計画上の収入（ボーナス）"><div class="bonus-summary-head"><span>計画上の収入（ボーナス）<small>月次・税込の参考試算</small></span><strong>${money(r.totalIncome)}</strong></div>
      <div class="bonus-breakdown">${Object.entries(r.items).filter(([k,v])=>v||['performance','bsi','bronze9','bronze15'].includes(k)).map(([k,v])=>`<span>${names[k]}<b>${money(v)}</b></span>`).join('')}</div>
      <p>計画PVから試算／成績別 ${r.percent}％／PV→BV 1.446 × 消費税10％（一律・円単位四捨五入）<br>BSI・ブロンズ等の定額は税込のため再加算なし。ブロンズは％・回数のみで判定。BSIは自分・対象先とも個人計画1万PV以上。</p>
      <p>年次・一時金・小売利益は対象外。ルビー・デプス・海外等は自動計算対象外（自分カードから手入力）。</p>
      ${r.warnings.map(w=>`<p class="bonus-warning">${w}</p>`).join('')}</section>`;
  }
  window.BonusUI={fill,gather,badge,panel};
})();
