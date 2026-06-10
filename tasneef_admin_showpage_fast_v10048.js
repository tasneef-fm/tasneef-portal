(function(){
  'use strict';
  if(window.__tasneefAdminShowPageFastV10048) return;
  window.__tasneefAdminShowPageFastV10048 = true;

  const S = v => String(v ?? '').trim();
  const $ = id => document.getElementById(id);

  function pageFromButton(btn){
    if(!btn) return '';
    const dp = S(btn.dataset && btn.dataset.page);
    if(dp) return dp;
    const oc = S(btn.getAttribute('onclick'));
    const m = oc.match(/showPage\(['"]([^'"]+)['"]/);
    return m ? m[1] : '';
  }

  function activateButton(id, btn){
    document.querySelectorAll('.side .nav').forEach(n=>n.classList.remove('active'));
    const b = btn || Array.from(document.querySelectorAll('.side .nav')).find(x=>pageFromButton(x)===id);
    if(b) b.classList.add('active');
  }

  function runHooksNow(id){
    try{ if(id==='contracts' && typeof window.showContractsSubTab === 'function') window.showContractsSubTab('services'); }catch(_){ }
    try{ if(id==='attendance' && typeof window.renderAttendanceMonthly === 'function') window.renderAttendanceMonthly(); }catch(_){ }
    try{ if(id==='clientReports' && typeof window.renderPremiumReports === 'function') window.renderPremiumReports(); }catch(_){ }
    try{
      if(id==='financeDashboard'){
        const target = $(id);
        if(target) target.classList.add('finance-pro');
        if(typeof window.financeProLoadV15 === 'function' && target && !target.querySelector('.fin-shell,#finTabsV15,#finBodyV15')) window.financeProLoadV15(false);
        if(typeof window.financeProRenderAll === 'function') window.financeProRenderAll();
      }
    }catch(_){ }
    try{ if(id==='inventoryAudit' && window.tasneefInventoryAuditV10046 && typeof window.tasneefInventoryAuditV10046.load === 'function') window.tasneefInventoryAuditV10046.load(); }catch(_){ }
  }

  function openInstant(id, btn){
    id = S(id);
    const target = $(id);
    if(!id || !target) return false;
    const pages = document.querySelectorAll('.page');
    pages.forEach(p=>{
      if(p === target){
        p.classList.remove('hidden');
        p.style.display = '';
        p.style.visibility = '';
        p.style.opacity = '';
      }else{
        p.classList.add('hidden');
        p.style.display = '';
        p.style.visibility = '';
        p.style.opacity = '';
      }
    });
    activateButton(id, btn);
    runHooksNow(id);
    return true;
  }

  function install(){
    window.tasneefOpenPageInstantV10048 = openInstant;
    window.showPage = function(id, btn){
      const ok = openInstant(id, btn);
      if(!ok){ try{ if(typeof msg === 'function') msg('القسم غير موجود: '+id, 'err'); }catch(_){ } }
      return ok;
    };
    try{ showPage = window.showPage; }catch(_){ }
  }

  // capture clicks immediately, so older permission wrappers cannot delay opening.
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest ? e.target.closest('.side .nav') : null;
    if(!btn || btn.classList.contains('danger')) return;
    const page = pageFromButton(btn);
    if(!page || !$(page)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openInstant(page, btn);
  }, true);

  install();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  window.addEventListener('load', install);
  // Old scripts may overwrite showPage after load; this is a short guard only during startup, not a permanent slow interval.
  let n = 0;
  const t = setInterval(()=>{ install(); if(++n >= 12) clearInterval(t); }, 250);
})();
