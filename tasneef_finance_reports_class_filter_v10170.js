/* Tasneef v10170 - Universal Finance Reports Product Classification Filter
   Scope: المالية والمخزون / التقارير فقط.
   يعمل فلتر تصنيف المنتج على كل تبويبات التقارير: تقرير المنتجات، جرد المخزون، حركة المخزون، مراكز التكلفة، واستهلاك مراكز التكلفة.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceReportsClassFilterV10170) return;
  window.__tasneefFinanceReportsClassFilterV10170=true;
  const VERSION='v10170-universal-report-product-class-filter';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const norm=v=>S(v).replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').toLowerCase();
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));}
  function itemClass(i){
    const raw=S(i&&(i.product_classification||i.product_class||i.asset_type||i.classification));
    const n=norm(raw);
    if(raw==='أصل'||raw==='اصل'||n==='اصل'||n==='asset'||n==='fixed asset') return 'أصل';
    return 'منتج';
  }
  function itemName(i){return S(i&&(i.name||i.item_name||itemCode(i)||i.id));}
  function allItems(){return A(state().items).filter(Boolean);}
  function currentClass(){return S($('finReportProductClassV10169')?.value || sessionStorage.getItem('tasneef_fin_report_product_class') || '');}
  function setCurrentClass(v){try{sessionStorage.setItem('tasneef_fin_report_product_class',S(v));}catch(_){}}

  function ensureStyle(){
    if($('finReportsClassFilterStyleV10170')) return;
    const st=document.createElement('style'); st.id='finReportsClassFilterStyleV10170';
    st.textContent=`
      #finReportProductClassWrapV10169{min-width:170px!important;display:block!important}
      #finReportProductClassWrapV10169 select{min-width:160px!important;width:100%!important}
      .v10170-class-hidden{display:none!important}
      .v10170-filter-note{background:#eef7f3;border:1px solid #d9e7e2;border-radius:12px;padding:8px 10px;margin:6px 0;color:#073d31;font-weight:800}
    `;
    document.head.appendChild(st);
  }

  function filterBar(){
    const box=$('finReportWindowV15');
    if(!box) return null;
    return box.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions');
  }

  function ensureFilter(){
    const bar=filterBar();
    if(!bar) return null;
    let wrap=$('finReportProductClassWrapV10169');
    let sel=$('finReportProductClassV10169');
    const saved=currentClass();
    if(!wrap || !sel){
      wrap=document.createElement('div');
      wrap.id='finReportProductClassWrapV10169';
      wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10169"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
      const printBtn=[...bar.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
      if(printBtn) bar.insertBefore(wrap,printBtn); else bar.appendChild(wrap);
      sel=$('finReportProductClassV10169');
    }else if(!wrap.parentElement){
      bar.appendChild(wrap);
    }
    // إزالة أي مستمعات قديمة كانت تخفي الجداول بشكل خاطئ، خصوصًا جرد المخزون.
    if(sel && sel.dataset.v10170Bound!=='1'){
      const clone=sel.cloneNode(true);
      clone.value=saved;
      sel.parentNode.replaceChild(clone,sel);
      sel=clone;
      sel.dataset.v10170Bound='1';
      sel.addEventListener('change',()=>{
        setCurrentClass(sel.value);
        setTimeout(()=>{applyFilter(true);},30);
      });
    }
    if(sel && saved && sel.value!==saved) sel.value=saved;
    return sel;
  }

  function textOf(el){return norm(el?el.textContent:'');}
  function productForText(txt){
    const t=norm(txt);
    if(!t) return null;
    const items=allItems();
    // الكود أولًا لأنه أدق من الاسم.
    let found=items.find(i=>{const c=norm(itemCode(i)); return c && t.includes(c);});
    if(found) return found;
    // الاسم الكامل ثانيًا.
    found=items.find(i=>{const n=norm(itemName(i)); return n && n.length>1 && t.includes(n);});
    if(found) return found;
    return null;
  }

  function productForCard(card){
    if(!card) return null;
    const h=card.querySelector('h2,h3,h4');
    if(h){
      const byTitle=productForText(h.textContent);
      if(byTitle) return byTitle;
    }
    return productForText(card.textContent);
  }

  function setHidden(el,hide){
    if(!el) return;
    el.classList.toggle('v10170-class-hidden',!!hide);
    if(hide) el.style.display='none';
    else if(el.style.display==='none') el.style.display='';
  }

  function isEmptyOrTotalRow(tr){
    const t=S(tr?.textContent||'');
    return /لا توجد|المجموع|الإجمالي|الاجمالي|Total/i.test(t);
  }

  function applyFilter(showNote){
    ensureStyle();
    const sel=ensureFilter();
    const wanted=S(sel?.value||'');
    const box=$('finReportWindowV15');
    if(!box) return;
    setCurrentClass(wanted);

    // إذا لا يوجد فلتر، أظهر كل شيء كان مخفيًا بسبب هذا الملف.
    if(!wanted){
      box.querySelectorAll('.v10170-class-hidden').forEach(el=>setHidden(el,false));
      box.querySelectorAll('[data-v10170-filtered]').forEach(el=>{el.removeAttribute('data-v10170-filtered'); if(el.style.display==='none') el.style.display='';});
      box.querySelector('#v10170FilterNote')?.remove();
      return;
    }

    let matched=0, checked=0;

    // تقارير المنتجات التفصيلية: كل منتج داخل بطاقة/قسم مستقل.
    const productSections=[...box.querySelectorAll('.fpr-box,.fpr-root-v10170 > .fin-card,.fin-product-card')];
    productSections.forEach(card=>{
      const it=productForCard(card);
      if(!it) return;
      checked++;
      const ok=itemClass(it)===wanted;
      if(ok) matched++;
      setHidden(card,!ok);
      card.setAttribute('data-v10170-filtered','1');
    });

    // البطاقات الكبيرة في تقرير المنتجات v10170 تكون parent section/card حول عنوان المنتج.
    [...box.querySelectorAll('.fpr-root-v10170 > section, .fpr-root-v10170 > div')].forEach(sec=>{
      if(sec.classList.contains('fpr-toolbar')) return;
      const it=productForCard(sec);
      if(!it) return;
      checked++;
      const ok=itemClass(it)===wanted;
      if(ok) matched++;
      setHidden(sec,!ok);
      sec.setAttribute('data-v10170-filtered','1');
    });

    // الجداول: حركة المخزون، جرد المخزون، مراكز التكلفة. نطابق الصف مع المنتج من الاسم أو الكود.
    box.querySelectorAll('tbody tr').forEach(tr=>{
      if(isEmptyOrTotalRow(tr)){ setHidden(tr,false); return; }
      const it=productForText(tr.textContent);
      if(!it) return; // صف لا يخص منتجًا بعينه، لا نخفيه.
      checked++;
      const ok=itemClass(it)===wanted;
      if(ok) matched++;
      setHidden(tr,!ok);
      tr.setAttribute('data-v10170-filtered','1');
    });

    // إخفاء الكروت/الجداول التي أصبحت بدون صفوف ظاهرة، بدون إخفاء رأس التقرير كاملًا.
    box.querySelectorAll('.fin-card,.fpr-box,section').forEach(card=>{
      if(card.id==='v10170FilterNote') return;
      const rows=[...card.querySelectorAll('tbody tr')].filter(r=>!isEmptyOrTotalRow(r));
      if(rows.length){
        const any=rows.some(r=>r.style.display!=='none' && !r.classList.contains('v10170-class-hidden'));
        setHidden(card,!any);
      }
    });

    if(showNote){
      let note=$('v10170FilterNote');
      if(!note){
        note=document.createElement('div'); note.id='v10170FilterNote'; note.className='v10170-filter-note';
        box.insertBefore(note,box.firstChild);
      }
      note.textContent=`فلتر تصنيف المنتج: ${wanted} — النتائج المطابقة: ${matched}`;
    }
  }

  function patchReports(){
    if(window.__financeReportsClassFilterPatchV10170) return;
    window.__financeReportsClassFilterPatchV10170=true;
    const oldRender=window.financeProRenderReportsV15;
    window.financeProRenderReportsV15=function(){
      const r=oldRender?oldRender.apply(this,arguments):undefined;
      setTimeout(()=>applyFilter(false),120);
      setTimeout(()=>applyFilter(false),400);
      return r;
    };
    const oldTab=window.financeProReportTabV15;
    window.financeProReportTabV15=function(){
      const r=oldTab?oldTab.apply(this,arguments):undefined;
      setTimeout(()=>applyFilter(false),120);
      setTimeout(()=>applyFilter(false),450);
      return r;
    };
    const oldPrint=window.financeProPrintReportV15;
    window.financeProPrintReportV15=function(){
      applyFilter(false);
      return oldPrint?oldPrint.apply(this,arguments):undefined;
    };
  }

  function boot(){
    ensureStyle();
    patchReports();
    if((state().tab||'')==='reports' || $('finReportWindowV15')) applyFilter(false);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>{boot(); setTimeout(boot,800); setTimeout(boot,1800);},{once:true});
  try{
    new MutationObserver(()=>{ if($('finReportWindowV15')) setTimeout(()=>applyFilter(false),80); }).observe(document.documentElement,{childList:true,subtree:true});
  }catch(_){ }
  console.log('Loaded '+VERSION);
})();
