/* V391 Monthly Formula System - one month only, no duplicated projects, workbook formula percentages */
(function(){
  'use strict';
  if(window.__tasneefMonthlyFormulaV391) return;
  window.__tasneefMonthlyFormulaV391 = true;
  const VERSION='391';
  const SNAP_TABLE='monthly_project_snapshots_v384';
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const id=v=>S(v);
  const $=x=>document.getElementById(x);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const sbc=()=>window.sb || window.supabaseClient || window._supabase || null;
  const todayMonth=()=>new Date().toISOString().slice(0,7);
  const monthVal=()=>$('ms391Month')?.value||$('ms384Month')?.value||$('rbMonth')?.value||$('mt52Month')?.value||todayMonth();
  const monthRange=m=>{const from=m+'-01';const d=new Date(from+'T00:00:00');d.setMonth(d.getMonth()+1);const to=d.toISOString().slice(0,10);return {from,to,fromIso:from+'T00:00:00',toIso:to+'T00:00:00'}};
  const arMins=m=>{m=Math.round(N(m));const h=Math.floor(m/60),mm=m%60;if(!h)return mm+' دقيقة';if(!mm)return h+' ساعة';return h+' ساعة و '+mm+' دقيقة'};
  const pct=p=>N(p).toFixed(0)+'%';
  const typeIsFull=t=>{const x=norm(t);return x.includes('دوام')||x.includes('كامل')||x.includes('دائم')||x.includes('full')||x.includes('24')};
  const pName=p=>S(p?.projectName||p?.project_name||p?.name||p?.title||p?.project||'-');
  const uName=u=>S(u?.supervisorName||u?.supervisor_name||u?.full_name||u?.name||u?.username||'-');
  const pType=p=>{const raw=S(p?.projectType||p?.project_type||p?.operation_type||p?.work_type||p?.type||'');const n=norm(raw);return (n.includes('دوام')||n.includes('كامل')||n.includes('دائم')||n.includes('full')||n.includes('24'))?'دوام كامل':'زيارة يومية'};
  const SEED={"TS-01":"فهد","TS-02":"جاشيم","TS-03":"سوجان","TS-04":"عليم","TS-05":"مهيد","TS-06":"حسن","TS-07":"ديلوار","TS-08":"روبيول","TS-09":"علي","TS-10":"كوثر","TS-11":"صالح","TS-12":"بتشا","TS-13":"علم","TS-15":"ابراهيم","TS-16":"فلومية","TS-17":"مازن الخطيب","TS-18":"اشرف","TS-19":"الونجير","TS-20":"أنور","TS-21":"تيفور","TS-22":"جابيت","TS-23":"رشيد","TS-24":"شميم","TS-25":"ناظمون","TS-26":"هلال","TS-27":"محمد إبراهيم","TS-28":"ديكسان","TS-29":"ميزان","TS-30":"محمد  ياسر","TS-31":"رؤوف","TS-32":"اوسيس","TS-33":"اوميت","TS-34":"راهي","TS-35":"عاريف","TS-36":"رقيب","TS-37":"عجائب","TS-38":"رحمن","TS-39":"محمد عبده","TS-40":"راسيل","TS-41":"اكرامول","TS-42":"ديلوا","TS-43":"عريف","TS-44":"مهيب","TS-45":"ليتون","TS-46":"همينتو","TS-47":"محمود","TS-48":"راجو","TS-49":"اجارول","TS-50":"ثابت","TS-51":"شانتو","TS-52":"عبد السلام","TS-53":"مساد","TS-54":"مختار","TS-55":"ميزان 2","TS-56":"اكتار","TS-57":"جهيد","TS-58":"جوناب علي","TS-59":"ركيب","TS-60":"محمد حمدي","TS-63":"ابازر","TS-64":"حسين","TS-65":"يعقوب","TS-66":"رحيم","TS-67":"شريف","TS-68":"جويل","TS-69":"عبد الرحمن","TS-70":"علي","TS-71":"وهيب"};
  let codeMap=new Map(Object.entries(SEED));
  const splitCodes=v=>[...new Set(S(v).match(/TS-\d+/gi)?.map(x=>x.toUpperCase())||[])];
  const employeeLabel=(code,fallback)=>{const c=S(code).toUpperCase();const n=S(codeMap.get(c)||fallback||'');return c?(n?`${c} - ${n}`:c):(n||'-')};
  const codedText=v=>{const codes=splitCodes(v);return codes.length?codes.map(c=>employeeLabel(c)).join(' + '):S(v||'-')};
  function workerList(list){const out=[];(Array.isArray(list)?list:S(list).split(/[،,\n]+/)).forEach(x=>{const codes=splitCodes(x);if(codes.length)codes.forEach(c=>out.push(employeeLabel(c)));else if(S(x))out.push(S(x));});return [...new Set(out)];}
  async function refreshCodes(){try{const sb=sbc();if(!sb)return;const r=await sb.from('employees_master_v386').select('employee_code,app_name,iqama_name').limit(8000);if(!r.error){(r.data||[]).forEach(e=>{const c=S(e.employee_code).toUpperCase();if(c)codeMap.set(c,S(e.app_name||e.iqama_name||c));});}}catch(e){console.warn('v391 employee codes',e)}}
  async function safe(label,q){try{const r=await q;if(r.error){console.warn('v391 select '+label,r.error.message);return []}return r.data||[]}catch(e){console.warn('v391 select catch '+label,e);return []}}
  function rawRowsFromSnapshotData(data){if(!data)return[];if(Array.isArray(data))return data;if(Array.isArray(data.rows))return data.rows;if(data.rows&&Array.isArray(data.rows.rows))return data.rows.rows;return[]}
  async function loadSnapshotRows(m){const sb=sbc();if(!sb){try{return rawRowsFromSnapshotData(JSON.parse(localStorage.getItem('tasneef_monthly_snapshot_v384_'+m)||'{}'))}catch(_){return[]}}
    const r=await safe('snapshot', sb.from(SNAP_TABLE).select('*').eq('month_key',m).order('updated_at',{ascending:false}).limit(20));
    let rows=[];r.forEach(s=>{rows=rows.concat(rawRowsFromSnapshotData(s));});
    if(rows.length)return rows;
    try{return rawRowsFromSnapshotData(JSON.parse(localStorage.getItem('tasneef_monthly_snapshot_v384_'+m)||'{}'))}catch(_){return[]}
  }
  function dedupeRows(rows,m){
    const map=new Map();
    (rows||[]).forEach((r,idx)=>{
      if(S(r.month_key||r.monthKey||'') && S(r.month_key||r.monthKey)!==m) return;
      const pn=pName(r); if(!pn||pn==='-')return;
      const key=(id(r.projectId||r.project_id)||norm(pn));
      const workers=workerList(r.workers||r.workerCodes||r.worker_codes||r.employee_codes||r.worker_names||[]);
      const obj={
        month:m,
        projectId:id(r.projectId||r.project_id||''),
        projectName:pn,
        projectType:pType(r),
        supervisorId:id(r.supervisorId||r.supervisor_id||''),
        supervisorName:codedText(r.supervisorName||r.supervisor_name||r.supervisorCodes||r.supervisor_codes||'-'),
        workers,
        logsCount:N(r.logsCount||r.logs_count||r.count_logs||0),
        totalMinutes:N(r.totalMinutes||r.total_minutes||r.minutes||r.actual_minutes||0),
        requiredMinutes:N(r.requiredMinutes||r.required_minutes||r.requiredDailyMinutes||r.required_daily_minutes||0),
        transferMinutes:N(r.transferMinutes||r.transfer_minutes||r.travel_minutes||0),
        updated_at:S(r.updated_at||r.lastUpdated||r.last_updated||''),
        source:S(r.source||'الأوقات الشهرية')
      };
      const old=map.get(key);
      if(!old){map.set(key,obj);return;}
      // منع تكرار المشروع: نأخذ أعلى وقت مسجل حتى لا تتضاعف الدقائق عند وجود صف مكرر، ونوحّد العمال.
      old.workers=[...new Set([...(old.workers||[]),...workers])];
      old.logsCount=Math.max(N(old.logsCount),N(obj.logsCount));
      old.totalMinutes=Math.max(N(old.totalMinutes),N(obj.totalMinutes));
      old.requiredMinutes=Math.max(N(old.requiredMinutes),N(obj.requiredMinutes));
      old.transferMinutes=Math.max(N(old.transferMinutes),N(obj.transferMinutes));
      if((!old.supervisorName||old.supervisorName==='-')&&obj.supervisorName)old.supervisorName=obj.supervisorName;
      if(typeIsFull(obj.projectType))old.projectType=obj.projectType;
      map.set(key,old);
    });
    return calculateFormula([...map.values()]);
  }
  function calculateFormula(rows){
    // معادلة ورقة الأوقات الشهرية:
    // الزيارة اليومية: نسبة المشروع = دقائق المشروع / إجمالي دقائق مشرفه.
    // الدوام الكامل: كل مشروع يحسب لحاله = الدقائق الفعلية / الدقائق المطلوبة، وإذا لا يوجد مطلوب تظهر 100% عند وجود وقت.
    const daily=rows.filter(r=>!typeIsFull(r.projectType));
    const supTotals={};
    daily.forEach(r=>{const k=norm(r.supervisorName||'غير محدد');supTotals[k]=(supTotals[k]||0)+N(r.totalMinutes)});
    rows.forEach(r=>{
      if(typeIsFull(r.projectType)){
        r.percentage=N(r.requiredMinutes)>0?(N(r.totalMinutes)/N(r.requiredMinutes))*100:(N(r.totalMinutes)>0?100:0);
        r.formulaText='الدقائق الفعلية ÷ الدقائق المطلوبة للمشروع';
      }else{
        const k=norm(r.supervisorName||'غير محدد');
        r.percentage=supTotals[k]>0?(N(r.totalMinutes)/supTotals[k])*100:0;
        r.formulaText='دقائق المشروع ÷ إجمالي دقائق المشرف';
      }
    });
    return rows.sort((a,b)=>{
      const fa=typeIsFull(a.projectType)?1:0, fb=typeIsFull(b.projectType)?1:0;
      return fa-fb || S(a.supervisorName).localeCompare(S(b.supervisorName),'ar') || S(a.projectName).localeCompare(S(b.projectName),'ar');
    });
  }
  async function buildFromLive(m){
    const sb=sbc(); if(!sb)return [];
    const r=monthRange(m);
    const [projects,users,links,logs]=await Promise.all([
      safe('projects', sb.from('projects').select('*').limit(5000)),
      safe('app_users', sb.from('app_users').select('*').limit(4000)),
      safe('links', sb.from('worker_project_links_v386').select('*').eq('month_key',m).limit(20000)),
      safe('logs', sb.from('time_logs').select('*').gte('check_in',r.fromIso).lt('check_in',r.toIso).limit(20000))
    ]);
    const byProject=new Map();
    projects.forEach(p=>{const pid=id(p.id);if(!pid)return;const sup=users.find(u=>id(u.id)===id(p.supervisor_id));byProject.set(pid,{projectId:pid,projectName:pName(p),projectType:pType(p),supervisorId:id(p.supervisor_id),supervisorName:uName(sup)||S(p.supervisor_name||'-'),workers:[],logsCount:0,totalMinutes:0,requiredMinutes:N(p.required_daily_minutes||0),transferMinutes:0,source:'بناء مباشر من سجلات الشهر'});});
    links.forEach(a=>{const row=byProject.get(id(a.project_id));if(!row)return;const c=S(a.employee_code||a.code).toUpperCase();const nm=employeeLabel(c,S(a.employee_name||a.app_name||a.name));if(nm&&!row.workers.includes(nm))row.workers.push(nm);if(a.link_type&&norm(a.link_type).includes('مشرف'))row.supervisorName=codedText(c||row.supervisorName);});
    logs.forEach(l=>{const pid=id(l.project_id||l.projectId);const row=byProject.get(pid);if(!row)return;const mins=N(l.duration_minutes||l.actual_minutes||l.minutes||l.total_minutes||l.work_minutes||0);row.totalMinutes+=mins;row.logsCount+=1;row.transferMinutes+=N(l.travel_minutes||l.transfer_minutes||0);});
    return calculateFormula([...byProject.values()].filter(r=>N(r.totalMinutes)>0||r.workers.length));
  }
  function ensureUI(){
    const sec=$('monthly'); if(!sec)return false;
    const old=$('ms384Root'); if(old) old.remove();
    if($('ms391Root')) return true;
    const style=document.createElement('style');style.id='ms391Css';style.textContent=`
      #monthly .monthly-excel-v10152,#monthly .monthly-workers-v10152,#monthly .monthly-detail-v10152,#monthly .monthly-manual-v10152,#monthly .rb-card{display:none!important}
      .ms391-root{display:grid;gap:14px}.ms391-hero{background:linear-gradient(135deg,#063d31,#0a6b50);color:#fff;border-radius:24px;padding:20px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.ms391-hero h2{margin:0 0 6px;color:#fff}.ms391-hero p{margin:0;color:#e4fff5;line-height:1.8}.ms391-pill{background:#fff;color:#063d31;border-radius:999px;padding:8px 12px;font-weight:900}.ms391-bar{background:#fff;border:1px solid #dcebe6;border-radius:18px;padding:14px;display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:end}.ms391-bar label{font-weight:900;color:#073f34}.ms391-bar input{padding:10px;border:1px solid #cfe0da;border-radius:12px}.ms391-bar button{border:0;border-radius:12px;padding:12px 15px;background:#074f40;color:#fff;font-weight:900}.ms391-bar button.light{background:#eef6f3;color:#074f40;border:1px solid #dcebe6}.ms391-msg{border-radius:14px;padding:11px 13px;background:#eef7f3;border:1px solid #d5e9e1;color:#074f40;font-weight:800;line-height:1.7}.ms391-msg.warn{background:#fff8e8;color:#7b5a00;border-color:#ead28d}.ms391-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.ms391-kpi{background:#fff;border:1px solid #dcebe6;border-radius:16px;padding:14px;text-align:center}.ms391-kpi small{display:block;color:#5d716b}.ms391-kpi b{font-size:23px;color:#074f40}.ms391-card{background:#fff;border:1px solid #dcebe6;border-radius:18px;padding:14px}.ms391-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.ms391-title h3{margin:0;color:#063d33}.ms391-super{border:2px solid #0a4539;border-radius:18px;margin:12px 0;overflow:hidden;background:#fff}.ms391-super h4{margin:0;background:#0a4539;color:#fff;padding:12px 14px;font-size:18px}.ms391-table{width:100%;border-collapse:collapse}.ms391-table th,.ms391-table td{border:1px solid #dbe8e2;padding:8px;text-align:center;vertical-align:top}.ms391-table th{background:#eef6f3;color:#0a4539;font-weight:900}.ms391-table .project{text-align:right;font-weight:900;color:#0a4539}.ms391-workers{text-align:right;line-height:1.8}.ms391-pct{height:10px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin:0 0 5px}.ms391-pct span{display:block;height:100%;background:#0a4539}.ms391-full-grid{display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));gap:12px}.ms391-full-box{border:2px solid #123b70;border-radius:18px;background:#fff;overflow:hidden;break-inside:avoid}.ms391-full-box h4{margin:0;background:#123b70;color:#fff;padding:12px}.ms391-full-box .inner{padding:12px;display:grid;gap:9px}.ms391-line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #d9e5df;padding-bottom:7px}.ms391-line b{color:#0a4539}.ms391-empty{padding:18px;text-align:center;color:#60706a;border:1px dashed #cfe0da;border-radius:14px;background:#fbfdfc}@media(max-width:1100px){.ms391-summary,.ms391-full-grid{grid-template-columns:1fr 1fr}.ms391-bar{grid-template-columns:1fr 1fr}}@media(max-width:760px){.ms391-summary,.ms391-full-grid,.ms391-bar{grid-template-columns:1fr}}@media print{body *{visibility:hidden!important}#monthly,#monthly *{visibility:visible!important}#monthly{position:absolute!important;inset:0!important;background:#fff!important}.side,.hero,.ms391-bar,.nav{display:none!important}.card{box-shadow:none!important}.ms391-super,.ms391-full-box{break-inside:avoid!important}}
    `;document.head.appendChild(style);
    const root=document.createElement('div');root.id='ms391Root';root.className='ms391-root';root.innerHTML=`<div class="ms391-hero"><div><h2>الأوقات الشهرية - معادلة الورقة</h2><p>كل شهر يقرأ بيانات شهره فقط، يمنع تكرار المشروع، ويعرض العامل مع الكود كما هو موجود في قسم العمال.</p></div><div class="ms391-pill">V${VERSION}</div></div><div class="ms391-bar"><div><label>الشهر</label><input type="month" id="ms391Month"></div><button id="ms391Render">عرض الشهر</button><button class="light" id="ms391Freeze">تجميد / تحديث الشهر</button><button class="light" id="ms391Print">طباعة احترافية</button></div><div id="ms391Msg" class="ms391-msg">اختر الشهر ثم اضغط عرض الشهر.</div><div id="ms391Summary" class="ms391-summary"></div><div class="ms391-card"><div class="ms391-title"><h3>مشاريع الزيارة اليومية حسب المشرف</h3><small>النسبة = دقائق المشروع ÷ إجمالي دقائق المشرف</small></div><div id="ms391Daily"></div></div><div class="ms391-card"><div class="ms391-title"><h3>مشاريع الدوام الكامل / الدائمة</h3><small>كل مشروع مربع مستقل وحسابه لحاله</small></div><div id="ms391Full" class="ms391-full-grid"></div></div><div class="ms391-card"><div class="ms391-title"><h3>تفاصيل الشهر بدون تكرار</h3><small>مصدر الوقت والنسبة: الأوقات الشهرية للشهر المختار</small></div><div style="overflow:auto"><table class="ms391-table"><thead><tr><th>المشرف</th><th>المشروع</th><th>النوع</th><th>العمال</th><th>الدقائق</th><th>الوقت</th><th>نسبة المشروع</th><th>المعادلة</th></tr></thead><tbody id="ms391Body"></tbody></table></div></div>`;
    sec.prepend(root);$('ms391Month').value=monthVal();$('ms391Render').onclick=()=>renderMonth();$('ms391Freeze').onclick=()=>freezeMonth();$('ms391Print').onclick=()=>printReport();return true;
  }
  function msg(t,k){const el=$('ms391Msg');if(el){el.textContent=t;el.className='ms391-msg '+(k||'')}}
  function renderRows(rows,source){lastRows=rows||[];const daily=lastRows.filter(r=>!typeIsFull(r.projectType));const full=lastRows.filter(r=>typeIsFull(r.projectType));const total=lastRows.reduce((a,r)=>a+N(r.totalMinutes),0);const logs=lastRows.reduce((a,r)=>a+N(r.logsCount),0);const summary=$('ms391Summary');if(summary)summary.innerHTML=`<div class="ms391-kpi"><small>الشهر</small><b>${esc(monthVal())}</b></div><div class="ms391-kpi"><small>إجمالي المشاريع</small><b>${lastRows.length}</b></div><div class="ms391-kpi"><small>الزيارة اليومية</small><b>${daily.length}</b></div><div class="ms391-kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="ms391-kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="ms391-kpi"><small>عدد السجلات</small><b>${logs}</b></div>`;
    const bySup=new Map();daily.forEach(r=>{const k=r.supervisorName||'غير محدد';if(!bySup.has(k))bySup.set(k,[]);bySup.get(k).push(r)});
    const dailyEl=$('ms391Daily');if(dailyEl)dailyEl.innerHTML=daily.length?[...bySup.entries()].map(([sup,list])=>{const totalSup=list.reduce((a,r)=>a+N(r.totalMinutes),0);return `<div class="ms391-super"><h4>${esc(sup)}</h4><table class="ms391-table"><thead><tr><th>المشروع</th><th>العمال</th><th>الدقائق</th><th>الوقت</th><th>النسبة</th></tr></thead><tbody>${list.map(r=>`<tr><td class="project">${esc(r.projectName)}</td><td class="ms391-workers">${workerList(r.workers).map(esc).join('، ')||'-'}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td><div class="ms391-pct"><span style="width:${Math.min(100,N(r.percentage)).toFixed(0)}%"></span></div><b>${pct(r.percentage)}</b></td></tr>`).join('')}<tr><th>إجمالي المشرف</th><th></th><th>${Math.round(totalSup).toLocaleString('en-US')}</th><th>${esc(arMins(totalSup))}</th><th>100%</th></tr></tbody></table></div>`}).join(''):'<div class="ms391-empty">لا توجد مشاريع زيارة يومية لهذا الشهر.</div>';
    const fullEl=$('ms391Full');if(fullEl)fullEl.innerHTML=full.length?full.map(r=>`<div class="ms391-full-box"><h4>${esc(r.projectName)}</h4><div class="inner"><div class="ms391-line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="ms391-line"><span>العمال</span><b>${workerList(r.workers).map(esc).join('، ')||'-'}</b></div><div class="ms391-line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="ms391-line"><span>الدقائق</span><b>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</b></div><div class="ms391-line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="ms391-pct"><span style="width:${Math.min(100,N(r.percentage)).toFixed(0)}%"></span></div></div></div>`).join(''):'<div class="ms391-empty">لا توجد مشاريع دوام كامل لهذا الشهر.</div>';
    const body=$('ms391Body');if(body)body.innerHTML=lastRows.map(r=>`<tr><td>${esc(r.supervisorName||'-')}</td><td class="project">${esc(r.projectName)}</td><td>${esc(r.projectType)}</td><td class="ms391-workers">${workerList(r.workers).map(esc).join('، ')||'-'}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.formulaText||'')}</td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات.</td></tr>';
    msg(`تم عرض شهر ${monthVal()} من ${source}. تم منع تكرار المشاريع وتطبيق معادلة الورقة.`);
    try{window.tasneefMonthlyV391Rows=lastRows; window.dispatchEvent(new CustomEvent('tasneef:monthly-v391',{detail:{month:monthVal(),rows:lastRows}}));}catch(_){ }
  }
  let lastRows=[];
  async function renderMonth(){ensureUI();await refreshCodes();const m=monthVal();if($('ms391Month'))$('ms391Month').value=m;msg('جاري قراءة الأوقات الشهرية للشهر المختار...');let rows=dedupeRows(await loadSnapshotRows(m),m);let source='نسخة الأوقات الشهرية المجمدة';if(!rows.length){rows=dedupeRows(await buildFromLive(m),m);source='السجلات المباشرة للشهر'}renderRows(rows,source);return rows;}
  async function freezeMonth(){const m=monthVal();const rows=await renderMonth();const sb=sbc();const payload={month_key:m,rows:rows,meta:{version:VERSION,formula:'daily project minutes / supervisor total; full-time actual / required',deduplicated:true},locked:true,updated_at:new Date().toISOString()};try{if(sb){const r=await sb.from(SNAP_TABLE).upsert(payload,{onConflict:'month_key'});if(!r.error){msg(`تم تجميد شهر ${m} بدون تكرار المشاريع.`);return}}localStorage.setItem('tasneef_monthly_snapshot_v384_'+m,JSON.stringify(payload));msg(`تم حفظ شهر ${m} محليًا بدون تكرار المشاريع.`)}catch(e){msg('تعذر الحفظ: '+(e.message||e),'warn')}}
  function printReport(){const rows=lastRows||[];const daily=rows.filter(r=>!typeIsFull(r.projectType)), full=rows.filter(r=>typeIsFull(r.projectType));const total=rows.reduce((a,r)=>a+N(r.totalMinutes),0);const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';const bySup=new Map();daily.forEach(r=>{const k=r.supervisorName||'غير محدد';if(!bySup.has(k))bySup.set(k,[]);bySup.get(k).push(r)});
    const dailyHtml=daily.length?[...bySup.entries()].map(([sup,list])=>`<section class="super"><h2>${esc(sup)}</h2><table><thead><tr><th>المشروع</th><th>العامل / الكود</th><th>الوقت المستغرق</th><th>الدقائق</th><th>نسبة المشروع</th></tr></thead><tbody>${list.map(r=>`<tr><td class="project">${esc(r.projectName)}</td><td class="workers">${workerList(r.workers).map(esc).join('، ')||'-'}</td><td>${esc(arMins(r.totalMinutes))}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td><b>${pct(r.percentage)}</b></td></tr>`).join('')}</tbody></table></section>`).join(''):'<div class="empty">لا توجد مشاريع زيارة يومية.</div>';
    const fullHtml=full.length?`<section class="full-section"><h2>مشاريع الدوام الكامل / الدائمة</h2><div class="fullgrid">${full.map(r=>`<div class="fullbox"><h3>${esc(r.projectName)}</h3><p><b>المشرف:</b> ${esc(r.supervisorName||'-')}</p><p><b>العامل / الكود:</b> ${workerList(r.workers).map(esc).join('، ')||'-'}</p><p><b>الوقت المستغرق:</b> ${esc(arMins(r.totalMinutes))}</p><p><b>الدقائق:</b> ${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</p><p><b>نسبة المشروع:</b> ${pct(r.percentage)}</p><div class="bar"><span style="width:${Math.min(100,N(r.percentage)).toFixed(0)}%"></span></div></div>`).join('')}</div></section>`:'<div class="empty">لا توجد مشاريع دوام كامل.</div>';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الأوقات الشهرية ${esc(monthVal())}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#15231f;margin:0;background:#fff}.cover{border:2px solid #0a4539;border-radius:18px;background:linear-gradient(135deg,#f8fffc,#eef8f3);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.brand{display:flex;align-items:center;gap:14px}.brand img{width:115px;height:62px;object-fit:contain;background:#fff;border:1px solid #dbe8e2;border-radius:14px;padding:6px}h1{margin:0;color:#0a4539;font-size:24px}.sub{color:#60746c;margin-top:5px}.month{background:#0a4539;color:#fff;border-radius:16px;padding:10px 20px;text-align:center}.month b{font-size:25px;display:block}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:8px 0 12px}.kpi{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:9px;text-align:center}.kpi small{display:block;color:#60746c}.kpi b{font-size:18px;color:#0a4539}.super{border:1px solid #dbe8e2;border-radius:16px;overflow:hidden;margin:10px 0;break-inside:avoid}.super h2,.full-section h2{background:#0a4539;color:#fff;margin:0;padding:10px 13px;font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#eef6f3;color:#0a4539;font-weight:900}td,th{border:1px solid #dbe8e2;padding:7px;text-align:center;vertical-align:top}.project{text-align:right;font-weight:900;color:#0a4539}.workers{text-align:right;line-height:1.7}.full-section{border:1px solid #dbe8e2;border-radius:16px;overflow:hidden;margin:12px 0}.full-section h2{background:#123b70}.fullgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px}.fullbox{border:2px solid #123b70;border-radius:14px;padding:10px;break-inside:avoid}.fullbox h3{margin:0 0 8px;color:#123b70}.fullbox p{margin:6px 0;line-height:1.5}.bar{height:10px;background:#e8f0ed;border-radius:999px;overflow:hidden}.bar span{display:block;height:100%;background:#123b70}.empty{padding:20px;text-align:center;color:#60746c}.footer{display:flex;justify-content:space-between;color:#60746c;border-top:1px solid #dbe8e2;padding-top:8px;margin-top:10px;font-size:11px}</style></head><body><header class="cover"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div class="sub">تطبيق معادلة ورقة الأوقات الشهرية - بدون تكرار المشاريع</div></div></div><div class="month"><small>الشهر</small><b>${esc(monthVal())}</b><small>V${VERSION}</small></div></header><div class="kpis"><div class="kpi"><small>إجمالي المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div></div><h2 style="color:#0a4539;margin:8px 0">مشاريع الزيارة اليومية حسب المشرف</h2>${dailyHtml}${fullHtml}<div class="footer"><span>تم إنشاء التقرير من نظام شركة تصنيف لإدارة المرافق</span><span>${new Date().toLocaleString('en-GB')}</span></div><script>setTimeout(()=>print(),450)<\/script></body></html>`;const w=window.open('','_blank');if(w){w.document.write(html);w.document.close()}else window.print();}
  window.tasneefRenderMonthlyFormulaV391=renderMonth;window.tasneefPrintMonthlyFormulaV391=printReport;window.tasneefMonthlyEmployeeLabelV391=employeeLabel;
  const oldShow=window.showPage;window.showPage=function(id,btn){const res=oldShow?oldShow.apply(this,arguments):undefined;if(id==='monthly')setTimeout(()=>{ensureUI();renderMonth()},500);return res};
  function boot(){setTimeout(()=>{if(!$('monthly')?.classList.contains('hidden')){ensureUI();renderMonth()}},700)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
