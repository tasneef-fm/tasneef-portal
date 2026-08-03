/*
 * TASNEEF V10855 — Technician projects final source fix
 * إصلاح نهائي لإظهار أسماء المشاريع وقائمة المشاريع داخل نسخة الفني.
 * يعتمد على أكثر من مصدر مع مصدر احتياطي من التوزيع الموحد وخيارات المشاريع الآمنة.
 */
(function(){
  'use strict';
  if(window.__tasneefTechnicianProjectsV10855) return;
  window.__tasneefTechnicianProjectsV10855 = true;

  const BUILD = 'V10855_TECHNICIAN_PROJECTS_FINAL';
  const CACHE_KEY = 'tasneef_technician_project_catalog_v10855';
  const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  const HYDRATE_TTL = 12000;
  const $ = id => document.getElementById(id);
  const S = value => String(value ?? '').trim();
  const A = value => Array.isArray(value) ? value : [];
  const catalog = new Map();
  let busy = null;
  let lastHydratedAt = 0;

  function dset(){
    let d = window.data;
    try { if(!d && typeof data !== 'undefined') d = data; } catch(_) {}
    if(!d || typeof d !== 'object') d = {};
    d.projects = A(d.projects);
    d.tickets = A(d.tickets);
    window.data = d;
    return d;
  }

  function currentUser(){
    try { if(typeof window.session === 'function') return window.session() || {}; } catch(_) {}
    try { return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; } catch(_) { return {}; }
  }

  function monthKey(offset){
    const d = new Date();
    d.setDate(15);
    d.setMonth(d.getMonth() + Number(offset || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0');
  }

  function cleanName(value, id){
    const name = S(value);
    if(!name || name === '-' || name === 'null' || name === 'undefined' || name === S(id)) return '';
    return name;
  }

  function rowProjectId(row){
    return S(row?.project_id ?? row?.projectId ?? row?.app_project_id ?? row?.project_key ?? row?.id);
  }

  function rowProjectName(row){
    return cleanName(
      row?.project_name ?? row?.project_display_name ?? row?.project_title ?? row?.official_name ??
      row?.display_name ?? row?.name ?? row?.title ?? (typeof row?.project === 'string' ? row.project : ''),
      rowProjectId(row)
    );
  }

  function activeRow(row){
    const status = S(row?.status ?? row?.project_status ?? row?.state).toLowerCase();
    if(row?.is_active === false || row?.active === false) return false;
    return !['inactive','stopped','ended','closed','cancelled','deleted','archived','موقوف','متوقف','منتهي','ملغي','محذوف','غير نشط'].includes(status);
  }

  function addProject(row, options={}){
    const id = rowProjectId(row);
    const name = rowProjectName(row);
    if(!id || !name) return;
    const old = catalog.get(id) || {};
    const supervisorId = S(row?.supervisor_id ?? row?.app_supervisor_id ?? row?.manager_id ?? old.supervisor_id);
    const selectable = options.selectable === true || old.selectable === true;
    const next = {
      ...old,
      id,
      name: name || old.name,
      supervisor_id: supervisorId || old.supervisor_id || null,
      status: S(row?.status || old.status || 'active'),
      is_active: row?.is_active === false ? false : (old.is_active === false && options.authoritative !== true ? false : true),
      active: row?.active === false ? false : (old.active === false && options.authoritative !== true ? false : true),
      selectable,
      source: S(options.source || old.source || ''),
      seen_at: Date.now()
    };
    if(options.authoritative === true && !activeRow(row)){
      next.is_active = false;
      next.active = false;
      next.selectable = false;
    }
    catalog.set(id, next);
  }

  function directTicketProjectName(ticket){
    const nestedA = Array.isArray(ticket?.projects) ? ticket.projects[0] : ticket?.projects;
    const nestedB = Array.isArray(ticket?.project) ? ticket.project[0] : ticket?.project;
    const id = ticketProjectId(ticket);
    const candidates = [
      ticket?.project_name, ticket?.projectName, ticket?.project_title, ticket?.project_label,
      ticket?.project_display_name, ticket?.project_data?.name,
      nestedA?.name, nestedA?.project_name, nestedB?.name, nestedB?.project_name,
      typeof ticket?.project === 'string' && !/^\d+$/.test(S(ticket.project)) ? ticket.project : ''
    ];
    for(const value of candidates){
      const name = cleanName(value, id);
      if(name) return name;
    }
    return '';
  }

  function ticketProjectId(ticket){
    const nestedA = Array.isArray(ticket?.projects) ? ticket.projects[0] : ticket?.projects;
    const nestedB = Array.isArray(ticket?.project) ? ticket.project[0] : ticket?.project;
    return S(ticket?.project_id ?? ticket?.projectId ?? ticket?.app_project_id ?? ticket?.project_key ?? nestedA?.id ?? nestedA?.project_id ?? nestedB?.id ?? nestedB?.project_id);
  }

  function ingestTickets(rows){
    A(rows).forEach(ticket => {
      const id = ticketProjectId(ticket);
      const name = directTicketProjectName(ticket);
      if(id && name) addProject({id, name}, {source:'ticket', selectable:false});
    });
  }

  function readCache(){
    try{
      const payload = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const at = Number(payload?.at || 0);
      if(!at || Date.now() - at > CACHE_MAX_AGE) return;
      A(payload.rows).forEach(row => addProject(row, {source:'cache', selectable:row?.selectable === true}));
    }catch(_){}
  }

  function saveCache(){
    try{
      const rows = [...catalog.values()].map(p => ({
        id:p.id, name:p.name, supervisor_id:p.supervisor_id || null, status:p.status || 'active',
        is_active:p.is_active !== false, active:p.active !== false, selectable:p.selectable === true
      }));
      localStorage.setItem(CACHE_KEY, JSON.stringify({at:Date.now(), rows}));
    }catch(_){}
  }

  function permissionToken(){
    const u = currentUser();
    return S(
      u.permission_session_token || u.session_token ||
      localStorage.getItem('tasneef_session_token_v10817') ||
      localStorage.getItem('tasneef_permission_session_v10817')
    );
  }

  async function safeSource(label, task){
    try{
      const rows = await task();
      if(Array.isArray(rows)) return rows;
      if(Array.isArray(rows?.projects)) return rows.projects;
      if(Array.isArray(rows?.rows)) return rows.rows;
      if(Array.isArray(rows?.data)) return rows.data;
      return [];
    }catch(error){
      console.warn(BUILD + ' ' + label + ':', error?.message || error);
      return [];
    }
  }

  async function fetchProjectOptionsRpc(){
    if(!window.sb?.rpc) return [];
    const token = permissionToken();
    if(!token) return [];
    const result = await window.sb.rpc('orders_project_options_v10826', {p_session_token:token});
    if(result?.error) throw result.error;
    return A(result?.data);
  }

  async function fetchProjectsService(){
    if(!window.ProjectsService?.getAccessibleProjects) return [];
    const u = currentUser();
    return A(await window.ProjectsService.getAccessibleProjects(u.id || u.user_id, 'technician', {period:'current', force:true}));
  }

  async function fetchTable(table, configure){
    if(!window.sb?.from) return [];
    let query = window.sb.from(table).select('*');
    if(typeof configure === 'function') query = configure(query) || query;
    const result = await query;
    if(result?.error) throw result.error;
    return A(result?.data);
  }

  function mergeTickets(rows){
    const d = dset();
    const map = new Map(A(d.tickets).map(t => [S(t?.id), t]));
    A(rows).forEach(row => {
      const id = S(row?.id);
      if(!id) return;
      map.set(id, Object.assign({}, map.get(id) || {}, row));
    });
    d.tickets = [...map.values()];
    try { if(typeof data !== 'undefined') data.tickets = d.tickets; } catch(_) {}
    ingestTickets(d.tickets);
  }

  async function fetchRichTickets(){
    if(!window.sb?.rpc) return [];
    const result = await window.sb.rpc('tasneef_tickets_all_v10519');
    if(result?.error) throw result.error;
    return A(result?.data);
  }

  function ingestLocal(){
    const d = dset();
    A(d.projects).forEach(p => addProject(p, {source:'local', selectable:activeRow(p), authoritative:true}));
    ingestTickets(d.tickets);
  }

  function mergeCatalogIntoData(){
    const d = dset();
    const map = new Map(A(d.projects).map(p => [S(p?.id), p]));
    catalog.forEach((project, id) => {
      const old = map.get(id) || {};
      map.set(id, {
        ...old,
        id: old.id ?? project.id,
        name: cleanName(old.name || old.project_name, id) || project.name,
        supervisor_id: old.supervisor_id || project.supervisor_id || null,
        status: old.status || project.status || 'active',
        is_active: old.is_active === false ? false : project.is_active !== false,
        active: old.active === false ? false : project.active !== false,
        __technicianCatalogV10855:true,
        __technicianSelectableV10855:project.selectable === true
      });
    });
    d.projects = [...map.values()];
    try { if(typeof data !== 'undefined') data.projects = d.projects; } catch(_) {}
  }

  function projectNameById(id){
    const key = S(id);
    if(!key) return '';
    const known = catalog.get(key);
    if(known?.name) return known.name;
    const d = dset();
    const row = A(d.projects).find(p => S(p?.id) === key);
    return cleanName(row?.name || row?.project_name || row?.title, key);
  }

  function resolveTicketProjectName(ticket){
    const direct = directTicketProjectName(ticket);
    const id = ticketProjectId(ticket);
    if(direct){
      if(id) addProject({id, name:direct}, {source:'ticket', selectable:false});
      return direct;
    }
    return projectNameById(id) || 'غير محدد';
  }
  window.technicianProjectNameV10855 = resolveTicketProjectName;

  const originalProjectName = typeof window.projectName === 'function' ? window.projectName : null;
  window.projectName = function(id){
    const known = projectNameById(id);
    if(known) return known;
    try{
      const value = originalProjectName ? originalProjectName.apply(this, arguments) : '';
      return cleanName(value, id) || '-';
    }catch(_){ return '-'; }
  };
  try { projectName = window.projectName; } catch(_) {}

  function selectableProjects(){
    const d = dset();
    const map = new Map();
    A(d.projects).forEach(p => {
      const id = S(p?.id), name = cleanName(p?.name || p?.project_name || p?.title, id);
      const fromCatalog = catalog.get(id);
      const eligible = fromCatalog?.selectable === true || p?.__technicianSelectableV10855 === true || (!p?.__technicianCatalogV10855 && activeRow(p));
      if(id && name && eligible) map.set(id, {id, name, supervisor_id:p?.supervisor_id || fromCatalog?.supervisor_id || null});
    });
    catalog.forEach(p => {
      if(p.selectable === true && p.is_active !== false && p.active !== false && p.id && p.name) map.set(S(p.id), {id:S(p.id), name:p.name, supervisor_id:p.supervisor_id || null});
    });
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name, 'ar'));
  }

  function refillProjectSelect(){
    const select = $('techNewTicketProject');
    if(!select) return;
    const old = S(select.value);
    const rows = selectableProjects();
    select.innerHTML = '<option value="">اختر المشروع</option>' + rows.map(p =>
      '<option value="' + S(p.id).replace(/"/g,'&quot;') + '">' +
      S(p.name).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) + '</option>'
    ).join('');
    if(rows.some(p => S(p.id) === old)) select.value = old;
    select.dataset.projectsBuild = BUILD;
  }

  function patchRenderedProjectCells(){
    const d = dset();
    document.querySelectorAll('#techOpenTicketsBody tr[data-ticket-id],#techMyTicketsBody tr[data-ticket-id],#techDoneTicketsBody tr[data-ticket-id]').forEach(row => {
      const ticket = A(d.tickets).find(t => S(t?.id) === S(row.dataset.ticketId));
      if(!ticket || !row.children?.[1]) return;
      const name = resolveTicketProjectName(ticket);
      row.children[1].textContent = name;
      row.children[1].classList.add('tech-project-name-v10855');
    });
  }

  function patchProjectCellsWithoutIds(){
    const d = dset();
    const bodies = [
      ['techOpenTicketsBody', t => S(t?.status).toLowerCase() !== 'closed'],
      ['techMyTicketsBody', () => true],
      ['techDoneTicketsBody', () => true]
    ];
    bodies.forEach(([id]) => {
      const rows = Array.from($(id)?.querySelectorAll('tr') || []);
      rows.forEach(row => {
        if(row.dataset.ticketId || !row.children?.[1]) return;
        const no = S(row.children?.[0]?.textContent);
        const ticket = A(d.tickets).find(t => S(t?.ticket_number || ('T-' + String(t?.id || 0).padStart(4,'0'))) === no);
        if(ticket){
          row.children[1].textContent = resolveTicketProjectName(ticket);
          row.children[1].classList.add('tech-project-name-v10855');
        }
      });
    });
  }

  async function hydrate(force=false){
    if(busy) return busy;
    if(!force && Date.now() - lastHydratedAt < HYDRATE_TTL){
      ingestLocal();
      mergeCatalogIntoData();
      refillProjectSelect();
      patchRenderedProjectCells();
      patchProjectCellsWithoutIds();
      return;
    }
    busy = (async function(){
      ingestLocal();
      const current = monthKey(0), previous = monthKey(-1), next = monthKey(1);
      const results = await Promise.all([
        safeSource('project options RPC', fetchProjectOptionsRpc),
        safeSource('ProjectsService', fetchProjectsService),
        safeSource('projects table', () => fetchTable('projects', q => q.order('id',{ascending:true}).limit(5000))),
        safeSource('monthly distribution', () => fetchTable('monthly_distribution', q => q.in('month_key',[current,previous,next]).limit(30000))),
        safeSource('project monthly settings', () => fetchTable('project_monthly_settings_v387', q => q.in('month_key',[current,previous,next]).limit(10000))),
        safeSource('rich tickets RPC', fetchRichTickets),
        safeSource('ticket rows', () => fetchTable('tickets', q => q.order('created_at',{ascending:false}).limit(3000))),
        safeSource('client report project names', () => fetchTable('client_reports', q => q.order('id',{ascending:false}).limit(5000)))
      ]);

      results[0].forEach(p => addProject(p, {source:'orders_project_options_v10826', selectable:true, authoritative:true}));
      results[1].forEach(p => addProject(p, {source:'ProjectsService', selectable:activeRow(p), authoritative:true}));
      results[2].forEach(p => addProject(p, {source:'projects', selectable:activeRow(p), authoritative:true}));
      results[3].forEach(p => {
        const recent = [current,previous,next].includes(S(p?.month_key));
        addProject(p, {source:'monthly_distribution', selectable:recent && activeRow(p), authoritative:false});
      });
      results[4].forEach(p => {
        const recent = [current,previous,next].includes(S(p?.month_key));
        addProject(p, {source:'project_monthly_settings_v387', selectable:recent && activeRow(p), authoritative:false});
      });
      mergeTickets(results[5]);
      mergeTickets(results[6]);
      results[7].forEach(p => addProject(p, {source:'client_reports', selectable:false}));

      ingestLocal();
      mergeCatalogIntoData();
      saveCache();
      refillProjectSelect();
      lastHydratedAt = Date.now();
      try { if(typeof window.renderTechnicianTickets === 'function') window.renderTechnicianTickets(); } catch(_) {}
      patchRenderedProjectCells();
      patchProjectCellsWithoutIds();
      console.info(BUILD, 'projects:', selectableProjects().length, 'catalog:', catalog.size);
    })().finally(() => { busy = null; });
    return busy;
  }
  window.refreshTechnicianProjectsV10855 = () => hydrate(true);

  const previousRender = window.renderTechnicianTickets;
  if(typeof previousRender === 'function'){
    window.renderTechnicianTickets = function(){
      const result = previousRender.apply(this, arguments);
      patchRenderedProjectCells();
      patchProjectCellsWithoutIds();
      return result;
    };
    try { renderTechnicianTickets = window.renderTechnicianTickets; } catch(_) {}
  }

  const previousLoadAll = window.loadAll;
  if(typeof previousLoadAll === 'function'){
    const wrappedLoadAll = async function(){
      const result = await previousLoadAll.apply(this, arguments);
      await hydrate(false);
      return result;
    };
    window.loadAll = wrappedLoadAll;
    try { loadAll = wrappedLoadAll; } catch(_) {}
  }

  const previousInit = window.initTechnician;
  window.initTechnician = async function(){
    let result;
    if(typeof previousInit === 'function') result = await previousInit.apply(this, arguments);
    await hydrate(true);
    refillProjectSelect();
    try { if(typeof window.renderTechnicianTickets === 'function') window.renderTechnicianTickets(); } catch(_) {}
    return result;
  };
  try { initTechnician = window.initTechnician; } catch(_) {}

  const previousSave = window.saveTechnicianTicket;
  if(typeof previousSave === 'function'){
    window.saveTechnicianTicket = async function(){
      await hydrate(false);
      return previousSave.apply(this, arguments);
    };
    try { saveTechnicianTicket = window.saveTechnicianTicket; } catch(_) {}
  }

  const style = document.createElement('style');
  style.id = 'technicianProjectsStyleV10855';
  style.textContent = '.tech-project-name-v10855{font-weight:900!important;color:#064b3b!important;white-space:normal!important;min-width:130px}';
  document.head.appendChild(style);

  readCache();
  ingestLocal();
  mergeCatalogIntoData();
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => hydrate(true), 250));
  window.addEventListener('load', () => setTimeout(() => hydrate(true), 500));
  document.addEventListener('visibilitychange', () => { if(!document.hidden) hydrate(true); });
  window.addEventListener('storage', event => {
    if(event.key === 'tasneef_client_ticket_changed_v10519' || event.key === 'tasneef_user') hydrate(true);
  });
  setInterval(() => hydrate(true), 30000);
  setTimeout(() => hydrate(true), 900);
  console.info(BUILD + ' loaded');
})();
