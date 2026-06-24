(function(){
  'use strict';
  const VERSION='V10224';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>S(v).toLowerCase().replace(/\s+/g,' ');
  const A=v=>Array.isArray(v)?v:[];
  const E=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const TITLES=['صيانة','سباكة','تعطير','تشجير','كهرباء','صواريخ','دفاع مدني','مصاعد'];
  let rendering=false;

  function data(){ return window.data || {}; }
  function projects(){ return A(data().projects); }
  function users(){ return A(data().users).concat(A(data().supervisors)).filter((v,i,arr)=>arr.findIndex(x=>S(x.id)===S(v.id))===i); }
  function tickets(){ return A(data().tickets); }
  function projectNameById(id){
    const p=projects().find(x=>S(x.id)===S(id));
    return p ? S(p.name || p.project_name || p.title || '') : '';
  }
  function supervisorNameById(id){
    const u=users().find(x=>S(x.id)===S(id));
    return u ? S(u.full_name || u.username || u.name || '') : '';
  }
  function ticketProjectName(t){ return S(t.project_name || t.projectName || t.project || projectNameById(t.project_id) || '-'); }
  function ticketSupervisorName(t){ return S(t.supervisor_name || t.supervisorName || t.supervisor || supervisorNameById(t.supervisor_id) || '-'); }
  function ticketNo(t){ return S(t.ticket_number || t.ticket_no || t.no) || ('T-'+S(t.id||0).padStart(4,'0')); }
  function ticketDate(t){ return Date.parse(t.created_at || t.opened_at || t.updated_at || t.date || '') || Number(t.id||0) || 0; }
  function fmt(v){ if(!v) return '-'; const d=new Date(v); if(isNaN(d)) return S(v); return d.toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  function statusLabel(s){ s=S(s||'open'); return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح'); }
  function statusClass(s){ s=S(s||'open'); return s==='closed'?'green':(s==='processing'?'amber':'red'); }
  function priorityLabel(p){ p=S(p||'normal'); return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }

  function css(){
    if($('ticketsRootV10224Style')) return;
    const st=document.createElement('style'); st.id='ticketsRootV10224Style'; st.textContent=`
      .ticket-root-v10224-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
      .ticket-root-v10224-row select,.ticket-root-v10224-row input{min-height:38px;border:1px solid var(--line,#d8e6e1);border-radius:10px;padding:8px;background:#fff}
      .ticket-root-v10224-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;margin-top:12px}
      .ticket-root-v10224-card{border:1px solid var(--line,#d8e6e1);border-radius:14px;background:#fff;padding:12px;box-shadow:0 2px 10px rgba(0,0,0,.05);overflow:hidden}
      .ticket-root-v10224-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px}
      .ticket-root-v10224-card h3{margin:6px 0;color:var(--brand,#0b5d49);font-size:18px}
      .ticket-root-v10224-meta{display:grid;gap:5px;font-size:13px;color:#345}.ticket-root-v10224-desc{background:#f7fbf9;border-radius:10px;padding:8px;margin-top:8px;min-height:42px;white-space:pre-wrap;word-break:break-word}
      .ticket-root-v10224-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.ticket-root-v10224-actions button{padding:7px 10px;border-radius:9px}
      .ticket-root-v10224-empty{padding:22px;text-align:center;background:#f7fbf9;border:1px dashed var(--line,#d8e6e1);border-radius:14px;grid-column:1/-1}
      .ticket-root-v10224-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ticket-root-v10224-kpi{background:#eef8f4;border:1px solid var(--line,#d8e6e1);border-radius:12px;padding:8px 12px;font-weight:800}.ticket-root-v10224-kpi b{font-size:20px;color:var(--brand,#0b5d49)}
      .ticket-root-v10224-version{font-size:12px;color:#678;margin-inline-start:auto}
    `; document.head.appendChild(st);
  }
  function options(rows,label,all){ return `<option value="">${E(all)}</option>`+rows.map(r=>`<option value="${E(r.value ?? r.id)}">${E(label(r))}</option>`).join(''); }
  function fillKeep(el, html){ if(!el) return; const old=el.value; el.innerHTML=html; if([...el.options].some(o=>o.value===old)) el.value=old; }

  function removeLegacyFiltersNoise(){
    // أخفي فلاتر قديمة مكررة ولا أحذف بيانات ولا عناصر مهمة.
    ['ticketFilterProject','ticketFilterSupervisor','ticketFilterPriority'].forEach(id=>{ const el=$(id); if(el && !el.dataset.rootHidden){ el.dataset.rootHidden='1'; el.style.display='none'; el.disabled=true; } });
    const oldTitle=$('ticketFilterTitle'); if(oldTitle && oldTitle.tagName==='INPUT' && !oldTitle.dataset.rootHidden){ oldTitle.dataset.rootHidden='1'; oldTitle.style.display='none'; oldTitle.disabled=true; }
  }

  function ensureFilters(){
    css();
    const page=$('tickets'); const body=$('ticketsBody'); const search=$('ticketSearch');
    if(!page || !body || !search) return;
    removeLegacyFiltersNoise();
    let row=$('ticketRootFiltersV10224');
    if(!row){
      const oldBox=search.closest('.filters') || search.parentElement;
      row=document.createElement('div'); row.id='ticketRootFiltersV10224'; row.className='ticket-root-v10224-row';
      row.innerHTML=`
        <select id="ticketRootProjectV10224"><option value="">كل المشاريع</option></select>
        <select id="ticketRootSupervisorV10224"><option value="">كل المشرفين</option></select>
        <select id="ticketRootTitleV10224"><option value="">كل أنواع المشكلة</option></select>
        <select id="ticketRootStatusV10224"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="processing">تحت المعالجة</option><option value="closed">مغلق</option></select>
        <select id="ticketRootOrderV10224"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select>
        <input id="ticketRootSearchV10224" placeholder="بحث برقم التكت، المشروع، المشرف، العنوان أو الوصف">
        <span class="ticket-root-v10224-version">${VERSION}</span>
      `;
      if(oldBox) oldBox.replaceWith(row); else body.parentElement.insertBefore(row,body);
    }
    fillKeep($('ticketRootProjectV10224'), options(projects(), p=>p.name||p.project_name||'-', 'كل المشاريع'));
    fillKeep($('ticketRootSupervisorV10224'), options(users().filter(u=>!u.role || S(u.role)==='supervisor'), u=>u.full_name||u.username||u.name||'-', 'كل المشرفين'));
    fillKeep($('ticketRootTitleV10224'), options(TITLES.map(x=>({id:x})), r=>r.id, 'كل أنواع المشكلة'));
    // توافق مع القيم القديمة عند أول تحميل
    if(!$('ticketRootStatusV10224').dataset.synced){ $('ticketRootStatusV10224').value=$('ticketFilterStatus')?.value||''; $('ticketRootStatusV10224').dataset.synced='1'; }
    if(!$('ticketRootOrderV10224').dataset.synced){ $('ticketRootOrderV10224').value=$('ticketSortOrder')?.value||'newest'; $('ticketRootOrderV10224').dataset.synced='1'; }
    if(!$('ticketRootSearchV10224').dataset.synced){ $('ticketRootSearchV10224').value=$('ticketSearch')?.value||''; $('ticketRootSearchV10224').dataset.synced='1'; }
    ['ticketRootProjectV10224','ticketRootSupervisorV10224','ticketRootTitleV10224','ticketRootStatusV10224','ticketRootOrderV10224'].forEach(id=>{ const el=$(id); if(el && !el.dataset.rootBound){ el.dataset.rootBound='1'; el.addEventListener('change',rootRender); }});
    const q=$('ticketRootSearchV10224'); if(q && !q.dataset.rootBound){ q.dataset.rootBound='1'; q.addEventListener('input',rootRender); }
  }

  function getFilters(){
    return {
      project:S($('ticketRootProjectV10224')?.value||''),
      supervisor:S($('ticketRootSupervisorV10224')?.value||''),
      title:S($('ticketRootTitleV10224')?.value||''),
      status:S($('ticketRootStatusV10224')?.value||''),
      order:S($('ticketRootOrderV10224')?.value||'newest'),
      search:N($('ticketRootSearchV10224')?.value||'')
    };
  }
  function rowMatchesProject(t, val){ if(!val) return true; return S(t.project_id)===val || S(t.projectId)===val || N(ticketProjectName(t))===N(projectNameById(val)); }
  function rowMatchesSupervisor(t, val){ if(!val) return true; return S(t.supervisor_id)===val || S(t.supervisorId)===val || N(ticketSupervisorName(t))===N(supervisorNameById(val)); }
  function rowMatchesTitle(t, val){ if(!val) return true; return N(t.title)===N(val); }
  function filteredTickets(){
    const f=getFilters();
    let list=tickets().slice();
    list=list.filter(t=>rowMatchesProject(t,f.project));
    list=list.filter(t=>rowMatchesSupervisor(t,f.supervisor));
    list=list.filter(t=>rowMatchesTitle(t,f.title));
    if(f.status) list=list.filter(t=>S(t.status||'open')===f.status);
    if(f.search){
      list=list.filter(t=>N([ticketNo(t),t.title,t.description,t.priority,priorityLabel(t.priority),statusLabel(t.status),ticketProjectName(t),ticketSupervisorName(t),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ')).includes(f.search));
    }
    list.sort((a,b)=> f.order==='oldest' ? ticketDate(a)-ticketDate(b) : ticketDate(b)-ticketDate(a));
    window.__tasneefFilteredTicketsV10224=list;
    return list;
  }
  function summary(list){
    const open=list.filter(t=>S(t.status||'open')==='open').length;
    const proc=list.filter(t=>S(t.status)==='processing').length;
    const closed=list.filter(t=>S(t.status)==='closed').length;
    return `<div class="ticket-root-v10224-summary"><span class="ticket-root-v10224-kpi">الإجمالي: <b>${list.length}</b></span><span class="ticket-root-v10224-kpi">مفتوح: <b>${open}</b></span><span class="ticket-root-v10224-kpi">تحت المعالجة: <b>${proc}</b></span><span class="ticket-root-v10224-kpi">مغلق: <b>${closed}</b></span></div>`;
  }
  function card(t){
    const id=Number(t.id)||0, st=S(t.status||'open');
    const view=typeof window.viewTicketSmartV147==='function'?`<button class="light" onclick="viewTicketSmartV147(${id})">عرض</button>`:'';
    const pdf=typeof window.ticketDownloadPdfV206==='function'?`<button class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>`:'';
    const edit=typeof window.editTicket==='function'?`<button class="light" onclick="editTicket(${id})">تعديل</button>`:'';
    const claim=st!=='closed'&&st!=='processing'&&typeof window.claimTicket==='function'?`<button class="light" onclick="claimTicket(${id})">استلام</button>`:'';
    const close=st!=='closed'&&typeof window.closeTicket==='function'?`<button onclick="closeTicket(${id})">إغلاق</button>`:'';
    const reopen=st==='closed'&&typeof window.setTicketStatus==='function'?`<button class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:'';
    const del=typeof window.deleteRow==='function'?`<button class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`:'';
    return `<article class="ticket-root-v10224-card" data-ticket-id="${E(id)}"><div class="ticket-root-v10224-top"><div><b>${E(ticketNo(t))}</b><br><small>${E(fmt(t.created_at||t.opened_at||t.updated_at))}</small></div><span class="badge ${statusClass(st)}">${E(statusLabel(st))}</span></div><h3>${E(t.title||'-')}</h3><div class="ticket-root-v10224-meta"><span>المشروع: <b>${E(ticketProjectName(t))}</b></span><span>المشرف: <b>${E(ticketSupervisorName(t))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span></div><div class="ticket-root-v10224-desc">${E(t.description||'لا يوجد وصف')}</div>${t.closure_note?`<div class="ticket-root-v10224-desc"><b>الحل:</b> ${E(t.closure_note)}</div>`:''}<div class="ticket-root-v10224-actions">${view}${pdf}${edit}${claim}${close}${reopen}${del}</div></article>`;
  }

  function rootRender(){
    if(rendering) return;
    rendering=true;
    try{
      const body=$('ticketsBody');
      if(!body){ const legacy=window.__tasneefLegacyRenderTicketsV10224; if(typeof legacy==='function') return legacy.apply(this,arguments); return; }
      ensureFilters();
      const list=filteredTickets();
      const sum=$('ticketsSmartSummary'); if(sum) sum.innerHTML=summary(list);
      body.className = (body.className||'').split(/\s+/).filter(c=>c && !/^ticket-.*grid/.test(c)).join(' ');
      body.classList.add('ticket-root-v10224-grid');
      body.innerHTML=list.length?list.map(card).join(''):'<div class="ticket-root-v10224-empty">لا توجد تكتات مطابقة للفلاتر الحالية</div>';
    }catch(e){ console.error('tickets root V10224',e); }
    finally{ rendering=false; }
  }

  function lockRenderFunction(){
    if(window.renderTickets!==rootRender){
      if(typeof window.renderTickets==='function' && window.renderTickets!==rootRender) window.__tasneefLegacyRenderTicketsV10224=window.renderTickets;
      try{
        Object.defineProperty(window,'renderTickets',{configurable:true, enumerable:true, get(){ return rootRender; }, set(fn){ if(typeof fn==='function' && fn!==rootRender) window.__tasneefLegacyRenderTicketsV10224=fn; }});
      }catch(_){ window.renderTickets=rootRender; }
    }
  }

  function boot(){
    lockRenderFunction();
    ensureFilters();
    rootRender();
    const body=$('ticketsBody');
    if(body && !body.dataset.rootObserve10224){
      body.dataset.rootObserve10224='1';
      const mo=new MutationObserver(()=>{
        if(rendering) return;
        // إذا سكربت قديم كتب جدول/نتائج غير تابعة لنا، نعيد الرسم فوراً.
        if(!body.classList.contains('ticket-root-v10224-grid')) setTimeout(rootRender,0);
      });
      mo.observe(body,{childList:true,subtree:false,attributes:true,attributeFilter:['class']});
    }
  }

  window.getFilteredTicketsV10224=filteredTickets;
  window.tasneefTicketsRootRenderV10224=rootRender;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300));
  window.addEventListener('load',()=>{ [200,700,1500,3000,6000].forEach(ms=>setTimeout(boot,ms)); });
  let tries=0; const timer=setInterval(()=>{ tries++; boot(); if(tries>30) clearInterval(timer); }, 500);
})();
