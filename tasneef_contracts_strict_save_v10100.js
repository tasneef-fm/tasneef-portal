/* Tasneef v10100 - Contracts & Annual Services Strict Supabase Save
   Scope: خدمات وعقود فقط. لا يلمس أي قسم آخر.
   الهدف: منع اختفاء البيانات بعد الحفظ، وإظهار فشل الحفظ الحقيقي بدل الحفظ المحلي الوهمي.
*/
(function(){
  'use strict';
  if(window.__tasneefContractsStrictSaveV10100) return;
  window.__tasneefContractsStrictSaveV10100 = true;

  const VERSION = 'v10100-contracts-strict-supabase-save';
  const TABLE = 'project_contract_smart';
  const LS_KEY = 'tasneef_contract_smart_v299';
  const CORE = [
    { key:'elevators', label:'مصاعد' },
    { key:'pools', label:'مسابح' },
    { key:'civilDefense', label:'دفاع مدني' }
  ];

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sb = () => window.sb || window.supabaseClient || window.supabase || null;
  const projects = () => A(window.data && window.data.projects);

  function msg(text,type){
    try{ if(typeof window.msg === 'function') return window.msg(text,type); }catch(_){ }
    alert(text);
  }

  function readLS(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch(_){ return {}; }
  }
  function writeLS(obj){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(obj || {})); }catch(_){ }
  }

  function normalizePayload(raw){
    raw = raw || {};
    const out = { contracts:{}, annual:[], updated_at: raw.updated_at || null };
    CORE.forEach(item => {
      const old = (raw.contracts || raw.core || {})[item.key] || {};
      out.contracts[item.key] = {
        onUs: !!(old.onUs ?? old.on_us),
        company: S(old.company || old.company_name),
        phone: S(old.phone || old.company_phone),
        start: S(old.start || old.from || old.contract_start),
        end: S(old.end || old.to || old.contract_end),
        visits: Math.max(0, N(old.visits || old.visit_count)),
        done: A(old.done).map(Number).filter(Boolean),
        notes: S(old.notes)
      };
    });
    out.annual = A(raw.annual).map(a => ({
      id: S(a.id) || ('a' + Date.now() + Math.random().toString(16).slice(2)),
      name: S(a.name),
      visits: Math.max(1, N(a.visits || a.visit_count || 1)),
      done: A(a.done).map(Number).filter(Boolean),
      notes: S(a.notes)
    })).filter(x => x.name);
    return out;
  }

  function getProjectIdFromModal(){
    return S($('contractSmartProjectId')?.value || window.__tasneefContractCurrentProjectIdV10100 || '');
  }

  function collectStrictPayload(projectId){
    const oldAll = readLS();
    const old = normalizePayload(oldAll[S(projectId)] || {});
    const payload = { contracts:{}, annual: old.annual || [], updated_at: new Date().toISOString() };
    CORE.forEach(item => {
      const card = document.querySelector(`[data-v10-contract="${item.key}"]`);
      const previous = old.contracts[item.key] || {};
      const visits = Math.max(0, N(card?.querySelector('[data-field="visits"]')?.value));
      payload.contracts[item.key] = {
        onUs: !!card?.querySelector('[data-field="onUs"]')?.checked,
        company: S(card?.querySelector('[data-field="company"]')?.value),
        phone: S(card?.querySelector('[data-field="phone"]')?.value),
        start: S(card?.querySelector('[data-field="start"]')?.value),
        end: S(card?.querySelector('[data-field="end"]')?.value),
        visits,
        done: A(previous.done).map(Number).filter(x => x > 0 && x <= visits),
        notes: S(card?.querySelector('[data-field="notes"]')?.value)
      };
    });
    return payload;
  }

  async function strictUpsertProject(projectId, payload){
    const client = sb();
    if(!client) throw new Error('Supabase غير متصل. لا يمكن حفظ الخدمات والعقود.');
    const row = { project_id: S(projectId), payload, updated_at: new Date().toISOString() };
    const res = await client.from(TABLE).upsert(row, { onConflict:'project_id' }).select('project_id, payload, updated_at').maybeSingle();
    if(res.error) throw new Error(res.error.message || 'فشل الحفظ في Supabase');
    if(!res.data) throw new Error('لم يرجع Supabase تأكيد الحفظ.');
    return res.data;
  }

  async function strictReloadRemote(){
    const client = sb();
    if(!client) return false;
    const res = await client.from(TABLE).select('project_id,payload,updated_at').limit(10000);
    if(res.error) throw new Error(res.error.message || 'فشل قراءة جدول الخدمات والعقود');
    const local = readLS();
    A(res.data).forEach(row => {
      const pid = S(row.project_id);
      if(pid) local[pid] = normalizePayload(row.payload || {});
    });
    writeLS(local);
    return true;
  }

  const originalOpen = window.openContractSmartModal;
  window.openContractSmartModal = async function(projectId, mode){
    window.__tasneefContractCurrentProjectIdV10100 = S(projectId);
    if($('contractSmartProjectId')) $('contractSmartProjectId').value = S(projectId);
    return originalOpen ? originalOpen.apply(this, arguments) : undefined;
  };

  window.saveContractSmartModal = async function(){
    const projectId = getProjectIdFromModal();
    if(!projectId){ msg('لم يتم تحديد المشروع، لا يمكن الحفظ.', 'err'); return; }
    const btn = $('contractSmartSaveBtn');
    const oldText = btn ? btn.textContent : '';
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'جاري الحفظ في Supabase...'; }
      const payload = collectStrictPayload(projectId);
      const saved = await strictUpsertProject(projectId, payload);

      const local = readLS();
      local[S(projectId)] = normalizePayload(saved.payload || payload);
      writeLS(local);

      msg('تم حفظ الخدمات والعقود في Supabase بنجاح', 'ok');
      try{ if(typeof window.renderContracts === 'function') window.renderContracts(); }catch(_){ }
      try{ if(typeof window.renderSmartAlerts === 'function') window.renderSmartAlerts(); }catch(_){ }
    }catch(error){
      console.error(VERSION, error);
      msg('فشل حفظ الخدمات والعقود: ' + (error.message || error), 'err');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = oldText || 'حفظ'; }
    }
  };

  function parseDate(value){
    const text = S(value);
    if(!text) return null;
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function daysLeft(end){
    const e = parseDate(end);
    if(!e) return null;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((e - start) / 86400000);
  }
  function contractInfo(project){
    const days = daysLeft(project && project.contract_end);
    if(days === null) return {key:'missing', text:'بيانات ناقصة', cls:'amber', days:'-'};
    if(days < 0) return {key:'expired', text:'منتهي', cls:'red', days};
    if(days <= 30) return {key:'soon', text:'قريب الانتهاء', cls:'amber', days};
    return {key:'active', text:'نشط', cls:'green', days};
  }

  window.renderContracts = function(){
    const body = $('contractsBody');
    if(!body) return;
    const q = S($('contractSearch')?.value);
    const status = S($('contractFilterStatus')?.value);
    let rows = projects();
    if(q) rows = rows.filter(p => [p.name, p.location].join(' ').includes(q));
    if(status) rows = rows.filter(p => contractInfo(p).key === status);
    rows.sort((a,b) => (daysLeft(a.contract_end) ?? 999999) - (daysLeft(b.contract_end) ?? 999999));
    body.innerHTML = rows.map(p => {
      const info = contractInfo(p);
      const pid = JSON.stringify(S(p.id));
      return `<tr><td><b>${esc(p.name)}</b></td><td>${N(p.buildings_count)}</td><td>${N(p.units_count)}</td><td>${esc(S(p.contract_start).slice(0,10) || '-')}</td><td>${esc(S(p.contract_end).slice(0,10) || '-')}</td><td>${esc(info.days)}</td><td><span class="badge ${esc(info.cls)}">${esc(info.text)}</span></td><td class="row-actions"><button class="light" onclick='openContractSmartModal(${pid},"view")'>عرض</button><button onclick='openContractSmartModal(${pid},"edit")'>تعديل</button></td></tr>`;
    }).join('') || '<tr><td colspan="8">لا توجد بيانات</td></tr>';
    if($('contractsActiveCount')) $('contractsActiveCount').textContent = projects().filter(p => contractInfo(p).key === 'active').length;
    if($('contractsSoonCount')) $('contractsSoonCount').textContent = projects().filter(p => contractInfo(p).key === 'soon').length;
    if($('contractsExpiredCount')) $('contractsExpiredCount').textContent = projects().filter(p => contractInfo(p).key === 'expired').length;
  };

  async function boot(){
    try{
      await strictReloadRemote();
      if(typeof window.renderContracts === 'function') window.renderContracts();
    }catch(error){
      console.warn(VERSION, error);
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 900), {once:true});
  else setTimeout(boot, 900);
  window.addEventListener('load', () => setTimeout(boot, 1400), {once:true});
  console.log('Loaded '+VERSION);
})();
