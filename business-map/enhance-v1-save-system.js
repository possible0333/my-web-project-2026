(function(){
  const AUTO_TIME_KEY='business_map_v1_last_autosave';
  const SLOT_PREFIX='business_map_v1_manual_slot_';
  const el=id=>document.getElementById(id);
  const fmtTime=iso=>{
    if(!iso)return'未保存';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return'未保存';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const clone=v=>JSON.parse(JSON.stringify(v));

  function ensureAutosaveStatus(){
    const top=document.querySelector('.top');if(!top)return;
    let s=el('v1AutoSaveStatus');
    if(!s){
      s=document.createElement('div');s.id='v1AutoSaveStatus';s.className='v1-autosave-status';
      const brand=top.firstElementChild;brand?.appendChild(s);
    }
    const t=localStorage.getItem(AUTO_TIME_KEY);
    s.textContent=`自動保存：${fmtTime(t)}`;
  }

  function ensureSaveButton(){
    const top=document.querySelector('.top>div:last-child');if(!top||el('v1SaveManagerBtn'))return;
    const b=document.createElement('button');b.id='v1SaveManagerBtn';b.className='btn v1-save-manager-btn';b.textContent='💾 セーブ';
    b.addEventListener('click',openSaveManager);top.prepend(b,document.createTextNode(' '));
  }

  function ensureSaveModal(){
    if(el('v1SaveModal'))return;
    const m=document.createElement('div');m.id='v1SaveModal';m.className='modal v1-save-modal';
    m.innerHTML=`<div class="sheet v1-save-sheet"><div class="title"><div><h3>セーブデータ</h3><div class="small">端末内に最大3個まで保存できます</div></div><button class="btn" id="v1SaveModalClose">閉じる</button></div><div id="v1SaveSlots" class="v1-save-slots"></div><div class="v1-save-note">※ブラウザのサイトデータ削除や端末初期化では、このセーブも消える可能性があります。重要なバックアップはJSON保存も併用してください。</div></div>`;
    document.body.appendChild(m);
    el('v1SaveModalClose').onclick=()=>m.classList.remove('open');
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')});
  }

  function readSlot(i){
    try{return JSON.parse(localStorage.getItem(SLOT_PREFIX+i)||'null')}catch(e){return null}
  }
  function writeSlot(i){
    const payload={savedAt:new Date().toISOString(),data:clone(S)};
    localStorage.setItem(SLOT_PREFIX+i,JSON.stringify(payload));renderSlots();
  }
  function restoreSlot(i){
    const slot=readSlot(i);if(!slot?.data)return;
    if(!confirm(`セーブ${i}（${fmtTime(slot.savedAt)}）の状態に戻しますか？\n現在の状態は上書きされます。`))return;
    S=clone(slot.data);persist();render();renderSlots();
    el('v1SaveModal')?.classList.remove('open');
  }
  function deleteSlot(i){
    const slot=readSlot(i);if(!slot)return;
    if(!confirm(`セーブ${i}を削除しますか？`))return;
    localStorage.removeItem(SLOT_PREFIX+i);renderSlots();
  }

  function renderSlots(){
    const box=el('v1SaveSlots');if(!box)return;
    box.innerHTML=[1,2,3].map(i=>{
      const x=readSlot(i),used=!!x?.data;
      return `<div class="v1-save-slot ${used?'used':'empty'}"><div class="v1-save-slot-info"><strong>セーブ${i}</strong><span>${used?fmtTime(x.savedAt):'未使用'}</span></div><div class="v1-save-slot-actions"><button class="btn primary" data-save-slot="${i}">${used?'上書き保存':'保存'}</button><button class="btn" data-restore-slot="${i}" ${used?'':'disabled'}>復元</button><button class="btn danger" data-delete-slot="${i}" ${used?'':'disabled'}>削除</button></div></div>`;
    }).join('');
    box.querySelectorAll('[data-save-slot]').forEach(b=>b.onclick=()=>writeSlot(+b.dataset.saveSlot));
    box.querySelectorAll('[data-restore-slot]').forEach(b=>b.onclick=()=>restoreSlot(+b.dataset.restoreSlot));
    box.querySelectorAll('[data-delete-slot]').forEach(b=>b.onclick=()=>deleteSlot(+b.dataset.deleteSlot));
  }

  function openSaveManager(){ensureSaveModal();renderSlots();el('v1SaveModal').classList.add('open')}

  if(typeof persist==='function'){
    const oldPersist=persist;
    persist=function(){
      oldPersist();
      try{localStorage.setItem(AUTO_TIME_KEY,new Date().toISOString())}catch(e){}
      ensureAutosaveStatus();
    };
  }

  ensureAutosaveStatus();ensureSaveButton();ensureSaveModal();renderSlots();
})();
