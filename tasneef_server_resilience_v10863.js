/* TASNEEF V10863 — Supabase outage resilience
   - Keeps the last known-good dataset visible when Database/PostgREST/Auth is unhealthy.
   - Persists a per-user snapshot in IndexedDB (not localStorage, to handle large tables).
   - Never replaces good cached arrays with empty arrays after transient API failures.
   - Coalesces full refreshes across tabs and retries only after a failure.
   - Does not change report/PDF layouts.
*/
(function(){
  'use strict';
  if(window.__tasneefServerResilienceV10863) return;
  window.__tasneefServerResilienceV10863=true;
  window.TASNEEF_SERVER_RESILIENCE_BUILD='V10863';

  const BUILD='V10863_SERVER_RESILIENCE';
  const DB_NAME='tasneef_resilience_v10863';
  const STORE='snapshots';
  const LOCK_KEY='tasneef_full_sync_lock_v10863';
  const TAB_ID=(window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2))+Date.now();
  const CACHE_KEYS=['users','projects','workers','attendance','logs','tickets','contractServices','workerAssignments','clientReports','clientReportServices','clientServiceRatings'];
  const state={cache:null,cacheLoaded:false,loadPromise:null,refreshPromise:null,retryTimer:null,failed:false,lastGoodAt:0,db:null};
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();

  function currentUser(){
    try{
      if(typeof window.session==='function') return window.session()||{};
      return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};
    }catch(_){ return {}; }
  }
  function cacheKey(){
    const u=currentUser();
    return 'u:'+S(u.id||u.user_id||u.username||'anon')+'|r:'+S(u.role||'unknown');
  }
  function dataObj(){
    try{ if(typeof data==='object' && data) return data; }catch(_){ }
    window.data=window.data||{};
    return window.data;
  }
  function sanitizeUsers(rows){
    return A(rows).map(u=>{ const x={...u}; delete x.password; delete x.password_hash; delete x.reset_token; delete x.access_token; delete x.refresh_token; return x; });
  }
  function buildSnapshot(){
    const d=dataObj();
    const snap={build:BUILD,savedAt:Date.now(),key:cacheKey(),data:{}};
    CACHE_KEYS.forEach(k=>{ if(Array.isArray(d[k])) snap.data[k]=(k==='users'?sanitizeUsers(d[k]):d[k]); });
    return snap;
  }
  function snapshotCounts(snap){
    const out={};
    CACHE_KEYS.forEach(k=>out[k]=A(snap?.data?.[k]).length);
    return out;
  }

  function openDb(){
    if(state.db) return Promise.resolve(state.db);
    if(!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'key'}); };
      req.onsuccess=()=>{state.db=req.result;resolve(state.db);};
      req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
    });
  }
  async function readCache(){
    try{
      const db=await openDb();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readonly');
        const req=tx.objectStore(STORE).get(cacheKey());
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
      });
    }catch(e){ console.warn(BUILD,'cache read',e); return null; }
  }
  function mergeRowsForCache(oldRows,newRows){
    const map=new Map();
    A(oldRows).forEach(x=>{ if(x && x.id!=null) map.set(String(x.id),x); });
    A(newRows).forEach(x=>{ if(x && x.id!=null) map.set(String(x.id),x); });
    return [...map.values()];
  }
  async function writeCache(snapshot){
    if(!snapshot) return;
    try{
      // Keep historical ranges that were previously loaded on-demand, while refreshing current rows.
      if(state.cache?.data && snapshot.data){
        ['attendance','logs','tickets','contractServices','clientReports','clientReportServices','clientServiceRatings'].forEach(k=>{
          if(Array.isArray(state.cache.data[k]) || Array.isArray(snapshot.data[k])) snapshot.data[k]=mergeRowsForCache(state.cache.data[k],snapshot.data[k]);
        });
      }
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put(snapshot);
        tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
      });
      state.cache=snapshot; state.cacheLoaded=true; state.lastGoodAt=snapshot.savedAt;
      try{ localStorage.setItem('tasneef_last_good_sync_v10863',String(snapshot.savedAt)); }catch(_){ }
      try{ window.__tasneefResilienceChannelV10863?.postMessage({type:'snapshot',key:snapshot.key,savedAt:snapshot.savedAt}); }catch(_){ }
    }catch(e){ console.warn(BUILD,'cache write',e); }
  }

  function mergeSnapshot(snapshot, force=false){
    if(!snapshot?.data) return false;
    const d=dataObj();
    let changed=false;
    CACHE_KEYS.forEach(k=>{
      const cached=A(snapshot.data[k]);
      const current=A(d[k]);
      if(!cached.length) return;
      if(force || !current.length){ d[k]=cached; changed=true; }
    });
    if(Array.isArray(d.users)){
      d.supervisors=d.users.filter(u=>u.role==='supervisor' && u.is_active!==false);
      d.technicians=d.users.filter(u=>u.role==='technician' && u.is_active!==false);
    }
    if(changed){
      d.__usingCachedDataV10863=true;
      d.__cachedAtV10863=snapshot.savedAt;
    }
    return changed;
  }
  async function hydrateCache(force=false){
    if(!state.cacheLoaded){ state.cache=await readCache(); state.cacheLoaded=true; state.lastGoodAt=state.cache?.savedAt||0; }
    const changed=mergeSnapshot(state.cache,force);
    if(changed){
      setTimeout(()=>{
        try{ if(typeof window.hydrateForms==='function') window.hydrateForms(); }catch(_){ }
        try{ if(typeof window.renderAll==='function') window.renderAll(); }catch(_){ }
        try{ if(typeof window.renderTickets==='function') window.renderTickets(); }catch(_){ }
        try{ if(typeof window.renderTechnicianTickets==='function') window.renderTechnicianTickets(); }catch(_){ }
      },0);
    }
    return changed;
  }

  function fmtTime(ts){
    if(!ts) return '';
    try{return new Date(ts).toLocaleString('ar-SA',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});}catch(_){return '';}
  }
  function ensureBanner(){
    let b=document.getElementById('tasneefServerBannerV10863');
    if(b) return b;
    b=document.createElement('div'); b.id='tasneefServerBannerV10863';
    b.style.cssText='position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;display:none;align-items:center;gap:10px;max-width:94vw;background:#7a2e0b;color:#fff;padding:9px 14px;border-radius:14px;box-shadow:0 8px 24px #0003;font:700 12px Tahoma,Arial;direction:rtl';
    b.innerHTML='<span data-msg></span><button type="button" style="border:0;background:#fff;color:#7a2e0b;border-radius:9px;padding:5px 9px;font-weight:800;cursor:pointer" onclick="window.tasneefResyncV10863&&window.tasneefResyncV10863(true)">إعادة الاتصال</button>';
    document.body.appendChild(b); return b;
  }
  function showOfflineBanner(){
    if(!document.body) return;
    const b=ensureBanner(); const at=state.cache?.savedAt||state.lastGoodAt;
    b.querySelector('[data-msg]').textContent='السيرفر غير متاح مؤقتًا — يتم عرض آخر بيانات محفوظة'+(at?' ('+fmtTime(at)+')':'');
    b.style.display='flex';
  }
  function hideOfflineBanner(){ const b=document.getElementById('tasneefServerBannerV10863'); if(b) b.style.display='none'; }

  function suspiciousShrink(key,newRows,cachedRows){
    const n=A(newRows).length,c=A(cachedRows).length;
    if(c<20) return false;
    // A transient partial page must not replace a substantially larger complete snapshot.
    return n < Math.floor(c*0.55);
  }
  function preserveAgainstPartial(snapshot){
    if(!snapshot?.data) return;
    const d=dataObj();
    CACHE_KEYS.forEach(k=>{
      const cached=A(snapshot.data[k]),cur=A(d[k]);
      if(!cur.length && cached.length) d[k]=cached;
      else if(suspiciousShrink(k,cur,cached)){
        console.warn(BUILD,'rejected suspicious partial dataset',k,cur.length,'<',cached.length);
        d[k]=cached;
      }
    });
    if(Array.isArray(d.users)){
      d.supervisors=d.users.filter(u=>u.role==='supervisor' && u.is_active!==false);
      d.technicians=d.users.filter(u=>u.role==='technician' && u.is_active!==false);
    }
  }

  function lockInfo(){ try{return JSON.parse(localStorage.getItem(LOCK_KEY)||'null');}catch(_){return null;} }
  function acquireLock(){
    const now=Date.now(),x=lockInfo();
    if(x && x.owner!==TAB_ID && now-Number(x.at||0)<18000) return false;
    try{localStorage.setItem(LOCK_KEY,JSON.stringify({owner:TAB_ID,at:now}));}catch(_){ }
    return true;
  }
  function releaseLock(){ try{const x=lockInfo();if(x?.owner===TAB_ID)localStorage.removeItem(LOCK_KEY);}catch(_){ } }
  function cacheFresh(ms=60000){return !!(state.cache?.savedAt && Date.now()-state.cache.savedAt<ms);}

  const originalLoadAll=window.loadAll;
  if(typeof originalLoadAll==='function'){
    window.loadAll=async function(){
      if(state.loadPromise) return state.loadPromise;
      state.loadPromise=(async()=>{
        await hydrateCache(false);
        // Another tab just synchronized the same user: use that snapshot and avoid a duplicate request storm.
        if(!acquireLock() && cacheFresh(45000)){
          await hydrateCache(true); return;
        }
        try{
          await originalLoadAll.apply(this,arguments);
          const d=dataObj();
          const partial=!!d.__serverPartialFailure;
          if(partial){
            state.failed=true; preserveAgainstPartial(state.cache); showOfflineBanner(); scheduleRetry();
          }else{
            state.failed=false; hideOfflineBanner(); d.__usingCachedDataV10863=false;
            const snap=buildSnapshot(); await writeCache(snap);
          }
        }catch(e){
          state.failed=true; console.warn(BUILD,'full load failed',e);
          await hydrateCache(true); showOfflineBanner(); scheduleRetry();
        }finally{ releaseLock(); }
      })().finally(()=>{state.loadPromise=null;});
      return state.loadPromise;
    };
    try{ loadAll=window.loadAll; }catch(_){ }
  }

  const originalRefreshAll=window.refreshAll;
  if(typeof originalRefreshAll==='function'){
    window.refreshAll=async function(){
      if(state.refreshPromise) return state.refreshPromise;
      state.refreshPromise=(async()=>{
        try{
          // Prefer the wrapped loadAll so all refresh paths get the same outage protection.
          if(typeof window.loadAll==='function') await window.loadAll();
          else await originalRefreshAll.apply(this,arguments);
          try{ if(typeof window.hydrateForms==='function') window.hydrateForms(); }catch(e){console.warn(BUILD,'hydrate',e);}
          try{ if(typeof window.renderAll==='function') window.renderAll(); }catch(e){console.warn(BUILD,'render',e);}
        }catch(e){ console.warn(BUILD,'refresh failed',e); await hydrateCache(true); showOfflineBanner(); }
      })().finally(()=>{state.refreshPromise=null;});
      return state.refreshPromise;
    };
    try{ refreshAll=window.refreshAll; }catch(_){ }
  }

  function wrapTicketRefresh(name){
    const fn=window[name]; if(typeof fn!=='function'||fn.__resilienceV10863) return;
    const wrapped=async function(){
      await hydrateCache(false);
      const before=A(dataObj().tickets).slice();
      try{
        const out=await fn.apply(this,arguments);
        const now=A(dataObj().tickets);
        if(!now.length && before.length) dataObj().tickets=before;
        if(now.length) await writeCache(buildSnapshot());
        return A(dataObj().tickets);
      }catch(e){
        console.warn(BUILD,name,e); if(before.length) dataObj().tickets=before; else await hydrateCache(true); showOfflineBanner(); scheduleRetry(); return A(dataObj().tickets);
      }
    };
    wrapped.__resilienceV10863=true; window[name]=wrapped;
  }
  wrapTicketRefresh('tasneefRefreshTicketsV10859');
  wrapTicketRefresh('tasneefRefreshTicketsV10519');

  async function resync(force=false){
    if(document.hidden && !force) return;
    try{
      if(typeof window.loadAll==='function') await window.loadAll();
      if(!dataObj().__serverPartialFailure){
        state.failed=false; hideOfflineBanner();
        try{ if(typeof window.hydrateForms==='function') window.hydrateForms(); }catch(_){ }
        try{ if(typeof window.renderAll==='function') window.renderAll(); }catch(_){ }
      }
    }catch(e){ state.failed=true; showOfflineBanner(); scheduleRetry(); }
  }
  window.tasneefResyncV10863=resync;

  function scheduleRetry(){
    if(state.retryTimer) return;
    state.retryTimer=setTimeout(async()=>{
      state.retryTimer=null;
      if(document.hidden){ scheduleRetry(); return; }
      await resync(false);
      if(state.failed) scheduleRetry();
    },45000);
  }

  // Save a new good snapshot whenever the V10863 base loader reports complete success.
  window.addEventListener('tasneef:data-loaded-v10863',async e=>{
    if(e?.detail?.partial){ state.failed=true; preserveAgainstPartial(state.cache); showOfflineBanner(); scheduleRetry(); }
    else{ state.failed=false; hideOfflineBanner(); await writeCache(buildSnapshot()); }
  });

  // Share cache freshness across tabs without duplicating database reads.
  try{
    const ch=new BroadcastChannel('tasneef-resilience-v10863'); window.__tasneefResilienceChannelV10863=ch;
    ch.onmessage=async e=>{ if(e?.data?.type==='snapshot' && e.data.key===cacheKey() && Number(e.data.savedAt)>Number(state.cache?.savedAt||0)){ state.cacheLoaded=false; await hydrateCache(state.failed); } };
  }catch(_){ }

  window.addEventListener('online',()=>{ if(state.failed) setTimeout(()=>resync(true),1200); });
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && state.failed) setTimeout(()=>resync(false),1200); });

  async function boot(){
    await hydrateCache(false);
    // Legacy async boot loaders may finish after the cache was painted. Re-apply cache only if they report a partial failure.
    setTimeout(()=>{ if(dataObj().__serverPartialFailure){ preserveAgainstPartial(state.cache); showOfflineBanner(); try{window.renderAll?.();}catch(_){ } } },1800);
    setTimeout(()=>{ if(dataObj().__serverPartialFailure){ preserveAgainstPartial(state.cache); try{window.renderAll?.();}catch(_){ } } },5000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();

  console.info(BUILD,'loaded');
})();
