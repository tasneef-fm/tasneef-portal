/* ===== V304: Attendance no-duplicates + technicians + PDF print + supervisor lite ===== */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const E = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D = () => window.data || {};
  const norm = v => S(v).replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim().toLowerCase();
  function today(){ try{return window.today()}catch(e){return new Date().toISOString().slice(0,10);} }
  function getRole(u){ return S(u.role || u.user_role || u.type).toLowerCase(); }
  function isTechnicianUser(u){ const r=getRole(u); const txt=[u.full_name,u.name,u.username,u.job_title,u.position].join(' '); return r==='technician' || r==='tech' || /فني|technician/i.test(txt); }
  function supName(id){ try{return window.supervisorName(id)}catch(e){ const u=A(D().users).find(x=>String(x.id)===String(id)); return u?.full_name || u?.name || '-'; } }
  function workerName(w){ return S(w.name || w.full_name || w.worker_name || w.username || '-'); }
  function workerSid(w){ try{return window.workerSidV223?window.workerSidV223(w):(w.supervisor_id||w.supervisor||w.user_id||'')}catch(e){return w.supervisor_id||'';} }
  function getWorkersUnique(sid,q){
    const seen = new Set();
    let out=[];
    A(D().workers).forEach(w=>{
      const name=workerName(w); if(!name || name==='-') return;
      const wsid=S(workerSid(w));
      if(sid && wsid && String(wsid)!==String(sid)) return;
      if(q && !norm(name).includes(norm(q))) return;
      const key='w|'+norm(name)+'|'+(sid?String(wsid):String(wsid||''));
      if(seen.has(key)) return; seen.add(key);
      out.push({kind:'worker', id:w.id, name, supervisor_id:wsid, raw:w});
    });
    return out;
  }
  function getTechsUnique(sid,q){
    const seen = new Set();
    let out=[];
    A(D().users).filter(isTechnicianUser).forEach(u=>{
      const name=S(u.full_name || u.name || u.username); if(!name) return;
      const usid=S(u.supervisor_id || u.manager_id || '');
      if(sid && usid && String(usid)!==String(sid)) return;
      if(q && !norm(name).includes(norm(q))) return;
      const key='t|'+norm(name);
      if(seen.has(key)) return; seen.add(key);
      out.push({kind:'tech', id:u.id, name, supervisor_id:usid, raw:u});
    });
    return out;
  }
  function ensureAttendanceControls(){
    const actions = document.querySelector('#attendanceMatrixSummary')?.nextElementSibling;
    if(actions && !$('attendancePrintPdfBtnV304')){
      actions.insertAdjacentHTML('beforeend', '<button id="attendancePrintPdfBtnV304" class="light" onclick="printAttendanceMatrixPDFV304()">طباعة PDF</button>');
    }
    const filters = $('attendanceMatrixSearch')?.closest('.filters');
    if(filters && !$('attendancePersonTypeV304')){
      const div=document.createElement('div');
      div.innerHTML='<label>النوع</label><select id="attendancePersonTypeV304" onchange="renderAttendanceMonthly()"><option value="workers">العمال فقط</option><option value="technicians">الفنيين فقط</option><option value="all">العمال والفنيين</option></select>';
      filters.appendChild(div);
    }
  }
  function recordForWorkerDay(person, ds, sid){
    const rows=A(D().attendance).filter(a=>S(a.attendance_date)===ds);
    if(person.kind==='worker'){
      return rows.find(a=>String(a.worker_id)===String(person.id) && (!sid || String(a.supervisor_id||person.supervisor_id||'')===String(sid))) || null;
    }
    // technicians: count actual daily check-in/out logs as present, plus any attendance record if entered manually by same numeric id.
    const log = A(D().logs || D().timeLogs || D().time_logs).find(l=>String(l.user_id||l.supervisor_id||'')===String(person.id) && S(l.log_date || String(l.check_in||'').slice(0,10))===ds);
    if(log) return {status:'present', source:'time_log'};
    return rows.find(a=>String(a.technician_id||a.user_id||a.worker_id)===String(person.id) && (!sid || String(a.supervisor_id||person.supervisor_id||'')===String(sid))) || null;
  }
  window.renderAttendanceMonthly = function(){
    ensureAttendanceControls();
    const body=$('attendanceMatrixBody'), head=$('attendanceMatrixHead'); if(!body||!head) return;
    const month=$('attendanceMatrixMonth')?.value || today().slice(0,7);
    const sid=$('attendanceMatrixSupervisor')?.value || '';
    const q=S($('attendanceMatrixSearch')?.value);
    const type=$('attendancePersonTypeV304')?.value || 'workers';
    const [y,m]=month.split('-').map(Number); const last=new Date(y, m, 0).getDate() || 31;
    const days=Array.from({length:last},(_,i)=>String(i+1).padStart(2,'0'));
    head.innerHTML=`<tr><th>الاسم</th><th>النوع</th><th>المشرف</th>${days.map(d=>`<th>${d}</th>`).join('')}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    let people=[];
    if(type==='workers' || type==='all') people=people.concat(getWorkersUnique(sid,q));
    if(type==='technicians' || type==='all') people=people.concat(getTechsUnique(sid,q));
    let totalP=0,totalA=0;
    body.innerHTML = people.map(p=>{
      let present=0, absent=0;
      const cells=days.map(d=>{
        const ds=`${month}-${d}`; const rec=recordForWorkerDay(p,ds,sid);
        if(!rec) return '<td><span class="att-cell att-empty">-</span></td>';
        if(S(rec.status)==='present'){ present++; totalP++; return '<td><span class="att-cell att-present">ح</span></td>'; }
        absent++; totalA++; return '<td><span class="att-cell att-absent">غ</span></td>';
      }).join('');
      const pct=(present+absent)?(present/(present+absent)*100):0;
      const cls=pct>=90?'green':(pct>=70?'amber':'red');
      return `<tr><td><b>${E(p.name)}</b></td><td>${p.kind==='tech'?'فني':'عامل'}</td><td>${E(supName(p.supervisor_id))}</td>${cells}<td>${present}</td><td>${absent}</td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days.length+6}">لا توجد بيانات حسب الفلاتر المختارة</td></tr>`;
    const pct=(totalP+totalA)?(totalP/(totalP+totalA)*100):0;
    const sum=$('attendanceMatrixSummary'); if(sum){sum.innerHTML=`<div class="kpi"><small>عدد الأسماء</small><b>${people.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalP}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalA}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;}
  };
  window.exportAttendanceMatrixCSV = function(){
    const month=$('attendanceMatrixMonth')?.value || today().slice(0,7);
    const heads=[...document.querySelectorAll('#attendanceMatrixHead th')].map(th=>'"'+th.textContent.trim().replace(/"/g,'""')+'"').join(',');
    const rows=[...document.querySelectorAll('#attendanceMatrixBody tr')].map(tr=>[...tr.children].map(td=>'"'+td.textContent.trim().replace(/"/g,'""')+'"').join(','));
    const csv=[heads,...rows].join('\n');
    try{ window.download(`attendance-${month}.csv`, csv); }catch(e){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=`attendance-${month}.csv`; a.click(); }
  };
  window.printAttendanceMatrixPDFV304 = function(){
    const month=$('attendanceMatrixMonth')?.value || today().slice(0,7);
    const typeText=$('attendancePersonTypeV304')?.selectedOptions?.[0]?.textContent || 'العمال';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جدول الحضور والغياب ${E(month)}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#10231d}h1{color:#0A4033;margin:0 0 8px}.meta{margin-bottom:14px;color:#60706a}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #dce6e2;padding:5px;text-align:center}th{background:#eef6f3;color:#0A4033}.att-present,.badge.green{color:#137a4b;font-weight:700}.att-absent,.badge.red{color:#b83232;font-weight:700}@media print{@page{size:A4 landscape;margin:10mm}button{display:none}}</style></head><body><button onclick="print()">طباعة / حفظ PDF</button><h1>جدول الحضور والغياب الشهري</h1><div class="meta">الشهر: ${E(month)} | النوع: ${E(typeText)}</div><table>${$('attendanceMatrixHead')?.parentElement?.innerHTML||''}</table></body></html>`;
    const w=window.open('','_blank'); if(!w) return alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    w.document.write(html.replace('<table>','<table><thead>'+($('attendanceMatrixHead')?.innerHTML||'')+'</thead><tbody>'+($('attendanceMatrixBody')?.innerHTML||'')+'</tbody>'));
    w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(e){}},350);
  };
  // Supervisor page lite: dedupe attendance list and reduce repeated heavy refreshes.
  window.renderSupervisorAttendanceList = function(){
    const box=$('supervisorAttendanceList'); if(!box) return;
    const u=(typeof window.session==='function')?window.session():null; const sid=S(u?.id||'');
    const people=getWorkersUnique(sid,'');
    box.innerHTML=people.map(p=>`<div class="quick-item"><b>${E(p.name)}</b><select data-worker="${E(p.id)}"><option value="present">حاضر</option><option value="absent">غائب</option></select></div>`).join('') || '<div class="sup-help">لا يوجد عمال مرتبطون بهذا المشرف</div>';
  };
  const oldSaveSup=window.saveSupervisorAttendance;
  window.saveSupervisorAttendance = async function(){
    const u=(typeof window.session==='function')?window.session():null; const date=$('attendanceDate')?.value || today();
    const rows=[]; const seen=new Set();
    document.querySelectorAll('#supervisorAttendanceList select').forEach(sel=>{
      const wid=sel.dataset.worker; if(seen.has(String(wid))) return; seen.add(String(wid));
      rows.push({attendance_date:date, worker_id:Number(wid), supervisor_id:Number(u?.id)||null, project_id:null, status:sel.value, created_by:Number(u?.id)||null});
    });
    if(!rows.length) return (typeof window.msg==='function'?window.msg('لا يوجد عمال للتحضير','err'):alert('لا يوجد عمال للتحضير'));
    const {error}=await window.sb.from('attendance').upsert(rows,{onConflict:'attendance_date,worker_id'});
    if(error) return (typeof window.msg==='function'?window.msg(error.message,'err'):alert(error.message));
    if(typeof window.msg==='function') window.msg('تم حفظ التحضير بدون تكرار');
    setTimeout(()=>{ try{renderSupervisorAttendanceList();}catch(e){} }, 100);
  };
  function boot(){ ensureAttendanceControls(); try{ if($('attendanceMatrixBody')) window.renderAttendanceMonthly(); }catch(e){console.error(e)} try{ if($('supervisorAttendanceList')) window.renderSupervisorAttendanceList(); }catch(e){} }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
  window.addEventListener('load',()=>setTimeout(boot,1200));
  setTimeout(boot,1800);
})();
