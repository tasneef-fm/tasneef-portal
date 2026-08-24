/* TASNEEF V10859 — instant navigation + authoritative ticket sync
   Loaded LAST. It deliberately does not call legacy showPage wrappers that refresh
   whole tables when a user only changes a menu/tab.
*/
(function(){
  'use strict';
  if(window.__tasneefNavTicketSyncV10859) return;
  window.__tasneefNavTicketSyncV10859=true;
  const BUILD='V10859_NAV_CLIENT_TICKETS';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];

  const PAGE_PERMS={dashboard:'dashboard.view',users:'users.view',projects:'projects.view',workers:'workers.view',distribution:'distribution.view',attendance:'attendance.view',daily:'checkin_checkout.view',monthly:'monthly_times.view',salaries:'payroll.view',contracts:'contracts.view',crm:'crm.view',tickets:'tickets.view',orders:'orders.view',inventoryAudit:'inventory.view',alerts:'notifications.view',export:'export_center.view',assistant:'assistant.view',adminTasks:'notifications.manage'};
  const SUP_PERMS={supSummary:'dashboard.view',supAttendance:'attendance.view',supLogs:'checkin_checkout.view',supTickets:'tickets.view',supOrders:'orders.view',supClientDailyReport:'supervisor_reports.view',supAdminTasks:'notifications.view'};
  const TECH_PERMS={techOpen:'tickets.view',techMine:'tickets.view',techDone:'tickets.view',techAttendanceTab:'attendance.view',techTicketsTab:'tickets.view'};

  function allow(key){
    if(!key) return true;
    try{ if(window.PermissionsService?.require) return !!window.PermissionsService.require(key); }catch(_){ }
    try{ if(typeof window.requirePermission==='function') return !!window.requirePermission(key); }catch(_){ }
    return true;
  }
  function safe(fn){ try{ return typeof window[fn]==='function' ? window[fn]() : undefined; }catch(e){ console.warn(BUILD,fn,e); } }
  function activeAdmin(id){ const p=$(id); return !!p && !p.classList.contains('hidden') && p.style.display!=='none'; }
  function activeSup(id){ return !!$(id)?.classList.contains('active'); }
  function activeTechMain(id){ return !!$(id)?.classList.contains('active'); }
  function inTicketView(){ return activeAdmin('tickets') || activeSup('supTickets') || activeTechMain('techTicketsTab'); }

  // ----- Ticket sync -----
  let ticketPromise=null, lastFetch=0, ticketVersion=0;
  function token(){ return S(localStorage.getItem('tasneef_session_token_v10817')||localStorage.getItem('tasneef_session_token')||''); }
  function ticketSignature(rows){
    return A(rows).map(t=>[t.id,t.updated_at,t.status,t.claimed_by,t.closed_by].map(S).join(':')).join('|');
  }
  async function fetchTickets(force=false){
    if(!window.sb?.rpc) return A(window.data?.tickets);
    if(ticketPromise) return ticketPromise;
    if(!force && Date.now()-lastFetch<2500) return A(window.data?.tickets);
    ticketPromise=(async()=>{
      const sessionToken=token();
      if(!sessionToken) return A(window.data?.tickets);
      let r=await window.sb.rpc('tasneef_tickets_all_v10859',{p_session_token:sessionToken});
      if(r.error){
        console.warn(BUILD,'V10859 RPC fallback:',r.error.message||r.error);
        r=await window.sb.rpc('tasneef_tickets_all_v10857',{p_session_token:sessionToken});
      }
      if(r.error) throw r.error;
      const rows=A(r.data);
      window.data=window.data||{};
      const changed=ticketSignature(rows)!==ticketSignature(window.data.tickets);
      window.data.tickets=rows;
      lastFetch=Date.now();
      if(changed){ ticketVersion++; window.__tasneefTicketDataVersionV10859=ticketVersion; }
      renderActiveTicketView(changed);
      return rows;
    })().catch(e=>{console.error(BUILD,'ticket sync',e);return A(window.data?.tickets);}).finally(()=>{ticketPromise=null;});
    return ticketPromise;
  }
  window.tasneefRefreshTicketsV10859=fetchTickets;
  window.tasneefRefreshTicketsV10519=fetchTickets;

  function renderActiveTicketView(changed=true){
    requestAnimationFrame(()=>{
      if(activeAdmin('tickets') || activeSup('supTickets')){
        try{ if(typeof window.renderTickets==='function') window.renderTickets(); }catch(e){console.warn(BUILD,e);}
      }
      if(activeTechMain('techTicketsTab')){
        const v=window.__tasneefTicketDataVersionV10859||0;
        if(changed || window.__tasneefTechRenderedTicketVersionV10859!==v){
          try{ if(typeof window.renderTechnicianTickets==='function') window.renderTechnicianTickets(); }catch(e){console.warn(BUILD,e);}
          window.__tasneefTechRenderedTicketVersionV10859=v;
        }
      }
    });
  }

  // ----- Admin router: visual switch first, work second. No refreshAll/loadAll. -----
  const adminRendered=new Set();
  const adminRender={
    dashboard:()=>{safe('renderDashboard');safe('renderAlerts');},
    daily:()=>{ if(!adminRendered.has('daily') && typeof window.renderTimeLogs==='function') Promise.resolve(window.renderTimeLogs()).catch(()=>{}); },
    users:()=>safe('renderUsers'),
    projects:()=>safe('renderProjects'),
    workers:()=>safe('renderWorkers'),
    attendance:()=>{safe('renderAttendance');safe('renderAttendanceMonthly');},
    monthly:()=>{}, // V10864 loads the selected month from server after the section becomes active
    tickets:()=>{safe('renderTickets');fetchTickets(true);},
    alerts:()=>safe('renderAlerts'),
    assistant:()=>safe('renderTasneefAssistant'),
    contracts:()=>{safe('renderContractServices');try{window.showContractsSubTab?.('services');}catch(_){}},
    orders:()=>{ try{ if(window.tasneefOrders10400?.render) window.tasneefOrders10400.render(); else safe('renderOrdersV233'); }catch(_){} },
    crm:()=>{ try{window.tasneefCrmUnifiedV10600?.render?.();}catch(_){} },
    export:()=>{ try{window.previewMeetingExportV223?.();}catch(_){} }
  };
  window.showPage=function(id,btn){
    if(!allow(PAGE_PERMS[id])) return false;
    document.querySelectorAll('section.page,.page').forEach(p=>{p.classList.add('hidden'); if(p.id!==id)p.style.removeProperty('display');});
    const page=$(id); if(page){page.classList.remove('hidden');page.style.removeProperty('display');}
    document.querySelectorAll('.side .nav,.nav').forEach(n=>n.classList.remove('active'));
    btn?.classList.add('active');
    document.documentElement.dataset.tasneefPageV10859=id;
    requestAnimationFrame(()=>setTimeout(()=>{
      try{ adminRender[id]?.(); }catch(e){console.warn(BUILD,'admin render',id,e);}
      adminRendered.add(id);
    },0));
    return true;
  };
  window.showPage.__permissionsV10817=true;

  // ----- Supervisor router -----
  window.showSupervisorWindow=function(id,btn){
    if(!allow(SUP_PERMS[id])) return false;
    document.querySelectorAll('.sup-page').forEach(p=>p.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelectorAll('.sup-tab').forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    requestAnimationFrame(()=>setTimeout(()=>{
      if(id==='supAttendance'){} // V10864 owns the authoritative attendance load for the active section
      if(id==='supTickets'){ safe('renderTickets'); fetchTickets(true); }
      if(id==='supSummary') safe('renderSupervisorDailySummary');
    },0));
    return true;
  };
  window.showSupervisorWindow.__permissionsV10817=true;

  // ----- Technician main/sub routers -----
  window.showTechMainTab=function(id,btn){
    if(!allow(TECH_PERMS[id])) return false;
    document.querySelectorAll('.tech-main-page').forEach(p=>p.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelectorAll('.tech-main-tab').forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    requestAnimationFrame(()=>setTimeout(()=>{
      if(id==='techAttendanceTab') safe('renderTechAttendance');
      if(id==='techTicketsTab'){
        const v=window.__tasneefTicketDataVersionV10859||0;
        if(window.__tasneefTechRenderedTicketVersionV10859!==v || !document.querySelector('#techOpenTicketsBody tr')){
          safe('renderTechnicianTickets');
          window.__tasneefTechRenderedTicketVersionV10859=v;
        }
        fetchTickets(true);
      }
    },0));
    return true;
  };
  window.showTechMainTab.__permissionsV10817=true;
  window.showTechMainTabById=function(id){
    const btn=[...document.querySelectorAll('.tech-main-tab')].find(b=>S(b.getAttribute('onclick')).includes(id));
    return window.showTechMainTab(id,btn);
  };
  window.showTechWindow=function(id,btn){
    if(!allow(TECH_PERMS[id]||'tickets.view')) return false;
    document.querySelectorAll('.tech-page').forEach(p=>p.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelectorAll('.tech-ticket-tab,.tech-tab').forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    const v=window.__tasneefTicketDataVersionV10859||0;
    if(window.__tasneefTechRenderedTicketVersionV10859!==v){
      requestAnimationFrame(()=>{safe('renderTechnicianTickets');window.__tasneefTechRenderedTicketVersionV10859=v;});
    }
    return true;
  };
  window.showTechWindow.__permissionsV10817=true;

  // Client ticket changed in another tab on the same device.
  window.addEventListener('storage',e=>{
    if(['tasneef_client_ticket_changed_v10519','tasneef_client_ticket_changed_v10520','tasneef_client_ticket_changed_v10857','tasneef_client_ticket_changed_v10859'].includes(e.key)) fetchTickets(true);
  });

  // A lightweight active-view refresh. It does nothing while the user is in other menus.
  setInterval(()=>{ if(!document.hidden && inTicketView()) fetchTickets(false); },30000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && inTicketView()) fetchTickets(false); });

  // Initial authoritative ticket feed for all application roles, including technician.
  const boot=()=>setTimeout(()=>{ if(inTicketView()) fetchTickets(true); },1100);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();

  console.info(BUILD,'loaded');
})();
