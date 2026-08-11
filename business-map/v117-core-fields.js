(function(){
  const PATCH_VERSION='v1.17';
  function refreshVersionLabel(){
    const small=document.querySelector('.brand small');
    if(small) small.textContent=PATCH_VERSION;
    document.title='Business Map v1.17';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',refreshVersionLabel,{once:true});
  else refreshVersionLabel();
})();
