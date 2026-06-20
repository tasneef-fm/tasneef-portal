/* Tasneef v10113 - Finance Product Edit + Report Movement Type Filter
   Scope: المالية والمخزون only. No changes to orders, tickets, contracts, monthly, permissions. */
(function(){
  'use strict';
  if(window.__tasneefFinanceProductEditReportFilterV10113) return;
  window.__tasneefFinanceProductEditReportFilterV10113 = true;
  const VERSION='v10113-finance-product-edit-report-filter';
  const S=v=>String(v??'').trim();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>S(v).replace(/\s+/g,' ').toLowerCase();
  const $=id=>document.getElementById(id);

  function currentUser(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function isSystemAdmin(){
    const u=currentUser();
    const text=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|system|owner|مدير\s*عام|مدير\s*النظام|النظام|ادارة|الإدارة/.test(text) || ['admin','general_manager','system_admin','owner'].includes(S(u.role||u.user_role||u.type));
  }
  function client(){ return window.sb || window.supabaseClient || window.supabase || null; }
  function isFinanceVisible(){ return !!($('finBodyV15') || document.querySelector('#financeDashboard,#finance,.fin-shell,.finance-pro')); }

  function getIdFromCard(card){
    const btn=card && card.querySelector('.fin-show-product-btn,[onclick*="financeProShowProductV15"],[onclick*="financeProDeleteProductV15"],[onchange*="financeProUploadProductImageV15"]');
    const txt=(btn && (btn.getAttribute('onclick')||btn.getAttribute('onchange')||'')) || '';
    let m=txt.match(/financePro(?:ShowProduct|DeleteProduct|UploadProductImage)V15\(['"]([^'"]+)['"]/);
    if(m) return m[1];
    const file=card && card.querySelector('input[type="file"][onchange*="financeProUploadProductImageV15"]');
    const ot=file && file.getAttribute('onchange') || '';
    m=ot.match(/financeProUploadProductImageV15\(['"]([^'"]+)['"]/);
    return m?m[1]:'';
  }
  function metaValue(card,label){
    label=norm(label);
    const boxes=[...(card?.querySelectorAll('.fin-meta div')||[])];
    for(const b of boxes){
      const small=norm(b.querySelector('small')?.textContent||'');
      if(small.includes(label)) return S(b.querySelector('b,strong')?.textContent||'');
    }
    return '';
  }
  function addProductTypeOptions(){
    const sel=$('finProductTypeV15'); if(!sel || sel.dataset.v10113) return;
    const opts=[...sel.options].map(o=>S(o.value||o.textContent));
    [['أداة','أداة'],['مكينة','مكينة']].forEach(([v,t])=>{ if(!opts.includes(v)){ const o=document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o); }});
    sel.dataset.v10113='1';
  }
  function installProductEditButtons(){
    if(!isSystemAdmin() || !isFinanceVisible()) return;
    addProductTypeOptions();
    document.querySelectorAll('.fin-product-card').forEach(card=>{
      if(card.querySelector('[data-v10113-edit-product]')) return;
      const id=getIdFromCard(card); if(!id) return;
      const actions=card.querySelector('.fin-card-actions') || card;
      const btn=document.createElement('button');
      btn.type='button'; btn.className='light'; btn.setAttribute('data-v10113-edit-product','1'); btn.textContent='تعديل المنتج';
      btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openProductEditModal({
        id,
        name:S(card.querySelector('h4')?.textContent||''),
        code:metaValue(card,'الكود'),
        unit:metaValue(card,'الوحدة'),
        item_type:metaValue(card,'النوع') || 'مادة'
      }); return false; };
      const first=actions.querySelector('button,label');
      if(first) actions.insertBefore(btn, first); else actions.appendChild(btn);
    });
  }
  function closeModal(){ document.getElementById('finProductEditModalV10113')?.remove(); }
  function openProductEditModal(item){
    closeModal();
    const root=document.createElement('div');
    root.id='finProductEditModalV10113'; root.className='fp10113-backdrop';
    root.innerHTML=`<div class="fp10113-card" role="dialog" aria-modal="true">
      <div class="fp10113-head"><h2>تعديل المنتج</h2><button type="button" class="danger" data-close>إغلاق</button></div>
      <div class="fp10113-note">التعديل متاح لإدارة النظام فقط. التعديل لا يغير الكمية ولا السعر ولا حركات المخزون.</div>
      <input type="hidden" id="fp10113Id" value="${esc(item.id)}">
      <div class="fp10113-grid">
        <div><label>اسم المنتج</label><input id="fp10113Name" value="${esc(item.name)}"></div>
        <div><label>نوع المنتج</label><select id="fp10113Type"><option value="مادة">مادة</option><option value="أداة">أداة</option><option value="مكينة">مكينة</option><option value="عدة">عدة</option></select></div>
        <div><label>الوحدة</label><input id="fp10113Unit" value="${esc(item.unit||'حبة')}"></div>
        <div><label>الكود</label><input value="${esc(item.code||'-')}" readonly></div>
      </div>
      <div class="fp10113-actions"><button type="button" id="fp10113Save">حفظ التعديل</button><button type="button" class="light" data-close>إلغاء</button></div>
    </div>`;
    document.body.appendChild(root);
    const type=$('fp10113Type'); if(type) type.value=S(item.item_type)||'مادة';
    root.addEventListener('click',e=>{ if(e.target===root || e.target.closest('[data-close]')) closeModal(); });
    $('fp10113Save').onclick=saveProductEdit;
  }
  async function saveProductEdit(){
    if(!isSystemAdmin()) return alert('هذا الإجراء خاص بإدارة النظام فقط');
    const id=S($('fp10113Id')?.value), name=S($('fp10113Name')?.value), type=S($('fp10113Type')?.value)||'مادة', unit=S($('fp10113Unit')?.value)||'حبة';
    if(!id) return alert('لم يتم تحديد المنتج');
    if(!name) return alert('اسم المنتج مطلوب');
    const c=client(); if(!c || !c.from) return alert('الاتصال بقاعدة البيانات غير جاهز');
    const btn=$('fp10113Save');
    try{
      if(btn){btn.disabled=true; btn.textContent='جاري الحفظ...';}
      const patch={name, item_type:type, type:type, category:type, unit};
      const res=await c.from('inventory_items').update(patch).eq('id',id).select('*');
      if(res.error) throw res.error;
      closeModal();
      if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true);
      else if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
      if(typeof msg==='function') msg('تم تعديل المنتج بنجاح');
      setTimeout(installProductEditButtons,300);
    }catch(e){ alert('لم يتم تعديل المنتج: '+(e.message||e)); }
    finally{ if(btn){btn.disabled=false; btn.textContent='حفظ التعديل';} }
  }

  const movementLabels={
    out:['صرف','خارج'], consume:['مستهلك','استهلاك'], damaged:['تالف'], waste:['مهدور','هدر'], scrap:['سكراب'], return:['مرتجع'], in:['داخل','دخول']
  };
  function ensureReportProductClassFilterV10169(){
    const reportBox=$('finReportWindowV15'); if(!reportBox) return;
    const filters=reportBox.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions');
    if(!filters || $('finReportProductClassV10169')) return;
    const wrap=document.createElement('div');
    wrap.id='finReportProductClassWrapV10169';
    wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10169"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
    const printBtn=[...filters.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
    if(printBtn) filters.insertBefore(wrap, printBtn); else filters.appendChild(wrap);
    $('finReportProductClassV10169').addEventListener('change', applyReportMovementFilter);
  }
  function ensureReportMovementFilter(){
    const reportBox=$('finReportWindowV15'); if(!reportBox) return;
    const filters=reportBox.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions');
    if(!filters || $('finReportMovementTypeV10113')) return;
    const wrap=document.createElement('div');
    wrap.id='finReportMovementTypeWrapV10113';
    wrap.innerHTML=`<label>الحركة المطلوبة</label><select id="finReportMovementTypeV10113"><option value="">كل الحركات</option><option value="out">صرف</option><option value="consume">استهلاك</option><option value="damaged">تالف</option><option value="waste">هدر</option><option value="scrap">سكراب</option><option value="return">مرتجع</option></select>`;
    const printBtn=[...filters.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
    if(printBtn) filters.insertBefore(wrap, printBtn); else filters.appendChild(wrap);
    $('finReportMovementTypeV10113').addEventListener('change', applyReportMovementFilter);
  }
  function rowMatchesMovement(tr, key){
    if(!key) return true;
    const labels=movementLabels[key]||[];
    const cells=[...tr.children].slice(0,5).map(td=>norm(td.textContent));
    return cells.some(t=>labels.some(l=>t.includes(norm(l))));
  }
  function applyReportMovementFilter(){
    const key=S($('finReportMovementTypeV10113')?.value);
    const cls=S($('finReportProductClassV10169')?.value);
    const box=$('finReportWindowV15'); if(!box) return;
    box.querySelectorAll('tbody tr').forEach(tr=>{
      // keep total/empty rows visible unless there is a selected filter and the row clearly contains a movement type
      const txt=norm(tr.textContent);
      if(!key && !cls){ tr.style.display=''; return; }
      if(/لا توجد|مجموع|الإجمالي/.test(tr.textContent)){ tr.style.display=''; return; }
      const clsOk=!cls || norm(tr.textContent).includes(norm(cls));
      tr.style.display=(rowMatchesMovement(tr,key)&&clsOk)?'':'none';
    });
    // Hide entire product/project cards with no visible data rows.
    box.querySelectorAll('.fin-card').forEach(card=>{
      const bodyRows=[...card.querySelectorAll('tbody tr')].filter(r=>!/لا توجد|مجموع|الإجمالي/.test(r.textContent));
      if(!bodyRows.length) return;
      const any=bodyRows.some(r=>r.style.display!=='none');
      card.style.display=any?'':'none';
    });
  }
  function patchFinanceReportRerender(){
    if(window.__fp10113ReportPatched) return; window.__fp10113ReportPatched=true;
    const old=window.financeProRenderReportsV15;
    window.financeProRenderReportsV15=function(){ const r=old?old.apply(this,arguments):undefined; setTimeout(()=>{ensureReportMovementFilter(); ensureReportProductClassFilterV10169(); applyReportMovementFilter();},80); return r; };
    const oldTab=window.financeProReportTabV15;
    window.financeProReportTabV15=function(){ const r=oldTab?oldTab.apply(this,arguments):undefined; setTimeout(()=>{ensureReportMovementFilter(); ensureReportProductClassFilterV10169(); applyReportMovementFilter();},120); return r; };
    const oldPrint=window.financeProPrintReportV15;
    window.financeProPrintReportV15=function(){ applyReportMovementFilter(); return oldPrint?oldPrint.apply(this,arguments):undefined; };
  }

  function installStyle(){
    if($('fp10113Style')) return;
    const st=document.createElement('style'); st.id='fp10113Style';
    st.textContent=`
      .fp10113-backdrop{position:fixed;inset:0;z-index:2147483001;background:rgba(0,35,28,.48);display:grid;place-items:center;padding:18px;direction:rtl}
      .fp10113-card{width:min(720px,96vw);background:#fff;border-radius:22px;border:1px solid #d9e7e2;box-shadow:0 30px 100px rgba(0,0,0,.25);padding:18px;color:#073d31}
      .fp10113-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.fp10113-head h2{margin:0}.fp10113-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:14px 0}.fp10113-grid input,.fp10113-grid select{width:100%;border:1px solid #d9e7e2;border-radius:12px;padding:10px;background:#fff}.fp10113-note{background:#f4faf7;border:1px solid #d8ebe3;border-radius:12px;padding:10px;margin-top:12px}.fp10113-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.fp10113-actions button,.fp10113-head button{border:0;border-radius:12px;padding:10px 14px;font-weight:800;background:#0b4f3a;color:#fff;cursor:pointer}.fp10113-actions .light{background:#eef7f3;color:#073d31}.fp10113-head .danger{background:#c73535;color:#fff}
      [data-v10113-edit-product]{background:#eef7f3!important;color:#073d31!important;border:1px solid #d8ebe3!important}
      #finReportMovementTypeWrapV10113,#finReportProductClassWrapV10169{min-width:170px}#finReportMovementTypeWrapV10113 select,#finReportProductClassWrapV10169 select{min-width:160px}
    `;
    document.head.appendChild(st);
  }
  function boot(){ installStyle(); patchFinanceReportRerender(); installProductEditButtons(); ensureReportMovementFilter(); ensureReportProductClassFilterV10169(); applyReportMovementFilter(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  window.addEventListener('load',()=>{boot(); setTimeout(boot,700); setTimeout(boot,1800);}, {once:true});
  const mo=new MutationObserver(()=>{ if(isFinanceVisible()){ installProductEditButtons(); ensureReportMovementFilter(); ensureReportProductClassFilterV10169(); applyReportMovementFilter(); }});
  try{ mo.observe(document.documentElement,{childList:true,subtree:true}); }catch(_){ }
  console.log('Loaded '+VERSION);
})();
