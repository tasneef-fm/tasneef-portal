/* Tasneef Finance Inventory Save Sync v10065
   - بعد أي حفظ/حذف في المالية والمخزون: يعيد التحميل من Supabase فوراً.
   - يرسل إشارة مزامنة لباقي التبويبات على نفس الجهاز.
   - يفتح اشتراك Realtime لجداول المالية والمخزون حتى تظهر التغييرات عند المستخدمين الآخرين بدون انتظار طويل.
   - لا يغير منطق الحفظ الأصلي؛ فقط يضيف refresh/realtime فوقه.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceInventorySaveSyncV10065) return;
  window.__tasneefFinanceInventorySaveSyncV10065 = true;

  const VERSION = 'v10065';
  const CHANNEL = 'tasneef_finance_inventory_sync_v10065';
  const SYNC_KEY = 'tasneef_finance_inventory_sync_signal_v10065';
  const TABLES = [
    'inventory_items',
    'inventory_movements',
    'finance_expenses',
    'finance_suppliers',
    'inventory_requests',
    'inventory_audit_sessions',
    'inventory_audit_items'
  ];

  const S = v => String(v ?? '').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function userName(){
    try{
      const u = JSON.parse(localStorage.getItem('tasneef_user') || 'null') || {};
      return S(u.full_name || u.name || u.username || u.email || 'مستخدم');
    }catch(_){ return 'مستخدم'; }
  }

  function showSyncMsg(text, type){
    try{
      if(typeof window.msg === 'function') window.msg(text, type || '');
      else console.log('[Finance Sync]', text);
    }catch(_){ console.log('[Finance Sync]', text); }
  }

  let refreshTimer = null;
  async function refreshFinance(reason){
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async ()=>{
      try{
        if(typeof window.financeProLoadV15 === 'function'){
          await window.financeProLoadV15(true);
        }else if(window.financeProStateV15){
          window.financeProStateV15.loaded = false;
          const btn = document.querySelector('[onclick*="financeProLoadV15"]');
          if(btn) btn.click();
        }
        if(typeof window.financeProRenderCurrentV15 === 'function') window.financeProRenderCurrentV15();
        if(typeof window.financeProRenderProductListV15 === 'function') window.financeProRenderProductListV15();
        if(reason) console.log('Finance inventory refreshed:', reason);
      }catch(e){
        console.warn('Finance refresh failed', e);
      }
    }, 350);
  }

  function broadcast(reason){
    try{
      localStorage.setItem(SYNC_KEY, JSON.stringify({time:Date.now(), reason:reason||'save', user:userName()}));
    }catch(_){ }
  }

  function afterSave(reason){
    broadcast(reason);
    refreshFinance(reason);
  }

  function wrapAsync(name, reason){
    const old = window[name];
    if(typeof old !== 'function' || old.__syncWrappedV10065) return;
    const wrapped = async function(){
      let result;
      try{
        result = old.apply(this, arguments);
        if(result && typeof result.then === 'function') result = await result;
        await sleep(150);
        afterSave(reason || name);
        return result;
      }catch(e){
        throw e;
      }
    };
    wrapped.__syncWrappedV10065 = true;
    window[name] = wrapped;
  }

  function wrapAll(){
    [
      ['financeProSaveInvoiceV15','حفظ فاتورة مخزون'],
      ['financeProSaveMovementV15','حفظ حركة مخزون'],
      ['financeProDeleteMovementV15','حذف حركة مخزون'],
      ['financeProDeleteProductV15','حذف منتج'],
      ['financeProAddSupplierV15','إضافة مورد'],
      ['financeProDeleteSupplierV15','حذف مورد'],
      ['financeProSaveExpenseV15','حفظ مصروف'],
      ['financeProDeleteExpenseV15','حذف مصروف'],
      ['supervisorSaveInventoryRequest','حفظ طلب صرف من المشرف'],
      ['financeProApproveInventoryRequestV15','اعتماد طلب صرف'],
      ['financeProRejectInventoryRequestV15','رفض طلب صرف']
    ].forEach(([fn, reason])=>wrapAsync(fn, reason));
  }

  async function uploadLocalSuppliersOnce(){
    try{
      if(!window.sb) return;
      const raw = JSON.parse(localStorage.getItem('tasneef_finance_suppliers_v21') || '[]');
      const rows = Array.isArray(raw) ? raw.map(S).filter(Boolean) : [];
      if(!rows.length) return;
      for(const name of [...new Set(rows)]){
        await sb.from('finance_suppliers').upsert({name, updated_at:new Date().toISOString(), updated_by:userName()}, {onConflict:'name'}).catch(()=>{});
      }
    }catch(e){ console.warn('Local suppliers upload skipped', e); }
  }

  async function mergeGlobalSuppliers(){
    try{
      if(!window.sb || !window.financeProStateV15) return;
      const res = await sb.from('finance_suppliers').select('*').limit(5000);
      if(res.error || !Array.isArray(res.data)) return;
      const names = res.data.map(r=>S(r.name || r.supplier_name)).filter(Boolean);
      const old = Array.isArray(window.financeProStateV15.suppliers) ? window.financeProStateV15.suppliers : [];
      window.financeProStateV15.suppliers = [...new Set([...old, ...names])].sort((a,b)=>a.localeCompare(b,'ar'));
    }catch(_){ }
  }

  function setupRealtime(){
    try{
      if(!window.sb || window.__financeInventoryRealtimeV10065) return;
      window.__financeInventoryRealtimeV10065 = true;
      const ch = sb.channel(CHANNEL);
      TABLES.forEach(t=>{
        ch.on('postgres_changes', {event:'*', schema:'public', table:t}, payload=>{
          console.log('Finance realtime change', t, payload && payload.eventType);
          refreshFinance('realtime:'+t);
        });
      });
      ch.subscribe(status=>{
        if(status === 'SUBSCRIBED') console.log('Finance inventory realtime subscribed v10065');
      });
    }catch(e){ console.warn('Realtime setup failed', e); }
  }

  window.addEventListener('storage', e=>{
    if(e.key === SYNC_KEY) refreshFinance('storage-sync');
  });

  async function boot(){
    wrapAll();
    setupRealtime();
    await uploadLocalSuppliersOnce();
    await mergeGlobalSuppliers();
    refreshFinance('boot');
    setInterval(()=>{ wrapAll(); setupRealtime(); }, 2500);
    setInterval(()=>{ mergeGlobalSuppliers(); }, 15000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.tasneefFinanceInventorySaveSyncV10065 = {refresh:refreshFinance, broadcast, wrapAll};
})();
