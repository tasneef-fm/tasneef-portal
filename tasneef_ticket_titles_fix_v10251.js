/* =========================================================
   Tasneef V10251 - Ticket title options final fix
   الهدف:
   - تثبيت خيارات عنوان/نوع المشكلة في الإدارة والمشرف والفني.
   - إضافة: مشكلة نظافة + صهاريج في كل النماذج والفلاتر.
   - منع رسالة "الرجاء اختيار نوع المشكلة" بعد اختيار قيمة صحيحة.
   - لا يلمس قاعدة البيانات ولا يغير بيانات التكتات.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'V10251';
  const OPTIONS = ['صيانة','سباكة','تعطير','تشجير','كهرباء','صواريخ','دفاع مدني','مصاعد','مشكلة نظافة','صهاريج'];
  const PLACEHOLDER = 'اختر نوع المشكلة';
  const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').trim();

  let lastAdminTitle = '';
  let lastTechTitle = '';

  function optionHtml(includeAll){
    return (includeAll ? '<option value="">كل أنواع المشكلة</option>' : `<option value="">${PLACEHOLDER}</option>`)
      + OPTIONS.map(o => `<option value="${ESC(o)}">${ESC(o)}</option>`).join('');
  }

  function ensureSelect(id, includeAll=false){
    const el = document.getElementById(id);
    if(!el) return null;

    const oldValue = norm(el.value || el.dataset.selected || (id === 'ticketTitle' ? lastAdminTitle : id === 'techNewTicketTitle' ? lastTechTitle : ''));
    let select = el;

    if(el.tagName !== 'SELECT'){
      select = document.createElement('select');
      select.id = el.id;
      select.className = el.className || '';
      select.name = el.name || el.id;
      select.style.cssText = el.style.cssText || '';
      el.replaceWith(select);
    }

    const needsRebuild = OPTIONS.some(o => !Array.from(select.options).some(opt => norm(opt.value) === o))
      || !select.options.length
      || (select.options[0] && !select.options[0].textContent.includes(includeAll ? 'كل' : 'اختر'));

    if(needsRebuild){
      select.innerHTML = optionHtml(includeAll);
    }

    if(oldValue){
      if(!Array.from(select.options).some(opt => norm(opt.value) === oldValue)){
        select.insertAdjacentHTML('beforeend', `<option value="${ESC(oldValue)}">${ESC(oldValue)}</option>`);
      }
      select.value = oldValue;
    }

    select.onchange = function(){
      this.dataset.selected = norm(this.value);
      if(id === 'ticketTitle') lastAdminTitle = norm(this.value);
      if(id === 'techNewTicketTitle') lastTechTitle = norm(this.value);
    };

    return select;
  }

  function ensureAllTicketTitleControls(){
    ensureSelect('ticketTitle', false);
    ensureSelect('techNewTicketTitle', false);

    // فلاتر نوع المشكلة المحتملة في الإدارة/المشرف/الفني
    ['ticketTitleFilter','ticketTypeFilter','ticketProblemFilter','adminTicketTitleFilter','supTicketTitleFilter','techTicketTitleFilter'].forEach(id => ensureSelect(id, true));

    // أي select ظاهر يحتوي خيارات نوع المشكلة لكن ناقص الخيارات الجديدة
    document.querySelectorAll('select').forEach(sel => {
      const txt = norm(sel.textContent);
      if(txt.includes('صيانة') && txt.includes('سباكة') && (txt.includes('نوع المشكلة') || txt.includes('المشكلة') || txt.includes('العنوان'))){
        const old = norm(sel.value || sel.dataset.selected);
        const isFilter = txt.includes('كل أنواع') || sel.id.includes('Filter') || sel.id.includes('filter');
        sel.innerHTML = optionHtml(isFilter);
        if(old && (OPTIONS.includes(old) || isFilter)) sel.value = old;
      }
    });
  }

  function getTitle(id){
    const el = ensureSelect(id, false);
    const value = norm(el?.value || el?.dataset.selected || (id === 'ticketTitle' ? lastAdminTitle : lastTechTitle));
    if(el && value){
      if(!Array.from(el.options).some(opt => norm(opt.value) === value)){
        el.insertAdjacentHTML('beforeend', `<option value="${ESC(value)}">${ESC(value)}</option>`);
      }
      el.value = value;
      el.dataset.selected = value;
    }
    return value;
  }

  function showError(){
    if(typeof window.msg === 'function') window.msg('الرجاء اختيار نوع المشكلة','err');
    else alert('الرجاء اختيار نوع المشكلة');
  }

  function patchSavers(){
    if(typeof window.saveTicket === 'function' && !window.saveTicket.__v10251Patched){
      const original = window.saveTicket;
      const patched = async function(){
        ensureAllTicketTitleControls();
        const title = getTitle('ticketTitle');
        if(!title) return showError();
        return original.apply(this, arguments);
      };
      patched.__v10251Patched = true;
      window.saveTicket = patched;
      try{ saveTicket = patched; }catch(_){ }
    }

    if(typeof window.saveTechnicianTicket === 'function' && !window.saveTechnicianTicket.__v10251Patched){
      const originalTech = window.saveTechnicianTicket;
      const patchedTech = async function(){
        ensureAllTicketTitleControls();
        const title = getTitle('techNewTicketTitle');
        if(!title) return showError();
        return originalTech.apply(this, arguments);
      };
      patchedTech.__v10251Patched = true;
      window.saveTechnicianTicket = patchedTech;
      try{ saveTechnicianTicket = patchedTech; }catch(_){ }
    }
  }

  function patchClear(){
    if(typeof window.clearTicketForm === 'function' && !window.clearTicketForm.__v10251Patched){
      const originalClear = window.clearTicketForm;
      const patchedClear = function(){
        lastAdminTitle = '';
        const res = originalClear.apply(this, arguments);
        setTimeout(()=>{ ensureAllTicketTitleControls(); const t=document.getElementById('ticketTitle'); if(t) t.value=''; }, 0);
        return res;
      };
      patchedClear.__v10251Patched = true;
      window.clearTicketForm = patchedClear;
      try{ clearTicketForm = patchedClear; }catch(_){ }
    }
  }

  function stampVersion(){
    const candidates = Array.from(document.querySelectorAll('small, .muted, .version, span, div')).filter(el => /V102\d+|V10246|V10250|V10229/.test(el.textContent || ''));
    candidates.slice(0,3).forEach(el => { if(/V102\d+|V10246|V10250|V10229/.test(el.textContent || '')) el.textContent = VERSION; });
  }

  function boot(){
    ensureAllTicketTitleControls();
    patchSavers();
    patchClear();
    stampVersion();
  }

  window.TASNEEF_TICKET_TYPES = OPTIONS.slice();
  window.tasneefEnsureTicketTitleOptionsV10251 = boot;

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', () => {
    boot();
    [200,800,1600,3000].forEach(ms => setTimeout(boot, ms));
  });

  // مراقبة خفيفة: إذا سكربت قديم أعاد بناء النموذج نرجع الخيارات فورًا.
  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(boot, 120);
  });
  document.addEventListener('DOMContentLoaded', () => {
    try{ observer.observe(document.body, {childList:true, subtree:true}); }catch(_){ }
  });
})();
