/* ===== Tasneef V10236: Clean daily logs renderer =====
   الهدف: منع اختفاء السجلات اليومية بسبب سكربتات قديمة أو كاش الشهر.
   المصدر الوحيد للجدول: time_logs لتاريخ dailyDate فقط.
*/
(function(){
  if(window.__tasneefDailyLogsCleanV10236) return;
  window.__tasneefDailyLogsCleanV10236 = true;

  const VERSION = 'V10236';
  let cacheDate = '';
  let rowsCache = [];
  let loading = false;
  let lastRenderToken = 0;

  const $ = (id)=>document.getElementById(id);
  const S = (v)=>String(v ?? '').trim();
  const esc = (v)=>String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = ()=> new Date().toISOString().slice(0,10);
  function tomorrow(d){ const x = new Date(d+'T00:00:00'); x.setDate(x.getDate()+1); return x.toISOString().slice(0,10); }
  function getDate(){ const el=$('dailyDate'); if(el && !el.value) el.value=today(); return el?.value || today(); }
  function norm(v){ return S(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي'); }
  function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }

  function projectNameSafe(id){ try{ return typeof projectName==='function'?projectName(id):'-'; }catch(_){ return '-'; } }
  function supervisorNameSafe(id){ try{ return typeof supervisorName==='function'?supervisorName(id):'-'; }catch(_){ return '-'; } }
  function visitText(v){ try{ return typeof visitTypeText==='function'?visitTypeText(v):(v==='deep'?'نظافة عميقة':'نظافة سطحية'); }catch(_){ return v||'-'; } }
  function timeOnlySafe(v){ try{ return typeof timeOnly==='function'?timeOnly(v):S(v).slice(11,16); }catch(_){ return '-'; } }
  function waButtons(l){ try{ return typeof logWhatsappButtons==='function'?logWhatsappButtons(l):''; }catch(_){ return ''; } }
  function minsText(m){ try{ return typeof minsToText==='function'?minsToText(m):`${m} دقيقة`; }catch(_){ return `${m} دقيقة`; } }
  function minutes(a,b){ if(!a||!b) return 0; const x=new Date(a), y=new Date(b); if(isNaN(x)||isNaN(y)) return 0; return Math.max(0, Math.round((y-x)/60000)); }
  function logDate(l){ return l.log_date || S(l.check_in || l.created_at).slice(0,10); }
  function requiredFor(l){
    const saved = Number(l.required_minutes);
    if(Number.isFinite(saved) && saved > 0) return saved;
    try{ if(typeof requiredMinutesForLog==='function') return Number(requiredMinutesForLog(l.project_id, logDate(l))) || 0; }catch(_){ }
    return 0;
  }
  function actualFor(l){
    if(l.check_in && l.check_out) return minutes(l.check_in, l.check_out);
    const saved = Number(l.duration_minutes || l.actual_minutes || l.work_minutes || l.total_minutes);
    return Number.isFinite(saved) ? Math.max(0, saved) : 0;
  }
  function statusCalc(actual, required){
    const diff = n(actual) - n(required);
    if(!required) return {diff, text:'غير محدد', cls:'amber'};
    if(diff > 0) return {diff, text:'زايد', cls:'red'};
    if(diff < 0) return {diff, text:'ناقص', cls:'amber'};
    return {diff, text:'ضمن الوقت', cls:'green'};
  }
  function diffLabel(d){ d=n(d); return d>0?`+${d} دقيقة`:(d<0?`${d} دقيقة`:'0 دقيقة'); }

  async function fetchRowsForDate(date){
    const client = window.sb || window.supabaseClient || window.supabase;
    if(!client || !client.from) throw new Error('Supabase client غير جاهز');
    const end = tomorrow(date);
    const cols = 'id,user_id,supervisor_id,project_id,check_in,check_out,log_date,duration_minutes,actual_minutes,work_minutes,total_minutes,travel_minutes,visit_type,required_minutes,time_difference_minutes,time_status,notes,created_at,updated_at';
    const all = [];
    async function add(q){
      try{
        const r = await q;
        if(!r.error && Array.isArray(r.data)) all.push(...r.data);
        else if(r.error) console.warn('[Tasneef '+VERSION+'] daily query', r.error.message);
      }catch(e){ console.warn('[Tasneef '+VERSION+'] daily query failed', e); }
    }
    await add(client.from('time_logs').select(cols).eq('log_date', date).order('id', {ascending:false}).limit(700));
    await add(client.from('time_logs').select(cols).gte('check_in', date+'T00:00:00').lt('check_in', end+'T00:00:00').order('id', {ascending:false}).limit(700));
    const map = new Map();
    for(const r of all){ if(r && r.id != null) map.set(String(r.id), r); }
    return [...map.values()].filter(r=>logDate(r)===date || S(r.check_in).startsWith(date)).sort((a,b)=>Number(b.id||0)-Number(a.id||0));
  }

  function applyFilters(rows){
    const sup = S($('dailySupervisor')?.value);
    const proj = S($('dailyProject')?.value);
    const q = norm($('dailySearch')?.value);
    return (rows||[]).filter(l=>{
      if(String(l.visit_type||'') === 'technician_attendance') return false;
      if(sup && sup !== 'all' && sup !== 'الكل' && String(l.supervisor_id||'') !== sup) return false;
      if(proj && proj !== 'all' && proj !== 'الكل' && String(l.project_id||'') !== proj) return false;
      if(q){
        const hay = norm([logDate(l), supervisorNameSafe(l.supervisor_id), projectNameSafe(l.project_id), visitText(l.visit_type), l.notes, l.id].join(' '));
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderRows(){
    const body = $('logsBody');
    if(!body) return;
    const rows = applyFilters(rowsCache);
    body.innerHTML = rows.map(l=>{
      const actual = actualFor(l);
      const required = requiredFor(l);
      const st = statusCalc(actual, required);
      return `<tr>
        <td>${esc(logDate(l))}</td>
        <td>${esc(supervisorNameSafe(l.supervisor_id))}</td>
        <td>${esc(projectNameSafe(l.project_id))}</td>
        <td>${esc(visitText(l.visit_type))}</td>
        <td>${esc(timeOnlySafe(l.check_in))}</td>
        <td>${esc(timeOnlySafe(l.check_out))}</td>
        <td>${esc(minsText(required))}</td>
        <td>${esc(minsText(actual))}</td>
        <td>${esc(diffLabel(st.diff))}</td>
        <td><span class="badge ${st.cls}">${esc(st.text)}</span></td>
        <td>${esc(l.travel_minutes||0)}</td>
        <td>${esc(l.notes||'')}</td>
        <td class="row-actions">${waButtons(l)}</td>
        <td class="row-actions"><button onclick="editTimeLog(${Number(l.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${Number(l.id)||0})">حذف</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="14">لا توجد بيانات لهذا التاريخ</td></tr>';
  }

  async function loadDailyRows(force){
    const date = getDate();
    const token = ++lastRenderToken;
    if(!force && cacheDate === date && rowsCache.length){ renderRows(); return rowsCache; }
    if(loading){ renderRows(); return rowsCache; }
    loading = true;
    const body = $('logsBody');
    if(body && !rowsCache.length) body.innerHTML = '<tr><td colspan="14">جاري تحميل سجلات هذا التاريخ فقط...</td></tr>';
    try{
      const rows = await fetchRowsForDate(date);
      if(token !== lastRenderToken) return rowsCache;
      cacheDate = date;
      rowsCache = rows;
      try{
        if(window.data){ window.data.logs = rows.slice(); }
        if(window.cache) window.cache.at = Date.now();
      }catch(_){ }
      renderRows();
      markVersion(`V10236 - سجلات اليوم فقط: ${rows.length}`);
      return rows;
    }catch(e){
      console.error('[Tasneef '+VERSION+'] loadDailyRows failed', e);
      if(body) body.innerHTML = `<tr><td colspan="14">تعذر تحميل السجلات: ${esc(e.message||e)}</td></tr>`;
      return [];
    }finally{ loading = false; }
  }

  function markVersion(text){
    try{
      const h = [...document.querySelectorAll('h2,h3')].find(x=>S(x.textContent).includes('التسجيلات اليومية'));
      if(!h) return;
      let m = $('dailyCleanV10236');
      if(!m){ h.insertAdjacentHTML('beforeend',' <small id="dailyCleanV10236" style="font-size:11px;color:#0a5b47"></small>'); m=$('dailyCleanV10236'); }
      m.textContent = text || 'V10236';
    }catch(_){ }
  }

  window.renderTimeLogs = function(){ return loadDailyRows(false); };
  window.reloadDailyLogsV10236 = function(){ return loadDailyRows(true); };

  const oldSave = window.saveTimeLog;
  window.saveTimeLog = async function(){
    const out = oldSave ? await oldSave.apply(this, arguments) : undefined;
    cacheDate = '';
    await loadDailyRows(true);
    return out;
  };

  const oldShowPage = window.showPage;
  window.showPage = function(page, btn){
    const out = oldShowPage ? oldShowPage.apply(this, arguments) : undefined;
    if(page === 'daily') setTimeout(()=>loadDailyRows(false), 80);
    return out;
  };

  function wire(){
    markVersion();
    const d = $('dailyDate');
    if(d){ d.onchange = ()=>{ cacheDate=''; loadDailyRows(true); }; }
    const s = $('dailySupervisor'); if(s) s.onchange = ()=>renderRows();
    const p = $('dailyProject'); if(p) p.onchange = ()=>renderRows();
    const q = $('dailySearch'); if(q) q.oninput = ()=>renderRows();
    const filters = d?.closest('.filters');
    if(filters && !$('dailyRefreshV10236')){
      filters.insertAdjacentHTML('afterbegin','<button type="button" id="dailyRefreshV10236" class="light">تحديث سجلات اليوم</button>');
      $('dailyRefreshV10236').onclick = ()=>{ cacheDate=''; loadDailyRows(true); };
    }
    if(!$('dailyDate')?.value && $('dailyDate')) $('dailyDate').value = today();
  }

  document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>{ wire(); if(!document.getElementById('daily')?.classList.contains('hidden')) loadDailyRows(false); }, 700));
  window.addEventListener('load', ()=>setTimeout(()=>{ wire(); if(!document.getElementById('daily')?.classList.contains('hidden')) loadDailyRows(false); }, 1200));
  setTimeout(()=>{ wire(); }, 2200);
})();
