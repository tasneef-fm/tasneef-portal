/* TASNEEF V10901 — Stable project selection for supervisor/technician actions
   Prevents async select re-population from clearing a project chosen by the user.
   No polling. Values are stored per signed-in user and restored only when the option exists.
*/
(function(){
  'use strict';
  if(window.__tasneefProjectSelectionStabilityV10901) return;
  window.__tasneefProjectSelectionStabilityV10901 = true;

  const BUILD='V10901_PROJECT_SELECTION_STABILITY';
  const IDS=['logProject','ticketProject','techNewTicketProject'];
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();

  function currentUser(){
    try{ if(typeof window.session==='function'){ const u=window.session(); if(u) return u; } }catch(_){ }
    try{ return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{}; }catch(_){ return {}; }
  }
  function userKey(){
    const u=currentUser();
    return S(u.id||u.user_id||u.employee_id||u.username||u.email||'anonymous').replace(/[^\w\-@.]/g,'_');
  }
  function key(id){ return 'tasneef_v10901_project_choice:'+userKey()+':'+id; }
  function read(id){ try{return S(sessionStorage.getItem(key(id))||localStorage.getItem(key(id)));}catch(_){return '';} }
  function write(id,value){
    value=S(value);
    try{
      if(value){ sessionStorage.setItem(key(id),value); localStorage.setItem(key(id),value); }
      else{ sessionStorage.removeItem(key(id)); localStorage.removeItem(key(id)); }
    }catch(_){ }
  }
  function hasOption(el,value){ return !!(el&&value&&Array.from(el.options||[]).some(o=>S(o.value)===S(value))); }

  function remember(id){ const el=$(id); if(el) write(id,el.value); }
  function restore(id,preferred){
    const el=$(id); if(!el) return false;
    const value=S(preferred||read(id));
    if(!value || !hasOption(el,value)) return false;
    if(S(el.value)!==value) el.value=value;
    return S(el.value)===value;
  }

  const observers=new WeakMap();
  function bind(id){
    const el=$(id); if(!el || el.dataset.v10901ProjectSelectionBound==='1') return;
    el.dataset.v10901ProjectSelectionBound='1';

    // User choice is authoritative. Selecting the empty placeholder intentionally clears memory.
    el.addEventListener('change',()=>write(id,el.value),true);
    el.addEventListener('input',()=>{ if(el.value) write(id,el.value); },true);

    restore(id);
    const observer=new MutationObserver(()=>{
      // Rebuilds are synchronous but option insertion can happen in batches; restore on next microtask/frame.
      queueMicrotask(()=>restore(id));
      requestAnimationFrame(()=>restore(id));
    });
    observer.observe(el,{childList:true,subtree:true});
    observers.set(el,observer);
  }

  function bindAll(){ IDS.forEach(bind); IDS.forEach(id=>restore(id)); }
  function snapshot(id){ const el=$(id); const v=S(el?.value)||read(id); if(v) write(id,v); return v; }
  function restoreSnapshot(id,v){ if(v) write(id,v); restore(id,v); setTimeout(()=>restore(id,v),0); setTimeout(()=>restore(id,v),80); }

  function wrapAction(name,id){
    const original=window[name];
    if(typeof original!=='function' || original.__v10901ProjectSelectionWrapped) return;
    const wrapped=async function(){
      const chosen=snapshot(id);
      restoreSnapshot(id,chosen);
      try{ return await original.apply(this,arguments); }
      finally{ restoreSnapshot(id,chosen); }
    };
    wrapped.__v10901ProjectSelectionWrapped=true;
    window[name]=wrapped;
    try{ eval(name+' = window[name]'); }catch(_){ }
  }

  function installActionGuards(){
    wrapAction('supervisorCheckIn','logProject');
    wrapAction('supervisorCheckOut','logProject');
    wrapAction('supervisorExitSelectedWorkers','logProject');
    wrapAction('saveTimeLog','logProject');
    wrapAction('saveTicket','ticketProject');
    wrapAction('saveTechnicianTicket','techNewTicketProject');

    // A technician's "clear/new ticket" should clear the ticket details, not the chosen project.
    const oldTechClear=window.clearTechnicianTicketForm;
    if(typeof oldTechClear==='function'&&!oldTechClear.__v10901ProjectSelectionWrapped){
      const wrapped=function(){
        const chosen=snapshot('techNewTicketProject');
        const result=oldTechClear.apply(this,arguments);
        restoreSnapshot('techNewTicketProject',chosen);
        return result;
      };
      wrapped.__v10901ProjectSelectionWrapped=true;
      window.clearTechnicianTicketForm=wrapped;
      try{ clearTechnicianTicketForm=window.clearTechnicianTicketForm; }catch(_){ }
    }

    // Supervisor ticket reset already normally keeps project; enforce it against legacy overrides.
    const oldSupClear=window.clearTicketForm;
    if(typeof oldSupClear==='function'&&!oldSupClear.__v10901ProjectSelectionWrapped){
      const wrapped=function(){
        const chosen=snapshot('ticketProject');
        const result=oldSupClear.apply(this,arguments);
        restoreSnapshot('ticketProject',chosen);
        return result;
      };
      wrapped.__v10901ProjectSelectionWrapped=true;
      window.clearTicketForm=wrapped;
      try{ clearTicketForm=window.clearTicketForm; }catch(_){ }
    }
  }

  // Restore after the unified data kernel refreshes/rebuilds section selects.
  window.addEventListener('tasneef:data-loaded-v10863',()=>{ bindAll(); IDS.forEach(id=>restore(id)); });
  window.addEventListener('tasneef:project-updated',()=>setTimeout(bindAll,0));

  document.addEventListener('DOMContentLoaded',()=>{
    bindAll();
    installActionGuards();
    setTimeout(()=>{bindAll();installActionGuards();},120);
  });
  window.addEventListener('load',()=>{
    bindAll();
    installActionGuards();
    setTimeout(()=>{bindAll();installActionGuards();},250);
  });

  // Script is loaded last, so this catches the normal path immediately too.
  bindAll();
  installActionGuards();

  window.TasneefProjectSelectionV10901={build:BUILD,restore:()=>{bindAll();IDS.forEach(id=>restore(id));},remember:()=>IDS.forEach(remember)};
  console.info(BUILD,'loaded');
})();
