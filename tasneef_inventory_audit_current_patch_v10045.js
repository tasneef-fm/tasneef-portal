/* Tasneef Inventory Audit Current Patch v10045
   PATCH ONLY - لا يستبدل admin.html ولا يمس الأوردرات.
   يضيف قسم الجرد على النسخة الحالية، ويحافظ على ظهوره حتى لو سكربت الصلاحيات أعاد بناء القائمة.
*/
(function(){
  'use strict';
  if (window.__tasneefInventoryAuditCurrentPatchV10045) return;
  window.__tasneefInventoryAuditCurrentPatchV10045 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const AUDITS = 'inventory_audits';
  const ITEMS = 'inventory_audit_items';
  const PAGE_ID = 'inventoryAudit';
  const NAV_ID = 'inventoryAuditNavV10045';

  let activeAudit = null;
  let selectedAudit = null;
  let selectedItems = [];
  let activeGuardOn = false;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => { const x = Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(x) ? x : 0; };
  const money = v => num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  const dateStr = v => v ? new Date(v).toLocaleString('ar-SA') : '';

  function api(path, options={}){
    return fetch(SUPABASE_URL + path, Object.assign({
      cache: 'no-store',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }
    }, options));
  }
  async function getJson(path){
    const r = await api(path, {method:'GET'});
    if(!r.ok) throw new Error(await r.text().catch(()=>String(r.status)));
    return r.json();
  }
  async function postJson(path, body){
    const r = await api(path, {method:'POST', body:JSON.stringify(body)});
    if(!r.ok) throw new Error(await r.text().catch(()=>String(r.status)));
    return r.json().catch(()=>null);
  }
  async function patchJson(path, body){
    const r = await api(path, {method:'PATCH', body:JSON.stringify(body)});
    if(!r.ok) throw new Error(await r.text().catch(()=>String(r.status)));
    return r.json().catch(()=>null);
  }

  function toast(msg, bad=false){
    let el = $('inventoryAuditMsgV10045');
    if(!el){ alert(msg); return; }
    el.className = bad ? 'msg err' : 'msg';
    el.textContent = msg;
    setTimeout(()=>{ if(el) el.textContent=''; }, 5000);
  }

  function currentUserName(){
    try{
      const keys = ['tasneef_user','tasneef_session','currentUser','user'];
      for(const k of keys){
        const raw = localStorage.getItem(k);
        if(raw){
          const u = JSON.parse(raw);
          const name = S(u.full_name || u.name || u.username || u.email || u.role);
          if(name) return name;
        }
      }
    }catch(_){ }
    return 'غير محدد';
  }

  function findSidebar(){
    return document.querySelector('.side') || document.querySelector('.sidebar') || document.querySelector('aside') || document.body;
  }

  function findNavByText(texts){
    const buttons = Array.from(document.querySelectorAll('button, a'));
    return buttons.find(b => {
      const t = S(b.textContent).replace(/\s+/g,' ');
      return texts.some(x => t.includes(x));
    });
  }

  function ensureNav(){
    const side = findSidebar();
    let btn = $(NAV_ID);
    if(!btn){
      btn = document.createElement('button');
      btn.id = NAV_ID;
      btn.type = 'button';
      btn.className = 'nav';
      btn.setAttribute('data-inventory-audit-nav','v10045');
      btn.textContent = 'الجرد';
      btn.onclick = () => showAuditPage();
    }
    btn.style.display = '';
    btn.hidden = false;
    btn.classList.remove('hidden');

    const finance = findNavByText(['المالية والمخزون']);
    const exportBtn = findNavByText(['التصدير والاستيراد']);
    const orders = findNavByText(['الأوردرات']);
    if(finance && finance.parentNode){
      if(finance.nextSibling !== btn) finance.insertAdjacentElement('afterend', btn);
    } else if(exportBtn && exportBtn.parentNode){
      exportBtn.insertAdjacentElement('beforebegin', btn);
    } else if(orders && orders.parentNode){
      orders.insertAdjacentElement('afterend', btn);
    } else if(!btn.parentNode){
      side.appendChild(btn);
    }
  }

  function ensurePage(){
    if($(PAGE_ID)) return;
    const content = document.querySelector('.content') || document.querySelector('main') || document.body;
    const sec = document.createElement('section');
    sec.id = PAGE_ID;
    sec.className = 'page hidden';
    sec.innerHTML = `
      <div class="card section-head">
        <div>
          <h2>قسم الجرد</h2>
          <p>جرد مستقل مرتبط بالمالية والمخزون. عند فتح جرد يتم قفل المالية والمخزون حتى إغلاق العملية.</p>
        </div>
        <div class="actions">
          <button type="button" onclick="tasneefInventoryAuditV10045.openCreate()">+ عملية جرد جديدة</button>
          <button type="button" class="light" onclick="tasneefInventoryAuditV10045.load()">تحديث</button>
        </div>
      </div>
      <div id="inventoryAuditMsgV10045"></div>
      <div id="inventoryAuditLockBoxV10045"></div>
      <div class="grid two">
        <div class="card"><h2>عمليات الجرد</h2><div id="inventoryAuditListV10045">جاري التحميل...</div></div>
        <div class="card"><h2>تفاصيل الجرد</h2><div id="inventoryAuditDetailsV10045"><div class="footer-note">اختر عملية جرد أو أنشئ عملية جديدة.</div></div></div>
      </div>
    `;
    content.appendChild(sec);
  }

  function setActiveNav(){
    document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active'));
    const btn = $(NAV_ID);
    if(btn) btn.classList.add('active');
  }

  function showAuditPage(){
    ensureNav(); ensurePage();
    try{
      document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
      const page = $(PAGE_ID);
      if(page) page.classList.remove('hidden');
      setActiveNav();
      load();
    }catch(e){
      console.error(e);
      toast('تعذر فتح قسم الجرد: ' + (e.message || e), true);
    }
  }

  function normalizeProduct(p){
    const code = S(p.code || p.product_code || p.item_code || p.sku || p.internal_code || p['الكود'] || p['كود المنتج']);
    const dist = S(p.distributor_code || p.supplier_code || p.vendor_code || p['كود الموزع']);
    const name = S(p.name || p.product_name || p.item_name || p.title || p['اسم المنتج'] || p['المنتج']);
    const unit = S(p.unit || p.unit_name || p['الوحدة']);
    const type = S(p.type || p.category || p.product_type || p['النوع']);
    const qty = num(p.current_quantity ?? p.quantity ?? p.qty ?? p.balance ?? p.stock ?? p['الرصيد الحالي'] ?? p['الكمية الحالية'] ?? p['الكمية']);
    const price = num(p.unit_price ?? p.price ?? p.cost ?? p.avg_cost ?? p['سعر الوحدة'] ?? p['السعر']);
    return {
      product_id: S(p.id || p.uuid || code || dist || name),
      product_code: code,
      distributor_code: dist,
      product_name: name || code || dist || 'منتج بدون اسم',
      product_type: type,
      unit,
      system_qty: qty,
      actual_qty: null,
      difference_qty: null,
      unit_price: price,
      total_system_value: qty * price,
      total_difference_value: null,
      status: 'not_counted',
      notes: ''
    };
  }

  async function fetchProducts(){
    const attempts = [
      '/rest/v1/inventory_items?select=*&order=updated_at.desc&limit=5000',
      '/rest/v1/inventory_items?select=*&limit=5000',
      '/rest/v1/products?select=*&limit=5000'
    ];
    for(const p of attempts){
      try{
        const arr = await getJson(p);
        if(Array.isArray(arr) && arr.length){
          return arr.map(normalizeProduct).filter(x => x.product_name || x.product_code || x.distributor_code);
        }
      }catch(e){ console.warn('inventory read failed', p, e.message || e); }
    }
    return [];
  }

  async function openCreate(){
    const title = prompt('اسم عملية الجرد', 'جرد المخزون');
    if(!title) return;
    const location = prompt('الموقع / المستودع', 'المستودع الرئيسي') || '';
    try{
      const auditNo = 'AUD-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000+Math.random()*9000);
      const created = await postJson('/rest/v1/' + AUDITS, [{
        audit_no: auditNo,
        title,
        location,
        notes: '',
        status: 'open',
        created_by_name: currentUserName()
      }]);
      const audit = Array.isArray(created) ? created[0] : null;
      const products = await fetchProducts();
      if(!products.length){
        toast('تم فتح الجرد، لكن لم أجد منتجات في جدول inventory_items. راجع ربط المخزون.', true);
      } else {
        const rows = products.map((p, i) => Object.assign({}, p, {
          audit_id: audit?.id,
          audit_no: auditNo,
          line_no: i + 1
        }));
        const chunkSize = 300;
        for(let i=0; i<rows.length; i+=chunkSize){
          await postJson('/rest/v1/' + ITEMS, rows.slice(i, i+chunkSize));
        }
      }
      toast('تم إنشاء عملية الجرد وقفل المالية والمخزون.');
      await load();
      if(audit) await selectAudit(audit.id);
    }catch(e){
      console.error(e);
      toast('فشل إنشاء الجرد: ' + (e.message || e), true);
    }
  }

  async function load(){
    ensureNav(); ensurePage();
    try{
      const audits = await getJson('/rest/v1/' + AUDITS + '?select=*&order=created_at.desc&limit=100');
      activeAudit = audits.find(a => a.status === 'open') || null;
      renderLock();
      renderList(audits);
      enforceFinanceLock();
    }catch(e){
      console.error(e);
      const box = $('inventoryAuditListV10045');
      if(box) box.innerHTML = '<div class="msg err">لم يتم تحميل الجرد. تأكد من تشغيل SQL v10045.</div>';
    }
  }

  function renderLock(){
    const box = $('inventoryAuditLockBoxV10045');
    if(!box) return;
    if(!activeAudit){ box.innerHTML = ''; return; }
    box.innerHTML = `<div class="msg" style="border-color:#f0d48d;background:#fff8e8;color:#7a4b00">
      المالية والمخزون مغلق للجرد المفتوح: <b>${esc(activeAudit.audit_no)}</b> - ${esc(activeAudit.title || '')}
    </div>`;
  }

  function renderList(audits){
    const box = $('inventoryAuditListV10045');
    if(!box) return;
    if(!audits.length){ box.innerHTML = '<div class="footer-note">لا توجد عمليات جرد.</div>'; return; }
    box.innerHTML = audits.map(a => `<div class="summary-item" style="margin-bottom:8px">
      <b>${esc(a.audit_no)}</b> <span class="badge ${a.status==='open'?'amber':'green'}">${a.status==='open'?'مفتوح':'مغلق'}</span><br>
      <small>${esc(a.title || '')} - ${esc(a.location || '')}</small><br>
      <small>${dateStr(a.started_at)}</small>
      <div class="actions"><button class="light" type="button" onclick="tasneefInventoryAuditV10045.selectAudit('${esc(a.id)}')">عرض</button></div>
    </div>`).join('');
  }

  async function selectAudit(id){
    try{
      const a = await getJson('/rest/v1/' + AUDITS + '?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1');
      selectedAudit = a[0] || null;
      selectedItems = await getJson('/rest/v1/' + ITEMS + '?audit_id=eq.' + encodeURIComponent(id) + '&select=*&order=line_no.asc&limit=5000');
      renderDetails();
    }catch(e){ toast('تعذر فتح تفاصيل الجرد: ' + (e.message || e), true); }
  }

  function itemStatus(it){
    if(it.actual_qty === null || it.actual_qty === undefined || it.actual_qty === '') return 'not_counted';
    const d = num(it.actual_qty) - num(it.system_qty);
    if(d === 0) return 'matched';
    return d < 0 ? 'shortage' : 'excess';
  }
  function statusAr(st){ return ({not_counted:'لم يتم جرده', matched:'مطابق', shortage:'نقص', excess:'زيادة'})[st] || st; }

  function renderDetails(){
    const box = $('inventoryAuditDetailsV10045');
    if(!box || !selectedAudit){ return; }
    const counts = {not_counted:0, matched:0, shortage:0, excess:0};
    let shortageValue = 0, excessValue = 0;
    selectedItems.forEach(it => {
      const st = itemStatus(it); counts[st] = (counts[st]||0)+1;
      const diff = num(it.actual_qty) - num(it.system_qty);
      const val = diff * num(it.unit_price);
      if(diff < 0) shortageValue += Math.abs(val);
      if(diff > 0) excessValue += Math.abs(val);
    });
    box.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item"><b>الإجمالي</b><br>${selectedItems.length}</div>
        <div class="summary-item"><b>مطابق</b><br>${counts.matched}</div>
        <div class="summary-item"><b>لم يتم جرده</b><br>${counts.not_counted}</div>
        <div class="summary-item"><b>نقص</b><br>${counts.shortage} / ${money(shortageValue)}</div>
        <div class="summary-item"><b>زيادة</b><br>${counts.excess} / ${money(excessValue)}</div>
        <div class="summary-item"><b>الحالة</b><br>${selectedAudit.status === 'open' ? 'مفتوح' : 'مغلق'}</div>
      </div>
      <div class="actions">
        <button class="light" type="button" onclick="tasneefInventoryAuditV10045.printReport()">طباعة</button>
        <button class="light" type="button" onclick="tasneefInventoryAuditV10045.exportCsv()">تصدير CSV</button>
        ${selectedAudit.status === 'open' ? '<button class="danger" type="button" onclick="tasneefInventoryAuditV10045.closeAudit()">إغلاق الجرد</button>' : ''}
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th>#</th><th>المنتج</th><th>كود المنتج</th><th>كود الموزع</th><th>كمية النظام</th><th>الكمية الفعلية</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th>
      </tr></thead><tbody>${selectedItems.map((it,idx)=>rowHtml(it,idx)).join('')}</tbody></table></div>`;
  }

  function rowHtml(it, idx){
    const diff = (it.actual_qty === null || it.actual_qty === undefined || it.actual_qty === '') ? '' : (num(it.actual_qty) - num(it.system_qty));
    const st = itemStatus(it);
    const badge = st==='matched'?'green':(st==='not_counted'?'amber':'red');
    return `<tr>
      <td>${idx+1}</td>
      <td>${esc(it.product_name)}</td>
      <td>${esc(it.product_code)}</td>
      <td>${esc(it.distributor_code)}</td>
      <td>${num(it.system_qty)}</td>
      <td><input style="min-width:90px" type="number" step="0.01" value="${it.actual_qty ?? ''}" onchange="tasneefInventoryAuditV10045.updateItem('${esc(it.id)}','actual_qty',this.value)"></td>
      <td>${diff}</td>
      <td><span class="badge ${badge}">${statusAr(st)}</span></td>
      <td><input style="min-width:140px" value="${esc(it.notes || '')}" onchange="tasneefInventoryAuditV10045.updateItem('${esc(it.id)}','notes',this.value)"></td>
    </tr>`;
  }

  async function updateItem(id, field, value){
    const it = selectedItems.find(x => x.id === id);
    if(!it) return;
    if(field === 'actual_qty'){
      it.actual_qty = value === '' ? null : num(value);
      it.difference_qty = it.actual_qty === null ? null : num(it.actual_qty) - num(it.system_qty);
      it.status = itemStatus(it);
      it.total_difference_value = it.difference_qty === null ? null : it.difference_qty * num(it.unit_price);
      await patchJson('/rest/v1/' + ITEMS + '?id=eq.' + encodeURIComponent(id), {
        actual_qty: it.actual_qty,
        difference_qty: it.difference_qty,
        total_difference_value: it.total_difference_value,
        status: it.status,
        updated_at: new Date().toISOString()
      });
    } else if(field === 'notes'){
      it.notes = value;
      await patchJson('/rest/v1/' + ITEMS + '?id=eq.' + encodeURIComponent(id), {notes:value, updated_at:new Date().toISOString()});
    }
    renderDetails();
  }

  async function closeAudit(){
    if(!selectedAudit || selectedAudit.status !== 'open') return;
    if(!confirm('هل تريد إغلاق عملية الجرد؟ بعد الإغلاق سيتم فتح قسم المالية والمخزون.')) return;
    try{
      await patchJson('/rest/v1/' + AUDITS + '?id=eq.' + encodeURIComponent(selectedAudit.id), {
        status:'closed', closed_at:new Date().toISOString(), closed_by_name:currentUserName(), updated_at:new Date().toISOString()
      });
      toast('تم إغلاق الجرد.');
      await load();
      await selectAudit(selectedAudit.id);
    }catch(e){ toast('فشل إغلاق الجرد: ' + (e.message || e), true); }
  }

  function printReport(){
    if(!selectedAudit) return;
    const html = `<html dir="rtl"><head><meta charset="utf-8"><title>${esc(selectedAudit.audit_no)}</title>
      <style>body{font-family:Tahoma,Arial;margin:24px;color:#10231d}h1{color:#0a4033}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#f3f6f5}.head{display:flex;justify-content:space-between;border-bottom:3px solid #0a4033;margin-bottom:18px;padding-bottom:12px}.badge{font-weight:bold}</style></head><body>
      <div class="head"><div><h1>تقرير جرد المخزون</h1><b>${esc(selectedAudit.audit_no)}</b></div><div>${dateStr(new Date())}</div></div>
      <p><b>العنوان:</b> ${esc(selectedAudit.title || '')} | <b>الموقع:</b> ${esc(selectedAudit.location || '')} | <b>الحالة:</b> ${selectedAudit.status==='open'?'مفتوح':'مغلق'}</p>
      <table><thead><tr><th>#</th><th>المنتج</th><th>كود المنتج</th><th>كود الموزع</th><th>كمية النظام</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>
      ${selectedItems.map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.product_name)}</td><td>${esc(it.product_code)}</td><td>${esc(it.distributor_code)}</td><td>${num(it.system_qty)}</td><td>${it.actual_qty ?? ''}</td><td>${it.difference_qty ?? ''}</td><td>${statusAr(itemStatus(it))}</td><td>${esc(it.notes||'')}</td></tr>`).join('')}
      </tbody></table><br><br><p>توقيع مسؤول الجرد: ____________________ &nbsp;&nbsp;&nbsp; توقيع الإدارة: ____________________</p>
      </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
  }

  function exportCsv(){
    if(!selectedAudit) return;
    const rows = [['#','المنتج','كود المنتج','كود الموزع','كمية النظام','الكمية الفعلية','الفرق','الحالة','ملاحظات']];
    selectedItems.forEach((it,i)=>rows.push([i+1,it.product_name,it.product_code,it.distributor_code,it.system_qty,it.actual_qty ?? '',it.difference_qty ?? '',statusAr(itemStatus(it)),it.notes||'']));
    const csv = '\ufeff' + rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download = (selectedAudit.audit_no || 'inventory-audit') + '.csv';
    a.click();
  }

  function financePageVisible(){
    const pages = Array.from(document.querySelectorAll('.page'));
    return pages.find(p => !p.classList.contains('hidden') && /المالية والمخزون|المخزون|حركة المخزون|المنتجات/.test(p.innerText || ''));
  }

  function enforceFinanceLock(){
    if(!activeAudit){
      activeGuardOn = false;
      document.querySelectorAll('[data-audit-lock-overlay="v10045"]').forEach(x=>x.remove());
      return;
    }
    if(activeGuardOn) return;
    activeGuardOn = true;
  }

  function showFinanceLockIfNeeded(){
    if(!activeAudit || $(PAGE_ID) && !$(PAGE_ID).classList.contains('hidden')) return;
    const page = financePageVisible();
    if(!page || page.querySelector('[data-audit-lock-overlay="v10045"]')) return;
    const overlay = document.createElement('div');
    overlay.setAttribute('data-audit-lock-overlay','v10045');
    overlay.className = 'card';
    overlay.style.cssText = 'border:2px solid #d69b00;background:#fff8e8;color:#684700;margin:12px 0;position:relative;z-index:9999';
    overlay.innerHTML = `<h2>المالية والمخزون مغلق للجرد</h2>
      <p>يوجد جرد مفتوح: <b>${esc(activeAudit.audit_no)}</b> - ${esc(activeAudit.title || '')}</p>
      <p>لا تضف أو تعدل حركة مخزون حتى يتم إغلاق الجرد.</p>
      <button type="button" onclick="tasneefInventoryAuditV10045.show()">عرض عملية الجرد</button>`;
    page.insertBefore(overlay, page.firstChild);
    page.querySelectorAll('button:not([onclick*="tasneefInventoryAuditV10045"]), input, select, textarea').forEach(el=>{
      if(!overlay.contains(el)){
        el.disabled = true;
        el.setAttribute('data-disabled-by-audit-v10045','1');
      }
    });
  }

  function boot(){
    ensurePage(); ensureNav(); load();
    setInterval(()=>{ ensureNav(); showFinanceLockIfNeeded(); }, 1200);
    const mo = new MutationObserver(()=>{ ensureNav(); showFinanceLockIfNeeded(); });
    mo.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','hidden']});
  }

  window.tasneefInventoryAuditV10045 = { show:showAuditPage, load, openCreate, selectAudit, updateItem, closeAudit, printReport, exportCsv };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
