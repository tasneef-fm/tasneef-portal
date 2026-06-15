
(function(){
  'use strict';
  if(window.__tasneefMonthlyProfessionalV10140) return;
  window.__tasneefMonthlyProfessionalV10140 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_KEY='tasneef_monthly_manual_rows_professional_v10140';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(String(v??'').replace(/,/g,'')); return Number.isFinite(n)?n:0;};
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)};
  const fmt=(n,d=2)=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const labelYM=ym=>{const a=S(ym).split('-');return (a[1]||'')+'-'+(a[0]||'');};

  let state={month:'',loading:false,token:0,users:[],projects:[],usersById:{},projectsById:{},logs:[],manual:[],rows:[],filtered:[],manualOnline:true,lastRendered:false};

  function client(){
    if(window.sb && typeof window.sb.from==='function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }catch(e){}
    }
    return null;
  }
  function setStatus(t,cls){const e=$('monthlyStatusV10139'); if(e){e.textContent=t; e.className='badge '+(cls||'amber');}}
  function setMsg(t,err){const e=$('monthlyMsg'); if(e){e.textContent=t||''; e.className='msg '+(err?'err':''); e.classList.toggle('hidden',!t);}}
  function byId(a){const o={};(a||[]).forEach(r=>{if(r&&r.id!=null)o[String(r.id)]=r});return o;}

  async function selectSafe(table, cols='*'){
    const sb=client(); if(!sb) return [];
    const out=[]; let from=0, size=1000;
    for(let i=0;i<12;i++){
      try{
        const {data,error}=await sb.from(table).select(cols).range(from,from+size-1);
        if(error) return out;
        if(Array.isArray(data)) out.push(...data);
        if(!data || data.length<size) break;
        from+=size;
      }catch(e){ return out; }
    }
    return out;
  }

  function iso(y,m,d){y=Number(y);m=Number(m);d=Number(d); if(!y||!m||!d||m<1||m>12||d<1||d>31)return''; return y+'-'+pad(m)+'-'+pad(d);}
  function dates(v){
    const s=S(v); if(!s) return [];
    const out=[]; let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) out.push(iso(m[1],m[2],m[3]));
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if(m){const a=+m[1],b=+m[2],y=+m[3]; if(a>12)out.push(iso(y,b,a)); else if(b>12)out.push(iso(y,a,b)); else{out.push(iso(y,b,a));out.push(iso(y,a,b));}}
    const d=new Date(s); if(!isNaN(d)) out.push(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));
    return [...new Set(out.filter(Boolean))];
  }
  function rowDates(r){
    const fs=['log_date','date','day','work_date','attendance_date','created_at','updated_at','start_at','end_at','createdAt','updatedAt','التاريخ','تاريخ','تاريخ التسجيل'];
    let out=[]; fs.forEach(f=>{if(r&&r[f])out.push(...dates(r[f]))}); return [...new Set(out)];
  }
  function inMonth(r,ym){return rowDates(r).some(d=>d.startsWith(ym));}
  function pick(r,keys){for(const k of keys){if(S(r&&r[k]))return S(r[k]);}return'';}
  function mins(t){const m=S(t).match(/^(\d{1,2}):(\d{2})/);return m?(+m[1]*60+ +m[2]):null;}
  function diff(a,b){const x=mins(a),y0=mins(b); if(x==null||y0==null)return 0; let y=y0; if(y<x)y+=1440; return Math.max(0,y-x);}
  function userName(id){const u=state.usersById[String(id||'')]; return u?S(u.full_name||u.username||u.name||id):'';}
  function projectName(id){const p=state.projectsById[String(id||'')]; return p?S(p.name||p.project_name||p.title||id):'';}

  function normalize(r){
    const uid=r.supervisor_id??r.user_id??r.created_by??r.worker_id??r.employee_id??'';
    const pid=r.project_id??r.site_id??r.building_id??'';
    const supervisor=pick(r,['supervisor_name','user_name','username','created_by_name','full_name','employee_name','worker_name','name','المشرف','اسم المشرف'])||userName(uid)||'غير محدد';
    const project=pick(r,['project_name','project','building_name','site_name','projectTitle','المشروع','اسم المشروع'])||projectName(pid)||'غير محدد';
    const inn=pick(r,['check_in','time_in','log_in','in_time','start_time','entry_time','start_at','وقت الدخول','الدخول']);
    const out=pick(r,['check_out','time_out','log_out','out_time','end_time','exit_time','end_at','وقت الخروج','الخروج']);
    let actual=N(r.actual_minutes||r.duration_minutes||r.total_minutes||r.minutes||r.work_minutes||r.actual_min||r.duration_min||r['المدة']||r['الدقائق']);
    if(!actual){const h=N(r.actual_hours||r.duration_hours||r.total_hours||r.hours||r.work_hours||r['الساعات الفعلية']); actual=h?h*60:diff(inn,out);}
    let required=N(r.required_minutes||r.planned_minutes||r.target_minutes||r.expected_minutes||r.must_minutes||r.required_min||r['الدقائق المطلوبة']);
    if(!required){const h=N(r.required_hours||r.planned_hours||r.target_hours||r.expected_hours||r.must_hours||r['الساعات المطلوبة']); required=h?h*60:0;}
    let travel=N(r.travel_minutes||r.transfer_minutes||r.lost_minutes||r.wasted_minutes||r.travel_time||r.log_travel||r['وقت الانتقال']); if(!travel&&N(r.travel_hours))travel=N(r.travel_hours)*60;
    const workers=pick(r,['worker_names','workers','worker_name','employees','team_names','أسماء العمال','العامل']);
    return {supervisor,project,workers,count:1,requiredMin:required,actualMin:actual,travelMin:travel,source:'السجلات'};
  }

  function scanLocalLogs(ym){
    const out=[]; const seen=new Set();
    function walk(v, depth){
      if(depth>4 || v==null) return;
      if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1)); return;}
      if(typeof v==='object'){
        const hasDate=rowDates(v).some(d=>d.startsWith(ym));
        const hasSignal= ['project','project_name','project_id','supervisor_name','supervisor_id','check_in','check_out','log_date','date','المشروع','المشرف'].some(k=>v[k]!=null);
        if(hasDate && hasSignal){ const sig=JSON.stringify(v).slice(0,500); if(!seen.has(sig)){seen.add(sig); out.push(v);} }
        Object.keys(v).slice(0,50).forEach(k=>walk(v[k],depth+1));
      }
    }
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i)||''; if(/orders|invoice|inventory|products|tickets/i.test(k)) continue;
        const raw=localStorage.getItem(k); if(!raw || raw.length>2000000) continue;
        try{walk(JSON.parse(raw),0);}catch(e){}
      }
    }catch(e){}
    return out;
  }

  async function loadLookups(){
    const [u,p]=await Promise.all([selectSafe('app_users','id,username,full_name,role'),selectSafe('projects','id,name,project_name,title')]);
    state.users=u||[]; state.projects=p||[]; state.usersById=byId(state.users); state.projectsById=byId(state.projects);
  }
  async function loadLogs(ym){
    const tables=['time_logs','daily_logs','work_logs','attendance_logs'];
    let all=[];
    for(const t of tables){ const rows=await selectSafe(t,'*'); if(rows.length) all.push(...rows.map(r=>({...r,__table:t}))); }
    all.push(...scanLocalLogs(ym));
    const seen=new Set(); return all.filter(r=>{const sig=(r.id||'')+'|'+JSON.stringify(r).slice(0,300); if(seen.has(sig))return false; seen.add(sig); return inMonth(r,ym);});
  }

  function getLocalManual(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]')||[]}catch(e){return[]}}
  function setLocalManual(v){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(v||[]))}catch(e){}}
  async function loadManual(ym){
    const sb=client(); if(!sb){state.manualOnline=false; return getLocalManual().filter(r=>r.month===ym)}
    try{const {data,error}=await sb.from(MANUAL_TABLE).select('*').eq('month_key',ym).order('created_at',{ascending:true}); if(error)throw error; state.manualOnline=true; return (data||[]).map(r=>({id:r.id,month:r.month_key,supervisor:S(r.supervisor_name),project:S(r.project_name),workers:S(r.workers_names),count:N(r.records_count),requiredMin:N(r.required_minutes),actualMin:N(r.actual_minutes),travelMin:N(r.travel_minutes),percent:r.percent_override==null?'':N(r.percent_override),source:'تعديل يدوي'}));}
    catch(e){state.manualOnline=false; return getLocalManual().filter(r=>r.month===ym)}
  }
  async function saveManual(row){
    const sb=client(); const id=row.id||crypto.randomUUID();
    if(sb){const payload={id,month_key:row.month,supervisor_name:row.supervisor,project_name:row.project,workers_names:row.workers||'',records_count:N(row.count)||1,required_minutes:N(row.requiredMin),actual_minutes:N(row.actualMin),travel_minutes:N(row.travelMin),percent_override:row.percent===''?null:N(row.percent),updated_at:new Date().toISOString()}; const {error}=await sb.from(MANUAL_TABLE).upsert(payload,{onConflict:'id'}); if(error)throw error; return id;}
    const rows=getLocalManual(); const next={...row,id,source:'تعديل يدوي'}; const ix=rows.findIndex(r=>r.id===id); if(ix>=0)rows[ix]=next; else rows.push(next); setLocalManual(rows); return id;
  }
  async function delManual(id){const sb=client(); if(sb){const {error}=await sb.from(MANUAL_TABLE).delete().eq('id',id); if(error)throw error; return;} setLocalManual(getLocalManual().filter(r=>r.id!==id));}

  function aggregate(logs,manual){
    const map=new Map();
    logs.map(normalize).forEach(x=>{const key=x.supervisor+'||'+x.project; if(!map.has(key))map.set(key,{id:key,source:'السجلات',supervisor:x.supervisor,project:x.project,workers:'',count:0,requiredMin:0,actualMin:0,travelMin:0,percent:''}); const g=map.get(key); g.count++; g.requiredMin+=x.requiredMin; g.actualMin+=x.actualMin; g.travelMin+=x.travelMin; if(x.workers&&!g.workers.includes(x.workers))g.workers=g.workers?g.workers+', '+x.workers:x.workers;});
    (manual||[]).forEach(r=>map.set('m'+r.id,{...r,id:r.id,source:'تعديل يدوي'}));
    return [...map.values()].sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar')||S(a.project).localeCompare(S(b.project),'ar'));
  }
  function perf(r){const pct=r.percent!==''&&r.percent!=null?Math.round(N(r.percent)):(N(r.requiredMin)?Math.round(N(r.actualMin)/N(r.requiredMin)*100):0); let label='ضعيف',cls='red'; if(pct>=95){label='ممتاز';cls='green'} else if(pct>=80){label='جيد';cls='amber'} return {pct,label,cls};}
  function apply(rows){const s=S($('monthlySupervisor')?.value),p=S($('monthlyProject')?.value); return rows.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function fillFilters(){
    const ss=$('monthlySupervisor'), ps=$('monthlyProject'); const cs=S(ss?.value), cp=S(ps?.value);
    const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if(ss) ss.innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${esc(x)}" ${x===cs?'selected':''}>${esc(x)}</option>`).join('');
    if(ps) ps.innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${esc(x)}" ${x===cp?'selected':''}>${esc(x)}</option>`).join('');
    const dlS=$('monthlySupervisorList'), dlP=$('monthlyProjectList');
    if(dlS) dlS.innerHTML=[...new Set([...sups,...state.users.map(u=>S(u.full_name||u.username)).filter(Boolean)])].map(n=>`<option value="${esc(n)}"></option>`).join('');
    if(dlP) dlP.innerHTML=[...new Set([...prjs,...state.projects.map(p=>S(p.name||p.project_name||p.title)).filter(Boolean)])].map(n=>`<option value="${esc(n)}"></option>`).join('');
  }
  function renderSummary(rows){
    const actual=rows.reduce((s,r)=>s+N(r.actualMin),0), req=rows.reduce((s,r)=>s+N(r.requiredMin),0), travel=rows.reduce((s,r)=>s+N(r.travelMin),0), rec=rows.reduce((s,r)=>s+N(r.count),0);
    const holder=$('monthlySummary'); if(!holder)return; holder.innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt(actual/60,2)} ساعة</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(req/60,2)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt(travel/60,2)}</b></div><div class="kpi"><small>المشرفين</small><b>${new Set(rows.map(r=>r.supervisor)).size}</b></div><div class="kpi"><small>المشاريع</small><b>${new Set(rows.map(r=>r.project)).size}</b></div><div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div>`;
  }
  function renderTable(rows){const b=$('monthlyBody'); if(!b)return; if(!rows.length){b.innerHTML='<tr><td colspan="11">لا توجد بيانات لهذا الشهر. اختر شهرًا آخر أو أضف تعديلًا يدويًا.</td></tr>';return;} b.innerHTML=rows.map(r=>{const p=perf(r);return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${esc(r.source)}</td><td>${r.source==='تعديل يدوي'?`<button class="light" onclick="TasneefMonthly.edit('${esc(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthly.remove('${esc(r.id)}')">حذف</button>`:'-'}</td></tr>`}).join('')}
  function rerender(){state.filtered=apply(state.rows); renderSummary(state.filtered); renderTable(state.filtered); setStatus('تم تحميل '+state.filtered.length+' صف','green');}
  async function load(){
    const token=++state.token; if(state.loading)return; state.loading=true; setStatus('جاري التحميل...','amber'); setMsg('جاري تحميل بيانات الأوقات الشهرية...');
    try{const ym=S($('monthlyMonth')?.value)||ymNow(); state.month=ym; if($('monthlyMonth'))$('monthlyMonth').value=ym; await loadLookups(); const [logs,manual]=await Promise.all([loadLogs(ym),loadManual(ym)]); if(token!==state.token)return; state.logs=logs; state.manual=manual; state.rows=aggregate(logs,manual); fillFilters(); rerender(); setMsg(`تم تحميل ${logs.length} سجل و ${manual.length} تعديل يدوي لشهر ${labelYM(ym)}.`,false);}catch(e){console.error(e); setMsg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true); setStatus('خطأ','red');}finally{state.loading=false;}
  }
  function clearForm(){['monthlyManualId','monthlyManualSupervisor','monthlyManualProject','monthlyManualWorkers','monthlyManualRequired','monthlyManualActual','monthlyManualTravel','monthlyManualPercent'].forEach(id=>{if($(id))$(id).value=''})}
  async function saveForm(){try{const row={id:S($('monthlyManualId')?.value),month:S($('monthlyMonth')?.value)||ymNow(),supervisor:S($('monthlyManualSupervisor')?.value),project:S($('monthlyManualProject')?.value),workers:S($('monthlyManualWorkers')?.value),count:1,requiredMin:N($('monthlyManualRequired')?.value),actualMin:N($('monthlyManualActual')?.value),travelMin:N($('monthlyManualTravel')?.value),percent:S($('monthlyManualPercent')?.value)===''?'':N($('monthlyManualPercent')?.value),source:'تعديل يدوي'}; if(!row.supervisor||!row.project){alert('اكتب اسم المشرف واسم المشروع');return;} await saveManual(row); clearForm(); await load(); setMsg('تم حفظ التعديل وظهر في الجدول والطباعة.',false);}catch(e){alert('تعذر حفظ التعديل: '+(e.message||e));}}
  async function remove(id){if(!confirm('حذف هذا التعديل؟'))return; try{await delManual(id); await load();}catch(e){alert('تعذر الحذف: '+(e.message||e));}}
  function edit(id){const r=state.rows.find(x=>String(x.id)===String(id)); if(!r)return; $('monthlyManualId').value=r.id; $('monthlyManualSupervisor').value=r.supervisor; $('monthlyManualProject').value=r.project; $('monthlyManualWorkers').value=r.workers||''; $('monthlyManualRequired').value=N(r.requiredMin)||''; $('monthlyManualActual').value=N(r.actualMin)||''; $('monthlyManualTravel').value=N(r.travelMin)||''; $('monthlyManualPercent').value=r.percent===''?'':N(r.percent);}
  function csv(){const rows=state.filtered||[]; const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال','نسبة العمل','حالة الأداء','المصدر']; const lines=[headers.join(',')].concat(rows.map(r=>{const p=perf(r); return [r.supervisor,r.project,r.workers||'',N(r.count),fmt(N(r.requiredMin)/60,2),fmt(N(r.actualMin)/60,2),fmt(N(r.travelMin)/60,2),p.pct+'%',p.label,r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')})); const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='monthly-times-'+(state.month||ymNow())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  function print(){const rows=state.filtered||[]; const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#10231d}h1{margin:0 0 8px}.muted{color:#60706a}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.kpi{border:1px solid #dce6e2;border-radius:12px;padding:10px}.kpi b{display:block;font-size:22px;color:#0A4033;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#f3f6f5}</style></head><body><h1>تقرير الأوقات الشهرية</h1><div class="muted">الشهر: ${esc(labelYM(state.month||ymNow()))}</div>${$('monthlySummary')?.outerHTML||''}<table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>النسبة</th><th>الحالة</th><th>المصدر</th></tr></thead><tbody>${rows.map(r=>{const p=perf(r);return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td>${p.label}</td><td>${esc(r.source)}</td></tr>`}).join('')||'<tr><td colspan="10">لا توجد بيانات</td></tr>'}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`; const w=window.open('','_blank'); if(!w){alert('اسمح بفتح نافذة الطباعة');return;} w.document.open();w.document.write(html);w.document.close();}
  function init(){
    // لا نعيد بناء الواجهة ولا نراقب الصفحة: تشغيل مهني ثابت فقط
    if(!$('monthly')) return;
    document.querySelectorAll('section#monthly').forEach((s,i)=>{ if(i>0) s.remove(); });
    if($('monthlyMonth')&&!$('monthlyMonth').value)$('monthlyMonth').value=ymNow();
    $('monthlyMonth')?.addEventListener('change',load);
    $('monthlySupervisor')?.addEventListener('change',rerender);
    $('monthlyProject')?.addEventListener('change',rerender);
    $('monthlyRefreshBtn')?.addEventListener('click',load);
    $('monthlyPrintBtn')?.addEventListener('click',print);
    $('monthlyCsvBtn')?.addEventListener('click',csv);
    $('monthlyManualSaveBtn')?.addEventListener('click',saveForm);
    $('monthlyManualClearBtn')?.addEventListener('click',clearForm);
    load();
  }
  window.TasneefMonthly={reload:load,edit,remove};
  window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=print;
  document.addEventListener('DOMContentLoaded',init,{once:true}); window.addEventListener('load',()=>setTimeout(init,300),{once:true});
})();
