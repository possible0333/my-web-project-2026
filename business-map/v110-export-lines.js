(function(){
  const VERSION='v1.10';

  function redrawExportLines(root){
    const scope=root||document.getElementById('exportRoot');
    if(!scope) return;
    const map=scope.querySelector('#mapCanvasArea');
    const svg=scope.querySelector('#treeLines');
    const rows=scope.querySelector('#treeRows');
    if(!map||!svg||!rows) return;

    map.style.zoom='1';
    map.style.transform='none';
    const mapRect=map.getBoundingClientRect();
    const cards={};
    rows.querySelectorAll('.member-card').forEach(card=>{ cards[card.dataset.id]=card; });

    const width=Math.max(map.scrollWidth,rows.scrollWidth,map.offsetWidth,900);
    const height=Math.max(map.scrollHeight,rows.scrollHeight,map.offsetHeight,400);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('width',width);
    svg.setAttribute('height',height);
    svg.style.width=width+'px';
    svg.style.height=height+'px';

    let paths='';
    state.members.forEach(ch=>{
      const child=cards[ch.id];
      const parent=cards[ch.parentId||'self'];
      if(!child||!parent) return;
      const cr=child.getBoundingClientRect();
      const pr=parent.getBoundingClientRect();
      const x1=pr.left-mapRect.left+pr.width/2;
      const y1=pr.top-mapRect.top+pr.height;
      const x2=cr.left-mapRect.left+cr.width/2;
      const y2=cr.top-mapRect.top;
      const mid=Math.round(y1+(y2-y1)*.48);
      const dir=x2>=x1?1:-1;
      const r=8;
      paths+=`<path d="M ${x1} ${y1} L ${x1} ${mid-r} Q ${x1} ${mid} ${x1+r*dir} ${mid} L ${x2-r*dir} ${mid} Q ${x2} ${mid} ${x2} ${mid+r} L ${x2} ${y2}" fill="none" stroke="#9eb0c8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
      paths+=`<circle cx="${x1}" cy="${y1}" r="2.8" fill="#9eb0c8"/><circle cx="${x2}" cy="${y2}" r="2.8" fill="#9eb0c8"/>`;
    });
    svg.innerHTML=paths;
  }

  const previousBuild=window.buildExportSurface;
  window.buildExportSurface=function(){
    const root=previousBuild();
    const title=root.querySelector('.v109-export-title span');
    if(title) title.textContent=VERSION;
    redrawExportLines(root);
    requestAnimationFrame(()=>requestAnimationFrame(()=>redrawExportLines(root)));
    return root;
  };

  window.redrawExportLines=redrawExportLines;
})();