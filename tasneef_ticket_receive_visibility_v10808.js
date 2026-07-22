/* Tasneef V10808 — ticket receipt is independent from ticket workflow status.
   Receipt stores claimed_by/claimed_at while keeping status=open.
   Received open tickets remain visible to all technicians and administration. */
(function(){
  'use strict';
  if(window.__tasneefTicketReceiveVisibilityV10808) return;
  window.__tasneefTicketReceiveVisibilityV10808 = true;

  const BUILD = 'V10808_TICKET_RECEIVE_VISIBILITY';
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const escV = v => {
    try { if(typeof window.esc === 'function') return window.esc(v); } catch(_) {}
    return S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  };

  function currentUser(){
    try { if(typeof window.session === 'function') return window.session() || {}; } catch(_) {}
    try { return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; } catch(_) { return {}; }
  }
  function currentName(){
    const u=currentUser();
    return S(u.full_name || u.name || u.display_name || u.username || u.email || (u.role==='technician'?'فني':'مستخدم'));
  }
  function ticketById(id){ return A(window.data?.tickets).find(t => S(t.id) === S(id)); }
  function isClosed(t){ return S(t?.status).toLowerCase() === 'closed'; }
  function isReceived(t){ return !!S(t?.claimed_by || t?.claimed_by_name || t?.claimed_at || t?.received_by || t?.received_by_name || t?.received_at); }
  function ticketNo(t){ return S(t?.ticket_number || t?.ticket_no || t?.no) || ('T-' + String(t?.id || 0).padStart(4,'0')); }
  function projectNameSafe(id){
    try { if(typeof window.projectName === 'function') return window.projectName(id) || '-'; } catch(_) {}
    return S(A(window.data?.projects).find(p=>S(p.id)===S(id))?.name) || '-';
  }
  function statusLabel(t){
    const s=S(t?.status).toLowerCase();
    if(s==='closed') return 'مغلق';
    if(s==='processing' || s==='in_progress') return 'تحت المعالجة';
    return isReceived(t) ? 'مفتوح — مستلم' : 'مفتوح';
  }
  function priorityLabel(p){ p=S(p); return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function dateObj(v){ const d=v?new Date(v):null; return d && !isNaN(d) ? d : null; }
  function minutesBetween(a,b){ const x=dateObj(a),y=dateObj(b); return (!x||!y)?0:Math.max(0,Math.round((y-x)/60000)); }
  function durationText(min){ min=Number(min||0); if(!min) return '0د'; const d=Math.floor(min/1440),h=Math.floor((min%1440)/60),m=min%60,out=[]; if(d)out.push(d+'ي'); if(h)out.push(h+'س'); if(m||!out.length)out.push(m+'د'); return out.join(' '); }
  function openMinutes(t){ return isClosed(t) ? (Number(t.open_duration_minutes||0)||minutesBetween(t.created_at,t.closed_at)) : minutesBetween(t.created_at,new Date().toISOString()); }
  function fmtSafe(v){
    try { if(typeof window.fmt === 'function') return window.fmt(v); } catch(_) {}
    const d=dateObj(v); return d?d.toLocaleString('ar-SA'):'-';
  }
  function notify(text,type){
    try { if(typeof window.msg === 'function') return window.msg(text,type); } catch(_) {}
    console[type==='err'?'error':'log'](text);
  }
  function sound(){ try { if(typeof window.playAppSound === 'function') window.playAppSound('ticket'); } catch(_) {} }

  async function refreshTicketViews(){
    try {
      if(typeof window.tasneefRefreshTicketsV10519 === 'function') {
        await window.tasneefRefreshTicketsV10519();
      } else if(typeof window.loadAll === 'function') {
        await window.loadAll();
      }
    } catch(e){ console.warn(BUILD,'refresh',e); }
    try { if(typeof window.renderTickets === 'function') window.renderTickets(); } catch(e){ console.warn(BUILD,'render admin',e); }
    try { if(typeof window.renderTechnicianTickets === 'function') window.renderTechnicianTickets(); } catch(e){ console.warn(BUILD,'render technician',e); }
  }

  async function receiveTicket(id){
    const u=currentUser();
    if(!S(u.id)) return notify('سجّل الدخول أولاً','err');
    const t=ticketById(id);
    if(!t) return notify('التكت غير موجود','err');
    if(isClosed(t)) return notify('التكت مغلق','err');

    if(isReceived(t)) {
      const same = S(t.claimed_by) && S(t.claimed_by)===S(u.id);
      return notify(same ? 'هذا التكت مستلم بواسطتك بالفعل' : ('هذا التكت مستلم بواسطة '+S(t.claimed_by_name||'مستخدم آخر')), same?undefined:'err');
    }

    if(!window.sb?.from) return notify('تعذر الاتصال بقاعدة البيانات','err');
    const now=new Date().toISOString();
    const name=currentName();
    const payload={
      // الاستلام لا يغيّر مسار حالة التكت.
      status:'open',
      claimed_by:u.id,
      claimed_by_name:name,
      claimed_at:now,
      updated_at:now
    };

    let q=window.sb.from('tickets').update(payload,{count:'exact'}).eq('id',id).neq('status','closed');
    // منع استلام نفس التكت بالتزامن من شخصين عند توفر claimed_by فارغًا.
    try { q=q.is('claimed_by',null); } catch(_) {}
    const res=await q;
    if(res?.error) return notify(res.error.message,'err');
    if(Number(res?.count)===0) {
      await refreshTicketViews();
      const latest=ticketById(id);
      return notify(isReceived(latest)?('تم استلام التكت مسبقًا بواسطة '+S(latest.claimed_by_name||'مستخدم آخر')):'تعذر استلام التكت، أعد المحاولة','err');
    }

    Object.assign(t,payload,{status:'open'});
    sound();
    notify('تم استلام التكت بواسطة '+name+'، وبقيت حالته مفتوحة');
    await refreshTicketViews();
  }

  // اعتماد دالة واحدة للاستلام في الإدارة والمشرف والفني.
  window.claimTicket = receiveTicket;
  window.techClaimTicket = receiveTicket;
  window.receiveTicketV10808 = receiveTicket;

  function rowClass(t){
    if(isClosed(t)) return 'ticket-row-closed';
    if(S(t.status)==='processing') return 'ticket-row-processing';
    if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent';
    return 'ticket-row-normal';
  }
  function statusBadge(t){
    const s=S(t.status);
    const cls=isClosed(t)?'green':(s==='processing'?'amber':(isReceived(t)?'blue':((t.priority==='urgent'||t.priority==='high')?'red':'pink')));
    return `<span class="badge ${cls}">${escV(statusLabel(t))}</span>`;
  }
  function priorityBadge(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${escV(priorityLabel(t.priority))}</span>`; }
  function shortText(v,n=80){ const x=S(v); return x.length>n?escV(x.slice(0,n))+'…':escV(x||'-'); }
  function whatsappButton(t){
    const fn=typeof window.sendTicketWhatsAppV43==='function'?'sendTicketWhatsAppV43':(typeof window.sendTicketWhatsApp==='function'?'sendTicketWhatsApp':'');
    return fn?`<button type="button" class="wa-ticket-btn-v46" onclick="${fn}(${Number(t.id)})">واتساب<br><small>${isClosed(t)?'إغلاق التكت':'فتح التكت'}</small></button>`:'-';
  }
  function techRows(kind){
    const u=currentUser();
    let rows=[...A(window.data?.tickets)];
    const q=S($('techTicketSearch')?.value).toLowerCase();
    const st=S($('techTicketStatus')?.value);
    if(st) rows=rows.filter(t=>S(t.status)===st);
    if(q) rows=rows.filter(t=>[ticketNo(t),t.title,t.description,projectNameSafe(t.project_id),statusLabel(t),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));

    // جميع التكتات غير المغلقة تبقى ظاهرة لكل الفنيين حتى بعد الاستلام.
    if(kind==='open') rows=rows.filter(t=>!isClosed(t));
    if(kind==='mine') rows=rows.filter(t=>!isClosed(t) && S(t.claimed_by)===S(u.id));
    if(kind==='done') rows=rows.filter(t=>S(t.closed_by)===S(u.id) || (isClosed(t)&&S(t.closed_by_name)===currentName()));

    const order=S($('techTicketSortOrder')?.value)||'newest';
    return rows.sort((a,b)=>{ const da=+new Date(a.created_at||0),db=+new Date(b.created_at||0); return order==='oldest'?da-db:db-da; });
  }
  function techAction(t){
    if(isClosed(t)) return '';
    const receive=isReceived(t)
      ? `<span class="ticket-received-chip-v10808" title="${escV(t.claimed_at?fmtSafe(t.claimed_at):'')}">مستلم: ${escV(t.claimed_by_name||'-')}</span>`
      : `<button type="button" onclick="techClaimTicket(${Number(t.id)})">استلام</button>`;
    return `${receive}<button type="button" onclick="techCloseTicket(${Number(t.id)})">إغلاق</button>`;
  }
  function renderTechBody(kind,id){
    const body=$(id); if(!body) return;
    const rows=techRows(kind);
    body.innerHTML=rows.map(t=>`<tr class="${rowClass(t)}" data-ticket-id="${escV(t.id)}"><td><b>${escV(ticketNo(t))}</b></td><td>${escV(projectNameSafe(t.project_id))}</td><td>${escV(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${shortText(t.description)}</td><td>${priorityBadge(t)}</td><td>${statusBadge(t)}</td><td>${escV(durationText(openMinutes(t)))}</td><td>${escV(t.claimed_by_name||'-')}<br><small>${t.claimed_at?escV(fmtSafe(t.claimed_at)):''}</small></td><td>${escV(t.closed_by_name||'-')}<br><small>${t.closed_at?escV(fmtSafe(t.closed_at)):''}</small></td><td style="white-space:normal;min-width:180px">${shortText(t.closure_note)}</td><td class="whatsapp-col">${whatsappButton(t)}</td><td class="row-actions">${techAction(t)}</td></tr>`).join('')||'<tr><td colspan="12">لا توجد تكتات</td></tr>';
  }
  function updateKpis(){
    const u=currentUser();
    if($('techOpenCount')) $('techOpenCount').textContent=A(window.data?.tickets).filter(t=>!isClosed(t)).length;
    if($('techMineCount')) $('techMineCount').textContent=A(window.data?.tickets).filter(t=>!isClosed(t)&&S(t.claimed_by)===S(u.id)).length;
    if($('techDoneCount')) $('techDoneCount').textContent=A(window.data?.tickets).filter(t=>S(t.closed_by)===S(u.id)).length;
  }
  function updateTechnicianLabels(){
    const openTitle=$('techOpen')?.querySelector('h2'); if(openTitle) openTitle.textContent='جميع التكتات المفتوحة والمستلمة';
    const mineTitle=$('techMine')?.querySelector('h2'); if(mineTitle) mineTitle.textContent='التكتات التي استلمتها';
    const openTab=[...document.querySelectorAll('.tech-ticket-tab')].find(b=>S(b.getAttribute('onclick')).includes("'techOpen'")); if(openTab) openTab.textContent='جميع التكتات';
    const mineTab=[...document.querySelectorAll('.tech-ticket-tab')].find(b=>S(b.getAttribute('onclick')).includes("'techMine'")); if(mineTab) mineTab.textContent='المستلمة بواسطتي';
  }
  window.renderTechnicianTickets=function(){
    updateTechnicianLabels();
    renderTechBody('open','techOpenTicketsBody');
    renderTechBody('mine','techMyTicketsBody');
    renderTechBody('done','techDoneTicketsBody');
    updateKpis();
  };

  function hideRepeatedReceiveButtons(){
    const tickets=A(window.data?.tickets);
    document.querySelectorAll('button[onclick*="claimTicket("]').forEach(btn=>{
      const raw=S(btn.getAttribute('onclick'));
      const m=raw.match(/claimTicket\((\d+)\)/);
      if(!m) return;
      const t=tickets.find(x=>S(x.id)===S(m[1]));
      if(!t || !isReceived(t)) return;
      const chip=document.createElement('span');
      chip.className='ticket-received-chip-v10808';
      chip.textContent='مستلم: '+S(t.claimed_by_name||'-');
      chip.title=t.claimed_at?fmtSafe(t.claimed_at):'';
      btn.replaceWith(chip);
    });
    document.querySelectorAll('[data-ticket-id]').forEach(card=>{
      const t=tickets.find(x=>S(x.id)===S(card.getAttribute('data-ticket-id')));
      if(!t || !isReceived(t) || isClosed(t)) return;
      const status=card.querySelector('.smart-ticket-status');
      if(status && !S(status.textContent).includes('مستلم')) status.textContent='مفتوح — مستلم';
    });
  }

  const previousRenderTickets=window.renderTickets;
  if(typeof previousRenderTickets==='function'){
    window.renderTickets=function(){
      const result=previousRenderTickets.apply(this,arguments);
      setTimeout(hideRepeatedReceiveButtons,0);
      setTimeout(hideRepeatedReceiveButtons,120);
      return result;
    };
  }

  function addStyle(){
    if($('ticketReceiveVisibilityStyleV10808')) return;
    const st=document.createElement('style'); st.id='ticketReceiveVisibilityStyleV10808';
    st.textContent='.ticket-received-chip-v10808{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border-radius:999px;background:#e8f4ff;color:#155b8a;border:1px solid #b7d9ef;font-size:12px;font-weight:800;white-space:nowrap}.badge.blue{background:#e8f4ff!important;color:#155b8a!important;border:1px solid #b7d9ef!important}.row-actions .ticket-received-chip-v10808{max-width:180px;overflow:hidden;text-overflow:ellipsis}@media(max-width:760px){.ticket-received-chip-v10808{white-space:normal;text-align:center}}';
    document.head.appendChild(st);
  }

  function boot(){
    addStyle();
    updateTechnicianLabels();
    hideRepeatedReceiveButtons();
    try { if($('techOpenTicketsBody') && typeof window.renderTechnicianTickets==='function') window.renderTechnicianTickets(); } catch(_) {}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,150));
  window.addEventListener('load',()=>setTimeout(boot,300));
  setTimeout(boot,800);
  console.info(BUILD,'loaded');
})();
