
/* V402 clean monthly times - daily projects grouped in one supervisor box, full-time one card per project */
(function(){
  'use strict';
  const VERSION='402';
  const DATA_URL='monthly_times_june_2026_v401.json?v=402-' + Date.now();
  let DATA=[];
  const $=id=>document.getElementById(id);
  const S=v=>(v==null?'':String(v));
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minsText=m=>{m=Math.round(Number(m)||0); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=v=>{const n=Number(v)||0; return (Math.round(n*10)/10).toString().replace(/\.0$/,'')+'%';};
  const isFull=r=>S(r.projectType).includes('دوام');
  function setVersion(){document.querySelectorAll('*').forEach(el=>{if(el.children.length===0 && /^V\d+$/i.test((el.textContent||'').trim())) el.textContent='V'+VERSION;});}
  function normalize(rows){
    const map=new Map();
    (rows||[]).forEach(r=>{
      const key=(r.month||'2026-06')+'|'+(r.projectName||'');
      if(!map.has(key)) map.set(key,Object.assign({},r));
      else{
        const a=map.get(key);
        a.totalMinutes=(+a.totalMinutes||0)+(+r.totalMinutes||0);
        a.workerCodes=[...new Set([...(a.workerCodes||[]),...(r.workerCodes||[])])];
        a.workers=[...new Set([...(a.workers||[]),...(r.workers||[])])];
      }
    });
    return [...map.values()];
  }
  function filtered(){
    const month=($('mc401Month')?.value)||'2026-06';
    const sup=($('mc401Supervisor')?.value)||'';
    const type=($('mc401Type')?.value)||'';
    return normalize(DATA).filter(r=>{
      if(r.month!==month) return false;
      if(sup&&r.supervisorName!==sup) return false;
      if(type==='daily'&&isFull(r)) return false;
      if(type==='full'&&!isFull(r)) return false;
      return true;
    });
  }
  function fullCard(r){
    const p=Number(r.percentage)||0;
    return `<article class="mc401-card full"><h3>${esc(r.projectName)}</h3>
      <div class="mc401-row"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div>
      <div class="mc401-row"><span>نوع المشروع</span><b>${esc(r.projectType)}</b></div>
      <div class="mc401-row"><span>الوقت المستغرق</span><b>${esc(r.hoursText||minsText(r.totalMinutes))}</b></div>
      <div class="mc401-row"><span>إجمالي الدقائق</span><b>${Math.round(+r.totalMinutes||0).toLocaleString('en-US')}</b></div>
      <div class="mc401-row"><span>نسبة المشروع</span><b>${pct(p)}</b></div>
      <div class="mc401-bar"><i style="width:${Math.max(0,Math.min(100,p)).toFixed(0)}%"></i></div>
      <div class="mc401-workers">${(r.workers||[]).map(w=>`<span class="mc401-pill">${esc(w)}</span>`).join('')||'<span class="mc401-pill">لا يوجد عمال</span>'}</div>
    </article>`;
  }
  function dailySupervisorBox(sup,list){
    const total=list.reduce((a,r)=>a+(+r.totalMinutes||0),0);
    const workers=[...new Set(list.flatMap(r=>r.workers||[]))];
    return `<article class="mc402-daily-card">
      <div class="mc402-daily-head"><h3>${esc(sup)}</h3><div class="mc402-mini-kpis"><span class="mc402-mini-kpi">المشاريع: ${list.length}</span><span class="mc402-mini-kpi">إجمالي الوقت: ${esc(minsText(total))}</span><span class="mc402-mini-kpi">الدقائق: ${Math.round(total).toLocaleString('en-US')}</span></div></div>
      <table class="mc402-project-table"><thead><tr><th>المشروع</th><th>الوقت المستغرق</th><th>الدقائق</th><th>النسبة</th><th>المعادلة</th></tr></thead><tbody>
        ${list.map(r=>{const p=Number(r.percentage)||0;return `<tr><td><b>${esc(r.projectName)}</b></td><td>${esc(r.hoursText||minsText(r.totalMinutes))}</td><td>${Math.round(+r.totalMinutes||0).toLocaleString('en-US')}</td><td><b>${pct(p)}</b><div class="mc402-progress"><i style="width:${Math.max(0,Math.min(100,p)).toFixed(0)}%"></i></div></td><td>مدة المشروع ÷ إجمالي مدة المشرف</td></tr>`;}).join('')}
      </tbody></table>
      <div class="mc402-workers-line"><b>العمال:</b> ${workers.map(w=>`<span class="mc401-pill">${esc(w)}</span>`).join('')||'<span class="mc401-pill">لا يوجد عمال</span>'}</div>
    </article>`;
  }
  function fillSelectors(){const supSel=$('mc401Supervisor');if(supSel&&supSel.options.length<=1){[...new Set(DATA.map(r=>r.supervisorName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')).forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;supSel.appendChild(o);});}}
  function render(){
    setVersion();fillSelectors();
    const rows=filtered();
    const daily=rows.filter(r=>!isFull(r));
    const full=rows.filter(isFull);
    const total=rows.reduce((a,r)=>a+(+r.totalMinutes||0),0);
    const summary=$('mc401Summary');
    if(summary)summary.innerHTML=[['الشهر',$('mc401Month')?.value||'2026-06'],['إجمالي المشاريع',rows.length],['مشاريع الزيارة',daily.length],['مشاريع الدوام الكامل',full.length],['إجمالي الوقت',minsText(total)]].map(x=>`<div class="mc401-kpi"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('');
    const msg=$('mc401Message');if(msg)msg.textContent=`تم تحميل ${rows.length} مشروع من بيانات شهر 2026-06. مشاريع الزيارة في مربع واحد لكل مشرف، والدوام الكامل كل مشروع مربع مستقل.`;
    const groups=new Map();daily.forEach(r=>{const k=r.supervisorName||'-';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    const dailyBox=$('mc401Daily');if(dailyBox)dailyBox.innerHTML=daily.length?[...groups.entries()].map(([sup,list])=>dailySupervisorBox(sup,list)).join(''):'<div class="mc401-empty">لا توجد مشاريع زيارة يومية.</div>';
    const fullBox=$('mc401Full');if(fullBox){fullBox.className='mc401-grid'; fullBox.innerHTML=full.length?full.map(fullCard).join(''):'<div class="mc401-empty">لا توجد مشاريع دوام كامل.</div>';}
    const body=$('mc401Body');if(body)body.innerHTML=rows.map(r=>`<tr><td>${esc(r.month)}</td><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${esc(r.projectType)}</td><td>${(r.workers||[]).map(esc).join('، ')}</td><td>${Math.round(+r.totalMinutes||0).toLocaleString('en-US')}</td><td>${esc(r.hoursText||minsText(r.totalMinutes))}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.calcNote||'')}</td></tr>`).join('');
    window.tasneefMonthlyCleanV402Rows=rows;
    return rows;
  }
  function csv(){const headers=['month','supervisor','project','type','workers','minutes','hours','percentage'];const lines=[headers.join(',')].concat(filtered().map(r=>[r.month,r.supervisorName,r.projectName,r.projectType,(r.workers||[]).join(' | '),r.totalMinutes,r.hoursText,pct(r.percentage)].map(v=>`"${S(v).replace(/"/g,'""')}"`).join(',')));const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='monthly_times_2026_06_v402.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function printReport(){
    render();
    const rows=filtered(), daily=rows.filter(r=>!isFull(r)), full=rows.filter(isFull), total=rows.reduce((a,r)=>a+(+r.totalMinutes||0),0);
    const groups=new Map();daily.forEach(r=>{const k=r.supervisorName||'-';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';
    const style=`body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#061f18;margin:22px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0A4033;padding-bottom:14px;margin-bottom:14px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:70px;max-height:70px;object-fit:contain}.month{background:#0A4033;color:#fff;border-radius:16px;padding:10px 18px;text-align:center}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.kpi{border:1px solid #cfe2dc;border-radius:14px;padding:10px;text-align:center}.kpi b{font-size:20px;color:#0A4033}.section-title{margin:18px 0 10px;background:#eef8f5;border-right:6px solid #0A4033;padding:10px;border-radius:12px}.mc401-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.mc401-card{border:2px solid #0A4033;border-radius:14px;padding:12px;break-inside:avoid;page-break-inside:avoid}.mc401-card h3{text-align:center;margin:0 0 8px}.mc401-row{display:grid;grid-template-columns:1fr 1.2fr;border-top:1px solid #e7efec;padding:6px 0}.mc401-pill{display:inline-block;background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:4px 8px;margin:3px;font-weight:700}.mc401-bar{height:8px;background:#edf3f1;border-radius:99px;overflow:hidden}.mc401-bar i{display:block;height:100%;background:#0A4033}.mc402-daily-card{border:2px solid #0A4033;border-radius:16px;padding:12px;margin:12px 0;break-inside:avoid;page-break-inside:avoid}.mc402-daily-head{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #dce6e2;padding-bottom:8px;margin-bottom:8px}.mc402-daily-head h3{margin:0;color:#0A4033}.mc402-mini-kpis{display:flex;gap:6px;flex-wrap:wrap}.mc402-mini-kpi{background:#eef8f5;border:1px solid #cfe2dc;border-radius:10px;padding:6px 9px;font-weight:900}.mc402-project-table{width:100%;border-collapse:collapse}.mc402-project-table th,.mc402-project-table td{padding:8px;border-bottom:1px solid #edf1ef;text-align:right}.mc402-workers-line{margin-top:8px}.mc402-progress{height:7px;background:#edf3f1;border-radius:99px;overflow:hidden}.mc402-progress i{display:block;height:100%;background:#0A4033}@page{size:A4;margin:12mm}@media print{.mc401-card,.mc402-daily-card{break-inside:avoid}.mc401-grid{grid-template-columns:repeat(2,1fr)}}`;
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية V402</title><style>${style}</style></head><body><header class="head"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div>يونيو 2026 — V402</div></div></div><div class="month"><small>الشهر</small><b>2026-06</b></div></header><section class="kpis"><div class="kpi"><small>المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${minsText(total)}</b></div></section><h2 class="section-title">مشاريع الزيارة اليومية</h2>${[...groups.entries()].map(([sup,list])=>dailySupervisorBox(sup,list)).join('')}<h2 class="section-title">مشاريع الدوام الكامل</h2><div class="mc401-grid">${full.map(fullCard).join('')}</div><script>setTimeout(()=>print(),500)<\/script></body></html>`;
    const w=window.open('','_blank');if(w){w.document.open();w.document.write(html);w.document.close();}
  }
  async function load(){try{const res=await fetch(DATA_URL,{cache:'no-store'});DATA=await res.json();}catch(e){console.error('V402 load failed',e);DATA=[];}render();}
  document.addEventListener('DOMContentLoaded',()=>{['mc401Show','mc401Supervisor','mc401Type','mc401Month'].forEach(id=>{const el=$(id);if(el)el.addEventListener('change',render);});$('mc401Show')?.addEventListener('click',render);$('mc401Print')?.addEventListener('click',printReport);$('mc401Export')?.addEventListener('click',csv);load();});
})();
