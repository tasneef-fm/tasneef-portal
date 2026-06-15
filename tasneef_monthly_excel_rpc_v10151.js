/* Tasneef v10151 - Monthly Times Excel RPC Fix
   قسم الأوقات الشهرية فقط.
   يقرأ التقرير من دالة Supabase مجمعة وسريعة بدل تحميل time_logs بالكامل حتى لا يظهر timeout.
   المعادلة: نسبة المشروع = دقائق المشروع ÷ إجمالي دقائق نفس المشرف.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyExcelRpcV10151) return;
  window.__tasneefMonthlyExcelRpcV10151 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_excel_v10151';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n)?n:0;};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const fmt0=n=>(Math.round(Number(n)||0)).toLocaleString('en-US');
  const fmt2=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const state={month:'',rows:[],manual:[],groups:[],filtered:[],loading:false};

  function headers(extra={}){return Object.assign({apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json'},extra||{});}
  function status(text,cls){const el=$('mt49Status'); if(el){el.textContent=text||''; el.className='badge '+(cls||'amber');}}
  function msg(text,err){const el=$('mt49Message'); if(el){el.textContent=text||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden',!text);}}
  async function rpcMonthly(month){
    const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/monthly_times_report_v10151`,{
      method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify({p_month:month})
    });
    if(!res.ok){
      const txt=await res.text().catch(()=>res.statusText);
      throw new Error('RPC monthly_times_report_v10151: '+res.status+' '+txt);
    }
    return A(await res.json());
  }
  function localManual(){try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}}
  async function loadManual(month){
    const local=localManual().filter(r=>S(r.month)===month);
    try{
      const url=`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}?select=*&month_key=eq.${encodeURIComponent(month)}&order=updated_at.desc`;
      const res=await fetch(url,{headers:headers()});
      if(!res.ok) return local;
      const data=await res.json();
      const remote=A(data).map(r=>({id:r.id,month:r.month_key,supervisor:r.supervisor_name,project:r.project_name,workers:r.worker_names,minutes:N(r.actual_minutes||r.required_minutes),travel:N(r.travel_minutes),count:N(r.record_count)||0,manual:true,source:'تعديل يدوي'}));
      return [...new Map([...remote,...local].map(x=>[S(x.id),x])).values()];
    }catch(_){return local;}
  }
  function normalizeRpc(r){
    return {
      id:S(r.id)||('rpc-'+S(r.supervisor)+'-'+S(r.project)),
      supervisor:S(r.supervisor)||'غير محدد',
      project:S(r.project)||'غير محدد',
      workers:S(r.worker_names||r.workers)||'-',
      count:N(r.record_count),
      minutes:N(r.actual_minutes),
      required:N(r.required_minutes),
      travel:N(r.travel_minutes),
      source:S(r.source)||'سجلات النظام',
      manual:false
    };
  }
  function aggregateWithManual(rows,manual){
    const out=A(rows).map(normalizeRpc);
    A(manual).forEach(m=>{
      out.push({id:S(m.id)||('m-'+Date.now()),supervisor:S(m.supervisor)||'غير محدد',project:S(m.project)||'غير محدد',workers:S(m.workers)||'-',count:N(m.count)||0,minutes:N(m.minutes),required:N(m.minutes),travel:N(m.travel),source:'تعديل يدوي',manual:true});
    });
    return out.filter(r=>r.count||r.minutes||r.required||r.travel||r.manual);
  }
  function fillFilters(){
    const oldS=S($('mt49Supervisor')?.value), oldP=S($('mt49Project')?.value);
    const sups=[...new Set(state.groups.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.groups.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mt49Supervisor')) $('mt49Supervisor').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}" ${x===oldS?'selected':''}>${E(x)}</option>`).join('');
    if($('mt49Project')) $('mt49Project').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}" ${x===oldP?'selected':''}>${E(x)}</option>`).join('');
    if($('mt49SupervisorList')) $('mt49SupervisorList').innerHTML=sups.map(x=>`<option value="${E(x)}"></option>`).join('');
    if($('mt49ProjectList')) $('mt49ProjectList').innerHTML=prjs.map(x=>`<option value="${E(x)}"></option>`).join('');
  }
  function filterRows(){const s=S($('mt49Supervisor')?.value), p=S($('mt49Project')?.value); return state.groups.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function pctBySupervisor(rows,row){const total=rows.filter(x=>x.supervisor===row.supervisor).reduce((s,x)=>s+N(x.minutes),0); return total?Math.round(N(row.minutes)/total*100):0;}
  function renderSummary(rows){
    const minutes=rows.reduce((s,r)=>s+N(r.minutes),0), travel=rows.reduce((s,r)=>s+N(r.travel),0), count=rows.reduce((s,r)=>s+N(r.count),0);
    const sups=new Set(rows.map(r=>r.supervisor).filter(Boolean)), prjs=new Set(rows.map(r=>r.project).filter(Boolean));
    if($('mt49Summary')) $('mt49Summary').innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt2(minutes/60)} ساعة</b></div><div class="kpi"><small>عدد السجلات</small><b>${fmt0(count)}</b></div><div class="kpi"><small>المشرفين</small><b>${sups.size}</b></div><div class="kpi"><small>المشاريع</small><b>${prjs.size}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt2(travel/60)}</b></div>`;
  }
  function renderVisitCards(rows){
    const box=$('mt49VisitGrid'); if(!box) return;
    if(!rows.length){box.innerHTML='<div class="msg">لا توجد بيانات لهذا الشهر.</div>';return;}
    const bySup=new Map(); rows.forEach(r=>{if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r);});
    box.innerHTML=[...bySup.entries()].map(([sup,items])=>{
      const total=items.reduce((s,r)=>s+N(r.minutes),0);
      const projectRows=items.map(r=>`<tr><td>${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${total?Math.round(N(r.minutes)/total*100):0}%</td></tr>`).join('');
      const allWorkers=[...new Set(items.flatMap(r=>S(r.workers).split(/[,،]/).map(x=>S(x)).filter(x=>x&&x!=='-')))];
      const workersHtml=allWorkers.length?allWorkers.map(w=>`<span>${E(w)}</span>`).join(''):'<small>لا توجد أسماء عمال مرتبطة</small>';
      return `<div class="mt49-supervisor-card"><h3>${E(sup)}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><div class="mt49-workers-title">أسماء العمال</div><div class="mt49-worker-names">${workersHtml}</div></div>`;
    }).join('');
  }
  function renderWorkersGrid(rows){
    const box=$('mt49WorkersGrid'); if(!box) return;
    const projects=new Map(); rows.forEach(r=>{if(!projects.has(r.project)) projects.set(r.project,new Set()); S(r.workers).split(/[,،]/).map(x=>S(x)).filter(x=>x&&x!=='-').forEach(w=>projects.get(r.project).add(w));});
    if(!projects.size){box.innerHTML='<div class="msg">لا توجد أسماء عمال مرتبطة بالسجلات.</div>';return;}
    box.innerHTML=[...projects.entries()].map(([project,set])=>`<div class="mt49-project-workers"><h3>${E(project)}</h3><div>${[...set].map(w=>`<span>${E(w)}</span>`).join('')||'<small>لا توجد أسماء</small>'}</div></div>`).join('');
  }
  function renderTable(rows){
    const body=$('mt49Body'); if(!body) return;
    if(!rows.length){body.innerHTML='<tr><td colspan="10">لا توجد بيانات.</td></tr>';return;}
    body.innerHTML=rows.map(r=>`<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt0(r.minutes)}</td><td>${fmt2(N(r.minutes)/60)}</td><td>${fmt0(r.travel)}</td><td>${pctBySupervisor(rows,r)}%</td><td>${E(r.source)}</td><td>${r.manual?`<button class="light" onclick="TasneefMonthlyV10151.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10151.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`).join('');
  }
  function render(){state.filtered=filterRows(); renderSummary(state.filtered); renderVisitCards(state.filtered); renderWorkersGrid(state.filtered); renderTable(state.filtered);}
  async function load(){
    if(state.loading) return; state.loading=true;
    const ym=S($('mt49Month')?.value)||ymNow(); state.month=ym; if($('mt49Month')) $('mt49Month').value=ym;
    status('جاري التحميل...','amber'); msg('');
    try{
      const [rows,manual]=await Promise.all([rpcMonthly(ym),loadManual(ym)]);
      state.rows=A(rows); state.manual=manual; state.groups=aggregateWithManual(rows,manual);
      fillFilters(); render();
      const totalRecords=state.groups.reduce((s,r)=>s+N(r.count),0);
      status('تم تحميل '+fmt0(totalRecords)+' سجل','green');
      msg(`تم تحميل ${fmt0(totalRecords)} سجل لشهر ${ym}. المعادلة: نسبة المشروع = دقائق المشروع ÷ إجمالي دقائق المشرف.`);
    }catch(e){console.error(e); status('خطأ','red'); msg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true);} finally{state.loading=false;}
  }
  function clearManual(){['mt49ManualId','mt49ManualSupervisor','mt49ManualProject','mt49ManualWorkers','mt49ManualMinutes','mt49ManualTravel'].forEach(id=>{if($(id))$(id).value='';});}
  async function saveManual(){
    const r={id:S($('mt49ManualId')?.value)||('m-'+Date.now()),month:S($('mt49Month')?.value)||ymNow(),supervisor:S($('mt49ManualSupervisor')?.value),project:S($('mt49ManualProject')?.value),workers:S($('mt49ManualWorkers')?.value),minutes:N($('mt49ManualMinutes')?.value),travel:N($('mt49ManualTravel')?.value)};
    if(!r.supervisor||!r.project){alert('اكتب اسم المشرف واسم المشروع');return;}
    const arr=localManual(); const idx=arr.findIndex(x=>S(x.id)===S(r.id)); if(idx>=0) arr[idx]=r; else arr.push(r); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    try{await fetch(`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}`,{method:'POST',headers:headers({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'}),body:JSON.stringify({id:r.id,month_key:r.month,supervisor_name:r.supervisor,project_name:r.project,worker_names:r.workers,actual_minutes:r.minutes,required_minutes:r.minutes,travel_minutes:r.travel,updated_at:new Date().toISOString()})});}catch(_){ }
    clearManual(); await load();
  }
  function editManual(id){const r=state.groups.find(x=>S(x.id)===S(id)); if(!r)return; $('mt49ManualId').value=r.id; $('mt49ManualSupervisor').value=r.supervisor; $('mt49ManualProject').value=r.project; $('mt49ManualWorkers').value=r.workers||''; $('mt49ManualMinutes').value=N(r.minutes)||''; $('mt49ManualTravel').value=N(r.travel)||'';}
  async function removeManual(id){if(!confirm('حذف هذا التعديل اليدوي؟'))return; const arr=localManual().filter(x=>S(x.id)!==S(id)); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr)); try{await fetch(`${SUPABASE_URL}/rest/v1/${MANUAL_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:headers()});}catch(_){ } await load();}
  function csv(){
    const rows=state.filtered||[], heads=['المشرف','المشروع','أسماء العمال','عدد السجلات','الدقائق','الساعات','وقت الانتقال','النسبة','المصدر'];
    const lines=[heads.join(',')].concat(rows.map(r=>[r.supervisor,r.project,r.workers||'',r.count,fmt0(r.minutes),fmt2(N(r.minutes)/60),fmt0(r.travel),pctBySupervisor(rows,r)+'%',r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function printReport(){window.print();}
  function bind(){
    if(!$('mt49Body')) return;
    if($('mt49Month')&&!$('mt49Month').value) $('mt49Month').value=ymNow();
    $('mt49Month')?.addEventListener('change',load); $('mt49Supervisor')?.addEventListener('change',render); $('mt49Project')?.addEventListener('change',render); $('mt49Refresh')?.addEventListener('click',load);
    $('mt49Csv')?.addEventListener('click',csv); $('mt49Print')?.addEventListener('click',printReport); $('mt49ManualSave')?.addEventListener('click',saveManual); $('mt49ManualClear')?.addEventListener('click',clearManual);
    load();
  }
  window.TasneefMonthlyV10151={reload:load,edit:editManual,remove:removeManual,csv,print:printReport};
  window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=printReport;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else setTimeout(bind,0);
})();
