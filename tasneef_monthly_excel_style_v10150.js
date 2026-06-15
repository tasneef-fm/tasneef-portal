/* Tasneef v10150 - Monthly Excel Style Exact REST Fix
   قسم الأوقات الشهرية فقط.
   تأسيس ثابت بدون حقن متكرر، يقرأ time_logs مباشرة عبر REST مع count exact.
   معادلة Excel: نسبة المشروع = دقائق المشروع / إجمالي دقائق نفس المشرف.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyExcelStyleV10150) return;
  window.__tasneefMonthlyExcelStyleV10150 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_excel_v10150';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n)?n:0;};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const nextMonth=ym=>{const [y,m]=S(ym).split('-').map(Number); const d=new Date(y,(m||1),1); return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const fmt0=n=>(Math.round(Number(n)||0)).toLocaleString('en-US');
  const fmt2=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  const state={month:'',users:[],projects:[],workers:[],logs:[],manual:[],groups:[],filtered:[],exactCount:0,loading:false};

  function headers(extra={}){
    return Object.assign({
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer '+SUPABASE_ANON_KEY,
      Accept: 'application/json'
    }, extra||{});
  }
  function restUrl(table, params){
    const qs=new URLSearchParams(params||{});
    return `${SUPABASE_URL}/rest/v1/${table}?${qs.toString()}`;
  }
  async function restPaged(table, params={}, max=200000){
    const out=[]; const step=1000;
    for(let start=0; start<max; start+=step){
      const end=Math.min(start+step-1,max-1);
      const res=await fetch(restUrl(table, params),{headers:headers({Range:`${start}-${end}`})});
      if(!res.ok){
        const txt=await res.text().catch(()=>res.statusText);
        throw new Error(`${table}: ${res.status} ${txt}`);
      }
      const data=await res.json();
      out.push(...A(data));
      if(!data || data.length<step) break;
    }
    return out;
  }
  async function restCount(table, params={}){
    const res=await fetch(restUrl(table, Object.assign({select:'id'},params)),{headers:headers({Prefer:'count=exact',Range:'0-0'})});
    if(!res.ok) return 0;
    const range=res.headers.get('content-range')||'';
    const m=range.match(/\/(\d+)$/);
    return m?Number(m[1])||0:0;
  }
  function client(){
    if(window.sb && typeof window.sb.from==='function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }catch(_){ }
    }
    return null;
  }
  function anyVal(r,keys){ for(const k of keys){ if(r && r[k]!==undefined && r[k]!==null && S(r[k])!=='') return r[k]; } return ''; }
  function userLabel(u){return S(u?.full_name||u?.name||u?.display_name||u?.employee_name||u?.username||u?.email||u?.id);}
  function projectLabel(p){return S(p?.name||p?.project_name||p?.title||p?.project_title||p?.building_name||p?.display_name||p?.code||p?.id);}
  function workerLabel(w){return S(w?.full_name||w?.name||w?.worker_name||w?.employee_name||w?.username||w?.id);}
  function flex(rows,id,labelFn){
    const x=S(id); if(!x) return null; const xl=x.toLowerCase();
    return A(rows).find(v=>S(v.id)===x||S(v.uuid)===x||S(v.code)===x||S(v.value)===x||S(labelFn(v)).toLowerCase()===xl||S(v.username).toLowerCase()===xl||S(v.email).toLowerCase()===xl)||null;
  }
  function nameUser(id){const u=flex(state.users,id,userLabel); return u?userLabel(u):'';}
  function nameProject(id){const p=flex(state.projects,id,projectLabel); return p?projectLabel(p):'';}
  function nameWorker(id){const w=flex(state.workers,id,workerLabel); return w?workerLabel(w):'';}
  function rowMonth(v){
    const raw=S(v); if(!raw) return '';
    let m=raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m) return m[1]+'-'+pad(m[2]);
    m=raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\.\/](\d{4})/); if(m){ const a=N(m[1]), b=N(m[2]); return m[3]+'-'+pad(a>12?b:a); }
    const d=new Date(raw); if(!isNaN(d)) return d.getFullYear()+'-'+pad(d.getMonth()+1);
    return '';
  }
  function minutesFromTimes(a,b){
    const to=t=>{const m=S(t).match(/^(\d{1,2}):(\d{2})/); return m?N(m[1])*60+N(m[2]):null;};
    const x=to(a), y0=to(b); if(x==null||y0==null) return 0; let y=y0; if(y<x) y+=1440; return Math.max(0,y-x);
  }
  function minutesFromRow(r){
    const m=N(anyVal(r,['actual_minutes','duration_minutes','total_minutes','minutes','work_minutes','actual_min','duration_min','actual']));
    if(m) return m;
    const h=N(anyVal(r,['actual_hours','duration_hours','total_hours','work_hours']));
    if(h) return h*60;
    const inT=anyVal(r,['check_in','time_in','log_in','in_time','start_time','logIn','وقت الدخول']);
    const outT=anyVal(r,['check_out','time_out','log_out','out_time','end_time','logOut','وقت الخروج']);
    return minutesFromTimes(inT,outT);
  }
  function travelFromRow(r){return N(anyVal(r,['travel_minutes','transition_minutes','lost_minutes','transfer_minutes','وقت الانتقال']));}
  function idVal(r,keys){return S(anyVal(r,keys));}
  function workerProjectId(w){return idVal(w,['project_id','assigned_project_id','current_project_id','building_id']);}
  function workerSupervisorId(w){return idVal(w,['supervisor_id','app_supervisor_id','assigned_supervisor_id','manager_id']);}
  function projectSupervisorId(p){return idVal(p,['supervisor_id','manager_id','user_id','owner_id']);}

  async function loadLookups(){
    const [users,projects,workers]=await Promise.all([
      restPaged('app_users',{select:'*'},50000).catch(()=>[]),
      restPaged('projects',{select:'*'},50000).catch(()=>[]),
      restPaged('workers',{select:'*'},50000).catch(()=>[])
    ]);
    state.users=users; state.projects=projects; state.workers=workers;
  }
  async function loadLogs(ym){
    const start=ym+'-01', end=nextMonth(ym)+'-01';
    const params={select:'*',log_date:`gte.${start}`,log_date2:`lt.${end}`};
    // URLSearchParams لا يسمح بتكرار نفس المفتاح في object، لذلك نبنيها يدويًا هنا.
    const baseParams=new URLSearchParams({select:'*'});
    baseParams.append('log_date',`gte.${start}`);
    baseParams.append('log_date',`lt.${end}`);
    const query=Object.fromEntries(baseParams.entries());
    let exact=await restCount('time_logs', Object.fromEntries(new URLSearchParams({select:'id'}))).catch(()=>0);
    // count الشهر بالصيغة اليدوية بسبب تكرار log_date.
    try{
      const res=await fetch(`${SUPABASE_URL}/rest/v1/time_logs?select=id&log_date=gte.${start}&log_date=lt.${end}`,{headers:headers({Prefer:'count=exact',Range:'0-0'})});
      const cr=res.headers.get('content-range')||''; const m=cr.match(/\/(\d+)$/); state.exactCount=m?Number(m[1])||0:0;
    }catch(_){ state.exactCount=0; }
    let rows=[]; const step=1000;
    for(let from=0; from<200000; from+=step){
      const to=from+step-1;
      const res=await fetch(`${SUPABASE_URL}/rest/v1/time_logs?select=*&log_date=gte.${start}&log_date=lt.${end}&order=log_date.asc`,{headers:headers({Range:`${from}-${to}`})});
      if(!res.ok){ const txt=await res.text().catch(()=>res.statusText); throw new Error('time_logs: '+res.status+' '+txt); }
      const data=await res.json(); rows.push(...A(data)); if(!data||data.length<step) break;
    }
    if(!rows.length){
      const all=await restPaged('time_logs',{select:'*'},200000).catch(()=>[]);
      rows=all.filter(r=>rowMonth(anyVal(r,['log_date','date','day','work_date','created_at','start_at','check_in_at']))===ym);
      if(!state.exactCount) state.exactCount=rows.length;
    }
    return rows;
  }
  function workerNamesFor(supervisorId, projectId, existingNames){
    const set=new Set();
    S(existingNames).split(/[,،]/).map(x=>S(x)).filter(Boolean).forEach(x=>set.add(x));
    A(state.workers).forEach(w=>{
      const pn=projectId && workerProjectId(w) && S(workerProjectId(w))===S(projectId);
      const sn=supervisorId && workerSupervisorId(w) && S(workerSupervisorId(w))===S(supervisorId);
      if((pn || (!projectId && sn) || (pn&&sn)) && workerLabel(w)) set.add(workerLabel(w));
    });
    return [...set].slice(0,30);
  }
  function normalize(r){
    const workerId=idVal(r,['worker_id','workerId','employee_id','employeeId','worker','العامل']);
    const worker=flex(state.workers,workerId,workerLabel)||{};
    const projectId=idVal(r,['project_id','projectId','building_id','site_id']) || workerProjectId(worker);
    const project=flex(state.projects,projectId,projectLabel)||{};
    const supervisorId=idVal(r,['supervisor_id','supervisorId','user_id','userId','manager_id','created_by','created_by_id']) || workerSupervisorId(worker) || projectSupervisorId(project);
    const supervisorName=S(anyVal(r,['supervisor_name','supervisor','user_name','created_by_name','manager_name','المشرف'])) || nameUser(supervisorId) || 'غير محدد';
    const projectName=S(anyVal(r,['project_name','project_title','project','site_name','المشروع'])) || nameProject(projectId) || 'غير محدد';
    const wNames=S(anyVal(r,['worker_names','workers','workers_names','employee_names','worker_name','أسماء العمال'])) || nameWorker(workerId);
    return {supervisorId,projectId,supervisorName,projectName,workerNames:wNames,minutes:minutesFromRow(r),travel:travelFromRow(r),count:1,source:'سجلات النظام'};
  }
  function aggregate(logs, manual){
    const map=new Map();
    A(logs).forEach(row=>{
      const r=normalize(row); const key=(r.supervisorId||r.supervisorName)+'|'+(r.projectId||r.projectName);
      if(!map.has(key)) map.set(key,{supervisorId:r.supervisorId,projectId:r.projectId,supervisor:r.supervisorName,project:r.projectName,minutes:0,travel:0,count:0,workerSet:new Set(),source:'سجلات النظام',manual:false});
      const g=map.get(key); g.minutes+=N(r.minutes); g.travel+=N(r.travel); g.count+=1;
      S(r.workerNames).split(/[,،]/).map(x=>S(x)).filter(Boolean).forEach(x=>g.workerSet.add(x));
    });
    A(manual).forEach(m=>{
      const key='manual|'+m.id;
      map.set(key,{id:m.id,supervisor:m.supervisor,project:m.project,minutes:N(m.minutes),travel:N(m.travel),count:0,workerSet:new Set(S(m.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean)),source:'تعديل يدوي',manual:true});
    });
    return [...map.values()].map(g=>{g.workers=workerNamesFor(g.supervisorId,g.projectId,[...g.workerSet].join('، ')).join('، ');return g;}).sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar')||S(a.project).localeCompare(S(b.project),'ar'));
  }
  async function loadManual(ym){
    const local=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]')).filter(r=>S(r.month)===ym)}catch(_){return []}})();
    try{
      const data=await restPaged(MANUAL_TABLE,{select:'*',month_key:`eq.${ym}`},50000);
      const remote=A(data).map(r=>({id:r.id,month:r.month_key,supervisor:r.supervisor_name,project:r.project_name,workers:r.worker_names,minutes:N(r.actual_minutes||r.required_minutes),travel:N(r.travel_minutes)}));
      return [...new Map([...remote,...local].map(x=>[S(x.id),x])).values()];
    }catch(_){return local;}
  }
  function status(t,cls='amber'){const el=$('mt49Status'); if(el){el.textContent=t; el.className='badge '+cls;}}
  function msg(t,err=false){const el=$('mt49Message'); if(el){el.textContent=t||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden',!t);}}
  function filterRows(){const s=S($('mt49Supervisor')?.value), p=S($('mt49Project')?.value);return state.groups.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function fillFilters(){
    const oldS=S($('mt49Supervisor')?.value), oldP=S($('mt49Project')?.value);
    const sups=[...new Set(state.groups.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.groups.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mt49Supervisor')) $('mt49Supervisor').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}" ${x===oldS?'selected':''}>${E(x)}</option>`).join('');
    if($('mt49Project')) $('mt49Project').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}" ${x===oldP?'selected':''}>${E(x)}</option>`).join('');
    if($('mt49SupervisorList')) $('mt49SupervisorList').innerHTML=[...new Set([...sups,...state.users.map(userLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
    if($('mt49ProjectList')) $('mt49ProjectList').innerHTML=[...new Set([...prjs,...state.projects.map(projectLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
  }
  function pctBySupervisor(rows,row){const total=rows.filter(x=>x.supervisor===row.supervisor).reduce((s,x)=>s+N(x.minutes),0);return total?Math.round(N(row.minutes)/total*100):0;}
  function renderSummary(rows){
    const minutes=rows.reduce((s,r)=>s+N(r.minutes),0), travel=rows.reduce((s,r)=>s+N(r.travel),0), count=rows.reduce((s,r)=>s+N(r.count),0);
    const sups=new Set(rows.map(r=>r.supervisor).filter(Boolean)), prjs=new Set(rows.map(r=>r.project).filter(Boolean));
    if($('mt49Summary')) $('mt49Summary').innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt2(minutes/60)} ساعة</b></div><div class="kpi"><small>عدد السجلات</small><b>${fmt0(count)}</b></div><div class="kpi"><small>المشرفين</small><b>${sups.size}</b></div><div class="kpi"><small>المشاريع</small><b>${prjs.size}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt2(travel/60)}</b></div>`;
  }
  function renderVisitCards(rows){
    const box=$('mt49VisitGrid'); if(!box) return;
    if(!rows.length){box.innerHTML='<div class="msg">لا توجد بيانات لهذا الشهر.</div>';return;}
    const bySup=new Map(); rows.forEach(r=>{ if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r); });
    box.innerHTML=[...bySup.entries()].map(([sup,items])=>{
      const total=items.reduce((s,r)=>s+N(r.minutes),0);
      const projectRows=items.map(r=>`<tr><td>${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${total?Math.round(N(r.minutes)/total*100):0}%</td></tr>`).join('');
      const allWorkers=[...new Set(items.flatMap(r=>S(r.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean)))];
      const workersHtml=allWorkers.length?allWorkers.map(w=>`<span>${E(w)}</span>`).join(''):'<small>لا توجد أسماء عمال مرتبطة</small>';
      return `<div class="mt49-supervisor-card"><h3>${E(sup)}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><div class="mt49-workers-title">أسماء العمال</div><div class="mt49-worker-names">${workersHtml}</div></div>`;
    }).join('');
  }
  function renderWorkersGrid(rows){
    const box=$('mt49WorkersGrid'); if(!box) return;
    const projects=new Map(); rows.forEach(r=>{ if(!projects.has(r.project)) projects.set(r.project,new Set()); S(r.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean).forEach(w=>projects.get(r.project).add(w)); });
    if(!projects.size){ box.innerHTML='<div class="msg">لا توجد أسماء عمال مرتبطة بالسجلات.</div>'; return; }
    box.innerHTML=[...projects.entries()].map(([project,set])=>`<div class="mt49-project-workers"><h3>${E(project)}</h3><div>${[...set].map(w=>`<span>${E(w)}</span>`).join('')||'<small>لا توجد أسماء</small>'}</div></div>`).join('');
  }
  function renderTable(rows){
    const body=$('mt49Body'); if(!body) return;
    if(!rows.length){body.innerHTML='<tr><td colspan="10">لا توجد بيانات.</td></tr>';return;}
    body.innerHTML=rows.map(r=>`<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt0(r.minutes)}</td><td>${fmt2(N(r.minutes)/60)}</td><td>${fmt0(r.travel)}</td><td>${pctBySupervisor(rows,r)}%</td><td>${E(r.source)}</td><td>${r.manual?`<button class="light" onclick="TasneefMonthlyV10150.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10150.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`).join('');
  }
  function render(){state.filtered=filterRows();renderSummary(state.filtered);renderVisitCards(state.filtered);renderWorkersGrid(state.filtered);renderTable(state.filtered);status('تم تحميل '+state.logs.length+' سجل','green');}
  async function load(){
    if(state.loading) return; state.loading=true;
    const ym=S($('mt49Month')?.value)||ymNow(); state.month=ym; if($('mt49Month')) $('mt49Month').value=ym;
    status('جاري التحميل...','amber'); msg('');
    try{
      await loadLookups(); const [logs,manual]=await Promise.all([loadLogs(ym),loadManual(ym)]);
      state.logs=logs; state.manual=manual; state.groups=aggregate(logs,manual); fillFilters(); render();
      msg(`تم تحميل ${logs.length} سجل من Supabase لشهر ${ym}. العدد الرسمي من REST: ${state.exactCount || logs.length}. النسبة = دقائق المشروع ÷ إجمالي دقائق المشرف.`);
    }catch(e){console.error(e); status('خطأ','red'); msg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true);} finally{state.loading=false;}
  }
  function clearManual(){['mt49ManualId','mt49ManualSupervisor','mt49ManualProject','mt49ManualWorkers','mt49ManualMinutes','mt49ManualTravel'].forEach(id=>{if($(id))$(id).value='';});}
  async function saveManual(){
    const r={id:S($('mt49ManualId')?.value)||('m-'+Date.now()),month:S($('mt49Month')?.value)||ymNow(),supervisor:S($('mt49ManualSupervisor')?.value),project:S($('mt49ManualProject')?.value),workers:S($('mt49ManualWorkers')?.value),minutes:N($('mt49ManualMinutes')?.value),travel:N($('mt49ManualTravel')?.value)};
    if(!r.supervisor||!r.project){alert('اكتب اسم المشرف واسم المشروع');return;}
    const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})(); const idx=arr.findIndex(x=>S(x.id)===S(r.id)); if(idx>=0)arr[idx]=r; else arr.push(r); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    try{ await fetch(`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}`,{method:'POST',headers:headers({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'}),body:JSON.stringify({id:r.id,month_key:r.month,supervisor_name:r.supervisor,project_name:r.project,worker_names:r.workers,actual_minutes:r.minutes,required_minutes:r.minutes,travel_minutes:r.travel,updated_at:new Date().toISOString()})}); }catch(_){ }
    clearManual(); await load();
  }
  function editManual(id){const r=state.groups.find(x=>S(x.id)===S(id)); if(!r)return; $('mt49ManualId').value=r.id; $('mt49ManualSupervisor').value=r.supervisor; $('mt49ManualProject').value=r.project; $('mt49ManualWorkers').value=r.workers||''; $('mt49ManualMinutes').value=N(r.minutes)||''; $('mt49ManualTravel').value=N(r.travel)||'';}
  async function removeManual(id){ if(!confirm('حذف هذا التعديل اليدوي؟'))return; const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})().filter(x=>S(x.id)!==S(id)); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr)); try{await fetch(`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:headers()});}catch(_){ } await load();}
  function csv(){
    const rows=state.filtered||[], headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الدقائق','الساعات','وقت الانتقال','النسبة','المصدر'];
    const lines=[headers.join(',')].concat(rows.map(r=>[r.supervisor,r.project,r.workers||'',r.count,fmt0(r.minutes),fmt2(N(r.minutes)/60),fmt0(r.travel),pctBySupervisor(rows,r)+'%',r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-excel-style-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function printReport(){ window.print(); }
  function bind(){
    if(!$('mt49Body')) return;
    if($('mt49Month')&&!$('mt49Month').value) $('mt49Month').value=ymNow();
    $('mt49Month')?.addEventListener('change',load); $('mt49Supervisor')?.addEventListener('change',render); $('mt49Project')?.addEventListener('change',render); $('mt49Refresh')?.addEventListener('click',load);
    $('mt49Csv')?.addEventListener('click',csv); $('mt49Print')?.addEventListener('click',printReport); $('mt49ManualSave')?.addEventListener('click',saveManual); $('mt49ManualClear')?.addEventListener('click',clearManual); load();
  }
  window.TasneefMonthlyV10150={reload:load,edit:editManual,remove:removeManual,csv,print:printReport};
  window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=printReport;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else setTimeout(bind,0);
})();
