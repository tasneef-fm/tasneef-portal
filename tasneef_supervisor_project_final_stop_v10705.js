/* V10705 - تثبيت نهائي لقائمة مشروع الدخول/الخروج وإزالة زر حفظ تحضير اليوم */
(function(){
  'use strict';
  if(window.__tasneefSupervisorProjectFinalStopV10705) return;
  window.__tasneefSupervisorProjectFinalStopV10705 = true;

  var savedHtml = '';
  var savedValue = '';
  var locked = false;
  var restoring = false;

  function select(){ return document.getElementById('logProject'); }
  function realCount(el){
    return el ? Array.from(el.options || []).filter(function(o){return String(o.value||'').trim()!=='';}).length : 0;
  }
  function removeAttendanceSaveButton(){
    document.querySelectorAll('button').forEach(function(btn){
      var oc = String(btn.getAttribute('onclick')||'');
      var tx = String(btn.textContent||'').trim();
      if(oc.indexOf('saveSupervisorAttendance')!==-1 || tx==='حفظ تحضير اليوم') btn.remove();
    });
  }
  function capture(){
    var el=select();
    if(!el || realCount(el)===0) return false;
    savedHtml=el.innerHTML;
    savedValue=el.value||savedValue||'';
    locked=true;
    el.dataset.finalProjectLockedV10705='1';
    return true;
  }
  function restore(){
    var el=select();
    if(!el || !locked || restoring) return;
    if(realCount(el)>0){
      if(el.value) savedValue=el.value;
      return;
    }
    restoring=true;
    el.innerHTML=savedHtml;
    if(savedValue && Array.from(el.options).some(function(o){return String(o.value)===String(savedValue);})) el.value=savedValue;
    restoring=false;
  }
  function protectFillSelect(){
    if(typeof window.fillSelect!=='function' || window.fillSelect.__v10705) return;
    var original=window.fillSelect;
    function wrapped(id,rows,label,placeholder){
      if(String(id)==='logProject' && locked){
        var incoming=Array.isArray(rows)?rows:[];
        if(!incoming.length){ restore(); return; }
      }
      var out=original.apply(this,arguments);
      if(String(id)==='logProject') setTimeout(function(){ if(!capture()) restore(); },0);
      return out;
    }
    wrapped.__v10705=true;
    wrapped.__original=original;
    window.fillSelect=wrapped;
    try{ fillSelect=wrapped; }catch(_){ }
  }
  function boot(){
    removeAttendanceSaveButton();
    protectFillSelect();
    if(!locked) capture(); else restore();
    var el=select();
    if(el && !el.dataset.finalObserverV10705){
      el.dataset.finalObserverV10705='1';
      new MutationObserver(function(){ queueMicrotask(function(){ if(!capture()) restore(); }); }).observe(el,{childList:true,subtree:true});
      el.addEventListener('change',function(){ if(el.value) savedValue=el.value; },true);
    }
  }

  document.addEventListener('DOMContentLoaded',boot);
  [0,100,300,700,1200,2000,3500,6000,10000].forEach(function(ms){setTimeout(boot,ms);});
  new MutationObserver(function(){ removeAttendanceSaveButton(); boot(); }).observe(document.documentElement,{childList:true,subtree:true});
})();
