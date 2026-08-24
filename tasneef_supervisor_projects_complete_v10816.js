/* ===== TASNEEF V10849 - Unified System 4 visible single authoritative supervisor project load ===== */
(function(){
  'use strict';
  if(window.__tasneefSupervisorProjectsUnified4V10849) return;
  window.__tasneefSupervisorProjectsUnified4V10849=true;

  const BUILD='V10849_UNIFIED4_VISIBLE_PROJECT_FIELD';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).toLowerCase()
    .replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه')
    .replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
  const ended=new Set(['ended','inactive','cancelled','deleted','stopped','disabled','archived','منتهي','موقوف','ملغي','محذوف','متوقف','مؤرشف']);
  const activeDistribution=r=>!!r && r.is_active!==false && r.active!==false && !ended.has(norm(r.status||r.state));
  const activeProject=p=>!!p && p.is_active!==false && p.active!==false && !ended.has(norm(p.status||p.state));
  const projectIdOf=r=>S(r?.project_id||r?.project_key||r?.app_project_id||r?.id);
  const projectNameOf=r=>S(r?.project_name||r?.project||r?.project_title||r?.name_project||r?.name);
  const currentDate=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){return new Date().toISOString().slice(0,10);}};
  function currentUser(){
    try{if(typeof session==='function'){const u=session();if(u)return u;}}catch(_){}
    try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}
  }
  function isSupervisor(){return norm(currentUser().role)==='supervisor';}
  function esc(v){return S(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function setSelect(id,rows,label){
    const el=$(id); if(!el)return;
    const old=S(el.value);
    el.innerHTML=`<option value="">${esc(label)}</option>`+rows.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.project_name||p.id)}</option>`).join('');
    if([...el.options].some(o=>S(o.value)===old))el.value=old;
  }
  function refill(projects){
    const empty=!A(projects).length;
    setSelect('logProject',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'اختر المشروع');
    setSelect('attendanceProject',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'كل مشاريع المشرف');
    setSelect('ticketProject',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'اختر المشروع');
    setSelect('supTicketFilterProject',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'كل المشاريع');
    setSelect('supOrderProjectV10061',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'اختر المشروع');
    setSelect('supOrderFilterProjectV10061',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'كل المشاريع');
    setSelect('supInventoryRequestProject',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'اختر المشروع');
    setSelect('supClientReportProject',projects,empty?'لا توجد مشاريع مرتبطة بك في توزيع الشهر الحالي':'اختر المشروع');
  }
  function uniqueProjects(rows){
    const map=new Map();
    A(rows).forEach(p=>{const id=S(p.id);if(id&&!map.has(id))map.set(id,p);});
    return [...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
  }
  function mergeWorkerProject(worker,assignments){
    const code=norm(worker?.employee_code||worker?.worker_employee_code||worker?.code);
    const wid=S(worker?.id||worker?.worker_id||worker?.canonical_employee_id);
    const name=norm(worker?.name||worker?.worker_name||worker?.full_name);
    const rows=A(assignments).filter(r=>{
      const rc=norm(r?.worker_employee_code||r?.employee_code||r?.worker_code||r?.code);
      const rid=S(r?.worker_id||r?.canonical_employee_id||r?.employee_id);
      const rn=norm(r?.worker_name||r?.employee_name||r?.name);
      return (code&&rc===code)||(wid&&rid===wid)||(name&&rn===name);
    });
    const projects=[];
    rows.forEach(r=>{const id=projectIdOf(r),nm=projectNameOf(r);if(id&&!projects.some(p=>S(p.id)===id))projects.push({id,name:nm||id});});
    return projects;
  }

  let applying=false,cache=null,cacheAt=0,requestSeq=0,lastAppliedSeq=0;
  async function buildContext(force=false){
    if(!isSupervisor()||!window.sb)return null;
    if(!force&&cache&&Date.now()-cacheAt<20000)return cache;
    if(typeof window.getUnifiedSupervisorWorkersV10713!=='function')throw new Error('تعذر الوصول إلى مصدر النظام الموحد 4');

    const u=currentUser();
    const date=S($('attendanceDate')?.value||$('logDate')?.value||currentDate());
    const unified=await window.getUnifiedSupervisorWorkersV10713(date,force);
    const assignments=A(unified?.assignments).filter(activeDistribution);
    const distributionIds=new Set(assignments.map(projectIdOf).filter(Boolean));

    const pr=await window.sb.from('projects').select('*').order('id').limit(10000);
    if(pr.error)throw pr.error;
    const allProjects=A(pr.data);
    const projectById=new Map(allProjects.map(p=>[S(p.id),p]));
    const normToken=v=>norm(v);
    const idTokens=new Set([u.id,u.user_id,u.supervisor_id,u.employee_id,unified?.identity?.sid,unified?.identity?.employeeId,unified?.identity?.authUserId].map(S).filter(Boolean));
    const codeTokens=new Set([u.employee_code,u.employee_number,u.code,unified?.identity?.code].map(normToken).filter(Boolean));
    const nameTokens=new Set([u.full_name,u.name,u.username,unified?.identity?.name].map(normToken).filter(Boolean));
    const allowedIds=new Set(A(u.allowed_project_ids||u.project_ids||u.projects).map(v=>S(v?.id??v)).filter(Boolean));
    function directLinkState(p){
      const ids=[p?.supervisor_id,p?.app_supervisor_id,p?.current_supervisor_id,p?.supervisor_user_id,p?.manager_id].map(S).filter(Boolean);
      const codes=[p?.supervisor_employee_code,p?.supervisor_code].map(normToken).filter(Boolean);
      const names=[p?.supervisor_name,p?.manager_name].map(normToken).filter(Boolean);
      return {has:!!(ids.length||codes.length||names.length),match:ids.some(v=>idTokens.has(v))||codes.some(v=>codeTokens.has(v))||names.some(v=>nameTokens.has(v))};
    }
    const projects=[];
    allProjects.forEach(master=>{
      if(!activeProject(master))return;
      const direct=directLinkState(master);
      const pid=S(master.id);
      if(!allowedIds.has(pid) && (direct.has?!direct.match:!distributionIds.has(pid)))return;
      projects.push(Object.assign({},master,{
        id:pid,name:S(master.name||master.project_name||pid),
        __unified4_link:distributionIds.has(pid),__direct_supervisor_link_v10866:direct.match
      }));
    });
    // مشروع قديم موجود في التوزيع وليس له سجل master كامل يبقى ظاهرًا بدل أن يختفي.
    distributionIds.forEach(pid=>{
      if(projectById.has(pid)||projects.some(p=>S(p.id)===pid))return;
      const dist=assignments.find(r=>projectIdOf(r)===pid)||{};
      projects.push({id:pid,name:projectNameOf(dist)||pid,is_active:true,active:true,status:'active',supervisor_id:Number(u.id)||u.id,supervisor_name:S(unified?.identity?.name||u.full_name||u.name||u.username),__unified4_link:true});
    });
    const finalProjects=uniqueProjects(projects);
    const finalIds=new Set(finalProjects.map(p=>S(p.id)));
    const projectIds=finalIds;

    const workers=A(unified?.workers).map(w=>{
      const wProjects=A(w?.projects).length?A(w.projects):mergeWorkerProject(w,assignments);
      const first=wProjects.find(p=>finalIds.has(S(p.id)))||wProjects[0]||{};
      return Object.assign({},w,{
        project_id:S(w?.project_id||first.id),
        projects:wProjects.filter(p=>finalIds.has(S(p.id))),
        supervisor_id:Number(u.id)||u.id||w?.supervisor_id,
        app_supervisor_id:Number(u.id)||u.id||w?.app_supervisor_id,
        supervisor_name:S(unified?.identity?.name||u.full_name||u.name||u.username),
        is_active:w?.is_active!==false,
        __unified4_link:true
      });
    });

    cache={u,date,month:date.slice(0,7),identity:unified?.identity||{},assignments,projects:finalProjects,projectIds:finalIds,workers};
    cacheAt=Date.now();
    return cache;
  }

  async function apply(force=true){
    const seq=++requestSeq;
    if(applying){
      // لا نعرض نتيجة موازية أو قديمة؛ آخر طلب فقط هو المسموح له بتحديث الواجهة.
      while(applying) await new Promise(r=>setTimeout(r,25));
      if(seq<requestSeq) return cache;
    }
    applying=true;
    try{
      const ctx=await buildContext(force); if(!ctx||seq<requestSeq)return cache;
      lastAppliedSeq=seq;
      // يعلن النطاق قبل تشغيل أي حارس قديم، حتى لا يقوم بحذف البيانات الصحيحة من الذاكرة.
      window.__tasneefUnified4SupervisorProjectIdsV10847=new Set(ctx.projectIds);
      window.__tasneefUnified4SupervisorProjectIdsV10848=new Set(ctx.projectIds);
      window.__tasneefUnified4SupervisorScopeReadyV10847=true;
      window.__tasneefUnified4SupervisorScopeReadyV10848=true;
      window.__tasneefSupervisorProjectIdsV371=new Set(ctx.projectIds);
      window.__tasneefSupervisorProjectIdsV10816=new Set(ctx.projectIds);

      const d=window.data=window.data||{};
      d.projects=ctx.projects;
      d.workers=ctx.workers;
      d.workerAssignments=ctx.assignments;
      const pid=r=>S(r?.project_id||r?.project||r?.projectId);
      ['logs','attendance','tickets','inventoryRequests','contractServices','clientReports'].forEach(key=>{
        if(Array.isArray(d[key]))d[key]=d[key].filter(r=>ctx.projectIds.has(pid(r)));
      });
      refill(ctx.projects);
      const title=$('supTitle');if(title)title.textContent='لوحة المشرف - '+S(ctx.identity?.name||ctx.u.full_name||ctx.u.name||ctx.u.username);
      try{if(typeof renderSupervisorAttendanceList==='function')await renderSupervisorAttendanceList();}catch(e){console.warn(BUILD,'attendance render',e);}
      try{if(typeof renderTimeLogs==='function')renderTimeLogs();}catch(e){console.warn(BUILD,'logs render',e);}
      try{if(typeof renderTickets==='function')renderTickets();}catch(e){console.warn(BUILD,'tickets render',e);}
      window.__tasneefUnified4SupervisorScopeV10848={
        source:'monthly_distribution',month:ctx.month,projectCount:ctx.projects.length,workerCount:ctx.workers.length,
        projectIds:[...ctx.projectIds],supervisorId:S(ctx.identity?.sid||ctx.u.id),supervisorCode:S(ctx.identity?.code),
        supervisorName:S(ctx.identity?.name||ctx.u.full_name),matchStrategy:S(ctx.identity?.matchStrategy),at:new Date().toISOString()
      };
      window.__tasneefUnified4SupervisorScopeV10847=window.__tasneefUnified4SupervisorScopeV10848;
      console.table(window.__tasneefUnified4SupervisorScopeV10848);
      return ctx;
    }finally{applying=false;}
  }

  const projectSelectIds=['logProject','attendanceProject','ticketProject','supTicketFilterProject','supOrderProjectV10061','supOrderFilterProjectV10061','supInventoryRequestProject','supClientReportProject'];
  function lockProjectSelects(){
    // V10849: لا نخفي خانة المشروع أبدًا. تبقى ظاهرة مع حالة تحميل واضحة.
    projectSelectIds.forEach(id=>{
      const el=$(id);if(!el)return;
      el.disabled=true;
      el.style.visibility='visible';
      el.style.display='';
      el.setAttribute('aria-busy','true');
    });
  }
  function unlockProjectSelects(){
    projectSelectIds.forEach(id=>{
      const el=$(id);if(!el)return;
      el.disabled=false;
      el.style.visibility='visible';
      el.style.display='';
      el.removeAttribute('aria-busy');
    });
  }
  function loadingPlaceholder(){
    projectSelectIds.forEach(id=>{
      const el=$(id);if(!el)return;
      el.style.visibility='visible';
      el.style.display='';
      el.innerHTML='<option value="">جاري تحميل مشاريع النظام الموحد 4…</option>';
    });
  }
  function errorPlaceholder(error){
    const text=S(error?.message||error||'تعذر تحميل المشاريع');
    projectSelectIds.forEach(id=>{
      const el=$(id);if(!el)return;
      el.style.visibility='visible';
      el.style.display='';
      el.innerHTML='<option value="">تعذر تحميل المشاريع — حدّث الصفحة</option>';
      el.title=text;
    });
  }

  const previousInit=window.initSupervisor;
  window.initSupervisor=async function(){
    lockProjectSelects();
    loadingPlaceholder();
    delete window.__tasneefUnified4SupervisorProjectIdsV10847;
    delete window.__tasneefUnified4SupervisorProjectIdsV10848;
    window.__tasneefUnified4SupervisorScopeReadyV10847=false;
    window.__tasneefUnified4SupervisorScopeReadyV10848=false;
    try{
      // أي خطأ في تهيئة قسم آخر لا يمنع محاولة تحميل المشاريع من المصدر الموحد المستقل.
      try{
        if(typeof previousInit==='function')await previousInit.apply(this,arguments);
      }catch(baseError){
        console.warn(BUILD,'base supervisor init failed; continuing with unified project source',baseError);
      }
      try{
        return await apply(true);
      }catch(error){
        console.error(BUILD,'unified project load failed',error);
        errorPlaceholder(error);
        return null;
      }
    }finally{
      unlockProjectSelects();
    }
  };
  try{initSupervisor=window.initSupervisor;}catch(_){}

  const previousRefresh=window.refreshAll;
  if(typeof previousRefresh==='function')window.refreshAll=async function(){
    if(!isSupervisor())return previousRefresh.apply(this,arguments);
    lockProjectSelects();
    try{
      const r=await previousRefresh.apply(this,arguments);
      await apply(true);
      return r;
    }catch(error){
      console.error(BUILD,'refresh failed',error);
      errorPlaceholder(error);
      return null;
    }finally{unlockProjectSelects();}
  };

  window.refreshSupervisorProjectsV10816=()=>apply(true);
  window.refreshSupervisorProjectsUnified4V10847=()=>apply(true);
  window.refreshSupervisorProjectsUnified4V10848=()=>apply(true);
  window.refreshSupervisorProjectsUnified4V10849=()=>apply(true);
  // V10849: المصدر القديم متوقف، والقائمة تبقى ظاهرة دائمًا أثناء تحميل المصدر الموحد الوحيد.
  console.log('Tasneef '+BUILD+' loaded');
})();
