/* ===== TASNEEF V10849 - Unified distribution is the only supervisor scope source ===== */
(function(){
  'use strict';
  if(window.__tasneefUnifiedDistributionOnlyV10849)return;
  window.__tasneefUnifiedDistributionOnlyV10849=true;
  window.__tasneefSupervisorProjectsUnifiedV10848=true;
  window.__tasneefSupervisorProjectsCompleteV10848=true;
  window.__tasneefSupervisorProjectsCompleteV10847=true;
  window.__tasneefSupervisorProjectsCompleteV10846=true;
  window.__tasneefSupervisorProjectsCompleteV10816=true;

  const BUILD='V10849_UNIFIED_DISTRIBUTION_ONLY';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/ء/g,'').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const projectCache=new Map();
  const workerCache=new Map();
  let latestRequestId=0;
  let realtimeChannel=null;

  function user(){
    let live={};try{live=typeof session==='function'?(session()||{}):{};}catch(_){live={};}
    if(live&&Object.keys(live).length)return live;
    let saved={};try{saved=JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){saved={};}
    return saved;
  }
  function isSupervisor(){const u=user();return ['supervisor','مشرف'].includes(norm(u.role_key||u.role||u.user_role));}
  function sessionToken(){
    for(const key of ['tasneef_session_token_v10817','tasneef_permission_session_v10817','tasneef_session_token','tasneefPermissionSession']){
      const value=S(localStorage.getItem(key)||'');if(value)return value;
    }
    return '';
  }
  function riyadhDate(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  }
  function selectedDate(){
    const values=[$('logDate')?.value,$('attendanceDate')?.value,$('summaryDate')?.value].map(S).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v));
    return values[0]||riyadhDate();
  }
  function identity(){
    const u=user();
    return {
      authUserId:S(u.id||u.user_id||u.uid||u.app_user_id),
      employeeId:S(u.employee_id||u.worker_id||''),
      employeeCode:S(u.employee_code||u.employee_number||u.code||u.user_code||''),
      supervisorName:S(u.full_name||u.name||u.display_name||u.username||''),
      role:S(u.role_key||u.role||'')
    };
  }
  function projectCacheKey(supervisorId,date){return ['supervisor-projects',S(supervisorId),date].join(':');}
  function workerCacheKey(supervisorId,date){return ['supervisor-workers',S(supervisorId),date].join(':');}
  function esc(v){return S(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));}
  function ensureStateBox(){
    let box=$('supervisorProjectsLoadStateV10849');if(box)return box;
    const card=$('supLogs')?.querySelector('.card');if(!card)return null;
    box=document.createElement('div');box.id='supervisorProjectsLoadStateV10849';box.className='help';box.style.margin='0 0 10px';
    const firstHelp=card.querySelector('.help');if(firstHelp?.nextSibling)card.insertBefore(box,firstHelp.nextSibling);else card.prepend(box);
    return box;
  }
  function stateMessage(text,type='info'){
    const box=ensureStateBox();if(!box)return;
    box.textContent=text;
    box.style.color=type==='error'?'#9b2222':type==='success'?'#0b6b47':'#455f57';
    box.style.background=type==='error'?'#fff0f0':type==='success'?'#eef9f3':'#f6faf8';
    box.style.borderColor=type==='error'?'#efc1c1':'#d6e6df';
  }
  const selectConfigs=[
    ['logProject','اختر المشروع'],['attendanceProject','كل مشاريع المشرف'],['ticketProject','اختر المشروع'],['supTicketFilterProject','كل المشاريع'],
    ['supOrderProjectV10061','اختر المشروع'],['supOrderFilterProjectV10061','كل المشاريع'],['supInventoryRequestProject','اختر المشروع'],['supClientReportProject','اختر المشروع']
  ];
  function loadingSelects(){
    selectConfigs.forEach(([id])=>{const el=$(id);if(!el)return;const old=S(el.value);el.dataset.previousProjectValue=old;el.innerHTML='<option value="">جاري تحميل مشاريع المشرف…</option>';el.disabled=true;});
    stateMessage('جاري تحميل مشاريع المشرف…');
  }
  function setSelect(id,projects,label){
    const el=$(id);if(!el)return;
    const old=S(el.dataset.previousProjectValue||el.value);delete el.dataset.previousProjectValue;
    el.innerHTML=`<option value="">${esc(label)}</option>`+projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'-')}</option>`).join('');
    el.disabled=false;
    if([...el.options].some(o=>S(o.value)===old))el.value=old;
  }
  function refill(projects){selectConfigs.forEach(([id,label])=>setSelect(id,projects,label));}
  function uniqueById(rows){
    const map=new Map();A(rows).forEach(row=>{const id=S(row?.id||row?.project_id);if(id&&!map.has(id))map.set(id,row);});
    return [...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
  }
  function uniqueWorkers(rows){
    const map=new Map();A(rows).forEach(w=>{const key=S(w?.canonical_employee_id||w?.worker_id||w?.id||w?.employee_code||w?.worker_employee_code);if(key&&!map.has(key))map.set(key,w);});
    return [...map.values()].sort((a,b)=>S(a.name||a.app_name||a.worker_name).localeCompare(S(b.name||b.app_name||b.worker_name),'ar'));
  }
  async function rpc(name,args){
    const result=await sb.rpc(name,args);
    if(result?.error)throw result.error;
    const payload=result?.data||{};
    if(payload?.ok===false)throw new Error(payload?.message||'تعذر تحميل بيانات المشرف');
    return payload;
  }
  async function getUnifiedSupervisorProjects(supervisorId,date=selectedDate(),force=false){
    const sid=S(supervisorId||identity().authUserId),key=projectCacheKey(sid,date);
    if(!force){const hit=projectCache.get(key);if(hit&&Date.now()-hit.at<60000)return hit.payload;}
    const payload=await rpc('tasneef_get_unified_supervisor_projects_v10849',{p_session_token:sessionToken()||null,p_selected_date:date});
    payload.rows=uniqueById(payload.rows);
    projectCache.set(key,{at:Date.now(),payload});
    return payload;
  }
  async function getUnifiedSupervisorWorkers(supervisorId,date=selectedDate(),force=false){
    const sid=S(supervisorId||identity().authUserId),key=workerCacheKey(sid,date);
    if(!force){const hit=workerCache.get(key);if(hit&&Date.now()-hit.at<60000)return hit.payload;}
    const payload=await rpc('tasneef_get_unified_supervisor_workers_v10849',{p_session_token:sessionToken()||null,p_selected_date:date});
    payload.workers=uniqueWorkers(payload.workers||payload.rows);
    payload.assignments=A(payload.assignments);
    workerCache.set(key,{at:Date.now(),payload});
    return payload;
  }
  window.getUnifiedSupervisorProjects=getUnifiedSupervisorProjects;
  window.getUnifiedSupervisorProjectsV10849=getUnifiedSupervisorProjects;
  window.getUnifiedSupervisorWorkers=getUnifiedSupervisorWorkers;
  window.getUnifiedSupervisorWorkersV10849=getUnifiedSupervisorWorkers;
  window.getUnifiedSupervisorWorkersV10713=async function(dateOrForce,maybeForce){
    const force=typeof dateOrForce==='boolean'?dateOrForce:!!maybeForce;
    const date=typeof dateOrForce==='string'?dateOrForce:selectedDate();
    return getUnifiedSupervisorWorkers(identity().authUserId,date,force);
  };

  function diagnostics(projectPayload,workerPayload,projects,workers,date){
    const id=identity();
    console.table({
      authUserId:projectPayload?.identity?.authUserId||id.authUserId,
      employeeId:projectPayload?.identity?.employeeId||id.employeeId,
      resolvedSupervisorId:projectPayload?.identity?.resolvedSupervisorId||projectPayload?.user_id||id.authUserId,
      supervisorName:projectPayload?.identity?.supervisorName||id.supervisorName,
      selectedDate:date,
      selectedMonth:date.slice(0,7)
    });
    console.table({
      projectsFromDirectSupervisorField:0,
      projectsFromLocalStorage:0,
      projectsFromNames:0,
      projectsFromHistoricalAttendance:0,
      projectsFromUnifiedDistribution:Number(projectPayload?.sources?.projectsFromUnifiedDistribution||projects.length),
      finalSupervisorProjects:projects.length,
      workersFromUnifiedDistribution:Number(workerPayload?.assignments?.length||0),
      finalSupervisorWorkers:workers.length
    });
    console.table({
      supervisorId:projectPayload?.user_id||id.authUserId,
      adminDistributionProjectsCount:Number(projectPayload?.adminDistributionProjectsCount??projects.length),
      supervisorPageProjectsCount:projects.length,
      missingInSupervisorPage:A(projectPayload?.missingInSupervisorPage),
      extraInSupervisorPage:A(projectPayload?.extraInSupervisorPage)
    });
    if(A(projectPayload?.comparison).length)console.table(projectPayload.comparison);
    window.__tasneefUnifiedDistributionDiagnosticV10849={projectPayload,workerPayload,projects,workers,date,identity:id};
  }
  async function apply(force=false){
    if(!isSupervisor()||!window.sb)return;
    const requestId=++latestRequestId,date=selectedDate(),id=identity();
    loadingSelects();
    try{
      const [projectPayload,workerPayload]=await Promise.all([
        getUnifiedSupervisorProjects(id.authUserId,date,force),
        getUnifiedSupervisorWorkers(id.authUserId,date,force)
      ]);
      if(requestId!==latestRequestId)return;
      const projects=uniqueById(projectPayload.rows),workers=uniqueWorkers(workerPayload.workers);
      const d=window.data=window.data||{};
      d.projects=projects;
      d.workers=workers;
      d.workerAssignments=A(workerPayload.assignments);
      const projectIds=new Set(projects.map(p=>S(p.id)));
      window.__tasneefSupervisorProjectIdsV371=projectIds;
      window.__tasneefSupervisorProjectIdsV10816=projectIds;
      window.__tasneefSupervisorProjectIdsV10849=projectIds;
      refill(projects);
      stateMessage(projects.length?`تم تحميل ${projects.length} مشاريع و${workers.length} عمال من التوزيع الموحد`:'لا توجد مشاريع فعالة في التوزيع الموحد للتاريخ المحدد',projects.length?'success':'info');
      diagnostics(projectPayload,workerPayload,projects,workers,date);
      const title=$('supTitle');if(title)title.textContent='لوحة المشرف - '+(id.supervisorName||'');
      try{window.renderTimeLogs?.();}catch(e){console.warn(BUILD,e);}
      try{window.renderTickets?.();}catch(e){console.warn(BUILD,e);}
      try{window.renderSupervisorDailySummary?.();}catch(e){console.warn(BUILD,e);}
      try{window.renderSupervisorAttendanceList?.();}catch(e){console.warn(BUILD,e);}
      try{window.supOrdersLoadV10061?.();}catch(e){console.warn(BUILD,e);}
      window.dispatchEvent(new CustomEvent('tasneef:unified-supervisor-scope-loaded',{detail:{supervisorId:id.authUserId,date,projects,workers}}));
    }catch(e){
      if(requestId!==latestRequestId)return;
      console.error(BUILD,e);
      selectConfigs.forEach(([selectId,label])=>{const el=$(selectId);if(el){el.disabled=false;el.innerHTML=`<option value="">${esc(label)}</option>`;}});
      stateMessage('تعذر تحميل التوزيع الموحد للمشرف: '+S(e?.message||e),'error');
    }
  }
  function invalidateAndRefresh(detail){
    const id=identity(),target=S(detail?.supervisorId);
    if(target&&target!==id.authUserId)return;
    projectCache.clear();workerCache.clear();latestRequestId++;apply(true);
  }
  window.refreshSupervisorProjectsV10816=()=>{projectCache.clear();workerCache.clear();return apply(true);};
  window.refreshSupervisorProjectsV10849=window.refreshSupervisorProjectsV10816;
  window.refreshUnifiedSupervisorScopeV10849=window.refreshSupervisorProjectsV10816;

  const previousInit=window.initSupervisor;
  window.initSupervisor=async function(){if(typeof previousInit==='function')await previousInit.apply(this,arguments);projectCache.clear();workerCache.clear();await apply(true);};
  try{initSupervisor=window.initSupervisor;}catch(_){ }
  const previousLoadAll=window.loadAll;
  if(typeof previousLoadAll==='function')window.loadAll=async function(){const result=await previousLoadAll.apply(this,arguments);if(isSupervisor()){projectCache.clear();workerCache.clear();await apply(true);}return result;};
  try{loadAll=window.loadAll;}catch(_){ }
  const previousLogout=window.logout;
  if(typeof previousLogout==='function')window.logout=async function(){projectCache.clear();workerCache.clear();latestRequestId++;try{realtimeChannel&&sb.removeChannel(realtimeChannel);}catch(_){ }return previousLogout.apply(this,arguments);};

  window.addEventListener('tasneef:distribution-updated',e=>invalidateAndRefresh(e.detail||{}));
  window.addEventListener('storage',e=>{if(e.key!=='tasneef_distribution_changed_v10849'||!e.newValue)return;try{invalidateAndRefresh(JSON.parse(e.newValue));}catch(_){invalidateAndRefresh();}});
  try{
    const bc=new BroadcastChannel('tasneef-unified-distribution-v10849');
    bc.onmessage=e=>invalidateAndRefresh(e.data||{});
    window.__tasneefUnifiedDistributionBroadcastV10849=bc;
  }catch(_){ }
  function setupRealtime(){
    if(!window.sb||typeof sb.channel!=='function'||realtimeChannel)return;
    try{
      realtimeChannel=sb.channel('unified-distribution-v10849-'+(identity().authUserId||Date.now()))
        .on('postgres_changes',{event:'*',schema:'public',table:'supervisor_project_assignments'},()=>invalidateAndRefresh())
        .on('postgres_changes',{event:'*',schema:'public',table:'monthly_distribution'},()=>invalidateAndRefresh())
        .subscribe();
    }catch(e){console.warn(BUILD,'realtime unavailable',e);}
  }
  ['logDate','attendanceDate','summaryDate'].forEach(inputId=>document.addEventListener('change',e=>{if(e.target?.id===inputId){projectCache.clear();workerCache.clear();apply(true);}}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isSupervisor())apply(true);});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(isSupervisor())apply(true);setupRealtime();},350));
  window.addEventListener('load',()=>setTimeout(()=>{if(isSupervisor())apply(true);setupRealtime();},700));
  console.info(BUILD,'loaded');
})();
