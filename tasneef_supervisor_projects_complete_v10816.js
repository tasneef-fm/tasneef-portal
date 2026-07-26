/* ===== TASNEEF V10848 - One unified supervisor-project source ===== */
(function(){
  'use strict';
  if(window.__tasneefSupervisorProjectsUnifiedV10848)return;
  window.__tasneefSupervisorProjectsUnifiedV10848=true;
  window.__tasneefSupervisorProjectsCompleteV10848=true;
  window.__tasneefSupervisorProjectsCompleteV10847=true;
  window.__tasneefSupervisorProjectsCompleteV10846=true;
  window.__tasneefSupervisorProjectsCompleteV10816=true;

  const BUILD='V10848_UNIFIED_SUPERVISOR_PROJECTS';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/ء/g,'').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const projectCache=new Map();
  let applyRequestId=0;
  let realtimeChannel=null;

  function user(){
    let local={};try{local=JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){local={};}
    let live={};try{live=typeof session==='function'?(session()||{}):{};}catch(_){live={};}
    return Object.assign({},local,live);
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
  function cacheKey(date){const id=identity();return ['supervisor-projects',id.authUserId||id.employeeCode||norm(id.supervisorName),date].join(':');}
  function missingRpc(error,name){
    const code=S(error?.code),msg=S(error?.message||error).toLowerCase();
    return code==='PGRST202'||code==='42883'||(msg.includes(S(name).toLowerCase())&&(msg.includes('not find')||msg.includes('does not exist')));
  }
  function esc(v){return S(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));}
  function ensureStateBox(){
    let box=$('supervisorProjectsLoadStateV10848');if(box)return box;
    const card=$('supLogs')?.querySelector('.card');if(!card)return null;
    box=document.createElement('div');box.id='supervisorProjectsLoadStateV10848';box.className='help';box.style.margin='0 0 10px';
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
  function uniqueProjects(rows){
    const map=new Map();A(rows).forEach(p=>{if(!p)return;const key=S(p.id)||('name:'+norm(p.name));if(!key)return;if(!map.has(key))map.set(key,p);else map.set(key,Object.assign({},map.get(key),p));});
    return [...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
  }
  async function rpcProjects(date){
    const token=sessionToken();
    const primary='tasneef_get_unified_supervisor_projects_v10848';
    let r=await sb.rpc(primary,{p_session_token:token||null,p_selected_date:date});
    if(r?.error&&missingRpc(r.error,primary)){
      for(const fallback of ['tasneef_get_supervisor_projects_v10847','tasneef_get_supervisor_projects_v10846']){
        r=await sb.rpc(fallback,{p_session_token:token||null});
        if(!r?.error)break;
        if(!missingRpc(r.error,fallback))break;
      }
    }
    if(r?.error)throw r.error;
    const payload=r?.data||{};
    if(payload?.ok===false)throw new Error(payload?.message||'تعذر تحميل مشاريع المشرف');
    return Array.isArray(payload)?{ok:true,rows:payload,build:'legacy'}:payload;
  }
  async function getUnifiedSupervisorProjects(supervisorId,date=selectedDate(),force=false){
    const key=cacheKey(date);
    if(!force){const hit=projectCache.get(key);if(hit&&Date.now()-hit.at<60000)return hit.payload;}
    const payload=await rpcProjects(date);
    payload.rows=uniqueProjects(payload.rows);
    projectCache.set(key,{at:Date.now(),payload});
    return payload;
  }
  window.getUnifiedSupervisorProjects=getUnifiedSupervisorProjects;
  window.getUnifiedSupervisorProjectsV10848=getUnifiedSupervisorProjects;

  async function loadWorkersAndAssignments(date,projects,force,requestId){
    let workers=[];
    try{
      if(typeof window.getUnifiedSupervisorWorkersV10713==='function'){
        const result=await window.getUnifiedSupervisorWorkersV10713(date,force);workers=A(result?.workers);
      }else workers=A(window.data?.workers);
    }catch(e){console.warn(BUILD,'workers load',e);workers=A(window.data?.workers);}
    if(requestId!==applyRequestId)return null;
    const ids=projects.map(p=>S(p.id)).filter(Boolean);
    let assignments=[];
    if(ids.length&&window.sb){
      try{const r=await sb.from('worker_project_assignments').select('*').in('project_id',ids).eq('is_active',true).limit(10000);if(!r.error)assignments=r.data||[];}catch(e){console.warn(BUILD,'assignments load',e);}
    }
    return {workers,assignments};
  }
  function diagnostics(payload,projects,date){
    const id=identity(),sources=payload?.sources||{};
    console.table({
      authUserId:payload?.identity?.authUserId||id.authUserId,
      employeeId:payload?.identity?.employeeId||id.employeeId,
      resolvedSupervisorId:payload?.identity?.resolvedSupervisorId||payload?.user_id||id.authUserId,
      supervisorName:payload?.identity?.supervisorName||id.supervisorName,
      selectedDate:date,
      selectedMonth:date.slice(0,7)
    });
    console.table({
      projectsFromDirectSupervisorField:Number(sources.projectsFromDirectSupervisorField||0),
      projectsFromMonthlyDistribution:Number(sources.projectsFromMonthlyDistribution||0),
      projectsFromAssignmentHeader:Number(sources.projectsFromAssignmentHeader||0),
      projectsFromWorkerAssignments:0,
      finalSupervisorProjects:projects.length
    });
    console.table({
      supervisorId:payload?.user_id||id.authUserId,
      adminDistributionProjectsCount:Number(payload?.adminDistributionProjectsCount??projects.length),
      supervisorPageProjectsCount:projects.length,
      missingInSupervisorPage:A(payload?.missingInSupervisorPage),
      extraInSupervisorPage:A(payload?.extraInSupervisorPage)
    });
    if(A(payload?.comparison).length)console.table(payload.comparison);
    window.__tasneefSupervisorProjectsDiagnosticV10848={payload,projects,date,identity:id};
  }
  async function apply(force=false){
    if(!isSupervisor()||!window.sb)return;
    const requestId=++applyRequestId;
    const date=selectedDate();
    loadingSelects();
    try{
      const payload=await getUnifiedSupervisorProjects(identity().authUserId,date,force);
      if(requestId!==applyRequestId)return;
      const projects=uniqueProjects(payload.rows);
      const d=window.data=window.data||{};
      d.projects=projects;
      const projectIds=new Set(projects.map(p=>S(p.id)));
      window.__tasneefSupervisorProjectIdsV371=projectIds;
      window.__tasneefSupervisorProjectIdsV10816=projectIds;
      window.__tasneefSupervisorProjectIdsV10846=projectIds;
      window.__tasneefSupervisorProjectIdsV10847=projectIds;
      window.__tasneefSupervisorProjectIdsV10848=projectIds;
      refill(projects);
      stateMessage(projects.length?`تم تحميل ${projects.length} مشاريع مرتبطة بالمشرف`:'لا توجد مشاريع مرتبطة بالمشرف في التاريخ المحدد',projects.length?'success':'info');
      diagnostics(payload,projects,date);
      const workerCtx=await loadWorkersAndAssignments(date,projects,force,requestId);
      if(requestId!==applyRequestId||!workerCtx)return;
      d.workers=workerCtx.workers;
      d.workerAssignments=workerCtx.assignments;
      const title=$('supTitle');const id=identity();if(title)title.textContent='لوحة المشرف - '+(id.supervisorName||'');
      try{window.renderTimeLogs?.();}catch(e){console.warn(BUILD,e);}
      try{window.renderTickets?.();}catch(e){console.warn(BUILD,e);}
      try{if($('supAttendance')?.classList.contains('active'))window.renderSupervisorAttendanceList?.();}catch(e){console.warn(BUILD,e);}
    }catch(e){
      if(requestId!==applyRequestId)return;
      console.error(BUILD,e);
      const current=A(window.data?.projects);
      if(current.length)refill(current);else selectConfigs.forEach(([id,label])=>{const el=$(id);if(el){el.disabled=false;el.innerHTML=`<option value="">${esc(label)}</option>`;}});
      stateMessage('تعذر تحميل مشاريع المشرف: '+S(e?.message||e),'error');
    }
  }
  function invalidateAndRefresh(detail){
    const id=identity();
    if(detail){
      const targetId=S(detail.supervisorId),targetCode=S(detail.supervisorCode);
      if(targetId&&targetId!==id.authUserId&&targetCode&&targetCode!==id.employeeCode)return;
    }
    projectCache.clear();apply(true);
  }
  window.refreshSupervisorProjectsV10816=()=>{projectCache.clear();return apply(true);};
  window.refreshSupervisorProjectsV10845=window.refreshSupervisorProjectsV10816;
  window.refreshSupervisorProjectsV10846=window.refreshSupervisorProjectsV10816;
  window.refreshSupervisorProjectsV10847=window.refreshSupervisorProjectsV10816;
  window.refreshSupervisorProjectsV10848=window.refreshSupervisorProjectsV10816;

  const previousInit=window.initSupervisor;
  window.initSupervisor=async function(){if(typeof previousInit==='function')await previousInit.apply(this,arguments);projectCache.clear();await apply(true);};
  try{initSupervisor=window.initSupervisor;}catch(_){ }
  const previousLoadAll=window.loadAll;
  if(typeof previousLoadAll==='function')window.loadAll=async function(){const result=await previousLoadAll.apply(this,arguments);if(isSupervisor()){projectCache.clear();await apply(true);}return result;};
  try{loadAll=window.loadAll;}catch(_){ }
  const previousLogout=window.logout;
  if(typeof previousLogout==='function')window.logout=async function(){projectCache.clear();try{realtimeChannel&&sb.removeChannel(realtimeChannel);}catch(_){ }return previousLogout.apply(this,arguments);};

  window.addEventListener('tasneef:distribution-updated',e=>invalidateAndRefresh(e.detail||{}));
  window.addEventListener('storage',e=>{if(e.key!=='tasneef_distribution_changed_v10848'||!e.newValue)return;try{invalidateAndRefresh(JSON.parse(e.newValue));}catch(_){invalidateAndRefresh();}});
  try{
    const bc=new BroadcastChannel('tasneef-supervisor-projects-v10848');
    bc.onmessage=e=>invalidateAndRefresh(e.data||{});
    window.__tasneefSupervisorProjectsBroadcastV10848=bc;
  }catch(_){ }
  function setupRealtime(){
    if(!window.sb||typeof sb.channel!=='function'||realtimeChannel)return;
    try{
      realtimeChannel=sb.channel('supervisor-projects-v10848-'+(identity().authUserId||Date.now()))
        .on('postgres_changes',{event:'*',schema:'public',table:'supervisor_project_assignments'},()=>invalidateAndRefresh())
        .on('postgres_changes',{event:'*',schema:'public',table:'monthly_distribution'},()=>invalidateAndRefresh())
        .subscribe();
    }catch(e){console.warn(BUILD,'realtime unavailable',e);}
  }
  ['logDate','attendanceDate','summaryDate'].forEach(id=>document.addEventListener('change',e=>{if(e.target?.id===id){projectCache.clear();apply(true);}}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isSupervisor()){projectCache.clear();apply(true);}});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(isSupervisor())apply(true);setupRealtime();},500));
  window.addEventListener('load',()=>{setTimeout(()=>{if(isSupervisor())apply(true);setupRealtime();},850);});
  setInterval(()=>{if(!document.hidden&&isSupervisor())apply(false);},30000);
  console.info(BUILD,'loaded');
})();
