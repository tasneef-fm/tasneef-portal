/* TASNEEF V10902 — Session-stable project selection
   Fixes project selects that briefly show a choice then reset to the placeholder.
   Rules:
   - User selection is authoritative for the current browser session.
   - Async/programmatic select rebuilds cannot erase a confirmed choice.
   - No polling. MutationObserver only reacts when the select is actually rebuilt.
   - Stored values from an older page load are restored only after the project is confirmed
     in the current authorized option list; stale projects are never injected on first load.
*/
(function(){
  'use strict';
  if(window.__tasneefProjectSelectionStabilityV10902) return;
  window.__tasneefProjectSelectionStabilityV10902=true;

  const BUILD='V10902_SESSION_STABLE_PROJECT_SELECTION';
  const IDS=['logProject','ticketProject','techNewTicketProject'];
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const live=new Map(); // id -> {value,text,confirmed}
  const observers=new WeakMap();

  function currentUser(){
    try{if(typeof window.session==='function'){const u=window.session();if(u)return u;}}catch(_){}
    try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}
  }
  function userKey(){
    const u=currentUser();
    return S(u.id||u.user_id||u.employee_id||u.username||u.email||'anonymous').replace(/[^\w\-@.]/g,'_');
  }
  function storageKey(id){return 'tasneef_v10902_project_choice:'+userKey()+':'+id;}
  function readStored(id){
    try{return JSON.parse(sessionStorage.getItem(storageKey(id))||localStorage.getItem(storageKey(id))||'null');}catch(_){return null;}
  }
  function store(id,value,text){
    const row=value?{value:S(value),text:S(text),at:Date.now()}:null;
    try{
      if(row){const raw=JSON.stringify(row);sessionStorage.setItem(storageKey(id),raw);localStorage.setItem(storageKey(id),raw);}
      else{sessionStorage.removeItem(storageKey(id));localStorage.removeItem(storageKey(id));}
    }catch(_){}
  }
  function optionFor(el,value){return [...(el?.options||[])].find(o=>S(o.value)===S(value));}
  function currentText(el){return S(el?.selectedOptions?.[0]?.textContent||'');}

  function markConfirmed(id,value,text){
    value=S(value); if(!value)return;
    live.set(id,{value,text:S(text)||value,confirmed:true});
    store(id,value,text||value);
  }

  function confirmFromSelect(id){
    const el=$(id);if(!el)return;
    const current=S(el.value);
    if(current){markConfirmed(id,current,currentText(el));return;}
    // On a fresh page only trust persisted selection if it is present in the newly loaded authorized list.
    const saved=readStored(id);
    if(saved?.value){
      const opt=optionFor(el,saved.value);
      if(opt){
        markConfirmed(id,saved.value,opt.textContent);
        el.value=S(saved.value);
      }
    }
  }

  function get(id){
    const row=live.get(id);
    return row?.confirmed?S(row.value):'';
  }

  let healing=false;
  function heal(id){
    if(healing)return false;
    const el=$(id),row=live.get(id);
    if(!el||!row?.confirmed||!row.value)return false;
    healing=true;
    try{
      let opt=optionFor(el,row.value);
      if(!opt){
        // This value was already authorized/selected in THIS page session. Re-add it when a legacy
        // async loader temporarily replaces the list with a narrower/placeholder-only version.
        opt=document.createElement('option');
        opt.value=row.value;
        opt.textContent=row.text||row.value;
        el.appendChild(opt);
      }
      if(S(el.value)!==row.value)el.value=row.value;
      return S(el.value)===row.value;
    }finally{healing=false;}
  }

  function bind(id){
    const el=$(id);if(!el||el.dataset.v10902ProjectSelectionBound==='1')return;
    el.dataset.v10902ProjectSelectionBound='1';

    // First authorized population may contain a stored value; confirm it only if it really exists now.
    confirmFromSelect(id);

    el.addEventListener('change',e=>{
      const value=S(el.value);
      if(value){markConfirmed(id,value,currentText(el));return;}
      // Only a real user choosing the placeholder may clear a confirmed choice.
      // Programmatic change events from legacy loaders are ignored.
      if(e.isTrusted){live.delete(id);store(id,'','');}
      else queueMicrotask(()=>heal(id));
    },true);

    el.addEventListener('input',e=>{
      if(e.isTrusted&&S(el.value))markConfirmed(id,el.value,currentText(el));
    },true);

    const mo=new MutationObserver(()=>{
      // If this is the first legitimate population, confirm stored/current value.
      if(!live.get(id)?.confirmed)confirmFromSelect(id);
      queueMicrotask(()=>heal(id));
      requestAnimationFrame(()=>heal(id));
    });
    mo.observe(el,{childList:true,subtree:true,characterData:true});
    observers.set(el,mo);
  }

  function bindAll(){IDS.forEach(bind);IDS.forEach(id=>{confirmFromSelect(id);heal(id);});}
  function snapshot(id){
    const el=$(id),value=S(el?.value)||get(id);
    if(value)markConfirmed(id,value,currentText(el)||live.get(id)?.text||value);
    return value;
  }
  function restoreSnapshot(id,value){
    value=S(value);if(!value)return;
    const row=live.get(id)||{};
    markConfirmed(id,value,row.text||optionFor($(id),value)?.textContent||value);
    heal(id);queueMicrotask(()=>heal(id));requestAnimationFrame(()=>heal(id));
  }

  function wrapAction(name,id){
    const original=window[name];
    if(typeof original!=='function'||original.__v10902ProjectSelectionWrapped)return;
    const wrapped=async function(){
      const chosen=snapshot(id);
      if(!chosen)return original.apply(this,arguments);
      try{return await original.apply(this,arguments);}
      finally{restoreSnapshot(id,chosen);}
    };
    wrapped.__v10902ProjectSelectionWrapped=true;
    window[name]=wrapped;
  }

  function wrapClear(name,id){
    const original=window[name];
    if(typeof original!=='function'||original.__v10902ProjectSelectionWrapped)return;
    const wrapped=function(){
      const chosen=snapshot(id);
      const result=original.apply(this,arguments);
      if(chosen)restoreSnapshot(id,chosen);
      return result;
    };
    wrapped.__v10902ProjectSelectionWrapped=true;
    window[name]=wrapped;
  }

  function installGuards(){
    wrapAction('supervisorCheckIn','logProject');
    wrapAction('supervisorCheckOut','logProject');
    wrapAction('supervisorExitSelectedWorkers','logProject');
    wrapAction('saveTimeLog','logProject');
    wrapAction('saveTicket','ticketProject');
    wrapAction('saveTechnicianTicket','techNewTicketProject');
    wrapClear('clearTicketForm','ticketProject');
    wrapClear('clearTechnicianTicketForm','techNewTicketProject');
  }

  window.addEventListener('tasneef:data-loaded-v10863',()=>{bindAll();installGuards();});
  window.addEventListener('tasneef:project-updated',()=>{bindAll();installGuards();});
  document.addEventListener('DOMContentLoaded',()=>{bindAll();installGuards();setTimeout(()=>{bindAll();installGuards();},100);});
  window.addEventListener('load',()=>{bindAll();installGuards();setTimeout(()=>{bindAll();installGuards();},200);});

  bindAll();installGuards();
  window.TasneefProjectSelectionV10902={build:BUILD,get,confirmFromSelect,remember:()=>IDS.forEach(id=>{const el=$(id);if(S(el?.value))markConfirmed(id,el.value,currentText(el));}),heal:()=>IDS.forEach(heal),status:()=>Object.fromEntries([...live.entries()])};
  console.info(BUILD,'loaded');
})();
