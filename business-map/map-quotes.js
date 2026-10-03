/* Pick once per page opening; never change the quote while editing or exporting. */
(function(){
  const previousKey='business_map_quote_previous_v1';
  let selected=null;
  function current(){
    if(selected)return selected;
    const quotes=window.BUSINESS_MAP_QUOTES||[];
    if(!quotes.length)return null;
    let previous='';
    try{previous=localStorage.getItem(previousKey)||'';}catch(_){/* Storage may be unavailable. */}
    const alternatives=quotes.filter(q=>q.id!==previous);
    const pool=alternatives.length?alternatives:quotes;
    selected=pool[Math.floor(Math.random()*pool.length)];
    try{localStorage.setItem(previousKey,selected.id);}catch(_){}
    return selected;
  }
  function mount(stage){
    if(!stage)return;
    const q=current();if(!q)return;
    // Scope lookup to the live stage: export surfaces contain cloned IDs.
    if(stage.querySelector('.map-quote-panel'))return;
    const panel=document.createElement('aside');
    panel.id='mapQuotePanel';panel.className='map-quote-panel';
    panel.dataset.quoteId=q.id;panel.setAttribute('aria-label','今日のひと言');
    const append=(tag,className,text)=>{
      const el=document.createElement(tag);el.className=className;el.textContent=text;panel.appendChild(el);return el;
    };
    append('div','map-quote-heading','今日のひと言');
    append(q.kind==='発言要旨'?'p':'blockquote','map-quote-text',q.text);
    append('p','map-quote-author',q.author);
    append('span','map-quote-kind',q.kind==='発言要旨'?'発言要旨（短く要約）':q.kind);
    const link=append('a','map-quote-source','出典：'+q.sourceTitle+' ↗');
    link.href=q.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.title=q.context;
    panel.title=q.context;
    stage.prepend(panel);
  }
  window.MapQuotes=Object.freeze({current,mount});
})();
