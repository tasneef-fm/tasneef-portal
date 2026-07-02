/* Tasneef V10286 - Tickets date range filter + client PDF report for admin/supervisor
   يعتمد على النسخة المرفوعة، لا يغير قاعدة البيانات. */
(function(){
  'use strict';
  if(window.__tasneefTicketsClientReportV10286) return;
  window.__tasneefTicketsClientReportV10286 = true;

  const VERSION = 'V10286';
  const PHRASE = 'تم انشاء هذا التقرير من نظام شركة تصنيف لادارة المرافق و يعتبر معتمد مالم يبرر العميل خلاف ذالك';
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const K = v => S(v).toLowerCase().replace(/\s+/g,' ');
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const D = () => window.data || {};
  const sessionUser = () => { try { return typeof window.session === 'function' ? window.session() : JSON.parse(localStorage.getItem('tasneef_session')||'null'); } catch(_) { return null; } };
  const statusMap = {open:'مفتوح',processing:'تحت المعالجة',closed:'مغلق'};
  const priorityMap = {normal:'عادي',high:'مهم',urgent:'عاجل',low:'منخفض'};
  const NO_RECEIPT='__no_receipt__';
  const NO_CLOSED='__no_closed__';

  function msgErr(text){ try{ if(typeof window.msg==='function') window.msg(text,'err'); else alert(text); }catch(_){ alert(text); } }
  function users(){ return A(D().users || D().app_users); }
  function projects(){ return A(D().projects); }
  function workers(){ return A(D().workers); }
  function projectById(id){ return projects().find(p => S(p.id)===S(id)) || {}; }
  function userById(id){ return users().find(u => S(u.id)===S(id)) || {}; }
  function workerSupId(w){ try{ if(typeof window.workerSupId==='function') return window.workerSupId(w); }catch(_){} return w.supervisor_id || w.supervisorId || w.user_id || w.manager_id; }
  function pName(id){ try{ if(typeof window.projectName==='function'){ const v=S(window.projectName(id)); if(v && v !== '-') return v; } }catch(_){} const p=projectById(id); return S(p.name || p.project_name || p.title) || '-'; }
  function sName(id){ try{ if(typeof window.supervisorName==='function'){ const v=S(window.supervisorName(id)); if(v && v !== '-') return v; } }catch(_){} const u=userById(id); return S(u.full_name || u.name || u.username) || '-'; }
  function first(t,keys){ for(const k of keys){ const v=S(t && t[k]); if(v && v!=='-') return v; } return ''; }
  function ticketNo(t){ return S(t.ticket_number || t.ticket_no || t.no) || ('T-' + String(t.id || 0).padStart(4,'0')); }
  function ticketProject(t){ return first(t,['project_name','projectName','project','project_title','project_label']) || pName(t.project_id || t.projectId) || '-'; }
  function ticketSupervisor(t){ return first(t,['supervisor_name','supervisorName','supervisor','supervisor_full_name','assigned_supervisor_name']) || sName(t.supervisor_id || t.supervisorId || projectById(t.project_id).supervisor_id) || '-'; }
  function ticketRecipient(t){ return first(t,['claimed_by_name','claimed_name','claimedByName','claimed_by_user_name','received_by_name','recipient_name','receiver_name','receiver','assigned_to_name','technician_name','handler_name','assignee_name','claimed_by']) || sName(t.claimed_by_id || t.claimedById || t.claimed_by || t.assigned_to || t.technician_id) || '-'; }
  function ticketClosedBy(t){ return first(t,['closed_by_name','closedByName','closed_by_user_name','closed_name','closer_name','closed_by_user','closed_by']) || sName(t.closed_by_id || t.closedById || t.closed_by) || '-'; }
  function statusLabel(s){ return statusMap[S(s)] || S(s) || '-'; }
  function priorityLabel(p){ return priorityMap[S(p)] || S(p) || '-'; }
  function statusClass(s){ return S(s)==='closed'?'green':S(s)==='processing'?'amber':'red'; }
  function rawDate(t){ return S(t.created_at || t.opened_at || t.date || t.updated_at || t.createdAt); }
  function dateOnly(v){ const r=S(v); if(!r) return ''; const m=r.match(/^(\d{4}-\d{2}-\d{2})/); if(m) return m[1]; const d=new Date(r); if(isNaN(d)) return ''; const y=d.getFullYear(), mo=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0'); return `${y}-${mo}-${da}`; }
  function fmtDate(t){ const d=dateOnly(rawDate(t)); if(!d) return '-'; return d; }
  function dateMs(t){ const d=Date.parse(rawDate(t)||''); return isNaN(d) ? (Number(t.id)||0) : d; }
  function hasReceipt(t){ const r=ticketRecipient(t); return !!(r && r !== '-' && K(r)!=='بدون استلام'); }
  function hasClosedBy(t){ const r=ticketClosedBy(t); return !!(r && r !== '-' && K(r)!=='بدون إغلاق'); }
  function textOf(t){ return [ticketNo(t),ticketProject(t),ticketSupervisor(t),t.title,t.description,statusLabel(t.status),priorityLabel(t.priority),ticketRecipient(t),ticketClosedBy(t),t.closure_note].join(' '); }

  function ensureStyle(){
    if($('ticketsClientReportStyleV10286')) return;
    const st=document.createElement('style'); st.id='ticketsClientReportStyleV10286'; st.textContent=`
      .ticket-date-v10286{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:8px;grid-column:1/-1}.ticket-date-v10286 label{font-size:12px;font-weight:800;color:#0b4d3b}.ticket-date-v10286 input{width:100%;padding:10px!important;border:1px solid #cfe2dc!important;border-radius:10px!important;background:#fff!important;color:#062f26!important}
      .ticket-client-pdf-v10286{background:#0b4d3b!important;color:#fff!important}.tickets-version-v10286{font-size:12px;color:#0b5d49;font-weight:900;margin-inline-start:8px;align-self:center}
      .ticket-root-v10246-filters{grid-template-columns:repeat(2,minmax(180px,1fr))!important}
    `; document.head.appendChild(st);
  }

  function insertAfter(ref,node){ if(ref && ref.parentNode) ref.parentNode.insertBefore(node, ref.nextSibling); }
  function ensureAdminControls(){
    const wrap=$('ticketFiltersV10246') || $('ticketsBody')?.closest('.card')?.querySelector('.filters');
    if(!wrap) return;
    if(!$('ticketFromDateV10286')){
      const div=document.createElement('div'); div.className='ticket-date-v10286'; div.innerHTML=`<div><label>من تاريخ</label><input id="ticketFromDateV10286" type="date"></div><div><label>إلى تاريخ</label><input id="ticketToDateV10286" type="date"></div>`;
      const search=$('ticketRootSearchV10246') || $('ticketSearch');
      if(search) wrap.insertBefore(div, search); else wrap.appendChild(div);
      div.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>renderTicketsV10286('admin'),true));
    }
    const pdf=$('ticketRootPdfV10246') || [...wrap.querySelectorAll('button')].find(b=>/PDF|طباعة/.test(S(b.textContent)));
    if(pdf && !pdf.dataset.v10286Pdf){ pdf.dataset.v10286Pdf='1'; pdf.textContent='PDF للعميل'; pdf.classList.add('ticket-client-pdf-v10286'); pdf.addEventListener('click',e=>{e.preventDefault(); e.stopImmediatePropagation(); exportPdfV10286('admin');},true); }
    if(!$('ticketsVersionV10286')){ const sp=document.createElement('span'); sp.id='ticketsVersionV10286'; sp.className='tickets-version-v10286'; sp.textContent=VERSION; (wrap.querySelector('.ticket-root-v10246-actions')||wrap).appendChild(sp); }
  }
  function ensureSupervisorControls(){
    const body=$('supTicketsBody'); if(!body) return;
    const card=body.closest('.card') || body.parentElement;
    const filters=card.querySelector('.filters') || card.insertBefore(document.createElement('div'), body);
    filters.classList.add('filters');
    if(!$('supTicketFromDateV10286')){
      const div=document.createElement('div'); div.className='ticket-date-v10286'; div.innerHTML=`<div><label>من تاريخ</label><input id="supTicketFromDateV10286" type="date"></div><div><label>إلى تاريخ</label><input id="supTicketToDateV10286" type="date"></div>`;
      const search=$('supTicketSearch');
      if(search) insertAfter(search, div); else filters.appendChild(div);
      div.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>renderTicketsV10286('supervisor'),true));
    }
    if(!$('supTicketClientPdfV10286')){ const btn=document.createElement('button'); btn.id='supTicketClientPdfV10286'; btn.type='button'; btn.className='ticket-client-pdf-v10286'; btn.textContent='PDF للعميل'; btn.addEventListener('click',e=>{e.preventDefault(); exportPdfV10286('supervisor');},true); filters.appendChild(btn); }
    if(!$('supTicketsVersionV10286')){ const sp=document.createElement('span'); sp.id='supTicketsVersionV10286'; sp.className='tickets-version-v10286'; sp.textContent=VERSION; filters.appendChild(sp); }
    ['supTicketFilterProject','supTicketFilterStatus','supTicketSortOrder','supTicketSearch'].forEach(id=>{ const el=$(id); if(el && !el.dataset.v10286Bound){ el.dataset.v10286Bound='1'; el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>renderTicketsV10286('supervisor'),true); }});
  }
  function getState(mode){
    if(mode==='supervisor') return {project:K($('supTicketFilterProject')?.value), supervisor:'', title:'', status:S($('supTicketFilterStatus')?.value), recipient:'', closed:'', sort:S($('supTicketSortOrder')?.value||'newest'), search:K($('supTicketSearch')?.value), from:S($('supTicketFromDateV10286')?.value), to:S($('supTicketToDateV10286')?.value)};
    return {project:K($('ticketRootProjectV10246')?.value || $('ticketFilterProject')?.value), supervisor:K($('ticketRootSupervisorV10246')?.value || $('ticketFilterSupervisor')?.value), title:K($('ticketRootTitleV10246')?.value || $('ticketFilterTitle')?.value), status:S($('ticketRootStatusV10246')?.value || $('ticketFilterStatus')?.value), recipient:S($('ticketRootRecipientV10246')?.value || ''), closed:S($('ticketRootClosedByV10246')?.value || ''), sort:S($('ticketRootSortV10246')?.value || $('ticketSortOrder')?.value || 'newest'), search:K($('ticketRootSearchV10246')?.value || $('ticketSearch')?.value), from:S($('ticketFromDateV10286')?.value), to:S($('ticketToDateV10286')?.value)};
  }
  function supervisorAllowed(t){
    const u=sessionUser(); if(!u || u.role!=='supervisor') return true;
    const supId=S(u.id); const projectIds=new Set(projects().filter(p=>S(p.supervisor_id)===supId).map(p=>S(p.id)));
    return S(t.supervisor_id)===supId || S(t.created_by)===supId || projectIds.has(S(t.project_id));
  }
  function matches(t,f,mode){
    if(mode==='supervisor' && !supervisorAllowed(t)) return false;
    if(f.project && K(ticketProject(t))!==f.project) return false;
    if(f.supervisor && K(ticketSupervisor(t))!==f.supervisor) return false;
    if(f.title && K(t.title || t.problem_type || t.category)!==f.title) return false;
    if(f.status && S(t.status||'open')!==f.status) return false;
    if(f.recipient===NO_RECEIPT && hasReceipt(t)) return false; else if(f.recipient && f.recipient!==NO_RECEIPT && K(ticketRecipient(t))!==K(f.recipient)) return false;
    if(f.closed===NO_CLOSED && hasClosedBy(t)) return false; else if(f.closed && f.closed!==NO_CLOSED && K(ticketClosedBy(t))!==K(f.closed)) return false;
    const d=dateOnly(rawDate(t)); if(f.from && (!d || d < f.from)) return false; if(f.to && (!d || d > f.to)) return false;
    if(f.search && !K(textOf(t)).includes(f.search)) return false;
    return true;
  }
  function filteredRows(mode){ const f=getState(mode); const rows=A(D().tickets).filter(t=>matches(t,f,mode)); rows.sort((a,b)=>f.sort==='oldest'?dateMs(a)-dateMs(b):dateMs(b)-dateMs(a)); return rows; }
  function cardHtml(t,mode){
    const id=Number(t.id)||0;
    const actions=[typeof window.viewTicketSmartV147==='function'?`<button type="button" onclick="viewTicketSmartV147(${id})">عرض</button>`:'', typeof window.ticketDownloadPdfV206==='function'?`<button type="button" class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>`:'', typeof window.editTicket==='function'?`<button type="button" class="light" onclick="editTicket(${id})">تعديل</button>`:'', S(t.status)==='closed'?(typeof window.setTicketStatus==='function'?`<button type="button" class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:''):`${S(t.status)!=='processing'&&typeof window.claimTicket==='function'?`<button type="button" class="light" onclick="claimTicket(${id})">استلام</button>`:''}${typeof window.closeTicket==='function'?`<button type="button" onclick="closeTicket(${id})">إغلاق</button>`:''}`, mode==='admin'&&typeof window.deleteRow==='function'?`<button type="button" class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`:''].filter(Boolean).join(' ');
    return `<article class="smart-ticket-card ${statusClass(t.status)}"><div class="smart-ticket-top"><div><strong>${E(ticketNo(t))}</strong><small>${E(fmtDate(t))}</small></div><span class="smart-ticket-status ${statusClass(t.status)}">${E(statusLabel(t.status))}</span></div><h3>${E(t.title||'-')}</h3><div class="smart-ticket-meta"><span>المشروع: <b>${E(ticketProject(t))}</b></span><span>المشرف: <b>${E(ticketSupervisor(t))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span></div><p>${E(t.description||'لا يوجد وصف')}</p><div class="smart-ticket-mini"><span>المستلم: ${E(ticketRecipient(t))}</span><span>المغلق: ${E(ticketClosedBy(t))}</span></div>${t.closure_note?`<div class="smart-ticket-note">الحل: ${E(t.closure_note)}</div>`:''}<div class="smart-ticket-actions">${actions}</div></article>`;
  }
  function updateSummary(mode,rows){
    const id=mode==='supervisor'?'supTicketsSmartSummary':'ticketsSmartSummary'; const box=$(id); if(!box) return;
    box.innerHTML=`<div class="ticket-root-v10246-summary"><span class="ticket-root-v10246-kpi">المعروض: <b>${rows.length}</b></span><span class="ticket-root-v10246-kpi">مفتوح: <b>${rows.filter(t=>S(t.status||'open')==='open').length}</b></span><span class="ticket-root-v10246-kpi">تحت المعالجة: <b>${rows.filter(t=>S(t.status)==='processing').length}</b></span><span class="ticket-root-v10246-kpi">مغلق: <b>${rows.filter(t=>S(t.status)==='closed').length}</b></span></div>`;
  }
  function renderTicketsV10286(mode){
    ensureStyle(); if(mode==='supervisor') ensureSupervisorControls(); else ensureAdminControls();
    const body=$(mode==='supervisor'?'supTicketsBody':'ticketsBody'); if(!body) return;
    const rows=filteredRows(mode); body.classList.add('smart-ticket-grid'); body.innerHTML=rows.map(t=>cardHtml(t,mode)).join('') || '<div class="muted" style="padding:16px">لا توجد تكتات مطابقة للفلاتر الحالية</div>'; updateSummary(mode,rows);
  }
  function filtersText(mode){
    const f=getState(mode), parts=[];
    const add=(name,val)=>{ if(S(val)) parts.push(`${name}: ${val===NO_RECEIPT?'بدون استلام':val===NO_CLOSED?'بدون إغلاق':val}`); };
    add('المشروع', mode==='supervisor'?$('supTicketFilterProject')?.selectedOptions?.[0]?.textContent:$('ticketRootProjectV10246')?.selectedOptions?.[0]?.textContent);
    add('المشرف', $('ticketRootSupervisorV10246')?.selectedOptions?.[0]?.textContent);
    add('نوع المشكلة', $('ticketRootTitleV10246')?.selectedOptions?.[0]?.textContent);
    add('الحالة', mode==='supervisor'?$('supTicketFilterStatus')?.selectedOptions?.[0]?.textContent:$('ticketRootStatusV10246')?.selectedOptions?.[0]?.textContent);
    add('المستلم', $('ticketRootRecipientV10246')?.selectedOptions?.[0]?.textContent);
    add('المغلق', $('ticketRootClosedByV10246')?.selectedOptions?.[0]?.textContent);
    add('من تاريخ', f.from); add('إلى تاريخ', f.to); add('بحث', f.search);
    return parts.length ? parts.join(' | ') : 'كل التكتات';
  }
  function exportPdfV10286(mode){
    const rows=filteredRows(mode); const title=mode==='supervisor'?'تقرير تكتات المشرف':'تقرير التكتات للعميل';
    const open=rows.filter(t=>S(t.status||'open')==='open').length, proc=rows.filter(t=>S(t.status)==='processing').length, closed=rows.filter(t=>S(t.status)==='closed').length;
    const html=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${E(title)}</title><style>
      @page{size:A4 landscape;margin:10mm}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#12372b;background:#fff}.page{padding:16px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #07543f;padding-bottom:12px;margin-bottom:12px}.brand{display:flex;align-items:center;gap:12px}.brand img{width:78px;max-height:58px;object-fit:contain}.brand h2{margin:0;color:#07543f;font-size:24px}.brand p{margin:4px 0 0;color:#5b6d65}.title{text-align:left}.title h1{margin:0;color:#07543f;font-size:25px}.title small{color:#66756e}.notice{border:1px solid #cfe6dc;background:#eef8f4;border-radius:12px;padding:10px 14px;margin:12px 0;font-weight:800;text-align:center;color:#0c4b3a}.meta{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin:10px 0}.box{border:1px solid #d6e5df;background:#fbfdfc;border-radius:10px;padding:8px}.box small{display:block;color:#62756e;margin-bottom:4px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.kpi{background:#f0f8f5;border:1px solid #d2e8df;border-radius:12px;padding:10px;text-align:center}.kpi b{font-size:22px;color:#07543f}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px}th{background:#07543f;color:#fff}td,th{border:1px solid #cbd9d3;padding:6px;text-align:right;vertical-align:top}tbody tr:nth-child(even) td{background:#f7faf9}.desc{max-width:250px;white-space:pre-wrap;line-height:1.5}.footer{border-top:1px solid #d6e5df;margin-top:12px;padding-top:8px;color:#66756e;text-align:center;font-size:11px}.no-data{padding:30px;text-align:center;border:1px dashed #ccd9d5;border-radius:12px;margin-top:12px}
    </style></head><body><div class="page"><div class="head"><div class="brand"><img src="tasneef_logo_print.png" onerror="this.style.display='none'"><div><h2>شركة تصنيف لإدارة المرافق</h2><p>إدارة المرافق والتشغيل والصيانة</p></div></div><div class="title"><h1>${E(title)}</h1><small>تاريخ الإصدار: ${E(new Date().toLocaleString('ar-SA'))}</small></div></div><div class="notice">${E(PHRASE)}</div><div class="meta"><div class="box"><small>الفلاتر المطبقة</small>${E(filtersText(mode))}</div><div class="box"><small>مصدر التقرير</small>نظام شركة تصنيف</div><div class="box"><small>المستخدم</small>${E(sessionUser()?.full_name || sessionUser()?.username || 'النظام')}</div></div><div class="kpis"><div class="kpi"><small>الإجمالي</small><br><b>${rows.length}</b></div><div class="kpi"><small>مفتوح</small><br><b>${open}</b></div><div class="kpi"><small>تحت المعالجة</small><br><b>${proc}</b></div><div class="kpi"><small>مغلق</small><br><b>${closed}</b></div></div>${rows.length?`<table><thead><tr><th>#</th><th>رقم التكت</th><th>التاريخ</th><th>المشروع</th><th>المشرف</th><th>نوع المشكلة</th><th>الحالة</th><th>الأولوية</th><th>المستلم</th><th>المغلق</th><th>الوصف / الحل</th></tr></thead><tbody>${rows.map((t,i)=>`<tr><td>${i+1}</td><td><b>${E(ticketNo(t))}</b></td><td>${E(fmtDate(t))}</td><td>${E(ticketProject(t))}</td><td>${E(ticketSupervisor(t))}</td><td>${E(t.title||'-')}</td><td>${E(statusLabel(t.status))}</td><td>${E(priorityLabel(t.priority))}</td><td>${E(ticketRecipient(t))}</td><td>${E(ticketClosedBy(t))}</td><td class="desc">${E(t.description||'-')}${t.closure_note?`<br><b>الحل:</b> ${E(t.closure_note)}`:''}</td></tr>`).join('')}</tbody></table>`:'<div class="no-data">لا توجد تكتات مطابقة للفلاتر المحددة</div>'}<div class="footer">${E(PHRASE)}</div></div><script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`;
    const w=window.open('','_blank'); if(!w) return msgErr('المتصفح منع فتح نافذة الطباعة'); w.document.write(html); w.document.close();
  }
  window.ticketsDownloadPdfV10286 = exportPdfV10286;
  window.renderTicketsV10286 = renderTicketsV10286;

  function boot(){ ensureStyle(); ensureAdminControls(); ensureSupervisorControls(); const old=window.renderTickets; window.renderTickets=function(){ try{ if($('supTicketsBody')) renderTicketsV10286('supervisor'); if($('ticketsBody')) renderTicketsV10286('admin'); }catch(e){ console.warn(e); if(typeof old==='function') old(); } }; setTimeout(()=>{ try{ if($('ticketsBody')) renderTicketsV10286('admin'); if($('supTicketsBody')) renderTicketsV10286('supervisor'); }catch(e){console.warn(e);} },500); setTimeout(()=>{ try{ if($('ticketsBody')) renderTicketsV10286('admin'); if($('supTicketsBody')) renderTicketsV10286('supervisor'); }catch(e){console.warn(e);} },1300); }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
})();
