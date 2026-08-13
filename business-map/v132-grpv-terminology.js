(function(){
  const APP_VERSION='v1.39';

  function apply(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function loadTerminologyPatch(){
    if(document.querySelector('script[data-v139-grpv]')) return;
    const s=document.createElement('script');
    s.src='v139-grpv-terminology.js?v=1.39';
    s.dataset.v139Grpv='1';
    s.async=false;
    document.body.appendChild(s);
  }

  function latestRefresh(){
    const url=new URL(window.location.href);
    url.searchParams.set('_refresh',String(Date.now()));
    window.location.replace(url.toString());
  }

  function resetMap(){
    const first=window.confirm('この端末のBusiness Mapを初期状態に戻します。\nメンバー・PV・メモなどの入力内容は消えます。\n\nSupabaseの「みんなのマップ」にアップロード済み画像は削除されません。\n\n実行しますか？');
    if(!first) return;
    const second=window.confirm('本当にリセットしますか？\n必要なら先に「JSON保存」でバックアップしてください。');
    if(!second) return;
    try{
      state={self:{...DEFAULT_SELF},members:[]};
      save();
    }catch(e){
      console.error(e);
      alert('リセットに失敗しました');
      return;
    }
    const url=new URL(window.location.href);
    url.searchParams.set('_refresh',String(Date.now()));
    url.searchParams.set('_reset','1');
    window.location.replace(url.toString());
  }

  function injectTopControls(){
    const actions=document.querySelector('.top-actions');
    if(!actions) return;
    if(!document.getElementById('latestRefreshBtn')){
      const refresh=document.createElement('button');
      refresh.className='btn';
      refresh.id='latestRefreshBtn';
      refresh.type='button';
      refresh.textContent='最新版に更新';
      refresh.addEventListener('click',latestRefresh);
      actions.insertBefore(refresh,actions.firstChild);
    }
    if(!document.getElementById('resetMapBtn')){
      const reset=document.createElement('button');
      reset.className='btn';
      reset.id='resetMapBtn';
      reset.type='button';
      reset.textContent='リセット';
      reset.style.color='#b91c1c';
      reset.style.borderColor='#fecaca';
      reset.style.background='#fff7f7';
      reset.addEventListener('click',resetMap);
      document.getElementById('latestRefreshBtn')?.insertAdjacentElement('afterend',reset);
    }
    if(!document.getElementById('v139TopControlStyle')){
      const style=document.createElement('style');
      style.id='v139TopControlStyle';
      style.textContent=`@media (max-width:720px){.top-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:7px;width:100%;margin-top:8px}.top-actions .btn{min-height:42px;padding:8px 10px;font-size:12px;white-space:nowrap}#latestRefreshBtn,#resetMapBtn{font-weight:800}}`;
      document.head.appendChild(style);
    }
  }

  async function bootstrapSupabase(){
    const cfg=window.BUSINESS_MAP_SUPABASE_CONFIG;
    if(!cfg?.url||!cfg?.publishableKey) return;
    try{
      const mod=await import('https://esm.sh/@supabase/supabase-js@2.111.0');
      const client=mod.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      let {data:{session},error}=await client.auth.getSession();
      if(error) throw error;
      if(!session){
        const signed=await client.auth.signInAnonymously();
        if(signed.error) throw signed.error;
        session=signed.data.session;
      }
      if(session?.user) window.BUSINESS_MAP_SUPABASE_BOOT={ok:true,userId:session.user.id,client};
    }catch(e){
      window.BUSINESS_MAP_SUPABASE_BOOT={ok:false,error:String(e?.message||e)};
    }
  }

  function boot(){
    apply();
    injectTopControls();
    bootstrapSupabase();
    loadTerminologyPatch();
    setTimeout(apply,100);
    setTimeout(apply,1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
