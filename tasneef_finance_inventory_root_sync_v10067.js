/* Tasneef Finance Inventory Root Sync v10067
   حل جذري:
   - يمنع أي مزامنة أو reload أثناء كتابة بيانات في تبويب العمليات أو حركة المخزون.
   - يسمح بالمزامنة فقط بعد الضغط على حفظ أو عند عدم وجود مسودة.
   - يضيف تفاصيل المستخدم الذي أنشأ/عدل الحركة أو الفاتورة.
   - يضيف تعديل سطر الفاتورة وتعديل المنتج المختار لمدير النظام فقط.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceInventoryRootSyncV10067) return;
  window.__tasneefFinanceInventoryRootSyncV10067=true;

  const VERSION='v10067';
  const CHANNEL='tasneef_finance_root_sync_v10067';
  const SIGNAL='tasneef_finance_root_sync_signal_v10067';
  const TABLES=['inventory_items','inventory_movements','finance_expenses','inventory_requests','finance_suppliers_global_v10064'];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const now=()=>new Date().toISOString();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  let dirty=false;
  let saving=false;
  let pending=false;
  let lastInputAt=0;
  let wrappingLoad=false;
  let refreshTimer=null;

  function st(){ return window.financeProStateV15 || {}; }
  function currentTab(){ return S(st().tab); }
  function currentUser(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function userName(){ const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||'مستخدم'); }
  function userId(){ const u=currentUser(); return S(u.id||u.user_id||u.username||u.email||''); }
  function isAdmin(){ const u=currentUser(), r=S(u.role); return ['admin','system_admin','general_manager','مدير النظام','مدير عام'].includes(r)||S(u.username).toLowerCase()==='admin'; }
  function msg(t,type){ try{ if(typeof window.msg==='function') window.msg(t,type||''); else console.log(t); }catch(_){ console.log(t); } }

  function financeVisible(){ const p=$('financeDashboard'); return !!p && !p.classList.contains('hidden'); }
  function hasFocusInsideFinance(){ const a=document.activeElement; return !!(a && a.closest && a.closest('#financeDashboard') && ['INPUT','SELECT','TEXTAREA'].includes(a.tagName)); }
  function hasDraftInvoice(){
    const x=st();
    if(A(x.invoiceLines).length) return true;
    const ids=['finInvSupplierV15','finInvNoV15','finInvDateV15','finLineNameV15','finLineDistributorCodeV15','finLineSupplierInvoiceV15','finLineQtyV15','finLineMinQtyV15','finLinePriceV15'];
    return ids.some(id=>S($(id)?.value));
  }
  function hasDraftMovement(){
    const x=st();
    if(S(x.editMovementId)) return true;
    if(A(x.distribution).length) return true;
    const ids=['finMoveQtyV15','finMoveNoteV15','finDistOrderV15','finDistQtyV15','finDistNoteV15'];
    return ids.some(id=>S($(id)?.value));
  }
  function isDirty(){
    if(!financeVisible()) return false;
    const tab=currentTab();
    if(dirty && (tab==='add'||tab==='movement')) return true;
    if(hasFocusInsideFinance() && Date.now()-lastInputAt<6000) return true;
    if(tab==='add' && hasDraftInvoice()) return true;
    if(tab==='movement' && hasDraftMovement()) return true;
    return false;
  }
  function markDirty(){
    if(!financeVisible()) return;
    const tab=currentTab();
    if(tab==='add'||tab==='movement') dirty=true;
    lastInputAt=Date.now();
  }
  function clearDirty(){ dirty=false; lastInputAt=0; hideBanner(); }

  document.addEventListener('input', e=>{ if(e.target && e.target.closest && e.target.closest('#financeDashboard')) markDirty(); }, true);
  document.addEventListener('change', e=>{ if(e.target && e.target.closest && e.target.closest('#financeDashboard')) markDirty(); }, true);
  document.addEventListener('click', e=>{
    const b=e.target && e.target.closest && e.target.closest('button');
    if(!b) return;
    const t=S(b.textContent);
    if(/تفريغ|حركة جديدة/.test(t)){ setTimeout(()=>{ dirty=false; },200); }
  }, true);

  function showBanner(){
    const body=$('finBodyV15'); if(!body || $('finRootPendingV10067')) return;
    const d=document.createElement('div');
    d.id='finRootPendingV10067';
    d.className='fin-soft';
    d.style.cssText='margin-bottom:10px;border-color:#e3c36d;background:#fff8e8;color:#6d4b00;font-weight:900;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap';
    d.innerHTML='<span>يوجد تحديث جديد من مستخدم آخر، تم تأجيل المزامنة حتى لا تختفي البيانات التي تكتبها.</span><button type="button" class="light" onclick="tasneefFinanceInventoryRootSyncV10067.applyPending()">تحديث الآن</button>';
    body.prepend(d);
  }
  function hideBanner(){ const e=$('finRootPendingV10067'); if(e) e.remove(); }

  function patchFinanceLoadGuard(){
    if(typeof window.financeProLoadV15!=='function' || window.financeProLoadV15.__rootGuardV10067) return;
    const old=window.financeProLoadV15;
    const guarded=async function(force){
      if(!saving && !window.__financeAllowReloadV10067 && isDirty()){
        pending=true; showBanner();
        console.warn('تم منع إعادة تحميل المالية أثناء الكتابة v10067');
        return;
      }
      return old.apply(this, arguments);
    };
    guarded.__rootGuardV10067=true;
    window.financeProLoadV15=guarded;
  }

  async function safeRefresh(reason, force){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      try{
        patchFinanceLoadGuard();
        if(!force && isDirty()) { pending=true; showBanner(); return; }
        window.__financeAllowReloadV10067=true;
        if(st()) st().loaded=false;
        if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true);
        if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15();
        if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
        pending=false; hideBanner();
      }catch(e){ console.warn('root sync refresh failed',e); }
      finally{ window.__financeAllowReloadV10067=false; }
    }, force?150:700);
  }
  function signal(reason){ try{ localStorage.setItem(SIGNAL, JSON.stringify({at:Date.now(),reason,user:userName()})); }catch(_){ } }
  window.addEventListener('storage', e=>{ if(e.key===SIGNAL && !saving) safeRefresh('storage', false); });

  function injectAudit(row, mode){
    const r=Object.assign({}, row||{});
    if(mode==='insert'){
      r.created_by_name=r.created_by_name||userName();
      r.created_by_user=r.created_by_user||userId();
      r.created_at=r.created_at||now();
    }
    r.updated_by_name=userName();
    r.updated_by_user=userId();
    r.updated_at=now();
    return r;
  }
  function patchSupabaseAudit(){
    if(!window.sb || window.__financeSbAuditV10067) return;
    window.__financeSbAuditV10067=true;
    const raw=window.sb.from.bind(window.sb);
    const target=new Set(['inventory_items','inventory_movements','finance_expenses','inventory_requests','finance_suppliers_global_v10064']);
    window.sb.from=function(name){
      const b=raw(name); if(!target.has(String(name))) return b;
      ['insert','upsert','update'].forEach(m=>{
        const old=b[m]; if(typeof old!=='function') return;
        b[m]=function(values){
          let v=values;
          try{ const mode=m==='update'?'update':'insert'; v=Array.isArray(values)?values.map(x=>injectAudit(x,mode)):injectAudit(values,mode); }catch(_){ v=values; }
          return old.call(this, v, ...Array.prototype.slice.call(arguments,1));
        };
      });
      return b;
    };
  }

  function wrapSave(name, reason){
    const old=window[name];
    if(typeof old!=='function' || old.__rootSyncV10067) return;
    const fn=async function(){
      saving=true; window.__financeAllowReloadV10067=true;
      try{
        const out=old.apply(this, arguments);
        const res=out && typeof out.then==='function' ? await out : out;
        clearDirty(); signal(reason||name);
        await sleep(250);
        await safeRefresh(reason||name, true);
        return res;
      }finally{ saving=false; window.__financeAllowReloadV10067=false; }
    };
    fn.__rootSyncV10067=true; window[name]=fn;
  }
  function wrapAll(){
    [
      ['financeProSaveInvoiceV15','حفظ فاتورة المخزون'],
      ['financeProSaveMovementV15','حفظ حركة مخزون'],
      ['financeProDeleteMovementV15','حذف حركة مخزون'],
      ['financeProDeleteProductV15','حذف منتج'],
      ['financeProSaveExpenseV15','حفظ مصروف'],
      ['financeProDeleteExpenseV15','حذف مصروف'],
      ['financeProAddSupplierV15','إضافة مورد'],
      ['financeProDeleteSupplierV15','حذف مورد']
    ].forEach(x=>wrapSave(x[0],x[1]));
  }

  function setupRealtime(){
    if(!window.sb || window.__financeRealtimeRootV10067) return;
    window.__financeRealtimeRootV10067=true;
    try{
      const ch=sb.channel(CHANNEL);
      TABLES.forEach(t=>ch.on('postgres_changes',{event:'*',schema:'public',table:t},()=>{ if(!saving) safeRefresh('realtime:'+t,false); }));
      ch.subscribe();
    }catch(e){ console.warn('realtime v10067 failed',e); }
  }

  function money(v){ const x=N(v); return x.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س'; }
  function auditHtml(o){
    o=o||{};
    const c=S(o.created_by_name||o.created_by||o.created_by_user||'-');
    const u=S(o.updated_by_name||o.updated_by||o.updated_by_user||'-');
    const ca=S(o.created_at||'').replace('T',' ').slice(0,16)||'-';
    const ua=S(o.updated_at||'').replace('T',' ').slice(0,16)||'-';
    return `<div class="fin-card fin-audit-root-v10067"><h3>تفاصيل المستخدمين</h3><div class="fin-grid two"><div><small>من أنشأ العملية</small><b>${esc(c)}</b><small>${esc(ca)}</small></div><div><small>آخر تعديل بواسطة</small><b>${esc(u)}</b><small>${esc(ua)}</small></div></div></div>`;
  }
  function appendAudit(obj){
    setTimeout(()=>{
      const modal=[...document.querySelectorAll('.modal-backdrop')].pop();
      if(!modal || modal.querySelector('.fin-audit-root-v10067')) return;
      const target=modal.querySelector('.fin-page-v15:not(.hidden)') || modal.querySelector('.card');
      if(target) target.insertAdjacentHTML('beforeend', auditHtml(obj));
    },150);
  }
  function patchDetailButtons(){
    const om=window.financeProShowMovementV15;
    if(typeof om==='function' && !om.__rootAuditV10067){
      const fn=function(id){ const m=A(st().movements).find(x=>Number(x.id)===Number(id)); const r=om.apply(this,arguments); appendAudit(m); return r; };
      fn.__rootAuditV10067=true; window.financeProShowMovementV15=fn;
    }
    const oi=window.financeProShowInvoiceV15;
    if(typeof oi==='function' && !oi.__rootAuditV10067){
      const fn=function(encoded){ const no=decodeURIComponent(encoded||''); const m=A(st().movements).find(x=>S(x.notes).includes(no)||S(x.reason).includes(no)); const r=oi.apply(this,arguments); appendAudit(m); return r; };
      fn.__rootAuditV10067=true; window.financeProShowInvoiceV15=fn;
    }
  }

  function patchInvoiceBox(){
    const box=$('finInvoiceLinesV15'); if(!box) return;
    if(!$('finDraftUserRootV10067')){
      const info=document.createElement('div');
      info.id='finDraftUserRootV10067'; info.className='fin-soft';
      info.style.cssText='margin:10px 0;font-weight:900;background:#f2fbf7;border-color:#cfe7dc';
      info.textContent='من يقوم بالعملية الآن: '+userName();
      box.prepend(info);
    }
    if(isAdmin()){
      A(st().invoiceLines).forEach((line,idx)=>{
        const tr=box.querySelectorAll('tbody tr')[idx]; if(!tr) return;
        const td=tr.querySelector('td:last-child'); if(!td || td.querySelector('.edit-line-root-v10067')) return;
        const b=document.createElement('button');
        b.type='button'; b.className='light edit-line-root-v10067'; b.textContent='تعديل'; b.style.marginInlineEnd='6px';
        b.onclick=()=>editInvoiceLine(idx);
        td.prepend(b);
      });
    }
    injectProductEditButton();
  }
  function editInvoiceLine(idx){
    if(!isAdmin()) return alert('تعديل المنتج داخل العمليات متاح لمدير النظام فقط');
    const lines=A(st().invoiceLines); const l=lines[idx]; if(!l) return;
    const set=(id,v)=>{ const el=$(id); if(el) el.value=v??''; };
    set('finLineNameV15',l.name); set('finLineCodeV15',l.code); set('finLineDistributorCodeV15',l.distributor_code); set('finLineSupplierInvoiceV15',l.supplier_invoice_no);
    set('finLineQtyV15',l.qty); set('finLineMinQtyV15',l.min_quantity); set('finLinePriceV15',l.price); set('finLineTaxModeV15',l.tax_mode||'before'); set('finLineUnitV15',l.unit||'حبة'); set('finLineTypeV15',l.item_type||'مادة');
    window.__financeProLineImageV15=l.image||''; const im=$('finLineImageNameV15'); if(im) im.textContent=l.image?'الصورة محفوظة من السطر':'لم يتم اختيار صورة';
    if(typeof window.financeProRemoveInvoiceLineV15==='function') window.financeProRemoveInvoiceLineV15(idx);
    dirty=true; msg('تم تحميل المنتج للتعديل. عدّل البيانات ثم اضغط إضافة.');
  }
  window.financeRootEditInvoiceLineV10067=editInvoiceLine;

  function injectProductEditButton(){
    if(!isAdmin()) return;
    const sel=$('finExistingProductV15'); if(!sel || $('finEditSelectedProductRootV10067')) return;
    const b=document.createElement('button'); b.type='button'; b.id='finEditSelectedProductRootV10067'; b.className='light'; b.textContent='تعديل المنتج المختار'; b.style.marginTop='8px';
    b.onclick=openEditProductModal;
    sel.closest('div')?.appendChild(b);
  }
  function openEditProductModal(){
    if(!isAdmin()) return alert('تعديل المنتج متاح لمدير النظام فقط');
    const id=S($('finExistingProductV15')?.value); if(!id) return alert('اختر منتج موجود أولاً');
    const item=A(st().items).find(i=>String(i.id)===String(id)); if(!item) return alert('لم يتم العثور على المنتج');
    const itemCode=S(item.product_code||item.serial_number||item.barcode||'');
    const html=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(760px,96vw);max-height:90vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>تعديل المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-grid two"><div><label>اسم المنتج</label><input id="editProdNameV10067" value="${esc(item.name)}"></div><div><label>الكود الداخلي</label><input id="editProdCodeV10067" value="${esc(itemCode)}"></div><div><label>كود الموزع</label><input id="editProdDistV10067" value="${esc(item.supplier_barcode||item.distributor_code||'')}"></div><div><label>الوحدة</label><input id="editProdUnitV10067" value="${esc(item.unit||'حبة')}"></div><div><label>النوع</label><select id="editProdTypeV10067"><option ${S(item.item_type||item.type)==='مادة'?'selected':''}>مادة</option><option ${S(item.item_type||item.type)==='عدة'?'selected':''}>عدة</option><option ${S(item.item_type||item.type)==='غير'?'selected':''}>غير</option></select></div><div><label>حد النفاد</label><input id="editProdMinV10067" type="number" step="0.01" value="${N(item.min_quantity||item.reorder_level||1)}"></div><div><label>تكلفة الوحدة قبل الضريبة</label><input id="editProdCostV10067" type="number" step="0.01" value="${N(item.unit_cost||item.cost||item.price||item.purchase_price)}"></div></div><div class="fin-actions"><button onclick="financeRootSaveProductEditV10067('${esc(id)}',this)">حفظ تعديل المنتج</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
  }
  window.financeRootSaveProductEditV10067=async function(id,btn){
    try{
      if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const upd={
        name:S($('editProdNameV10067')?.value), product_code:S($('editProdCodeV10067')?.value), serial_number:S($('editProdCodeV10067')?.value), barcode:S($('editProdCodeV10067')?.value), supplier_barcode:S($('editProdDistV10067')?.value), unit:S($('editProdUnitV10067')?.value)||'حبة', item_type:S($('editProdTypeV10067')?.value)||'مادة', type:S($('editProdTypeV10067')?.value)||'مادة', min_quantity:N($('editProdMinV10067')?.value)||1, unit_cost:N($('editProdCostV10067')?.value), updated_by_name:userName(), updated_by_user:userId(), updated_at:now()
      };
      const r=await sb.from('inventory_items').update(upd).eq('id',id).select('*').single();
      if(r.error) throw r.error;
      const arr=A(st().items); const idx=arr.findIndex(i=>String(i.id)===String(id)); if(idx>=0) arr[idx]=Object.assign(arr[idx],r.data||upd);
      if($('finLineNameV15')) $('finLineNameV15').value=upd.name;
      if($('finLineCodeV15')) $('finLineCodeV15').value=upd.product_code;
      if($('finLineDistributorCodeV15')) $('finLineDistributorCodeV15').value=upd.supplier_barcode;
      if($('finLineUnitV15')) $('finLineUnitV15').value=upd.unit;
      if($('finLineTypeV15')) $('finLineTypeV15').value=upd.item_type;
      if($('finLineMinQtyV15')) $('finLineMinQtyV15').value=upd.min_quantity;
      if($('finLinePriceV15') && !$('finLinePriceV15').value) $('finLinePriceV15').value=upd.unit_cost;
      document.querySelector('.modal-backdrop:last-of-type')?.remove();
      signal('تعديل منتج'); msg('تم تعديل المنتج وسيظهر في المنتجات');
    }catch(e){ alert(e.message||String(e)); }
    finally{ if(btn) btn.disabled=false; }
  };

  function observer(){
    if(window.__financeRootObserverV10067) return;
    window.__financeRootObserverV10067=true;
    new MutationObserver(()=>{ try{ patchInvoiceBox(); patchDetailButtons(); patchFinanceLoadGuard(); wrapAll(); }catch(_){ } }).observe(document.body,{childList:true,subtree:true});
  }
  window.tasneefFinanceInventoryRootSyncV10067={applyPending:()=>{ clearDirty(); safeRefresh('manual pending',true); }, refresh:()=>safeRefresh('manual',true)};

  function boot(){
    patchFinanceLoadGuard(); patchSupabaseAudit(); wrapAll(); setupRealtime(); observer(); patchInvoiceBox(); patchDetailButtons();
    setInterval(()=>{ patchFinanceLoadGuard(); patchSupabaseAudit(); wrapAll(); setupRealtime(); patchInvoiceBox(); patchDetailButtons(); },2500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
