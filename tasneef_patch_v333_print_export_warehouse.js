/* ===== TASNEEF V333 - Professional monthly print + export/import buttons + warehouse manager light view ===== */
(function(){
  const VERSION='v333-print-export-warehouse';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'');
  const N=v=>Number(v||0);
  const esc=s=>S(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const arDate=()=>new Date().toLocaleString('ar-SA');
  const getUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'null')||{};}catch(e){return {};}};
  const isWarehouse=()=>getUser().role==='warehouse_manager';
  function fileDownload(name,content,type){
    const blob=new Blob([content],{type:type||'application/octet-stream'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  function csvCell(v){return '"'+S(v).replace(/"/g,'""')+'"';}
  function toCsv(rows, headers){
    const keys=headers?headers.map(h=>h.key):Object.keys(rows[0]||{});
    const names=headers?headers.map(h=>h.name):keys;
    return '\ufeff'+[names.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(Array.isArray(r[k])?r[k].join('|'):(r[k]??''))).join(','))].join('\n');
  }
  function xml(s){return S(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));}
  function workbookXml(sheets){
    const sheetXml=sheets.map(sh=>`<Worksheet ss:Name="${xml(sh.name).slice(0,31)}"><Table>${(sh.rows||[]).map(row=>`<Row>${row.map(c=>`<Cell><Data ss:Type="String">${xml(c)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet>`).join('');
    return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#0A4F3F" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style></Styles>${sheetXml}</Workbook>`;
  }
  function dataRef(){try{return data||{};}catch(e){return window.data||{};}}
  function supName(id){try{if(typeof supervisorName==='function')return supervisorName(id);}catch(e){} const d=dataRef(); return (d.supervisors||d.users||[]).find(x=>String(x.id)===String(id))?.full_name||id||'-';}
  function projName(id){try{if(typeof projectName==='function')return projectName(id);}catch(e){} const d=dataRef(); return (d.projects||[]).find(x=>String(x.id)===String(id))?.name||id||'-';}
  function minsTxt(m){m=Math.round(N(m)); const h=Math.floor(m/60), mm=m%60; return h?`${h} ساعة ${mm} دقيقة`:`${mm} دقيقة`;}
  function pct(v){return (Math.round(N(v)*10)/10)+'%';}
  function monthlyRows(){
    try{ if(typeof monthlyRowsV331==='function') return monthlyRowsV331(); }catch(e){}
    try{ if(typeof monthlyRowsV60==='function') return monthlyRowsV60(); }catch(e){}
    const rows=[]; document.querySelectorAll('#monthlyBody tr').forEach(tr=>{const t=[...tr.children].map(td=>td.textContent.trim()); if(t.length>=7) rows.push({s:t[0],p:t[1],workers:t[2],c:t[3],a:0,t:0,actualText:t[4],travelText:t[5],percentText:t[6],manualOnly:t[7]});});
    return rows;
  }

  window.printMonthlyReportV57 = async function(){
    try{ if(typeof renderMonthly==='function') await renderMonthly(); }catch(e){}
    const rows=monthlyRows();
    const month=$('monthlyMonth')?.value||new Date().toISOString().slice(0,7);
    const selectedSup=$('monthlySupervisor')?.value?supName($('monthlySupervisor').value):'الكل';
    let total=0, travel=0; rows.forEach(r=>{total+=N(r.a); travel+=N(r.t);});
    const bodyRows=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(supName(r.s))}</td><td>${esc(projName(r.p))}</td><td class="workers">${esc(r.workers||'-')}</td><td>${esc(r.actualText||minsTxt(r.a))}</td><td>${esc(r.travelText||N(r.t)+' دقيقة')}</td><td><b>${esc(r.percentText||pct(r.percent))}</b></td><td>${esc(r.manualOnly?'يدوي':'سجلات')}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">لا توجد بيانات للشهر المحدد</td></tr>';
    const logo=(document.querySelector('img[src*="tasneef"], img[src*="logo"]')?.getAttribute('src'))||'tasneef_logo_print.png';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>
      @page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#0b3f34;background:#fff;font-size:12px}.page{padding:10px}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #0a4f3f;padding-bottom:12px;margin-bottom:12px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:72px;height:52px;object-fit:contain;border:1px solid #d8e7e1;border-radius:12px;padding:5px}.brand h2{margin:0;font-size:24px}.brand p,.title p{margin:4px 0 0;color:#65756e}.title{text-align:left}.title h1{margin:0;font-size:30px;color:#0a4f3f}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0 14px}.kpi{border:1px solid #d9e8e3;border-radius:14px;padding:10px;background:#f8fbfa;text-align:center}.kpi small{display:block;color:#6e7e77}.kpi b{display:block;font-size:18px;margin-top:5px;color:#0a4f3f}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0a4f3f;color:#fff;padding:9px;border:1px solid #0a4f3f;font-size:12px}td{padding:8px;border:1px solid #dce8e4;text-align:center;vertical-align:middle}tbody tr:nth-child(even)td{background:#f7fbfa}.workers{text-align:right;line-height:1.7}.empty{padding:30px;color:#777}.signs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px}.sign{border:1px solid #d9e8e3;border-radius:14px;padding:10px;height:76px}.sign b{display:block;color:#0a4f3f;margin-bottom:22px}.footer{text-align:center;margin-top:10px;color:#6b7b75;border-top:1px solid #dce8e4;padding-top:8px}.printBtn{position:fixed;left:10px;top:10px;padding:8px 14px}@media print{.printBtn{display:none}.page{padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><button class="printBtn" onclick="print()">طباعة</button><div class="page"><div class="top"><div class="brand"><img src="${esc(logo)}"><div><h2>شركة تصنيف لإدارة المرافق</h2><p>إدارة التشغيل والمتابعة الشهرية</p></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>الشهر: ${esc(month)} | المشرف: ${esc(selectedSup)} | تاريخ الطباعة: ${esc(arDate())}</p></div></div><div class="kpis"><div class="kpi"><small>عدد الصفوف</small><b>${rows.length}</b></div><div class="kpi"><small>عدد المشرفين</small><b>${new Set(rows.map(r=>S(r.s))).size}</b></div><div class="kpi"><small>عدد المشاريع</small><b>${new Set(rows.map(r=>S(r.p))).size}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${esc(minsTxt(total))}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div></div><table><thead><tr><th style="width:42px">#</th><th>المشرف</th><th>المشروع</th><th style="width:32%">أسماء العمال</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>النسبة</th><th>المصدر</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="signs"><div class="sign"><b>إعداد التشغيل</b></div><div class="sign"><b>مراجعة الإدارة</b></div><div class="sign"><b>اعتماد المدير</b></div></div><div class="footer">تم إنشاء التقرير من نظام تصنيف لإدارة المرافق</div></div><script>setTimeout(()=>print(),500)<\/script></body></html>`;
    const w=window.open('','_blank'); if(!w) return alert('المتصفح منع نافذة الطباعة'); w.document.write(html); w.document.close();
  };

  window.exportMonthlyCSV = async function(){
    try{ if(typeof renderMonthly==='function') await renderMonthly(); }catch(e){}
    const rows=monthlyRows();
    const lines=[['الشهر','المشرف','المشروع','أسماء العمال','الساعات الفعلية','وقت الانتقال','النسبة','المصدر'],...rows.map(r=>[$('monthlyMonth')?.value||'',supName(r.s),projName(r.p),r.workers||'',r.actualText||minsTxt(r.a),r.travelText||N(r.t)+' دقيقة',r.percentText||pct(r.percent),r.manualOnly?'يدوي':'سجلات'])];
    fileDownload('monthly_times_'+(($('monthlyMonth')?.value)||'')+'.csv', lines.map(row=>row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };

  window.showExportSlideV223=function(i,btn){
    const slides=[...document.querySelectorAll('.export-slide-v222')], buttons=[...document.querySelectorAll('.export-nav-v223 button')];
    slides.forEach((s,k)=>s.classList.toggle('active',k===i)); buttons.forEach((b,k)=>b.classList.toggle('active',k===i)); if(btn) btn.classList.add('active');
  };
  function rowsFor(name, rows){
    rows=rows||[]; if(!rows.length) return [[name],['لا توجد بيانات']];
    const keys=Object.keys(rows[0]||{}).slice(0,18); return [[name],keys,...rows.slice(0,500).map(r=>keys.map(k=>Array.isArray(r[k])?r[k].join('|'):S(r[k])))];
  }
  function exportSheets(){
    const d=dataRef(); const month=$('meetingExportMonth')?.value||$('monthlyMonth')?.value||'';
    const local=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}};
    return [
      {name:'ملخص',rows:[['تقرير اجتماع تصنيف'],['الشهر',month],['تاريخ التصدير',arDate()],['المشاريع',(d.projects||[]).length],['العمال',(d.workers||[]).length],['السجلات',(d.logs||[]).length],['التكتات',(d.tickets||[]).length]]},
      {name:'المشاريع',rows:rowsFor('المشاريع',d.projects).slice(1)},
      {name:'المشرفين',rows:rowsFor('المشرفين',d.supervisors||[]).slice(1)},
      {name:'العمال',rows:rowsFor('العمال',d.workers||[]).slice(1)},
      {name:'التسجيلات اليومية',rows:rowsFor('التسجيلات اليومية',d.logs||[]).slice(1)},
      {name:'الحضور والغياب',rows:rowsFor('الحضور والغياب',d.attendance||[]).slice(1)},
      {name:'التكتات',rows:rowsFor('التكتات',d.tickets||[]).slice(1)},
      {name:'الأوردرات',rows:rowsFor('الأوردرات',(d.orders||window.ORDERS_SEED||[])).slice(1)},
      {name:'الأوقات الشهرية',rows:[['المشرف','المشروع','العمال','الوقت','الانتقال','النسبة'],...monthlyRows().map(r=>[supName(r.s),projName(r.p),r.workers||'',r.actualText||minsTxt(r.a),r.travelText||N(r.t)+' دقيقة',r.percentText||pct(r.percent)])]},
      {name:'الموردين',rows:rowsFor('الموردين',local('tasneef_finance_suppliers_v312')).slice(1)},
      {name:'المنتجات',rows:rowsFor('المنتجات',local('tasneef_finance_items_v312')).slice(1)},
      {name:'حركة المخزون',rows:rowsFor('حركة المخزون',local('tasneef_finance_moves_v312')).slice(1)}
    ];
  }
  window.previewMeetingExportV223=function(){
    const box=$('meetingExportPreview'); if(!box) return;
    const sheets=exportSheets(); box.innerHTML=`<div class="card"><h3>معاينة ملف الاجتماع</h3><p class="muted">سيتم تنزيل ملف Excel يحتوي على ${sheets.length} تبويب.</p><div class="kpis small">${sheets.map(s=>`<div class="kpi"><small>${esc(s.name)}</small><b>${Math.max(0,(s.rows||[]).length-1)}</b></div>`).join('')}</div></div>`;
  };
  window.exportMeetingExcelV229=function(btn){
    try{ if(btn) btn.disabled=true; const sheets=exportSheets(); fileDownload('تقرير_اجتماع_تصنيف_'+(new Date().toISOString().slice(0,10))+'.xls','\ufeff'+workbookXml(sheets),'application/vnd.ms-excel;charset=utf-8'); if(typeof msg==='function') msg('تم تنزيل ملف الاجتماع','ok'); }
    catch(e){console.error(e); alert(e.message||'تعذر تنزيل ملف الاجتماع');}
    finally{ if(btn) btn.disabled=false; }
  };
  window.exportMeetingExcelV230=window.exportMeetingExcelV229; window.exportMeetingExcelV223=window.exportMeetingExcelV229;
  window.downloadImportTemplateV223=function(){
    const sheets=[
      {name:'projects',rows:[['name','building_count','unit_count','contract_start','contract_end','supervisor_name','notes']]},
      {name:'workers',rows:[['full_name','supervisor_name','project_name','role','salary','start_date','notes']]},
      {name:'users',rows:[['full_name','username','password','role','is_active']]},
      {name:'suppliers',rows:[['name','phone','vat','type','status','notes']]},
      {name:'products',rows:[['name','internal_code','company_code','category','unit','price','vat_mode','vat_rate','min_qty','supplier_name','notes']]},
      {name:'time_logs',rows:[['date','supervisor_name','project_name','visit_type','check_in','check_out','travel_minutes','notes']]},
      {name:'tickets',rows:[['project_name','title','description','priority','status','technician','notes']]}
    ];
    fileDownload('tasneef_import_template.xls','\ufeff'+workbookXml(sheets),'application/vnd.ms-excel;charset=utf-8');
  };
  window.exportTable=async function(table){
    let rows=[];
    const d=dataRef(); const map={app_users:d.users,projects:d.projects,workers:d.workers,attendance:d.attendance,time_logs:d.logs,tickets:d.tickets};
    if(map[table]) rows=map[table];
    else if(typeof sb!=='undefined'){ try{ const res=await Promise.race([sb.from(table).select('*').limit(1000),new Promise((_,rej)=>setTimeout(()=>rej(new Error('انتهت مهلة التصدير')),8000))]); if(res.error) throw res.error; rows=res.data||[]; }catch(e){alert(e.message||'تعذر التصدير'); return;} }
    fileDownload(table+'.csv',toCsv(rows),'text/csv;charset=utf-8');
  };

  function enhanceExportPage(){
    const page=$('export'); if(!page||$('exportImportRealBoxV333')) return;
    const box=document.createElement('div'); box.id='exportImportRealBoxV333'; box.className='card'; box.innerHTML=`<h3>استيراد ومعاينة ملف</h3><p class="muted">ارفع CSV أو Excel بعد تعبئته من نموذج الاستيراد. يتم عرض معاينة أولية قبل أي اعتماد.</p><div class="actions"><input type="file" id="importFileV333" accept=".csv,.xls,.xlsx"><button class="light" onclick="previewImportFileV333()">معاينة الملف</button><button class="light" onclick="downloadImportTemplateV223()">تنزيل النموذج</button></div><div id="importPreviewV333" class="table-wrap"></div>`;
    page.appendChild(box);
  }
  window.previewImportFileV333=function(){
    const f=$('importFileV333')?.files?.[0]; if(!f) return alert('اختر ملف أولاً'); const reader=new FileReader();
    reader.onload=()=>{const txt=S(reader.result).slice(0,20000); const rows=txt.split(/\r?\n/).slice(0,15).map(r=>r.split(',').slice(0,10)); $('importPreviewV333').innerHTML=`<table><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="muted">هذه معاينة فقط. الاعتماد الفعلي يتم بعد مطابقة الأعمدة حتى لا تتلف البيانات.</p>`;};
    reader.readAsText(f,'utf-8');
  };

  function applyWarehouseView(){
    if(!isWarehouse()) return;
    const sec=$('financeInventoryV312'); if(!sec) return;
    sec.classList.add('warehouse-view-v333');
    const tabBtns=[...sec.querySelectorAll('.fi-tabs button')];
    tabBtns.forEach(b=>{const t=(b.textContent||'').trim(); if(!/المنتجات|حركة المخزون/.test(t)) b.style.display='none';});
    const activeBtn=tabBtns.find(b=>/المنتجات/.test(b.textContent||''));
    if(activeBtn && !sec.dataset.whStarted){ sec.dataset.whStarted='1'; setTimeout(()=>{try{financeV312Tab('items',activeBtn)}catch(e){}},100); }
    setTimeout(()=>{
      const active=sec.querySelector('.fi-tab-body:not(.hidden)')||sec;
      if(/المنتجات/.test(activeBtn?.textContent||'' ) || sec.querySelector('#fiBody_items:not(.hidden)')){
        const body=$('fiBody_items'); if(body){
          body.querySelectorAll('.fi-card').forEach((c,i)=>{ if(i===0 && /إضافة|تعديل|صورة المنتج/.test(c.textContent||'')) c.style.display='none'; });
          body.querySelectorAll('button').forEach(btn=>{ if(/حفظ|تفريغ|تعديل|حذف/.test(btn.textContent||'')) btn.style.display='none'; });
        }
      }
      const mov=$('fiBody_movements'); if(mov){ mov.querySelectorAll('select[id*="moveCost"],input[id*="moveVat"],label').forEach(()=>{}); }
    },250);
  }
  const oldShow=window.showPage;
  window.showPage=function(id,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(id==='export') setTimeout(enhanceExportPage,120); if(id==='financeInventoryV312') setTimeout(applyWarehouseView,180); return r;};
  const oldFinanceTab=window.financeV312Tab;
  if(oldFinanceTab){ window.financeV312Tab=function(tab,btn){ const r=oldFinanceTab.apply(this,arguments); setTimeout(applyWarehouseView,150); return r; }; }
  function boot(){enhanceExportPage(); applyWarehouseView(); const badge=document.querySelector('.export-hero-badge-v222'); if(badge) badge.textContent='V333';}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1000)); window.addEventListener('load',()=>setTimeout(boot,1500));
  console.log('Tasneef '+VERSION+' loaded');
})();
