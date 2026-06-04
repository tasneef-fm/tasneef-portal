/* TASNEEF v351 - Safe inventory line edit button + working filters + report totals
   لا يلمس الصلاحيات ولا المستخدمين ولا الحضور ولا العقود.
*/
(function(){
  'use strict';
  if(window.__tasneefV351InventoryFix) return; window.__tasneefV351InventoryFix = true;

  const VAT = 0.15;
  const LS = {items:'tasneef_v312_items', moves:'tasneef_v312_moves'};
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(String(v ?? '0').replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const R2 = v => Math.round((N(v)+Number.EPSILON)*100)/100;
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money = v => N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const parse = (k,d=[]) => { try{return JSON.parse(localStorage.getItem(k)||'null')||d;}catch(_){return d;} };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const itemsLS = () => parse(LS.items).map(i => ({...i, batches:Array.isArray(i.batches)?i.batches:[]}));
  const movesLS = () => parse(LS.moves);
  const setMovesLS = v => save(LS.moves, v);
  const dataSafe = () => window.data || {};
  const today = () => new Date().toISOString().slice(0,10);
  const isOutType = t => ['out','consume','صرف','استهلاك','هدر','تالف','سكراب'].includes(S(t));
  const isReturnType = t => ['return','مرتجع','إرجاع','ارجاع'].includes(S(t));
  const isInType = t => ['in','إدخال','ادخال','توريد','شراء','دخول'].includes(S(t));
  const prodCode = i => S(i?.code || i?.serial_number || i?.product_code || i?.barcode || i?.supplier_barcode || '');
  const itemByIdLS = id => itemsLS().find(i => S(i.id) === S(id)) || {};
  const unitBefore = i => N(i.unit_before || i.price_before_vat || i.unit_cost || i.cost || i.price_before || i.price || i.unit_after/1.15 || 0);
  const unitAfterToBefore = v => R2(N(v)/(1+VAT));
  const mUnitBefore = m => {
    if(N(m.unit_before)) return N(m.unit_before);
    if(N(m.unit_cost_before)) return N(m.unit_cost_before);
    if(N(m.unit_cost_override)) return unitAfterToBefore(m.unit_cost_override);
    if(N(m.unit_cost)) return unitAfterToBefore(m.unit_cost);
    if(N(m.amount) && N(m.qty || m.quantity)) return unitAfterToBefore(N(m.amount)/N(m.qty||m.quantity));
    return unitBefore(itemByIdLS(m.item_id));
  };
  const projectName = id => {
    if(!S(id)) return '';
    try{ if(typeof window.financeProjectName === 'function') return window.financeProjectName(id) || S(id); }catch(_){ }
    try{ if(typeof window.projectName === 'function') return window.projectName(id) || S(id); }catch(_){ }
    const p = A(dataSafe().projects).find(x => S(x.id) === S(id)); return p?.name || p?.project_name || p?.title || S(id);
  };
  const parentOf = m => (S(m.notes).match(/\[PARENT:([^\]]+)\]/)||[])[1] || '';
  const isPending = m => S(m.distribution_status).includes('pending') || /PENDING_DISTRIBUTION|بانتظار توزيع/.test(S(m.notes)+' '+S(m.general_note));
  const isReportOnly = m => /\[REPORT_ONLY\]/.test(S(m.notes)) || !!parentOf(m);
  const isParentDistributed = m => /\[DISTRIBUTED_PARENT\]/.test(S(m.notes)+' '+S(m.reason));

  function css(){
    if($('v351Css')) return;
    const st=document.createElement('style'); st.id='v351Css';
    st.textContent = `
      .v351-edit-btn{background:#eef8f5!important;color:#064737!important;border:1px solid #cfe4dc!important;border-radius:10px!important;padding:7px 10px!important;font-weight:900!important;margin:2px!important}
      .v351-save-btn{background:#064737!important;color:#fff!important;border-radius:10px!important;padding:7px 10px!important;font-weight:900!important;margin:2px!important}
      .v351-editing{outline:2px dashed #c8a24a!important;outline-offset:4px;background:#fffdf2!important}
      .v351-total-row td{font-weight:900!important;background:#f2fbf7!important;color:#064737!important;border-top:2px solid #cfe4dc!important}
      .v351-printbar{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:10px 0}.v351-printbar button{background:#eef8f5!important;color:#064737!important;border:1px solid #cfe4dc!important;border-radius:10px!important;padding:8px 12px!important;font-weight:900!important}
    `;
    document.head.appendChild(st);
  }

  // زر تعديل واضح داخل عرض حركة المخزون، حتى لو كانت الشاشة القديمة أو الجديدة.
  window.v351EditMoveLine = function(btn){
    const box = btn.closest('.v337-line, tr, .smart-line-v129, .v349-line, .v347-split, .v337-product, .card, div');
    if(!box) return;
    box.classList.add('v351-editing');
    box.querySelectorAll('input,select,textarea').forEach(el => { el.removeAttribute('disabled'); el.removeAttribute('readonly'); });
    const first = box.querySelector('input,select,textarea');
    if(first){ first.focus(); try{ first.select && first.select(); }catch(_){} }
    const save = Array.from(box.querySelectorAll('button')).find(b => /حفظ|تحديث|إضافة توزيع/.test(S(b.textContent)) && !/تعديل/.test(S(b.textContent)));
    if(save){ save.classList.add('v351-save-btn'); save.textContent = /إضافة توزيع/.test(S(save.textContent)) ? save.textContent : 'حفظ التعديل'; }
  };

  function injectEditButtons(){
    css();
    // داخل سطور v337 editable
    document.querySelectorAll('.v337-line').forEach(line => {
      if(line.querySelector('.v351-edit-btn')) return;
      const actionBox = line.lastElementChild || line;
      const b = document.createElement('button'); b.type='button'; b.className='v351-edit-btn'; b.textContent='تعديل'; b.onclick=function(){ window.v351EditMoveLine(this); };
      actionBox.insertBefore(b, actionBox.firstChild);
    });
    // أي جدول/بطاقة داخل مودال حركة فيه زر حذف فقط: أضف تعديل بجواره
    document.querySelectorAll('.v337-modal button, .v347-modal button, .smart-modal-v129 button, .v152-edit-modal button').forEach(del => {
      if(!/حذف/.test(S(del.textContent))) return;
      const parent = del.parentElement; if(!parent || parent.querySelector('.v351-edit-btn')) return;
      const b = document.createElement('button'); b.type='button'; b.className='v351-edit-btn'; b.textContent='تعديل'; b.onclick=function(){ window.v351EditMoveLine(this); };
      parent.insertBefore(b, del);
    });
  }

  function wrapOpeners(){
    [['v337OpenMove','__v351_v337'],['inventoryShowMovementV347','__v351_v347'],['inventoryShowMovementV346','__v351_v346'],['v334ViewMove','__v351_v334'],['v335OpenMove','__v351_v335'],['v336OpenMove','__v351_v336']].forEach(([name,flag])=>{
      if(typeof window[name] !== 'function' || window[flag]) return;
      const old = window[name]; window[flag]=true;
      window[name] = function(){ const r = old.apply(this, arguments); setTimeout(injectEditButtons,80); setTimeout(injectEditButtons,350); return r; };
    });
  }

  function filterValue(id){ return S($(id)?.value); }
  function monthOK(date){ const m=filterValue('financeMonthFilter'); return !m || S(date).slice(0,7) === m; }
  function textOK(txt){ const q=filterValue('financeSearch').toLowerCase(); return !q || S(txt).toLowerCase().includes(q); }
  function itemOK(itemId, code, name){ const p=filterValue('inventoryReportProduct'); return !p || S(itemId)===p || S(code)===p || S(name).includes(p); }
  function personOK(person){ const x=filterValue('inventoryReportPerson'); return !x || S(person)===x || S(person).includes(x); }
  function projectOK(project, projectId){ const x=filterValue('financeProjectFilter') || filterValue('inventoryProjectFilter'); return !x || S(projectId)===x || S(project)===x || S(project).includes(x); }
  function supplierOK(supplier){ const x=filterValue('inventoryReportSupplier'); return !x || S(supplier)===x || S(supplier).includes(x); }

  function usageRows(){
    const rows=[];
    // localStorage moves (النظام الجديد للدفعات والتوزيع)
    movesLS().forEach(m => {
      const type = m.type || m.movement_type;
      if(!isOutType(type)) return;               // المرتجع لا يدخل تكلفة المشاريع
      if(isPending(m)) return;                   // بانتظار توزيع لا يدخل التكلفة
      if(isParentDistributed(m)) return;         // السطر الأصلي الموزع لا يدخل حتى لا تتكرر التكلفة
      if(/طلب معتمد|أمر معتمد/.test(S(m.reason))) return;
      const it = itemByIdLS(m.item_id);
      const qty=N(m.qty || m.quantity);
      const before = R2(qty * mUnitBefore(m));
      const prj = m.project_name || projectName(m.project_id) || (m.cost_type==='GENERAL' ? 'عام' : 'بدون مشروع');
      rows.push({
        date:S(m.date||m.movement_date||m.created_at||today()).slice(0,10), project:prj, project_id:m.project_id,
        person:m.supervisor_name || m.receiver || 'بدون مستلم', code:m.product_code || prodCode(it), item:m.item_name || it.name || '-', item_id:m.item_id,
        qty, unit_before:mUnitBefore(m), before, vat:R2(before*VAT), gross:R2(before*(1+VAT)), reason:S(m.notes||m.reason||'-').replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]|\[ALLOCATED\]/g,'').trim(), type:parentOf(m)?'توزيع على مشروع':'صرف مباشر', ref:'MOV-'+(m.batch_no||m.id||'')
      });
    });
    // Supabase requests/movements fallback
    A(dataSafe().inventoryRequests).filter(r=>r.status==='approved').forEach(r=>{
      const qty=N(r.quantity), before=R2(qty * unitBefore(itemByIdLS(r.item_id)));
      rows.push({date:S(r.request_date||r.created_at||today()).slice(0,10),project:r.project_name||projectName(r.project_id)||'بدون مشروع',project_id:r.project_id,person:r.supervisor_name||'',code:'',item:r.item_name||'-',item_id:r.item_id,qty,unit_before:qty?before/qty:0,before,vat:R2(before*VAT),gross:R2(before*(1+VAT)),reason:r.reason||r.notes||'-',type:'أمر صرف معتمد',ref:'REQ-'+r.id});
    });
    A(dataSafe().inventoryMovements).forEach(m=>{
      if(!isOutType(m.movement_type)) return;
      if(isParentDistributed(m) || isReportOnly(m)) return;
      const qty=N(m.quantity), before=R2(qty * mUnitBefore(m));
      rows.push({date:S(m.movement_date||m.created_at||today()).slice(0,10),project:m.project_name||projectName(m.project_id)||'بدون مشروع',project_id:m.project_id,person:m.receiver||'بدون مستلم',code:m.product_code||'',item:m.item_name||'-',item_id:m.item_id,qty,unit_before:qty?before/qty:0,before,vat:R2(before*VAT),gross:R2(before*(1+VAT)),reason:m.reason||m.notes||'-',type:'صرف مباشر',ref:'MOV-'+m.id});
    });
    return rows.filter(r => monthOK(r.date) && textOK([r.project,r.person,r.code,r.item,r.reason,r.type,r.ref].join(' ')) && itemOK(r.item_id,r.code,r.item) && personOK(r.person) && projectOK(r.project,r.project_id));
  }

  function totalCells(rows, colspan, extra=''){
    const b=R2(rows.reduce((a,r)=>a+N(r.before),0));
    return `<tr class="v351-total-row"><td colspan="${colspan}">الإجمالي</td><td>${money(b)}</td><td>${money(R2(b*VAT))}</td><td>${money(R2(b*(1+VAT)))}</td>${extra}</tr>`;
  }

  function addPrintButtons(){
    [['expenseByProjectBody','تقرير المصروفات حسب المشروع'],['stockOutByProjectBody','تقرير تكلفة المشاريع'],['stockOutBySupervisorBody','تقرير الصرف حسب المشرف'],['inventoryUsageDetailBody','تقرير الاستهلاك التفصيلي'],['stockReportBody','تقرير المخزون']].forEach(([id,title])=>{
      const table=$(id)?.closest('table'); if(!table) return;
      if(table.previousElementSibling?.classList?.contains('v351-printbar')) return;
      table.insertAdjacentHTML('beforebegin', `<div class="v351-printbar"><button type="button" onclick="v351PrintTable('${id}','${title}')">طباعة PDF</button></div>`);
    });
  }
  window.v351PrintTable = function(id,title){
    const table=$(id)?.closest('table'); if(!table) return alert('لا يوجد تقرير للطباعة');
    const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ للطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:9mm}body{font-family:Tahoma,Arial,sans-serif;color:#063d31}h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#064737;color:#fff}td,th{border:1px solid #aaa;padding:7px;text-align:center}.v351-total-row td{font-weight:bold;background:#eef8f4}</style></head><body><h2>${esc(title)}</h2><table>${table.innerHTML}</table><script>window.onload=function(){print()}<\/script></body></html>`);
    w.document.close();
  };

  function renderReportTotals(){
    addPrintButtons();
    const u=usageRows();
    const sp=$('stockOutByProjectBody'); if(sp){
      const map={}; u.forEach(r=>{ const k=[r.project,r.code,r.item].join('||'); map[k]=map[k]||{project:r.project,code:r.code,item:r.item,qty:0,before:0}; map[k].qty+=N(r.qty); map[k].before=R2(map[k].before+N(r.before)); });
      const arr=Object.values(map).sort((a,b)=>S(a.project).localeCompare(S(b.project),'ar'));
      sp.innerHTML = arr.map(v=>`<tr><td>${esc(v.project)}</td><td>${esc(v.code||'-')}</td><td><b>${esc(v.item||'-')}</b></td><td>${N(v.qty)}</td><td>${money(v.before)}</td><td>${money(R2(v.before*VAT))}</td><td>${money(R2(v.before*(1+VAT)))}</td><td></td></tr>`).join('') + (arr.length?totalCells(arr,4,'<td></td>'):'<tr><td colspan="8">لا توجد بيانات</td></tr>');
    }
    const sr=$('stockOutBySupervisorBody'); if(sr){
      const map={}; u.forEach(r=>{ const k=[r.person,r.project].join('||'); map[k]=map[k]||{person:r.person,project:r.project,count:0,qty:0,before:0}; map[k].count++; map[k].qty+=N(r.qty); map[k].before=R2(map[k].before+N(r.before)); });
      const arr=Object.values(map);
      sr.innerHTML=arr.map(v=>`<tr><td>${esc(v.person||'-')}</td><td>${esc(v.project||'-')}</td><td>${v.count}</td><td>${N(v.qty)}</td><td>${money(v.before)}</td><td>${money(R2(v.before*VAT))}</td><td>${money(R2(v.before*(1+VAT)))}</td><td></td></tr>`).join('')+(arr.length?totalCells(arr,4,'<td></td>'):'<tr><td colspan="8">لا توجد بيانات</td></tr>');
    }
    const ud=$('inventoryUsageDetailBody'); if(ud){
      const arr=[...u].sort((a,b)=>S(b.date).localeCompare(S(a.date)));
      ud.innerHTML=arr.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.project)}</td><td>${esc(r.person)}</td><td>${esc(r.code||'-')}</td><td><b>${esc(r.item||'-')}</b></td><td>${money(r.unit_before)}</td><td>${N(r.qty)}</td><td>${money(r.before)}</td><td>${money(r.vat)}</td><td>${money(r.gross)}</td><td>${esc(r.reason||'-')}</td><td>${esc(r.type||'-')}</td><td>${esc(r.ref||'-')}</td></tr>`).join('')+(arr.length?totalCells(arr,7,'<td colspan="3"></td>'):'<tr><td colspan="13">لا توجد بيانات استهلاك</td></tr>');
    }
    const stock=$('stockReportBody'); if(stock){
      let rows=itemsLS().filter(i=>N(i.qty ?? i.quantity)>0 && supplierOK(i.supplier) && textOK([i.name,prodCode(i),i.supplier,i.category].join(' ')) && itemOK(i.id,prodCode(i),i.name));
      stock.innerHTML=rows.map(i=>{ const q=N(i.qty ?? i.quantity), b=R2(q*unitBefore(i)); return `<tr><td>${esc(prodCode(i)||'-')}</td><td><b>${esc(i.name||'-')}</b></td><td>${esc(i.supplier||'-')}</td><td>${money(unitBefore(i))}</td><td>${money(R2(unitBefore(i)*(1+VAT)))}</td><td>${q}</td><td>${N(i.min_quantity||0)}</td><td>${money(b)}</td><td>${money(R2(b*VAT))}</td><td>${money(R2(b*(1+VAT)))}</td></tr>`; }).join('') + (rows.length?(()=>{const before=R2(rows.reduce((a,i)=>a+N(i.qty??i.quantity)*unitBefore(i),0)); return `<tr class="v351-total-row"><td colspan="7">الإجمالي</td><td>${money(before)}</td><td>${money(R2(before*VAT))}</td><td>${money(R2(before*(1+VAT)))}</td></tr>`})():'<tr><td colspan="10">لا توجد منتجات متوفرة</td></tr>');
    }
  }

  function bindFilters(){
    const ids=['financeSearch','financeProjectFilter','financeMonthFilter','inventoryReportProduct','inventoryReportPerson','inventoryReportSupplier','inventoryMovementSearch','inventoryItemSearch','inventorySupplierFilter'];
    ids.forEach(id=>{ const el=$(id); if(!el || el.__v351Bound) return; el.__v351Bound=true; ['input','change','keyup'].forEach(ev=>el.addEventListener(ev,()=>setTimeout(renderReportTotals,80))); });
    // أي فلتر داخل كروت المالية/المخزون ولم يكن مربوطًا: أعد الرندر عند تغييره
    document.querySelectorAll('#finance input,#finance select,#financeDashboard input,#financeDashboard select,[id*="inventoryReport"],[id*="finance"][id*="Filter"]').forEach(el=>{
      if(el.__v351GenericBound) return; el.__v351GenericBound=true; ['input','change'].forEach(ev=>el.addEventListener(ev,()=>setTimeout(renderReportTotals,120)));
    });
  }

  function boot(){
    css(); wrapOpeners(); injectEditButtons(); bindFilters(); renderReportTotals();
    setTimeout(()=>{wrapOpeners(); injectEditButtons(); bindFilters(); renderReportTotals();},700);
  }
  const mo=new MutationObserver(()=>{ setTimeout(()=>{injectEditButtons(); bindFilters(); addPrintButtons();},50); });
  try{ mo.observe(document.documentElement,{childList:true,subtree:true}); }catch(_){ }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,800)); else setTimeout(boot,800);
  window.addEventListener('load',()=>setTimeout(boot,1200));
  console.log('Tasneef v351 inventory edit/filter/totals loaded');
})();
