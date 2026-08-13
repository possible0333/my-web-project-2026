(function(){
  const APP_VERSION='v1.36';
  const LOCAL_DB='business-map-shared-v136';
  const LOCAL_STORE='maps';
  let cloud=null;
  let uploadBlob=null;
  let uploadUrl='';

  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{
    const d=v instanceof Date?v:new Date(v||Date.now());
    if(Number.isNaN(d.getTime())) return '更新日時不明';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  function selfName(){
    try{
      if(typeof state!=='undefined'&&state?.self?.name) return String(state.self.name).trim();
    }catch(e){}
    const el=document.querySelector('#selfCard .card-name,#selfCard .v128-self-namewrap .card-name');
    return el?.textContent?.trim()||'名前未設定';
  }
  function applyVersion(){
    window.BUSINESS_MAP_VERSION=APP_VERSION;
    const small=$('.brand small'); if(small) small.textContent=APP_VERSION;
    document.title=`Business Map ${APP_VERSION}`;
  }
  function ownerKey(){
    let id=localStorage.getItem('businessMapShareOwnerId');
    if(!id){ id=(crypto.randomUUID?.()||`bm-${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem('businessMapShareOwnerId',id); }
    return id;
  }
  function hasFirebaseConfig(){
    const c=window.BUSINESS_MAP_FIREBASE_CONFIG;
    return !!(c&&typeof c==='object'&&c.apiKey&&c.projectId&&c.appId);
  }
  async function initCloud(){
    if(cloud) return cloud;
    if(!hasFirebaseConfig()) return null;
    const V='12.16.0';
    const [appM,authM,fsM,stM]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-storage.js`)
    ]);
    const app=appM.getApps().length?appM.getApp():appM.initializeApp(window.BUSINESS_MAP_FIREBASE_CONFIG);
    const auth=authM.getAuth(app);
    if(!auth.currentUser) await authM.signInAnonymously(auth);
    cloud={app,auth,fs:fsM.getFirestore(app),storage:stM.getStorage(app),appM,authM,fsM,stM};
    return cloud;
  }
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(LOCAL_DB,1);
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(LOCAL_STORE)) req.result.createObjectStore(LOCAL_STORE,{keyPath:'id'}); };
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function localPut(record,blob){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(LOCAL_STORE,'readwrite');
      tx.objectStore(LOCAL_STORE).put({...record,blob});
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
    });
  }
  async function localGetAll(){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(LOCAL_STORE,'readonly');
      const req=tx.objectStore(LOCAL_STORE).getAll();
      req.onsuccess=()=>resolve((req.result||[]).map(r=>({...r,imageUrl:URL.createObjectURL(r.blob),_localUrl:true})).sort((a,b)=>(b.clientUpdatedAt||0)-(a.clientUpdatedAt||0)));
      req.onerror=()=>reject(req.error);
    });
  }
  async function saveMap(record,blob){
    const c=await initCloud().catch(e=>{console.warn('[v1.36] Firebase init failed',e);return null;});
    if(!c){ await localPut(record,blob); return {mode:'local'}; }
    const uid=c.auth.currentUser.uid;
    const imageRef=c.stM.ref(c.storage,`business-maps/${uid}/latest.png`);
    await c.stM.uploadBytes(imageRef,blob,{contentType:'image/png',cacheControl:'public,max-age=300'});
    const imageUrl=await c.stM.getDownloadURL(imageRef);
    await c.fsM.setDoc(c.fsM.doc(c.fs,'businessMaps',uid),{
      ownerUid:uid,name:record.name,comment:record.comment||'',imageUrl,
      updatedAt:c.fsM.serverTimestamp(),clientUpdatedAt:Date.now(),version:APP_VERSION
    },{merge:true});
    return {mode:'cloud',imageUrl};
  }
  async function loadMaps(){
    const c=await initCloud().catch(e=>{console.warn('[v1.36] Firebase load failed',e);return null;});
    if(!c) return {mode:'local',items:await localGetAll()};
    const snap=await c.fsM.getDocs(c.fsM.collection(c.fs,'businessMaps'));
    const items=snap.docs.map(d=>{
      const x=d.data()||{};
      const when=x.updatedAt?.toDate?.()||new Date(x.clientUpdatedAt||0);
      return {id:d.id,...x,when};
    }).sort((a,b)=>(b.when?.getTime?.()||0)-(a.when?.getTime?.()||0));
    return {mode:'cloud',items};
  }
  function injectButtons(){
    const actions=$('.top-actions'); if(!actions) return;
    if(!$('#communityMapsBtn')){
      const b=document.createElement('button'); b.className='btn'; b.id='communityMapsBtn'; b.textContent='みんなのマップ';
      actions.insertBefore(b,actions.firstChild);
    }
    if(!$('#uploadMapBtn')){
      const b=document.createElement('button'); b.className='btn'; b.id='uploadMapBtn'; b.textContent='アップロード';
      const save=$('#saveImageBtn'); save?.insertAdjacentElement('afterend',b);
    }
  }
  function injectUi(){
    if($('#v136GalleryModal')) return;
    document.body.insertAdjacentHTML('beforeend',`
      <div class="v136-share-modal" id="v136GalleryModal"><div class="v136-share-sheet">
        <div class="v136-share-head"><div><div class="v136-share-title">みんなのマップ</div><div class="v136-share-sub">グループの最新Business Mapを一覧で確認</div></div><button class="btn ghost" data-v136-close="gallery">閉じる</button></div>
        <div class="v136-share-body"><div id="v136GalleryNotice"></div><div class="v136-share-toolbar"><input class="v136-share-search" id="v136Search" placeholder="名前で検索"><button class="btn" id="v136Reload">更新</button><span class="v136-share-state" id="v136GalleryState"></span></div><div class="v136-map-grid" id="v136MapGrid"></div></div>
      </div></div>
      <div class="v136-share-modal" id="v136UploadModal"><div class="v136-share-sheet" style="width:min(760px,100%)">
        <div class="v136-share-head"><div><div class="v136-share-title">マップをアップロード</div><div class="v136-share-sub">現在のマップを画像化して最新版として共有</div></div><button class="btn ghost" data-v136-close="upload">閉じる</button></div>
        <div class="v136-share-body"><div id="v136UploadNotice"></div><div class="v136-upload-box"><div class="v136-upload-grid"><div class="v136-field"><label>名前</label><input id="v136UploadName"></div><div class="v136-field"><label>更新日</label><input id="v136UploadDate" disabled></div><div class="v136-field full"><label>コメント</label><textarea id="v136UploadComment" maxlength="120" placeholder="例：8/13時点 / 今月の重点系列を更新"></textarea></div></div><div class="v136-upload-preview" id="v136UploadPreview"><span class="v136-share-state">プレビューを作成します</span></div><div class="v136-upload-actions"><button class="btn" id="v136Recreate">プレビュー再作成</button><button class="btn primary" id="v136DoUpload">このマップをアップロード</button></div></div></div>
      </div></div>
      <div class="v136-viewer" id="v136Viewer"><button class="btn ghost v136-viewer-close" id="v136ViewerClose">閉じる</button><img id="v136ViewerImg" alt="共有マップ"></div>`);
  }
  function noticeHtml(mode){
    return mode==='cloud'
      ? '<div class="v136-notice v136-cloud-ok">☁️ クラウド共有モード：アップロードしたマップは他のメンバーからも確認できます。</div>'
      : '<div class="v136-notice">🧪 ローカル確認モード：Firebase未設定のため、この端末内だけで共有画面を確認できます。Firebase設定後は自動で全員共有へ切り替わります。</div>';
  }
  function openModal(id){ $(id)?.classList.add('is-open'); }
  function closeModal(id){ $(id)?.classList.remove('is-open'); }
  async function createPreview(){
    const box=$('#v136UploadPreview');
    box.innerHTML='<div class="v136-spinner"></div>';
    try{
      if(typeof window.v135CreateBlob!=='function') throw new Error('画像作成機能が見つかりません');
      uploadBlob=await window.v135CreateBlob();
      if(uploadUrl) URL.revokeObjectURL(uploadUrl);
      uploadUrl=URL.createObjectURL(uploadBlob);
      box.innerHTML=`<img src="${uploadUrl}" alt="アップロードプレビュー">`;
    }catch(e){ box.innerHTML=`<div class="v136-empty">プレビュー作成に失敗しました<br>${esc(e.message||e)}</div>`; throw e; }
  }
  async function openUpload(){
    injectUi();
    $('#v136UploadName').value=selfName();
    $('#v136UploadDate').value=fmtDate(new Date());
    $('#v136UploadComment').value='';
    $('#v136UploadNotice').innerHTML=noticeHtml(hasFirebaseConfig()?'cloud':'local');
    openModal('#v136UploadModal');
    await createPreview().catch(()=>{});
  }
  function renderCards(items){
    const q=$('#v136Search')?.value?.trim().toLowerCase()||'';
    const filtered=items.filter(x=>!q||String(x.name||'').toLowerCase().includes(q));
    const grid=$('#v136MapGrid');
    if(!filtered.length){ grid.innerHTML='<div class="v136-empty" style="grid-column:1/-1">共有されたマップはまだありません。</div>'; return; }
    grid.innerHTML=filtered.map((x,i)=>`<article class="v136-map-card" data-v136-i="${i}"><div class="v136-map-thumb" data-v136-view="${esc(x.imageUrl)}"><img src="${esc(x.imageUrl)}" alt="${esc(x.name)}のマップ" loading="lazy"></div><div class="v136-map-meta"><div class="v136-map-name">${esc(x.name||'名前未設定')}</div><div class="v136-map-date">更新：${esc(fmtDate(x.when||x.clientUpdatedAt))}</div><div class="v136-map-comment">${esc(x.comment||'')}</div><div class="v136-map-actions"><button class="btn" data-v136-view="${esc(x.imageUrl)}">マップを見る</button></div></div></article>`).join('');
  }
  let currentItems=[];
  async function refreshGallery(){
    const grid=$('#v136MapGrid'); const stateEl=$('#v136GalleryState');
    grid.innerHTML='<div class="v136-empty" style="grid-column:1/-1"><div class="v136-spinner" style="margin:auto"></div></div>';
    stateEl.textContent='読み込み中…';
    try{
      const result=await loadMaps(); currentItems=result.items;
      $('#v136GalleryNotice').innerHTML=noticeHtml(result.mode);
      renderCards(currentItems); stateEl.textContent=`${currentItems.length}件`;
    }catch(e){
      console.error(e); grid.innerHTML=`<div class="v136-empty" style="grid-column:1/-1">読み込みに失敗しました<br>${esc(e.message||e)}</div>`; stateEl.textContent='';
    }
  }
  async function openGallery(){ injectUi(); openModal('#v136GalleryModal'); await refreshGallery(); }
  async function doUpload(){
    const btn=$('#v136DoUpload');
    const name=$('#v136UploadName').value.trim(); const comment=$('#v136UploadComment').value.trim();
    if(!name){ alert('名前を入力してください'); return; }
    if(!uploadBlob) await createPreview();
    const old=btn.textContent; btn.disabled=true; btn.textContent='アップロード中…';
    try{
      const result=await saveMap({id:ownerKey(),name,comment,clientUpdatedAt:Date.now(),when:new Date()},uploadBlob);
      localStorage.setItem('businessMapShareName',name);
      alert(result.mode==='cloud'?'みんなのマップへアップロードしました！':'この端末の「みんなのマップ」に保存しました。\nFirebase設定後は全員共有になります。');
      closeModal('#v136UploadModal');
      await openGallery();
    }catch(e){ console.error(e); alert(`アップロードに失敗しました。\n${e.message||e}`); }
    finally{ btn.disabled=false; btn.textContent=old; }
  }
  function bind(){
    applyVersion(); injectButtons(); injectUi();
    $('#communityMapsBtn').onclick=openGallery; $('#uploadMapBtn').onclick=openUpload;
    $('#v136Reload').onclick=refreshGallery; $('#v136Recreate').onclick=()=>createPreview().catch(()=>{}); $('#v136DoUpload').onclick=doUpload;
    $('#v136Search').addEventListener('input',()=>renderCards(currentItems));
    document.addEventListener('click',e=>{
      const close=e.target.closest('[data-v136-close]');
      if(close) closeModal(close.dataset.v136Close==='gallery'?'#v136GalleryModal':'#v136UploadModal');
      const view=e.target.closest('[data-v136-view]');
      if(view){ $('#v136ViewerImg').src=view.dataset.v136View; $('#v136Viewer').classList.add('is-open'); }
      if(e.target.classList?.contains('v136-share-modal')) e.target.classList.remove('is-open');
    });
    $('#v136ViewerClose').onclick=()=>$('#v136Viewer').classList.remove('is-open');
    $('#v136Viewer').addEventListener('click',e=>{ if(e.target.id==='v136Viewer') e.currentTarget.classList.remove('is-open'); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
