/* Tasneef v10063 - SAFE Orders project dropdown from system projects only
   إصلاح v10062: إزالة MutationObserver لأنه كان يعيد تشغيل القائمة باستمرار ويسبب تعليق الصفحة.
   المطلوب: عند إنشاء أوردر جديد تظهر فقط مشاريع النظام، وليس مشاريع الإكسل/الأوردرات القديمة.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersSystemProjectsOnlyV10063) return;
  window.__tasneefOrdersSystemProjectsOnlyV10063 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const $ = id => document.getElementById(id);
  let cachedProjects = null;
  let loadingPromise = null;

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
    return !/false|0|inactive|disabled|closed|مغلق|متوقف|منتهي|ملغي|غير نشط/.test(v);
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
  function sbClient(){
    if(window.sb) return window.sb;
    if(window.supabase && window.supabase.createClient) return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return null;
  }
  async function loadSystemProjects(){
    if(cachedProjects && cachedProjects.length) return cachedProjects;
    const local = localSystemProjects();
    if(local.length){ cachedProjects = local; return cachedProjects; }
    if(loadingPromise) return loadingPromise;
    loadingPromise = (async()=>{
      try{
        const sb = sbClient();
        if(sb){
          const res = await sb.from('projects').select('*').limit(10000);
          if(!res.error && Array.isArray(res.data)) return uniqueSorted(res.data.filter(isActiveProject));
        }
      }catch(e){ console.warn('v10063 projects load failed', e); }
      return [];
    })();
    cachedProjects = await loadingPromise;
    loadingPromise = null;
    return cachedProjects || [];
  }
  function optionsHtml(names, placeholder){
    return `<option value="">${E(placeholder||'اختر المشروع')}</option>` + names.map(n=>`<option value="${E(n)}">${E(n)}</option>`).join('');
  }
  function optionSignature(names){ return names.join('||'); }
  function isAdminOrderNew(){
    const idx = S($('orderEditIndexV233') && $('orderEditIndexV233').value);
    return idx === '' || idx === '-1';
  }
  function isSupervisorOrderNew(){
    const no = S($('supOrderEditNoV10061') && $('supOrderEditNoV10061').value);
    return no === '';
  }
  async function setSelectOptions(sel, names, placeholder){
    const sig = optionSignature(names);
    if(sel.dataset.systemProjectsOnlySigV10063 === sig) return;
    const cur = S(sel.value);
    sel.innerHTML = optionsHtml(names, placeholder);
    if(cur && names.includes(cur)) sel.value = cur;
    else sel.value = '';
    sel.dataset.systemProjectsOnlyV10063 = '1';
    sel.dataset.systemProjectsOnlySigV10063 = sig;
  }
  async function patchAdminOrderProject(force){
    const sel = $(fieldId('المشروع'));
    if(!sel) return;
    if(!force && !isAdminOrderNew()) return;
    const names = await loadSystemProjects();
    await setSelectOptions(sel, names, 'اختر المشروع');
  }
  async function patchSupervisorOrderProject(force){
    const sel = $('supOrderProjectV10061');
    if(!sel) return;
    if(!force && !isSupervisorOrderNew()) return;
    const names = await loadSystemProjects();
    await setSelectOptions(sel, names, 'اختر المشروع');
  }
  function patchAll(force){
    patchAdminOrderProject(force).catch(()=>{});
    patchSupervisorOrderProject(force).catch(()=>{});
  }
  function wrap(name, after){
    const old = window[name];
    if(typeof old !== 'function' || old.__systemProjectsOnlyV10063) return;
    const fn = function(){
      const r = old.apply(this, arguments);
      setTimeout(()=>after(false), 80);
      setTimeout(()=>after(false), 450);
      return r;
    };
    fn.__systemProjectsOnlyV10063 = true;
    window[name] = fn;
  }
  function install(){
    // إلغاء تأثير النسخة الثقيلة إن كانت محملة قبلًا
    window.__tasneefOrdersSystemProjectsOnlyV10062 = true;

    wrap('clearOrderFormV233', ()=>patchAdminOrderProject(true));
    wrap('editOrderV233', ()=>patchAdminOrderProject(false));
    wrap('supOrdersClearV10061', ()=>patchSupervisorOrderProject(true));
    wrap('supOrdersEditV10061', ()=>patchSupervisorOrderProject(false));
    wrap('supOrdersLoadV10061', ()=>patchSupervisorOrderProject(true));

    document.addEventListener('click', e=>{
      const b = e.target && e.target.closest && e.target.closest('button');
      const t = S(b && b.textContent);
      if(/أوردر جديد|إضافة أوردر|تفريغ|جديد/.test(t)) setTimeout(()=>patchAll(true), 120);
    }, true);
    document.addEventListener('focusin', e=>{
      const el = e.target;
      if(el && el.id === fieldId('المشروع') && isAdminOrderNew()) patchAdminOrderProject(true);
      if(el && el.id === 'supOrderProjectV10061' && isSupervisorOrderNew()) patchSupervisorOrderProject(true);
    }, true);

    // تشغيل محدود فقط بدون مراقبة DOM حتى لا تتعلق الصفحة
    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      patchAll(false);
      if(tries >= 12) clearInterval(timer);
    }, 800);
    setTimeout(()=>patchAll(false), 300);
    setTimeout(()=>patchAll(false), 1500);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', ()=>patchAll(false));
  window.tasneefOrdersSystemProjectsOnlyV10063 = {loadSystemProjects, patchAll};
})();
