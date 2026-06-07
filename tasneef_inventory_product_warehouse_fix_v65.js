(function(){
  'use strict';
  if(window.__tasneefInventoryProductWarehouseFixV65) return;
  window.__tasneefInventoryProductWarehouseFixV65 = true;

  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(String(v ?? 0).replace(/[^\d.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
  const A = v => Array.isArray(v) ? v : [];
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const VAT = 0.15;

  function state(){ return window.financeProStateV15 || {items:[],movements:[],projects:[],users:[]}; }
  function user(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }
    catch(_){ return {}; }
  }
  function isWarehouse(){ return S(user().role) === 'warehouse_manager'; }
  function money(v){
    return (N(v)).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  }
  function safeJson(note){
    const raw = S(note);
    if(!raw.startsWith('finance_pro_v15:')) return {};
    try{ return JSON.parse(raw.replace('finance_pro_v15:','')) || {}; }catch(_){ return {}; }
  }
  function normType(v){
    const t = S(v).toLowerCase();
    const map = {
      'in':'in','داخل':'in','ادخال':'in','إدخال':'in',
      'out':'out','صرف':'out','خارج':'out',
      'consume':'consume','consumed':'consume','مستهلك':'consume','استهلاك':'consume',
      'return':'return','returned':'return','مرتجع':'return','مرجع':'return','مردود':'return',
      'waste':'waste','مهدور':'waste','هدر':'waste',
      'damaged':'damaged','تالف':'damaged',
      'scrap':'scrap','سكراب':'scrap'
    };
    return map[t] || t;
  }
  function typeLabel(t){
    return {in:'داخل',out:'صرف',consume:'مستهلك',return:'مرتجع',waste:'مهدور',damaged:'تالف',scrap:'سكراب'}[normType(t)] || S(t) || '-';
  }
  function itemCode(i){ return S(i && (i.product_code || i.serial_number || i.barcode || i.supplier_barcode || i.code)); }
  function itemCost(i){ return N(i && (i.unit_cost || i.cost || i.price)); }
  function moveCost(m){
    const item = state().items.find(i => S(i.id) === S(m.item_id) || S(i.name) === S(m.item_name));
    return N(m.unit_cost) || itemCost(item);
  }
  function moveDate(m){ return S(m.movement_date || S(m.created_at).slice(0,10)); }
  function productMoves(item){
    const keys = [S(item.id), S(item.name), itemCode(item), S(item.serial_number), S(item.barcode), S(item.supplier_barcode)].filter(Boolean);
    return A(state().movements).filter(m => {
      const vals = [S(m.item_id), S(m.item_name), S(m.product_code), S(m.barcode), S(m.code)].filter(Boolean);
      return vals.some(v => keys.includes(v));
    });
  }
  function flattenMove(m){
    const meta = safeJson(m.notes);
    const dist = A(meta.distribution).filter(d => N(d.qty) > 0);
    if(!dist.length) return [{
      base:m,
      movement_type:normType(m.movement_type),
      quantity:N(m.quantity),
      receiver:S(m.receiver),
      date:moveDate(m),
      item_name:S(m.item_name),
      item_id:S(m.item_id),
      project_name:S(m.project_name),
      order_no:S(m.order_no),
      center:S(m.cost_center || meta.center),
      note:S(meta.note || m.reason || ''),
      unit_cost:moveCost(m),
      is_distribution:false
    }];
    return dist.map(d => ({
      base:m,
      movement_type:normType(d.type || m.movement_type),
      quantity:N(d.qty),
      receiver:S(m.receiver),
      date:moveDate(m),
      item_name:S(m.item_name),
      item_id:S(m.item_id),
      project_name:S(d.projectName || d.otherName || m.project_name),
      order_no:S(d.orderNo || m.order_no),
      center:S(d.center || m.cost_center || meta.center),
      note:S(d.note || meta.note || m.reason || ''),
      unit_cost:moveCost(m),
      is_distribution:true
    }));
  }
  function productStats(item){
    const base = productMoves(item);
    const rows = base.flatMap(flattenMove);
    const inQty = base.filter(m => normType(m.movement_type) === 'in').reduce((a,m)=>a+N(m.quantity),0);
    const baseReturn = base.filter(m => normType(m.movement_type) === 'return').reduce((a,m)=>a+N(m.quantity),0);
    let outQty = 0, consumeQty = 0, returnQty = baseReturn, wasteQty = 0;
    base.forEach(m => {
      const t = normType(m.movement_type);
      const dist = flattenMove(m).filter(r => r.is_distribution);
      if(dist.length){
        dist.forEach(r => {
          const rt = normType(r.movement_type);
          if(rt === 'consume'){ consumeQty += N(r.quantity); outQty += N(r.quantity); }
          else if(['waste','damaged','scrap'].includes(rt)){ wasteQty += N(r.quantity); outQty += N(r.quantity); }
          else if(rt === 'return'){ returnQty += N(r.quantity); }
          else if(rt === 'out'){ outQty += N(r.quantity); }
        });
      }else{
        if(t === 'out'){ outQty += N(m.quantity); }
        else if(t === 'consume'){ consumeQty += N(m.quantity); outQty += N(m.quantity); }
        else if(['waste','damaged','scrap'].includes(t)){ wasteQty += N(m.quantity); outQty += N(m.quantity); }
      }
    });
    const balance = Math.max(0, inQty - outQty + baseReturn);
    return {base, rows, inQty, outQty, consumeQty, returnQty, wasteQty, balance};
  }
  function tableRows(rows, mode){
    const filtered = rows.filter(r => {
      const t = normType(r.movement_type);
      if(mode === 'in') return t === 'in';
      if(mode === 'out') return ['out','consume','waste','damaged','scrap'].includes(t);
      if(mode === 'consume') return t === 'consume';
      if(mode === 'return') return t === 'return';
      if(mode === 'waste') return ['waste','damaged','scrap'].includes(t);
      return true;
    });
    return filtered.map(r => {
      const value = ['consume','waste','damaged','scrap'].includes(normType(r.movement_type)) ? N(r.quantity)*N(r.unit_cost) : 0;
      return `<tr><td>${E(r.date||'-')}</td><td>${E(typeLabel(r.movement_type))}</td><td>${N(r.quantity)}</td><td>${E(r.receiver||'-')}</td><td>${E(r.center||'-')}</td><td>${E(r.project_name||'-')}</td><td>${E(r.order_no||'-')}</td><td>${E(r.note||'-')}</td><td>${money(value)}</td></tr>`;
    }).join('') || '<tr><td colspan="9">لا توجد بيانات</td></tr>';
  }
  function openModal(title, pages){
    const id = 'finProductStableV65_' + Date.now();
    document.body.insertAdjacentHTML('beforeend', `<div id="${id}" class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(1120px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>${E(title)}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-actions">${pages.map((p,i)=>`<button type="button" class="${i?'light':''}" data-page="${i}">${E(p.title)}</button>`).join('')}</div><div id="${id}_body">${pages[0]?.html || ''}</div></div></div>`);
    const root = document.getElementById(id);
    root.querySelectorAll('[data-page]').forEach(btn => {
      btn.onclick = () => {
        const p = pages[N(btn.dataset.page)] || pages[0];
        root.querySelector('#'+id+'_body').innerHTML = p.html || '';
        root.querySelectorAll('[data-page]').forEach(b => b.classList.add('light'));
        btn.classList.remove('light');
      };
    });
  }

  window.financeProShowProductV15 = function(id){
    const key = S(id);
    const item = A(state().items).find(i =>
      S(i.id) === key || S(i.name) === key || itemCode(i) === key ||
      S(i.serial_number) === key || S(i.barcode) === key || S(i.supplier_barcode) === key
    );
    if(!item){
      if(typeof window.msg === 'function') window.msg('المنتج غير موجود، حدث البيانات ثم حاول مرة أخرى','err');
      else alert('المنتج غير موجود');
      return;
    }
    const st = productStats(item);
    const img = S(item.image_url) ? `<img src="${E(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">` : '';
    const head = `<div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(st.balance)}</b></div><div class="fin-card fin-kpi"><small>الداخل</small><b>${N(st.inQty)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${N(st.outQty)}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${N(st.consumeQty)}</b></div><div class="fin-card fin-kpi"><small>المرتجع</small><b>${N(st.returnQty)}</b></div><div class="fin-card fin-kpi"><small>تالف / هدر / سكراب</small><b>${N(st.wasteQty)}</b></div></div><div class="fin-soft">الكود: <b>${E(itemCode(item)||'-')}</b> | الوحدة: <b>${E(item.unit||'-')}</b> | النوع: <b>${E(item.item_type||item.type||'-')}</b></div>`;
    const table = mode => `<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم/المورد</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${tableRows(st.rows, mode)}</tbody></table></div>`;
    openModal('بيانات المنتج: ' + (item.name || '-'), [
      {title:'الملخص', html:head},
      {title:'الداخل', html:table('in')},
      {title:'الخارج', html:table('out')},
      {title:'المستهلك', html:table('consume')},
      {title:'المرتجع', html:table('return')},
      {title:'تالف / هدر / سكراب', html:table('waste')},
      {title:'تقرير المنتج', html:`<div class="fin-card"><h3>تقرير خاص بالمنتج</h3><p class="fin-soft">يوضح الدخول والخروج الفعلي، ومن استهلك المنتج، وأين تم الاستهلاك.</p></div>${table('all')}`}
    ]);
  };

  function allReportRows(){
    return A(state().movements).flatMap(flattenMove);
  }
  function renderWarehouseReportsV65(){
    if(!isWarehouse()) return false;
    const body = document.getElementById('finBodyV15');
    if(!body) return false;
    document.querySelectorAll('#finTabsV15 button[data-fin-tab-v15]').forEach(btn => {
      btn.classList.toggle('active', S(btn.getAttribute('data-fin-tab-v15')) === 'reports');
    });
    const rows = allReportRows().filter(r => ['in','consume','return','waste','damaged','scrap'].includes(normType(r.movement_type)));
    const productMap = {};
    rows.forEach(r => {
      const k = S(r.item_name) || '-';
      productMap[k] = productMap[k] || {in:0, consume:0, return:0, waste:0};
      const t = normType(r.movement_type);
      if(t === 'in') productMap[k].in += N(r.quantity);
      else if(t === 'consume') productMap[k].consume += N(r.quantity);
      else if(t === 'return') productMap[k].return += N(r.quantity);
      else productMap[k].waste += N(r.quantity);
    });
    const productRows = Object.keys(productMap).map(name => `<tr><td>${E(name)}</td><td>${productMap[name].in}</td><td>${productMap[name].consume}</td><td>${productMap[name].return}</td><td>${productMap[name].waste}</td></tr>`).join('');
    const moveRows = rows.map(r => `<tr><td>${E(r.date||'-')}</td><td>${E(typeLabel(r.movement_type))}</td><td>${E(r.item_name||'-')}</td><td>${N(r.quantity)}</td><td>${E(r.receiver||'-')}</td><td>${E(r.project_name||'-')}</td><td>${E(r.order_no||'-')}</td></tr>`).join('');
    body.innerHTML = `<div class="fin-card" id="warehouseReportsStableV65"><h3>تقارير مدير المخزون</h3><div class="fin-grid three"><div class="fin-card fin-kpi"><small>حركات ظاهرة</small><b>${rows.length}</b></div><div class="fin-card fin-kpi"><small>منتجات في التقرير</small><b>${Object.keys(productMap).length}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${rows.filter(r=>normType(r.movement_type)==='consume').reduce((a,r)=>a+N(r.quantity),0)}</b></div></div><h3>تقرير المنتجات</h3><div class="fin-table"><table><thead><tr><th>المنتج</th><th>داخل</th><th>مستهلك</th><th>مرتجع</th><th>تالف/هدر/سكراب</th></tr></thead><tbody>${productRows || '<tr><td colspan="5">لا توجد بيانات</td></tr>'}</tbody></table></div><h3>حركة المخزون</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>الحركة</th><th>المنتج</th><th>الكمية</th><th>المستلم/المورد</th><th>المشروع/الخدمة</th><th>الأوردر</th></tr></thead><tbody>${moveRows || '<tr><td colspan="7">لا توجد حركات</td></tr>'}</tbody></table></div></div>`;
    return false;
  }

  function patchWarehouseTabs(){
    const old = window.financeProTabV15;
    if(typeof old !== 'function' || old.__inventoryProductWarehouseFixV65) return;
    const wrapped = async function(tab){
      if(isWarehouse() && S(tab) === 'reports'){
        sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', 'reports');
        renderWarehouseReportsV65();
        setTimeout(renderWarehouseReportsV65, 80);
        setTimeout(renderWarehouseReportsV65, 300);
        return false;
      }
      return old.apply(this, arguments);
    };
    wrapped.__inventoryProductWarehouseFixV65 = true;
    window.financeProTabV15 = wrapped;
    try{ financeProTabV15 = wrapped; }catch(_){}
  }
  function watchdog(){
    patchWarehouseTabs();
    if(isWarehouse() && S(sessionStorage.getItem('tasneef_warehouse_fin_tab_v44')) === 'reports'){
      const body = document.getElementById('finBodyV15');
      if(body && (!body.querySelector('#warehouseReportsStableV65') || /إضافة مخزون|الموردين|صرف منتج/.test(S(body.textContent)))){
        renderWarehouseReportsV65();
      }
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target && e.target.closest && e.target.closest('#finTabsV15 button[data-fin-tab-v15]');
    if(!btn || !isWarehouse()) return;
    const tab = S(btn.getAttribute('data-fin-tab-v15'));
    if(tab === 'reports'){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', 'reports');
      renderWarehouseReportsV65();
      setTimeout(renderWarehouseReportsV65, 120);
    }
  }, true);

  setInterval(watchdog, 700);
  document.addEventListener('DOMContentLoaded', () => setTimeout(watchdog, 1200));
  setTimeout(watchdog, 1800);
})();
