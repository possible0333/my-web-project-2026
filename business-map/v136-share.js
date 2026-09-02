(function(){
  const APP_VERSION=window.BUSINESS_MAP_CONFIG?.version||'v1.44';
  const LOCAL_DB='business-map-shared-v137';
  const LOCAL_STORE='maps';
  const BUCKET='business-maps';
  const TABLE='business_maps';
  let supa=null;
  let uploadBlob=null;
  let uploadSvgBlob=null;
  let uploadUrl='';
  let currentItems=[];
  let currentMode='cloud';
  const selectedIds=new Set();
  let adminMode=false;
  let adminPassword='';

  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{
    const d=v instanceof Date?v:new Date(v||Date.now());
    if(Number.isNaN(d.getTime())) return '更新日時不明';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  function selfName(){
    try{ if(typeof state!=='undefined'&&state?.self?.name) return String(state.self.name).trim(); }catch(e){}
    const el=document.querySelector('#selfCard .card-name,#selfCard .v128-self-namewrap .card-name');
    return el?.textContent?.trim()||localStorage.getItem('businessMapShareName')||'名前未設定';
  }

  function deadlineInfo(value){
    const raw=String(value||'').trim();
    if(!raw) return {raw:'',date:null,state:'none',days:null};
    let year,month,day,m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const now=new Date();
    if(m){ year=Number(m[1]); month=Number(m[2]); day=Number(m[3]); }
    else {
      m=raw.match(/^(\d{1,2})[-\/](\d{1,2})$/);
      if(!m) return {raw,date:null,state:'invalid',days:null};
      year=now.getFullYear(); month=Number(m[1]); day=Number(m[2]);
    }
    const due=new Date(year,month-1,day);
    if(due.getFullYear()!==year||due.getMonth()!==month-1||due.getDate()!==day) return {raw,date:null,state:'invalid',days:null};
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const days=Math.round((due-today)/86400000);
    return {
      raw,
      date:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      state:days<0?'overdue':days===0?'today':days<=3?'soon':'future',
      days
    };
  }

  function sharedPerson(p){
    const due=deadlineInfo(p?.deadline);
    return {
      id:String(p?.id||''),
      name:String(p?.name||'名称未設定'),
      type:String(p?.type||''),
      parentId:p?.parentId==null?null:String(p.parentId),
      status:String(p?.status||''),
      statusLabel:typeof currentStatusLabel==='function'?currentStatusLabel(p):String(p?.status||''),
      targetPv:Number(p?.target||0),
      actualPv:Number(p?.actual||0),
      avatar:Number.isInteger(Number(p?.avatar))&&Number(p.avatar)>=0&&Number(p.avatar)<36?Number(p.avatar):null,
      avatarUrl:Number.isInteger(Number(p?.avatar))&&Number(p.avatar)>=0&&Number(p.avatar)<36?`icons/avatar-${String(Number(p.avatar)+1).padStart(2,'0')}.webp?v=20260810e`:'',
      age:String(p?.age||''),
      job:String(p?.job||''),
      hobby:String(p?.hobby||''),
      etc:String(p?.etc||''),
      memo1:String(p?.memo1||''),
      memo2:String(p?.memo2||''),
      memo3:String(p?.memo3||''),
      memos:[p?.memo1,p?.memo2,p?.memo3].map(v=>String(v||'')).filter(Boolean),
      deadline:due,
      nextAction:String(p?.nextAction||''),
      monthlyTargetPv:Number(p?.monthlyTargetPv||0),
      frontUpGoal:Number(p?.frontUpGoal||0),
      groupUpGoal:Number(p?.groupUpGoal||0),
      focus1:String(p?.focus1||''),
      focus2:String(p?.focus2||''),
      focus3:String(p?.focus3||''),
      sharedSourceUserId:String(p?.sharedSourceUserId||''),
      sharedSourcePersonId:String(p?.sharedSourcePersonId||'')
    };
  }

  function buildOperationalMapData(){
    const people=[sharedPerson(state.self),...(state.members||[]).map(sharedPerson)];
    const gp=typeof groupPvFor==='function'?groupPvFor('self'):{target:0,actual:0};
    const reminders=people.filter(p=>p.id!=='self'&&['overdue','today','soon'].includes(p.deadline.state));
    return {
      schema:'business-map-operational',
      schemaVersion:1,
      generatedAt:new Date().toISOString(),
      appVersion:APP_VERSION,
      owner:{id:'self',name:String(state.self?.name||'自分')},
      summary:{
        peopleCount:people.length,
        targetGrPv:Number(gp?.target||0),
        actualGrPv:Number(gp?.actual||0),
        monthlyTargetPv:Number(state.self?.monthlyTargetPv||0),
        remainingPv:Math.max(0,Number(state.self?.monthlyTargetPv||0)-Number(gp?.actual||0)),
        frontUpGoal:Number(state.self?.frontUpGoal||0),
        groupUpGoal:Number(state.self?.groupUpGoal||0),
        overdueCount:reminders.filter(x=>x.deadline.state==='overdue').length,
        dueTodayCount:reminders.filter(x=>x.deadline.state==='today').length,
        dueSoonCount:reminders.filter(x=>x.deadline.state==='soon').length,
        nextMonthCount:people.filter(x=>x.status==='next-month').length
      },
      people,
      reminders
    };
  }

  function buildReminderSummary(mapData){
    return {
      overdue:Number(mapData?.summary?.overdueCount||0),
      dueToday:Number(mapData?.summary?.dueTodayCount||0),
      dueSoon:Number(mapData?.summary?.dueSoonCount||0),
      generatedAt:mapData?.generatedAt||new Date().toISOString()
    };
  }

  function downloadGroupJson(){
    const maps=currentItems.map(x=>({
      userId:x.id,
      name:x.name,
      comment:x.comment||'',
      updatedAt:x.when instanceof Date?x.when.toISOString():new Date(x.when||x.clientUpdatedAt||Date.now()).toISOString(),
      appVersion:x.version||'',
      dataSchemaVersion:Number(x.dataSchemaVersion||1),
      reminderSummary:x.reminderSummary||{},
      mapData:x.mapData||{},
      scheduleData:x.scheduleData||{}
    }));
    const totals=maps.reduce((a,x)=>{
      const s=x.mapData?.summary||x.reminderSummary||{};
      a.maps+=1;
      a.people+=Number(s.peopleCount||0);
      a.overdue+=Number(s.overdueCount??s.overdue??0);
      a.dueToday+=Number(s.dueTodayCount??s.dueToday??0);
      a.dueSoon+=Number(s.dueSoonCount??s.dueSoon??0);
      return a;
    },{maps:0,people:0,overdue:0,dueToday:0,dueSoon:0});
    const payload={schema:'business-map-group-export',schemaVersion:1,exportedAt:new Date().toISOString(),totals,maps};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`business-map-group-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
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

  function hasSupabaseConfig(){
    const c=window.BUSINESS_MAP_SUPABASE_CONFIG;
    return !!(c&&c.url&&c.publishableKey);
  }

  async function initSupabase(){
    if(supa) return supa;
    if(!hasSupabaseConfig()) return null;
    if(window.BUSINESS_MAP_SUPABASE_READY){
      await window.BUSINESS_MAP_SUPABASE_READY.catch(()=>null);
      const boot=window.BUSINESS_MAP_SUPABASE_BOOT;
      if(boot?.ok&&boot.client&&boot.userId){
        supa={client:boot.client,user:{id:boot.userId}};
        return supa;
      }
      if(boot?.ok===false) return null;
    }
    const mod=await import('https://esm.sh/@supabase/supabase-js@2.111.0');
    const cfg=window.BUSINESS_MAP_SUPABASE_CONFIG;
    const client=mod.createClient(cfg.url,cfg.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    let {data:{session},error}=await client.auth.getSession();
    if(error) throw error;
    if(!session){
      const signed=await client.auth.signInAnonymously();
      if(signed.error) throw signed.error;
      session=signed.data.session;
    }
    if(!session?.user) throw new Error('Supabase匿名ログインを有効にしてください');
    supa={client,user:session.user};
    return supa;
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
      req.onsuccess=()=>resolve((req.result||[]).map(r=>({...r,imageUrl:URL.createObjectURL(r.blob),imagePath:'',fallbackUrl:'',isSvg:String(r.blob?.type||'').includes('svg'),owned:true,_localUrl:true})).sort((a,b)=>(b.clientUpdatedAt||0)-(a.clientUpdatedAt||0)));
      req.onerror=()=>reject(req.error);
    });
  }

  async function localDelete(ids){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(LOCAL_STORE,'readwrite');
      ids.forEach(id=>tx.objectStore(LOCAL_STORE).delete(id));
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
    });
  }

  async function ensureUploadPng(blob){
    if(blob?.type==='image/png') return blob;
    const bitmap=await createImageBitmap(blob);
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    canvas.getContext('2d').drawImage(bitmap,0,0);
    bitmap.close?.();
    return await new Promise((resolve,reject)=>canvas.toBlob(
      value=>value?resolve(value):reject(new Error('PNG変換に失敗しました')),
      'image/png',
      1
    ));
  }

  async function createUploadFallback(blob){
    const bitmap=await createImageBitmap(blob);
    const targetBytes=5.5*1024*1024;
    let scale=Math.min(1,Math.sqrt(targetBytes/Math.max(1,blob.size))*.94);
    const encode=async()=>{
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('再試行画像の作成に失敗しました')),
        'image/png',
        1
      ));
    };
    let out=await encode();
    for(let i=0;i<2&&out.size>targetBytes;i++){
      scale*=Math.max(.7,Math.min(.93,Math.sqrt(targetBytes/out.size)*.94));
      out=await encode();
    }
    bitmap.close?.();
    return out;
  }

  async function saveMap(record,blob,svgBlob,mapData,scheduleData){
    blob=await ensureUploadPng(blob);
    const s=await initSupabase().catch(e=>{console.warn(`[${APP_VERSION}] Supabase init failed`,e);return null;});
    if(!s){ await localPut({...record,mapData,scheduleData,dataSchemaVersion:mapData?.schemaVersion||1,reminderSummary:buildReminderSummary(mapData)},svgBlob||blob); return {mode:'local'}; }

    const uid=s.user.id;
    const imageType=blob.type==='image/webp'?'image/webp':'image/png';
    const extension=imageType==='image/webp'?'webp':'png';
    const path=`${uid}/latest.${extension}`;
    let uploadBlob=blob;
    let uploaded=await s.client.storage.from(BUCKET).upload(path,uploadBlob,{
      contentType:imageType,cacheControl:'300',upsert:true
    });
    if(uploaded.error&&uploadBlob.size>6*1024*1024){
      console.warn(`[${APP_VERSION}] high resolution upload retry`,uploaded.error);
      uploadBlob=await createUploadFallback(uploadBlob);
      uploaded=await s.client.storage.from(BUCKET).upload(path,uploadBlob,{
        contentType:'image/png',cacheControl:'300',upsert:true
      });
    }
    if(uploaded.error) throw uploaded.error;

    const publicData=s.client.storage.from(BUCKET).getPublicUrl(path);
    const pngUrl=`${publicData.data.publicUrl}?v=${Date.now()}`;
    let svgUrl='',svgPath='';
    if(svgBlob?.type?.includes('svg')){
      svgPath=`${uid}/latest.svg`;
      const svgUploaded=await s.client.storage.from(BUCKET).upload(svgPath,svgBlob,{contentType:'image/svg+xml',cacheControl:'300',upsert:true});
      if(svgUploaded.error){ console.warn(`[${APP_VERSION}] SVG upload fallback to PNG`,svgUploaded.error); svgPath=''; }
      else svgUrl=`${s.client.storage.from(BUCKET).getPublicUrl(svgPath).data.publicUrl}?v=${Date.now()}`;
    }
    const imageUrl=svgUrl||pngUrl;
    mapData={...mapData,assets:{...(mapData?.assets||{}),svgUrl,svgPath,pngUrl,pngPath:path,preferred:svgUrl?'svg':'png'}};
    const row={
      user_id:uid,
      name:record.name,
      comment:record.comment||'',
      image_path:svgPath||path,
      image_url:imageUrl,
      client_updated_at:Date.now(),
      updated_at:new Date().toISOString(),
      version:APP_VERSION,
      map_data:mapData,
      data_schema_version:Number(mapData?.schemaVersion||1),
      reminder_summary:buildReminderSummary(mapData),
      schedule_data:scheduleData||{}
    };
    const saved=await s.client.from(TABLE).upsert(row,{onConflict:'user_id'});
    if(saved.error) throw saved.error;
    return {mode:'cloud',imageUrl,pngUrl,svgUrl};
  }

  async function loadMaps(){
    const s=await initSupabase().catch(e=>{console.warn(`[${APP_VERSION}] Supabase load failed`,e);return null;});
    if(!s) return {mode:'local',items:await localGetAll()};
    const res=await s.client.from(TABLE).select('user_id,name,comment,image_path,image_url,client_updated_at,updated_at,version,map_data,data_schema_version,reminder_summary,schedule_data').order('client_updated_at',{ascending:false});
    if(res.error) throw res.error;
    const items=(res.data||[]).map(x=>({
      id:x.user_id,
      name:x.name,
      comment:x.comment||'',
      imagePath:x.image_path||'',
      imageUrl:x.image_url,
      fallbackUrl:x.map_data?.assets?.pngUrl||'',
      isSvg:x.map_data?.assets?.preferred==='svg'||/\.svg(?:\?|$)/i.test(x.image_url||''),
      clientUpdatedAt:x.client_updated_at,
      when:new Date(x.updated_at||x.client_updated_at||Date.now()),
      version:x.version,
      mapData:x.map_data||{},
      dataSchemaVersion:x.data_schema_version||1,
      reminderSummary:x.reminder_summary||{},
      scheduleData:x.schedule_data||{},
      owned:x.user_id===s.user.id
    }));
    return {mode:'cloud',items};
  }

  function injectButtons(){
    const actions=$('.top-actions'); if(!actions) return;
    if(!$('#communityMapsBtn')){
      const b=document.createElement('button'); b.className='btn'; b.id='communityMapsBtn'; b.textContent='みんなのマップ／スケジュール';
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
        <div class="v136-share-head"><div><div class="v136-share-title">みんなのマップ／スケジュール</div><div class="v136-share-sub">全員の最新マップと今月・来月の予定を確認</div></div><button class="btn ghost" data-v136-close="gallery">閉じる</button></div>
        <div class="v136-share-body"><div id="v136GalleryNotice"></div><div class="v159-adminbar"><button class="btn" id="v159AdminBtn">🔒 管理者モード</button><span id="v159AdminState">通常モード</span></div><div class="v156-group-tabs"><button class="active" data-v156-gallery="maps">マップ一覧</button><button data-v156-gallery="schedule">みんなのスケジュール</button></div><div id="v136MapListPanel"><div class="v136-share-toolbar"><input class="v136-share-search" id="v136Search" placeholder="名前で検索"><button class="btn" id="v136Reload">更新</button><button class="btn" id="v136DownloadJson">全員JSON保存</button><button class="btn danger v136-delete-selected" id="v136DeleteSelected" disabled>選択削除（0）</button><span class="v136-share-state" id="v136GalleryState"></span></div><div class="v136-delete-guide">自分がアップロードしたマップのみ選択して削除できます。</div><div class="v136-map-grid" id="v136MapGrid"></div></div><div id="v156GroupSchedule" hidden></div></div>
      </div></div>
      <div class="v136-share-modal" id="v136UploadModal"><div class="v136-share-sheet" style="width:min(760px,100%)">
        <div class="v136-share-head"><div><div class="v136-share-title">マップとスケジュールをアップロード</div><div class="v136-share-sub">現在のMAP画像・MAP JSON・スケジュールをまとめて共有</div></div><button class="btn ghost" data-v136-close="upload">閉じる</button></div>
        <div class="v136-share-body"><div id="v136UploadNotice"></div><div class="v136-upload-box"><div class="v136-upload-grid"><div class="v136-field"><label>名前</label><input id="v136UploadName"></div><div class="v136-field"><label>更新日</label><input id="v136UploadDate" disabled></div><div class="v136-field full"><label>コメント</label><textarea id="v136UploadComment" maxlength="120" placeholder="例：8/13時点 / 今月の重点系列を更新"></textarea></div></div><div class="v136-upload-preview" id="v136UploadPreview"><span class="v136-share-state">プレビューを作成します</span></div><div class="v136-upload-actions"><button class="btn" id="v136Recreate">プレビュー再作成</button><button class="btn primary" id="v136DoUpload">MAPとスケジュールをアップロード</button></div></div></div>
      </div></div>
      <div class="v136-viewer" id="v136Viewer"><div class="v167-viewer-stage" id="v167ViewerStage"><img id="v136ViewerImg" alt="共有マップ" draggable="false"></div><div class="v167-viewer-toolbar" role="toolbar" aria-label="マップの拡大縮小"><button class="btn ghost v167-zoom-button" id="v167ZoomOut" type="button" aria-label="縮小">−</button><span class="v167-zoom-value" id="v167ZoomValue" aria-live="polite">100%</span><button class="btn ghost v167-zoom-button" id="v167ZoomIn" type="button" aria-label="拡大">＋</button><button class="btn ghost v167-fit-button" id="v167ZoomFit" type="button">全体</button><button class="btn ghost v136-viewer-close" id="v136ViewerClose" type="button">閉じる</button></div></div>`);
  }

  function noticeHtml(mode){
    return mode==='cloud'
      ? '<div class="v136-notice v136-cloud-ok">☁️ Supabase共有モード：アップロードしたマップは他のメンバーからも確認できます。</div>'
      : '<div class="v136-notice">🧪 ローカル確認モード：Supabaseのテーブル・Storage・匿名認証設定が未完了、または接続できないため、この端末内だけで表示しています。</div>';
  }

  function openModal(id){ $(id)?.classList.add('is-open'); }
  function closeModal(id){ $(id)?.classList.remove('is-open'); }

  async function createPreview(){
    const box=$('#v136UploadPreview');
    box.innerHTML='<div class="v136-spinner"></div>';
    try{
      const maker=window.v135CreateUploadBlob||window.v135CreateBlob;
      if(typeof maker!=='function') throw new Error('画像作成機能が見つかりません');
      uploadBlob=await maker();
      const svgMaker=window.v177CreateSvgBlob;
      uploadSvgBlob=null;
      if(typeof svgMaker==='function'){
        try{ uploadSvgBlob=await svgMaker(); }
        catch(svgError){ console.warn(`[${APP_VERSION}] SVG preview fallback to PNG`,svgError); }
      }
      if(uploadUrl) URL.revokeObjectURL(uploadUrl);
      uploadUrl=URL.createObjectURL(uploadBlob);
      box.innerHTML=`<img src="${uploadUrl}" alt="アップロードプレビュー"><span class="v136-share-state">${uploadSvgBlob?`SVG優先表示＋高画質PNG互換（SVG ${(uploadSvgBlob.size/1024/1024).toFixed(1)}MB / PNG ${(uploadBlob.size/1024/1024).toFixed(1)}MB）`:`高画質PNG互換表示（${(uploadBlob.size/1024/1024).toFixed(1)}MB）`}</span>`;
    }catch(e){
      box.innerHTML=`<div class="v136-empty">プレビュー作成に失敗しました<br>${esc(e.message||e)}</div>`;
      throw e;
    }
  }

  async function openUpload(){
    injectUi();
    $('#v136UploadName').value=selfName();
    $('#v136UploadDate').value=fmtDate(new Date());
    $('#v136UploadComment').value='';
    $('#v136UploadNotice').innerHTML=noticeHtml(hasSupabaseConfig()?'cloud':'local');
    openModal('#v136UploadModal');
    await createPreview().catch(()=>{});
  }

  function renderCards(items){
    const q=$('#v136Search')?.value?.trim().toLowerCase()||'';
    const filtered=items.filter(x=>!q||String(x.name||'').toLowerCase().includes(q));
    const grid=$('#v136MapGrid');
    updateDeleteButton();
    if(!filtered.length){ grid.innerHTML='<div class="v136-empty" style="grid-column:1/-1">共有されたマップはまだありません。</div>'; return; }
    grid.innerHTML=filtered.map(x=>{const hasJson=Array.isArray(x.mapData?.people)&&x.mapData.people.length;const branchMode=typeof window.v179SharedFrontMode==='function'?window.v179SharedFrontMode(x.id):'add';return `<article class="v136-map-card${selectedIds.has(x.id)?' is-selected':''}" data-v136-map-id="${esc(x.id)}">${(x.owned||adminMode)?`<label class="v136-map-select"><input type="checkbox" data-v136-select="${esc(x.id)}" ${selectedIds.has(x.id)?'checked':''}><span>選択</span></label>`:''}<div class="v136-map-thumb" data-v136-view="${esc(x.imageUrl)}" data-v136-fallback="${esc(x.fallbackUrl||'')}" data-v136-vector="${x.isSvg?'1':'0'}"><img src="${esc(x.imageUrl)}" data-v136-fallback="${esc(x.fallbackUrl||'')}" alt="${esc(x.name)}のマップ" loading="lazy"></div><div class="v136-map-meta"><div class="v136-map-name">${esc(x.name||'名前未設定')}</div><div class="v136-map-date">更新：${esc(fmtDate(x.when||x.clientUpdatedAt))}</div><div class="v136-map-comment">${esc(x.comment||'')}</div><div class="v136-map-actions"><button class="btn" data-v136-view="${esc(x.imageUrl)}" data-v136-fallback="${esc(x.fallbackUrl||'')}" data-v136-vector="${x.isSvg?'1':'0'}">マップを見る</button>${hasJson?`<button class="btn dark" data-v179-add-front="${esc(x.id)}">${branchMode==='update'?'系列を更新':'フロント追加'}</button><button class="btn" data-v178-restore="${esc(x.id)}">全体読込</button>`:''}</div></div></article>`;}).join('');
    grid.querySelectorAll('img[data-v136-fallback]').forEach(img=>img.addEventListener('error',()=>{const fallback=img.dataset.v136Fallback;if(fallback&&img.src!==fallback)img.src=fallback;},{once:true}));
  }

  function updateDeleteButton(){
    const btn=$('#v136DeleteSelected');
    if(!btn) return;
    btn.disabled=selectedIds.size===0;
    btn.textContent=`選択削除（${selectedIds.size}）`;
  }

  async function deleteSelectedMaps(){
    const owned=currentItems.filter(x=>selectedIds.has(x.id)&&(x.owned||adminMode));
    if(!owned.length){ selectedIds.clear(); updateDeleteButton(); return; }
    if(!confirm(`選択した${owned.length}件の共有MAP・スケジュールを削除します。\nこの操作は元に戻せません。`)) return;
    const btn=$('#v136DeleteSelected');
    btn.disabled=true; btn.textContent='削除中…';
    try{
      if(currentMode==='local'){
        await localDelete(owned.map(x=>x.id));
      }else{
        const s=await initSupabase();
        if(adminMode){
          const deleted=await s.client.functions.invoke('admin-delete-business-maps',{body:{password:adminPassword,userIds:owned.map(x=>x.id)}});
          if(deleted.error) throw deleted.error;
          if(Number(deleted.data?.deleted||0)!==owned.length) throw new Error('管理者削除件数を確認できませんでした');
        }else{
          const mine=owned.filter(x=>x.id===s.user.id);
          if(mine.length!==owned.length) throw new Error('削除権限を確認できないマップが含まれています');
          const paths=[...new Set(mine.flatMap(x=>[x.imagePath,x.mapData?.assets?.svgPath,x.mapData?.assets?.pngPath]).filter(Boolean))];
          if(paths.length){ const removed=await s.client.storage.from(BUCKET).remove(paths); if(removed.error) throw removed.error; }
          const deleted=await s.client.from(TABLE).delete().in('user_id',mine.map(x=>x.id)).eq('user_id',s.user.id).select('user_id');
          if(deleted.error) throw deleted.error;
          if((deleted.data||[]).length!==mine.length) throw new Error('削除対象を確認できませんでした');
        }
      }
      selectedIds.clear();
      await refreshGallery();
    }catch(e){
      console.error(e);
      const raw=String(e?.message||e||'');
      const message=/storage tables|Storage API/i.test(raw)?'共有データの削除方法を更新しています。ページを再読み込みして、もう一度お試しください。':raw;
      alert(`削除に失敗しました。\n${message}`);
      updateDeleteButton();
    }
  }

  async function toggleAdmin(){
    if(adminMode){ adminMode=false; adminPassword=''; selectedIds.clear(); updateAdminUi(); renderCards(currentItems); window.v156RenderGroupSchedules?.(currentItems); return; }
    const password=prompt('管理者パスワードを入力してください');
    if(password==null) return;
    try{
      const s=await initSupabase(); const checked=await s.client.rpc('admin_verify_business_maps',{p_password:password});
      if(checked.error||checked.data!==true) throw checked.error||new Error('パスワードが違います');
      adminMode=true; adminPassword=password; selectedIds.clear(); updateAdminUi(); renderCards(currentItems); window.v156RenderGroupSchedules?.(currentItems);
    }catch(e){ alert('管理者モードに入れません。パスワードを確認してください。'); }
  }
  function updateAdminUi(){ const b=$('#v159AdminBtn'),st=$('#v159AdminState'); if(b)b.textContent=adminMode?'🔓 管理者モードを終了':'🔒 管理者モード'; if(st)st.textContent=adminMode?'管理者モード：全員を選択削除できます':'通常モード'; $('.v136-delete-guide')?.replaceChildren(document.createTextNode(adminMode?'管理者として選択した共有MAP・スケジュールを削除できます。':'自分がアップロードしたマップのみ選択して削除できます。')); }
  async function refreshGallery(){
    const grid=$('#v136MapGrid'); const stateEl=$('#v136GalleryState');
    grid.innerHTML='<div class="v136-empty" style="grid-column:1/-1"><div class="v136-spinner" style="margin:auto"></div></div>';
    stateEl.textContent='読み込み中…';
    try{
      const result=await loadMaps(); currentMode=result.mode; currentItems=result.items;
      selectedIds.clear();
      $('#v136GalleryNotice').innerHTML=noticeHtml(result.mode);
      renderCards(currentItems); window.v156RenderGroupSchedules?.(currentItems); stateEl.textContent=`${currentItems.length}件`;
    }catch(e){
      console.error(e);
      grid.innerHTML=`<div class="v136-empty" style="grid-column:1/-1">読み込みに失敗しました<br>${esc(e.message||e)}</div>`;
      stateEl.textContent='';
    }
  }

  async function openGallery(){ injectUi(); openModal('#v136GalleryModal'); await refreshGallery(); }

  async function doUpload(){
    const btn=$('#v136DoUpload');
    const name=$('#v136UploadName').value.trim();
    const comment=$('#v136UploadComment').value.trim();
    if(!name){ alert('名前を入力してください'); return; }
    if(!uploadBlob) await createPreview();
    const old=btn.textContent; btn.disabled=true; btn.textContent='アップロード中…';
    try{
      const mapData=buildOperationalMapData();
      const scheduleData=typeof window.v156BuildScheduleData==='function'?window.v156BuildScheduleData():{};
      const result=await saveMap({id:ownerKey(),name,comment,clientUpdatedAt:Date.now(),when:new Date()},uploadBlob,uploadSvgBlob,mapData,scheduleData);
      localStorage.setItem('businessMapShareName',name);
      alert(result.mode==='cloud'?'MAPとスケジュールを共有しました！':'この端末にMAPとスケジュールを保存しました。\nSupabase設定完了後は全員共有になります。');
      closeModal('#v136UploadModal');
      await openGallery();
    }catch(e){
      console.error(e);
      alert(`アップロードに失敗しました。\n${e.message||e}`);
    }finally{
      btn.disabled=false; btn.textContent=old;
    }
  }

  function restoreCloudMap(id){
    const item=currentItems.find(x=>String(x.id)===String(id));
    if(!item?.mapData?.people?.length){ alert('このマップには復元できるJSONデータがありません。'); return; }
    const ok=confirm(`${item.name||'選択したメンバー'}のMAP JSONをこの端末へ読み込みます。\n\n現在の個人マップは端末内へ自動バックアップしてから置き換えます。実行しますか？`);
    if(!ok) return;
    try{
      if(typeof window.v178RestoreCloudMap!=='function') throw new Error('JSON復元機能が読み込まれていません');
      const result=window.v178RestoreCloudMap(item.mapData,item.scheduleData||{});
      closeModal('#v136GalleryModal');
      alert(`${result.ownerName}のマップ（${result.peopleCount}人）をこの端末へ読み込みました。`);
    }catch(error){ console.error(error); alert(`JSONを読み込めませんでした。\n${error.message||error}`); }
  }

  function addSharedFront(id){
    const item=currentItems.find(x=>String(x.id)===String(id));
    if(!item?.mapData?.people?.length){ alert('このマップには追加できるJSONデータがありません。'); return; }
    const mode=typeof window.v179SharedFrontMode==='function'?window.v179SharedFrontMode(item.id):'add';
    const message=mode==='update'
      ? `${item.name||'選択したメンバー'}の追加済み系列を、共有MAPの最新データへ更新します。\nスケジュールは変更しません。実行しますか？`
      : `${item.name||'選択したメンバー'}を自分の直フロントABOとして追加し、配下の全マップデータも取り込みます。\nスケジュールは追加しません。実行しますか？`;
    if(!confirm(message)) return;
    try{
      if(typeof window.v179MergeSharedFront!=='function') throw new Error('フロント追加機能が読み込まれていません');
      const result=window.v179MergeSharedFront(item.id,item.mapData);
      closeModal('#v136GalleryModal');
      alert(`${result.rootName}の系列（${result.peopleCount}人）を${result.mode==='update'?'更新':'追加'}しました。`);
    }catch(error){ console.error(error); alert(`系列を追加できませんでした。\n${error.message||error}`); }
  }


  const viewerState={scale:1,x:0,y:0,pointers:new Map(),drag:null,pinch:null,vector:false,baseWidth:0,baseHeight:0};

  function applyViewerTransform(animate=false){
    const img=$('#v136ViewerImg');
    if(!img) return;
    img.classList.toggle('is-animating',animate);
    if(viewerState.vector&&viewerState.baseWidth>0){
      img.style.maxWidth='none'; img.style.maxHeight='none';
      img.style.width=`${viewerState.baseWidth*viewerState.scale}px`;
      img.style.height=`${viewerState.baseHeight*viewerState.scale}px`;
      img.style.transform=`translate3d(${viewerState.x}px,${viewerState.y}px,0)`;
    }else{
      img.style.width=''; img.style.height=''; img.style.maxWidth=''; img.style.maxHeight='';
      img.style.transform=`translate3d(${viewerState.x}px,${viewerState.y}px,0) scale(${viewerState.scale})`;
    }
    const value=$('#v167ZoomValue');
    if(value) value.textContent=`${Math.round(viewerState.scale*100)}%`;
    if(animate) setTimeout(()=>img.classList.remove('is-animating'),160);
  }

  function resetViewer(animate=false){
    viewerState.scale=1;
    viewerState.x=0;
    viewerState.y=0;
    viewerState.pointers.clear();
    viewerState.drag=null;
    viewerState.pinch=null;
    $('#v167ViewerStage')?.classList.remove('is-dragging');
    applyViewerTransform(animate);
  }

  function zoomViewer(factor,animate=true){
    viewerState.scale=Math.min(12,Math.max(.25,viewerState.scale*factor));
    if(viewerState.scale<=1){
      viewerState.x=0;
      viewerState.y=0;
    }
    applyViewerTransform(animate);
  }

  function closeViewer(){
    $('#v136Viewer')?.classList.remove('is-open');
    resetViewer();
  }

  function bindViewerControls(){
    const viewer=$('#v136Viewer');
    const stage=$('#v167ViewerStage');
    const img=$('#v136ViewerImg');
    if(!viewer||!stage||!img) return;
    $('#v167ZoomOut').onclick=e=>{ e.stopPropagation(); zoomViewer(.8); };
    $('#v167ZoomIn').onclick=e=>{ e.stopPropagation(); zoomViewer(1.25); };
    $('#v167ZoomFit').onclick=e=>{ e.stopPropagation(); resetViewer(true); };
    $('#v136ViewerClose').onclick=e=>{ e.stopPropagation(); closeViewer(); };
    img.addEventListener('load',()=>{
      img.style.width=''; img.style.height=''; img.style.maxWidth=''; img.style.maxHeight=''; img.style.transform='none';
      const rect=img.getBoundingClientRect();
      viewerState.baseWidth=rect.width; viewerState.baseHeight=rect.height;
      resetViewer();
    });
    img.addEventListener('error',()=>{
      const fallback=img.dataset.fallback;
      if(fallback&&img.src!==fallback){ viewerState.vector=false; img.dataset.fallback=''; img.src=fallback; }
    });

    const beginGesture=()=>{
      const points=[...viewerState.pointers.values()];
      if(points.length===1){
        viewerState.drag={px:points[0].x,py:points[0].y,x:viewerState.x,y:viewerState.y};
        viewerState.pinch=null;
      }else if(points.length>=2){
        const dx=points[1].x-points[0].x;
        const dy=points[1].y-points[0].y;
        viewerState.pinch={distance:Math.hypot(dx,dy)||1,scale:viewerState.scale};
        viewerState.drag=null;
      }
    };
    stage.addEventListener('pointerdown',e=>{
      if(!viewer.classList.contains('is-open')) return;
      stage.setPointerCapture?.(e.pointerId);
      viewerState.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      stage.classList.add('is-dragging');
      beginGesture();
      e.preventDefault();
    });
    stage.addEventListener('pointermove',e=>{
      if(!viewerState.pointers.has(e.pointerId)) return;
      viewerState.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const points=[...viewerState.pointers.values()];
      if(points.length>=2&&viewerState.pinch){
        const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)||1;
        viewerState.scale=Math.min(12,Math.max(.25,viewerState.pinch.scale*(distance/viewerState.pinch.distance)));
      }else if(points.length===1&&viewerState.drag){
        viewerState.x=viewerState.drag.x+(points[0].x-viewerState.drag.px);
        viewerState.y=viewerState.drag.y+(points[0].y-viewerState.drag.py);
      }
      applyViewerTransform();
      e.preventDefault();
    });
    const endPointer=e=>{
      viewerState.pointers.delete(e.pointerId);
      if(viewerState.pointers.size) beginGesture();
      else{
        viewerState.drag=null;
        viewerState.pinch=null;
        stage.classList.remove('is-dragging');
      }
    };
    stage.addEventListener('pointerup',endPointer);
    stage.addEventListener('pointercancel',endPointer);
    stage.addEventListener('wheel',e=>{
      zoomViewer(e.deltaY<0?1.12:.89,false);
      e.preventDefault();
    },{passive:false});
    stage.addEventListener('dblclick',e=>{
      if(viewerState.scale>1) resetViewer(true); else zoomViewer(2,true);
      e.preventDefault();
    });
    viewer.addEventListener('click',e=>{ if(e.target===viewer) closeViewer(); });
  }

  function bind(){
    applyVersion(); injectButtons(); injectUi();
    window.v150BuildOperationalMapData=buildOperationalMapData;
    window.v150DownloadGroupJson=downloadGroupJson;
    window.v159Admin={isActive:()=>adminMode,isSelected:id=>selectedIds.has(id),toggleSelection:(id,on)=>{if(on)selectedIds.add(id);else selectedIds.delete(id);updateDeleteButton();renderCards(currentItems)},selectedCount:()=>selectedIds.size,deleteSelected:deleteSelectedMaps};
    $('#communityMapsBtn').onclick=openGallery;
    $('#uploadMapBtn').onclick=openUpload;
    $('#v136Reload').onclick=refreshGallery;
    $('#v159AdminBtn').onclick=toggleAdmin;
    $('#v136DownloadJson').onclick=downloadGroupJson;
    $('#v136DeleteSelected').onclick=deleteSelectedMaps;
    $('#v136Recreate').onclick=()=>createPreview().catch(()=>{});
    $('#v136DoUpload').onclick=doUpload;
    $('#v136Search').addEventListener('input',()=>renderCards(currentItems));
    $('#v136MapGrid').addEventListener('change',e=>{
      const input=e.target.closest('[data-v136-select]');
      if(!input) return;
      if(input.checked) selectedIds.add(input.dataset.v136Select); else selectedIds.delete(input.dataset.v136Select);
      input.closest('.v136-map-card')?.classList.toggle('is-selected',input.checked);
      updateDeleteButton();
    });
    document.addEventListener('click',e=>{
      const close=e.target.closest('[data-v136-close]');
      if(close) closeModal(close.dataset.v136Close==='gallery'?'#v136GalleryModal':'#v136UploadModal');
      const addFront=e.target.closest('[data-v179-add-front]');
      if(addFront){ e.preventDefault(); addSharedFront(addFront.dataset.v179AddFront); return; }
      const restore=e.target.closest('[data-v178-restore]');
      if(restore){ e.preventDefault(); restoreCloudMap(restore.dataset.v178Restore); return; }
      const view=e.target.closest('[data-v136-view]');
      if(view){ const img=$('#v136ViewerImg'); viewerState.vector=view.dataset.v136Vector==='1'; viewerState.baseWidth=0; viewerState.baseHeight=0; resetViewer(); img.dataset.fallback=view.dataset.v136Fallback||''; img.src=view.dataset.v136View; $('#v136Viewer').classList.add('is-open'); }
      if(e.target.classList?.contains('v136-share-modal')) e.target.classList.remove('is-open');
    });
    $('#v136GalleryModal').addEventListener('click',e=>{
      const b=e.target.closest('[data-v156-gallery]'); if(!b)return;
      $('#v136GalleryModal').querySelectorAll('[data-v156-gallery]').forEach(x=>x.classList.toggle('active',x===b));
      const showSchedule=b.dataset.v156Gallery==='schedule';
      $('#v136MapListPanel').hidden=showSchedule; $('#v156GroupSchedule').hidden=!showSchedule;
      if(showSchedule) window.v156RenderGroupSchedules?.(currentItems);
    });
    bindViewerControls();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
