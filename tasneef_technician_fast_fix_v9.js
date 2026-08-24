/*
 * TASNEEF V10853 - Technician project name visibility fix
 * يعالج اختفاء اسم المشروع في نسخة الفني مع الحفاظ على نفس وظائف التكتات.
 */
(function(){
  'use strict';
  if(window.__tasneefTechnicianProjectNameFixV10853) return;
  window.__tasneefTechnicianProjectNameFixV10853 = true;

  const BUILD = 'V10853_TECHNICIAN_PROJECT_NAME_FIX';
  const CACHE_KEY = 'tasneef_technician_project_names_v10853';
  const $id = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  let hydrateBusy = false;
  let projectNames = readCache();

  function store(){
    try{
      if(window.data && typeof window.data === 'object') return window.data;
      if(typeof data !== 'undefined' && data && typeof data === 'object') return data;
    }catch(_){ }
    window.data = window.data || {projects:[],tickets:[]};
    return window.data;
  }

  function readCache(){
    try{
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    }catch(_){ return {}; }
  }

  function saveCache(){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(projectNames)); }catch(_){ }
  }

  function cleanName(value, projectId){
    let name = S(value);
    if(!name || name === '-' || name === 'null' || name === 'undefined') return '';
    if(projectId && name === S(projectId)) return '';
    return name;
  }

  function directTicketProjectName(ticket){
    const nestedProject = Array.isArray(ticket?.projects) ? ticket.projects[0] : ticket?.projects;
    const nestedProject2 = Array.isArray(ticket?.project) ? ticket.project[0] : ticket?.project;
    const candidates = [
      ticket?.project_name,
      ticket?.projectName,
      ticket?.project_title,
      ticket?.project_label,
      ticket?.project_data?.name,
      nestedProject?.name,
      nestedProject?.project_name,
      nestedProject2?.name,
      nestedProject2?.project_name
    ];
    for(const candidate of candidates){
      const name = cleanName(candidate, ticket?.project_id);
      if(name) return name;
    }
    return '';
  }

  function rememberProject(id, name){
    const pid = S(id);
    const clean = cleanName(name, pid);
    if(!pid || !clean) return;
    projectNames[pid] = clean;
  }

  function indexKnownNames(){
    const d = store();
    A(d.projects).forEach(p => rememberProject(p?.id, p?.name || p?.project_name || p?.title));
    A(d.tickets).forEach(t => rememberProject(t?.project_id, directTicketProjectName(t)));
    saveCache();
  }

  function resolveProjectName(ticket){
    const pid = S(ticket?.project_id);
    const direct = directTicketProjectName(ticket);
    if(direct){ rememberProject(pid, direct); return direct; }
    const d = store();
    const project = A(d.projects).find(p => S(p?.id) === pid);
    const fromProjects = cleanName(project?.name || project?.project_name || project?.title, pid);
    if(fromProjects){ rememberProject(pid, fromProjects); return fromProjects; }
    return cleanName(projectNames[pid], pid) || 'غير محدد';
  }
  window.technicianProjectNameV10853 = resolveProjectName;

  function mergeRpcTickets(rows){
    const d = store();
    const current = A(d.tickets);
    const map = new Map(current.map(t => [S(t?.id), t]));
    A(rows).forEach(row => {
      const id = S(row?.id);
      if(!id) return;
      map.set(id, Object.assign({}, map.get(id) || {}, row));
    });
    d.tickets = [...map.values()];
  }

  async function fetchRichTickets(){
    if(!window.sb || typeof window.sb.rpc !== 'function') return;
    try{
      const result = await window.sb.rpc('tasneef_tickets_all_v10519');
      if(!result?.error && Array.isArray(result?.data)) mergeRpcTickets(result.data);
    }catch(e){ console.warn(BUILD + ' tickets RPC:', e?.message || e); }
  }

  async function fetchMissingProjects(){
    if(!window.sb || typeof window.sb.from !== 'function') return;
    const d = store();
    const ids = [...new Set(A(d.tickets).map(t => S(t?.project_id)).filter(Boolean))];
    if(!ids.length) return;
    try{
      const result = await window.sb.from('projects').select('id,name,supervisor_id,is_active').in('id', ids);
      if(result?.error || !Array.isArray(result?.data)) return;
      const existing = new Map(A(d.projects).map(p => [S(p?.id), p]));
      result.data.forEach(p => {
        existing.set(S(p.id), Object.assign({}, existing.get(S(p.id)) || {}, p));
        rememberProject(p.id, p.name);
      });
      d.projects = [...existing.values()];
    }catch(e){ console.warn(BUILD + ' projects query:', e?.message || e); }
  }

  function addSyntheticProjectsFromCache(){
    const d = store();
    const existing = new Map(A(d.projects).map(p => [S(p?.id), p]));
    Object.entries(projectNames).forEach(([id,name]) => {
      if(!existing.has(S(id))) existing.set(S(id), {id, name, is_active:true, __technicianNameCache:true});
    });
    d.projects = [...existing.values()];
  }

  function refillProjectSelect(){
    const select = $id('techNewTicketProject');
    if(!select) return;
    const old = S(select.value);
    const d = store();
    const seen = new Set();
    const projects = A(d.projects)
      .map(p => ({id:S(p?.id), name:cleanName(p?.name || p?.project_name || projectNames[S(p?.id)], p?.id)}))
      .filter(p => p.id && p.name && !seen.has(p.id) && seen.add(p.id))
      .sort((a,b) => a.name.localeCompare(b.name, 'ar'));
    select.innerHTML = '<option value="">اختر المشروع</option>' + projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    if(projects.some(p => p.id === old)) select.value = old;
  }

  async function hydrateProjectNames(renderAfter=true){
    if(hydrateBusy) return;
    hydrateBusy = true;
    try{
      indexKnownNames();
      await fetchRichTickets();
      indexKnownNames();
      await fetchMissingProjects();
      indexKnownNames();
      addSyntheticProjectsFromCache();
      refillProjectSelect();
      if(renderAfter) renderTechnicianTicketsFixed();
    }finally{ hydrateBusy = false; }
  }

  function escapeHtml(value){
    return S(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function ticketNo(t){ return t?.ticket_number || ('T-' + String(t?.id || 0).padStart(4,'0')); }
  function statusText(v){ return v === 'closed' ? 'مغلق' : (v === 'processing' ? 'تحت المعالجة' : 'مفتوح'); }
  function priorityText(v){ return v === 'urgent' ? 'عاجل' : (v === 'high' ? 'مهم' : (v === 'low' ? 'منخفض' : 'عادي')); }
  function short(value, max=80){ const text=S(value); return escapeHtml(text.length > max ? text.slice(0,max) + '…' : (text || '-')); }
  function dateObject(v){ const x=v ? new Date(v) : null; return x && !isNaN(x) ? x : null; }
  function between(a,b){ const x=dateObject(a), y=dateObject(b); return (!x || !y) ? 0 : Math.max(0, Math.round((y-x)/60000)); }
  function duration(minutes){ minutes=Number(minutes||0); if(!minutes) return '0د'; const day=Math.floor(minutes/1440), hour=Math.floor((minutes%1440)/60), minute=minutes%60; return [day?day+'ي':'',hour?hour+'س':'',(minute||(!day&&!hour))?minute+'د':''].filter(Boolean).join(' '); }
  function openMinutes(t){ return t?.status === 'closed' ? (Number(t?.open_duration_minutes||0) || between(t?.created_at,t?.closed_at)) : between(t?.created_at,new Date().toISOString()); }
  function rowClass(t){ return t?.status === 'closed' ? 'ticket-row-closed' : (t?.status === 'processing' ? 'ticket-row-processing' : ((t?.priority === 'urgent' || t?.priority === 'high') ? 'ticket-row-urgent' : 'ticket-row-normal')); }
  function statusBadge(t){ const cls=t?.status==='closed'?'green':(t?.status==='processing'?'amber':((t?.priority==='urgent'||t?.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${statusText(t?.status)}</span>`; }
  function priorityBadge(t){ const cls=t?.priority==='urgent'?'red':(t?.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${priorityText(t?.priority)}</span>`; }
  function formatDate(v){ try{ return typeof window.fmt === 'function' ? window.fmt(v) : (v ? new Date(v).toLocaleString('ar-SA') : ''); }catch(_){ return ''; } }
  function currentTechnician(){ try{ return typeof window.session === 'function' ? (window.session() || {}) : JSON.parse(localStorage.getItem('tasneef_user') || '{}'); }catch(_){ return {}; } }
  function whatsappButton(t){
    if(typeof window.sendTicketWhatsAppV43 === 'function') return `<button type="button" class="wa-ticket-btn-v46" onclick="sendTicketWhatsAppV43(${Number(t?.id)||0})">واتساب<br><small>${t?.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;
    if(typeof window.sendTicketWhatsApp === 'function') return `<button type="button" class="wa-ticket-btn-v46" onclick="sendTicketWhatsApp(${Number(t?.id)||0})">واتساب<br><small>${t?.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;
    return '-';
  }

  function filteredTickets(kind){
    const d=store(), u=currentTechnician();
    let rows=[...A(d.tickets)];
    const q=S($id('techTicketSearch')?.value).toLowerCase();
    const status=S($id('techTicketStatus')?.value);
    if(status) rows=rows.filter(t => S(t?.status) === status);
    if(q) rows=rows.filter(t => [ticketNo(t),t?.title,t?.description,resolveProjectName(t),statusText(t?.status),t?.claimed_by_name,t?.closed_by_name,t?.closure_note].join(' ').toLowerCase().includes(q));
    if(kind==='open') rows=rows.filter(t => t?.status!=='closed' && !t?.claimed_by);
    if(kind==='mine') rows=rows.filter(t => S(t?.claimed_by)===S(u?.id) && t?.status!=='closed');
    if(kind==='done') rows=rows.filter(t => S(t?.closed_by)===S(u?.id) || (t?.status==='closed' && S(t?.closed_by_name)===S(u?.full_name||u?.username)));
    const order=S($id('techTicketSortOrder')?.value)||'newest';
    return rows.sort((a,b) => { const x=+new Date(a?.created_at||0), y=+new Date(b?.created_at||0); return order==='oldest' ? x-y : y-x; });
  }

  function renderBody(kind, bodyId){
    const body=$id(bodyId); if(!body) return;
    const rows=filteredTickets(kind);
    body.innerHTML=rows.map(t => `<tr class="${rowClass(t)}"><td><b>${escapeHtml(ticketNo(t))}</b></td><td><b class="tech-project-name-v10853">${escapeHtml(resolveProjectName(t))}</b></td><td>${escapeHtml(t?.title||'-')}</td><td style="white-space:normal;min-width:180px">${short(t?.description)}</td><td>${priorityBadge(t)}</td><td>${statusBadge(t)}</td><td>${escapeHtml(duration(openMinutes(t)))}</td><td>${escapeHtml(t?.claimed_by_name||'-')}<br><small>${t?.claimed_at?escapeHtml(formatDate(t.claimed_at)):''}</small></td><td>${escapeHtml(t?.closed_by_name||'-')}<br><small>${t?.closed_at?escapeHtml(formatDate(t.closed_at)):''}</small></td><td style="white-space:normal;min-width:180px">${short(t?.closure_note)}</td><td class="whatsapp-col">${whatsappButton(t)}</td><td class="row-actions">${t?.status==='closed'?'':`${!t?.claimed_by?`<button onclick="techClaimTicket(${Number(t?.id)||0})">استلام</button>`:''}<button onclick="techCloseTicket(${Number(t?.id)||0})">إغلاق</button>`}</td></tr>`).join('') || '<tr><td colspan="12">لا توجد تكتات</td></tr>';
  }

  function updateKpis(){
    const d=store(), u=currentTechnician();
    if($id('techOpenCount')) $id('techOpenCount').textContent=A(d.tickets).filter(t=>t?.status!=='closed'&&!t?.claimed_by).length;
    if($id('techMineCount')) $id('techMineCount').textContent=A(d.tickets).filter(t=>S(t?.claimed_by)===S(u?.id)&&t?.status!=='closed').length;
    if($id('techDoneCount')) $id('techDoneCount').textContent=A(d.tickets).filter(t=>S(t?.closed_by)===S(u?.id)).length;
  }

  function renderTechnicianTicketsFixed(){
    indexKnownNames();
    renderBody('open','techOpenTicketsBody');
    renderBody('mine','techMyTicketsBody');
    renderBody('done','techDoneTicketsBody');
    updateKpis();
  }
  window.renderTechnicianTickets = renderTechnicianTicketsFixed;

  const originalLoadAll = window.loadAll || (typeof loadAll === 'function' ? loadAll : null);
  if(typeof originalLoadAll === 'function'){
    const patchedLoadAll = async function(){
      const result = await originalLoadAll.apply(this, arguments);
      await hydrateProjectNames(false);
      return result;
    };
    window.loadAll = patchedLoadAll;
    try{ loadAll = patchedLoadAll; }catch(_){ }
  }

  function techProjectDataNeeded(){
    return !!(document.getElementById('techTicketsTab')?.classList.contains('active')||document.getElementById('techCreateTab')?.classList.contains('active'));
  }
  const originalInit = window.initTechnician;
  window.initTechnician = async function(){
    if(typeof originalInit === 'function') await originalInit.apply(this, arguments);
    if(techProjectDataNeeded()) await hydrateProjectNames(true);
  };

  const style=document.createElement('style');
  style.id='technicianProjectNameFixStyleV10853';
  style.textContent='.tech-project-name-v10853{color:#064b3b;font-weight:900;white-space:normal;min-width:130px;display:inline-block}';
  document.head.appendChild(style);

  document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&techProjectDataNeeded()) hydrateProjectNames(true); });
  window.addEventListener('storage',e=>{ if(e.key==='tasneef_client_ticket_changed_v10519'&&techProjectDataNeeded()) hydrateProjectNames(true); });
  setInterval(()=>{if(!document.hidden&&techProjectDataNeeded())hydrateProjectNames(true);},30000);
  setTimeout(()=>{if(techProjectDataNeeded())hydrateProjectNames(true);},900);
  console.log('Tasneef ' + BUILD + ' loaded');
})();
