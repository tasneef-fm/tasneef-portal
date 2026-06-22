/* ===== V10191: Monthly times auto-update current supervisors and worker names ===== */
(function(){
  'use strict';
  if(window.__tasneefMonthlyAutoNamesV10191) return;
  window.__tasneefMonthlyAutoNamesV10191 = true;

  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const byId = id => document.getElementById(id);
  const ds = () => window.data || data || {};
  const escHtml = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normName = name => S(name)
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();

  function pRow(projectId){ return (ds().projects || []).find(p => S(p.id) === S(projectId)) || {}; }
  function sRow(supervisorId){ return (ds().supervisors || ds().users || []).find(u => S(u.id) === S(supervisorId)) || {}; }
  function pName(projectId){ try{ return projectName(projectId); }catch(_){ return pRow(projectId).name || '-'; } }
  function sName(supervisorId){ try{ return supervisorName(supervisorId); }catch(_){ return sRow(supervisorId).full_name || sRow(supervisorId).name || '-'; } }
  function todayMonth(){ try{ return today().slice(0,7); }catch(_){ return new Date().toISOString().slice(0,7); } }
  function logDay(l){ return S(l.log_date || l.date || l.check_in || l.created_at).slice(0,10); }
  function currentProjectSupervisor(projectId, fallback){ return pRow(projectId).supervisor_id || fallback || ''; }
  function workerPid(w){ try{ return workerProjectId(w); }catch(_){ return w.project_id || w.assigned_project_id || w.current_project_id || ''; } }
  function workerSid(w){ try{ return workerSupId(w); }catch(_){ return w.app_supervisor_id || w.supervisor_id || w.assigned_supervisor_id || ''; } }
  function actualMinutes(l){ try{ if(typeof logActualMinutes === 'function') return N(logActualMinutes(l)); }catch(_){} try{ if(l.check_in && l.check_out && typeof minutesBetween === 'function') return N(minutesBetween(l.check_in,l.check_out)); }catch(_){} return N(l.duration_minutes); }
  function requiredMinutes(l){ try{ if(typeof logRequiredMinutes === 'function') return N(logRequiredMinutes(l)); }catch(_){} return N(l.required_minutes || l.daily_required_minutes || l.required_daily_minutes); }
  function minsText(m){ try{ return minsToText(m); }catch(_){ return Math.round(N(m)).toLocaleString('en-US') + ' دقيقة'; } }
  function pctText(p){ try{ return percentText(p); }catch(_){ return N(p).toFixed(1) + '%'; } }
  function diffText(d){ try{ return monthlyDiffTextV57(d); }catch(_){ return d > 0 ? 'زيادة ' + minsText(d) : d < 0 ? 'نقص ' + minsText(Math.abs(d)) : 'ضمن الوقت'; } }
  function statusFromDiff(diff, required){ try{ if(typeof monthlyStatusFromDiffV60 === 'function') return monthlyStatusFromDiffV60(diff, required); }catch(_){} if(!N(required)) return {text:'غير محدد', cls:'neutral'}; if(diff < -5) return {text:'ناقص وقت', cls:'bad'}; if(diff > 5) return {text:'زيادة وقت', cls:'warn'}; return {text:'ضمن الوقت', cls:'ok'}; }
  function commitmentClass(percent, required){ try{ if(typeof monthlyCommitmentClassV60 === 'function') return monthlyCommitmentClassV60(percent, required); }catch(_){} if(!N(required)) return 'neutral'; return percent >= 95 && percent <= 105 ? 'green' : (percent > 105 ? 'amber' : 'red'); }

  function currentWorkersForProject(projectId){
    const out = new Map();
    (ds().workers || []).forEach(w => {
      const status = S(w.status || 'active').toLowerCase();
      if(status === 'deleted' || status === 'inactive') return;
      if(S(workerPid(w)) !== S(projectId)) return;
      const name = S(w.name || w.full_name);
      const key = normName(name);
      if(key && !out.has(key)) out.set(key, name);
    });
    return [...out.values()].sort((a,b)=>a.localeCompare(b,'ar')).join('، ') || '-';
  }

  function buildMonthlyRowsV10191(){
    const month = byId('monthlyMonth')?.value || todayMonth();
    const selectedSupervisor = byId('monthlySupervisor')?.value || '';
    let logs = (ds().logs || []).filter(l => {
      const d = logDay(l);
      if(!d || d.slice(0,7) !== month) return false;
      const currentSid = currentProjectSupervisor(l.project_id, l.supervisor_id);
      return !selectedSupervisor || S(currentSid) === S(selectedSupervisor);
    });
    const map = new Map();
    logs.forEach(l => {
      const pid = l.project_id || '';
      const sid = currentProjectSupervisor(pid, l.supervisor_id);
      const key = S(sid) + '|' + S(pid);
      if(!map.has(key)) map.set(key, {s:sid, p:pid, a:0, r:0, t:0, c:0});
      const row = map.get(key);
      row.a += actualMinutes(l);
      row.r += requiredMinutes(l);
      row.t += N(l.travel_minutes);
      row.c++;
    });
    const vals = [...map.values()];
    const supTotals = {};
    vals.forEach(r => { const sid = S(r.s); supTotals[sid] = (supTotals[sid] || 0) + N(r.a); });
    return vals.map(r => {
      const supTotal = supTotals[S(r.s)] || 0;
      const workPercent = supTotal ? (N(r.a) / supTotal * 100) : 0;
      const commitmentPercent = r.r ? (N(r.a) / N(r.r) * 100) : 0;
      const diff = N(r.a) - N(r.r);
      const st = statusFromDiff(diff, r.r);
      return {...r, supTotal, workers: currentWorkersForProject(r.p), workPercent, commitmentPercent, diff, st:st.text, cls:st.cls, ccls:commitmentClass(commitmentPercent, r.r)};
    }).sort((a,b)=> sName(a.s).localeCompare(sName(b.s),'ar') || pName(a.p).localeCompare(pName(b.p),'ar'));
  }

  window.monthlyRowsV60 = buildMonthlyRowsV10191;
  window.monthlyBaseRowsV59 = buildMonthlyRowsV10191;
  window.monthlyReportRowsV58 = buildMonthlyRowsV10191;

  window.renderMonthly = function(){
    const body = byId('monthlyBody');
    if(!body) return;
    const table = body.closest('table');
    if(table?.tHead) table.tHead.innerHTML = '<tr><th>المشرف الحالي</th><th>المشروع</th><th>أسماء العمال الحالية</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الأداء</th></tr>';
    const rows = buildMonthlyRowsV10191();
    body.innerHTML = rows.map(r => `<tr><td>${escHtml(sName(r.s))}</td><td>${escHtml(pName(r.p))}</td><td>${escHtml(r.workers)}</td><td>${minsText(r.r)}</td><td>${minsText(r.a)}</td><td>${Math.round(N(r.t)).toLocaleString('en-US')} دقيقة</td><td><span class="badge green">${pctText(r.workPercent)}</span></td><td><span class="badge ${r.ccls}">${pctText(r.commitmentPercent)}</span></td><td><span class="badge ${r.cls}">${escHtml(r.st)}</span></td></tr>`).join('') || '<tr><td colspan="9">لا توجد بيانات في هذا الشهر</td></tr>';
    const total = rows.reduce((a,r)=>a+N(r.a),0), required = rows.reduce((a,r)=>a+N(r.r),0), travel = rows.reduce((a,r)=>a+N(r.t),0);
    const commitment = required ? total / required * 100 : 0;
    const st = statusFromDiff(total-required, required);
    const summary = byId('monthlySummary');
    if(summary) summary.innerHTML = `<div class="kpi"><small>عدد المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${minsText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsText(total)}</b></div><div class="kpi"><small>فرق الوقت</small><b>${diffText(total-required)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${Math.round(travel).toLocaleString('en-US')} دقيقة</b></div><div class="kpi"><small>نسبة الالتزام</small><b>${pctText(commitment)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${st.cls}">${st.text}</span></b></div>`;
  };

  const oldPrint = window.printMonthlyReportV57 || window.printMonthlyReportV219;
  window.printMonthlyReportV57 = window.printMonthlyReportV10191 = function(){
    const rows = buildMonthlyRowsV10191();
    if(!rows.length){ if(typeof msg === 'function') msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err'); return; }
    const month = byId('monthlyMonth')?.value || todayMonth();
    const selected = byId('monthlySupervisor')?.value ? sName(byId('monthlySupervisor').value) : 'الكل';
    const total = rows.reduce((a,r)=>a+N(r.a),0), required = rows.reduce((a,r)=>a+N(r.r),0);
    const bySup = new Map(); rows.forEach(r=>{ const k=S(r.s); if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r); });
    const cards = [...bySup.entries()].map(([sid,items])=>{
      const supTotal = items.reduce((a,r)=>a+N(r.a),0);
      const trs = items.map(r=>`<tr><td>${escHtml(pName(r.p))}</td><td>${escHtml(r.workers)}</td><td>${minsText(r.a)}</td><td>${pctText(r.workPercent)}</td></tr>`).join('');
      return `<div class="card"><h2>${escHtml(sName(sid))}</h2><table><thead><tr><th>المشروع</th><th>أسماء العمال الحالية</th><th>الوقت</th><th>النسبة</th></tr></thead><tbody>${trs}<tr class="total"><td colspan="2">الإجمالي</td><td>${minsText(supTotal)}</td><td>100%</td></tr></tbody></table></div>`;
    }).join('');
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#123d32;font-size:11px}.page{padding:14px;border:2px solid #0a5a49;min-height:100vh}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0a5a49;padding-bottom:10px;margin-bottom:10px}.logo{border:2px solid #c7a24d;border-radius:14px;padding:14px;font-weight:900;color:#0a5a49}.title{text-align:left}.title h1{margin:0;color:#0a5a49}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{border:1px solid #d9e6e1;border-radius:12px;text-align:center;padding:9px;background:#f8fbfa}.box b{display:block;color:#0a5a49;font-size:16px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.card{border:2px solid #0a5a49;border-radius:12px;overflow:hidden;break-inside:avoid}.card h2{margin:0;background:#0a5a49;color:#fff;padding:8px;text-align:center}table{width:100%;border-collapse:collapse}th{background:#f0f6f4;color:#0a5a49}th,td{border:1px solid #dfe8e4;padding:6px;text-align:center}.total{font-weight:900;background:#f8fbfa}.note{text-align:center;color:#667;margin-top:10px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.card{break-inside:avoid}}</style></head><body><div class="page"><div class="top"><div><div class="logo">تصنيف</div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><div>الشهر: ${escHtml(month)} | المشرف: ${escHtml(selected)}</div><div>يعرض المشرف الحالي للمشروع وأسماء العمال الحالية تلقائيًا</div></div></div><div class="meta"><div class="box"><small>عدد المشاريع</small><b>${rows.length}</b></div><div class="box"><small>إجمالي الفعلي</small><b>${minsText(total)}</b></div><div class="box"><small>إجمالي المطلوب</small><b>${minsText(required)}</b></div><div class="box"><small>نسبة الالتزام</small><b>${pctText(required?total/required*100:0)}</b></div></div><div class="grid">${cards}</div><div class="note">تم احتساب المشرفين والعمال من البيانات الحالية للمشاريع والعمال وليس من الاسم القديم داخل السجل.</div><script>window.onload=function(){setTimeout(function(){window.print()},450)}<\/script></div></body></html>`;
    const w = window.open('','_blank');
    if(!w){ if(typeof msg==='function') msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const refreshMonthlyNow = () => { try{ if(byId('monthlyBody')) window.renderMonthly(); }catch(e){ console.warn('monthly auto refresh failed', e); } };
  const wrapAsync = (name) => {
    const old = window[name];
    if(typeof old !== 'function' || old.__v10191Wrapped) return;
    const wrapped = async function(){
      const res = await old.apply(this, arguments);
      try{ if(typeof refreshAll === 'function') await refreshAll(); }catch(_){}
      setTimeout(refreshMonthlyNow, 80);
      return res;
    };
    wrapped.__v10191Wrapped = true;
    window[name] = wrapped;
  };
  ['saveProjectManagerSupervisor','saveWorker','deleteRow','toggleWorkerStatus','removeWorkerFromProject','saveLog','closeLog','adminSaveLogEdit'].forEach(wrapAsync);
  ['monthlyMonth','monthlySupervisor','workerSupervisor','workerProject','projectManageSupervisor','manageProjectId'].forEach(id=>{
    const el=byId(id); if(el && !el.__monthlyV10191){ el.__monthlyV10191=true; el.addEventListener('change',()=>setTimeout(refreshMonthlyNow,50)); }
  });
  ['DOMContentLoaded','load'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(refreshMonthlyNow, ev==='load'?1500:500)));
  setTimeout(refreshMonthlyNow, 1800);
  console.log('Tasneef V10191 monthly current supervisors/workers auto update loaded');
})();
