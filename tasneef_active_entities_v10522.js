(function(){
'use strict';
if(window.__tasneefActiveEntitiesV10522)return; window.__tasneefActiveEntitiesV10522=true;
const S=v=>String(v??'').trim();
const inactiveWords=new Set(['inactive','stopped','disabled','موقوف','متوقف','غير نشط','غيرنشط','خارج العمل']);
const isActive=x=>x && x.is_active===true && !inactiveWords.has(S(x.status).toLowerCase());
let activeWorkers=new Set(), activeProjects=new Set(), loading=false;
const operationalSectionIds=new Set(['distribution','attendance','dailyLogs','monthlyTimes','salaries','contracts','orders','tickets','unifiedSystem','supervisorAttendance','supervisorDailyLogs']);
function inManagement(el){return !!el.closest('#workers,#projects,#stoppedWorkers,#stoppedProjects,.wk386-root,.tp390-root');}
function isOperational(el){if(inManagement(el))return false; let p=el; while(p&&p!==document.body){if(p.id&&operationalSectionIds.has(p.id))return true;p=p.parentElement;} return true;}
function idFromOption(o){return S(o.value||o.dataset.id||'');}
function pruneSelect(sel){if(!isOperational(sel))return; const key=S(sel.id+' '+sel.name+' '+sel.dataset.source).toLowerCase(); const workerish=/worker|employee|عامل|موظف/.test(key); const projectish=/project|مشروع/.test(key); if(!workerish&&!projectish)return; [...sel.options].forEach(o=>{if(!o.value)return; const ok=workerish?activeWorkers.has(idFromOption(o)):activeProjects.has(idFromOption(o)); if(!ok)o.remove();});}
function pruneDom(){document.querySelectorAll('select').forEach(pruneSelect);}
async function refresh(){if(loading||!window.sb)return;loading=true;try{
 const [w,p]=await Promise.all([window.sb.from('active_workers').select('id,employee_code,worker_code,code').limit(50000),window.sb.from('active_projects').select('id').limit(10000)]);
 if(!w.error){activeWorkers=new Set();(w.data||[]).forEach(x=>[x.id,x.employee_code,x.worker_code,x.code].filter(v=>v!=null).forEach(v=>activeWorkers.add(S(v))));}
 if(!p.error){activeProjects=new Set((p.data||[]).map(x=>S(x.id)));}
 try{sessionStorage.removeItem('td404_employees');sessionStorage.removeItem('td404_projects');sessionStorage.removeItem('tasneef_workers_cache');sessionStorage.removeItem('tasneef_projects_cache');}catch(_){ }
 if(window.data){if(Array.isArray(window.data.workers))window.data.workers=window.data.workers.filter(isActive);if(Array.isArray(window.data.projects))window.data.projects=window.data.projects.filter(isActive);}
 pruneDom();
 document.dispatchEvent(new CustomEvent('tasneef:active-entities-updated',{detail:{workers:activeWorkers.size,projects:activeProjects.size}}));
}catch(e){console.warn('V10522 active refresh',e);}finally{loading=false;}}
const mo=new MutationObserver(()=>{clearTimeout(window.__ae522t);window.__ae522t=setTimeout(pruneDom,80)});mo.observe(document.documentElement,{subtree:true,childList:true});
window.tasneefRefreshActiveEntities=refresh;
window.tasneefEntityIsActive=isActive;
window.addEventListener('load',()=>{setTimeout(refresh,400);setInterval(refresh,20000)});
window.addEventListener('storage',e=>{if(e.key==='tasneef_active_entities_changed')refresh()});
const wrapStop=(name,type)=>{const old=window[name];if(typeof old!=='function'||old.__ae522)return; const f=async function(id){const out=await old.apply(this,arguments);try{localStorage.setItem('tasneef_active_entities_changed',Date.now());}catch(_){} await refresh();return out};f.__ae522=true;window[name]=f;};
setInterval(()=>{wrapStop('toggleWorkerStatus','worker');wrapStop('toggleProjectStatus','project');},1000);
})();
