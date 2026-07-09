/* V405 - زر توزيع واحد + ربط التوزيع بالسجلات اليومية */
(function(){
  'use strict';
  if(window.__tasneefDistributionDailyBridgeV405) return;
  window.__tasneefDistributionDailyBridgeV405 = true;
  const VERSION='405';
  const S=v=>String(v??'').trim();
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const sb=()=>window.sb||null;
  const todayMonth=()=>new Date().toISOString().slice(0,7);
  const monthFromDate=d=>S(d).slice(0,7)||todayMonth();
  const currentDailyMonth=()=>monthFromDate(($('dailyDate')&&$('dailyDate').value)||($('logDate')&&$('logDate').value)||new Date().toISOString().slice(0,10));
  const cache={dist:{},emps:null,projects:null};

  function css(){
    if($('td405Css')) return;
    const st=document.createElement('style'); st.id='td405Css';
    st.textContent=`
      .td405-nav{background:#1d2b46!important;border-color:#354560!important;position:relative}.td405-nav:after{content:'جديد';font-size:10px;background:#0A4033;color:white;border-radius:999px;padding:2px 6px;margin-right:6px}
      .td405-daily-workers{white-space:normal!important;min-width:180px}.td405-chip{display:inline-block;background:#eef8f5;color:#0A4033;border:1px solid #cfe2dc;border-radius:999px;padding:4px 7px;margin:2px;font-weight:800;font-size:12px}.td405-chip.warn{background:#fff8e6;color:#8a5b00;border-color:#efd38b}.td405-log-hint{margin-top:8px;background:#eef8f5;border:1px solid #cfe2dc;border-radius:12px;padding:8px;color:#0A4033;line-height:1.8}.td405-log-hint b{color:#052d24}.td405-hidden-duplicate{display:none!important}
    `;
    document.head.appendChild(st);
  }

  function ensureOneDistributionButton(){
    css();
    const side=document.querySelector('.side'); if(!side) return;
    const navs=[...side.querySelectorAll('button.nav')];
    const distBtns=navs.filter(b=>/التوزيع/.test(S(b.textContent)) || /distribution/.test(S(b.getAttribute('onclick'))));
    distBtns.forEach((b,i)=>{ if(i>0) b.remove(); });
    let btn=distBtns[0] && document.body.contains(distBtns[0]) ? distBtns[0] : null;
    if(!btn){
      btn=document.createElement('button'); btn.type='button'; btn.className='nav td405-nav'; btn.textContent='التوزيع';
      const projectsBtn=navs.find(b=>/المشاريع/.test(S(b.textContent)) || /projects/.test(S(b.getAttribute('onclick'))));
      if(projectsBtn && projectsBtn.parentNode) projectsBtn.insertAdjacentElement('afterend',btn); else side.appendChild(btn);
    }
    btn.textContent='التوزيع'; btn.classList.add('td405-nav'); btn.dataset.page='distribution';
    btn.onclick=function(){
      if(typeof window.showPage==='function') window.showPage('distribution',btn);
      const page=$('distribution'); if(page) page.classList.remove('hidden');
      setTimeout(()=>{ try{window.tasneefDistributionV404&&window.tasneefDistributionV404.init&&window.tasneefDistributionV404.init();}catch(e){console.warn(e);} },120);
      return false;
    };
  }

  async function safe(p){try{const r=await p; if(r&&r.error){console.warn('V405 supabase',r.error.message); return [];} return r&&Array.isArray(r.data)?r.data:[];}catch(e){console.warn('V405 catch',e); return [];}}
  async function employees(){
    if(cache.emps) return cache.emps;
    const client=sb(); let rows=[];
    if(client){
      rows=await safe(client.from('employees_master_v386').select('*').limit(10000));
      if(!rows.length) rows=await safe(client.from('employees_master').select('*').limit(10000));
      if(!rows.length) rows=await safe(client.from('workers').select('*').limit(10000));
    }
    cache.emps=rows||[]; return cache.emps;
  }
  async function projects(){
    if(cache.projects) return cache.projects;
    const client=sb(); let rows=[];
    if(client) rows=await safe(client.from('projects').select('id,name,project_name,title').limit(5000));
    cache.projects=rows||[]; return cache.projects;
  }
  function empCode(e){return S(e.employee_code||e.code||e.emp_code||e.worker_code||e.id_code||e.employee_id||e.id)}
  function empName(e){return S(e.app_name||e.display_name||e.name_in_app||e.worker_name||e.name||e.full_name||e.iqama_name||'-')}
  function empDisplay(e){const c=empCode(e), n=empName(e); return c && !S(n).startsWith(c) ? `${c} - ${n}` : (n||c||'-');}
  function projectName(p){return S(p.name||p.project_name||p.title||'-')}
  function normalizeDist(r, empMap){
    const code=S(r.worker_employee_code||r.employee_code||r.worker_code||r.worker_id||'');
    const emp=code ? empMap.get(code) : null;
    const wname=emp ? empDisplay(emp) : (code ? `${code} - ${S(r.worker_name||r.worker_employee_name||code)}` : S(r.worker_name||r.worker_employee_name||'-'));
    return {
      id:r.id,
      month_key:S(r.month_key||r.month||''),
      supervisor_code:S(r.supervisor_employee_code||r.supervisor_code||''),
      supervisor_name:S(r.supervisor_name||r.supervisor||'-'),
      project_id:S(r.project_id||r.projectId||''),
      project_name:S(r.project_name||r.project||''),
      worker_employee_code:code,
      worker_name:wname,
      status:S(r.status||'active')
    };
  }
  async function distribution(month){
    month=month||currentDailyMonth();
    if(cache.dist[month]) return cache.dist[month];
    const client=sb(); const emps=await employees(); const empMap=new Map(emps.map(e=>[empCode(e),e]).filter(x=>x[0]));
    let rows=[];
    if(client){
      rows=await safe(client.from('monthly_distribution').select('*').eq('month_key',month).limit(20000));
      if(!rows.length) rows=await safe(client.from('monthly_distribution_view').select('*').eq('month_key',month).limit(20000));
    }
    rows=(rows||[]).map(r=>normalizeDist(r,empMap)).filter(r=>!r.status || r.status==='active' || r.status==='نشط');
    cache.dist[month]=rows; return rows;
  }
  function buildProjectIndex(dist){
    const byId=new Map(), byName=new Map();
    dist.forEach(r=>{
      const keys=[]; if(r.project_id) keys.push(['id',r.project_id]); if(r.project_name) keys.push(['name',norm(r.project_name)]);
      keys.forEach(([type,k])=>{const m=type==='id'?byId:byName; if(!m.has(k)) m.set(k,[]); m.get(k).push(r);});
    });
    return {byId,byName};
  }
  function workersHtml(list){
    const unique=[...new Map((list||[]).map(r=>[S(r.worker_employee_code||r.worker_name),r])).values()];
    if(!unique.length) return '<span class="td405-chip warn">لا يوجد توزيع لهذا المشروع</span>';
    return unique.map(r=>`<span class="td405-chip">${esc(r.worker_name)}</span>`).join('');
  }
  function supervisorText(list){const r=(list||[])[0]; return r ? S(r.supervisor_name||'-') : '-';}

  async function decorateDailyRows(){
    const body=$('logsBody'); if(!body) return;
    const table=body.closest('table'); if(!table) return;
    const headRow=table.querySelector('thead tr'); if(headRow && !headRow.querySelector('[data-td405-workers-th]')){
      const th=document.createElement('th'); th.textContent='عمال التوزيع'; th.dataset.td405WorkersTh='1';
      const ths=headRow.children; if(ths[3]) headRow.insertBefore(th,ths[3]); else headRow.appendChild(th);
    }
    const month=currentDailyMonth(); const dist=await distribution(month); const idx=buildProjectIndex(dist);
    [...body.querySelectorAll('tr')].forEach(tr=>{
      if(tr.querySelector('[data-td405-workers-td]')) return;
      const cells=tr.children; if(!cells.length || /لا توجد/.test(S(tr.textContent))) return;
      const projectCell=cells[2]; if(!projectCell) return;
      const pname=S(projectCell.textContent); const list=idx.byName.get(norm(pname))||[];
      const td=document.createElement('td'); td.dataset.td405WorkersTd='1'; td.className='td405-daily-workers'; td.innerHTML=workersHtml(list);
      if(cells[3]) tr.insertBefore(td,cells[3]); else tr.appendChild(td);
      const supCell=cells[1]; if(supCell && list.length && (!S(supCell.textContent) || S(supCell.textContent)==='-')) supCell.textContent=supervisorText(list);
    });
  }
  function patchRenderTimeLogs(){
    if(window.renderTimeLogs && !window.renderTimeLogs.__td405){
      const old=window.renderTimeLogs;
      const wrapped=function(){ const res=old.apply(this,arguments); setTimeout(decorateDailyRows,80); setTimeout(decorateDailyRows,450); return res; };
      wrapped.__td405=true; window.renderTimeLogs=wrapped;
      try{renderTimeLogs=window.renderTimeLogs;}catch(_){ }
    }
  }
  async function logHint(){
    const projectSel=$('logProject'); if(!projectSel) return;
    let hint=$('td405LogWorkersHint');
    if(!hint){hint=document.createElement('div'); hint.id='td405LogWorkersHint'; hint.className='td405-log-hint'; projectSel.insertAdjacentElement('afterend',hint);}
    const month=monthFromDate(($('logDate')&&$('logDate').value)||new Date().toISOString().slice(0,10));
    const dist=await distribution(month); const val=S(projectSel.value); const opt=projectSel.options[projectSel.selectedIndex]; const pname=S(opt&&opt.textContent);
    const idx=buildProjectIndex(dist); const list=(val&&idx.byId.get(val)) || (pname&&idx.byName.get(norm(pname))) || [];
    hint.innerHTML=list.length ? `<b>توزيع المشروع:</b> المشرف: ${esc(supervisorText(list))}<br>${workersHtml(list)}` : '<b>توزيع المشروع:</b> لا يوجد توزيع محفوظ لهذا المشروع في هذا الشهر.';
  }
  function patchLogForm(){
    ['logProject','logDate'].forEach(id=>{const el=$(id); if(el && el.dataset.td405!=='1'){el.dataset.td405='1'; el.addEventListener('change',()=>setTimeout(logHint,80));}});
    setTimeout(logHint,300);
  }
  function patchShowPage(){
    if(window.showPage && !window.showPage.__td405){
      const old=window.showPage;
      const wrapped=function(id,btn){ const r=old.apply(this,arguments); if(id==='distribution') setTimeout(()=>{ensureOneDistributionButton(); try{window.tasneefDistributionV404&&window.tasneefDistributionV404.init&&window.tasneefDistributionV404.init();}catch(_){ }},80); if(id==='daily') setTimeout(()=>{patchLogForm(); decorateDailyRows();},120); return r; };
      wrapped.__td405=true; window.showPage=wrapped;
    }
  }
  function install(){ensureOneDistributionButton(); patchShowPage(); patchRenderTimeLogs(); patchLogForm(); decorateDailyRows();}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));
  [1500,2500,4000,7000].forEach(t=>setTimeout(install,t));
  setInterval(()=>{ensureOneDistributionButton(); patchShowPage(); patchRenderTimeLogs();},2500);
  window.tasneefDistributionDailyBridgeV405={install,decorateDailyRows,distribution,reload:()=>{cache.dist={};cache.emps=null;cache.projects=null;return install();}};
})();
