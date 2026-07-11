(function(){
  'use strict';
  // V440: كشف الرواتب يلتزم بالتوزيع الموحد كما هو: المشرف ثم عماله، بدون نقل عامل لمكان غير مكانه.
  if(window.__tasneefSalariesUnifiedV440) return;
  window.__tasneefSalariesUnifiedV440=true;
  const VERSION='V442 رواتب ثابتة من التوزيع';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(String(v??'').replace(/,/g,''))||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>N(v).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const monthStart=m=>m+'-01';
  const daysInMonth=m=>{const [y,mo]=S(m).split('-').map(Number);return new Date(y,mo,0).getDate()||30};
  const monthEnd=m=>{const [y,mo]=S(m).split('-').map(Number);const d=new Date(y,mo,0);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[\u200e\u200f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const active=x=>!['deleted','archived','inactive','stopped','ended','disabled','محذوف','موقوف','متوقف','منتهي','غير نشط','غيرنشط'].includes(norm(x));
  const isPresent=s=>['present','حاضر','حضور','ح','p'].includes(norm(s));
  const isAbsent=s=>['absent','غائب','غياب','غ','a'].includes(norm(s));
  let st={workers:[],dist:[],attendance:[],projects:[],saved:[],rows:[]};

  function msg(t,bad){let el=$('salaryMsg')||$('cu413Msg'); if(el){el.textContent=t; el.className=(el.id==='salaryMsg'?'msg ':'cu413-msg ')+(bad?'err':''); el.classList?.remove('hidden'); el.style.display='block';} console[bad?'warn':'log']('[salary-v440]',t);}
  async function all(table,select='*',build){let out=[],from=0,size=1000; while(true){let q=window.sb.from(table).select(select).range(from,from+size-1); if(build)q=build(q); const r=await q; if(r.error)throw r.error; out=out.concat(r.data||[]); if(!r.data||r.data.length<size)break; from+=size;} return out;}
  async function tryAll(table,select='*',build){try{return await all(table,select,build)}catch(e){console.warn('salary v440 skip '+table,e.message);return[]}}

  function codeNorm(v){let s=S(v); let m=s.match(/TS[-_\s]?(\d+)/i); if(m)return 'TS-'+String(Number(m[1])).padStart(2,'0'); return s;}
  function rawCode(x){return S(x.employee_code||x.employee_ts_id||x.code||x.worker_employee_code||x.worker_code||x.id)}
  function codeOf(x){return codeNorm(rawCode(x));}
  function nameOf(w){return S(w.app_name||w.employee_name||w.name||w.full_name||w.worker_name||w.residency_name||w.iqama_name)}
  function resName(w){return S(w.residency_name||w.iqama_name||w.name_on_iqama||w.employee_residency_name||w.employee_name||w.name||w.full_name)}
  function iqamaOf(w){return S(w.iqama_number||w.iqama_no||w.residency_number||w.id_number)}
  function jobOf(w){return S(w.job_title||w.position||w.role_name||'عامل')}
  function basicOf(w){return N(w.basic_salary ?? w.salary ?? w.base_salary ?? 0)}
  function allowanceOf(w){return N(w.allowance ?? w.allowances ?? w.salary_allowance ?? w.allowance_amount ?? w.housing_allowance ?? w.allowance_value ?? w.allowance_total ?? 0)}
  function startOf(w){return S(w.start_date||w.work_start_date||w.joining_date||w.date_start||w.default_start_date)}
  function endOf(w){return S(w.end_date||w.work_end_date||w.termination_date||w.date_end||w.default_end_date)}
  function catOf(job){const j=norm(job); if(j.includes('مشرف'))return'supervisors'; if(j.includes('فني')||j.includes('صيانة'))return'technicians'; if(j.includes('حارس'))return'guards'; return'workers';}
  function workerActive(w){return active(w.status||w.state||'active')}
  function projectById(pid){return (st.projects||[]).find(p=>S(p.id)===S(pid))||{};}
  function projectName(pid){const p=projectById(pid); return S(p.name||p.project_name||p.title||pid||'')}
  function projectType(pid,dist){const p=projectById(pid); return norm(p.operation_type||p.project_type||p.type||p.work_type||p.service_type||dist?.operation_type||dist?.project_type||dist?.type||'')}
  function isDailyProject(pid,dist){const t=projectType(pid,dist); return t.includes('زياره')||t.includes('زيارة')||t.includes('daily')||t.includes('visit')||t.includes('3 ساعات')||t.includes('جزئي');}
  function isFullProject(pid,dist){const t=projectType(pid,dist); return t.includes('دوام كامل')||t.includes('كامل')||t.includes('full')||t.includes('9 ساعات')||t.includes('full time');}

  function mergeWorkers(empRows,workerRows){
    const m=new Map();
    function put(w,priority){const c=codeOf(w); if(!c||/^\d+$/.test(c))return; const old=m.get(c)||{}; const merged=priority>=(old.__priority||0)?Object.assign({},old,w,{__priority:priority}):Object.assign({},w,old,{__priority:old.__priority||0}); m.set(c,merged);}
    (workerRows||[]).forEach(w=>put(w,1));
    (empRows||[]).forEach(w=>put(w,2));
    return [...m.values()].filter(workerActive).sort((a,b)=>codeOf(a).localeCompare(codeOf(b),'en',{numeric:true}));
  }
  function workerByCode(code){const c=codeNorm(code); return (st.workers||[]).find(w=>codeOf(w)===c)||null;}
  function numericEntityId(row,idx){let raw=S(row.employee_ts_id||row.employee_code||row.entity_id); let m=raw.match(/TS[-_\s]?(\d+)/i); if(m)return Number(m[1]); if(/^\d+$/.test(raw))return Number(raw); let h=0; for(let i=0;i<raw.length;i++)h=((h*31)+raw.charCodeAt(i))>>>0; return h||idx+1;}
  function clamp(d,m){d=S(d).slice(0,10); if(!d)return''; const a=monthStart(m),b=monthEnd(m); if(d<a)return a; if(d>b)return b; return d;}
  function daysBetween(a,b,m){a=clamp(a,m)||monthStart(m); b=clamp(b,m)||monthEnd(m); if(b<a){const t=a;a=b;b=t} return Math.max(0,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1)}
  function savedFor(code,month){const c=codeNorm(code); const nid=String(numericEntityId({employee_ts_id:c},0)); return (st.saved||[]).find(s=>S(s.salary_month).slice(0,7)===month && (codeNorm(s.employee_ts_id||s.employee_code)===c || String(s.entity_id)===nid))||{};}

  function projectActiveById(pid){const p=projectById(pid); return !p.id || active(p.status||p.state||p.active_status||'active');}
  function distMonth(month){return (st.dist||[]).filter(d=>S(d.month_key||d.month||d.salary_month||'').slice(0,7)===month && active(d.status||'active') && projectActiveById(distProjectId(d)));}
  function distWorkerCode(d){return codeNorm(d.worker_employee_code||d.employee_code||d.worker_code||d.worker_id||'');}
  function distSupervisorCode(d){return codeNorm(d.supervisor_employee_code||d.supervisor_code||d.supervisor_worker_code||d.supervisor_id||'');}
  function distProjectId(d){return S(d.project_id||d.project_code||d.project||'');}
  function distProjectName(d){return S(d.project_name||projectName(distProjectId(d))||distProjectId(d));}
  function distSupervisorName(d){const sc=distSupervisorCode(d), sw=workerByCode(sc); return S(d.supervisor_name||nameOf(sw)||sc||'بدون مشرف');}

  function salaryGroupKey(d){const sc=distSupervisorCode(d); return sc || norm(distSupervisorName(d)) || 'no-supervisor';}
  function salaryGroups(month){
    // لا نعيد ترتيب المشرفين أبجديًا. نأخذ ترتيب التوزيع كما هو محفوظ/معروض في النظام الموحد.
    const groups=new Map();
    distMonth(month).forEach((d,idx)=>{
      const wc=distWorkerCode(d); if(!wc) return;
      const key=salaryGroupKey(d); 
      if(!groups.has(key)) groups.set(key,{code:distSupervisorCode(d),name:distSupervisorName(d),rows:[],workers:new Map(),_order:idx});
      const g=groups.get(key); 
      g.rows.push(d); 
      if(!g.workers.has(wc))g.workers.set(wc,[]); 
      g.workers.get(wc).push(d);
    });
    return [...groups.values()].sort((a,b)=>(a._order||0)-(b._order||0));
  }
  function displayProjects(rows){return [...new Set((rows||[]).map(distProjectName).filter(Boolean))].join('، ')}
  function uniqueProjectIds(rows){return [...new Set((rows||[]).map(distProjectId).filter(Boolean).map(S))];}
  function workLocationForWorker(rows,supName){
    // قاعدة أبو سامر المعتمدة:
    // إذا العامل موزع على أكثر من مشروع في نفس الشهر فهذا تشغيل زيارة يومية، ومكان العمل = اسم المشرف.
    // إذا العامل مربوط على مشروع واحد فقط ونوعه دوام كامل، مكان العمل = اسم المشروع.
    // لا ندمج أسماء مشاريع كثيرة داخل مكان العمل حتى لا يظهر العامل في غير مكانه.
    rows=rows||[];
    const pids=uniqueProjectIds(rows);
    if(pids.length===1 && isFullProject(pids[0], rows[0])) return distProjectName(rows[0]) || projectName(pids[0]);
    return supName || 'بدون مشرف';
  }

  function matchAttendance(a,code,emp){
    const keys=[code,nameOf(emp),resName(emp)].map(x=>norm(codeNorm(x))).filter(Boolean);
    const vals=[a.worker_employee_code,a.employee_code,a.employee_ts_id,a.worker_code,a.worker_identity,a.worker_name,a.employee_name].map(x=>norm(codeNorm(x))).filter(Boolean);
    return keys.some(k=>vals.some(v=>v===k || (k.length>2 && v.length>2 && (v.includes(k)||k.includes(v)))));
  }
  function attendanceStats(code,emp,month){const p=new Set(),a=new Set(),all=new Set(); (st.attendance||[]).forEach(r=>{const d=S(r.attendance_date||r.date||r.created_at).slice(0,10); if(!d.startsWith(month))return; if(!matchAttendance(r,code,emp))return; all.add(d); if(isAbsent(r.status||r.state||r.attendance_status))a.add(d); else if(isPresent(r.status||r.state||r.attendance_status))p.add(d);}); a.forEach(d=>p.delete(d)); return {present:p.size,absent:a.size,dates:[...all].sort(),absentDates:[...a].sort()};}

  function calc(row,month){const dim=daysInMonth(month); row.gross_salary=N(row.basic_salary)+N(row.allowance); row.work_days=N(row.work_days); row.absent_days=Math.max(0,Math.min(N(row.absent_days),row.work_days)); row.payable_days=Math.max(0,row.work_days-row.absent_days); row.absence_deduction=Math.round((row.gross_salary/dim*row.absent_days)*100)/100; row.manual_extra_deductions=N(row.manual_extra_deductions||0); row.deductions=Math.round((row.absence_deduction+row.manual_extra_deductions)*100)/100; row.salary_by_days=Math.round((row.gross_salary/dim*row.work_days)*100)/100; const pre=Math.round((row.salary_by_days+N(row.commission)-N(row.deductions)-N(row.advance_deduction))*100)/100; const ce=Math.ceil(pre-0.000001); row.rounding=Math.round(Math.max(0,ce-pre)*100)/100; row.net_salary=Math.round((pre+row.rounding)*100)/100; if(row.absent_days>0&&!row.notes)row.notes='خصم غياب: '+money(row.absent_days)+' '+(row.absent_days===1?'يوم':'أيام'); if(row.absent_days<=0&&S(row.notes).startsWith('خصم غياب'))row.notes=''; return row;}

  function makeSalaryRow(code,distRows,month,groupTitle,isSupervisor){
    const emp=workerByCode(code) || {employee_code:code,employee_ts_id:code,app_name:S(distRows?.[0]?.worker_name||distRows?.[0]?.supervisor_name||code),job_title:isSupervisor?'مشرف':'عامل'};
    const sv=savedFor(code,month), att=attendanceStats(code,emp,month);
    const job=sv.job_title||jobOf(emp)||(isSupervisor?'مشرف':'عامل');
    const cat=catOf(job);
    const supName=isSupervisor?nameOf(emp):(distRows?.[0]?distSupervisorName(distRows[0]):'');
    let start=sv.start_date||startOf(emp)||monthStart(month), end=sv.end_date||endOf(emp)||monthEnd(month); start=clamp(start,month)||monthStart(month); end=clamp(end,month)||monthEnd(month);
    const basicDefault=cat==='supervisors'?2000:(cat==='guards'?1200:1300), allowanceDefault=cat==='supervisors'?300:200;
    const row={
      entity_type:'unified', entity_id:code, employee_ts_id:sv.employee_ts_id||code, employee_code:sv.employee_ts_id||code,
      residency_name:sv.residency_name||resName(emp), employee_name:sv.employee_name||nameOf(emp)||S(distRows?.[0]?.worker_name||code), iqama_no:sv.iqama_no||iqamaOf(emp),
      work_location:sv.work_location || (isSupervisor?'FM':workLocationForWorker(distRows,supName)),
      project_name:sv.project_name || (isSupervisor?'':displayProjects(distRows)), supervisor_name:isSupervisor?(nameOf(emp)||supName):supName,
      job_title:job, start_date:start, end_date:end, work_days:daysBetween(start,end,month),
      absent_days:(sv.absent_days!==undefined&&S(sv.absent_days)!=='')?N(sv.absent_days):N(att.absent),
      basic_salary:(sv.basic_salary!==undefined&&S(sv.basic_salary)!=='')?N(sv.basic_salary):(basicOf(emp)||basicDefault),
      allowance:(sv.allowance!==undefined&&S(sv.allowance)!=='')?N(sv.allowance):(allowanceOf(emp)||allowanceDefault),
      commission:N(sv.commission??0), advance_deduction:N(sv.advance_deduction??0), manual_extra_deductions:N(sv.manual_extra_deductions??0), notes:sv.notes||'', _groupTitle:groupTitle||''
    };
    return calc(row,month);
  }

  function buildRows(){
    const month=$('salaryMonth')?.value||today().slice(0,7), type=$('salaryType')?.value||'all', sid=codeNorm($('salarySupervisor')?.value||''), pid=S($('salaryProject')?.value||''), q=norm($('salarySearch')?.value||'');
    const rows=[];
    const groups=salaryGroups(month);
    groups.forEach(g=>{
      if(sid && g.code!==sid) return;
      const groupTitle='المشرف: '+(g.name||g.code||'بدون مشرف')+(g.code?(' - '+g.code):'');
      if((type==='all'||type==='supervisors') && g.code){
        const srow=makeSalaryRow(g.code,g.rows,month,groupTitle,true);
        if(!q || [srow.employee_ts_id,srow.residency_name,srow.employee_name,srow.iqama_no,srow.work_location,srow.job_title].join(' ').toLowerCase().includes(q)) rows.push(srow);
      }
      [...g.workers.entries()].forEach(([wc,drows])=>{
        if(codeNorm(wc)===codeNorm(g.code)) return; // المشرف يظهر مرة واحدة كرأس المجموعة ولا يكرر كعامل
        if(pid && !drows.some(d=>distProjectId(d)===pid)) return;
        const emp=workerByCode(wc);
        if(!emp) return; // لا ندخل عامل بلا بيانات في العمال الموحدين
        const cat=catOf(jobOf(emp));
        if(type!=='all' && type!==cat) return;
        const r=makeSalaryRow(wc,drows,month,groupTitle,false);
        if(q && ![r.employee_ts_id,r.residency_name,r.employee_name,r.iqama_no,r.work_location,r.project_name,r.supervisor_name,r.job_title].join(' ').toLowerCase().includes(q)) return;
        rows.push(r);
      });
    });
    st.rows=rows;
    render();
    msg('تم بناء الرواتب من التوزيع الموحد المعتمد: '+rows.length+' سجل. العامل يبقى تحت مشرفه ومكان عمله حسب قاعدة الزيارة/الدوام الكامل.');
  }

  function totals(){return st.rows.reduce((a,r)=>{['basic_salary','allowance','gross_salary','salary_by_days','commission','deductions','advance_deduction','rounding','net_salary'].forEach(k=>a[k]=(a[k]||0)+N(r[k]));return a;},{})}
  function input(r,k,w=110,type='text'){return `<input class="sal-input" type="${type}" style="width:${w}px" value="${esc(r[k]??'')}" oninput="tasneefSalariesUnifiedV440.update('${esc(r.entity_id)}','${k}',this.value)" onchange="tasneefSalariesUnifiedV440.update('${esc(r.entity_id)}','${k}',this.value)">`}
  function rowHtml(r,i,month){return `<tr data-sal-row="${esc(r.entity_id)}"><td>${i}</td><td>${esc(r.employee_ts_id)}</td><td>${esc(month)}</td><td>${input(r,'residency_name',180)}</td><td>${input(r,'employee_name',125)}</td><td>${input(r,'iqama_no',120)}</td><td>${input(r,'work_location',150)}</td><td>${input(r,'notes',190)}</td><td>${esc(r.job_title)}</td><td>${input(r,'start_date',130,'date')}</td><td>${input(r,'end_date',130,'date')}</td><td>${money(r.work_days)}</td><td>${input(r,'absent_days',90,'number')}</td><td>${money(r.payable_days)}</td><td>${input(r,'basic_salary',95,'number')}</td><td>${input(r,'allowance',85,'number')}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td><td>${input(r,'commission',85,'number')}</td><td>${input(r,'manual_extra_deductions',90,'number')}</td><td>${money(r.rounding)}</td><td>${input(r,'advance_deduction',85,'number')}</td><td><b>${money(r.net_salary)}</b></td></tr>`}
  function render(){const body=$('salaryBody'),kp=$('salaryKpis'); if(!body)return; const month=$('salaryMonth')?.value||today().slice(0,7); let html='',i=0,last=''; st.rows.forEach(r=>{if(r._groupTitle&&r._groupTitle!==last){last=r._groupTitle; html+=`<tr class="salary-group-row"><td colspan="23">${esc(last)}</td></tr>`} html+=rowHtml(r,++i,month)}); body.innerHTML=html||'<tr><td colspan="23">لا توجد بيانات. تأكد أن العمال مربوطون في النظام الموحد → التوزيع، وأن بياناتهم موجودة في العمال.</td></tr>'; const t=totals(); if(kp)kp.innerHTML=`<div class="kpi"><small>عدد السجلات</small><b>${st.rows.length}</b></div><div class="kpi"><small>الأساسي</small><b>${money(t.basic_salary)}</b></div><div class="kpi"><small>البدلات</small><b>${money(t.allowance)}</b></div><div class="kpi"><small>الخصومات والسلف</small><b>${money(N(t.deductions)+N(t.advance_deduction))}</b></div><div class="kpi"><small>الصافي</small><b>${money(t.net_salary)}</b></div>`; const foot=$('salaryFoot'); if(foot)foot.innerHTML=`<tr><td colspan="14"><b>الإجمالي</b></td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td></tr>`;}
  function update(id,k,v){const r=st.rows.find(x=>S(x.entity_id)===S(id)); if(!r)return; const month=$('salaryMonth')?.value||today().slice(0,7); if(['basic_salary','allowance','commission','manual_extra_deductions','advance_deduction','absent_days'].includes(k))r[k]=N(v); else r[k]=v; if(['start_date','end_date'].includes(k))r.work_days=daysBetween(r.start_date,r.end_date,month); calc(r,month); render();}

  async function load(){try{if(!window.sb)throw new Error('Supabase غير جاهز'); msg('جاري تحميل الرواتب من التوزيع الموحد...'); const month=$('salaryMonth')?.value||today().slice(0,7), start=monthStart(month), end=monthEnd(month); const [emp,wrk,dist,att,projects,saved]=await Promise.all([tryAll('employees_master_v386','*'),tryAll('workers','*'),tryAll('monthly_distribution','*'),tryAll('attendance','*',q=>q.gte('attendance_date',start).lte('attendance_date',end)),tryAll('projects','*'),tryAll('monthly_salaries','*',q=>q.eq('salary_month',start))]); st.workers=mergeWorkers(emp,wrk); st.dist=dist; st.attendance=att; st.projects=projects; st.saved=saved; fillFilters(month); buildRows();}catch(e){console.error(e); msg('فشل تحميل الرواتب: '+(e.message||e),true)}}
  function fillFilters(month){const sup=$('salarySupervisor'),pr=$('salaryProject'); if(sup){const cur=sup.value; const sups=[...new Map(distMonth(month).map(d=>[salaryGroupKey(d),distSupervisorName(d)]).filter(x=>x[0])).entries()]; sup.innerHTML='<option value="">كل المشرفين</option>'+sups.map(([c,n])=>`<option value="${esc(c)}">${esc(n)}${/^TS-/.test(c)?' - '+esc(c):''}</option>`).join(''); sup.value=sups.map(x=>x[0]).includes(cur)?cur:''} if(pr){const cur=pr.value; const ps=[...new Map(distMonth(month).map(d=>[distProjectId(d),distProjectName(d)]).filter(x=>x[0])).entries()]; pr.innerHTML='<option value="">كل المشاريع</option>'+ps.map(([c,n])=>`<option value="${esc(c)}">${esc(n)}</option>`).join(''); pr.value=ps.map(x=>x[0]).includes(cur)?cur:''}}
  async function save(approve){try{const month=$('salaryMonth')?.value||today().slice(0,7); const rows=st.rows.map((r,i)=>({salary_month:monthStart(month),entity_type:'unified_distribution',entity_id:numericEntityId(r,i),employee_ts_id:r.employee_ts_id,employee_code:r.employee_ts_id,residency_name:r.residency_name,iqama_no:r.iqama_no,employee_name:r.employee_name,work_location:r.work_location,project_name:r.project_name,supervisor_name:r.supervisor_name,job_title:r.job_title,start_date:r.start_date||null,end_date:r.end_date||null,work_days:N(r.work_days),absent_days:N(r.absent_days),payable_days:N(r.payable_days),basic_salary:N(r.basic_salary),allowance:N(r.allowance),gross_salary:N(r.gross_salary),salary_by_days:N(r.salary_by_days),commission:N(r.commission),deductions:N(r.deductions),rounding:N(r.rounding),advance_deduction:N(r.advance_deduction),net_salary:N(r.net_salary),notes:r.notes||'',is_approved:!!approve,approved_at:approve?new Date().toISOString():null,updated_at:new Date().toISOString()})); if(!rows.length)return msg('لا توجد رواتب للحفظ',true); const res=await window.sb.from('monthly_salaries').upsert(rows,{onConflict:'salary_month,entity_type,entity_id'}); if(res.error)throw res.error; msg(approve?'تم اعتماد الرواتب':'تم حفظ الرواتب'); await load();}catch(e){console.error(e); msg('فشل حفظ الرواتب: '+(e.message||e),true)}}
  function print(){const sec=$('salaries'); if(!sec)return; const w=window.open('','_blank'); w.document.write('<html dir="rtl"><head><meta charset="utf-8"><title>كشف الرواتب</title></head><body>'+sec.innerHTML+'</body></html>'); w.document.close(); setTimeout(()=>w.print(),400)}
  function csv(){const month=$('salaryMonth')?.value||today().slice(0,7); const heads=['أيدي الموظف','الشهر','اسم الموظف في الإقامة','اسم الموظف الحركي','رقم الإقامة','مكان العمل','ملاحظات','الوظيفة','بداية الخدمة','نهاية الخدمة','أيام العمل','أيام الغياب','الأيام المستحقة','الأساسي','البدلات','الإجمالي','راتب الفترة','العمولات','الخصومات','جبر الكسور','السلف','الصافي']; const rows=st.rows.map(r=>[r.employee_ts_id,month,r.residency_name,r.employee_name,r.iqama_no,r.work_location,r.notes,r.job_title,r.start_date,r.end_date,r.work_days,r.absent_days,r.payable_days,r.basic_salary,r.allowance,r.gross_salary,r.salary_by_days,r.commission,r.deductions,r.rounding,r.advance_deduction,r.net_salary]); const data=[heads,...rows].map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+data],{type:'text/csv'})); a.download='رواتب_'+month+'.csv'; a.click();}

  function inject(){let sec=$('salaries'); if(!sec){const side=document.querySelector('.side'); const ref=[...document.querySelectorAll('.side .nav')].find(b=>S(b.textContent).includes('الأوقات الشهرية')); const btn=document.createElement('button'); btn.className='nav'; btn.textContent='الرواتب'; btn.onclick=function(){showPage('salaries',this); setTimeout(load,60)}; if(side)side.insertBefore(btn,ref?ref.nextSibling:side.querySelector('.nav.danger')); const main=document.querySelector('main.content'); sec=document.createElement('section'); sec.id='salaries'; sec.className='page hidden'; if(main)main.appendChild(sec);} sec.innerHTML=`<style>.salary-table-wrap{max-height:640px;overflow:auto}.salary-table{min-width:2300px}.salary-group-row td{background:#dfeee9;color:#064537;font-weight:900;text-align:right;font-size:13px}.salary-table th{position:sticky;top:0;z-index:2}.sal-input{width:110px;border:1px solid var(--line,#dce6e2);border-radius:8px;padding:6px;text-align:center}.salary-actions{display:flex;gap:8px;flex-wrap:wrap}.salary-note{background:#eef8f4;border:1px solid var(--line,#dce6e2);border-radius:14px;padding:10px;color:#07513f;font-weight:800}</style><div class="card"><div class="table-head"><h2>الرواتب</h2><span class="badge green">${VERSION}</span></div><div class="salary-note">مصدر الرواتب الآن: التوزيع الموحد المعتمد يحدد المشرف وتحته العمال. بيانات العامل من قسم العمال، والغياب فقط من الحضور. إذا العامل على عدة مشاريع أو زيارة يومية فمكان العمل اسم المشرف، وإذا على مشروع دوام كامل واحد فمكان العمل اسم المشروع.</div><div id="salaryMsg" class="msg hidden"></div><div class="filters"><div><label>الشهر</label><input type="month" id="salaryMonth" value="${today().slice(0,7)}" onchange="tasneefSalariesUnifiedV440.load()"></div><div><label>نوع الكشف</label><select id="salaryType" onchange="tasneefSalariesUnifiedV440.buildRows()"><option value="all">الكل</option><option value="supervisors">رواتب المشرفين</option><option value="workers">رواتب العمال</option><option value="technicians">رواتب الفنيين</option><option value="guards">رواتب الحراس</option></select></div><div><label>المشرف</label><select id="salarySupervisor" onchange="tasneefSalariesUnifiedV440.buildRows()"><option value="">كل المشرفين</option></select></div><div><label>المشروع</label><select id="salaryProject" onchange="tasneefSalariesUnifiedV440.buildRows()"><option value="">كل المشاريع</option></select></div><div><label>بحث</label><input id="salarySearch" oninput="tasneefSalariesUnifiedV440.buildRows()" placeholder="اسم/إقامة/TS"></div></div><div class="salary-actions"><button onclick="tasneefSalariesUnifiedV440.load()">تحديث الرواتب</button><button class="light" onclick="tasneefSalariesUnifiedV440.save(false)">حفظ التعديلات</button><button class="light" onclick="tasneefSalariesUnifiedV440.save(true)">اعتماد الرواتب</button><button class="light" onclick="tasneefSalariesUnifiedV440.print()">طباعة</button><button class="light" onclick="tasneefSalariesUnifiedV440.csv()">تصدير CSV</button></div><div id="salaryKpis" class="kpis small"></div><div class="table-wrap salary-table-wrap"><table class="salary-table"><thead><tr><th>رقم</th><th>أيدي الموظف</th><th>الشهر</th><th>اسم الموظف في الإقامة</th><th>اسم الموظف الحركي</th><th>رقم الإقامة</th><th>مكان العمل</th><th>ملاحظات</th><th>الوظيفة</th><th>بداية الخدمة</th><th>نهاية الخدمة</th><th>أيام العمل</th><th>أيام الغياب</th><th>الأيام المستحقة</th><th>قيمة الرواتب الأساسية</th><th>البدلات</th><th>الإجمالي</th><th>إجمالي الراتب على أيام الفترة</th><th>العمولات</th><th>الخصومات</th><th>جبر الكسور</th><th>خصم السلف</th><th>الصافي</th></tr></thead><tbody id="salaryBody"></tbody><tfoot id="salaryFoot"></tfoot></table></div></div>`;}

  const api={inject,load,buildRows,update,save,print,csv};
  window.tasneefSalariesUnifiedV440=api;
  window.tasneefSalariesUnifiedV439=api; window.tasneefSalariesUnifiedV438=api; window.tasneefSalariesUnifiedV435=api; window.tasneefSalariesV10267=api; window.tasneefSalariesV10281=api;
  const oldShow=window.showPage; window.showPage=function(page,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(page==='salaries')setTimeout(()=>{inject();load()},80); return r};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,900)); window.addEventListener('load',()=>setTimeout(inject,1100));
})();
