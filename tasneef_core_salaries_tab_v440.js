(function(){
  'use strict';
  if(window.__tasneefCoreSalaryTabV440) return;
  window.__tasneefCoreSalaryTabV440=true;
  const $=id=>document.getElementById(id);
  let mounted=false, loading=false;
  function msg(t,err){const el=$('cu413Msg'); if(el){el.textContent=t; el.className='cu413-msg '+(err?'err':''); el.style.display='block';}}
  function ensureTab(){
    const root=$('coreUnified'); if(!root) return false;
    const tabs=root.querySelector('.cu413-tabs'); if(!tabs) return false;
    let btn=root.querySelector('[data-tab="salaries"]');
    if(!btn){ btn=document.createElement('button'); btn.type='button'; btn.dataset.tab='salaries'; btn.textContent='الرواتب'; tabs.appendChild(btn); }
    let tab=$('cu413SalariesTab');
    if(!tab){ tab=document.createElement('div'); tab.id='cu413SalariesTab'; tab.className='cu413-tab hidden'; const rootBox=root.querySelector('.cu413-root')||root; rootBox.appendChild(tab); }
    // اربط زر الرواتب ربط ثابت. نستخدم capture حتى لا يرجع النظام القديم ويخفيها.
    if(!btn.__salaryStableV440){
      btn.__salaryStableV440=true;
      btn.addEventListener('click',function(ev){ ev.preventDefault(); ev.stopPropagation(); showSalary(); },true);
    }
    return true;
  }
  function setOnlySalaryActive(){
    const root=$('coreUnified'); if(!root) return;
    root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active', b.dataset.tab==='salaries'));
    ['Workers','Projects','Distribution','Attendance'].forEach(x=>$( 'cu413'+x+'Tab')?.classList.add('hidden'));
    const tab=$('cu413SalariesTab'); if(tab) tab.classList.remove('hidden');
  }
  function removeEmptyOldSalarySection(){
    const old=$('salaries');
    if(old && old.parentElement && old.parentElement.id!=='cu413SalaryMount'){
      if(!old.children.length || old.innerHTML.trim()==='') old.remove();
    }
  }
  function mountSalarySection(){
    const tab=$('cu413SalariesTab'); if(!tab) return false;
    if(!$('cu413SalaryMount')) tab.innerHTML='<div class="cu413-card"><div id="cu413SalaryMount"></div></div>';
    const mount=$('cu413SalaryMount');
    if(!mount) return false;
    if(mounted && mount.querySelector('.salary-table')) return true;
    if(!window.tasneefSalariesUnifiedV440){
      mount.innerHTML='<div class="cu413-msg err">ملف الرواتب لم يتم تحميله بعد. ارفع tasneef_salaries_unified_source_v440.js ثم حدّث الكاش.</div>';
      return false;
    }
    removeEmptyOldSalarySection();
    // لو يوجد قسم رواتب قديم فارغ من نسخة V436، احذفه حتى يستطيع inject بناءه من جديد.
    const existing=$('salaries');
    if(existing && !existing.children.length) existing.remove();
    try{ window.tasneefSalariesUnifiedV440.inject(); }catch(e){ mount.innerHTML='<div class="cu413-msg err">تعذر إنشاء الرواتب: '+(e.message||e)+'</div>'; return false; }
    const sal=$('salaries');
    if(!sal){ mount.innerHTML='<div class="cu413-msg err">لم يتم إنشاء قسم الرواتب. تحقق من ملف الرواتب.</div>'; return false; }
    // انقل القسم كاملًا داخل mount مرة واحدة، وليس المحتوى فقط، حتى لا يترك #salaries فارغًا ويتسبب في اختفاء متكرر.
    sal.classList.remove('page','hidden');
    sal.style.display='block';
    mount.innerHTML='';
    mount.appendChild(sal);
    mounted=true;
    return true;
  }
  function showSalary(){
    if(loading) return;
    if(!ensureTab()) return;
    loading=true;
    try{
      setOnlySalaryActive();
      if(mountSalarySection()){
        setTimeout(()=>{ try{ window.tasneefSalariesUnifiedV440?.load?.(); }catch(e){ msg('تعذر تحديث الرواتب: '+(e.message||e),true); } },60);
        msg('تم فتح الرواتب من مصدر النظام الموحد بشكل ثابت.');
      }
    }catch(e){ msg('تعذر فتح الرواتب: '+(e.message||e),true); }
    finally{ setTimeout(()=>{loading=false;},300); }
  }
  function patch(){
    ensureTab();
    // إذا كان المستخدم واقف على الرواتب، تأكد أنها ظاهرة ولا تعيد بناءها كل ثانية.
    const active=document.querySelector('#coreUnified .cu413-tabs [data-tab="salaries"].active');
    if(active){ setOnlySalaryActive(); mountSalarySection(); }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(patch,1200));
  window.addEventListener('load',()=>setTimeout(patch,1600));
  try{ new MutationObserver(()=>{ if($('coreUnified')) patch(); }).observe(document.body,{childList:true,subtree:true}); }catch(_){ }
  window.tasneefCoreSalaryTabV440={show:showSalary,patch};
})();
