/* Tasneef v10145 - Monthly Official + Local Recovery
   قسم الأوقات الشهرية فقط: محرك واحد، لا يحقن واجهة متكررة، يفصل Supabase عن البيانات المحلية حتى لا تختلط الأرقام.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyFoundationV10145) return;
  window.__tasneefMonthlyFoundationV10145=true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_foundation_v10145';
  const MAX_ROWS=50000;
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)));return Number.isFinite(n)?n:0};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)};
  const title=ym=>(S(ym).slice(5,7)||'--')+'-'+(S(ym).slice(0,4)||'----');
  const fmt=(n,d=2)=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const state={month:'',users:[],projects:[],workers:[],official:[],local:[],manual:[],rows:[],filtered:[],loading:false};

  function client(){
    if(window.sb && typeof window.sb.from==='function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);return window.sb;}catch(_){ }
    }
    return null;
  }
  async function allRows(table, cols='*', max=MAX_ROWS){
    const sb=client(); const out=[]; const step=1000; if(!sb) return out;
    for(let from=0;from<max;from+=step){
      try{
        const {data,error}=await sb.from(table).select(cols).range(from,Math.min(from+step-1,max-1));
        if(error){console.warn('[monthly]',table,error.message||error);break;}
        out.push(...A(data)); if(!data || data.length<step) break;
      }catch(e){console.warn('[monthly]',table,e.message||e);break;}
    }
    return out;
  }
  function anyVal(r,keys){for(const k of keys){if(r && r[k]!==undefined && r[k]!==null && S(r[k])!=='') return r[k];}return ''}
  function parseDates(v){
    const raw=S(v); if(!raw) return []; const out=[];
    const add=(y,m,d)=>{y=N(y);m=N(m);d=N(d); if(y>1900&&m>=1&&m<=12&&d>=1&&d<=31) out.push(`${y}-${pad(m)}-${pad(d)}`)};
    let m=raw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/); if(m) add(m[1],m[2],m[3]);
    m=raw.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/); if(m){const a=N(m[1]),b=N(m[2]); if(a>12)add(m[3],b,a); else if(b>12)add(m[3],a,b); else{add(m[3],a,b);add(m[3],b,a)}}
    m=raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})T/); if(m)add(m[1],m[2],m[3]);
    const d=new Date(raw); if(!isNaN(d)) add(d.getFullYear(),d.getMonth()+1,d.getDate());
    return [...new Set(out)];
  }
  function datesOf(r){
    const keys=['log_date','date','day','work_date','created_at','updated_at','start_at','end_at','check_in_at','check_out_at','createdAt','updatedAt','التاريخ','تاريخ','تاريخ التسجيل'];
    let out=[]; keys.forEach(k=>{if(r&&r[k]!=null) out.push(...parseDates(r[k]));}); return [...new Set(out)];
  }
  function inMonth(r,ym){return datesOf(r).some(d=>d.startsWith(ym));}
  function userLabel(u){return S(u?.full_name||u?.name||u?.display_name||u?.employee_name||u?.username||u?.email||u?.id)}
  function projectLabel(p){return S(p?.name||p?.project_name||p?.title||p?.project_title||p?.building_name||p?.display_name||p?.code||p?.id)}
  function workerLabel(w){return S(w?.full_name||w?.name||w?.worker_name||w?.employee_name||w?.username||w?.id)}
  function flex(rows,id,labelFn){const x=S(id); if(!x)return null; const xl=x.toLowerCase(); return A(rows).find(v=>S(v.id)===x||S(v.uuid)===x||S(v.code)===x||S(v.value)===x||S(labelFn(v)).toLowerCase()===xl||S(v.username).toLowerCase()===xl||S(v.email).toLowerCase()===xl)||null}
  function nameUser(id){const u=flex(state.users,id,userLabel);return u?userLabel(u):''}
  function nameProject(id){const p=flex(state.projects,id,projectLabel);return p?projectLabel(p):''}
  function nameWorker(id){const w=flex(state.workers,id,workerLabel);return w?workerLabel(w):''}
  function workerById(id){return flex(state.workers,id,workerLabel)||{}}
  function projectById(id){return flex(state.projects,id,projectLabel)||{}}
  function minutesFromTime(a,b){const to=t=>{const m=S(t).match(/^(\d{1,2}):(\d{2})/);return m?N(m[1])*60+N(m[2]):null}; const x=to(a), y0=to(b); if(x==null||y0==null)return 0; let y=y0; if(y<x)y+=1440; return Math.max(0,y-x)}
  function looksLikeLog(v){
    if(!v||typeof v!=='object')return false;
    const hasDate=['log_date','date','day','work_date','created_at','start_at','check_in_at','check_out_at','التاريخ','تاريخ'].some(k=>S(v[k]));
    const hasId=['project_id','project','project_name','supervisor_id','user_id','worker_id','المشروع','المشرف'].some(k=>S(v[k]));
    const hasTime=['check_in','check_out','time_in','time_out','log_in','log_out','in_time','out_time','start_time','end_time','logIn','logOut','وقت الدخول','وقت الخروج','actual_minutes','duration_minutes','total_minutes','required_minutes','travel_minutes'].some(k=>S(v[k])!=='');
    return hasDate&&hasId&&hasTime;
  }
  function normalize(row,source){
    const workerId=anyVal(row,['worker_id','workerId','employee_id','employeeId','العامل']); const w=workerById(workerId);
    const projectId=anyVal(row,['project_id','projectId','building_id','project','المشروع']) || anyVal(w,['project_id','assigned_project_id','current_project_id']);
    const p=projectById(projectId);
    const supervisorId=anyVal(row,['supervisor_id','supervisorId','user_id','userId','manager_id','created_by','المشرف']) || anyVal(w,['supervisor_id','app_supervisor_id','manager_id']) || anyVal(p,['supervisor_id','manager_id']);
    const supervisor=anyVal(row,['supervisor_name','supervisor','user_name','created_by_name','مرسل','المشرف']) || nameUser(supervisorId) || S(supervisorId||'غير محدد');
    const project=anyVal(row,['project_name','project_title','project','المشروع']) || nameProject(projectId) || S(projectId||'غير محدد');
    const workers=anyVal(row,['workers','worker_names','workers_names','employee_names','أسماء العمال']) || nameWorker(workerId) || '';
    const req=N(anyVal(row,['required_minutes','required_min','target_minutes','scheduled_minutes','required']));
    const reqH=N(anyVal(row,['required_hours','target_hours','scheduled_hours']));
    const actual=N(anyVal(row,['actual_minutes','duration_minutes','total_minutes','minutes','work_minutes','actual_min']));
    const actualH=N(anyVal(row,['actual_hours','duration_hours','total_hours','work_hours']));
    const travel=N(anyVal(row,['travel_minutes','transition_minutes','lost_minutes','وقت الانتقال']));
    const inT=anyVal(row,['check_in','time_in','log_in','in_time','start_time','logIn','وقت الدخول']);
    const outT=anyVal(row,['check_out','time_out','log_out','out_time','end_time','logOut','وقت الخروج']);
    const actualMin=actual || (actualH?actualH*60:0) || minutesFromTime(inT,outT);
    const requiredMin=req || (reqH?reqH*60:0);
    return {supervisor,project,workers,count:1,requiredMin,actualMin,travelMin:travel,source};
  }
  function collectLocal(ym){
    const out=[]; const seen=new Set();
    function walk(v,source,depth){
      if(depth>6||v==null)return;
      if(Array.isArray(v)){v.forEach(x=>walk(x,source,depth+1));return;}
      if(typeof v==='object'){
        if(looksLikeLog(v)&&inMonth(v,ym)){let sig;try{sig=JSON.stringify(v).slice(0,1000)}catch(_){sig=Math.random()+''} if(!seen.has(sig)){seen.add(sig);out.push({...v,__localSource:source});}}
        for(const k of Object.keys(v)){ if(/orders|inventory|invoice|products|tickets|language|image|photo|base64/i.test(k)) continue; walk(v[k],source,depth+1); }
      }
    }
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i)||'';
        if(!/time|log|daily|attendance|register|سجل|حضور|tasneef|data/i.test(k)) continue;
        if(/orders|inventory|invoice|products|tickets|language|image|photo|base64/i.test(k)) continue;
        const raw=localStorage.getItem(k)||''; if(!raw||raw.length>12000000) continue;
        try{walk(JSON.parse(raw),'localStorage:'+k,0)}catch(_){ }
      }
    }catch(e){console.warn('[monthly local]',e)}
    return out;
  }
  async function loadLookups(){ const [u,p,w]=await Promise.all([allRows('app_users','*',20000),allRows('projects','*',20000),allRows('workers','*',20000)]); state.users=u; state.projects=p; state.workers=w; }
  async function loadOfficial(ym){
    // المصدر الرسمي فقط؛ لا نخلط المحلي إلا باختيار واضح من المستخدم.
    const tables=['time_logs','daily_registrations','daily_logs','work_logs','supervisor_time_logs'];
    let out=[];
    for(const t of tables){const rows=await allRows(t,'*',MAX_ROWS); out.push(...rows.filter(r=>looksLikeLog(r)&&inMonth(r,ym)).map(r=>({...r,__sourceTable:t})));}
    const seen=new Set();
    return out.filter(r=>{const sig=(S(r.__sourceTable)+'|'+S(r.id||'')+'|'+datesOf(r).join('|')+'|'+S(anyVal(r,['project_id','project','project_name','المشروع']))+'|'+S(anyVal(r,['supervisor_id','user_id','supervisor_name','المشرف']))+'|'+S(anyVal(r,['check_in','time_in','logIn']))+'|'+S(anyVal(r,['check_out','time_out','logOut']))); if(seen.has(sig))return false; seen.add(sig); return true;});
  }
  async function loadManual(ym){
    const local=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]')).filter(r=>S(r.month)===ym)}catch(_){return []}})();
    const sb=client(); if(!sb)return local;
    try{const {data,error}=await sb.from(MANUAL_TABLE).select('*').eq('month_key',ym); if(error)throw error; return [...local,...A(data).map(r=>({id:r.id,month:r.month_key,supervisor:r.supervisor_name,project:r.project_name,workers:r.worker_names,requiredMin:N(r.required_minutes),actualMin:N(r.actual_minutes),travelMin:N(r.travel_minutes),percent:r.percent_override==null?'':N(r.percent_override),source:'تعديل يدوي'}))];}catch(e){console.warn('[monthly manual]',e.message||e); return local;}
  }
  async function upsertManual(r){
    r.id=r.id||('m-'+Date.now()); r.month=r.month||state.month||ymNow();
    const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})();
    const idx=arr.findIndex(x=>S(x.id)===S(r.id)); if(idx>=0)arr[idx]=r; else arr.push(r); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    const sb=client(); if(!sb)return;
    await sb.from(MANUAL_TABLE).upsert({id:r.id,month_key:r.month,supervisor_name:r.supervisor,project_name:r.project,worker_names:r.workers||'',required_minutes:N(r.requiredMin),actual_minutes:N(r.actualMin),travel_minutes:N(r.travelMin),percent_override:r.percent===''?null:N(r.percent),updated_at:new Date().toISOString()},{onConflict:'id'});
  }
  async function removeManual(id){
    const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})().filter(x=>S(x.id)!==S(id)); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    const sb=client(); if(sb)try{await sb.from(MANUAL_TABLE).delete().eq('id',id)}catch(_){ }
  }
  function aggregate(list,manual){
    const map=new Map();
    list.forEach(x=>{const r=normalize(x,x.__sourceTable?('Supabase: '+x.__sourceTable):(x.__localSource||'محلي')); const key=r.supervisor+'|'+r.project+'|'+r.source; if(!map.has(key))map.set(key,{...r,count:0,requiredMin:0,actualMin:0,travelMin:0}); const g=map.get(key); g.count++; g.requiredMin+=N(r.requiredMin); g.actualMin+=N(r.actualMin); g.travelMin+=N(r.travelMin); if(r.workers&&!S(g.workers).includes(r.workers))g.workers=g.workers?g.workers+', '+r.workers:r.workers;});
    A(manual).forEach(r=>map.set('manual:'+r.id,{...r,source:'تعديل يدوي'})); return [...map.values()].sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar')||S(a.project).localeCompare(S(b.project),'ar'));
  }
  function perf(r){const pct=r.percent!==''&&r.percent!=null?Math.round(N(r.percent)):(N(r.requiredMin)?Math.round(N(r.actualMin)/N(r.requiredMin)*100):(N(r.actualMin)?100:0)); if(pct>=95)return{pct,label:'ممتاز',cls:'green'}; if(pct>=80)return{pct,label:'جيد',cls:'amber'}; return{pct,label:'ضعيف',cls:'red'};}
  function status(t,c='amber'){const el=$('mtStatusV10145');if(el){el.textContent=t;el.className='badge '+c}}
  function msg(t,err=false){const el=$('mtMessageV10145');if(el){el.textContent=t||'';el.className='msg '+(err?'err':'');el.classList.toggle('hidden',!t)}}
  function fillFilters(){const cs=S($('mtSupervisorV10145')?.value), cp=S($('mtProjectV10145')?.value); const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); if($('mtSupervisorV10145'))$('mtSupervisorV10145').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}" ${x===cs?'selected':''}>${E(x)}</option>`).join(''); if($('mtProjectV10145'))$('mtProjectV10145').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}" ${x===cp?'selected':''}>${E(x)}</option>`).join(''); if($('mtSupervisorListV10145'))$('mtSupervisorListV10145').innerHTML=[...new Set([...sups,...state.users.map(userLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join(''); if($('mtProjectListV10145'))$('mtProjectListV10145').innerHTML=[...new Set([...prjs,...state.projects.map(projectLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');}
  function filtered(){const s=S($('mtSupervisorV10145')?.value), p=S($('mtProjectV10145')?.value); return state.rows.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function renderSummary(rows){const actual=rows.reduce((s,r)=>s+N(r.actualMin),0),req=rows.reduce((s,r)=>s+N(r.requiredMin),0),travel=rows.reduce((s,r)=>s+N(r.travelMin),0),rec=rows.reduce((s,r)=>s+N(r.count),0); if($('mtSummaryV10145'))$('mtSummaryV10145').innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt(actual/60,2)} ساعة</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(req/60,2)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt(travel/60,2)}</b></div><div class="kpi"><small>المشرفين</small><b>${new Set(rows.map(r=>r.supervisor)).size}</b></div><div class="kpi"><small>المشاريع</small><b>${new Set(rows.map(r=>r.project)).size}</b></div><div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div>`;}
  function renderTable(rows){const b=$('mtBodyV10145');if(!b)return; if(!rows.length){b.innerHTML='<tr><td colspan="11">لا توجد بيانات للشهر المختار.</td></tr>';return;} b.innerHTML=rows.map(r=>{const p=perf(r);return `<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${E(r.source)}</td><td>${r.source==='تعديل يدوي'?`<button class="light" onclick="TasneefMonthlyV10145.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10145.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`}).join('');}
  function render(){state.filtered=filtered(); renderSummary(state.filtered); renderTable(state.filtered); status('تم تحميل '+state.filtered.length+' صف','green')}
  async function load(){if(state.loading)return; state.loading=true; const ym=S($('mtMonthV10145')?.value)||ymNow(); state.month=ym; if($('mtMonthV10145'))$('mtMonthV10145').value=ym; status('جاري التحميل...','amber'); msg(''); try{await loadLookups(); const [official,manual]=await Promise.all([loadOfficial(ym),loadManual(ym)]); const local=collectLocal(ym); state.official=official; state.local=local; state.manual=manual; const mode=S($('mtSourceV10145')?.value)||'official'; const src=mode==='local'?local:(mode==='merged'?[...official,...local]:official); state.rows=aggregate(src,manual); fillFilters(); render(); if($('mtSourcesV10145'))$('mtSourcesV10145').textContent=`المصدر الرسمي Supabase: ${official.length} سجل | المحلي في هذا الجهاز: ${local.length} سجل | التعديلات اليدوية: ${manual.length}. إذا كانت هناك بيانات ناقصة من جهاز آخر يجب فتح ذلك الجهاز وترحيل/تصدير بياناته.`;}catch(e){console.error(e);status('خطأ','red');msg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true)}finally{state.loading=false}}
  function clear(){['mtManualIdV10145','mtManualSupervisorV10145','mtManualProjectV10145','mtManualWorkersV10145','mtManualRequiredV10145','mtManualActualV10145','mtManualTravelV10145','mtManualPercentV10145'].forEach(id=>{if($(id))$(id).value=''})}
  async function save(){const r={id:S($('mtManualIdV10145')?.value),month:S($('mtMonthV10145')?.value)||ymNow(),supervisor:S($('mtManualSupervisorV10145')?.value),project:S($('mtManualProjectV10145')?.value),workers:S($('mtManualWorkersV10145')?.value),count:1,requiredMin:N($('mtManualRequiredV10145')?.value),actualMin:N($('mtManualActualV10145')?.value),travelMin:N($('mtManualTravelV10145')?.value),percent:S($('mtManualPercentV10145')?.value)===''?'':N($('mtManualPercentV10145')?.value),source:'تعديل يدوي'}; if(!r.supervisor||!r.project){alert('اكتب اسم المشرف واسم المشروع');return;} await upsertManual(r); clear(); await load();}
  function edit(id){const r=state.rows.find(x=>S(x.id)===S(id)); if(!r)return; $('mtManualIdV10145').value=r.id; $('mtManualSupervisorV10145').value=r.supervisor; $('mtManualProjectV10145').value=r.project; $('mtManualWorkersV10145').value=r.workers||''; $('mtManualRequiredV10145').value=N(r.requiredMin)||''; $('mtManualActualV10145').value=N(r.actualMin)||''; $('mtManualTravelV10145').value=N(r.travelMin)||''; $('mtManualPercentV10145').value=r.percent===''?'':N(r.percent)}
  async function remove(id){if(!confirm('حذف هذا التعديل اليدوي؟'))return; await removeManual(id); await load()}
  function csv(){const rows=state.filtered||[]; const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال','نسبة العمل','حالة الأداء','المصدر']; const lines=[headers.join(',')].concat(rows.map(r=>{const p=perf(r);return [r.supervisor,r.project,r.workers||'',N(r.count),fmt(N(r.requiredMin)/60,2),fmt(N(r.actualMin)/60,2),fmt(N(r.travelMin)/60,2),p.pct+'%',p.label,r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')})); const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function print(){csv();}
  function bind(){if(!$('mtBodyV10145'))return; if($('mtMonthV10145')&&!$('mtMonthV10145').value)$('mtMonthV10145').value=ymNow(); ['mtMonthV10145','mtSourceV10145'].forEach(id=>$(id)?.addEventListener('change',load)); $('mtSupervisorV10145')?.addEventListener('change',render); $('mtProjectV10145')?.addEventListener('change',render); $('mtRefreshV10145')?.addEventListener('click',load); $('mtCsvV10145')?.addEventListener('click',csv); $('mtPrintV10145')?.addEventListener('click',print); $('mtManualSaveV10145')?.addEventListener('click',save); $('mtManualClearV10145')?.addEventListener('click',clear); load();}
  window.TasneefMonthlyV10145={reload:load,edit,remove,csv,print}; window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=print;
  document.addEventListener('DOMContentLoaded',bind,{once:true}); window.addEventListener('load',()=>setTimeout(bind,300),{once:true});
})();
