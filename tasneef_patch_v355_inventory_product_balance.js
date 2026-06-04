/* TASNEEF v355 - Product stock balance fix
   نطاق التعديل: عرض المنتج + حساب الرصيد من حركات المخزون فقط.
   يصلح حالة: صرف 10، استهلاك 9، مرتجع 1 => المتبقي 1، والمستهلك 9.
*/
(function(){
  'use strict';
  if(window.__tasneefV355InventoryProductBalance) return;
  window.__tasneefV355InventoryProductBalance = true;

  const LS_ITEMS = 'tasneef_v312_items';
  const LS_MOVES = 'tasneef_v312_moves';
  const VAT = 0.15;
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(S(v).replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const R2 = v => Math.round((N(v) + Number.EPSILON) * 100) / 100;
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money = v => N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  const parse = (k,d=[]) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch(_) { return d; } };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const items = () => parse(LS_ITEMS, []).map(i => ({...i, batches: Array.isArray(i.batches) ? i.batches : []}));
  const moves = () => parse(LS_MOVES, []);
  const setItems = v => save(LS_ITEMS, v);
  const setMoves = v => save(LS_MOVES, v);

  const OUT_TYPES = new Set(['صرف','استهلاك','هدر','تالف','سكراب','out','consume']);
  const RET_TYPES = new Set(['مرتجع','return','إرجاع','ارجاع']);
  const IN_TYPES  = new Set(['إدخال','ادخال','دخول','شراء','توريد','in']);
  const isOut = t => OUT_TYPES.has(S(t));
  const isReturn = t => RET_TYPES.has(S(t));
  const isIn = t => IN_TYPES.has(S(t));
  const isApproved = m => !S(m.status) || ['معتمد','تم الصرف','approved','مؤكد','حاضر'].includes(S(m.status));
  const itemIdOf = m => S(m.item_id || m.product_id || m.inventory_item_id);
  const qtyOf = m => N(m.qty || m.quantity);
  const typeOf = m => S(m.type || m.movement_type || m.kind);
  const costOfItem = it => N(it.unit_before || it.price_before_vat || it.unit_cost_before || it.unit_cost || it.cost || it.price_before || it.price || 0);
  const costOfMove = (m,it) => {
    if(N(m.unit_cost_override)) return N(m.unit_cost_override);
    if(N(m.unit_before)) return N(m.unit_before);
    if(N(m.unit_cost_before)) return N(m.unit_cost_before);
    if(N(m.unit_cost)) return N(m.unit_cost);
    return costOfItem(it);
  };
  const productCode = it => S(it.code || it.product_code || it.serial_number || it.barcode || it.supplier_barcode || '');
  const supplierCode = it => S(it.company_code || it.supplier_code || it.supplier_barcode || it.barcode || '');
  const imgHtml = it => {
    const src = S(it.image_data || it.image_url || it.image || '');
    return src ? `<img src="${E(src)}" alt="صورة المنتج" style="width:100%;height:100%;object-fit:contain">` : '<span style="color:#789">لا توجد صورة</span>';
  };

  function css(){
    if(document.getElementById('v355ProductBalanceCss')) return;
    const st = document.createElement('style');
    st.id = 'v355ProductBalanceCss';
    st.textContent = `
      .v355-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:1000000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:18px;direction:rtl}
      .v355-panel{width:min(1100px,96vw);background:#fff;border-radius:22px;border:1px solid #d7e9e2;box-shadow:0 18px 70px rgba(0,0,0,.26);padding:16px}.v355-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e0eee9;padding-bottom:10px;margin-bottom:12px}.v355-head h2{margin:0;color:#073f33}.v355-btn{border:0;border-radius:11px;padding:9px 14px;font-weight:900;cursor:pointer;background:#074d3f;color:#fff}.v355-btn.red{background:#bd3434}.v355-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;flex:1}.v355-box{background:#f8fcfa;border:1px solid #d9eae4;border-radius:14px;padding:11px;min-height:58px}.v355-box small{display:block;color:#718079;margin-bottom:5px}.v355-box b{color:#073f33;font-size:17px}.v355-img{width:230px;height:235px;background:#eef8f4;border:1px solid #d9eae4;border-radius:18px;display:grid;place-items:center;overflow:hidden}.v355-flex{display:flex;gap:14px;align-items:flex-start;justify-content:space-between}.v355-note{background:#fff6df;border:1px dashed #d9a431;color:#664400;border-radius:13px;padding:10px;margin:12px 0;font-weight:800}.v355-table{width:100%;border-collapse:separate;border-spacing:0 8px}.v355-table th{background:#eef8f4;color:#073f33;padding:9px;text-align:center}.v355-table td{background:#fff;border-top:1px solid #d9eae4;border-bottom:1px solid #d9eae4;padding:9px;text-align:center}.v355-table td:first-child{border-right:1px solid #d9eae4;border-radius:0 12px 12px 0}.v355-table td:last-child{border-left:1px solid #d9eae4;border-radius:12px 0 0 12px}.v355-chip{display:inline-block;border-radius:999px;padding:4px 9px;background:#eaf8f4;color:#064737;font-weight:900}.v355-chip.out{background:#fff0cf;color:#7a5200}.v355-chip.ret{background:#eaf2ff;color:#174c8b}
      @media(max-width:850px){.v355-flex{flex-direction:column}.v355-img{width:100%;height:180px}.v355-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(st);
  }

  function modal(title, body){
    css();
    document.querySelector('.v355-modal')?.remove();
    const d = document.createElement('div');
    d.className = 'v355-modal';
    d.innerHTML = `<div class="v355-panel"><div class="v355-head"><button class="v355-btn red" onclick="this.closest('.v355-modal').remove()">إغلاق</button><h2>${E(title)}</h2></div>${body}</div>`;
    document.body.appendChild(d);
  }

  function batchInitials(it){
    const batches = Array.isArray(it.batches) ? it.batches : [];
    const rows = batches.map((b,idx) => ({
      id: S(b.id || `B${idx+1}`),
      label: S(b.label || b.name || `الدفعة ${idx+1}`),
      source: S(b.source || ''),
      date: S(b.date || b.created_at || '-').slice(0,10),
      qty_initial: N(b.qty_initial || b.qty || b.quantity || b.entered || b.qty_remaining),
      qty_remaining: N(b.qty_initial || b.qty || b.quantity || b.entered || b.qty_remaining),
      unit_before: N(b.unit_before || b.price_before_vat || b.unit_cost_before || b.unit_cost || b.unit_after || costOfItem(it))
    })).filter(b => b.qty_initial > 0);
    if(rows.length) return rows;

    const ms = moves().filter(m => itemIdOf(m) === S(it.id) && isApproved(m));
    const out = ms.filter(m => isOut(typeOf(m))).reduce((a,m)=>a+qtyOf(m),0);
    const ret = ms.filter(m => isReturn(typeOf(m))).reduce((a,m)=>a+qtyOf(m),0);
    const enteredFromIn = ms.filter(m => isIn(typeOf(m))).reduce((a,m)=>a+qtyOf(m),0);
    const guessed = enteredFromIn || Math.max(N(it.original_quantity || it.initial_quantity || it.entered_qty || 0), N(it.quantity) + out - ret, N(it.quantity));
    return guessed ? [{id:'initial',label:'دفعة تأسيسية',source:'تأسيسية',date:'-',qty_initial:guessed,qty_remaining:guessed,unit_before:costOfItem(it)}] : [];
  }

  function computeStats(itemId){
    const allItems = items();
    const it = allItems.find(i => S(i.id) === S(itemId));
    if(!it) return null;
    const ms = moves().filter(m => itemIdOf(m) === S(itemId) && isApproved(m))
      .sort((a,b) => S(a.date || a.movement_date || a.created_at).localeCompare(S(b.date || b.movement_date || b.created_at)) || S(a.id).localeCompare(S(b.id)));
    const batches = batchInitials(it);
    let outQty = 0, retQty = 0, inQtyMoves = 0, outValue = 0, retValue = 0;

    // دخول جديد من حركات إدخال حقيقية، إذا لم تكن موجودة أصلًا في الدفعات.
    ms.filter(m => isIn(typeOf(m))).forEach(m => {
      inQtyMoves += qtyOf(m);
      if(!batches.some(b => S(b.source_id) === S(m.id))){
        batches.push({id:`move-${m.id}`, label:`دفعة حركة ${m.id}`, source:'دخول', date:S(m.date||m.movement_date||m.created_at||'-').slice(0,10), qty_initial:qtyOf(m), qty_remaining:qtyOf(m), unit_before:costOfMove(m,it)});
      }
    });

    ms.forEach(m => {
      const t = typeOf(m), q = qtyOf(m);
      if(!q) return;
      if(isOut(t)){
        outQty += q;
        let need = q, amount = 0;
        for(const b of batches){
          if(need <= 0) break;
          const take = Math.min(N(b.qty_remaining), need);
          if(take > 0){
            b.qty_remaining = R2(N(b.qty_remaining) - take);
            need = R2(need - take);
            amount += take * N(costOfMove(m,it) || b.unit_before || costOfItem(it));
          }
        }
        if(need > 0) amount += need * costOfMove(m,it);
        outValue += amount;
      }else if(isReturn(t)){
        retQty += q;
        const c = costOfMove(m,it);
        retValue += q * c;
        // المرتجع داخل حركة الصرف يرجع للمخزون، لذلك يزيد المتبقي مرة واحدة فقط.
        batches.push({id:`return-${m.id}`, label:'مرتجع للمخزون', source:'مرتجع', date:S(m.date||m.movement_date||m.created_at||'-').slice(0,10), qty_initial:q, qty_remaining:q, unit_before:c});
      }
    });

    const entered = batches.filter(b => b.source !== 'مرتجع').reduce((a,b)=>a+N(b.qty_initial),0);
    const remaining = batches.reduce((a,b)=>a+N(b.qty_remaining),0);
    const remainingValue = batches.reduce((a,b)=>a+N(b.qty_remaining)*N(b.unit_before),0);
    const consumed = Math.max(0, R2(outQty - retQty));
    return {it, batches, moves:ms, entered:R2(entered), out:R2(outQty), returns:R2(retQty), consumed:R2(consumed), remaining:R2(remaining), remainingValue:R2(remainingValue), outValue:R2(outValue), retValue:R2(retValue)};
  }

  function syncItemQty(itemId){
    const st = computeStats(itemId); if(!st) return;
    const all = items();
    const idx = all.findIndex(i => S(i.id) === S(itemId));
    if(idx >= 0){
      all[idx].qty = st.remaining;
      all[idx].quantity = st.remaining;
      all[idx].stock = st.remaining;
      all[idx].batches = st.batches.map(b => ({...b, qty_remaining:R2(b.qty_remaining)}));
      setItems(all);
    }
  }

  window.rebuildStockV355 = function(){
    items().forEach(i => syncItemQty(i.id));
    return items();
  };

  window.inventoryOpenItemSmart = window.v118ShowProductDetail = window.inventoryViewProductV355 = function(itemId){
    const st = computeStats(itemId);
    if(!st) return alert('المنتج غير موجود');
    syncItemQty(itemId);
    const it = {...st.it, quantity:st.remaining, qty:st.remaining};
    const unit = costOfItem(it);
    const batchRows = st.batches.map((b,idx) => {
      const used = R2(N(b.qty_initial) - N(b.qty_remaining));
      const before = N(b.qty_remaining) * N(b.unit_before);
      return `<tr><td>${E(b.label || `الدفعة ${idx+1}`)}</td><td>${E(b.source||'-')}</td><td>${E(b.date||'-')}</td><td>${N(b.qty_initial)}</td><td>${used}</td><td>${N(b.qty_remaining)}</td><td>${money(b.unit_before)}</td><td>${money(before)}</td><td>${money(before*VAT)}</td><td>${money(before*(1+VAT))}</td></tr>`;
    }).join('') || '<tr><td colspan="10">لا توجد دفعات</td></tr>';
    const moveRows = st.moves.map(m => {
      const t = typeOf(m);
      const cls = isReturn(t) ? 'ret' : isOut(t) ? 'out' : '';
      const label = isReturn(t) ? 'مرتجع' : isOut(t) ? 'صرف / استهلاك' : 'دخول';
      const q = qtyOf(m), c = costOfMove(m,it), before = q*c;
      return `<tr><td>${E(S(m.date||m.movement_date||m.created_at||'-').slice(0,10))}</td><td>MOV-${E(m.batch_no || m.batch_id || m.id || '-')}</td><td><span class="v355-chip ${cls}">${label}</span></td><td>${q}</td><td>${E(m.project_name || (typeof window.financeProjectName==='function' ? window.financeProjectName(m.project_id) : '') || m.order_no || m.general_note || '-')}</td><td>${money(c)}</td><td>${money(before)}</td><td>${E(S(m.notes||'').replace(/\[[^\]]+\]/g,'').trim() || '-')}</td></tr>`;
    }).join('') || '<tr><td colspan="8">لا توجد حركات</td></tr>';

    modal('عرض المنتج: ' + (it.name || ''), `
      <div class="v355-flex">
        <div class="v355-grid">
          <div class="v355-box"><small>اسم المنتج</small><b>${E(it.name||'-')}</b></div>
          <div class="v355-box"><small>كود المنتج</small><b>${E(productCode(it)||'-')}</b></div>
          <div class="v355-box"><small>كود الشركة / المورد</small><b>${E(supplierCode(it)||'-')}</b></div>
          <div class="v355-box"><small>التصنيف</small><b>${E(it.category||'-')}</b></div>
          <div class="v355-box"><small>الوحدة</small><b>${E(it.unit||'-')}</b></div>
          <div class="v355-box"><small>المورد</small><b>${E(it.supplier||'-')}</b></div>
          <div class="v355-box"><small>دخل المخزون</small><b>${st.entered}</b></div>
          <div class="v355-box"><small>خرج من المخزون</small><b>${st.out}</b></div>
          <div class="v355-box"><small>المرتجع</small><b>${st.returns}</b></div>
          <div class="v355-box"><small>المستهلك</small><b>${st.consumed}</b></div>
          <div class="v355-box"><small>المتبقي الصحيح</small><b>${st.remaining}</b></div>
          <div class="v355-box"><small>سعر الحبة قبل الضريبة</small><b>${money(unit)}</b></div>
          <div class="v355-box"><small>ضريبة الحبة</small><b>${money(unit*VAT)}</b></div>
          <div class="v355-box"><small>سعر الحبة شامل</small><b>${money(unit*(1+VAT))}</b></div>
          <div class="v355-box"><small>إجمالي المتبقي شامل</small><b>${money(st.remainingValue*(1+VAT))}</b></div>
        </div>
        <div class="v355-img">${imgHtml(it)}</div>
      </div>
      <div class="v355-note">الحساب الآن من سجلات حركة المخزون: المتبقي = دخل المخزون - خرج المخزون + المرتجع. والمستهلك = خرج المخزون - المرتجع. لذلك إذا صرفت 10 ورجع 1، يظهر المستهلك 9 والمتبقي 1.</div>
      <h3>دفعات المنتج حسب FIFO</h3>
      <div class="table-wrap"><table class="v355-table"><thead><tr><th>الدفعة</th><th>المصدر</th><th>التاريخ</th><th>دخل</th><th>خرج FIFO</th><th>متبقي</th><th>سعر قبل</th><th>إجمالي قبل</th><th>ضريبة</th><th>شامل</th></tr></thead><tbody>${batchRows}</tbody></table></div>
      <h3>حركات المنتج</h3>
      <div class="table-wrap"><table class="v355-table"><thead><tr><th>التاريخ</th><th>رقم الحركة</th><th>النوع</th><th>الكمية</th><th>المشروع / الجهة</th><th>سعر الحبة</th><th>الإجمالي</th><th>ملاحظات</th></tr></thead><tbody>${moveRows}</tbody></table></div>
    `);
  };

  function boot(){
    css();
    setTimeout(() => { try{ window.rebuildStockV355(); }catch(e){ console.warn('v355 rebuild', e); } }, 600);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  console.log('Tasneef v355 inventory product balance loaded');
})();
