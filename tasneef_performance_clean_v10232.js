/* V10232 - Performance Clean
   هدفه تقليل Disk IO: تحميل محدود حسب الشهر، كاش قصير، ومنع التحديث المتكرر.
   لا يحذف ولا يغير أي بيانات. */
(function(){
  'use strict';
  const VERSION='V10232';
  window.__tasneefPerformanceCleanV10232 = true;
  const TTL = 45 * 1000; // كاش قصير 45 ثانية لتقليل الضغط عند التنقل بين الأقسام
  const state = { cache:new Map(), inflight:null, lastLoadAt:0 };
  const S = v => (v==null?'':String(v));
  const today = () => new Date().toISOString().slice(0,10);
  function ym(){
    const ids=['attendanceMatrixMonth','salaryMonth','monthlyMonth','ticketsMonth'];
    for(const id of ids){ const el=document.getElementById(id); if(el && el.value && /^\d{4}-\d{2}/.test(el.value)) return el.value.slice(0,7); }
    return today().slice(0,7);
  }
  function monthStart(m){ return `${m}-01`; }
  function monthEnd(m){ const [y,mo]=m.split('-').map(Number); return new Date(y,mo,0).toISOString().slice(0,10); }
  function addDays(ds,n){ const d=new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
  function now(){ return Date.now(); }
  async function cached(key, fn, ttl=TTL){
    const c=state.cache.get(key);
    if(c && (now()-c.t)<ttl) return c.v;
    const v = await fn();
    state.cache.set(key,{t:now(),v});
    return v;
  }
  async function safe(label, query){
    try{
      const r=await query;
      if(r && r.error){ console.warn('[V10232]',label,r.error.message); return {data:[], error:r.error}; }
      return r || {data:[]};
    }catch(e){ console.warn('[V10232]',label,e?.message||e); return {data:[], error:e}; }
  }
  async function fetchPaged(label, makeQuery, pageSize=1000, maxPages=6){
    const out=[];
    for(let page=0; page<maxPages; page++){
      const from=page*pageSize, to=from+pageSize-1;
      const r = await safe(label+' page '+(page+1), makeQuery().range(from,to));
      const rows = r.data || [];
      out.push(...rows);
      if(rows.length < pageSize) break;
      await new Promise(res=>setTimeout(res,25));
    }
    return out;
  }
  function setVersionBadges(){
    document.querySelectorAll('[id*="version"], .version, .build-version').forEach(el=>{
      if(S(el.textContent).match(/^V10/)) el.textContent=VERSION;
    });
    const pages=['attendance','tickets','salary','salaries','inventory'];
    pages.forEach(id=>{
      const sec=document.getElementById(id); if(!sec) return;
      if(!sec.querySelector('.perf-v10232-badge')){
        const b=document.createElement('small'); b.className='perf-v10232-badge'; b.style.cssText='display:inline-block;margin:4px;color:#0A4033;font-weight:700'; b.textContent=VERSION+' أداء';
        const h=sec.querySelector('h2,h1'); if(h) h.insertAdjacentElement('afterend',b);
      }
    });
  }
  async function optimizedLoadAll(){
    if(state.inflight && (now()-state.lastLoadAt)<8000) return state.inflight;
    state.lastLoadAt = now();
    state.inflight = (async()=>{
      if(typeof sb==='undefined' || typeof data==='undefined') return;
      const m=ym(), start=monthStart(m), end=monthEnd(m);
      const recentStart=addDays(today(),-35);
      const baseTTL=120000;
      const usersP = cached('users', ()=>safe('المستخدمين', sb.from('app_users').select('*').order('id')), baseTTL);
      const projectsP = cached('projects', ()=>safe('المشاريع', sb.from('projects').select('*').order('id')), baseTTL);
      const workersP = cached('workers', ()=>safe('العمال', sb.from('workers').select('*').order('id')), baseTTL);
      const attendanceP = fetchPaged('الحضور '+m, ()=>sb.from('attendance').select('*').gte('attendance_date',start).lte('attendance_date',end).order('attendance_date',{ascending:false}), 1000, 8);
      const logsP = fetchPaged('سجلات الدخول '+m, ()=>sb.from('time_logs').select('*').gte('log_date',start).lte('log_date',end).order('log_date',{ascending:false}), 1000, 4);
      const ticketsP = cached('tickets_recent', ()=>safe('التكتات', sb.from('tickets').select('*').order('created_at',{ascending:false}).limit(350)), 30000);
      const servicesP = cached('contract_services_recent', ()=>safe('الخدمات', sb.from('contract_services').select('*').order('id',{ascending:false}).limit(600)), baseTTL);
      const [users, projects, workers, attendance, logs, tickets, services] = await Promise.all([usersP,projectsP,workersP,attendanceP,logsP,ticketsP,servicesP]);
      data.users = users.data || [];
      data.supervisors = data.users.filter(u=>u.role==='supervisor' && u.is_active!==false);
      data.technicians = data.users.filter(u=>u.role==='technician' && u.is_active!==false);
      data.projects = projects.data || [];
      data.workers = workers.data || [];
      data.attendance = attendance || [];
      data.logs = logs || [];
      data.tickets = tickets.data || [];
      data.contractServices = services.data || [];
      setVersionBadges();
    })().finally(()=>{ setTimeout(()=>{state.inflight=null;},500); });
    return state.inflight;
  }
  function clearCache(){ state.cache.clear(); }
  window.tasneefClearPerfCacheV10232 = clearCache;
  window.loadAll = optimizedLoadAll;
  window.refreshAll = async function(){
    try{ await optimizedLoadAll(); }
    catch(e){ console.error('[V10232] load failed',e); if(typeof msg==='function') msg('تعذر تحميل بعض البيانات، حاول تحديث الصفحة','err'); }
    try{ if(typeof hydrateForms==='function') hydrateForms(); }catch(e){}
    try{ if(typeof renderAll==='function') renderAll(); }catch(e){ console.warn('[V10232] render failed',e); }
    setVersionBadges();
  };
  // عند الحفظ/الحذف في أي قسم، امسح الكاش حتى تظهر البيانات الجديدة.
  const wrapNames=['saveAttendance','saveSupervisorAttendance','saveTicket','saveSalaryChanges','approveSalaries','financeSaveItem','financeSaveMovement','saveInventoryRequest'];
  function wrapLater(){
    wrapNames.forEach(n=>{
      const fn=window[n]; if(typeof fn==='function' && !fn.__v10232Wrapped){
        const w=async function(...args){ const r=await fn.apply(this,args); clearCache(); return r; };
        w.__v10232Wrapped=true; window[n]=w;
      }
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(wrapLater,1200); setVersionBadges();});
  setTimeout(wrapLater,2500);
})();
