/* Tasneef v10152 - Monthly Times Cache System
   تأسيس رسمي لقسم الأوقات الشهرية فقط.
   لا يسحب time_logs مباشرة للواجهة؛ يقرأ ملخصًا صغيرًا من monthly_times_cache_v10152.
   تحديث الملخص يتم من SQL أو زر "تحديث ملخص الشهر".
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyCacheV10152) return;
  window.__tasneefMonthlyCacheV10152=true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const CACHE_TABLE='monthly_times_cache_v10152';
  const MANUAL_TABLE='monthly_time_manual_adjustments_v10152';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_v10152';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0;};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const fmt0=n=>(Math.round(Number(n)||0)).toLocaleString('en-US');
  const fmt2=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const state={month:'',rows:[],manual:[],groups:[],filtered:[],loading:false};
  function headers(extra={}){return Object.assign({apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json'},extra||{});}
  function status(text,cls){const el=$('mt52Status'); if(el){el.textContent=text||''; el.className='badge '+(cls||'amber');}}
  function msg(text,err){const el=$('mt52Message'); if(el){el.textContent=text||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden',!text);}}
  function note(text){const el=$('mt52CacheNote'); if(el){el.textContent=text||''; el.classList.toggle('hidden',!text);}}

  async function getCache(month){
    const q = `${SUPABASE_URL}/rest/v1/${CACHE_TABLE}?select=*&month_key=eq.${encodeURIComponent(month)}&order=supervisor_name.asc,project_name.asc`;
    const res=await fetch(q,{headers:headers()});
    if(!res.ok){const txt=await res.text().catch(()=>res.statusText); throw new Error(`${CACHE_TABLE}: ${res.status} ${txt}`);}
    return A(await res.json());
  }
  async function rebuildMonth(month){
    const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/refresh_monthly_times_cache_v10152`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({p_month:month})});
    if(!res.ok){const txt=await res.text().catch(()=>res.statusText); throw new Error(`refresh_monthly_times_cache_v10152: ${res.status} ${txt}`);}
    return await res.json().catch(()=>null);
  }
  function localManual(){try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}}
  async function loadManual(month){
    const local=localManual().filter(r=>S(r.month)===month);
    try{
      const url=`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}?select=*&month_key=eq.${encodeURIComponent(month)}&order=updated_at.desc`;
      const res=await fetch(url,{headers:headers()});
      if(!res.ok) return local;
      const data=await res.json();
      const remote=A(data).map(r=>({id:r.id,month:r.month_key,supervisor:r.supervisor_name,project:r.project_name,workers:r.worker_names,minutes:N(r.actual_minutes||r.required_minutes),required:N(r.required_minutes||r.actual_minutes),travel:N(r.travel_minutes),count:N(r.record_count)||0,manual:true,source:'تعديل يدوي',updated_at:r.updated_at}));
      return [...new Map([...remote,...local].map(x=>[S(x.id),x])).values()];
    }catch(_){return local;}
  }
  function normalizeCache(r){return {id:S(r.id)||S(r.month_key)+'-'+S(r.supervisor_name)+'-'+S(r.project_name),supervisor:S(r.supervisor_name)||'غير محدد',project:S(r.project_name)||'غير محدد',workers:S(r.worker_names)||'-',count:N(r.record_count),minutes:N(r.actual_minutes),required:N(r.required_minutes),travel:N(r.travel_minutes),source:S(r.source)||'ملخص رسمي',manual:false,updated_at:S(r.updated_at)}}
  function aggregate(rows,manual){
    const out=A(rows).map(normalizeCache);
    A(manual).forEach(m=>out.push({id:S(m.id)||('m-'+Date.now()),supervisor:S(m.supervisor)||'غير محدد',project:S(m.project)||'غير محدد',workers:S(m.workers)||'-',count:N(m.count)||0,minutes:N(m.minutes),required:N(m.required||m.minutes),travel:N(m.travel),source:'تعديل يدوي',manual:true,updated_at:S(m.updated_at)}));
    return out.filter(r=>r.count||r.minutes||r.required||r.travel||r.manual);
  }
  function fillFilters(){
    const oldS=S($('mt52Supervisor')?.value), oldP=S($('mt52Project')?.value);
    const sups=[...new Set(state.groups.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.groups.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mt52Supervisor')) {$('mt52Supervisor').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}">${E(x)}</option>`).join(''); if(oldS&&sups.includes(oldS)) $('mt52Supervisor').value=oldS;}
    if($('mt52Project')) {$('mt52Project').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}">${E(x)}</option>`).join(''); if(oldP&&prjs.includes(oldP)) $('mt52Project').value=oldP;}
    if($('mt52SupervisorList')) $('mt52SupervisorList').innerHTML=sups.map(x=>`<option value="${E(x)}"></option>`).join('');
    if($('mt52ProjectList')) $('mt52ProjectList').innerHTML=prjs.map(x=>`<option value="${E(x)}"></option>`).join('');
  }
  function filterRows(){const s=S($('mt52Supervisor')?.value), p=S($('mt52Project')?.value);return state.groups.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function pctBySupervisor(rows,row){const total=rows.filter(x=>x.supervisor===row.supervisor).reduce((s,x)=>s+N(x.minutes),0);return total?Math.round(N(row.minutes)/total*100):0;}
  function renderSummary(rows){
    const minutes=rows.reduce((s,r)=>s+N(r.minutes),0), travel=rows.reduce((s,r)=>s+N(r.travel),0), count=rows.reduce((s,r)=>s+N(r.count),0);
    const sups=new Set(rows.map(r=>r.supervisor).filter(Boolean)), prjs=new Set(rows.map(r=>r.project).filter(Boolean));
    if($('mt52Summary')) $('mt52Summary').innerHTML=`<div class="mt52-kpi"><small>إجمالي الوقت</small><b>${fmt2(minutes/60)} ساعة</b></div><div class="mt52-kpi"><small>عدد السجلات</small><b>${fmt0(count)}</b></div><div class="mt52-kpi"><small>المشرفين</small><b>${sups.size}</b></div><div class="mt52-kpi"><small>المشاريع</small><b>${prjs.size}</b></div><div class="mt52-kpi"><small>وقت الانتقال</small><b>${fmt2(travel/60)}</b></div>`;
  }
  function splitWorkers(s){return [...new Set(S(s).split(/[,،|]+/).map(x=>S(x)).filter(x=>x&&x!=='-'))];}
  function renderVisitCards(rows){
    const box=$('mt52VisitGrid'); if(!box) return;
    if(!rows.length){box.innerHTML='<div class="msg">لا توجد بيانات لهذا الشهر. شغّل SQL التأسيس أو اضغط تحديث ملخص الشهر.</div>';return;}
    const bySup=new Map(); rows.forEach(r=>{if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r);});
    box.innerHTML=[...bySup.entries()].map(([sup,items])=>{const total=items.reduce((s,r)=>s+N(r.minutes),0);const projectRows=items.map(r=>`<tr><td>${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${total?Math.round(N(r.minutes)/total*100):0}%</td></tr>`).join('');const allWorkers=[...new Set(items.flatMap(r=>splitWorkers(r.workers)))];const workersHtml=allWorkers.length?allWorkers.map(w=>`<span>${E(w)}</span>`).join(''):'<small>لا توجد أسماء عمال مرتبطة</small>';return `<div class="mt52-supervisor-card"><h3>${E(sup)}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><div class="mt52-workers-title">أسماء العمال</div><div class="mt52-worker-names">${workersHtml}</div></div>`;}).join('');
  }
  function renderWorkersGrid(rows){const box=$('mt52WorkersGrid'); if(!box)return;const projects=new Map(); rows.forEach(r=>{if(!projects.has(r.project))projects.set(r.project,new Set());splitWorkers(r.workers).forEach(w=>projects.get(r.project).add(w));}); if(!projects.size){box.innerHTML='<div class="msg">لا توجد أسماء عمال مرتبطة بالسجلات.</div>';return;} box.innerHTML=[...projects.entries()].map(([project,set])=>`<div class="mt52-project-workers"><h3>${E(project)}</h3><div>${[...set].map(w=>`<span>${E(w)}</span>`).join('')||'<small>لا توجد أسماء</small>'}</div></div>`).join('');}
  function renderTable(rows){const body=$('mt52Body'); if(!body)return; if(!rows.length){body.innerHTML='<tr><td colspan="11">لا توجد بيانات.</td></tr>';return;} body.innerHTML=rows.map(r=>`<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${fmt0(r.count)}</td><td>${fmt0(r.minutes)}</td><td>${fmt2(N(r.minutes)/60)}</td><td>${fmt0(r.travel)}</td><td>${pctBySupervisor(rows,r)}%</td><td>${E(r.source)}</td><td>${E(r.updated_at||'-')}</td><td>${r.manual?`<button class="light" onclick="TasneefMonthlyV10152.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10152.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`).join('');}
  function render(){state.filtered=filterRows();renderSummary(state.filtered);renderVisitCards(state.filtered);renderWorkersGrid(state.filtered);renderTable(state.filtered);}
  async function load(){if(state.loading)return;state.loading=true;const ym=S($('mt52Month')?.value)||ymNow();state.month=ym;if($('mt52Month'))$('mt52Month').value=ym;status('جاري التحميل...','amber');msg('');note('');try{const [rows,manual]=await Promise.all([getCache(ym),loadManual(ym)]);state.rows=A(rows);state.manual=manual;state.groups=aggregate(rows,manual);fillFilters();render();const totalRecords=state.groups.reduce((s,r)=>s+N(r.count),0);status('تم تحميل '+fmt0(totalRecords)+' سجل','green');msg(`تم تحميل ${fmt0(totalRecords)} سجل لشهر ${ym}. المصدر: ملخص شهري محفوظ في قاعدة البيانات.`);if(!totalRecords) note('إذا كان لديك سجلات في time_logs لهذا الشهر، اضغط زر تحديث ملخص الشهر أو شغّل ملف monthly_cache_system_v10152.sql.');}catch(e){console.error(e);status('خطأ','red');msg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true);}finally{state.loading=false;}}
  async function rebuild(){const ym=S($('mt52Month')?.value)||ymNow();if(!confirm('تحديث ملخص الأوقات لشهر '+ym+' من سجلات Supabase؟'))return;status('تحديث الملخص...','amber');msg('');try{await rebuildMonth(ym);await load();msg('تم تحديث ملخص الشهر من Supabase.');}catch(e){console.error(e);status('خطأ','red');msg('تعذر تحديث الملخص: '+(e.message||e),true);}}
  function clearManual(){['mt52ManualId','mt52ManualSupervisor','mt52ManualProject','mt52ManualWorkers','mt52ManualMinutes','mt52ManualTravel'].forEach(id=>{if($(id))$(id).value='';});}
  async function saveManual(){const r={id:S($('mt52ManualId')?.value)||('m-'+Date.now()),month:S($('mt52Month')?.value)||ymNow(),supervisor:S($('mt52ManualSupervisor')?.value),project:S($('mt52ManualProject')?.value),workers:S($('mt52ManualWorkers')?.value),minutes:N($('mt52ManualMinutes')?.value),travel:N($('mt52ManualTravel')?.value)}; if(!r.supervisor||!r.project){alert('اكتب اسم المشرف واسم المشروع');return;} const arr=localManual();const idx=arr.findIndex(x=>S(x.id)===S(r.id));if(idx>=0)arr[idx]=r;else arr.push(r);localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));try{await fetch(`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}`,{method:'POST',headers:headers({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'}),body:JSON.stringify({id:r.id,month_key:r.month,supervisor_name:r.supervisor,project_name:r.project,worker_names:r.workers,actual_minutes:r.minutes,required_minutes:r.minutes,travel_minutes:r.travel,updated_at:new Date().toISOString()})});}catch(_){ }clearManual();await load();}
  function editManual(id){const r=state.groups.find(x=>S(x.id)===S(id));if(!r)return;$('mt52ManualId').value=r.id;$('mt52ManualSupervisor').value=r.supervisor;$('mt52ManualProject').value=r.project;$('mt52ManualWorkers').value=r.workers||'';$('mt52ManualMinutes').value=N(r.minutes)||'';$('mt52ManualTravel').value=N(r.travel)||'';}
  async function removeManual(id){if(!confirm('حذف هذا التعديل اليدوي؟'))return;const arr=localManual().filter(x=>S(x.id)!==S(id));localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));try{await fetch(`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:headers()});}catch(_){ }await load();}
  function csv(){const rows=state.filtered||[],heads=['المشرف','المشروع','أسماء العمال','عدد السجلات','الدقائق','الساعات','وقت الانتقال','النسبة','المصدر','آخر تحديث'];const lines=[heads.join(',')].concat(rows.map(r=>[r.supervisor,r.project,r.workers||'',r.count,fmt0(r.minutes),fmt2(N(r.minutes)/60),fmt0(r.travel),pctBySupervisor(rows,r)+'%',r.source,r.updated_at||''].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')));const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='monthly-times-'+(state.month||ymNow())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function printReport(){window.print();}
  function bind(){if(!$('mt52Body'))return;if($('mt52Month')&&!$('mt52Month').value)$('mt52Month').value=ymNow();$('mt52Month')?.addEventListener('change',load);$('mt52Supervisor')?.addEventListener('change',render);$('mt52Project')?.addEventListener('change',render);$('mt52Refresh')?.addEventListener('click',load);$('mt52Rebuild')?.addEventListener('click',rebuild);$('mt52Csv')?.addEventListener('click',csv);$('mt52Print')?.addEventListener('click',printReport);$('mt52ManualSave')?.addEventListener('click',saveManual);$('mt52ManualClear')?.addEventListener('click',clearManual);load();}
  window.TasneefMonthlyV10152={reload:load,rebuild,edit:editManual,remove:removeManual,csv,print:printReport};
  window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=printReport;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,0);
})();
