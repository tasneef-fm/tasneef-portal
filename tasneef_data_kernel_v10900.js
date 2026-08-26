/* TASNEEF V10900 — Unified Data Kernel
   One owner for section loading, project scope, request de-duplication and last-good data.
   Policy: first open + explicit mutation/filter refresh only. No polling/focus refresh.
*/
(function(){
  'use strict';
  if(window.__tasneefDataKernelV10900) return;
  window.__tasneefDataKernelV10900=true;

  const BUILD='V10902_UNIFIED_DATA_KERNEL_STABLE_SELECTION';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const state={inflight:new Map(),loadedSections:new Set(),master:{},lastGood:{},errors:{},supervisor:null,booted:false};

  function data(){window.data=window.data||{};return window.data;}
  function sessionUser(){
    try{if(typeof window.session==='function'){const u=window.session();if(u)return u;}}catch(_){ }
    try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}
  }
  function norm(v){return S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();}
  function today(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\//g,'-');}catch(_){return new Date().toISOString().slice(0,10);}}
  function monthNow(){return today().slice(0,7);}
  function addDays(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+Number(n||0));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function monthRange(m){m=/^\d{4}-\d{2}$/.test(S(m))?S(m):monthNow();const [y,mo]=m.split('-').map(Number),n=new Date(y,mo,1);return{from:m+'-01',to:addDays(n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-01',-1),month:m};}
  function activeProject(p){if(!p||p.is_active===false||p.active===false)return false;const st=norm(p.status||p.project_status||p.state);return !['inactive','stopped','ended','closed','cancelled','deleted','archived','disabled','موقوف','متوقف','منتهي','ملغي','محذوف','مؤرشف','غير نشط'].includes(st);}
  function role(){const r=norm(sessionUser().role);if(r==='supervisor'||r.includes('مشرف'))return'supervisor';if(r==='technician'||r.includes('فني'))return'technician';if(r==='admin'||r.includes('ادار')||$('dashboard'))return'admin';return r||'other';}
  function selectedValue(...ids){for(const id of ids){const v=S($(id)?.value);if(v)return v;}return'';}
  function preserveSelect(id,rows,label){
    const el=$(id);if(!el)return;
    const stable=window.TasneefProjectSelectionV10902;
    const old=S(el.value),remembered=S(stable?.get?.(id)||'');
    const desired=old||remembered;
    const wanted=A(rows).map(p=>({value:S(p.id),text:S(p.name||p.project_name||p.title||p.id)}));
    const current=[...el.options].slice(1).map(o=>({value:S(o.value),text:S(o.textContent)}));
    const same=current.length===wanted.length&&current.every((o,i)=>o.value===wanted[i].value&&o.text===wanted[i].text);
    if(!same){
      el.innerHTML='<option value="">'+esc(label)+'</option>'+wanted.map(p=>'<option value="'+escAttr(p.value)+'">'+esc(p.text)+'</option>').join('');
    }else if(el.options[0]&&S(el.options[0].textContent)!==S(label)){
      el.options[0].textContent=label;
    }
    if(desired&&[...el.options].some(o=>S(o.value)===desired))el.value=desired;
    stable?.confirmFromSelect?.(id);
  }
  function esc(v){return S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function escAttr(v){return esc(v).replace(/`/g,'&#96;');}

  function mergeById(base,extra){const map=new Map();A(base).forEach((r,i)=>map.set(r?.id!=null?'id:'+S(r.id):'i:'+i,r));A(extra).forEach((r,i)=>{const k=r?.id!=null?'id:'+S(r.id):'x:'+i;map.set(k,Object.assign({},map.get(k)||{},r));});return [...map.values()];}
  async function flight(key,fn,force=false){
    if(state.inflight.has(key))return state.inflight.get(key);
    if(!force&&Object.prototype.hasOwnProperty.call(state.master,key))return state.master[key];
    const p=(async()=>{try{const out=await fn();state.errors[key]=null;return out;}catch(e){state.errors[key]=S(e?.message||e);console.warn(BUILD,key,e);if(Object.prototype.hasOwnProperty.call(state.lastGood,key)){const fallback=state.lastGood[key];if(Array.isArray(fallback)&&['projects','tickets','users','workers'].includes(key)){const cur=A(data()[key]);return mergeById(fallback,cur);}return fallback;}throw e;}finally{state.inflight.delete(key);}})();
    state.inflight.set(key,p);return p;
  }
  function commit(key,rows){rows=A(rows);state.master[key]=rows;state.lastGood[key]=rows.slice();return rows;}
  async function paged(table,configure,maxRows=50000,pageSize=1000){
    if(!window.sb?.from)throw new Error('قاعدة البيانات غير جاهزة');
    const out=[];
    for(let from=0;from<maxRows;from+=pageSize){
      let q=window.sb.from(table).select('*');
      if(typeof configure==='function')q=configure(q)||q;
      q=q.range(from,Math.min(from+pageSize-1,maxRows-1));
      const r=await q;if(r?.error)throw r.error;
      const rows=A(r?.data);out.push(...rows);if(rows.length<pageSize)break;
    }
    return out;
  }
  async function users(force=false){return flight('users',async()=>commit('users',await paged('app_users',q=>q.order('id',{ascending:true}),10000)),force);}
  async function projects(force=false){return flight('projects',async()=>commit('projects',await paged('projects',q=>q.order('id',{ascending:true}),15000)),force);}
  async function workers(force=false){return flight('workers',async()=>commit('workers',await paged('workers',q=>q.order('id',{ascending:true}),25000)),force);}

  function token(){return S(localStorage.getItem('tasneef_session_token_v10817')||localStorage.getItem('tasneef_session_token'));}
  async function tickets(force=false){
    return flight('tickets',async()=>{
      let rows=[];let usedRpc=false;
      if(window.sb?.rpc&&token()){
        let r=await window.sb.rpc('tasneef_tickets_all_v10859',{p_session_token:token()});
        if(r?.error)r=await window.sb.rpc('tasneef_tickets_all_v10857',{p_session_token:token()});
        if(!r?.error){rows=A(r.data);usedRpc=true;}
      }
      if(!usedRpc)rows=await paged('tickets',q=>q.order('created_at',{ascending:false}),50000);
      return commit('tickets',rows);
    },force);
  }
  async function logs(from,to,force=false){
    from=S(from)||today();to=S(to)||from;const key='logs:'+from+':'+to;
    return flight(key,async()=>{
      let rows=[];
      try{
        const u=sessionUser();const rr=await window.sb.rpc('tasneef_daily_logs_visible_v10519',{p_from:from,p_to:to,p_supervisor_id:role()==='supervisor'?(Number(u.id)||null):null});
        if(rr?.error)throw rr.error;rows=A(rr.data);
      }catch(_){rows=await paged('time_logs',q=>q.gte('log_date',from).lte('log_date',to).order('check_in',{ascending:false}),30000);}
      state.master[key]=rows;state.lastGood[key]=rows.slice();return rows;
    },force);
  }
  async function attendance(from,to,force=false){
    from=S(from)||today();to=S(to)||from;const key='attendance:'+from+':'+to;
    return flight(key,async()=>{const rows=await paged('attendance',q=>q.gte('attendance_date',from).lte('attendance_date',to).order('attendance_date',{ascending:false}),30000);state.master[key]=rows;state.lastGood[key]=rows.slice();return rows;},force);
  }

  function userIdentity(u,extra={}){
    const ids=new Set([u.id,u.user_id,u.supervisor_id,u.employee_id,extra.sid,extra.employeeId,extra.authUserId].map(S).filter(Boolean));
    const codes=new Set([u.employee_code,u.employee_number,u.code,extra.code].map(norm).filter(Boolean));
    const names=new Set([u.full_name,u.name,u.username,extra.name].map(norm).filter(Boolean));
    return{ids,codes,names};
  }
  function rowMatchesSupervisor(r,identity){
    const explicit=[r?.supervisor_user_id,r?.app_user_id,r?.user_id,r?.manager_id].map(S).filter(Boolean);
    if(explicit.some(v=>identity.ids.has(v)))return true;
    const legacy=S(r?.supervisor_id);if(legacy&&(identity.ids.has(legacy)||identity.codes.has(norm(legacy))))return true;
    const codes=[r?.supervisor_employee_code,r?.supervisor_code,r?.current_supervisor_code,r?.app_supervisor_code].map(norm).filter(Boolean);
    if(codes.some(v=>identity.codes.has(v)))return true;
    const names=[r?.supervisor_name,r?.supervisor,r?.manager_name].map(norm).filter(Boolean);
    return names.some(v=>identity.names.has(v));
  }
  function directProjectState(p,identity){
    // supervisor_id is canonical. Secondary fields are only consulted when canonical is empty.
    const primary=S(p?.supervisor_id);
    if(primary)return{has:true,match:identity.ids.has(primary)||identity.codes.has(norm(primary))||identity.names.has(norm(primary))};
    const secondary=[p?.app_supervisor_id,p?.current_supervisor_id,p?.supervisor_user_id].map(S).filter(Boolean);
    if(secondary.length)return{has:true,match:secondary.some(v=>identity.ids.has(v)||identity.codes.has(norm(v)))};
    const code=norm(p?.supervisor_employee_code||p?.supervisor_code);if(code)return{has:true,match:identity.codes.has(code)};
    const name=norm(p?.supervisor_name);if(name)return{has:true,match:identity.names.has(name)};
    return{has:false,match:false};
  }
  async function supervisorAssignments(force=false){
    const u=sessionUser(),m=monthNow(),key='supervisorAssignments:'+S(u.id)+':'+m;
    return flight(key,async()=>{
      let rows=[],serverIdentity={};
      try{
        const r=await window.sb.rpc('tasneef_get_supervisor_distribution_v10819',{p_month:m});
        if(r?.error)throw r.error;
        const payload=r?.data||{};rows=Array.isArray(payload)?payload:A(payload.rows);serverIdentity=payload.identity||{};
      }catch(e){
        const all=await paged('monthly_distribution',q=>q.eq('month_key',m).order('project_id',{ascending:true}),30000);
        const identity=userIdentity(u);
        rows=all.filter(r=>rowMatchesSupervisor(r,identity));
      }
      const identity=userIdentity(u,{sid:serverIdentity.user_id,authUserId:serverIdentity.user_id,code:serverIdentity.employee_code,name:serverIdentity.full_name});
      const ended=new Set(['ended','inactive','cancelled','deleted','stopped','disabled','archived','منتهي','موقوف','ملغي','محذوف','متوقف','مؤرشف']);
      rows=A(rows).filter(r=>r?.is_active!==false&&r?.active!==false&&!ended.has(norm(r?.status||r?.state)));
      const out={rows,identity,serverIdentity,projectIds:new Set(rows.map(r=>S(r?.project_id||r?.project_key||r?.app_project_id)).filter(Boolean))};
      state.master[key]=out;state.lastGood[key]=out;return out;
    },force);
  }
  async function supervisorScope(force=false){
    const u=sessionUser();const [allProjects,ass]=await Promise.all([projects(force),supervisorAssignments(force)]);const identity=ass.identity||userIdentity(u);
    const scoped=A(allProjects).filter(p=>{
      if(!activeProject(p))return false;
      const direct=directProjectState(p,identity);
      if(direct.has)return direct.match;
      return ass.projectIds.has(S(p.id));
    });
    const map=new Map();scoped.forEach(p=>map.set(S(p.id),Object.assign({},p,{name:S(p.name||p.project_name||p.title||p.id)})));
    // Keep orphan distribution projects visible instead of silently dropping them.
    ass.rows.forEach(r=>{const id=S(r?.project_id||r?.project_key||r?.app_project_id);if(id&&!map.has(id))map.set(id,{id,name:S(r?.project_name||r?.project||id),status:'active',is_active:true,__distributionOnly:true});});
    const rows=[...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
    state.supervisor={user:u,identity,projectIds:new Set(rows.map(p=>S(p.id))),projects:rows,assignments:ass.rows,at:Date.now()};
    return state.supervisor;
  }
  function fillSupervisorProjects(scope){
    const rows=A(scope?.projects),label=rows.length?'اختر المشروع':'لا توجد مشاريع مرتبطة بحسابك';
    preserveSelect('logProject',rows,label);preserveSelect('attendanceProject',rows,rows.length?'كل مشاريع المشرف':label);preserveSelect('ticketProject',rows,label);preserveSelect('supTicketFilterProject',rows,rows.length?'كل المشاريع':label);preserveSelect('supOrderProjectV10061',rows,label);preserveSelect('supOrderFilterProjectV10061',rows,rows.length?'كل المشاريع':label);preserveSelect('supInventoryRequestProject',rows,label);preserveSelect('supClientReportProject',rows,label);
  }
  async function supervisorWorkers(scope,force=false){
    let rows=[];
    try{if(typeof window.getUnifiedSupervisorWorkersV10713==='function'){const x=await window.getUnifiedSupervisorWorkersV10713(selectedValue('attendanceDate','logDate')||today(),force);rows=A(x?.workers);}}catch(e){console.warn(BUILD,'supervisor unified workers fallback',e);}
    if(!rows.length){const all=await workers(force),pids=scope.projectIds;rows=all.filter(w=>S(w.supervisor_id)===S(sessionUser().id)||S(w.app_supervisor_id)===S(sessionUser().id)||pids.has(S(w.project_id)));}
    return rows;
  }
  function scopedTickets(rows,scope){const u=sessionUser(),pids=scope?.projectIds||new Set();return A(rows).filter(t=>pids.has(S(t.project_id))||S(t.supervisor_id)===S(u.id)||S(t.created_by)===S(u.id)||S(t.created_by_user_id)===S(u.id));}

  function adminActiveId(){return S(document.documentElement.dataset.tasneefPageV10859)||([...document.querySelectorAll('section.page,.page')].find(x=>!x.classList.contains('hidden')&&x.id)?.id||'dashboard');}
  function supervisorActiveId(){return [...document.querySelectorAll('.sup-page')].find(x=>x.classList.contains('active'))?.id||'supLogs';}
  function activeKey(){const r=role();return r==='admin'?'admin:'+adminActiveId():r==='supervisor'?'supervisor:'+supervisorActiveId():r==='technician'?'technician:'+([...document.querySelectorAll('.tech-main-page')].find(x=>x.classList.contains('active'))?.id||'techDashboardTab'):'other';}

  async function loadAdmin(id,force){
    const d=data();
    if(id==='dashboard'){const [u,p,w,l]=await Promise.all([users(force),projects(force),workers(force),logs(today(),today(),force)]);d.users=u;d.projects=p;d.workers=w;d.logs=l;d.supervisors=u.filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);d.technicians=u.filter(x=>norm(x.role)==='technician'&&x.is_active!==false);try{window.hydrateForms?.();window.renderDashboard?.();}catch(_){}return;}
    if(id==='tickets'){const [u,p,t]=await Promise.all([users(force),projects(force),tickets(force)]);d.users=u;d.projects=p;d.tickets=t;d.supervisors=u.filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);try{window.hydrateForms?.();window.renderTickets?.();}catch(_){}return;}
    if(id==='orders'){const p=await projects(force);d.projects=p;try{await window.tasneefOrders10400?.refresh?.();}catch(e){console.warn(BUILD,'orders',e);}return;}
    if(id==='daily'){const from=selectedValue('dailyDateFromV10310','dailyDate')||today(),to=selectedValue('dailyDateToV10310','dailyDate')||from;const [u,p,w,l]=await Promise.all([users(force),projects(force),workers(force),logs(from,to,force)]);d.users=u;d.projects=p;d.workers=w;d.logs=l;d.supervisors=u.filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);try{window.hydrateForms?.();window.renderTimeLogs?.();}catch(_){}return;}
    if(id==='attendance'){const m=selectedValue('attendanceMatrixMonth','attendanceFilterDate')?.slice(0,7)||monthNow(),r=monthRange(m);const [u,p,w,a]=await Promise.all([users(force),projects(force),workers(force),attendance(r.from,r.to,force)]);d.users=u;d.projects=p;d.workers=w;d.attendance=a;d.supervisors=u.filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);try{window.hydrateForms?.();window.renderAttendance?.();window.renderAttendanceMonthly?.();}catch(_){}return;}
    if(id==='projects'){const [u,p]=await Promise.all([users(force),projects(force)]);d.users=u;d.projects=p;d.supervisors=u.filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);try{window.hydrateForms?.();window.renderProjects?.();}catch(_){}try{if(window.tasneefProjectsCleanV390?.refreshAll)await window.tasneefProjectsCleanV390.refreshAll();}catch(e){console.warn(BUILD,'project module',e);}return;}
    if(id==='workers'){const [u,p,w]=await Promise.all([users(force),projects(force),workers(force)]);d.users=u;d.projects=p;d.workers=w;d.supervisors=u.filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);try{window.hydrateForms?.();window.renderWorkers?.();}catch(_){}return;}
    if(id==='alerts'){const from=addDays(today(),-62);const [u,p,w,l,t]=await Promise.all([users(force),projects(force),workers(force),logs(from,today(),force),tickets(force)]);Object.assign(d,{users:u,projects:p,workers:w,logs:l,tickets:t});try{window.renderAlerts?.();}catch(_){}return;}
    if(id==='contracts'){d.projects=await projects(force);try{await window.ContractsServicesEditor?.renderContracts?.();}catch(_){}return;}
    if(id==='monthly'){try{await window.tasneefMonthlyCleanV403?.render?.(true);}catch(e){console.warn(BUILD,'monthly',e);}return;}
    if(id==='distribution'){try{if(!window.__kernelDistributionInit){window.__kernelDistributionInit=true;await window.tasneefDistributionV404?.init?.();}else if(force)await window.tasneefDistributionV404?.reload?.(true);}catch(e){console.warn(BUILD,'distribution',e);}return;}
    if(id==='salaries'){try{await window.tasneefSalariesUnifiedV440?.load?.();}catch(_){}return;}
    if(id==='crm'){try{await window.tasneefCRM?.load?.();}catch(_){}return;}
    if(id==='users'){d.users=await users(force);d.supervisors=A(d.users).filter(x=>norm(x.role)==='supervisor'&&x.is_active!==false);try{if(window.loadSecurityCenterV10700)await window.loadSecurityCenterV10700(true);else window.renderUsers?.();}catch(_){}return;}
    // Specialized sections keep their own loader, but never trigger global loadAll.
    if(id==='inventoryAudit'){try{await window.tasneefInventoryAuditV10059?.load?.();}catch(_){}return;}
    if(id==='adminTasks'){try{await window.tasneefAdminTasksV10121?.openPage?.();}catch(_){}return;}
    if(id==='coreUnified'){try{await window.tasneefCoreUnifiedV413?.reload?.(true);}catch(_){}return;}
  }

  async function loadSupervisor(id,force){
    // V10902: project scope is session-stable. A log/ticket mutation refreshes only its dataset,
    // not the supervisor project list. Project scope is force-refreshed only by the explicit
    // refreshSupervisorProjects API or a fresh page/session boot.
    const d=data(),scope=await supervisorScope(false);d.projects=scope.projects;d.workerAssignments=scope.assignments;fillSupervisorProjects(scope);
    if(id==='supTickets'){const t=await tickets(force);d.tickets=scopedTickets(t,scope);try{window.renderTickets?.();}catch(_){}return;}
    if(id==='supLogs'){const [w,l]=await Promise.all([supervisorWorkers(scope,force),logs(today(),today(),force)]);d.workers=w;d.logs=A(l).filter(x=>scope.projectIds.has(S(x.project_id)));try{window.renderTimeLogs?.();}catch(_){}return;}
    if(id==='supAttendance'){const date=selectedValue('attendanceDate')||today(),[w,a]=await Promise.all([supervisorWorkers(scope,force),attendance(date,date,force)]);d.workers=w;d.attendance=A(a).filter(x=>scope.projectIds.has(S(x.project_id)));try{await window.renderSupervisorAttendanceList?.();}catch(_){}return;}
    if(id==='supSummary'){const mode=selectedValue('summaryRange')||'today';let from=today(),to=today();if(mode==='yesterday')from=to=addDays(today(),-1);else if(mode==='week')from=addDays(today(),-6);else if(mode==='custom')from=to=selectedValue('summaryDate')||today();const [w,l,a,t]=await Promise.all([supervisorWorkers(scope,force),logs(from,to,force),attendance(from,to,force),tickets(force)]);d.workers=w;d.logs=A(l).filter(x=>scope.projectIds.has(S(x.project_id)));d.attendance=A(a).filter(x=>scope.projectIds.has(S(x.project_id)));d.tickets=scopedTickets(t,scope);try{window.renderSupervisorDailySummary?.();}catch(_){}return;}
    if(id==='supOrders'){try{await window.loadUnifiedOrdersForSupervisor?.();await window.tasneefOrders10400?.refresh?.();}catch(e){console.warn(BUILD,'supervisor orders',e);}return;}
    if(id==='supInventory'){try{await window.supervisorInventoryLoad?.();}catch(_){}return;}
    if(id==='supAdminTasks'){try{await window.TasneefFieldAdminTasksV10130?.open?.('supervisor');}catch(_){}return;}
    if(id==='supClientDailyReport'){try{await window.supClientReportInit?.();}catch(_){}return;}
  }

  async function loadTechnician(id,force){
    const d=data();
    if(id==='techDashboardTab'){d.tickets=await tickets(force);try{window.renderTechnicianTickets?.();}catch(_){}return;}
    if(id==='techTicketsTab'){try{await window.refreshTechnicianProjectsV10855?.();}catch(_){}d.tickets=await tickets(force);try{window.renderTechnicianTickets?.();}catch(_){}return;}
    if(id==='techCreateTab'){try{await window.refreshTechnicianProjectsV10855?.();}catch(_){}return;}
    if(id==='techAdminTasksTab'){try{await window.TasneefFieldAdminTasksV10130?.open?.('technician');}catch(_){}return;}
    if(id==='techAttendanceTab'){try{window.renderTechAttendance?.();}catch(_){}return;}
  }

  async function loadSection(key,force=false){
    key=key||activeKey();if(!key||key==='other')return true;
    if(!force&&state.loadedSections.has(key))return true;
    const flightKey='section:'+key;
    return flight(flightKey,async()=>{const [r,id]=key.split(':');if(r==='admin')await loadAdmin(id,force);else if(r==='supervisor')await loadSupervisor(id,force);else if(r==='technician')await loadTechnician(id,force);state.loadedSections.add(key);window.dispatchEvent(new CustomEvent('tasneef:data-loaded-v10863',{detail:{partial:false,section:key,build:BUILD}}));return true;},true);
  }
  async function refreshActive(){return loadSection(activeKey(),true);}
  function invalidate(names){A(names).forEach(n=>{delete state.master[n];});}

  // Visual routers are already owned by V10859. We only append deterministic first-open loading.
  const showPage=window.showPage;if(typeof showPage==='function'){window.showPage=function(id,btn){const r=showPage.apply(this,arguments);if(r!==false)requestAnimationFrame(()=>loadSection('admin:'+id,false).catch(console.warn));return r;};window.showPage.__permissionsV10817=true;}
  const showSup=window.showSupervisorWindow;if(typeof showSup==='function'){window.showSupervisorWindow=function(id,btn){const r=showSup.apply(this,arguments);if(r!==false)requestAnimationFrame(()=>loadSection('supervisor:'+id,false).catch(console.warn));return r;};window.showSupervisorWindow.__permissionsV10817=true;}
  const showTech=window.showTechMainTab;if(typeof showTech==='function'){window.showTechMainTab=function(id,btn){const r=showTech.apply(this,arguments);if(r!==false)requestAnimationFrame(()=>loadSection('technician:'+id,false).catch(console.warn));return r;};window.showTechMainTab.__permissionsV10817=true;}

  // Legacy global refreshes are converted to one active-section refresh. This eliminates request storms.
  window.loadAll=refreshActive;window.refreshAll=refreshActive;
  try{loadAll=window.loadAll;refreshAll=window.refreshAll;}catch(_){}

  window.initAdmin=async function(){try{if(window.ensureTasneefDataSessionV10818&&!await window.ensureTasneefDataSessionV10818())return;}catch(_){}try{if(typeof window.requireRole==='function'&&!window.requireRole('admin'))return;}catch(_){}return loadSection('admin:dashboard',true);};
  window.initSupervisor=async function(){try{if(window.ensureTasneefDataSessionV10818&&!await window.ensureTasneefDataSessionV10818())return;}catch(_){}let u=sessionUser();try{if(typeof window.requireRole==='function')u=window.requireRole('supervisor')||u;}catch(_){}if(!u?.id)return;const title=$('supTitle');if(title)title.textContent='لوحة المشرف - '+S(u.full_name||u.name||u.username);if($('logDate')&&!$('logDate').value)$('logDate').value=today();if($('attendanceDate')&&!$('attendanceDate').value)$('attendanceDate').value=today();return loadSection('supervisor:supLogs',true);};
  window.initTechnician=async function(){try{if(window.ensureTasneefDataSessionV10818&&!await window.ensureTasneefDataSessionV10818())return;}catch(_){}let u=sessionUser();try{if(typeof window.requireRole==='function')u=window.requireRole('technician')||u;}catch(_){}if(!u?.id)return;const title=$('techTitle');if(title)title.textContent='لوحة الفني - '+S(u.full_name||u.name||u.username);return loadSection('technician:techDashboardTab',true);};
  try{initAdmin=window.initAdmin;initSupervisor=window.initSupervisor;initTechnician=window.initTechnician;}catch(_){}

  // Compatibility aliases used by the ticket/project code already in this build.
  window.tasneefLoadSectionV10864=loadSection;window.tasneefRefreshActiveSectionV10864=refreshActive;
  window.refreshSupervisorProjectsV10816=async()=>{const s=await supervisorScope(true);data().projects=s.projects;fillSupervisorProjects(s);return s;};
  ['V10847','V10848','V10849','V10868','V10870','V10872'].forEach(v=>window['refreshSupervisorProjectsUnified4'+v]=window.refreshSupervisorProjectsV10816);
  window.tasneefRefreshTicketsV10859=async(force=true)=>{const all=await tickets(force);if(role()==='supervisor'){const s=state.supervisor||await supervisorScope(false);data().tickets=scopedTickets(all,s);}else data().tickets=all;try{window.renderTickets?.();}catch(_){}return data().tickets;};
  window.tasneefRefreshTicketsV10519=window.tasneefRefreshTicketsV10859;

  // Replace ProjectsService with the same canonical project scope.
  window.ProjectsService={version:BUILD,async resolveCurrentSupervisorId(){return S(sessionUser().id||sessionUser().user_id||sessionUser().supervisor_id||sessionUser().employee_id);},async getAccessibleProjects(userId,userRole,filters={}){if(S(userRole)!=='supervisor')return A(await projects(!!filters.force)).filter(activeProject);const s=await supervisorScope(!!filters.force);return s.projects;},clearUserCache(){delete state.master['supervisorAssignments:'+S(sessionUser().id)+':'+monthNow()];state.supervisor=null;}};

  // Explicit user filter/date changes are intentional refreshes.
  document.addEventListener('change',e=>{const id=e.target?.id||'';if(['dailyDate','dailyDateFromV10310','dailyDateToV10310','attendanceFilterDate','attendanceMatrixMonth','monthlyMonth','mc401Month','attendanceDate','summaryRange','summaryDate'].includes(id))setTimeout(()=>refreshActive().catch(console.warn),10);},true);

  // Mutations invalidate only the affected master datasets. Existing code's refreshAll then reloads current section.
  window.addEventListener('tasneef:project-updated',()=>{invalidate(['projects']);state.supervisor=null;});
  window.addEventListener('tasneef:data-mutated-v10900',e=>{invalidate(A(e.detail?.resources));});

  window.TasneefDataKernelV10900=window.TasneefDataKernelV10902={build:BUILD,state,loadSection,refreshActive,loadProjects:projects,loadUsers:users,loadWorkers:workers,loadTickets:tickets,supervisorScope,invalidate,status:()=>({build:BUILD,role:role(),loadedSections:[...state.loadedSections],inflight:[...state.inflight.keys()],master:Object.fromEntries(Object.entries(state.master).map(([k,v])=>[k,Array.isArray(v)?v.length:(v?.projectIds?.size??'ready')])),errors:state.errors,supervisorProjects:state.supervisor?.projects?.length||0})};
  console.info(BUILD,'loaded');
})();
