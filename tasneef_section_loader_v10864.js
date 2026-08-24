/* TASNEEF V10864 — Section-by-section data loading
   هدف النسخة:
   - لا يتم تحميل كل جداول النظام عند فتح الصفحة.
   - كل قسم يحمل البيانات التي يحتاجها عند فتحه فقط.
   - القسم المفتوح فقط يتحدث تلقائياً كل 60 ثانية.
   - أي loadAll/refreshAll قديم يتحول لتحديث القسم الحالي بدل عاصفة تحميل كاملة.
   - عند فشل السيرفر لا يتم مسح البيانات الموجودة في الذاكرة.
*/
(function(){
  'use strict';
  if(window.__tasneefSectionLoaderV10864) return;
  window.__tasneefSectionLoaderV10864=true;
  const BUILD='V10864_SECTION_LAZY_DATA';
  const REFRESH_MS=60000;
  const FRESH_MS=45000;
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const sleepFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  const state={promises:new Map(),last:new Map(),activeKey:'',timer:null,lastError:null};
  const legacyFullLoad=typeof window.loadAll==='function'?window.loadAll:null;
  const legacyRefreshAll=typeof window.refreshAll==='function'?window.refreshAll:null;
  window.tasneefFullLoadV10864=legacyFullLoad;

  function dset(){
    window.data=window.data||{};
    return window.data;
  }
  function user(){
    try{ if(typeof window.session==='function') return window.session()||{}; }catch(_){ }
    try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}
  }
  function today(){
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function monthNow(){return today().slice(0,7);}
  function monthRange(month){
    month=/^\d{4}-\d{2}$/.test(S(month))?S(month):monthNow();
    const [y,m]=month.split('-').map(Number);
    const next=new Date(y,m,1);
    const end=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-01';
    return {from:month+'-01',toExclusive:end,month};
  }
  function addDays(ds,n){
    const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+Number(n||0));
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function sectionFresh(key){return Date.now()-Number(state.last.get(key)||0)<FRESH_MS;}
  function normalizeId(v){return S(v);}
  function mergeRows(...sets){
    const map=new Map();
    sets.flat().forEach((r,i)=>{
      if(!r) return;
      const k=r.id!=null?'id:'+S(r.id):['row',r.log_date||r.attendance_date||r.created_at||'',r.project_id||'',r.worker_id||'',r.supervisor_id||'',i].join('|');
      map.set(k,Object.assign({},map.get(k)||{},r));
    });
    return [...map.values()];
  }
  function markBaseUsers(){
    const d=dset();
    d.supervisors=A(d.users).filter(x=>S(x.role)==='supervisor'&&x.is_active!==false);
    d.technicians=A(d.users).filter(x=>S(x.role)==='technician'&&x.is_active!==false);
  }
  async function paged(table, configure, maxRows=30000, pageSize=1000){
    if(!window.sb?.from) throw new Error('قاعدة البيانات غير جاهزة');
    const out=[];
    for(let from=0;from<maxRows;from+=pageSize){
      let q=window.sb.from(table).select('*');
      if(typeof configure==='function') q=configure(q)||q;
      q=q.range(from,Math.min(from+pageSize-1,maxRows-1));
      const r=await q;
      if(r?.error) throw r.error;
      const rows=A(r?.data); out.push(...rows);
      if(rows.length<pageSize) break;
    }
    return out;
  }
  async function setFromQuery(key, loader, transform){
    const rows=await loader();
    const d=dset();
    d[key]=typeof transform==='function'?transform(rows):rows;
    if(key==='users') markBaseUsers();
    return d[key];
  }
  async function singleFlight(key, task, force=false){
    if(!force&&sectionFresh(key)) return;
    if(state.promises.has(key)) return state.promises.get(key);
    const p=(async()=>{
      try{
        const out=await task();
        state.last.set(key,Date.now());
        state.lastError=null;
        return out;
      }catch(e){
        state.lastError=e;
        console.warn(BUILD,key,e?.message||e);
        throw e;
      }finally{state.promises.delete(key);}
    })();
    state.promises.set(key,p);
    return p;
  }

  function activeProjectV10866(p){
    if(!p||p.is_active===false||p.active===false)return false;
    const st=S(p.status||p.project_status||p.state).toLowerCase();
    return !['inactive','stopped','ended','closed','cancelled','deleted','archived','disabled','موقوف','متوقف','منتهي','ملغي','محذوف','مؤرشف','غير نشط'].includes(st);
  }
  async function loadUsers(force=false){
    return singleFlight('data:users',()=>setFromQuery('users',()=>paged('app_users',q=>q.order('id',{ascending:true}),8000)),force);
  }
  async function loadProjects(force=false){
    // V10866: لا نعتمد is_active=true وحدها لأن بعض المشاريع القديمة النشطة تكون القيمة فيها null.
    return singleFlight('data:projects',()=>setFromQuery('projects',()=>paged('projects',q=>q.order('id',{ascending:true}),12000),rows=>A(rows).filter(activeProjectV10866)),force);
  }
  async function loadWorkers(force=false){
    return singleFlight('data:workers',()=>setFromQuery('workers',()=>paged('workers',q=>q.eq('is_active',true).order('id',{ascending:true}),18000)),force);
  }
  async function loadContracts(force=false){
    return singleFlight('data:contracts',()=>setFromQuery('contractServices',()=>paged('contract_services',q=>q.order('id',{ascending:false}),18000)),force);
  }
  async function loadTickets(force=false){
    return singleFlight('data:tickets',async()=>{
      if(typeof window.tasneefRefreshTicketsV10859==='function'){
        await window.tasneefRefreshTicketsV10859(true);
        return A(dset().tickets);
      }
      const token=S(localStorage.getItem('tasneef_session_token_v10817'));
      if(window.sb?.rpc&&token){
        let r=await window.sb.rpc('tasneef_tickets_all_v10859',{p_session_token:token});
        if(r?.error) r=await window.sb.rpc('tasneef_tickets_all_v10857',{p_session_token:token});
        if(!r?.error){dset().tickets=A(r.data);return dset().tickets;}
        if(r?.error) throw r.error;
      }
      dset().tickets=await paged('tickets',q=>q.order('created_at',{ascending:false}),30000);
      return dset().tickets;
    },force);
  }
  async function loadLogs(from,to,force=false,key='data:logs'){
    from=S(from)||today();to=S(to)||from;
    const cacheKey=key+':'+from+':'+to;
    return singleFlight(cacheKey,async()=>{
      const [a,b]=await Promise.all([
        paged('time_logs',q=>q.gte('log_date',from).lte('log_date',to).order('check_in',{ascending:false}),18000),
        paged('time_logs',q=>q.gte('check_in',from+'T00:00:00').lt('check_in',addDays(to,1)+'T00:00:00').order('check_in',{ascending:false}),18000)
      ]);
      dset().logs=mergeRows(a,b);
      return dset().logs;
    },force);
  }
  async function loadAttendance(from,to,force=false,key='data:attendance'){
    from=S(from)||today();to=S(to)||from;
    const cacheKey=key+':'+from+':'+to;
    return singleFlight(cacheKey,async()=>{
      dset().attendance=await paged('attendance',q=>q.gte('attendance_date',from).lte('attendance_date',to).order('attendance_date',{ascending:false}),18000);
      return dset().attendance;
    },force);
  }
  function selectedDailyRange(){
    const from=S($('dailyDateFromV10310')?.value||$('dailyDate')?.value||today());
    const to=S($('dailyDateToV10310')?.value||$('dailyDate')?.value||from);
    return {from,to:to||from};
  }
  function selectedAttendanceRange(){
    const month=S($('attendanceMatrixMonth')?.value||$('cu427Month')?.value||S($('attendanceFilterDate')?.value).slice(0,7)||monthNow());
    const r=monthRange(month);
    return {from:r.from,to:addDays(r.toExclusive,-1)};
  }
  function selectedMonthlyRange(){
    const month=S($('mc401Month')?.value||$('monthlyMonth')?.value||monthNow());
    const r=monthRange(month);
    return {from:r.from,to:addDays(r.toExclusive,-1),month:r.month};
  }
  function supervisorSummaryRange(){
    const mode=S($('summaryRange')?.value||'today'), custom=S($('summaryDate')?.value||today());
    if(mode==='yesterday'){const d=addDays(today(),-1);return{from:d,to:d};}
    if(mode==='week') return {from:addDays(today(),-6),to:today()};
    if(mode==='custom') return {from:custom,to:custom};
    return {from:today(),to:today()};
  }

  function roleKind(){
    if($('dashboard')) return 'admin';
    if($('supLogs')) return 'supervisor';
    if($('techDashboardTab')) return 'technician';
    return 'other';
  }
  function activeKey(){
    const kind=roleKind();
    if(kind==='admin'){
      const attr=document.documentElement.dataset.tasneefPageV10859;
      if(attr&&$(attr)&&!$(attr).classList.contains('hidden')) return 'admin:'+attr;
      const p=[...document.querySelectorAll('section.page,.page')].find(x=>!x.classList.contains('hidden')&&x.id);
      return 'admin:'+(p?.id||'dashboard');
    }
    if(kind==='supervisor'){
      const p=[...document.querySelectorAll('.sup-page')].find(x=>x.classList.contains('active'));
      return 'supervisor:'+(p?.id||'supLogs');
    }
    if(kind==='technician'){
      const p=[...document.querySelectorAll('.tech-main-page')].find(x=>x.classList.contains('active'));
      return 'technician:'+(p?.id||'techDashboardTab');
    }
    return 'other';
  }
  function scopeSupervisorProjects(rows){
    const u=user(), list=A(rows);
    const ids=new Set([u.id,u.user_id,u.supervisor_id,u.employee_id].map(normalizeId).filter(Boolean));
    const codes=new Set([u.employee_code,u.employee_number,u.code].map(x=>S(x).toLowerCase()).filter(Boolean));
    const names=new Set([u.full_name,u.name,u.username].map(x=>S(x).toLowerCase()).filter(Boolean));
    const allowed=new Set(A(u.allowed_project_ids||u.project_ids||u.projects).map(v=>S(v?.id??v)).filter(Boolean));
    return list.filter(p=>{
      if(!activeProjectV10866(p))return false;
      if(allowed.has(S(p.id)))return true;
      const pids=[p.supervisor_id,p.app_supervisor_id,p.current_supervisor_id,p.supervisor_user_id,p.manager_id].map(normalizeId).filter(Boolean);
      const pcodes=[p.supervisor_employee_code,p.supervisor_code].map(x=>S(x).toLowerCase()).filter(Boolean);
      const pnames=[p.supervisor_name,p.manager_name].map(x=>S(x).toLowerCase()).filter(Boolean);
      return pids.some(v=>ids.has(v))||pcodes.some(v=>codes.has(v))||pnames.some(v=>names.has(v));
    });
  }
  function workerProjectIds(w){
    const out=[];
    [w?.project_id,w?.assigned_project_id,w?.current_project_id].forEach(v=>{if(v!=null&&S(v))out.push(S(v));});
    [w?.project_ids,w?.projects,w?.assigned_projects].forEach(v=>{
      if(Array.isArray(v))v.forEach(x=>out.push(S(x?.id??x)));
      else if(typeof v==='string')v.split(/[,;|]/).forEach(x=>{if(S(x))out.push(S(x));});
    });
    return [...new Set(out.filter(Boolean))];
  }
  function workerSupervisorIds(w){
    const out=[];
    [w?.supervisor_id,w?.app_supervisor_id,w?.current_supervisor_id,w?.manager_id].forEach(v=>{if(v!=null&&S(v))out.push(S(v));});
    [w?.supervisor_ids,w?.supervisors].forEach(v=>{if(Array.isArray(v))v.forEach(x=>out.push(S(x?.id??x)));});
    return [...new Set(out.filter(Boolean))];
  }
  async function loadSupervisorProjects(force=false){
    return singleFlight('sup:projects',async()=>{
      const u=user();let rows=[];
      if(window.ProjectsService?.getAccessibleProjects){
        try{rows=A(await window.ProjectsService.getAccessibleProjects(u.id,'supervisor',{period:'current',force:true}));}catch(e){console.warn(BUILD,'ProjectsService',e);}
      }
      if(!rows.length){rows=scopeSupervisorProjects(await paged('projects',q=>q.order('id',{ascending:true}),12000));}
      rows=A(rows).filter(activeProjectV10866);
      dset().projects=rows;
      return rows;
    },force);
  }
  async function loadSupervisorWorkers(force=false){
    return singleFlight('sup:workers',async()=>{
      const u=user();let rows=[];
      if(typeof window.getUnifiedSupervisorWorkersV10713==='function'){
        try{const r=await window.getUnifiedSupervisorWorkersV10713(S($('attendanceDate')?.value||$('logDate')?.value||today()),true);rows=A(r?.workers);}catch(e){console.warn(BUILD,'unified supervisor workers',e);}
      }
      if(!rows.length){
        const all=await paged('workers',q=>q.eq('is_active',true).order('id',{ascending:true}),18000);
        const pids=new Set(A(dset().projects).map(p=>S(p.id)));
        rows=all.filter(w=>workerSupervisorIds(w).includes(S(u.id))||workerProjectIds(w).some(id=>pids.has(id)));
      }
      dset().workers=rows;
      return rows;
    },force);
  }
  function fillSupervisorSelects(){
    const p=A(dset().projects);
    try{
      if(typeof window.fillSelect==='function'){
        window.fillSelect('logProject',p,'name','اختر المشروع');
        window.fillSelect('attendanceProject',p,'name','كل مشاريع المشرف');
        window.fillSelect('ticketProject',p,'name','اختر المشروع');
        window.fillSelect('supTicketFilterProject',p,'name','كل المشاريع');
        window.fillSelect('supOrderProjectV10061',p,'name','اختر المشروع');
        window.fillSelect('supOrderFilterProjectV10061',p,'name','كل المشاريع');
        window.fillSelect('supClientReportProject',p,'name','اختر المشروع');
      }
    }catch(e){console.warn(BUILD,'fill supervisor selects',e);}
  }
  async function loadSupervisorTickets(force=false){
    await loadTickets(force);
    const u=user(),pids=new Set(A(dset().projects).map(p=>S(p.id)));
    dset().tickets=A(dset().tickets).filter(t=>S(t.supervisor_id)===S(u.id)||S(t.created_by)===S(u.id)||pids.has(S(t.project_id))||S(t.created_by_name)===S(u.full_name));
  }

  async function adminSection(id,force=false){
    switch(id){
      case 'dashboard':{
        await Promise.all([loadUsers(force),loadProjects(force),loadWorkers(force),loadLogs(today(),today(),force,'dashboard:logs')]);
        try{window.hydrateForms?.();}catch(_){ }
        try{window.renderDashboard?.();}catch(_){ }
        break;
      }
      case 'daily':{
        const r=selectedDailyRange();
        await Promise.all([loadUsers(force),loadProjects(force),loadWorkers(force),loadLogs(r.from,r.to,force,'daily:logs')]);
        try{window.hydrateForms?.();window.renderTimeLogs?.();}catch(_){ }
        break;
      }
      case 'users':
        await loadUsers(force);
        try{if(window.loadSecurityCenterV10700)await window.loadSecurityCenterV10700(true);else window.renderUsers?.();}catch(_){try{window.renderUsers?.();}catch(__){ }}
        break;
      case 'projects':
        await Promise.all([loadUsers(force),loadProjects(force)]);
        if(window.tasneefProjectsCleanV390?.refreshAll) await window.tasneefProjectsCleanV390.refreshAll();
        else try{window.renderProjects?.();}catch(_){ }
        break;
      case 'workers':
        await Promise.all([loadUsers(force),loadProjects(force),loadWorkers(force)]);
        if(window.tasneefWorkersCleanV386?.refreshAll) await window.tasneefWorkersCleanV386.refreshAll();
        else try{window.renderWorkers?.();}catch(_){ }
        try{window.tasneefWorkersQuickDistributionV403?.inject?.();await window.tasneefWorkersQuickDistributionV403?.load?.();}catch(_){ }
        break;
      case 'distribution':
        if(window.tasneefDistributionV404){
          if(!window.__tasneefDistributionInitV10864){window.__tasneefDistributionInitV10864=true;await window.tasneefDistributionV404.init?.();}
          else await window.tasneefDistributionV404.reload?.(true);
        }
        break;
      case 'attendance':{
        const r=selectedAttendanceRange();
        await Promise.all([loadUsers(force),loadProjects(force),loadWorkers(force),loadAttendance(r.from,r.to,force,'attendance:rows')]);
        try{window.hydrateForms?.();window.renderAttendance?.();window.renderAttendanceMonthly?.();}catch(_){ }
        break;
      }
      case 'monthly':{
        if(window.tasneefMonthlyCleanV403?.render) await window.tasneefMonthlyCleanV403.render(true);
        else {const r=selectedMonthlyRange();await Promise.all([loadUsers(force),loadProjects(force),loadWorkers(force),loadLogs(r.from,r.to,force,'monthly:logs')]);try{window.renderMonthly?.();}catch(_){ }}
        break;
      }
      case 'tickets':
        await Promise.all([loadUsers(force),loadProjects(force),loadTickets(force)]);try{window.hydrateForms?.();window.renderTickets?.();}catch(_){ }break;
      case 'orders':
        if(window.tasneefOrders10400?.refresh) await window.tasneefOrders10400.refresh();
        else if(typeof window.renderOrdersV233==='function') await window.renderOrdersV233();
        break;
      case 'inventoryAudit':
        if(window.tasneefInventoryAuditV10059?.load) await window.tasneefInventoryAuditV10059.load();
        break;
      case 'adminTasks':
        if(window.tasneefAdminTasksV10121?.openPage) await window.tasneefAdminTasksV10121.openPage();
        break;
      case 'contracts':
        await Promise.all([loadProjects(force),loadContracts(force)]);
        if(window.ContractsServicesEditor?.renderContracts) await window.ContractsServicesEditor.renderContracts();
        else try{window.renderContractServices?.();}catch(_){ }
        break;
      case 'crm':
        if(window.tasneefCRM?.load) await window.tasneefCRM.load();break;
      case 'alerts':{
        const from=addDays(today(),-62);
        await Promise.all([loadUsers(force),loadProjects(force),loadWorkers(force),loadLogs(from,today(),force,'alerts:logs'),loadTickets(force)]);
        try{window.renderAlerts?.();}catch(_){ }break;
      }
      case 'export':
        if(legacyFullLoad) await legacyFullLoad();
        try{window.hydrateForms?.();window.previewMeetingExportV223?.();}catch(_){ }
        break;
      case 'coreUnified':
        if(window.tasneefCoreUnifiedV413?.reload) await window.tasneefCoreUnifiedV413.reload(true);break;
      case 'salaries':
        if(window.tasneefSalariesUnifiedV440?.load) await window.tasneefSalariesUnifiedV440.load();break;
      case 'assistant':
        try{window.renderTasneefAssistant?.();}catch(_){ }break;
      default:
        break;
    }
  }
  async function supervisorSection(id,force=false){
    await loadSupervisorProjects(force);
    fillSupervisorSelects();
    if(id==='supLogs'){
      await Promise.all([loadSupervisorWorkers(force),loadLogs(today(),today(),force,'sup:logs')]);
      const uid=S(user().id);dset().logs=A(dset().logs).filter(x=>!x.supervisor_id||S(x.supervisor_id)===uid);
      try{window.renderTimeLogs?.();window.refreshSupervisorWorkerVisitsV10500?.(true);}catch(_){ }
    }else if(id==='supAttendance'){
      const date=S($('attendanceDate')?.value||today());
      await Promise.all([loadSupervisorWorkers(force),loadAttendance(date,date,force,'sup:attendance')]);
      try{await window.renderSupervisorAttendanceList?.();}catch(_){ }
    }else if(id==='supTickets'){
      await loadSupervisorTickets(force);try{window.renderTickets?.();}catch(_){ }
    }else if(id==='supSummary'){
      const r=supervisorSummaryRange();
      await Promise.all([loadSupervisorWorkers(force),loadLogs(r.from,r.to,force,'sup:summary:logs'),loadAttendance(r.from,r.to,force,'sup:summary:attendance'),loadSupervisorTickets(force)]);
      try{window.renderSupervisorDailySummary?.();}catch(_){ }
    }else if(id==='supOrders'){
      if(window.tasneefOrders10400?.refresh) await window.tasneefOrders10400.refresh();
    }else if(id==='supInventory'){
      try{await window.supervisorInventoryLoad?.();}catch(_){ }
    }else if(id==='supAdminTasks'){
      try{await window.TasneefFieldAdminTasksV10130?.open?.('supervisor');}catch(_){ }
    }else if(id==='supClientDailyReport'){
      try{await window.supClientReportInit?.();}catch(_){ }
    }
  }
  async function technicianSection(id,force=false){
    if(id==='techDashboardTab'){
      await loadTickets(force);try{window.renderTechnicianTickets?.();}catch(_){ }
    }else if(id==='techTicketsTab'){
      if(window.refreshTechnicianProjectsV10855) await window.refreshTechnicianProjectsV10855();
      await loadTickets(force);try{window.renderTechnicianTickets?.();}catch(_){ }
    }else if(id==='techCreateTab'){
      if(window.refreshTechnicianProjectsV10855) await window.refreshTechnicianProjectsV10855();
    }else if(id==='techAdminTasksTab'){
      try{await window.TasneefFieldAdminTasksV10130?.open?.('technician');}catch(_){ }
    }else if(id==='techAttendanceTab'){
      try{window.renderTechAttendance?.();}catch(_){ }
    }
  }

  async function loadSection(key,force=false){
    key=key||activeKey();state.activeKey=key;
    if(!key||key==='other') return;
    return singleFlight('section:'+key,async()=>{
      const [kind,id]=key.split(':');
      if(kind==='admin') await adminSection(id,force);
      if(kind==='supervisor') await supervisorSection(id,force);
      if(kind==='technician') await technicianSection(id,force);
      try{
        const d=dset();d.__sectionLoaderBuild=BUILD;d.__sectionLoadedAt=new Date().toISOString();d.__serverPartialFailure=false;
        window.dispatchEvent(new CustomEvent('tasneef:data-loaded-v10863',{detail:{partial:false,section:key,build:BUILD}}));
      }catch(_){ }
      return true;
    },force);
  }
  async function refreshActive(force=false){return loadSection(activeKey(),force);}
  window.tasneefLoadSectionV10864=loadSection;
  window.tasneefRefreshActiveSectionV10864=refreshActive;
  window.tasneefSectionLoaderStatusV10864=()=>({build:BUILD,active:activeKey(),last:Object.fromEntries(state.last),loading:[...state.promises.keys()],lastError:S(state.lastError?.message||state.lastError||'')});

  // V10859 يبقى مسؤولاً عن التبديل البصري والصلاحيات؛ بعده نحمل بيانات القسم فقط.
  const oldShowPage=window.showPage;
  if(typeof oldShowPage==='function'){
    window.showPage=function(id,btn){
      const out=oldShowPage.apply(this,arguments);
      if(out===false) return out;
      requestAnimationFrame(()=>loadSection('admin:'+id,true).catch(()=>{}));
      return out;
    };
    window.showPage.__permissionsV10817=oldShowPage.__permissionsV10817||true;
  }
  const oldShowSup=window.showSupervisorWindow;
  if(typeof oldShowSup==='function'){
    window.showSupervisorWindow=function(id,btn){
      const out=oldShowSup.apply(this,arguments);if(out===false)return out;
      requestAnimationFrame(()=>loadSection('supervisor:'+id,true).catch(()=>{}));return out;
    };
    window.showSupervisorWindow.__permissionsV10817=oldShowSup.__permissionsV10817||true;
  }
  const oldShowTech=window.showTechMainTab;
  if(typeof oldShowTech==='function'){
    window.showTechMainTab=function(id,btn){
      const out=oldShowTech.apply(this,arguments);if(out===false)return out;
      requestAnimationFrame(()=>loadSection('technician:'+id,true).catch(()=>{}));return out;
    };
    window.showTechMainTab.__permissionsV10817=oldShowTech.__permissionsV10817||true;
  }

  // أي كود قديم يطلب تحميلًا عامًا بعد الحفظ سيحدث القسم الحالي فقط.
  window.loadAll=async function(){return refreshActive(true);};
  window.refreshAll=async function(){return refreshActive(true);};
  try{loadAll=window.loadAll;refreshAll=window.refreshAll;}catch(_){ }

  // بداية خفيفة: بيانات القسم الظاهر فقط، بدون warm-up شامل.
  window.initAdmin=async function(){
    try{if(window.ensureTasneefDataSessionV10818&&!await window.ensureTasneefDataSessionV10818())return;}catch(_){ }
    try{if(typeof window.requireRole==='function'&&!window.requireRole('admin'))return;}catch(_){ }
    return loadSection('admin:dashboard',true);
  };
  window.initSupervisor=async function(){
    try{if(window.ensureTasneefDataSessionV10818&&!await window.ensureTasneefDataSessionV10818())return;}catch(_){ }
    let u=user();try{if(typeof window.requireRole==='function')u=window.requireRole('supervisor')||u;}catch(_){ }
    if(!u||!u.id)return;
    const title=$('supTitle');if(title)title.textContent='لوحة المشرف - '+S(u.full_name||u.name||u.username);
    if($('logDate')&&!$('logDate').value)$('logDate').value=today();
    if($('attendanceDate')&&!$('attendanceDate').value)$('attendanceDate').value=today();
    return loadSection('supervisor:supLogs',true);
  };
  window.initTechnician=async function(){
    try{if(window.ensureTasneefDataSessionV10818&&!await window.ensureTasneefDataSessionV10818())return;}catch(_){ }
    let u=user();try{if(typeof window.requireRole==='function')u=window.requireRole('technician')||u;}catch(_){ }
    if(!u||!u.id)return;
    const title=$('techTitle');if(title)title.textContent='لوحة الفني - '+S(u.full_name||u.username);
    return loadSection('technician:techDashboardTab',true);
  };
  try{initAdmin=window.initAdmin;initSupervisor=window.initSupervisor;initTechnician=window.initTechnician;}catch(_){ }

  // تغيير تاريخ/شهر القسم يعيد جلب الفترة المطلوبة من السيرفر، وليس إعادة رسم بيانات قديمة فقط.
  document.addEventListener('change',e=>{
    const id=e.target?.id||'';
    const watched=new Set(['dailyDate','dailyDateFromV10310','dailyDateToV10310','attendanceFilterDate','attendanceMatrixMonth','monthlyMonth','mc401Month','attendanceDate','summaryRange','summaryDate']);
    if(watched.has(id)) setTimeout(()=>refreshActive(true).catch(()=>{}),20);
  },true);

  function startTimer(){
    if(state.timer) clearInterval(state.timer);
    state.timer=setInterval(()=>{if(!document.hidden)refreshActive(false).catch(()=>{});},REFRESH_MS);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshActive(false).catch(()=>{});});
  window.addEventListener('online',()=>setTimeout(()=>refreshActive(true).catch(()=>{}),700));
  startTimer();

  // إذا لم يكن هناك onload صريح (بعض الصفحات المساعدة) نحمل القسم الظاهر بعد اكتمال DOM.
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{state.activeKey=activeKey();},50),{once:true});
  console.info(BUILD,'loaded');
})();
