/* V393 - جذري: الأوقات الشهرية من جدول mt52، كل مشروع كرت مستقل، وطباعة صحيحة */
(function(){
  'use strict';
  if(window.__tasneefMonthlyCardsV393) return;
  window.__tasneefMonthlyCardsV393 = true;
  const VERSION='393';
  const S=v=>String(v??'').trim();
  const N=v=>{
    if(typeof v==='number') return Number.isFinite(v)?v:0;
    const s=S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'');
    const n=Number(s); return Number.isFinite(n)?n:0;
  };
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const monthVal=()=>($('mt52Month')?.value||$('ms391Month')?.value||new Date().toISOString().slice(0,7));
  const arMins=m=>{m=Math.round(Number(m)||0);const h=Math.floor(m/60),mm=m%60;if(!h)return mm+' دقيقة'; if(!mm)return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=v=>`${Math.round((Number(v)||0)*10)/10}%`.replace('.0%','%');
  const parseHoursTxt=t=>{ const s=S(t); let total=0; const hm=s.match(/(\d+)\s*ساعة/); const mm=s.match(/(\d+)\s*دقيقة/); if(hm) total+=Number(hm[1])*60; if(mm) total+=Number(mm[1]); return total; };

  const PROJECT_DEFAULTS=[
    ['العجلان ريفيرا 19','دوام كامل',540,20,'2025-10-01','2026-09-30'],
    ['العجلان 19','دوام كامل',540,20,'2025-10-01','2026-09-30'],
    ['العجلان 30','دوام كامل',540,180,'2026-06-20','2027-06-19'],
    ['الرمز A17','دوام كامل',540,150,'2026-06-01','2027-05-31'],
    ['الرمز 17 A','دوام كامل',540,150,'2026-06-01','2027-05-31'],
    ['مكين 37','دوام كامل',540,90,'2025-04-24','2026-07-23'],
    ['الماجدية 88','دوام كامل',540,40,'2025-12-01','2026-11-30'],
    ['وجود الياسمين','دوام كامل',540,300,'2026-04-14','2027-04-13'],
    ['صفاء 65','دوام كامل',720,60,'2026-01-13','2027-01-12'],
    ['برج جوديا صباح','دوام كامل',720,720,'2026-01-01','2026-12-31'],
    ['صفاء 28','دوام كامل',540,60,'2026-01-01','2026-12-31'],
    ['الشعلان 50','زيارة يومية',540,30,'2026-01-01','2026-12-31'],
    ['الشعلان 51','زيارة يومية',540,30,'2026-02-01','2027-01-31']
  ];
  function defFor(name){ const n=norm(name); return PROJECT_DEFAULTS.find(d=>{const dn=norm(d[0]); return n===dn || n.includes(dn) || dn.includes(n);}); }
  function typeOverride(name,type){
    const n=norm(name), t=norm(type);
    if((n.includes('العجلان')&&(n.includes('ريفيرا')||n.includes('19')||n.includes('30'))) || (n.includes('مكين')&&n.includes('37')) || (n.includes('الرمز')&&(n.includes('a17')||n.includes('17')))) return 'دوام كامل';
    if(n.includes('الشعلان')&&(n.includes('50')||n.includes('51'))) return 'زيارة يومية';
    const d=defFor(name); if(d) return d[1];
    if(t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('24')) return 'دوام كامل';
    return 'زيارة يومية';
  }
  function isFull(r){ return typeOverride(r.projectName,r.projectType)==='دوام كامل'; }
  function monthRange(ym){ const [y,m]=S(ym).split('-').map(Number); return {start:new Date(y,m-1,1), end:new Date(y,m,0)}; }
  function requiredForMonth(r){
    const d=defFor(r.projectName);
    const daily=Number(r.requiredDailyMinutes||r.requiredMinutes||r.required_daily_minutes||(d?d[2]:0))||0;
    const friday=Number(r.fridayMinutes||r.friday_minutes||(d?d[3]:daily))||0;
    if(!daily) return 0;
    const {start,end}=monthRange(monthVal());
    let a=start, b=end;
    const cs=r.contractStart||r.contract_start||(d?d[4]:''); const ce=r.contractEnd||r.contract_end||(d?d[5]:'');
    if(cs){ const x=new Date(cs+'T00:00:00'); if(x>a) a=x; }
    if(ce){ const x=new Date(ce+'T00:00:00'); if(x<b) b=x; }
    if(a>b) return 0;
    let total=0;
    for(let cur=new Date(a); cur<=b; cur.setDate(cur.getDate()+1)) total += cur.getDay()===5 ? (friday||daily) : daily;
    return total;
  }
  function workerTokens(txt){
    const out=[]; const s=S(txt).replace(/\s+/g,' ');
    if(!s) return out;
    const matches=s.match(/TS-\d+\s*-\s*[^،,\n]+|TS-\d+/gi);
    if(matches) matches.forEach(m=>out.push(S(m).toUpperCase().replace(/\s*-\s*/,' - ')));
    else s.split(/[،,\n]+/).map(S).filter(Boolean).forEach(x=>out.push(x));
    return [...new Set(out)];
  }
  function projectKey(name){ return norm(name).replace(/\s+/g,' '); }
  function extractRows(){
    const rows=[];
    const trs=[...document.querySelectorAll('#mt52Body tr')];
    trs.forEach(tr=>{
      const td=[...tr.children]; if(td.length<6) return;
      const supervisor=S(td[0]?.innerText); const project=S(td[1]?.innerText);
      if(!project || /لا توجد|اختر الشهر/.test(project)) return;
      const workers=S(td[2]?.innerText);
      const minutes=N(td[4]?.innerText)||parseHoursTxt(td[5]?.innerText);
      const source=S(td[8]?.innerText);
      rows.push({supervisorName:supervisor||'غير محدد',projectName:project,projectType:typeOverride(project,source),workers:workerTokens(workers),totalMinutes:minutes,source});
    });
    return normalizeRows(rows);
  }
  function normalizeRows(rows){
    const map=new Map();
    (rows||[]).forEach(x=>{
      const r={...x}; r.projectName=S(r.projectName); if(!r.projectName) return;
      r.projectType=typeOverride(r.projectName,r.projectType);
      r.totalMinutes=Number(r.totalMinutes)||0;
      const k=projectKey(r.projectName);
      const old=map.get(k);
      if(!old){ map.set(k,r); return; }
      old.totalMinutes=Math.max(Number(old.totalMinutes)||0, Number(r.totalMinutes)||0);
      old.workers=[...new Set([...(old.workers||[]),...(r.workers||[])])];
      if((!old.supervisorName||old.supervisorName==='غير محدد')&&r.supervisorName) old.supervisorName=r.supervisorName;
      old.projectType=typeOverride(old.projectName,old.projectType);
    });
    const out=[...map.values()];
    const daily=out.filter(r=>!isFull(r));
    const supTotals={}; daily.forEach(r=>{const k=norm(r.supervisorName||'غير محدد'); supTotals[k]=(supTotals[k]||0)+(Number(r.totalMinutes)||0);});
    out.forEach(r=>{
      r.projectType=typeOverride(r.projectName,r.projectType);
      if(isFull(r)){
        r.requiredMinutes=requiredForMonth(r);
        r.percentage=r.requiredMinutes>0 ? ((Number(r.totalMinutes)||0)/r.requiredMinutes*100) : ((Number(r.totalMinutes)||0)>0?100:0);
        r.calcNote='دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه';
      }else{
        const st=supTotals[norm(r.supervisorName||'غير محدد')]||0;
        r.requiredMinutes=0;
        r.percentage=st>0 ? ((Number(r.totalMinutes)||0)/st*100) : 0;
        r.calcNote='زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف';
      }
    });
    return out.sort((a,b)=>(isFull(a)-isFull(b)) || S(a.supervisorName).localeCompare(S(b.supervisorName),'ar') || S(a.projectName).localeCompare(S(b.projectName),'ar'));
  }
  function ensureCss(){
    if($('mt393Css')) return;
    const st=document.createElement('style'); st.id='mt393Css';
    st.textContent=`.mt393-note{background:#fff8e8;border:1px solid #ead28d;color:#6a4d00;border-radius:14px;padding:10px 12px;margin:8px 0 12px;font-weight:800;line-height:1.8}.mt393-super{border:1px solid #cfe2da;border-radius:18px;background:#fff;overflow:hidden;margin:12px 0}.mt393-super>h3{margin:0;background:#0a4539;color:#fff;padding:12px 14px}.mt393-grid{display:grid!important;grid-template-columns:repeat(3,minmax(280px,1fr))!important;gap:12px!important}.mt393-card{border:1px solid #dbe8e2!important;border-radius:18px!important;background:#fbfdfc!important;padding:13px!important;min-height:auto!important;break-inside:avoid!important;box-shadow:0 8px 22px rgba(0,0,0,.04)!important}.mt393-card.full{border:2px solid #123b70!important;background:#fbfdff!important}.mt393-card h4{margin:0 0 10px!important;text-align:right!important;color:#0a4539!important;font-size:18px!important}.mt393-card.full h4{color:#123b70!important}.mt393-line{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #d7e5df;padding:7px 0}.mt393-line span{color:#60746c}.mt393-line b{color:#0a4539;text-align:left}.mt393-workers{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.mt393-workers span{background:#eef6f3;border:1px solid #dbe8e2;border-radius:999px;padding:5px 9px;font-weight:800;color:#0a4539}.mt393-bar{height:10px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:8px}.mt393-bar i{display:block;height:100%;background:#0a4539}.mt393-card.full .mt393-bar i{background:#123b70}@media(max-width:1200px){.mt393-grid{grid-template-columns:repeat(2,minmax(260px,1fr))!important}}@media(max-width:760px){.mt393-grid{grid-template-columns:1fr!important}}`;
    document.head.appendChild(st);
  }
  function card(r){
    const full=isFull(r); const workers=(r.workers||[]).length?r.workers:['لا يوجد عمال مربوطين'];
    return `<article class="mt393-card ${full?'full':''}"><h4>${esc(r.projectName)}</h4><div class="mt393-line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="mt393-line"><span>نوع التشغيل</span><b>${esc(r.projectType)}</b></div><div class="mt393-line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="mt393-line"><span>إجمالي الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>${full?`<div class="mt393-line"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}<div class="mt393-line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="mt393-bar"><i style="width:${Math.min(100,Math.max(0,r.percentage)).toFixed(0)}%"></i></div><div class="mt393-workers">${workers.map(w=>`<span>${esc(w)}</span>`).join('')}</div></article>`;
  }
  function renderFromTable(){
    ensureCss();
    const rows=extractRows(); if(!rows.length) return rows;
    window.tasneefMonthlyV393Rows=rows;
    const daily=rows.filter(r=>!isFull(r)), full=rows.filter(r=>isFull(r));
    const visitGrid=$('mt52VisitGrid');
    if(visitGrid){
      const bySup=new Map(); daily.forEach(r=>{const k=r.supervisorName||'غير محدد'; if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r);});
      visitGrid.className='';
      visitGrid.innerHTML=`<div class="mt393-note">تصحيح v393: مشاريع الزيارة اليومية حسب المشرف، وكل مشروع مربع مستقل. النسبة = وقت المشروع ÷ إجمالي وقت نفس المشرف.</div>`+[...bySup.entries()].map(([sup,list])=>`<section class="mt393-super"><h3>${esc(sup)}</h3><div class="mt393-grid">${list.map(card).join('')}</div></section>`).join('');
    }
    const workersCard=document.querySelector('.monthly-workers-v10152');
    if(workersCard){
      workersCard.querySelector('h2').textContent='المشاريع الدائمة / الدوام الكامل';
      const small=workersCard.querySelector('small'); if(small) small.textContent='كل مشروع يظهر في مربع مستقل وحسابه لحاله: الوقت المستغرق ÷ الوقت المطلوب.';
      const grid=$('mt52WorkersGrid'); if(grid){grid.className='mt393-grid'; grid.innerHTML=full.length?full.map(card).join(''):'<div class="mt393-note">لا توجد مشاريع دوام كامل لهذا الشهر.</div>';}
    }
    const summary=$('mt52Summary');
    if(summary){
      const total=rows.reduce((a,r)=>a+r.totalMinutes,0);
      summary.innerHTML=`<div class="mt52-kpi"><small>الشهر</small><b>${esc(monthVal())}</b></div><div class="mt52-kpi"><small>المشاريع بدون تكرار</small><b>${rows.length}</b></div><div class="mt52-kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="mt52-kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="mt52-kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div>`;
    }
    const msg=$('mt52Message'); if(msg){msg.classList.remove('hidden'); msg.textContent='تم تصحيح العرض v393: لا يوجد تكرار، وكل مشروع دوام كامل أصبح مربع مستقل وحسابه لحاله.';}
    patchTable(rows);
    return rows;
  }
  function patchTable(rows){
    const body=$('mt52Body'); if(!body||!rows.length) return;
    body.innerHTML=rows.map(r=>`<tr><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${(r.workers||[]).map(esc).join('، ')||'-'}</td><td>-</td><td>${Math.round(r.totalMinutes).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td>-</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.projectType)}</td><td>${esc(r.calcNote)}</td><td>-</td></tr>`).join('');
  }
  function printReport(ev){
    if(ev){ev.preventDefault(); ev.stopPropagation();}
    const rows=window.tasneefMonthlyV393Rows?.length?window.tasneefMonthlyV393Rows:renderFromTable();
    const daily=rows.filter(r=>!isFull(r)), full=rows.filter(r=>isFull(r));
    const bySup=new Map(); daily.forEach(r=>{const k=r.supervisorName||'غير محدد'; if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r);});
    const total=rows.reduce((a,r)=>a+r.totalMinutes,0);
    const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';
    const pcard=r=>`<article class="p-card ${isFull(r)?'full':''}"><h3>${esc(r.projectName)}</h3><div class="line"><span>المشرف</span><b>${esc(r.supervisorName)}</b></div><div class="line"><span>نوع التشغيل</span><b>${esc(r.projectType)}</b></div><div class="line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="line"><span>إجمالي الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>${isFull(r)?`<div class="line"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}<div class="line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="bar"><i style="width:${Math.min(100,Math.max(0,r.percentage)).toFixed(0)}%"></i></div><div class="workers"><b>العمال:</b> ${(r.workers||[]).map(esc).join('، ')||'-'}</div></article>`;
    const dailyHtml=[...bySup.entries()].map(([sup,list])=>`<section class="super"><h2>${esc(sup)}</h2><div class="grid">${list.map(pcard).join('')}</div></section>`).join('')||'<div class="empty">لا توجد مشاريع زيارة يومية.</div>';
    const fullHtml=full.length?`<section class="full-section"><h2>المشاريع الدائمة / الدوام الكامل</h2><div class="grid">${full.map(pcard).join('')}</div></section>`:'<div class="empty">لا توجد مشاريع دوام كامل.</div>';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${esc(monthVal())}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#15231f;background:#fff}.head{border:2px solid #0a4539;border-radius:18px;background:#f7fcfa;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:100px;height:58px;object-fit:contain;background:#fff;border:1px solid #dbe8e2;border-radius:12px;padding:6px}h1{margin:0;color:#0a4539;font-size:24px}.sub{color:#60746c;margin-top:4px}.month{background:#0a4539;color:#fff;border-radius:16px;padding:9px 18px;text-align:center}.month b{display:block;font-size:24px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}.kpi{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:8px;text-align:center}.kpi small{display:block;color:#60746c}.kpi b{font-size:18px;color:#0a4539}.title{font-size:18px;color:#0a4539;margin:10px 0 6px}.super,.full-section{border:1px solid #dbe8e2;border-radius:16px;margin:9px 0;overflow:hidden;break-inside:avoid}.super h2,.full-section h2{margin:0;background:#0a4539;color:#fff;padding:9px 12px;font-size:17px}.full-section h2{background:#123b70}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:9px}.p-card{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:10px;break-inside:avoid}.p-card.full{border:2px solid #123b70;background:#fbfdff}.p-card h3{margin:0 0 8px;color:#0a4539;font-size:16px}.p-card.full h3{color:#123b70}.line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #d9e5df;padding:5px 0;font-size:12px}.line span{color:#60746c}.line b{color:#0a4539}.workers{font-size:12px;line-height:1.7;margin-top:8px}.bar{height:9px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:7px}.bar i{display:block;height:100%;background:#0a4539}.p-card.full .bar i{background:#123b70}.empty{text-align:center;color:#60746c;padding:18px}.footer{display:flex;justify-content:space-between;color:#60746c;border-top:1px solid #dbe8e2;padding-top:7px;margin-top:10px;font-size:11px}@media print{.p-card,.super,.full-section{break-inside:avoid}}</style></head><body><header class="head"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div class="sub">مشاريع الزيارة حسب المشرف، والدوام الكامل كل مشروع مربع مستقل وحسابه لحاله</div></div></div><div class="month"><small>الشهر</small><b>${esc(monthVal())}</b><small>V${VERSION}</small></div></header><div class="kpis"><div class="kpi"><small>المشاريع بدون تكرار</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div></div><h2 class="title">مشاريع الزيارة اليومية حسب المشرف</h2>${dailyHtml}${fullHtml}<div class="footer"><span>تم إنشاء التقرير من نظام شركة تصنيف لإدارة المرافق ويعتبر معتمدًا ما لم يبرر العميل خلاف ذلك</span><span>${new Date().toLocaleString('en-GB')}</span></div><script>setTimeout(()=>print(),600)<\/script></body></html>`;
    const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();} else window.print();
    return false;
  }
  function attach(){
    const print=$('mt52Print'); if(print && print.dataset.v393!=='1'){
      print.dataset.v393='1'; print.textContent='طباعة التقرير المصحح'; print.addEventListener('click',printReport,true); print.onclick=printReport;
    }
    const refresh=$('mt52Refresh'); if(refresh && refresh.dataset.v393!=='1'){
      refresh.dataset.v393='1'; refresh.addEventListener('click',()=>setTimeout(renderFromTable,1600),true);
    }
    const rebuild=$('mt52Rebuild'); if(rebuild && rebuild.dataset.v393!=='1'){
      rebuild.dataset.v393='1'; rebuild.addEventListener('click',()=>setTimeout(renderFromTable,2500),true);
    }
  }
  function boot(){
    attach(); setInterval(attach,1200);
    let last='';
    setInterval(()=>{const body=$('mt52Body'); if(!body) return; const now=body.innerText; if(now&&now!==last&&now.length>20){last=now; setTimeout(renderFromTable,80);} },1000);
    setTimeout(renderFromTable,2000);
  }
  window.tasneefMonthlyCardsV393={render:renderFromTable,print:printReport,extractRows,normalizeRows,typeOverride,requiredForMonth};
  window.tasneefPrintMonthlyFormulaV391=printReport;
  window.tasneefPrintMonthlyFormulaV392=printReport;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
