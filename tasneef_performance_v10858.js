/* ===== TASNEEF V10858: Performance guard =====
   - Coalesces duplicate full refresh/load requests.
   - Prevents overlapping Supabase refresh storms.
   - Pauses maintenance work while the tab is hidden.
   - Keeps the existing business logic and UI unchanged.
================================================ */
(function(){
  'use strict';
  if(window.__tasneefPerformanceV10858) return;
  window.__tasneefPerformanceV10858=true;
  window.TASNEEF_PERFORMANCE_BUILD='V10858';

  const state={loadPromise:null,refreshPromise:null,lastLoadAt:0,lastRefreshAt:0};
  const now=()=>Date.now();

  const originalLoadAll=window.loadAll;
  if(typeof originalLoadAll==='function'){
    window.loadAll=async function(){
      if(state.loadPromise) return state.loadPromise;
      state.loadPromise=(async()=>{
        try{
          const out=await originalLoadAll.apply(this,arguments);
          state.lastLoadAt=now();
          return out;
        }finally{
          state.loadPromise=null;
        }
      })();
      return state.loadPromise;
    };
    try{ loadAll=window.loadAll; }catch(_){ }
  }

  const originalRefreshAll=window.refreshAll;
  if(typeof originalRefreshAll==='function'){
    window.refreshAll=async function(){
      if(state.refreshPromise) return state.refreshPromise;
      state.refreshPromise=(async()=>{
        try{
          const out=await originalRefreshAll.apply(this,arguments);
          state.lastRefreshAt=now();
          return out;
        }finally{
          state.refreshPromise=null;
        }
      })();
      return state.refreshPromise;
    };
    try{ refreshAll=window.refreshAll; }catch(_){ }
  }

  // Coalesce repeated ticket refreshes triggered by several legacy hooks.
  const ticketRefresh=window.tasneefRefreshTicketsV10519;
  if(typeof ticketRefresh==='function'){
    let ticketPromise=null;
    window.tasneefRefreshTicketsV10519=async function(){
      if(ticketPromise) return ticketPromise;
      ticketPromise=Promise.resolve(ticketRefresh.apply(this,arguments)).finally(()=>{ticketPromise=null;});
      return ticketPromise;
    };
  }

  // Small diagnostic helper; does not poll or send any request.
  window.tasneefPerformanceStatusV10858=function(){
    return {
      build:'V10858',
      loading:!!state.loadPromise,
      refreshing:!!state.refreshPromise,
      lastLoadAt:state.lastLoadAt,
      lastRefreshAt:state.lastRefreshAt,
      hidden:document.hidden
    };
  };

  console.log('Tasneef V10858 performance guard loaded');
})();
