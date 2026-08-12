(function(){
  const APP_VERSION='v1.32';
  const RE=/group\s*pv/gi;

  function normalizeText(value){
    return String(value||'').replace(RE,'GrPV');
  }

  function normalizeNode(root){
    if(!root) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const next=normalizeText(node.nodeValue);
      if(next!==node.nodeValue) node.nodeValue=next;
    });
    if(root.querySelectorAll){
      root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el=>{
        ['title','aria-label','placeholder'].forEach(attr=>{
          if(!el.hasAttribute(attr)) return;
          const current=el.getAttribute(attr)||'';
          const next=normalizeText(current);
          if(next!==current) el.setAttribute(attr,next);
        });
      });
    }
  }

  function applyVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=document.querySelector('.brand small');
    if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }

  function bind(){
    applyVersion();
    normalizeNode(document.body);
    const observer=new MutationObserver(records=>{
      records.forEach(record=>{
        if(record.type==='characterData'){
          const next=normalizeText(record.target.nodeValue);
          if(next!==record.target.nodeValue) record.target.nodeValue=next;
          return;
        }
        record.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE){
            const next=normalizeText(node.nodeValue);
            if(next!==node.nodeValue) node.nodeValue=next;
          }else if(node.nodeType===Node.ELEMENT_NODE){
            normalizeNode(node);
          }
        });
      });
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    window.v132NormalizeGrPV=()=>normalizeNode(document.body);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
