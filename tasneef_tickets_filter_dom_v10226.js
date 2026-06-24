(function(){
  'use strict';
  const VERSION='V10226';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>S(v).toLowerCase().replace(/\s+/g,' ');
  const E=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const TITLES=['صيانة','سباكة','تعطير','تشجير','كهرباء','صواريخ','دفاع مدني','مصاعد'];
  let applying=false;
  function body(){ return $('ticketsBody'); }
  function cards(){ return Array.from((body()||document).querySelectorAll('.ticket-root-v10225-card, .ticket-root-v10224-card, .smart-ticket-card, article[data-ticket-id], .ticket-card')).filter(c=>c.closest('#ticketsBody')); }
  function lines(card){ return S(card.innerText).split(/\n+/).map(S).filter(Boolean); }
  function field(card,label){
    const ls=lines(card);
    const l=ls.find(x=>N(x).startsWith(N(label+':')) || N(x).startsWith(N(label+'：')));
    if(!l) return '';
    return S(l.replace(label+':','').replace(label+'：',''));
  }
  function statusOf(card){
    const t=N(card.innerText);
    const badge=card.querySelector('.badge')?.innerText || '';
    const b=N(badge);
    if(b.includes('مغلق') || t.includes('مغلق')) return 'closed';
    if(b.includes('تحت المعالجة') || t.includes('تحت المعالجة')) return 'processing';
    return 'open';
  }
  function titleOf(card){ return S(card.querySelector('h3')?.innerText || field(card,'العنوان') || ''); }
  function ticketNo(card){ const t=S(card.querySelector('b')?.innerText || card.innerText); const m=t.match(/T[-ـ]?\s*\d+|\b\d{3,}\b/i); return m?m[0]:''; }
  function ticketNumeric(card){ const no=ticketNo(card); const nums=no.match(/\d+/g); return nums?Number(nums[nums.length-1]):Number(card.dataset.ticketId||0)||0; }
  function uniq(vals){ const out=[]; const seen=new Set(); vals.map(S).filter(v=>v&&v!=='-'&&!['كل المشاريع','كل المشرفين','كل المستلمين','كل المغلقين','كل أنواع المشكلة','كل الحالات'].includes(v)).forEach(v=>{ const k=N(v); if(!seen.has(k)){ seen.add(k); out.push(v); } }); return out.sort((a,b)=>a.localeCompare(b,'ar')); }
  function fillSelect(id, label, vals){
    const el=$(id); if(!el) return;
    const old=el.value;
    const list=uniq(vals);
    el.innerHTML=`<option value="">${E(label)}</option>`+list.map(v=>`<option value="${E(v)}">${E(v)}</option>`).join('');
    if([...el.options].some(o=>o.value===old)) el.value=old;
  }
  function addStyle(){
    if($('ticketDomV10226Style')) return;
    const st=document.createElement('style'); st.id='ticketDomV10226Style'; st.textContent=`
      .ticket-filter-v10226-note{font-size:12px;color:#0b5d49;margin-inline-start:8px;font-weight:700}
      #ticketRootFiltersV10225 select option{color:#111;background:#fff;}
    `; document.head.appendChild(st);
  }
  function ensureFiltersExist(){
    addStyle();
    // لو سكربت V10225 لم ينشئ الفلاتر لأي سبب، ننشئها هنا بدون حذف بيانات.
    if(!$('ticketRootFiltersV10225')){
      const b=body(); const oldSearch=$('ticketSearch');
      const row=document.createElement('div'); row.id='ticketRootFiltersV10225'; row.className='ticket-root-v10225-row';
      row.innerHTML=`
        <select id="ticketRootProjectV10225"><option value="">كل المشاريع</option></select>
        <select id="ticketRootSupervisorV10225"><option value="">كل المشرفين</option></select>
        <select id="ticketRootTitleV10225"><option value="">كل أنواع المشكلة</option></select>
        <select id="ticketRootStatusV10225"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="processing">تحت المعالجة</option><option value="closed">مغلق</option></select>
        <select id="ticketRootClaimedV10225"><option value="">كل المستلمين</option></select>
        <select id="ticketRootClosedByV10225"><option value="">كل المغلقين</option></select>
        <select id="ticketRootOrderV10225"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select>
        <input id="ticketRootSearchV10225" placeholder="بحث برقم التكت، المشروع، المشرف، المستلم، المغلق، العنوان أو الوصف">
        <span class="ticket-filter-v10226-note">${VERSION}</span>`;
      const box=oldSearch?.closest('.filters') || b?.parentElement;
      if(box && oldSearch) box.replaceWith(row); else if(b) b.parentElement.insertBefore(row,b);
    }
    const row=$('ticketRootFiltersV10225');
    if(row && !row.querySelector('.ticket-filter-v10226-note')){
      const sp=document.createElement('span'); sp.className='ticket-filter-v10226-note'; sp.textContent=VERSION; row.appendChild(sp);
    }
  }
  function populateFromCards(){
    ensureFiltersExist();
    const cs=cards();
    fillSelect('ticketRootProjectV10225','كل المشاريع', cs.map(c=>field(c,'المشروع')));
    fillSelect('ticketRootSupervisorV10225','كل المشرفين', cs.map(c=>field(c,'المشرف')));
    const cardTitles=cs.map(titleOf).filter(Boolean);
    fillSelect('ticketRootTitleV10225','كل أنواع المشكلة', TITLES.concat(cardTitles));
    fillSelect('ticketRootClaimedV10225','كل المستلمين', cs.map(c=>field(c,'المستلم')));
    fillSelect('ticketRootClosedByV10225','كل المغلقين', cs.map(c=>field(c,'المغلق')));
  }
  function getFilters(){
    return {
      project:N($('ticketRootProjectV10225')?.value||''),
      supervisor:N($('ticketRootSupervisorV10225')?.value||''),
      title:N($('ticketRootTitleV10225')?.value||''),
      status:S($('ticketRootStatusV10225')?.value||''),
      claimed:N($('ticketRootClaimedV10225')?.value||''),
      closed:N($('ticketRootClosedByV10225')?.value||''),
      search:N($('ticketRootSearchV10225')?.value||''),
      order:S($('ticketRootOrderV10225')?.value||'newest')
    };
  }
  function matches(card,f){
    if(f.project && N(field(card,'المشروع'))!==f.project) return false;
    if(f.supervisor && N(field(card,'المشرف'))!==f.supervisor) return false;
    if(f.title && N(titleOf(card))!==f.title) return false;
    if(f.status && statusOf(card)!==f.status) return false;
    if(f.claimed && N(field(card,'المستلم'))!==f.claimed) return false;
    if(f.closed && N(field(card,'المغلق'))!==f.closed) return false;
    if(f.search){
      const txt=N([card.innerText, ticketNo(card), field(card,'المشروع'), field(card,'المشرف'), field(card,'المستلم'), field(card,'المغلق')].join(' '));
      if(!txt.includes(f.search)) return false;
    }
    return true;
  }
  function updateSummary(visible){
    const sum=$('ticketsSmartSummary'); if(!sum) return;
    const open=visible.filter(c=>statusOf(c)==='open').length;
    const proc=visible.filter(c=>statusOf(c)==='processing').length;
    const closed=visible.filter(c=>statusOf(c)==='closed').length;
    sum.innerHTML=`<div class="ticket-root-v10225-summary"><span class="ticket-root-v10225-kpi">الإجمالي: <b>${visible.length}</b></span><span class="ticket-root-v10225-kpi">مفتوح: <b>${open}</b></span><span class="ticket-root-v10225-kpi">تحت المعالجة: <b>${proc}</b></span><span class="ticket-root-v10225-kpi">مغلق: <b>${closed}</b></span></div>`;
  }
  function applyDomFilters(){
    if(applying) return; applying=true;
    try{
      populateFromCards();
      const b=body(); if(!b) return;
      const f=getFilters();
      const cs=cards();
      cs.sort((a,b)=> f.order==='oldest' ? ticketNumeric(a)-ticketNumeric(b) : ticketNumeric(b)-ticketNumeric(a)).forEach(c=>b.appendChild(c));
      const visible=[];
      cs.forEach(c=>{ const ok=matches(c,f); c.style.display=ok?'':'none'; if(ok) visible.push(c); });
      updateSummary(visible);
    }finally{ applying=false; }
  }
  function bind(){
    ensureFiltersExist();
    ['ticketRootProjectV10225','ticketRootSupervisorV10225','ticketRootTitleV10225','ticketRootStatusV10225','ticketRootClaimedV10225','ticketRootClosedByV10225','ticketRootOrderV10225'].forEach(id=>{
      const el=$(id); if(!el || el.dataset.domBound10226) return;
      el.dataset.domBound10226='1';
      el.addEventListener('focus',()=>setTimeout(populateFromCards,0),true);
      el.addEventListener('mousedown',()=>setTimeout(populateFromCards,0),true);
      el.addEventListener('change',()=>setTimeout(applyDomFilters,0),true);
    });
    const q=$('ticketRootSearchV10225');
    if(q && !q.dataset.domBound10226){ q.dataset.domBound10226='1'; q.addEventListener('input',applyDomFilters,true); }
  }
  function boot(){
    ensureFiltersExist(); bind(); populateFromCards(); applyDomFilters();
    const b=body();
    if(b && !b.dataset.domObserve10226){
      b.dataset.domObserve10226='1';
      new MutationObserver(()=>{ if(!applying) setTimeout(()=>{ bind(); populateFromCards(); applyDomFilters(); },50); }).observe(b,{childList:true,subtree:false});
    }
  }
  window.tasneefTicketsDomFilterV10226=applyDomFilters;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
  window.addEventListener('load',()=>[500,1200,2500,5000,9000].forEach(ms=>setTimeout(boot,ms)));
})();
