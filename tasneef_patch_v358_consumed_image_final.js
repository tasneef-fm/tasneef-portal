/* TASNEEF v358 - Final consumed quantity + invoice product image visibility
   - يثبت حساب المستهلك في عرض المنتج: الموزع على المشاريع/الأوردر/عام = مستهلك.
   - المتبقي = الداخل - (المتبقي للتوزيع + الموزع/المستهلك) + المرتجع.
   - يزامن حقول المنتج القديمة التي كانت تعرض المستهلك = 0.
   - يجبر ظهور خانة صورة المنتج داخل فاتورة الإدخال.
*/
(function(){
  'use strict';
  if(window.__tasneefV358ConsumedImageFinal) return; window.__tasneefV358ConsumedImageFinal = true;

  const VAT = 0.15;
  const LS = {items:'tasneef_v312_items', moves:'tasneef_v312_moves'};
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '');
  const N = v => { const x = parseFloat(S(v).replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const R2 = v => Math.round(N(v) * 100) / 100;
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money = v => N(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const qty = v => N(v).toLocaleString('en-US',{maximumFractionDigits:2});
  const parse = (k,d=[]) => { try{return JSON.parse(localStorage.getItem(k)||'null')||d;}catch(_){return d;} };
  const save = (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} };

  function localItems(){ return parse(LS.items, []); }
  function localMoves(){ return parse(LS.moves, []); }
  function dataItems(){ return Array.isArray(window.data?.inventoryItems) ? window.data.inventoryItems : []; }
  function dataMoves(){ return Array.isArray(window.data?.inventoryMovements) ? window.data.inventoryMovements : []; }
  function allItems(){
    const map = new Map();
    [...localItems(), ...dataItems()].forEach(i => { if(i && i.id != null) map.set(S(i.id), {...(map.get(S(i.id))||{}), ...i}); });
    return [...map.values()];
  }
  function allMoves(){
    const out=[]; const seen=new Set();
    [...localMoves(), ...dataMoves()].forEach(m=>{
      const key=S(m.id||'')+'|'+S(m.batch_id||'')+'|'+S(m.item_id||'')+'|'+S(m.qty||m.quantity||'')+'|'+S(m.type||m.movement_type||'');
      if(!seen.has(key)){ seen.add(key); out.push(m); }
    });
    return out;
  }

  function itemIdOf(m){ return S(m.item_id || m.inventory_item_id || m.product_id || ''); }
  function typeOf(m){ return S(m.type || m.movement_type || m.action || '').trim(); }
  function qtyOf(m){ return R2(m.qty ?? m.quantity ?? m.amount ?? 0); }
  function statusOf(m){ return S(m.status || m.approval_status || '').trim(); }
  function isApproved(m){ const st=statusOf(m); return !st || ['معتمد','approved','تم الاعتماد','مكتمل','completed','done','منفذ'].includes(st); }
  function isInType(t){ t=S(t).toLowerCase(); return ['in','دخول','إدخال','ادخال','شراء','توريد','اضافة','إضافة'].some(x=>t.includes(x)); }
  function isOutType(t){ t=S(t); return ['out','صرف','استهلاك','هدر','تالف','سكراب','خرج'].some(x=>t.includes(x)); }
  function isReturnLine(m){ const t=typeOf(m); const txt=[m.distribution_status,m.notes,m.general_note,m.reason].map(S).join(' '); return t.includes('مرتجع') || t.toLowerCase()==='return' || txt.includes('[RETURN]') || txt.includes('return'); }
  function isPendingLine(m){ const txt=[m.distribution_status,m.notes,m.general_note,m.reason].map(S).join(' '); return txt.includes('pending') || txt.includes('[PENDING_DISTRIBUTION]') || txt.includes('بانتظار توزيع'); }
  function isAllocatedLine(m){ const txt=[m.distribution_status,m.notes,m.general_note,m.reason].map(S).join(' '); const ct=S(m.cost_type||m.cost_center||m.cost_center_name||''); return txt.includes('allocated') || txt.includes('[ALLOCATED]') || txt.includes('موزع') || ct==='FM' || ct==='CN' || (!!m.project_id && !isPendingLine(m)); }
  function unitCostOf(item){ return N(item?.unit_cost ?? item?.price_before_vat ?? item?.price_before ?? item?.unit_price ?? item?.cost ?? 0); }
  function moveCost(m,item){ return N(m.unit_cost_override ?? m.unit_cost ?? m.price_before_vat ?? m.price_before ?? m.unit_price ?? unitCostOf(item)); }
  function itemCode(it){ return S(it?.product_code || it?.barcode || it?.supplier_barcode || it?.serial_number || it?.code || ''); }
  function supplierCode(it){ return S(it?.company_code || it?.supplier_code || it?.internal_code || it?.supplier_barcode || it?.barcode || ''); }
  function imgHtml(it){ const src=S(it?.image_url || it?.image || it?.img || it?.photo || ''); return src ? `<img src="${E(src)}" style="max-width:100%;max-height:100%;object-fit:contain">` : '<span style="color:#789">لا توجد صورة</span>'; }

  function enteredExplicit(it){
    const vals=[it?.entered_qty,it?.stock_in,it?.in_qty,it?.initial_quantity,it?.original_quantity,it?.qty_in,it?.total_in];
    const mx=Math.max(...vals.map(N),0);
    return mx || 0;
  }
  function batchEntered(it){
    return (Array.isArray(it?.batches)?it.batches:[]).reduce((a,b)=>a+N(b.qty_initial||b.initial_qty||b.entered||b.original_qty||b.qty||b.quantity||0),0);
  }

  function compute(itemId){
    const it = allItems().find(i => S(i.id)===S(itemId));
    if(!it) return null;
    const ms = allMoves().filter(m => itemIdOf(m)===S(itemId) && isApproved(m));
    const inQty = ms.filter(m=>isInType(typeOf(m))).reduce((a,m)=>a+qtyOf(m),0);

    // توزيع الحركة عندك يتكون من:
    // 1) سطر صرف/خرج بانتظار توزيع يتناقص مع التوزيع.
    // 2) سطور توزيع فعلية على مشاريع/أوردر/عام = مستهلك.
    // 3) سطور مرتجع = يرجع للمخزن ولا يدخل في تكلفة المشروع.
    const pendingOut = ms.filter(m=>isOutType(typeOf(m)) && isPendingLine(m) && !isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);
    const allocatedConsumed = ms.filter(m=>isOutType(typeOf(m)) && isAllocatedLine(m) && !isPendingLine(m) && !isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);
    const directOut = ms.filter(m=>isOutType(typeOf(m)) && !isPendingLine(m) && !isAllocatedLine(m) && !isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);
    const returns = ms.filter(m=>isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);

    let entered = enteredExplicit(it) || batchEntered(it) || inQty || N(it.entered) || N(it.stock_in_qty) || 0;
    // لو المنتج مدخل من فاتورة ولم توجد حركة in واضحة، لا نأخذ الكمية الحالية لأنها قد تكون معدلة خطأ.
    // نبني أقل داخل ممكن يغطي الحركة: المتبقي للتوزيع + المستهلك + المباشر.
    const issuedBeforeReturn = R2(pendingOut + allocatedConsumed + directOut);
    if(!entered || entered < issuedBeforeReturn){
      entered = Math.max(entered, issuedBeforeReturn, N(it.initial_quantity||0));
    }
    const remaining = R2(Math.max(0, entered - issuedBeforeReturn + returns));
    const consumed = R2(allocatedConsumed + directOut);
    const out = R2(issuedBeforeReturn);
    const unit = moveCost(ms.find(m=>moveCost(m,it)>0)||{}, it) || unitCostOf(it);
    return {it, ms, entered:R2(entered), pending:R2(pendingOut), allocated:R2(allocatedConsumed), direct:R2(directOut), out, returns:R2(returns), consumed, remaining, unit};
  }

  function syncOne(itemId){
    const st=compute(itemId); if(!st) return null;
    const apply = it => {
      it.quantity = st.remaining; it.qty = st.remaining; it.stock = st.remaining; it.current_qty = st.remaining;
      it.consumed = st.consumed; it.consumed_qty = st.consumed; it.used_qty = st.consumed; it.total_consumed = st.consumed;
      it.returned_qty = st.returns; it.return_qty = st.returns; it.total_returned = st.returns;
      it.out_qty = st.out; it.stock_out = st.out; it.entered_qty = st.entered; it.stock_in = st.entered;
      it.pending_distribution_qty = st.pending;
    };
    const li=localItems(); const idx=li.findIndex(i=>S(i.id)===S(itemId)); if(idx>=0){ apply(li[idx]); save(LS.items, li); }
    const di=dataItems(); const d=di.find(i=>S(i.id)===S(itemId)); if(d) apply(d);
    return st;
  }
  window.rebuildStockV358=function(){ allItems().forEach(i=>syncOne(i.id)); return allItems(); };
  window.inventoryItemStatsV358=window.inventoryItemStatsV151=function(it){ const st=compute(it?.id||it); return st ? {remaining:st.remaining,inQty:st.entered,outQty:st.out,retQty:st.returns,consumed:st.consumed,pending:st.pending} : {remaining:0,inQty:0,outQty:0,retQty:0,consumed:0,pending:0}; };

  function ensureCss(){
    if($('v358Css')) return;
    const st=document.createElement('style'); st.id='v358Css'; st.textContent=`
      .v358-modal{position:fixed;inset:0;background:rgba(0,0,0,.50);z-index:1000015;display:flex;align-items:flex-start;justify-content:center;padding:22px;overflow:auto;direction:rtl}.v358-panel{width:min(1120px,96vw);background:#fff;border-radius:24px;border:1px solid #d8e9e2;box-shadow:0 25px 80px rgba(0,0,0,.28);padding:18px}.v358-head{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #e4eee9;padding-bottom:12px;margin-bottom:12px}.v358-head h2{margin:0;color:#073f33}.v358-close{background:#bd3434;color:#fff;border:0;border-radius:12px;padding:10px 16px;font-weight:900;cursor:pointer}.v358-flex{display:flex;gap:16px;align-items:flex-start}.v358-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;flex:1}.v358-box{background:#f8fcfa;border:1px solid #d8e9e2;border-radius:16px;min-height:64px;padding:11px}.v358-box small{display:block;color:#70837c;margin-bottom:5px}.v358-box b{font-size:18px;color:#073f33}.v358-img{width:240px;height:245px;border-radius:20px;background:#eef8f4;border:1px solid #d8e9e2;display:grid;place-items:center;overflow:hidden}.v358-note{background:#fff8e6;border:1px dashed #d4a533;color:#6b4c00;border-radius:14px;padding:11px;margin:14px 0;font-weight:900}.v358-table{width:100%;border-collapse:separate;border-spacing:0 7px}.v358-table th{background:#eef8f4;color:#073f33;padding:9px;text-align:center}.v358-table td{background:#fff;border-top:1px solid #d8e9e2;border-bottom:1px solid #d8e9e2;padding:9px;text-align:center}.v358-table td:first-child{border-right:1px solid #d8e9e2;border-radius:0 12px 12px 0}.v358-table td:last-child{border-left:1px solid #d8e9e2;border-radius:12px 0 0 12px}.v358-chip{display:inline-block;border-radius:999px;padding:5px 10px;font-weight:900;background:#eaf8f4;color:#064737}.v358-chip.out{background:#fff0cf;color:#7a5200}.v358-chip.ret{background:#eaf2ff;color:#174c8b}.v358-chip.pending{background:#fff8dd;color:#8a6200}.v358-image-force{border:1px dashed #b9dbcf!important;background:#f6fcf9!important;border-radius:14px!important;padding:10px!important;margin:8px 0!important;display:block!important}.v358-image-force label{font-weight:900;color:#074d3f}.v358-image-force input{width:100%;margin-top:8px}.stage-upload{display:inline-flex!important;align-items:center;justify-content:center;min-height:38px!important;padding:8px 12px!important;border-radius:12px!important;background:#eef8f4!important;border:1px solid #cfe2dc!important;color:#073f33!important;font-weight:900!important;cursor:pointer!important}#batchLineImagePreviewV148{display:block!important;visibility:visible!important;min-height:48px!important;border:1px dashed #b9dbcf!important;background:#f5fbf8!important;border-radius:14px!important;padding:8px!important;margin:8px 0!important}.v161-hide-advanced-field:has(#batchLineImagePreviewV148),.v160-optional-stock-field:has(#batchLineImagePreviewV148){display:block!important}
      @media(max-width:850px){.v358-flex{flex-direction:column}.v358-img{width:100%;height:180px}.v358-grid{grid-template-columns:1fr 1fr}}
    `; document.head.appendChild(st);
  }
  function openModal(title,body){ ensureCss(); document.querySelector('.v358-modal')?.remove(); const d=document.createElement('div'); d.className='v358-modal'; d.innerHTML=`<div class="v358-panel"><div class="v358-head"><button class="v358-close" onclick="this.closest('.v358-modal').remove()">إغلاق</button><h2>${E(title)}</h2></div>${body}</div>`; document.body.appendChild(d); }
  function moveLabel(m){ if(isReturnLine(m)) return ['مرتجع للمخزن','ret']; if(isPendingLine(m)) return ['باقي لم يوزع','pending']; if(isAllocatedLine(m)) return ['موزع / مستهلك','out']; if(isInType(typeOf(m))) return ['دخول','']; if(isOutType(typeOf(m))) return ['صرف مباشر','out']; return [typeOf(m)||'-','']; }

  window.inventoryViewProductV358=function(itemId){
    const st=syncOne(itemId) || compute(itemId); if(!st) return alert('المنتج غير موجود');
    const it=st.it; const unit=st.unit;
    const rows=st.ms.map(m=>{ const [lab,cls]=moveLabel(m); const q=qtyOf(m), c=moveCost(m,it), before=q*c; return `<tr><td>${E(S(m.date||m.movement_date||m.created_at||'-').slice(0,10))}</td><td>${E(m.batch_no ? m.batch_no : ('MOV-'+S(m.batch_id||m.id||'-')))}</td><td><span class="v358-chip ${cls}">${E(lab)}</span></td><td>${qty(q)}</td><td>${E(m.project_name||m.order_no||m.general_note||m.receiver||'-')}</td><td>${money(c)}</td><td>${money(before)}</td><td>${E(S(m.notes||'').replace(/\[[^\]]+\]/g,'').trim()||'-')}</td></tr>`; }).join('') || '<tr><td colspan="8">لا توجد حركات</td></tr>';
    const batchUsed = R2(Math.max(0, st.entered - st.remaining));
    openModal('عرض المنتج: '+(it.name||''), `
      <div class="v358-flex"><div class="v358-grid">
        <div class="v358-box"><small>اسم المنتج</small><b>${E(it.name||'-')}</b></div><div class="v358-box"><small>كود المنتج</small><b>${E(itemCode(it)||'-')}</b></div><div class="v358-box"><small>كود الشركة / المورد</small><b>${E(supplierCode(it)||'-')}</b></div>
        <div class="v358-box"><small>التصنيف</small><b>${E(it.category||'-')}</b></div><div class="v358-box"><small>الوحدة</small><b>${E(it.unit||'-')}</b></div><div class="v358-box"><small>دخل المخزون</small><b>${qty(st.entered)}</b></div>
        <div class="v358-box"><small>خرج من المخزون</small><b>${qty(st.out)}</b></div><div class="v358-box"><small>المستهلك / الموزع</small><b>${qty(st.consumed)}</b></div><div class="v358-box"><small>المرتجع للمخزن</small><b>${qty(st.returns)}</b></div>
        <div class="v358-box"><small>باقي لم يوزع</small><b>${qty(st.pending)}</b></div><div class="v358-box"><small>المتبقي الصحيح</small><b>${qty(st.remaining)}</b></div><div class="v358-box"><small>سعر الحبة قبل الضريبة</small><b>${money(unit)} ر.س</b></div>
        <div class="v358-box"><small>ضريبة الحبة</small><b>${money(unit*VAT)} ر.س</b></div><div class="v358-box"><small>سعر الحبة شامل</small><b>${money(unit*(1+VAT))} ر.س</b></div><div class="v358-box"><small>إجمالي المتبقي شامل</small><b>${money(st.remaining*unit*(1+VAT))} ر.س</b></div>
      </div><div class="v358-img">${imgHtml(it)}</div></div>
      <div class="v358-note">مثالك الصحيح: دخل 10، خرج 10، توزيع 5 + 4 = مستهلك 9، مرتجع 1، إذن المتبقي في المخزون = 1.</div>
      <h3>ملخص FIFO</h3><div class="table-wrap"><table class="v358-table"><thead><tr><th>الدفعة</th><th>دخل</th><th>خرج/مستهلك/مرتجع</th><th>متبقي</th><th>سعر قبل</th><th>إجمالي المتبقي قبل</th><th>ضريبة</th><th>شامل</th></tr></thead><tbody><tr><td>دفعة محسوبة</td><td>${qty(st.entered)}</td><td>${qty(batchUsed)}</td><td>${qty(st.remaining)}</td><td>${money(unit)}</td><td>${money(st.remaining*unit)}</td><td>${money(st.remaining*unit*VAT)}</td><td>${money(st.remaining*unit*(1+VAT))}</td></tr></tbody></table></div>
      <h3>حركات المنتج</h3><div class="table-wrap"><table class="v358-table"><thead><tr><th>التاريخ</th><th>رقم الحركة</th><th>النوع</th><th>الكمية</th><th>المشروع / الجهة</th><th>سعر الحبة</th><th>الإجمالي</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table></div>
    `);
  };

  // اربط كل أسماء العرض القديمة بنفس العرض الجديد، لأن بعض الأزرار تستدعي أسماء قديمة.
  ['inventoryOpenItemSmart','v118ShowProductDetail','inventoryViewProductV346','inventoryViewProductV347','inventoryViewProductV355','inventoryViewProductV356','inventoryViewProductV357'].forEach(name=>{ window[name]=window.inventoryViewProductV358; });

  function forceInvoiceImageField(){
    ensureCss();
    const card=$('stockBatchCardV148'); if(!card) return;
    // أظهر الحقل الأصلي إن وجد
    const originalInput=card.querySelector('input[type="file"][onchange*="stockBatchHandleImageV148"]');
    if(originalInput){
      let box=originalInput.closest('div') || originalInput.parentElement;
      while(box && box!==card && !box.querySelector('label')) box=box.parentElement;
      if(box){ box.style.display=''; box.hidden=false; box.classList.remove('v161-hide-advanced-field','v160-optional-stock-field'); }
      const upload=originalInput.closest('.stage-upload'); if(upload){ upload.style.display='inline-flex'; upload.hidden=false; }
    }
    const preview=$('batchLineImagePreviewV148');
    if(preview){ preview.style.display='block'; preview.hidden=false; preview.classList.remove('v161-hide-advanced-field','v160-optional-stock-field'); }
    // إذا اختفى الحقل تمامًا، أضف حقل واضح بعد خانة السعر.
    if(!$('batchImageForceV358')){
      const price=$('batchUnitPriceV148');
      const host=price?.closest('div')?.parentElement || price?.closest('div') || card.querySelector('.nested-card') || card;
      const wrap=document.createElement('div'); wrap.id='batchImageForceV358'; wrap.className='v358-image-force';
      wrap.innerHTML='<label>صورة المنتج</label><input type="file" accept="image/*" onchange="stockBatchHandleImageV148(this)"><small class="muted">ارفع صورة المنتج من هنا لتظهر في بطاقة المنتج وعرض المنتج.</small>';
      if(host) host.insertAdjacentElement('afterend', wrap);
    }
  }

  // تأكيد حفظ الصورة مع السطر حتى لو باتش قديم لم يربطها.
  function patchInvoiceLineImage(){
    const oldAdd=window.stockBatchAddLineV148;
    if(oldAdd && !oldAdd.__v358ImageWrapped){
      window.stockBatchAddLineV148=function(){
        const before=(window.batchLinesV148||[]).length;
        const out=oldAdd.apply(this, arguments);
        try{
          const lines=window.batchLinesV148 || [];
          const img=(window.pendingLineImageV148 || window.inventoryItemImageData || '');
          // لا نستطيع أخذ pending بعد التفريغ في بعض النسخ؛ لذلك نترك oldAdd الأصلي إن كان قد سجله.
          lines.forEach(l=>{ if(l && !l.image_url && img) l.image_url=img; });
        }catch(_){ }
        setTimeout(forceInvoiceImageField,80);
        return out;
      };
      window.stockBatchAddLineV148.__v358ImageWrapped=true;
    }
  }

  function boot(){
    ensureCss();
    try{ window.rebuildStockV358(); }catch(e){ console.warn('v358 rebuild', e); }
    forceInvoiceImageField(); patchInvoiceLineImage();
  }
  const wrapNames=['financeRenderAll','financeShowTab','openStockBatchModalV149','ensureSmartInventoryUiV149'];
  wrapNames.forEach(name=>{
    const old=window[name];
    if(typeof old==='function' && !old.__v358Wrapped){
      window[name]=function(){ const r=old.apply(this, arguments); setTimeout(boot,80); setTimeout(forceInvoiceImageField,350); return r; };
      window[name].__v358Wrapped=true;
    }
  });
  document.addEventListener('click', ev=>{ if(ev.target?.closest?.('button,[onclick]')) setTimeout(()=>{forceInvoiceImageField(); patchInvoiceLineImage();},120); }, true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',()=>setTimeout(boot,500));
  setInterval(()=>{ const card=$('stockBatchCardV148'); if(card && (card.classList.contains('v149-open') || card.offsetParent!==null)) forceInvoiceImageField(); }, 1500);
  console.log('Tasneef v358 consumed + invoice image final loaded');
})();
