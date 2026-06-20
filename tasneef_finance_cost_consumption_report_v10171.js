/* Tasneef v10171 - Finance Cost Center Consumption Report
   Scope: المالية والمخزون - التقارير فقط. يضيف تقرير استهلاك مراكز التكلفة ولا يغير البيانات. */
(function(){
  'use strict';
  if(window.__tasneefFinanceCostConsumptionReportV10171) return;
  window.__tasneefFinanceCostConsumptionReportV10171=true;
  const VAT=0.15;
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const state=()=>window.financeProStateV15||{};
  const consumeTypes=['consume','damaged','waste','scrap'];
  const outTypes=['out','consume','damaged','waste','scrap'];
  function safeJson(v){const t=S(v); if(!t.startsWith('finance_pro_v15:'))return{}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}}
  function productCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.code));}
  function distributorCode(i,m){return S(i&&(i.supplier_barcode||i.distributor_code||i.supplier_code||i.vendor_code)) || S(m&&(m.barcode||m.supplier_barcode||m.distributor_code||m.supplier_code)) || '-';}
  function productKeys(o){const keys=[]; [o&&o.id,o&&o.item_id,o&&o.product_code,o&&o.serial_number,o&&o.barcode,o&&o.supplier_barcode,o&&o.distributor_code,o&&o.code,o&&o.name,o&&o.item_name].forEach(v=>{const x=S(v).toLowerCase(); if(x&&!keys.includes(x))keys.push(x);}); return keys;}
  function officialItemFor(obj){const keys=productKeys(obj); return A(state().items).find(i=>productKeys(i).some(k=>keys.includes(k)))||null;}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function productClass(i){const raw=S(i&&(i.product_classification||i.product_class||i.asset_type||i.classification))||'منتج'; return (raw==='أصل'||raw==='اصل'||raw.toLowerCase()==='asset')?'أصل':'منتج';}
  function unitCostMove(m){const meta=safeJson(m&&m.notes)||{}; if(N(m&&m.unit_cost)>0)return N(m.unit_cost); if(N(meta.beforeVat)>0&&N(m&&m.quantity)>0)return N(meta.beforeVat)/N(m.quantity); return itemCost(officialItemFor(m));}
  function movementDate(m){return S(m&&(m.movement_date||m.date||m.created_at)).slice(0,10);}
  function projectName(id){const p=A(state().projects).find(x=>String(x.id)===String(id)); return S(p&&(p.name||p.project_name))||'';}
  function centerOf(r){return S(r.center||r.cost_center||r.project_name||r.projectName||projectName(r.project_id)||'غير محدد')||'غير محدد';}
  function distributionRows(m){
    const meta=safeJson(m&&m.notes)||{}; const rows=A(meta.distribution);
    if(!rows.length) return [{...m,parent_id:m.id,base_movement_type:S(m.movement_type),project_name:S(m.project_name||projectName(m.project_id)||''),order_no:S(m.order_no||'')}];
    return rows.map((d,idx)=>({...m,parent_id:m.id,distribution_index:idx,is_distribution_row:true,base_movement_type:S(m.movement_type),movement_type:S(d.type||m.movement_type)||S(m.movement_type),quantity:N(d.qty),center:S(d.center||m.cost_center),project_id:d.projectId||m.project_id||null,project_name:S(d.projectName||projectName(d.projectId)||m.project_name||''),order_no:S(d.orderNo||m.order_no||''),distribution_note:S(d.note||'')})).filter(r=>N(r.quantity)>0);
  }
  function filters(){return {q:S($('finReportSearchV15')?.value).toLowerCase(), product:S($('finReportProductV15')?.value), from:S($('finReportFromV15')?.value), to:S($('finReportToV15')?.value), center:S($('finReportCenterV15')?.value), project:S($('finReportProjectV15')?.value), type:S($('finReportTypeV15')?.value), productClass:S($('finReportProductClassV10169')?.value)};}
  function passRow(r,f){
    const dt=movementDate(r);
    if(f.from&&dt<f.from)return false;
    if(f.to&&dt>f.to)return false;
    if(f.center&&centerOf(r)!==f.center)return false;
    if(f.project&&S(r.project_id)!==f.project)return false;
    if(f.product&&S(r.item_id)!==f.product)return false;
    if(f.productClass && productClass(officialItemFor(r)||r)!==f.productClass)return false;
    if(f.type==='in'&&S(r.movement_type)!=='in')return false;
    if(f.type==='out'&&!outTypes.includes(S(r.movement_type)))return false;
    if(f.q){
      const it=officialItemFor(r)||{};
      const hay=[r.item_name,productCode(it)||r.product_code,r.barcode,r.receiver,r.reason,r.project_name,r.order_no,centerOf(r),distributorCode(it,r)].map(S).join(' ').toLowerCase();
      if(!hay.includes(f.q))return false;
    }
    return true;
  }
  function rowsData(){
    const f=filters();
    const rows=A(state().movements).flatMap(distributionRows).filter(r=>N(r.quantity)>0 && ['out','return',...consumeTypes].includes(S(r.movement_type)) && passRow(r,f));
    const map=new Map();
    rows.forEach(r=>{
      const it=officialItemFor(r)||{};
      const internal=productCode(it)||S(r.product_code||r.barcode)||'-';
      const dist=distributorCode(it,r);
      const product=S((it&&it.name)||r.item_name)||'-';
      const center=centerOf(r);
      const key=[internal,dist,product,center].join('|');
      if(!map.has(key)) map.set(key,{internal,dist,product,center,out:0,ret:0,consume:0,current:0,net:0,vat:0,gross:0});
      const g=map.get(key), t=S(r.movement_type), q=N(r.quantity);
      if(t==='out') g.out += q;
      if(t==='return') g.ret += q;
      if(consumeTypes.includes(t)){
        g.consume += q;
        const net=q*unitCostMove(r);
        g.net += net; g.vat += net*VAT; g.gross += net*(1+VAT);
      }
      g.current=Math.max(0,g.out-g.ret-g.consume);
    });
    return [...map.values()].sort((a,b)=>a.center.localeCompare(b.center,'ar')||a.product.localeCompare(b.product,'ar'));
  }
  const sum=(arr,k)=>A(arr).reduce((a,x)=>a+N(x[k]),0);
  function reportTableHtml(forPrint=false){
    const rows=rowsData();
    const totals={out:sum(rows,'out'),ret:sum(rows,'ret'),consume:sum(rows,'consume'),current:sum(rows,'current'),net:sum(rows,'net'),vat:sum(rows,'vat'),gross:sum(rows,'gross')};
    const body=rows.map(r=>`<tr><td>${esc(r.internal)}</td><td>${esc(r.dist)}</td><td>${esc(r.product)}</td><td>${esc(r.center)}</td><td>${N(r.out)}</td><td>${N(r.ret)}</td><td>${N(r.consume)}</td><td>${N(r.current)}</td><td>${money(r.net)}</td><td>${money(r.vat)}</td><td>${money(r.gross)}</td></tr>`).join('') || '<tr><td colspan="11">لا توجد بيانات حسب الفلاتر</td></tr>';
    return `<div class="fccr-root-v10171 ${forPrint?'print-mode':''}">
      <div class="fccr-title"><div><h2>تقرير استهلاك مراكز التكلفة</h2><p>يعرض الخارج والراجع والمستهلك والكمية الحالية وقيمة الاستهلاك حسب مركز التكلفة والمنتج.</p></div><button type="button" onclick="financeProPrintCostConsumptionV10171()">طباعة التقرير</button></div>
      <div class="fccr-table"><table><thead><tr><th>كود المنتج الداخلي</th><th>كود الموزع</th><th>اسم المنتج</th><th>مركز التكلفة</th><th>الخارج</th><th>الراجع</th><th>المستهلك</th><th>الكمية الحالية</th><th>قيمة المستهلك قبل الضريبة</th><th>الضريبة</th><th>القيمة بعد الضريبة</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="4">المجموع</td><td>${totals.out}</td><td>${totals.ret}</td><td>${totals.consume}</td><td>${totals.current}</td><td>${money(totals.net)}</td><td>${money(totals.vat)}</td><td>${money(totals.gross)}</td></tr></tfoot></table></div>
      <div class="fccr-signs"><div>المحاسب</div><div>مدير المالية</div><div>اعتماد الإدارة</div></div>
    </div>`;
  }
  function style(){ if($('fccrStyleV10171'))return; const st=document.createElement('style'); st.id='fccrStyleV10171'; st.textContent=`
    .fccr-root-v10171{display:grid;gap:14px}.fccr-title{display:flex;align-items:center;justify-content:space-between;background:#eef7f3;border:1px solid #d9e7e2;border-radius:18px;padding:14px;color:#063d31}.fccr-title h2{margin:0 0 5px;color:#063d31}.fccr-title p{margin:0;color:#5f746d}.fccr-title button{border:0;border-radius:12px;background:#063d31;color:#fff;font-weight:900;padding:10px 18px}.fccr-table{overflow:auto;border:1px solid #d9e7e2;border-radius:16px;background:#fff}.fccr-table table{width:100%;border-collapse:collapse;font-size:12px}.fccr-table th{background:#063d31;color:#fff;padding:10px;text-align:center;white-space:nowrap}.fccr-table td{border-bottom:1px solid #e8efed;padding:9px;text-align:center;white-space:nowrap}.fccr-table tbody tr:nth-child(even){background:#fbfdfc}.fccr-table tfoot td{background:#eef5f2;font-weight:900}.fccr-signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px}.fccr-signs div{padding-top:36px;border-top:3px solid #253f39;text-align:center;font-weight:900;color:#173d34}@media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.side,.topbar,.fin-hero,.fin-tabs,.fin-actions,.fccr-title button{display:none!important}.fccr-title{border:none;background:#fff!important;border-radius:0;border-bottom:4px solid #063d31}.fccr-table th{background:#063d31!important;color:#fff!important}.fccr-signs{break-inside:avoid}@page{size:A4 landscape;margin:8mm}}`;
    document.head.appendChild(st);
  }
  function addTab(){
    const st=state(); if(st.tab!=='reports')return;
    const tabs=$('finBodyV15')?.querySelector('.fin-tabs');
    if(!tabs || tabs.querySelector('[data-cost-consumption-v10171]'))return;
    const btn=document.createElement('button'); btn.type='button'; btn.dataset.costConsumptionV10171='1'; btn.textContent='تقرير استهلاك مراكز التكلفة'; btn.onclick=function(){showReport();};
    tabs.appendChild(btn);
    tabs.style.gridTemplateColumns='repeat(5,1fr)';
  }

  function ensureReportClassFilter(){
    const box=$('finReportWindowV15'); if(!box || $('finReportProductClassV10169')) return;
    const filters=box.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions');
    if(!filters) return;
    const wrap=document.createElement('div');
    wrap.id='finReportProductClassWrapV10169';
    wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10169"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
    const printBtn=[...filters.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
    if(printBtn) filters.insertBefore(wrap, printBtn); else filters.appendChild(wrap);
    $('finReportProductClassV10169').addEventListener('change',()=>{ afterRender(); if(state().reportTab==='costConsumption') showReport(); });
  }

  function showReport(){ ensureReportClassFilter();
    style(); const st=state(); st.reportTab='costConsumption';
    addTab();
    const tabs=$('finBodyV15')?.querySelectorAll('.fin-tabs button')||[];
    tabs.forEach(b=>b.classList.toggle('active',!!b.dataset.costConsumptionV10171));
    const box=$('finReportWindowV15'); if(box) box.innerHTML=reportTableHtml(false);
    const kpis=$('finReportWindowV15')?.parentElement?.querySelector('.fin-grid.three');
    if(kpis){ const rows=rowsData(); const net=sum(rows,'net'), vat=sum(rows,'vat'), gross=sum(rows,'gross'); kpis.innerHTML=`<div class="fin-card fin-kpi"><small>الإجمالي قبل الضريبة</small><b>${money(net)}</b></div><div class="fin-card fin-kpi"><small>الضريبة 15%</small><b>${money(vat)}</b></div><div class="fin-card fin-kpi"><small>الإجمالي بعد الضريبة</small><b>${money(gross)}</b></div>`; }
  }
  function afterRender(){ setTimeout(()=>{addTab(); if(state().tab==='reports' && state().reportTab==='costConsumption') showReport();},70); }
  const oldRender=window.financeProRenderReportsV15; window.financeProRenderReportsV15=function(){ if(typeof oldRender==='function')oldRender.apply(this,arguments); afterRender(); };
  const oldTab=window.financeProReportTabV15; window.financeProReportTabV15=function(tab){ if(tab==='costConsumption')return showReport(); if(typeof oldTab==='function')oldTab.apply(this,arguments); afterRender(); };
  const oldPrint=window.financeProPrintReportV15; window.financeProPrintReportV15=function(){ if(state().tab==='reports' && state().reportTab==='costConsumption')return window.financeProPrintCostConsumptionV10171(); if(typeof oldPrint==='function')return oldPrint.apply(this,arguments); };
  window.financeProPrintCostConsumptionV10171=function(){ style(); const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير استهلاك مراكز التكلفة</title><style>${$('fccrStyleV10171')?.textContent||''}body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#073d31}</style></head><body>${reportTableHtml(true)}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`; const w=window.open('','_blank'); if(!w)return alert('المتصفح منع فتح نافذة الطباعة'); w.document.open(); w.document.write(html); w.document.close(); };
  function boot(){style(); afterRender(); setTimeout(afterRender,800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot(); window.addEventListener('load',boot,{once:true});
  console.log('Loaded v10171 cost center consumption report');
})();
