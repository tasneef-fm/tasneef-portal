/* Tasneef Finance/Inventory Global Sync v10064
   الهدف: جعل المالية والمخزون مشتركة بين كل المستخدمين، وليس محفوظة محليًا لكل جهاز.
   يعمل مع tasneef_finance_inventory_pro_v15.js ويعالج الموردين المحليين أيضًا.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceInventoryGlobalSyncV10064) return;
  window.__tasneefFinanceInventoryGlobalSyncV10064 = true;

  const SUPPLIERS_TABLE = 'finance_suppliers_global_v10064';
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const $ = id => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const user = () => { try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} };
  const userName = () => {
    const u=user();
    return S(u.full_name || u.name || u.username || u.email || 'مستخدم');
  };
  const msg = (t, type) => { try{ if(typeof window.msg==='function') window.msg(t,type); }catch(_){} };

  function style(){
    if($('financeGlobalSyncStyleV10064')) return;
    const st=document.createElement('style');
    st.id='financeGlobalSyncStyleV10064';
    st.textContent=`
      .fin-global-sync-badge-v10064{display:inline-flex;align-items:center;gap:6px;background:#e7f6ef;color:#07533f;border:1px solid #cceade;border-radius:999px;padding:6px 10px;font-weight:900;font-size:12px;margin-inline-start:8px}
      .fin-global-sync-note-v10064{background:#f2fbf7;border:1px solid #cfe7dc;color:#064534;border-radius:14px;padding:10px 12px;margin:8px 0;font-weight:700}
    `;
    document.head.appendChild(st);
  }

  async function sbReady(){
    for(let i=0;i<50;i++){
      if(window.sb && typeof window.sb.from==='function') return true;
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }

  function localSuppliers(){
    try{ return A(JSON.parse(localStorage.getItem('tasneef_finance_suppliers_v21')||'[]')).map(S).filter(Boolean); }
    catch(_){ return []; }
  }
  function saveLocalSuppliers(list){
    const rows=[...new Set(A(list).map(S).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    localStorage.setItem('tasneef_finance_suppliers_v21', JSON.stringify(rows));
    return rows;
  }
  async function pullSuppliers(){
    if(!await sbReady()) return localSuppliers();
    try{
      const r=await sb.from(SUPPLIERS_TABLE).select('name').order('name',{ascending:true}).limit(5000);
      if(r.error) return localSuppliers();
      const cloud=A(r.data).map(x=>S(x.name)).filter(Boolean);
      return saveLocalSuppliers([...localSuppliers(), ...cloud]);
    }catch(_){ return localSuppliers(); }
  }
  async function pushSuppliers(){
    if(!await sbReady()) return;
    const rows=localSuppliers().map(name=>({name, updated_at:nowIso(), updated_by:userName()}));
    if(!rows.length) return;
    try{ await sb.from(SUPPLIERS_TABLE).upsert(rows,{onConflict:'name'}); }catch(_){}
  }

  function financeVisible(){
    const p=$('financeDashboard');
    return !!p && !p.classList.contains('hidden') && p.offsetParent!==null;
  }
  async function forceFinanceReload(silent){
    await pullSuppliers();
    try{
      const st=window.financeProStateV15;
      if(st) st.loaded=false;
      if(typeof window.financeProLoadV15==='function'){
        await window.financeProLoadV15(true);
      }
      if(typeof window.financeProRenderAll==='function') window.financeProRenderAll();
      if(!silent) msg('تم تحديث المالية والمخزون من السيرفر');
    }catch(e){ if(!silent) msg(e.message||String(e),'err'); }
  }

  function addBadge(){
    try{
      const hero=document.querySelector('#financeDashboard .fin-hero .fin-actions') || document.querySelector('#financeDashboard .fin-hero');
      if(!hero || hero.querySelector('.fin-global-sync-badge-v10064')) return;
      const span=document.createElement('span');
      span.className='fin-global-sync-badge-v10064';
      span.textContent='متزامن لكل المستخدمين';
      hero.appendChild(span);
    }catch(_){}
  }

  function wrap(name, after){
    const fn=window[name];
    if(typeof fn!=='function' || fn.__globalSyncV10064) return false;
    const wrapped=async function(){
      const res=fn.apply(this, arguments);
      try{
        if(res && typeof res.then==='function') await res;
        else await new Promise(r=>setTimeout(r,300));
      }finally{
        try{ await pushSuppliers(); }catch(_){}
        try{ await after(name); }catch(_){}
      }
      return res;
    };
    wrapped.__globalSyncV10064=true;
    window[name]=wrapped;
    return true;
  }

  async function afterWrite(name){
    // بعد أي إضافة/تعديل/حذف، أعد تحميل البيانات من السيرفر حتى تظهر عند نفس المستخدم فورًا
    const st=window.financeProStateV15;
    if(st) st.loaded=false;
    setTimeout(()=>forceFinanceReload(true), 500);
    try{
      localStorage.setItem('tasneef_finance_inventory_global_refresh_v10064', JSON.stringify({at:nowIso(), by:userName(), action:name}));
    }catch(_){}
  }

  function installWrappers(){
    wrap('financeProSaveInvoiceV15', afterWrite);
    wrap('financeProSaveMovementV15', afterWrite);
    wrap('financeProDeleteMovementV15', afterWrite);
    wrap('financeProDeleteProductV15', afterWrite);
    wrap('financeProAddSupplierV15', async ()=>{ await pushSuppliers(); await pullSuppliers(); try{ if(typeof window.financeProRenderSuppliersV15==='function') window.financeProRenderSuppliersV15(); }catch(_){} });
    wrap('financeProDeleteSupplierV15', async ()=>{ await pushSuppliers(); await pullSuppliers(); try{ if(typeof window.financeProRenderSuppliersV15==='function') window.financeProRenderSuppliersV15(); }catch(_){} });
  }

  function patchRefreshButtons(){
    document.addEventListener('click', function(e){
      const b=e.target && e.target.closest && e.target.closest('button');
      if(!b) return;
      const t=S(b.textContent);
      if(financeVisible() && /تحديث البيانات|تحديث/.test(t)){
        setTimeout(()=>forceFinanceReload(true), 150);
      }
    }, true);
  }

  async function boot(){
    style();
    await pullSuppliers();
    installWrappers();
    patchRefreshButtons();
    setInterval(installWrappers, 1500);
    setInterval(()=>{ if(financeVisible()) { addBadge(); pullSuppliers(); } }, 4000);
    // تحديث خفيف من السيرفر عند دخول قسم المالية فقط، بدون تجميد الصفحة
    let last=0;
    setInterval(()=>{
      if(!financeVisible()) return;
      const now=Date.now();
      if(now-last<30000) return;
      last=now;
      forceFinanceReload(true);
    }, 10000);
    window.addEventListener('storage', e=>{
      if(e.key==='tasneef_finance_inventory_global_refresh_v10064' && financeVisible()) forceFinanceReload(true);
    });
    window.tasneefFinanceGlobalSyncV10064 = {reload:forceFinanceReload, pullSuppliers, pushSuppliers};
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
