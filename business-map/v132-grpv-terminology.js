(function(){
  const APP_VERSION='v1.38';
  function apply(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }
  async function bootstrapSupabase(){
    const cfg=window.BUSINESS_MAP_SUPABASE_CONFIG;
    if(!cfg?.url||!cfg?.publishableKey){
      window.BUSINESS_MAP_SUPABASE_BOOT={ok:false,error:'Supabase設定が読み込まれていません'};
      return;
    }
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
      if(!session?.user) throw new Error('匿名ログインセッションを作成できませんでした');
      window.BUSINESS_MAP_SUPABASE_BOOT={ok:true,userId:session.user.id,client};
      console.info('[Business Map v1.38] Supabase connected',session.user.id);
    }catch(e){
      window.BUSINESS_MAP_SUPABASE_BOOT={ok:false,error:String(e?.message||e)};
      console.error('[Business Map v1.38] Supabase bootstrap failed',e);
    }
  }
  function boot(){
    apply();
    bootstrapSupabase();
    setTimeout(apply,100);
    setTimeout(apply,1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
