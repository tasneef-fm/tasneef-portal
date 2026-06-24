(function(){
  'use strict';
  const VERSION='V10223';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const A=v=>Array.isArray(v)?v:[];
  const TITLES=['صيانة','سباكة','تعطير','تشجير','كهرباء','صواريخ','دفاع مدني','مصاعد'];
  function projectName(id){
    const p=A(window.data&&window.data.projects).find(x=>S(x.id)===S(id));
    return p?(p.name||p.project_name||'-'):'-';
  }
  function supervisorName(id){
    const u=A(window.data&&window.data.users).find(x=>S(x.id)===S(id)) || A(window.data&&window.data.supervisors).find(x=>S(x.id)===S(id));
    return u?(u.full_name||u.username||u.name||'-'):'-';
  }
  function ticketNo(t){ return S(t.ticket_number)||('T-'+S(t.id||0).padStart(4,'0')); }
  function dt(v){
    if(!v) return '-'; const d=new Date(v); if(isNaN(d)) return S(v);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
  function statusLabel(s){ s=S(s||'open'); return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح'); }
  function statusClass(s){ s=S(s||'open'); return s==='closed'?'green':(s==='processing'?'amber':'red'); }
  function priorityLabel(p){ p=S(p||'normal'); return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function css(){
    if($('ticketsFiltersV10223Style')) return;
    const st=document.createElement('style'); st.id='ticketsFiltersV10223Style'; st.textContent=`
      .ticket-v10223-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;margin-top:12px}
      .ticket-v10223-card{border:1px solid var(--line,#d8e6e1);border-radius:14px;background:#fff;padding:12px;box-shadow:0 2px 10px rgba(0,0,0,.04)}
      .ticket-v10223-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px}
      .ticket-v10223-card h3{margin:6px 0;color:var(--brand,#0b5d49);font-size:18px}
      .ticket-v10223-meta{display:grid;gap:4px;font-size:13px;color:#345}
      .ticket-v10223-desc{background:#f7fbf9;border-radius:10px;padding:8px;margin-top:8px;min-height:42px;white-space:pre-wrap}
      .ticket-v10223-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
      .ticket-v10223-actions button{padding:7px 10px;border-radius:9px}
      .ticket-v10223-empty{padding:20px;text-align:center;background:#f7fbf9;border:1px dashed var(--line,#d8e6e1);border-radius:14px}
      .ticket-v10223-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ticket-v10223-kpi{background:#eef8f4;border:1px solid var(--line,#d8e6e1);border-radius:12px;padding:8px 12px;font-weight:800}.ticket-v10223-kpi b{font-size:20px;color:var(--brand,#0b5d49)}
    `; document.head.appendChild(st);
  }
  function optionRows(rows,label,all){ return `<option value="">${E(all)}</option>` + rows.map(r=>`<option value="${E(r.id)}">${E(label(r))}</option>`).join(''); }
  function fillSelectKeep(sel, html){ if(!sel) return; const old=sel.value; sel.innerHTML=html; if([...sel.options].some(o=>o.value===old)) sel.value=old; }
  function ensureAdminFilters(){
    css();
    const search=$('ticketSearch'); if(!search) return;
    const box=search.closest('.filters')||search.parentElement;
    if(!box) return;
    if(!$('ticketFilterProjectV10223')) box.insertAdjacentHTML('afterbegin','<select id="ticketFilterProjectV10223"><option value="">كل المشاريع</option></select>');
    if(!$('ticketFilterSupervisorV10223')) $('ticketFilterProjectV10223').insertAdjacentHTML('afterend','<select id="ticketFilterSupervisorV10223"><option value="">كل المشرفين</option></select>');
    if(!$('ticketFilterTitleV10223')) $('ticketFilterSupervisorV10223').insertAdjacentHTML('afterend','<select id="ticketFilterTitleV10223"><option value="">كل أنواع المشكلة</option>'+TITLES.map(x=>`<option value="${E(x)}">${E(x)}</option>`).join('')+'</select>');
    if(!$('ticketSortOrder')) search.insertAdjacentHTML('beforebegin','<select id="ticketSortOrder"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select>');
    fillSelectKeep($('ticketFilterProjectV10223'), optionRows(A(window.data&&window.data.projects), p=>p.name||p.project_name||'-', 'كل المشاريع'));
    const users=A(window.data&&window.data.users).concat(A(window.data&&window.data.supervisors)).filter((v,i,arr)=>arr.findIndex(x=>S(x.id)===S(v.id))===i);
    fillSelectKeep($('ticketFilterSupervisorV10223'), optionRows(users.filter(u=>!u.role || S(u.role)==='supervisor'), u=>u.full_name||u.username||u.name||'-', 'كل المشرفين'));
    ['ticketFilterProjectV10223','ticketFilterSupervisorV10223','ticketFilterTitleV10223','ticketFilterStatus','ticketSortOrder'].forEach(id=>{ const el=$(id); if(el && !el.dataset.v10223){ el.dataset.v10223='1'; el.addEventListener('change',()=>window.renderTickets&&window.renderTickets()); }});
    if(search && !search.dataset.v10223){ search.dataset.v10223='1'; search.addEventListener('input',()=>window.renderTickets&&window.renderTickets()); }
  }
  function filters(){
    return {
      project:S($('ticketFilterProjectV10223')?.value || $('ticketFilterProject')?.value || ''),
      supervisor:S($('ticketFilterSupervisorV10223')?.value || $('ticketFilterSupervisor')?.value || ''),
      title:S($('ticketFilterTitleV10223')?.value || $('ticketFilterTitle')?.value || ''),
      status:S($('ticketFilterStatus')?.value||''),
      search:S($('ticketSearch')?.value||'').toLowerCase(),
      order:S($('ticketSortOrder')?.value||'newest')
    };
  }
  function filtered(){
    const f=filters();
    let list=A(window.data&&window.data.tickets).slice();
    if(f.project) list=list.filter(t=>S(t.project_id)===f.project);
    if(f.supervisor) list=list.filter(t=>S(t.supervisor_id)===f.supervisor);
    if(f.title) list=list.filter(t=>S(t.title)===f.title);
    if(f.status) list=list.filter(t=>S(t.status||'open')===f.status);
    if(f.search) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id),statusLabel(t.status),priorityLabel(t.priority),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(f.search));
    list.sort((a,b)=>{ const da=Date.parse(a.created_at||a.opened_at||a.date||'')||0; const db=Date.parse(b.created_at||b.opened_at||b.date||'')||0; return f.order==='oldest'?da-db:db-da; });
    window.__tasneefFilteredTicketsV10223=list;
    return list;
  }
  function summary(list){
    const open=list.filter(t=>S(t.status||'open')==='open').length;
    const proc=list.filter(t=>S(t.status)==='processing').length;
    const closed=list.filter(t=>S(t.status)==='closed').length;
    return `<div class="ticket-v10223-summary"><span class="ticket-v10223-kpi">الإجمالي: <b>${list.length}</b></span><span class="ticket-v10223-kpi">مفتوح: <b>${open}</b></span><span class="ticket-v10223-kpi">تحت المعالجة: <b>${proc}</b></span><span class="ticket-v10223-kpi">مغلق: <b>${closed}</b></span></div>`;
  }
  function card(t){
    const id=Number(t.id)||0, st=S(t.status||'open');
    const view=typeof window.viewTicketSmartV147==='function'?`<button class="light" onclick="viewTicketSmartV147(${id})">عرض</button>`:'';
    const pdf=typeof window.ticketDownloadPdfV206==='function'?`<button class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>`:'';
    const claim=st!=='closed'&&st!=='processing'&&typeof window.claimTicket==='function'?`<button class="light" onclick="claimTicket(${id})">استلام</button>`:'';
    const close=st!=='closed'&&typeof window.closeTicket==='function'?`<button onclick="closeTicket(${id})">إغلاق</button>`:'';
    const reopen=st==='closed'&&typeof window.setTicketStatus==='function'?`<button class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:'';
    const edit=typeof window.editTicket==='function'?`<button class="light" onclick="editTicket(${id})">تعديل</button>`:'';
    const del=typeof window.deleteRow==='function'?`<button class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`:'';
    return `<article class="ticket-v10223-card"><div class="ticket-v10223-top"><div><b>${E(ticketNo(t))}</b><br><small>${E(dt(t.created_at||t.opened_at))}</small></div><span class="badge ${statusClass(st)}">${E(statusLabel(st))}</span></div><h3>${E(t.title||'-')}</h3><div class="ticket-v10223-meta"><span>المشروع: <b>${E(projectName(t.project_id))}</b></span><span>المشرف: <b>${E(supervisorName(t.supervisor_id))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span></div><div class="ticket-v10223-desc">${E(t.description||'لا يوجد وصف')}</div>${t.closure_note?`<div class="ticket-v10223-desc"><b>الحل:</b> ${E(t.closure_note)}</div>`:''}<div class="ticket-v10223-actions">${view}${pdf}${edit}${claim}${close}${reopen}${del}</div></article>`;
  }
  const oldRender=window.renderTickets;
  window.renderTickets=function(){
    ensureAdminFilters();
    const body=$('ticketsBody');
    if(!body){ return typeof oldRender==='function'?oldRender.apply(this,arguments):undefined; }
    const list=filtered();
    const sum=$('ticketsSmartSummary'); if(sum) sum.innerHTML=summary(list);
    body.classList.add('ticket-v10223-grid');
    body.innerHTML=list.length?list.map(card).join(''):'<div class="ticket-v10223-empty">لا توجد تكتات مطابقة للفلاتر الحالية</div>';
  };
  window.getFilteredTicketsV10223=filtered;
  function boot(){ ensureAdminFilters(); try{ window.renderTickets(); }catch(e){ console.warn('tickets v10223',e); } }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));
  window.addEventListener('load',()=>{ setTimeout(boot,600); setTimeout(boot,1800); });
})();
