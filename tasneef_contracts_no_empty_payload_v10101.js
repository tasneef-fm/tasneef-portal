/* Tasneef v10101 - Contracts Real Save + No Empty Overwrite
   Scope: قسم الخدمات والعقود فقط.
   - يحفظ حتى لو البيانات ناقصة، لكن لا يحفظ Payload فارغ فوق بيانات موجودة.
   - يعتمد على Supabase كمصدر أساسي، ويستخدم localStorage كنسخة احتياطية فقط.
   - لا يلمس المالية أو المخزون أو التكتات أو الأوقات الشهرية.
*/
(function(){
  'use strict';
  if(window.__tasneefContractsNoEmptyPayloadV10101) return;
  window.__tasneefContractsNoEmptyPayloadV10101 = true;

  const VERSION='v10101-contracts-real-save-no-empty-overwrite';
  const TABLE='project_contract_smart';
  const LS_KEY='tasneef_contract_smart_v299';
  const CORE=[
    {key:'elevators',label:'مصاعد'},
    {key:'pools',label:'مسابح'},
    {key:'civilDefense',label:'دفاع مدني'}
  ];
  const ANNUAL_OPTIONS=['غسيل خزانات علوية','غسيل خزانات أرضية','رش مبيدات','غسيل الأسطح','تنظيف الممرات','تنظيف المناور','تنظيف المكيفات','تنظيف غرفة المصاعد','غسيل المواقف','تنظيف عدسات الكاميرات','التعطير','خدمة أخرى'];

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const say=(t,type)=>{try{if(typeof window.msg==='function')return window.msg(t,type);}catch(_){ } alert(t);};
  const pidStr=v=>S(v);

  let activeProjectId='';
  const records=new Map();
  const loading=new Set();

  function emptyRecord(){
    const contracts={};
    CORE.forEach(x=>contracts[x.key]={onUs:false,company:'',phone:'',start:'',end:'',visits:0,done:[],notes:''});
    return {contracts,annual:[],association:{name:'',manager:'',phone:''},updated_at:null};
  }
  function normalize(raw){
    const base=emptyRecord(); raw=raw||{};
    const oldContracts=raw.contracts||raw.core||{};
    CORE.forEach(x=>{
      const r=oldContracts[x.key]||{};
      base.contracts[x.key]={
        onUs:!!(r.onUs??r.on_us),
        company:S(r.company||r.company_name),
        phone:S(r.phone||r.company_phone),
        start:S(r.start||r.from||r.contract_start),
        end:S(r.end||r.to||r.contract_end),
        visits:Math.max(0,N(r.visits||r.visit_count)),
        done:A(r.done).map(Number).filter(Boolean),
        notes:S(r.notes)
      };
    });
    base.annual=A(raw.annual).map(a=>({
      id:S(a.id)||('a'+Date.now()+Math.random().toString(16).slice(2)),
      name:S(a.name),
      visits:Math.max(1,N(a.visits||a.visit_count||1)),
      done:A(a.done).map(Number).filter(Boolean),
      notes:S(a.notes)
    })).filter(a=>a.name);
    const assoc=raw.association||raw.assoc||{};
    base.association={name:S(assoc.name||raw.assoc_name),manager:S(assoc.manager||raw.assoc_manager),phone:S(assoc.phone||raw.assoc_phone)};
    base.updated_at=raw.updated_at||null;
    return base;
  }
  function readLS(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{};}catch(_){return {};}}
  function writeOneLS(projectId, rec){const all=readLS(); all[pidStr(projectId)]=normalize(rec); try{localStorage.setItem(LS_KEY,JSON.stringify(all));}catch(_){}}
  function localRecord(projectId){return normalize(readLS()[pidStr(projectId)]||{});}
  function setRecord(projectId, rec){const clean=normalize(rec); records.set(pidStr(projectId),clean); writeOneLS(projectId,clean); return clean;}
  function getRecord(projectId){return normalize(records.get(pidStr(projectId))||localRecord(projectId));}

  function hasUsefulData(rec){
    rec=normalize(rec);
    const hasCore=CORE.some(x=>{const r=rec.contracts[x.key]||{}; return r.onUs||r.company||r.phone||r.start||r.end||N(r.visits)||r.done.length||r.notes;});
    const hasAnnual=A(rec.annual).some(a=>a.name||N(a.visits)>1||A(a.done).length||a.notes);
    const hasAssoc=!!(rec.association?.name||rec.association?.manager||rec.association?.phone);
    return hasCore||hasAnnual||hasAssoc;
  }
  async function fetchRemote(projectId){
    const c=client(); if(!c) return null;
    const res=await c.from(TABLE).select('project_id,payload,updated_at').eq('project_id',pidStr(projectId)).maybeSingle();
    if(res.error) throw new Error(res.error.message||'فشل قراءة بيانات العقود');
    if(!res.data) return null;
    const rec=normalize(res.data.payload||{}); rec.updated_at=res.data.updated_at||rec.updated_at; return rec;
  }
  async function upsertRemote(projectId, rec){
    const c=client(); if(!c) throw new Error('Supabase غير متصل، لا يمكن الحفظ.');
    const payload=normalize({...rec,updated_at:new Date().toISOString()});
    const res=await c.from(TABLE).upsert({project_id:pidStr(projectId),payload,updated_at:new Date().toISOString()},{onConflict:'project_id'}).select('project_id,payload,updated_at').maybeSingle();
    if(res.error) throw new Error(res.error.message||'فشل الحفظ في Supabase');
    if(!res.data) throw new Error('لم يرجع Supabase تأكيد الحفظ.');
    const saved=normalize(res.data.payload||payload); saved.updated_at=res.data.updated_at||saved.updated_at; return saved;
  }
  function fillAnnualSelect(){
    const s=$('csAnnualSelect'); if(!s) return;
    s.innerHTML=ANNUAL_OPTIONS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  }
  function projectName(projectId){
    const p=A(window.data?.projects).find(x=>S(x.id)===S(projectId));
    return p?.name||'';
  }
  function visitChips(kind,key,visits,done){
    visits=Math.max(0,N(visits)); done=new Set(A(done).map(Number));
    if(!visits) return '<div class="contract-empty-v10">حدد عدد الزيارات حتى تظهر الأرقام.</div>';
    return Array.from({length:visits},(_,i)=>{const no=i+1; return `<button type="button" class="visit-chip-v10 ${done.has(no)?'done':''}" onclick="${kind}('${esc(key)}',${no})">${no}</button>`;}).join('');
  }
  function renderCore(rec){
    const box=$('contractCoreServices'); if(!box) return;
    box.classList.remove('three'); box.classList.add('contract-grid-v10');
    box.innerHTML=CORE.map(item=>{const r=rec.contracts[item.key]||{}; return `<section class="contract-card-v10 ${r.onUs?'on-us':''}" data-v10-contract="${esc(item.key)}">
      <div class="contract-card-head-v10"><h3>${esc(item.label)}</h3><label class="contract-switch-v10"><input type="checkbox" data-field="onUs" ${r.onUs?'checked':''}><span>العقد علينا</span></label></div>
      <div class="contract-fields-v10 ${r.onUs?'':'muted-off'}">
        <div><label>اسم الشركة</label><input data-field="company" value="${esc(r.company)}"></div>
        <div><label>رقم الشركة</label><input data-field="phone" value="${esc(r.phone)}"></div>
        <div><label>من تاريخ</label><input type="date" data-field="start" value="${esc(r.start)}"></div>
        <div><label>إلى تاريخ</label><input type="date" data-field="end" value="${esc(r.end)}"></div>
        <div><label>عدد الزيارات</label><input type="number" min="0" data-field="visits" value="${esc(r.visits)}"></div>
        <div><label>ملاحظات</label><input data-field="notes" value="${esc(r.notes)}"></div>
      </div>
      <div class="visit-row-v10">${visitChips('contractV10101ToggleCoreVisit',item.key,r.visits,r.done)}</div>
    </section>`;}).join('');
    box.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('change',()=>{ const now=collectFromDom(); setRecord(activeProjectId,now); renderReport(now); });
      inp.addEventListener('input',()=>{ const now=collectFromDom(); records.set(pidStr(activeProjectId),now); });
    });
  }
  function renderAnnual(rec){
    fillAnnualSelect();
    const body=$('csAnnualBody'); if(!body) return;
    body.innerHTML=A(rec.annual).map(item=>{const done=A(item.done); return `<tr data-v10101-annual="${esc(item.id)}"><td><b>${esc(item.name)}</b>${item.notes?`<br><small>${esc(item.notes)}</small>`:''}</td><td>${N(item.visits)}</td><td><div class="visit-row-v10">${visitChips('contractV10101ToggleAnnualVisit',item.id,item.visits,done)}</div></td><td>${done.length}</td><td>${Math.max(0,N(item.visits)-done.length)}</td><td><button class="danger" onclick="contractV10101DeleteAnnual('${esc(item.id)}')">حذف</button></td></tr>`;}).join('')||'<tr><td colspan="6">لا توجد خدمات سنوية بعد</td></tr>';
  }
  function renderAssociation(rec){
    if($('csAssocName')) $('csAssocName').value=rec.association?.name||'';
    if($('csAssocManager')) $('csAssocManager').value=rec.association?.manager||'';
    if($('csAssocPhone')) $('csAssocPhone').value=rec.association?.phone||'';
  }
  function collectFromDom(){
    const old=getRecord(activeProjectId);
    const rec=normalize(old);
    CORE.forEach(item=>{
      const card=document.querySelector(`[data-v10-contract="${item.key}"]`);
      const prev=rec.contracts[item.key]||{};
      if(card){
        const visits=Math.max(0,N(card.querySelector('[data-field="visits"]')?.value));
        rec.contracts[item.key]={
          onUs:!!card.querySelector('[data-field="onUs"]')?.checked,
          company:S(card.querySelector('[data-field="company"]')?.value),
          phone:S(card.querySelector('[data-field="phone"]')?.value),
          start:S(card.querySelector('[data-field="start"]')?.value),
          end:S(card.querySelector('[data-field="end"]')?.value),
          visits,
          done:A(prev.done).map(Number).filter(x=>x>0&&x<=visits),
          notes:S(card.querySelector('[data-field="notes"]')?.value)
        };
      }
    });
    rec.association={name:S($('csAssocName')?.value),manager:S($('csAssocManager')?.value),phone:S($('csAssocPhone')?.value)};
    return rec;
  }
  function renderReport(rec){
    const box=$('csClientReportBox'); if(!box) return;
    const coreRows=CORE.map(item=>{const r=rec.contracts[item.key]||{}; if(!hasUsefulData({contracts:{[item.key]:r},annual:[]})) return ''; return `<tr><td>${esc(item.label)}</td><td>${esc(r.company||'-')}</td><td>${esc(r.phone||'-')}</td><td>${esc(r.start||'-')}</td><td>${esc(r.end||'-')}</td><td>${A(r.done).length} / ${N(r.visits)}</td></tr>`;}).filter(Boolean).join('');
    const annualRows=A(rec.annual).map(a=>`<tr><td>${esc(a.name)}</td><td colspan="4">خدمة سنوية</td><td>${A(a.done).length} / ${N(a.visits)}</td></tr>`).join('');
    box.innerHTML=`<div class="smart-box"><b>المشروع:</b> ${esc(projectName(activeProjectId)||'-')}</div><table class="smart-report-table"><thead><tr><th>القسم / الخدمة</th><th>الشركة</th><th>رقم الشركة</th><th>من</th><th>إلى</th><th>التنفيذ</th></tr></thead><tbody>${coreRows||'<tr><td colspan="6">لا توجد عقود مسجلة</td></tr>'}${annualRows}</tbody></table>`;
  }
  function renderAll(rec){
    rec=normalize(rec); setRecord(activeProjectId,rec);
    renderAssociation(rec); renderCore(rec); renderAnnual(rec); renderReport(rec);
  }

  const previousOpen=window.openContractSmartModal;
  window.openContractSmartModal=async function(projectId,mode){
    activeProjectId=pidStr(projectId);
    if($('contractSmartProjectId')) $('contractSmartProjectId').value=activeProjectId;
    if(previousOpen) await previousOpen.apply(this,arguments);
    try{
      if(!loading.has(activeProjectId)){
        loading.add(activeProjectId);
        const remote=await fetchRemote(activeProjectId);
        loading.delete(activeProjectId);
        renderAll(remote||getRecord(activeProjectId));
      }else renderAll(getRecord(activeProjectId));
    }catch(e){
      loading.delete(activeProjectId);
      console.warn(VERSION,e);
      renderAll(getRecord(activeProjectId));
      say('تعذر قراءة بيانات الخدمات والعقود من Supabase: '+(e.message||e),'err');
    }
  };
  window.contractV10101ToggleCoreVisit=function(key,no){
    const rec=collectFromDom(); const row=rec.contracts[key]; if(!row) return;
    const set=new Set(A(row.done).map(Number)); no=Number(no); if(set.has(no)) set.delete(no); else set.add(no);
    row.done=[...set].sort((a,b)=>a-b); renderAll(rec);
  };
  window.addContractAnnualService=function(){
    if(!activeProjectId) activeProjectId=pidStr($('contractSmartProjectId')?.value);
    const rec=collectFromDom(); let name=S($('csAnnualSelect')?.value); const custom=S($('csAnnualCustom')?.value); if(custom) name=custom;
    const visits=Math.max(1,N($('csAnnualVisits')?.value||1));
    if(!name){say('اختر الخدمة أو اكتب اسمها','err'); return;}
    rec.annual.push({id:'a'+Date.now()+Math.random().toString(16).slice(2),name,visits,done:[],notes:''});
    if($('csAnnualCustom')) $('csAnnualCustom').value=''; if($('csAnnualVisits')) $('csAnnualVisits').value='1'; renderAll(rec);
  };
  window.contractV10101ToggleAnnualVisit=function(id,no){
    const rec=collectFromDom(); const item=A(rec.annual).find(x=>S(x.id)===S(id)); if(!item) return;
    const set=new Set(A(item.done).map(Number)); no=Number(no); if(set.has(no)) set.delete(no); else set.add(no);
    item.done=[...set].sort((a,b)=>a-b); renderAll(rec);
  };
  window.contractV10101DeleteAnnual=function(id){
    if(!confirm('حذف هذه الخدمة السنوية؟')) return;
    const rec=collectFromDom(); rec.annual=A(rec.annual).filter(x=>S(x.id)!==S(id)); renderAll(rec);
  };
  // توافق مع أزرار قديمة لو بقيت في الصفحة
  window.contractV10ToggleCoreVisit=window.contractV10101ToggleCoreVisit;
  window.contractV10ToggleAnnualVisit=window.contractV10101ToggleAnnualVisit;
  window.contractV10DeleteAnnual=window.contractV10101DeleteAnnual;

  window.saveContractSmartModal=async function(){
    const projectId=pidStr($('contractSmartProjectId')?.value||activeProjectId);
    if(!projectId){say('لم يتم تحديد المشروع، لا يمكن الحفظ.','err'); return;}
    activeProjectId=projectId;
    const btn=$('contractSmartSaveBtn'); const oldText=btn?btn.textContent:'';
    try{
      if(btn){btn.disabled=true; btn.textContent='جاري الحفظ...';}
      const newRec=collectFromDom();
      const remote=await fetchRemote(projectId).catch(()=>null);
      if(!hasUsefulData(newRec) && hasUsefulData(remote)){
        throw new Error('تم منع حفظ سجل فارغ فوق بيانات محفوظة. افتح المشروع مرة أخرى ثم عدّل البيانات.');
      }
      if(!hasUsefulData(newRec)){
        throw new Error('لا توجد بيانات للحفظ. أدخل أي بيانات في العقود أو الخدمات السنوية أولاً.');
      }
      const saved=await upsertRemote(projectId,newRec);
      setRecord(projectId,saved);
      renderAll(saved);
      say('تم حفظ الخدمات والعقود في Supabase بنجاح','ok');
      try{ if(typeof window.renderContracts==='function') window.renderContracts(); }catch(_){ }
      try{ if(typeof window.renderSmartAlerts==='function') window.renderSmartAlerts(); }catch(_){ }
    }catch(e){
      console.error(VERSION,e);
      say('فشل حفظ الخدمات والعقود: '+(e.message||e),'err');
    }finally{
      if(btn){btn.disabled=false; btn.textContent=oldText||'حفظ';}
    }
  };

  async function boot(){
    try{
      const c=client(); if(!c) return;
      const res=await c.from(TABLE).select('project_id,payload,updated_at').limit(10000);
      if(res.error) throw new Error(res.error.message);
      A(res.data).forEach(row=>{ if(S(row.project_id)) setRecord(row.project_id,row.payload||{}); });
    }catch(e){ console.warn(VERSION,e); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1200),{once:true}); else setTimeout(boot,1200);
  window.addEventListener('load',()=>setTimeout(boot,1800),{once:true});
  console.log('Loaded '+VERSION);
})();
