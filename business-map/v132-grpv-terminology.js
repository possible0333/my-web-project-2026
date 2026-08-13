(function(){
  const APP_VERSION='v1.37';
  function apply(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }
  function loadShare(){
    if(!document.querySelector('link[data-v136-share]')){
      const link=document.createElement('link');
      link.rel='stylesheet'; link.href='v136-share.css?v=1.37'; link.dataset.v136Share='1';
      document.head.appendChild(link);
    }
    if(document.querySelector('script[data-v136-share]')) return;
    const loadMain=()=>{
      const s=document.createElement('script');
      s.src='v136-share.js?v=1.37'; s.dataset.v136Share='1'; s.async=false;
      document.body.appendChild(s);
    };
    const cfg=document.createElement('script');
    cfg.src='supabase-config.js?v=1.37'; cfg.dataset.v136Config='1'; cfg.async=false;
    cfg.onload=loadMain;
    cfg.onerror=loadMain;
    document.body.appendChild(cfg);
  }
  function boot(){ apply(); loadShare(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
