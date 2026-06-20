/* Tasneef v10171 - Finance reports product classification filter real fix
   - يعتمد أولاً على النص الظاهر داخل التقرير: "تصنيف المنتج: أصل/منتج".
   - إذا لم يظهر التصنيف في الصف، يطابق المنتج من الكود/الاسم مع جدول المنتجات.
   - يعمل على تبويبات التقارير كلها بدون إخفاء الجداول بالكامل بالخطأ.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceReportsClassFilterV10171) return;
  window.__tasneefFinanceReportsClassFilterV10171=true;
  const VERSION='v10171-finance-report-class-filter-real';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const norm=v=>S(v).replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').toLowerCase();
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function allItems(){return A(state().items).filter(Boolean);}
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));}
  function itemName(i){return S(i&&(i.name||i.item_name||i.product_name||itemCode(i)||i.id));}
  function itemClass(i){
    const raw=S(i&&(i.product_classification||i.product_class||i.asset_type||i.classification||i.item_class));
    const n=norm(raw);
    if(raw==='أصل'||raw==='اصل'||n==='اصل'||n==='asset'||n==='fixed asset') return 'أصل';
    return 'منتج';
  }
  function currentClass(){return S($('finReportProductClassV10171')?.value || sessionStorage.getItem('tasneef_fin_report_product_class') || '');}
  function setCurrentClass(v){try{sessionStorage.setItem('tasneef_fin_report_product_class',S(v));}catch(_){} }

  function ensureStyle(){
    if($('finReportsClassFilterStyleV10171')) return;
    const st=document.createElement('style'); st.id='finReportsClassFilterStyleV10171';
    st.textContent=`
      #finReportProductClassWrapV10171{min-width:170px!important;display:block!important}
      #finReportProductClassWrapV10171 select{min-width:160px!important;width:100%!important}
      .v10171-class-hidden{display:none!important}
      .v10171-filter-note{background:#eef7f3;border:1px solid #d9e7e2;border-radius:12px;padding:8px 10px;margin:6px 0;color:#073d31;font-weight:800}
    `;
    document.head.appendChild(st);
  }

  function filterBar(){
    const box=$('finReportWindowV15') || document.querySelector('#finBodyV15');
    if(!box) return null;
    return box.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions');
  }
  function ensureFilter(){
    ensureStyle();
    const bar=filterBar(); if(!bar) return null;
    document.getElementById('finReportProductClassWrapV10169')?.remove();
    document.getElementById('finReportProductClassWrapV10170')?.remove();
    let wrap=$('finReportProductClassWrapV10171'); let sel=$('finReportProductClassV10171');
    const saved=currentClass();
    if(!wrap || !sel){
      wrap=document.createElement('div'); wrap.id='finReportProductClassWrapV10171';
      wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10171"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
      const printBtn=[...bar.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
      if(printBtn) bar.insertBefore(wrap,printBtn); else bar.appendChild(wrap);
      sel=$('finReportProductClassV10171');
    }
    if(sel.dataset.boundV10171!=='1'){
      sel.dataset.boundV10171='1';
      sel.addEventListener('change',()=>{setCurrentClass(sel.value); setTimeout(()=>applyFilter(true),50);});
    }
    if(saved && sel.value!==saved) sel.value=saved;
    return sel;
  }

  function textClass(text){
    const t=norm(text);
    // قراءة التصنيف الظاهر داخل بطاقة المنتج أو الصف إذا موجود.
    if(/تصنيف\s*المنتج\s*[:：]?\s*اصل/.test(t) || /التصنيف\s*[:：]?\s*اصل/.test(t)) return 'أصل';
    if(/تصنيف\s*المنتج\s*[:：]?\s*منتج/.test(t) || /التصنيف\s*[:：]?\s*منتج/.test(t)) return 'منتج';
    // بعض الكروت تعرض "أصل" أو "منتج" كوسم منفصل.
    if(t.includes('تصنيف المنتج اصل')||t.includes('تصنيف: اصل')) return 'أصل';
    if(t.includes('تصنيف المنتج منتج')||t.includes('تصنيف: منتج')) return 'منتج';
    return '';
  }
  function productForText(txt){
    const t=norm(txt); if(!t) return null;
    const items=allItems();
    // الكود أدق من الاسم، ونرتب بالأطول حتى لا يطابق جزء من كود آخر.
    const byCode=items.map(i=>({i,c:norm(itemCode(i))})).filter(x=>x.c).sort((a,b)=>b.c.length-a.c.length).find(x=>t.includes(x.c));
    if(byCode) return byCode.i;
    const byName=items.map(i=>({i,n:norm(itemName(i))})).filter(x=>x.n&&x.n.length>1).sort((a,b)=>b.n.length-a.n.length).find(x=>t.includes(x.n));
    return byName?byName.i:null;
  }
  function classForElement(el){
    const direct=textClass(el.textContent||'');
    if(direct) return direct;
    const it=productForText(el.textContent||'');
    return it?itemClass(it):'';
  }
  function setHidden(el,hide){
    if(!el) return;
    el.classList.toggle('v10171-class-hidden',!!hide);
    if(hide) el.style.display='none';
    else if(el.style.display==='none') el.style.display='';
  }
  function isTotalOrEmpty(el){return /لا توجد|لا يوجد|المجموع|الإجمالي|الاجمالي|Total/i.test(S(el?.textContent||''));}
  function reportBox(){return $('finReportWindowV15') || document.querySelector('#finBodyV15');}

  function candidateCards(box){
    const arr=[];
    box.querySelectorAll('.fpr-box,.fin-product-card,.product-card,.fin-card,section').forEach(el=>{
      const txt=S(el.textContent);
      if(!txt) return;
      if(txt.includes('تصنيف المنتج') || txt.includes('الكود:') || txt.includes('الكمية الحالية') || productForText(txt)) arr.push(el);
    });
    // لا نرجع كروت داخل كروت أكبر إذا الأكبر هو نافذة التقرير فقط؛ نفضل أقرب بطاقة فيها عنوان منتج.
    return [...new Set(arr)].filter(el=>!el.querySelector('tbody tr'));
  }

  function applyFilter(showNote){
    const sel=ensureFilter(); const wanted=S(sel?.value||''); const box=reportBox(); if(!box) return;
    setCurrentClass(wanted);
    box.querySelectorAll('.v10171-class-hidden,.v10170-class-hidden').forEach(el=>setHidden(el,false));
    box.querySelector('#v10171FilterNote')?.remove();
    if(!wanted) return;
    let matched=0, checked=0;

    // 1) بطاقات تقرير المنتجات.
    candidateCards(box).forEach(card=>{
      const cls=classForElement(card);
      if(!cls) return;
      checked++; const ok=cls===wanted; if(ok) matched++;
      setHidden(card,!ok);
    });

    // 2) صفوف الجداول في جرد/حركة/استهلاك/مراكز التكلفة.
    box.querySelectorAll('tbody tr').forEach(tr=>{
      if(isTotalOrEmpty(tr)){ setHidden(tr,false); return; }
      const cls=classForElement(tr);
      if(!cls) return; // صف ليس مرتبطًا بمنتج معين، لا نخفيه.
      checked++; const ok=cls===wanted; if(ok) matched++;
      setHidden(tr,!ok);
    });

    // 3) إذا صار الجدول بدون صفوف مرئية، لا نخفي التقرير كله؛ فقط نتركه فاضي لكي يعرف المستخدم أن لا توجد نتائج.
    if(showNote){
      const note=document.createElement('div'); note.id='v10171FilterNote'; note.className='v10171-filter-note';
      note.textContent=`فلتر تصنيف المنتج: ${wanted} — النتائج المطابقة: ${matched}`;
      box.insertBefore(note,box.firstChild);
    }
  }

  function patchReports(){
    if(window.__financeReportsClassFilterPatchV10171) return;
    window.__financeReportsClassFilterPatchV10171=true;
    ['financeProRenderReportsV15','financeProReportTabV15','financeProRenderCurrentV15'].forEach(fn=>{
      const old=window[fn];
      if(typeof old==='function') window[fn]=function(){const r=old.apply(this,arguments); setTimeout(()=>applyFilter(false),120); setTimeout(()=>applyFilter(false),450); return r;};
    });
    const oldPrint=window.financeProPrintReportV15;
    if(typeof oldPrint==='function') window.financeProPrintReportV15=function(){applyFilter(false); return oldPrint.apply(this,arguments);};
  }
  function boot(){patchReports(); if($('finReportWindowV15')||document.querySelector('#finBodyV15')) applyFilter(false);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>{setTimeout(boot,600);setTimeout(boot,1600);},{once:true});
  try{new MutationObserver(()=>{if($('finReportWindowV15')) setTimeout(()=>applyFilter(false),100);}).observe(document.documentElement,{childList:true,subtree:true});}catch(_){ }
  console.log('Loaded '+VERSION);
})();
