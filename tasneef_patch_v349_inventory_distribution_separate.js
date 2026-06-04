/* TASNEEF v349 - Separate product movement from project distribution
   الهدف:
   - إضافة المنتج للحركة لا تجبر المستخدم على التوزيع فورًا.
   - التوزيع على المشاريع/الأوردر/عام يكون خطوة مستقلة لاحقًا.
   - عند التوزيع لاحقًا يتم خصم الكمية من سطر "بانتظار توزيع" حتى لا تتضاعف التكلفة أو الرصيد.
*/
(function(){
  'use strict';
  if(window.__tasneefV349DistributionSeparate) return; window.__tasneefV349DistributionSeparate = true;

  const LS = {items:'tasneef_v312_items', moves:'tasneef_v312_moves'};
  const $ = id => document.getElementById(id);
  const parse = (k,d=[]) => { try { return JSON.parse(localStorage.getItem(k)||'null') || d; } catch(_) { return d; } };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const n = v => Number(String(v ?? '').replace(/,/g,'')) || 0;
  const r2 = v => Math.round(n(v) * 100) / 100;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const OUT_TYPES = new Set(['صرف','استهلاك','هدر','تالف','سكراب']);
  const MOVE_TYPES = ['صرف','استهلاك','هدر','تالف','سكراب','مرتجع'];

  function items(){ return parse(LS.items).map(i => ({...i, batches:Array.isArray(i.batches)?i.batches:[]})); }
  function moves(){ return parse(LS.moves); }
  function setMoves(v){ save(LS.moves, v); }
  function itemById(id){ return items().find(x => String(x.id) === String(id)) || null; }
  function avgCost(it){
    if(!it) return 0;
    const rem = (it.batches||[]).filter(b => n(b.qty_remaining) > 0);
    const q = rem.reduce((a,b) => a + n(b.qty_remaining), 0);
    if(q > 0) return rem.reduce((a,b) => a + n(b.qty_remaining) * n(b.unit_after), 0) / q;
    return n(it.price_after || it.price_after_vat || it.price || 0);
  }
  function groupById(batch){
    return moves().filter(m => String(m.batch_id || m.id) === String(batch));
  }
  function itemOptions(selected=''){
    return '<option value="">اختر المنتج</option>' + items().map(i => `<option value="${esc(i.id)}" ${String(selected)===String(i.id)?'selected':''}>${esc(i.code||i.product_code||'')} - ${esc(i.name||'')} (${n(i.qty ?? i.quantity)} ${esc(i.unit||'')})</option>`).join('');
  }
  function isPendingLine(m){
    const txt = `${m.distribution_status||''} ${m.notes||''} ${m.general_note||''}`;
    return txt.includes('pending') || txt.includes('[PENDING_DISTRIBUTION]') || txt.includes('بانتظار توزيع');
  }
  function isAllocLine(m){
    const txt = `${m.distribution_status||''} ${m.notes||''}`;
    return txt.includes('allocated') || txt.includes('[ALLOCATED]') || (!isPendingLine(m) && (m.cost_type === 'FM' || m.cost_type === 'CN'));
  }
  function itemMovementStats(batch, itemId){
    const lines = groupById(batch).filter(m => String(m.item_id) === String(itemId));
    const pending = lines.filter(m => OUT_TYPES.has(m.type) && isPendingLine(m)).reduce((a,m)=>a+n(m.qty),0);
    const allocated = lines.filter(m => OUT_TYPES.has(m.type) && !isPendingLine(m)).reduce((a,m)=>a+n(m.qty),0);
    const returned = lines.filter(m => m.type === 'مرتجع').reduce((a,m)=>a+n(m.qty),0);
    return {pending:r2(pending), allocated:r2(allocated), returned:r2(returned), total:r2(pending+allocated)};
  }
  function firstGroupMeta(batch){
    const g = groupById(batch)[0] || {};
    return {
      batch_id: batch,
      batch_no: g.batch_no || ('MOV-' + String(batch).slice(-6).toUpperCase()),
      date: g.date || new Date().toISOString().slice(0,10),
      supervisor_id: g.supervisor_id || '',
      supervisor_name: g.supervisor_name || '',
      status: g.status || 'بانتظار',
      batch_notes: g.batch_notes || ''
    };
  }

  function deductPending(batch, itemId, qty){
    let need = r2(qty);
    const ms = moves();
    const pending = ms
      .filter(m => String(m.batch_id || m.id) === String(batch) && String(m.item_id) === String(itemId) && OUT_TYPES.has(m.type) && isPendingLine(m))
      .sort((a,b) => String(a.created_at||'').localeCompare(String(b.created_at||'')));
    for(const p of pending){
      if(need <= 0) break;
      const take = Math.min(n(p.qty), need);
      p.qty = r2(n(p.qty) - take);
      need = r2(need - take);
      p.notes = String(p.notes||'').replace('[PENDING_DISTRIBUTION]','').trim() + ' [PENDING_DISTRIBUTION]';
    }
    const clean = ms.filter(m => !(String(m.batch_id || m.id) === String(batch) && String(m.item_id) === String(itemId) && OUT_TYPES.has(m.type) && isPendingLine(m) && n(m.qty) <= 0));
    setMoves(clean);
    return r2(qty - need);
  }

  function applyStyle(){
    if($('v349Style')) return;
    const st = document.createElement('style');
    st.id = 'v349Style';
    st.textContent = `
      .v349-separate{border:1px dashed #d8b23a;background:#fffaf0;border-radius:16px;padding:12px;margin:12px 0}
      .v349-separate h3{margin:0 0 8px;color:#064a3a}.v349-grid{display:grid;grid-template-columns:1.3fr .65fr .8fr auto;gap:8px;align-items:end}
      .v349-grid input,.v349-grid select{width:100%;border:1px solid #cfe2dc;border-radius:12px;padding:10px;background:#fff}.v349-btn{border:0;border-radius:12px;background:#064a3a;color:white;font-weight:900;padding:10px 14px;cursor:pointer}.v349-help{font-size:12px;color:#6b5a16;margin-top:8px}.v349-chip{display:inline-flex;border-radius:999px;padding:5px 9px;background:#eaf7ef;color:#064a3a;margin:2px;font-weight:900;font-size:12px}.v349-chip.warn{background:#fff0cc;color:#8a6200}.v349-chip.blue{background:#e9f4ff;color:#075985}
      @media(max-width:850px){.v349-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  window.v349AddProductPending = function(batch){
    const itemId = $('v349GlobalItem')?.value || '';
    const qty = n($('v349GlobalQty')?.value);
    const type = $('v349GlobalType')?.value || 'صرف';
    if(!itemId) return alert('اختر المنتج');
    if(!qty) return alert('اكتب كمية المنتج');
    const it = itemById(itemId);
    if(!it) return alert('المنتج غير موجود');
    const meta = firstGroupMeta(batch);
    const row = {
      id: uid(),
      batch_id: meta.batch_id,
      batch_no: meta.batch_no,
      date: meta.date,
      created_at: new Date().toISOString(),
      supervisor_id: meta.supervisor_id,
      supervisor_name: meta.supervisor_name,
      status: meta.status,
      batch_notes: meta.batch_notes,
      item_id: itemId,
      item_name: it.name || '',
      qty,
      type,
      cost_type: 'GENERAL',
      project_id: '',
      order_no: '',
      general_note: 'بانتظار توزيع',
      distribution_status: 'pending',
      notes: '[PENDING_DISTRIBUTION] أضيف المنتج للحركة ولم يوزع على المشاريع بعد',
      unit_cost_override: r2(avgCost(it))
    };
    const ms = moves();
    ms.push(row);
    setMoves(ms);
    try{ if(typeof rebuildStockV337 === 'function') rebuildStockV337(); }catch(e){}
    if(typeof window.v337OpenMove === 'function') window.v337OpenMove(batch);
  };

  const oldAddAllocation = window.v337AddAllocation;
  window.v337AddAllocation = function(batch, itemId){
    const qty = n($(`v337AddQty_${itemId}`)?.value);
    const type = $(`v337AddType_${itemId}`)?.value || 'استهلاك';
    if(qty > 0 && OUT_TYPES.has(type)){
      const stats = itemMovementStats(batch, itemId);
      if(stats.pending > 0){
        if(qty > stats.pending){
          const ok = confirm(`الكمية المراد توزيعها ${qty} أكبر من المتبقي للتوزيع ${stats.pending}. هل تريد إضافة الفرق كصرف جديد؟`);
          if(!ok) return;
        }
        deductPending(batch, itemId, Math.min(qty, stats.pending));
      }
    }
    // نفذ الإضافة الأصلية كسطر توزيع فعلي على مشروع/أوردر/عام
    const before = moves().length;
    if(typeof oldAddAllocation === 'function') oldAddAllocation.apply(this, arguments);
    // علّم آخر سطر تمت إضافته كتوزيع حتى يظهر واضحًا في التقارير.
    try{
      const ms = moves();
      if(ms.length > before){
        const last = ms[ms.length-1];
        if(String(last.batch_id || last.id) === String(batch) && String(last.item_id) === String(itemId)){
          last.distribution_status = type === 'مرتجع' ? 'return' : 'allocated';
          last.notes = `${last.notes||''} ${type === 'مرتجع' ? '[RETURN]' : '[ALLOCATED]'}`.trim();
          setMoves(ms);
        }
      }
    }catch(e){}
  };

  function enhanceMoveModal(batch){
    applyStyle();
    const modal = document.querySelector('.v337-modal');
    if(!modal) return;

    // أضف ملخصًا واضحًا لكل منتج: موزع / متبقي للتوزيع.
    modal.querySelectorAll('.v337-product').forEach(section => {
      if(section.querySelector('.v349ProductSummary')) return;
      const addBtn = section.querySelector('button[onclick*="v337AddAllocation"]');
      const oc = addBtn?.getAttribute('onclick') || '';
      const itemId = (oc.match(/v337AddAllocation\('([^']+)'\s*,\s*'([^']+)'\)/)||[])[2];
      if(!itemId) return;
      const st = itemMovementStats(batch, itemId);
      const div = document.createElement('div');
      div.className = 'v349ProductSummary';
      div.style.padding = '0 12px 10px';
      div.innerHTML = `<span class="v349-chip blue">إجمالي الحركة: ${st.total}</span><span class="v349-chip">الموزع: ${st.allocated}</span><span class="v349-chip warn">المتبقي للتوزيع: ${st.pending}</span><span class="v349-chip">مرتجع: ${st.returned}</span>`;
      const head = section.querySelector('.v337-product-head');
      if(head) head.insertAdjacentElement('afterend', div);
      const h3 = section.querySelector('.v337-add h3');
      if(h3) h3.textContent = 'توزيع المنتج على مشروع / أوردر / عام أو تسجيل مرتجع';
      const note = section.querySelector('.v337-add .v337-mini');
      if(note) note.textContent = 'هذه الخطوة مستقلة: تستخدمها بعد معرفة أين استُهلك الصنف. عند توزيع كمية من منتج بانتظار توزيع، يتم خصمها من المتبقي حتى لا تتكرر التكلفة.';
      if(addBtn) addBtn.textContent = 'إضافة توزيع';
    });

    // استبدل منطقة إضافة منتج آخر داخل الحركة بمنطقة لا تطلب توزيع فوري.
    const adds = Array.from(modal.querySelectorAll('.v337-add'));
    const globalAdd = adds.find(x => (x.querySelector('h3')?.textContent || '').includes('إضافة منتج آخر'));
    if(globalAdd && !globalAdd.dataset.v349){
      globalAdd.dataset.v349 = '1';
      globalAdd.innerHTML = `
        <div class="v349-separate">
          <h3>إضافة منتج للحركة فقط</h3>
          <div class="v349-grid">
            <div><label>المنتج</label><select id="v349GlobalItem">${itemOptions()}</select></div>
            <div><label>الكمية</label><input id="v349GlobalQty" type="number" step="0.01" placeholder="مثال: 10"></div>
            <div><label>نوع الحركة</label><select id="v349GlobalType">${MOVE_TYPES.filter(x=>x!=='مرتجع').map(t=>`<option>${t}</option>`).join('')}</select></div>
            <button class="v349-btn" onclick="v349AddProductPending('${esc(batch)}')">إضافة المنتج للحركة</button>
          </div>
          <div class="v349-help">هذه الخطوة تحفظ المنتج والكمية داخل الحركة كـ <b>بانتظار توزيع</b>. لاحقًا، عند رجوع المشرف، افتح نفس الحركة ووزّع الكمية على مشروع أو أكثر. النظام يخصم التوزيع من المتبقي تلقائيًا ولا يكرر التكلفة.</div>
        </div>`;
    }
  }

  function wrapOpen(){
    if(!window.v337OpenMove || window.__v349WrappedOpenMove) return;
    window.__v349WrappedOpenMove = true;
    const oldOpen = window.v337OpenMove;
    window.v337OpenMove = function(id){
      const r = oldOpen.apply(this, arguments);
      setTimeout(()=>enhanceMoveModal(id), 60);
      setTimeout(()=>enhanceMoveModal(id), 250);
      return r;
    };
  }
  wrapOpen();
  ['DOMContentLoaded','load'].forEach(ev => window.addEventListener(ev, () => setTimeout(wrapOpen, ev==='load'?900:250)));
  setTimeout(wrapOpen, 1500);
  console.log('Tasneef v349 separate movement/product distribution loaded');
})();
