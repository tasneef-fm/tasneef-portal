/* V392 - Monthly times project cards + corrected June project types */
(function(){
  'use strict';
  if(window.__tasneefMonthlyProjectCardsV392) return;
  window.__tasneefMonthlyProjectCardsV392 = true;
  const VERSION='392';
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const arMins=m=>{m=Math.round(N(m));const h=Math.floor(m/60),mm=m%60;if(!h)return mm+' دقيقة';if(!mm)return h+' ساعة';return h+' ساعة و '+mm+' دقيقة'};
  const pct=p=>N(p).toFixed(0)+'%';
  const monthVal=()=>$('ms391Month')?.value||$('ms384Month')?.value||$('mt52Month')?.value||new Date().toISOString().slice(0,7);
  const rawFull=t=>{const n=norm(t);return n.includes('دوام')||n.includes('كامل')||n.includes('دائم')||n.includes('full')||n.includes('24')};
  function typeOverride(name,type){
    const n=norm(name);
    // تعديلات أبو سامر لشهر 6، وتطبق في العرض حتى لا يتكرر التصحيح.
    if((n.includes('العجلان') && (n.includes('19')||n.includes('ريفيرا'))) || (n.includes('العجلان') && n.includes('30'))) return 'دوام كامل';
    if(n.includes('الرمز') && (n.includes('a17')||n.includes('17'))) return 'دوام كامل';
    if(n.includes('مكين') && n.includes('37')) return 'دوام كامل';
    if(n.includes('الشعلان') && (n.includes('50')||n.includes('51'))) return 'زيارة يومية';
    return rawFull(type)?'دوام كامل':'زيارة يومية';
  }
  function isFullRow(r){return typeOverride(r.projectName||r.project_name||r.name||'',r.projectType||r.project_type||r.operation_type)==='دوام كامل'}
  function workerList(list){
    const out=[];
    (Array.isArray(list)?list:S(list).split(/[،,\n]+/)).forEach(x=>{
      if(!S(x)) return;
      const parts=S(x).match(/TS-\d+\s*-\s*[^،,+\n]+|TS-\d+/gi);
      if(parts&&parts.length) parts.forEach(p=>out.push(S(p).toUpperCase().replace(/\s+-\s+/,' - ')));
      else out.push(S(x));
    });
    return [...new Set(out)];
  }
  function getWorkerNames(r){return workerList(r.workers||r.workerCodes||r.worker_codes||r.employee_codes||r.worker_names||[])}
  function projectKey(r){return S(r.projectId||r.project_id)||norm(r.projectName||r.project_name||r.name||r.project||'')}
  function normalizeRow(r){
    const projectName=S(r.projectName||r.project_name||r.name||r.project||'-');
    const projectType=typeOverride(projectName,r.projectType||r.project_type||r.operation_type);
    return {
      ...r,
      projectId:S(r.projectId||r.project_id||''),
      projectName,
      projectType,
      supervisorName:S(r.supervisorName||r.supervisor_name||'-'),
      workers:getWorkerNames(r),
      totalMinutes:N(r.totalMinutes||r.total_minutes||r.minutes||r.actual_minutes||0),
      requiredMinutes:N(r.requiredMinutes||r.required_minutes||r.requiredDailyMinutes||r.required_daily_minutes||0),
      logsCount:N(r.logsCount||r.logs_count||0)
    };
  }
  function adjustRows(rows){
    const map=new Map();
    (rows||[]).map(normalizeRow).forEach(r=>{
      if(!r.projectName||r.projectName==='-') return;
      const k=projectKey(r); if(!k) return;
      const old=map.get(k);
      if(!old){map.set(k,r);return;}
      old.workers=[...new Set([...(old.workers||[]),...(r.workers||[])])];
      old.totalMinutes=Math.max(N(old.totalMinutes),N(r.totalMinutes));
      old.requiredMinutes=Math.max(N(old.requiredMinutes),N(r.requiredMinutes));
      old.logsCount=Math.max(N(old.logsCount),N(r.logsCount));
      if((!old.supervisorName||old.supervisorName==='-')&&r.supervisorName) old.supervisorName=r.supervisorName;
      old.projectType=typeOverride(old.projectName,old.projectType);
      map.set(k,old);
    });
    const out=[...map.values()];
    const daily=out.filter(r=>!isFullRow(r));
    const supTotals={};
    daily.forEach(r=>{const k=norm(r.supervisorName||'غير محدد');supTotals[k]=(supTotals[k]||0)+N(r.totalMinutes)});
    out.forEach(r=>{
      r.projectType=typeOverride(r.projectName,r.projectType);
      if(isFullRow(r)){
        r.percentage=N(r.requiredMinutes)>0?(N(r.totalMinutes)/N(r.requiredMinutes))*100:(N(r.totalMinutes)>0?100:0);
        r.formulaText='الدوام الكامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه';
      }else{
        const st=supTotals[norm(r.supervisorName||'غير محدد')]||0;
        r.percentage=st>0?(N(r.totalMinutes)/st)*100:0;
        r.formulaText='الزيارة اليومية: وقت المشروع ÷ إجمالي وقت المشرف';
      }
    });
    return out.sort((a,b)=>{
      const af=isFullRow(a)?1:0,bf=isFullRow(b)?1:0;
      return af-bf || S(a.supervisorName).localeCompare(S(b.supervisorName),'ar') || S(a.projectName).localeCompare(S(b.projectName),'ar');
    });
  }
  function ensureStyle(){
    if($('ms392Css')) return;
    const st=document.createElement('style'); st.id='ms392Css';
    st.textContent=`
    .ms392-note{background:#fff8e8;border:1px solid #ead28d;color:#6a4d00;border-radius:14px;padding:10px 12px;font-weight:800;margin-bottom:10px;line-height:1.7}
    .ms392-super-block{border:2px solid #0a4539;border-radius:18px;margin:12px 0;overflow:hidden;background:#fff}.ms392-super-block>h4{margin:0;background:#0a4539;color:#fff;padding:12px 14px;font-size:18px}.ms392-project-grid{display:grid;grid-template-columns:repeat(3,minmax(270px,1fr));gap:12px;padding:12px}.ms392-project-card{border:1px solid #dbe8e2;border-radius:16px;background:#fbfdfc;padding:12px;break-inside:avoid}.ms392-project-card.full{border:2px solid #123b70;background:#fbfdff}.ms392-project-card h5{margin:0 0 9px;color:#0a4539;font-size:17px}.ms392-project-card.full h5{color:#123b70}.ms392-line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #d9e5df;padding:6px 0}.ms392-line span{color:#60746c}.ms392-line b{color:#0a4539;text-align:left}.ms392-workers{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}.ms392-workers span{background:#eef6f3;border:1px solid #dbe8e2;border-radius:999px;padding:5px 9px;font-weight:800;color:#0a4539}.ms392-bar{height:10px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:8px}.ms392-bar span{display:block;height:100%;background:#0a4539}.ms392-project-card.full .ms392-bar span{background:#123b70}.ms392-full-grid{display:grid;grid-template-columns:repeat(3,minmax(270px,1fr));gap:12px}@media(max-width:1200px){.ms392-project-grid,.ms392-full-grid{grid-template-columns:repeat(2,minmax(270px,1fr))}}@media(max-width:760px){.ms392-project-grid,.ms392-full-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }
  function projectCard(r,full){
    const workers=getWorkerNames(r);
    const req=N(r.requiredMinutes);
    return `<div class="ms392-project-card ${full?'full':''}"><h5>${esc(r.projectName)}</h5><div class="ms392-line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="ms392-line"><span>نوع التشغيل</span><b>${esc(r.projectType)}</b></div><div class="ms392-line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="ms392-line"><span>الدقائق</span><b>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</b></div>${full?`<div class="ms392-line"><span>الوقت المطلوب</span><b>${req?esc(arMins(req)):'-'}</b></div>`:''}<div class="ms392-line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="ms392-bar"><span style="width:${Math.min(100,N(r.percentage)).toFixed(0)}%"></span></div><div class="ms392-workers">${workers.length?workers.map(w=>`<span>${esc(w)}</span>`).join(''):'<span>لا يوجد عمال مربوطين</span>'}</div></div>`;
  }
  function render(rows){
    ensureStyle();
    const fixed=adjustRows(rows);
    window.tasneefMonthlyV392Rows=fixed;
    window.tasneefMonthlyV391Rows=fixed;
    const daily=fixed.filter(r=>!isFullRow(r));
    const full=fixed.filter(r=>isFullRow(r));
    const total=fixed.reduce((a,r)=>a+N(r.totalMinutes),0);
    const summary=$('ms391Summary');
    if(summary) summary.innerHTML=`<div class="ms391-kpi"><small>الشهر</small><b>${esc(monthVal())}</b></div><div class="ms391-kpi"><small>إجمالي المشاريع</small><b>${fixed.length}</b></div><div class="ms391-kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="ms391-kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="ms391-kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="ms391-kpi"><small>الإصدار</small><b>V${VERSION}</b></div>`;
    const msg=$('ms391Msg'); if(msg){msg.textContent='تم تطبيق v392: كل مشروع مربع مستقل، لا يوجد تكرار، وتصحيح نوع تشغيل الرمز A17 والعجلان 19 والشعلان 50/51.'; msg.className='ms391-msg';}
    const dailyEl=$('ms391Daily');
    if(dailyEl){
      const bySup=new Map(); daily.forEach(r=>{const k=r.supervisorName||'غير محدد'; if(!bySup.has(k))bySup.set(k,[]); bySup.get(k).push(r)});
      dailyEl.innerHTML=daily.length?`<div class="ms392-note">مشاريع الزيارة اليومية: تظهر حسب المشرف، وتحت كل مشرف كل مشروع في مربع مستقل. النسبة = وقت المشروع ÷ إجمالي وقت المشرف.</div>`+[...bySup.entries()].map(([sup,list])=>`<div class="ms392-super-block"><h4>${esc(sup)}</h4><div class="ms392-project-grid">${list.map(r=>projectCard(r,false)).join('')}</div></div>`).join(''):'<div class="ms391-empty">لا توجد مشاريع زيارة يومية لهذا الشهر.</div>';
    }
    const fullEl=$('ms391Full');
    if(fullEl){ fullEl.className='ms392-full-grid'; fullEl.innerHTML=full.length?full.map(r=>projectCard(r,true)).join(''):'<div class="ms391-empty">لا توجد مشاريع دوام كامل لهذا الشهر.</div>'; }
    const body=$('ms391Body');
    if(body) body.innerHTML=fixed.map(r=>`<tr><td>${esc(r.supervisorName||'-')}</td><td class="project">${esc(r.projectName)}</td><td>${esc(r.projectType)}</td><td class="ms391-workers">${getWorkerNames(r).map(esc).join('، ')||'-'}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.formulaText||'')}</td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات.</td></tr>';
    try{window.dispatchEvent(new CustomEvent('tasneef:monthly-v392',{detail:{month:monthVal(),rows:fixed}}));}catch(_){ }
    return fixed;
  }
  function print(){
    const rows=adjustRows(window.tasneefMonthlyV392Rows||window.tasneefMonthlyV391Rows||[]);
    const daily=rows.filter(r=>!isFullRow(r)); const full=rows.filter(r=>isFullRow(r));
    const total=rows.reduce((a,r)=>a+N(r.totalMinutes),0);
    const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';
    const bySup=new Map(); daily.forEach(r=>{const k=r.supervisorName||'غير محدد'; if(!bySup.has(k))bySup.set(k,[]); bySup.get(k).push(r)});
    const card=(r,full)=>`<article class="p-card ${full?'full':''}"><h3>${esc(r.projectName)}</h3><div class="line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="line"><span>نوع التشغيل</span><b>${esc(r.projectType)}</b></div><div class="line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="line"><span>الدقائق</span><b>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</b></div>${full?`<div class="line"><span>الوقت المطلوب</span><b>${N(r.requiredMinutes)?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}<div class="line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="bar"><span style="width:${Math.min(100,N(r.percentage)).toFixed(0)}%"></span></div><div class="workers"><b>العمال:</b> ${getWorkerNames(r).map(esc).join('، ')||'-'}</div></article>`;
    const dailyHtml=daily.length?[...bySup.entries()].map(([sup,list])=>`<section class="super"><h2>${esc(sup)}</h2><div class="grid">${list.map(r=>card(r,false)).join('')}</div></section>`).join(''):'<div class="empty">لا توجد مشاريع زيارة يومية.</div>';
    const fullHtml=full.length?`<section class="full-section"><h2>مشاريع الدوام الكامل / الدائمة</h2><div class="grid">${full.map(r=>card(r,true)).join('')}</div></section>`:'<div class="empty">لا توجد مشاريع دوام كامل.</div>';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${esc(monthVal())}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#15231f;background:#fff}.cover{border:2px solid #0a4539;border-radius:18px;background:linear-gradient(135deg,#f8fffc,#eef8f3);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.brand{display:flex;align-items:center;gap:12px}.brand img{width:105px;height:58px;object-fit:contain;background:#fff;border:1px solid #dbe8e2;border-radius:12px;padding:6px}h1{margin:0;color:#0a4539;font-size:24px}.sub{color:#60746c;margin-top:5px}.month{background:#0a4539;color:#fff;border-radius:16px;padding:9px 18px;text-align:center}.month b{display:block;font-size:24px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:8px 0 12px}.kpi{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:8px;text-align:center}.kpi small{display:block;color:#60746c}.kpi b{font-size:18px;color:#0a4539}.section-title{color:#0a4539;margin:10px 0 6px;font-size:18px}.super,.full-section{border:1px solid #dbe8e2;border-radius:16px;margin:10px 0;overflow:hidden;break-inside:avoid}.super h2,.full-section h2{margin:0;background:#0a4539;color:#fff;padding:9px 12px;font-size:17px}.full-section h2{background:#123b70}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:9px}.p-card{border:1px solid #dbe8e2;border-radius:14px;padding:10px;background:#fbfdfc;break-inside:avoid}.p-card.full{border:2px solid #123b70;background:#fbfdff}.p-card h3{margin:0 0 7px;color:#0a4539;font-size:16px}.p-card.full h3{color:#123b70}.line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #d9e5df;padding:5px 0;font-size:12px}.line span{color:#60746c}.line b{color:#0a4539}.workers{margin-top:8px;font-size:12px;line-height:1.7}.bar{height:9px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:7px}.bar span{display:block;height:100%;background:#0a4539}.p-card.full .bar span{background:#123b70}.empty{padding:20px;text-align:center;color:#60746c}.footer{display:flex;justify-content:space-between;color:#60746c;border-top:1px solid #dbe8e2;padding-top:7px;margin-top:10px;font-size:11px}@media print{.p-card,.super,.full-section{break-inside:avoid}}</style></head><body><header class="cover"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div class="sub">كل مشروع مربع مستقل - العمال بالكود والاسم - بدون تكرار المشاريع</div></div></div><div class="month"><small>الشهر</small><b>${esc(monthVal())}</b><small>V${VERSION}</small></div></header><div class="kpis"><div class="kpi"><small>إجمالي المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div></div><h2 class="section-title">مشاريع الزيارة اليومية حسب المشرف</h2>${dailyHtml}${fullHtml}<div class="footer"><span>تم إنشاء التقرير من نظام شركة تصنيف لإدارة المرافق</span><span>${new Date().toLocaleString('en-GB')}</span></div><script>setTimeout(()=>print(),500)<\/script></body></html>`;
    const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();} else window.print();
  }
  function attach(){
    const btn=$('ms391Print'); if(btn && btn.dataset.v392!=='1'){btn.dataset.v392='1';btn.onclick=print;btn.textContent='طباعة التقرير بشكل احترافي';}
    const renderBtn=$('ms391Render'); if(renderBtn && renderBtn.dataset.v392!=='1'){
      renderBtn.dataset.v392='1'; const old=renderBtn.onclick; renderBtn.onclick=async function(ev){let rows=[]; if(typeof old==='function') rows=await old.call(this,ev); setTimeout(()=>render(window.tasneefMonthlyV391Rows||rows||[]),120);};
    }
  }
  window.addEventListener('tasneef:monthly-v391',e=>{setTimeout(()=>render(e.detail?.rows||window.tasneefMonthlyV391Rows||[]),20);});
  window.tasneefPrintMonthlyFormulaV392=print;
  window.tasneefMonthlyProjectCardsV392={adjustRows,render,print,typeOverride};
  const oldPrint=window.tasneefPrintMonthlyFormulaV391; window.tasneefPrintMonthlyFormulaV391=print;
  const oldShow=window.showPage; window.showPage=function(id,btn){const res=oldShow?oldShow.apply(this,arguments):undefined;if(id==='monthly')setTimeout(attach,700);return res};
  function boot(){attach();setInterval(attach,1500);if(window.tasneefMonthlyV391Rows)render(window.tasneefMonthlyV391Rows)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
