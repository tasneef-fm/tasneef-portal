/* ===== TASNEEF V10846 - Supervisor projects authoritative union ===== */
(function(){
  'use strict';
  if(window.__tasneefSupervisorProjectsCompleteV10846) return;
  window.__tasneefSupervisorProjectsCompleteV10846 = true;
  window.__tasneefSupervisorProjectsCompleteV10816 = true;

  const BUILD='V10846_SUPERVISOR_PROJECTS_AUTHORITATIVE_UNION';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const arabicDigits={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  const norm=v=>S(v).toLowerCase()
    .replace(/[٠-٩]/g,d=>arabicDigits[d]||d)
    .replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه')
    .replace(/ء/g,'').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'')
    .replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
  const compact=v=>norm(v).replace(/\s+/g,'');
  const inactiveWords=new Set(['false','0','inactive','disabled','stopped','ended','deleted','archived','موقوف','متوقف','منتهي','محذوف','مؤرشف','غير نشط']);
  const falseLike=v=>inactiveWords.has(norm(v));
  const activeRow=r=>!!r && !falseLike(r.is_active) && !falseLike(r.active) && !falseLike(r.status||r.state);
  const currentMonth=()=>{
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);}
    catch(_){return new Date().toISOString().slice(0,7);}
  };
  const previousMonth=m=>{const [y,mo]=m.split('-').map(Number); const d=new Date(y,mo-2,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
  function user(){
    try{ if(typeof session==='function'){const u=session(); if(u) return u;} }catch(_){}
    for(const key of ['tasneef_user','tasneefUser','current_user']){
      try{const u=JSON.parse(localStorage.getItem(key)||'null'); if(u) return u;}catch(_){}
    }
    return {};
  }
  function sessionToken(){
    for(const key of ['tasneef_session_token_v10817','tasneef_permission_session_v10817','tasneef_session_token','tasneefPermissionSession']){
      const value=S(localStorage.getItem(key)); if(value) return value;
    }
    return '';
  }
  function isSupervisor(){
    const u=user();
    return ['supervisor','مشرف'].includes(norm(u.role_key||u.role||u.user_role));
  }
  function identity(u){
    const ids=new Set([u.id,u.user_id,u.uid,u.app_user_id].map(S).filter(Boolean));
    const codes=new Set([u.employee_id,u.worker_id,u.employee_code,u.employee_number,u.worker_employee_code,u.supervisor_employee_code,u.code,u.user_code,u.username].map(S).filter(Boolean));
    const normCodes=new Set([...codes].map(norm).filter(Boolean));
    const names=new Set([u.full_name,u.name,u.display_name,u.username].map(norm).filter(Boolean));
    return {ids,codes,normCodes,names,name:S(u.full_name||u.name||u.display_name||u.username),id:S(u.id||u.user_id||u.uid||u.app_user_id)};
  }
  function nameMatch(value,names){
    const n=norm(value); if(!n) return false;
    if(names.has(n)) return true;
    for(const x of names){
      if(!x) continue;
      if(compact(x)===compact(n)) return true;
      const xt=x.split(' '), nt=n.split(' ');
      if(xt.length===1 && xt[0].length>=3 && nt[0]===xt[0]) return true;
      if(nt.length===1 && nt[0].length>=3 && xt[0]===nt[0]) return true;
    }
    return false;
  }
  function rowMatchesSupervisor(r,id){
    if(!r) return false;
    const rid=[r.supervisor_id,r.app_supervisor_id,r.current_supervisor_id,r.supervisor_user_id,r.manager_id,r.assigned_supervisor_id].map(S).filter(Boolean);
    if(rid.some(v=>id.ids.has(v)||id.normCodes.has(norm(v)))) return true;
    const rc=[r.supervisor_employee_code,r.supervisor_code,r.employee_code,r.manager_code,r.supervisor_username].map(S).filter(Boolean);
    if(rc.some(v=>id.codes.has(v)||id.normCodes.has(norm(v)))) return true;
    return [r.supervisor_name,r.manager_name,r.supervisor,r.assigned_supervisor_name].some(v=>nameMatch(v,id.names));
  }
  function projectIdOf(r){return S(r?.project_id||r?.projectId||r?.project_key||r?.assigned_project_id||r?.current_project_id);}
  function projectNameOf(r){return S(r?.project_name||r?.project||r?.project_title||r?.name_project||r?.projectName);}
  function workerIdOf(r){return S(r?.worker_id||r?.employee_id||r?.worker_user_id||r?.staff_id);}
  function workerMatchesSupervisor(w,id){
    if(rowMatchesSupervisor(w,id)) return true;
    const code=S(w?.supervisor_employee_code||w?.supervisor_code);
    const name=S(w?.supervisor_name||w?.manager_name);
    return (code&&(id.codes.has(code)||id.normCodes.has(norm(code)))) || nameMatch(name,id.names);
  }
  function workerProjectIds(w){
    const out=new Set();
    [w?.project_id,w?.assigned_project_id,w?.current_project_id,w?.projectId].forEach(v=>{if(S(v))out.add(S(v));});
    A(w?.project_ids||w?.projects||w?.assigned_projects).forEach(v=>{const x=S(v?.id??v?.project_id??v); if(x)out.add(x);});
    return out;
  }
  function workerProjectNames(w){
    const out=new Set();
    [w?.project_name,w?.assigned_project_name,w?.current_project_name].forEach(v=>{if(norm(v))out.add(norm(v));});
    A(w?.projects||w?.assigned_projects).forEach(v=>{const x=S(v?.name??v?.project_name??''); if(norm(x))out.add(norm(x));});
    return out;
  }
  async function safeQuery(label,promise){
    try{const r=await promise; if(r?.error){console.warn(BUILD,label,r.error.message); return [];} return r?.data||[];}
    catch(e){console.warn(BUILD,label,e?.message||e); return [];}
  }
  function missingRpc(error,name){
    const c=S(error?.code),m=S(error?.message||error).toLowerCase();
    return c==='PGRST202'||c==='42883'||(m.includes(name.toLowerCase())&&(m.includes('not find')||m.includes('does not exist')));
  }
  async function secureDistribution(month){
    try{
      const r=await sb.rpc('tasneef_get_supervisor_distribution_v10819',{p_month:month});
      if(r?.error){if(missingRpc(r.error,'tasneef_get_supervisor_distribution_v10819'))return null;throw r.error;}
      const payload=r?.data||{};
      if(payload?.ok===false)throw new Error(payload?.message||'تعذر تحميل توزيع المشرف');
      return Array.isArray(payload)?payload:A(payload?.rows);
    }catch(e){if(missingRpc(e,'tasneef_get_supervisor_distribution_v10819'))return null;console.warn(BUILD,'secure distribution',e);return [];}
  }
  async function secureDirectProjects(){
    const token=sessionToken();
    for(const rpcName of ['tasneef_get_supervisor_projects_v10846','tasneef_get_supervisor_projects_v10845']){
      try{
        const r=await sb.rpc(rpcName,{p_session_token:token||null});
        if(r?.error){if(missingRpc(r.error,rpcName))continue;throw r.error;}
        const payload=r?.data||{};
        if(payload?.ok===false)throw new Error(payload?.message||'تعذر تحميل المشاريع المسندة للمشرف');
        window.__tasneefSupervisorProjectDiagnosticV10846={
          rpc:rpcName,user_id:payload?.user_id||'',count:Number(payload?.count||0),sources:payload?.sources||{},identity:payload?.identity||{},unresolved:payload?.unresolved||[]
        };
        return Array.isArray(payload)?payload:A(payload?.rows);
      }catch(e){
        if(missingRpc(e,rpcName))continue;
        console.warn(BUILD,rpcName,e); return [];
      }
    }
    return null;
  }
  async function loadDistribution(month){
    const secure=await secureDistribution(month);
    if(secure!==null)return secure;
    return safeQuery('monthly_distribution '+month,sb.from('monthly_distribution').select('*').eq('month_key',month).limit(20000));
  }
  async function fetchBase(month){
    const [projects,workers,assignments,dist,directProjects]=await Promise.all([
      safeQuery('projects',sb.from('projects').select('*').order('name')),
      safeQuery('workers',sb.from('workers').select('*').order('name')),
      safeQuery('worker_project_assignments',sb.from('worker_project_assignments').select('*').eq('is_active',true).order('id')),
      loadDistribution(month),
      secureDirectProjects()
    ]);
    return {projects,workers,assignments,dist,directProjects:directProjects===null?[]:directProjects};
  }
  function uniqueProjects(rows){
    const map=new Map();
    A(rows).forEach(p=>{
      if(!p) return;
      const k=S(p.id)||('name:'+norm(p.name));
      if(!k) return;
      if(!map.has(k)) map.set(k,p);
      else map.set(k,Object.assign({},map.get(k),p));
    });
    return [...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
  }
  function projectMatchesAlias(p,pids,pnames){
    if(pids.has(S(p.id))) return true;
    const n=norm(p.name), c=compact(p.name);
    if(pnames.has(n)||pnames.has(c)) return true;
    for(const alias of pnames){
      const a=norm(alias), ac=compact(alias);
      if(!a) continue;
      if(a===n||ac===c) return true;
    }
    return false;
  }
  function setSelect(id,projects,allLabel){
    const el=$(id); if(!el) return;
    const old=S(el.value);
    const esc=v=>S(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    el.innerHTML=(allLabel!==null?`<option value="">${esc(allLabel||'اختر المشروع')}</option>`:'')+
      projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'-')}</option>`).join('');
    if([...el.options].some(o=>S(o.value)===old)) el.value=old;
  }
  function refill(projects){
    setSelect('logProject',projects,'اختر المشروع');
    setSelect('attendanceProject',projects,'كل مشاريع المشرف');
    setSelect('ticketProject',projects,'اختر المشروع');
    setSelect('supTicketFilterProject',projects,'كل المشاريع');
    setSelect('supOrderProjectV10061',projects,'اختر المشروع');
    setSelect('supOrderFilterProjectV10061',projects,'كل المشاريع');
    setSelect('supInventoryRequestProject',projects,'اختر المشروع');
    setSelect('supClientReportProject',projects,'اختر المشروع');
  }
  let cache=null,cacheAt=0,running=null;
  async function buildContext(force=false){
    if(!isSupervisor()||!window.sb) return null;
    if(!force&&cache&&Date.now()-cacheAt<15000) return cache;
    if(running&&!force) return running;
    running=(async()=>{
      const u=user(),id=identity(u),month=currentMonth();
      const base=await fetchBase(month);
      let matchedDist=A(base.dist).filter(r=>activeRow(r)&&rowMatchesSupervisor(r,id));
      if(!matchedDist.length){
        const prev=await loadDistribution(previousMonth(month));
        matchedDist=A(prev).filter(r=>activeRow(r)&&rowMatchesSupervisor(r,id));
      }
      const pids=new Set(),pnames=new Set();
      A(base.projects).filter(p=>activeRow(p)&&rowMatchesSupervisor(p,id)).forEach(p=>{if(S(p.id))pids.add(S(p.id));if(norm(p.name)){pnames.add(norm(p.name));pnames.add(compact(p.name));}});
      A(base.directProjects).forEach(p=>{if(!p||!activeRow(p))return;if(S(p.id))pids.add(S(p.id));if(norm(p.name)){pnames.add(norm(p.name));pnames.add(compact(p.name));}});
      matchedDist.forEach(r=>{const pid=projectIdOf(r),pn=projectNameOf(r);if(pid)pids.add(pid);if(norm(pn)){pnames.add(norm(pn));pnames.add(compact(pn));}});

      const supWorkers=A(base.workers).filter(w=>activeRow(w)&&workerMatchesSupervisor(w,id));
      const supWorkerIds=new Set(supWorkers.map(w=>S(w.id)).filter(Boolean));
      supWorkers.forEach(w=>{
        workerProjectIds(w).forEach(pid=>pids.add(pid));
        workerProjectNames(w).forEach(pn=>{pnames.add(pn);pnames.add(compact(pn));});
      });
      A(base.assignments).filter(a=>activeRow(a)&&supWorkerIds.has(workerIdOf(a))).forEach(a=>{
        const pid=projectIdOf(a),pn=projectNameOf(a);if(pid)pids.add(pid);if(norm(pn)){pnames.add(norm(pn));pnames.add(compact(pn));}
      });

      const allProjectRows=uniqueProjects([...A(base.directProjects),...A(base.projects)]);
      let projects=uniqueProjects(allProjectRows.filter(p=>activeRow(p)&&projectMatchesAlias(p,pids,pnames)));
      projects=projects.map(p=>Object.assign({},p,{
        __original_supervisor_id:p.supervisor_id,
        supervisor_id:Number(id.id)||id.id||p.supervisor_id,
        app_supervisor_id:Number(id.id)||id.id||p.app_supervisor_id,
        current_supervisor_id:Number(id.id)||id.id||p.current_supervisor_id,
        supervisor_name:id.name||p.supervisor_name
      }));
      const finalIds=new Set(projects.map(p=>S(p.id)));
      const finalNames=new Set(projects.map(p=>norm(p.name)).filter(Boolean));
      const relevantAssignments=A(base.assignments).filter(a=>activeRow(a)&&(finalIds.has(projectIdOf(a))||finalNames.has(norm(projectNameOf(a)))));
      const assignmentWorkerIds=new Set(relevantAssignments.map(workerIdOf).filter(Boolean));
      const workers=A(base.workers).filter(w=>activeRow(w)&&(
        workerMatchesSupervisor(w,id)||assignmentWorkerIds.has(S(w.id))||[...workerProjectIds(w)].some(pid=>finalIds.has(pid))||[...workerProjectNames(w)].some(pn=>finalNames.has(pn))
      ));
      cache={u,id,month,projects,workers,assignments:relevantAssignments,projectIds:finalIds,dist:matchedDist};
      cacheAt=Date.now();
      return cache;
    })();
    try{return await running;}finally{running=null;}
  }
  async function apply(force=false){
    const ctx=await buildContext(force); if(!ctx) return;
    const d=window.data=window.data||{};
    d.projects=ctx.projects;
    d.workers=ctx.workers;
    d.workerAssignments=ctx.assignments;
    window.__tasneefSupervisorProjectIdsV371=new Set(ctx.projectIds);
    window.__tasneefSupervisorProjectIdsV10816=new Set(ctx.projectIds);
    window.__tasneefSupervisorProjectIdsV10846=new Set(ctx.projectIds);
    refill(ctx.projects);
    const title=$('supTitle'); if(title) title.textContent='لوحة المشرف - '+(ctx.id.name||ctx.u.username||'');
    const help=document.querySelector('#supLogs .help,#supLogs .footer-note');
    if(help) help.dataset.projectCount=String(ctx.projects.length);
    try{if(typeof renderTimeLogs==='function')renderTimeLogs();}catch(e){console.warn(BUILD,e);}
    try{if(typeof renderTickets==='function')renderTickets();}catch(e){console.warn(BUILD,e);}
    try{if(typeof renderSupervisorAttendanceList==='function'&&document.getElementById('supAttendance')?.classList.contains('active'))renderSupervisorAttendanceList();}catch(e){console.warn(BUILD,e);}
    console.log(BUILD,{projects:ctx.projects.length,workers:ctx.workers.length,month:ctx.month,direct_rpc:window.__tasneefSupervisorProjectDiagnosticV10846||null,project_ids:[...ctx.projectIds],project_names:ctx.projects.map(p=>p.name)});
  }

  const previousInit=window.initSupervisor;
  window.initSupervisor=async function(){
    if(typeof previousInit==='function') await previousInit.apply(this,arguments);
    cache=null;cacheAt=0;
    await apply(true);
  };
  try{initSupervisor=window.initSupervisor;}catch(_){}

  const previousLoadAll=window.loadAll;
  if(typeof previousLoadAll==='function') window.loadAll=async function(){
    const r=await previousLoadAll.apply(this,arguments);
    if(isSupervisor()){cache=null;cacheAt=0;await apply(true);}
    return r;
  };
  try{loadAll=window.loadAll;}catch(_){}

  window.refreshSupervisorProjectsV10816=()=>{cache=null;cacheAt=0;return apply(true);};
  window.refreshSupervisorProjectsV10845=window.refreshSupervisorProjectsV10816;
  window.refreshSupervisorProjectsV10846=window.refreshSupervisorProjectsV10816;
  function boot(){if(isSupervisor()){cache=null;cacheAt=0;apply(true);}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,450));
  window.addEventListener('load',()=>{setTimeout(boot,700);setTimeout(boot,1700);setTimeout(boot,3500);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isSupervisor())boot();});
  setTimeout(boot,5200);
  console.log('Tasneef '+BUILD+' loaded');
})();
