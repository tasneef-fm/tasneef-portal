/* Tasneef v10062 - Orders project dropdown from system projects only
   المطلوب: عند إنشاء أوردر جديد تظهر فقط المشاريع الموجودة في قسم المشاريع بالنظام، وليس مشاريع الإكسل/الأوردرات القديمة.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersSystemProjectsOnlyV10062) return;
  window.__tasneefOrdersSystemProjectsOnlyV10062 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const $ = id => document.getElementById(id);
  let cachedProjects = [];
  let loading = false;

  function fieldId(header){
    try{ return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_'); }
    catch(_){ return 'orderFieldV233_'+String(header).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_'); }
  }

  function normProjectName(p){
    if(!p) return '';
    if(typeof p === 'string') return S(p);
    return S(p.name || p.project_name || p.projectName || p.title || p.project || p['المشروع'] || p['اسم المشروع']);
  }
  function isActiveProject(p){
    if(!p || typeof p === 'string') return true;
    const v = S(p.is_active ?? p.active ?? p.status ?? p.project_status ?? p['الحالة']).toLowerCase();
    if(!v) return true;
    return !/false|0|inactive|disabled|مغلق|متوقف|منتهي|ملغي|غير نشط/.test(v);
  }
  function uniqueSorted(list){
    const seen = new Set(), out=[];
    A(list).forEach(x=>{
      const n = normProjectName(x);
      if(!n || seen.has(n)) return;
      seen.add(n); out.push(n);
    });
    return out.sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function localSystemProjects(){
    const d = window.data || {};
    const sources = [d.projects, d.allProjects, d.systemProjects, window.projects, window.systemProjects].filter(Array.isArray);
    return uniqueSorted(sources.flat().filter(isActiveProject));
  }
  function client(){
    if(window.sb) return window.sb;
    if(window.supabase && window.supabase.createClient) return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return null;
  }
  async function loadSystemProjects(){
    const local = localSystemProjects();
    if(local.length){ cachedProjects = local; return cachedProjects; }
    if(loading) return cachedProjects;
    loading = true;
    try{
      const sb = client();
      if(sb){
        const res = await sb.from('projects').select('*').limit(10000);
        if(!res.error && Array.isArray(res.data)) cachedProjects = uniqueSorted(res.data.filter(isActiveProject));
      }
    }catch(e){ console.warn('v10062 projects load failed', e); }
    finally{ loading = false; }
    return cachedProjects;
  }
  function optionsHtml(names, placeholder){
    return `<option value="">${E(placeholder||'اختر المشروع')}</option>` + names.map(n=>`<option value="${E(n)}">${E(n)}</option>`).join('');
  }

  function isAdminOrderNew(){
    const idx = S($('orderEditIndexV233') && $('orderEditIndexV233').value);
    return idx === '' || idx === '-1';
  }
  function isSupervisorOrderNew(){
    const no = S($('supOrderEditNoV10061') && $('supOrderEditNoV10061').value);
    return no === '';
  }

  async function patchAdminOrderProject(force){
    const sel = $(fieldId('المشروع'));
    if(!sel) return;
    if(!force && !isAdminOrderNew()) return;
    const names = await loadSystemProjects();
    const cur = S(sel.value);
    sel.innerHTML = optionsHtml(names, 'اختر المشروع');
    if(cur && names.includes(cur)) sel.value = cur;
    else sel.value = '';
    sel.dataset.systemProjectsOnlyV10062 = '1';
  }
  async function patchSupervisorOrderProject(force){
    const sel = $('supOrderProjectV10061');
    if(!sel) return;
    if(!force && !isSupervisorOrderNew()) return;
    const names = await loadSystemProjects();
    const cur = S(sel.value);
    sel.innerHTML = optionsHtml(names, 'اختر المشروع');
    if(cur && names.includes(cur)) sel.value = cur;
    else sel.value = '';
    sel.dataset.systemProjectsOnlyV10062 = '1';
  }
  async function patchAll(force){
    await patchAdminOrderProject(force);
    await patchSupervisorOrderProject(force);
  }

  function wrap(name, after){
    const old = window[name];
    if(typeof old !== 'function' || old.__systemProjectsOnlyV10062) return;
    const fn = function(){
      const r = old.apply(this, arguments);
      setTimeout(()=>after(false), 60);
      setTimeout(()=>after(false), 400);
      return r;
    };
    fn.__systemProjectsOnlyV10062 = true;
    window[name] = fn;
  }

  function install(){
    wrap('clearOrderFormV233', ()=>patchAdminOrderProject(true));
    wrap('editOrderV233', ()=>patchAdminOrderProject(false));
    wrap('supOrdersClearV10061', ()=>patchSupervisorOrderProject(true));
    wrap('supOrdersEditV10061', ()=>patchSupervisorOrderProject(false));
    wrap('supOrdersLoadV10061', ()=>patchSupervisorOrderProject(true));

    document.addEventListener('click', e=>{
      const b = e.target && e.target.closest && e.target.closest('button');
      const t = S(b && b.textContent);
      if(/أوردر جديد|إضافة أوردر|تفريغ|جديد/.test(t)) setTimeout(()=>patchAll(true), 80);
    }, true);
    document.addEventListener('focusin', e=>{
      const el = e.target;
      if(el && el.id === fieldId('المشروع') && isAdminOrderNew()) patchAdminOrderProject(true);
      if(el && el.id === 'supOrderProjectV10061' && isSupervisorOrderNew()) patchSupervisorOrderProject(true);
    }, true);

    const mo = new MutationObserver(()=>patchAll(false));
    mo.observe(document.body, {childList:true, subtree:true});

    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      patchAll(false);
      if(tries > 30) clearInterval(timer);
    }, 500);
    patchAll(false);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', ()=>patchAll(false));
  window.tasneefOrdersSystemProjectsOnlyV10062 = {loadSystemProjects, patchAll};
})();
