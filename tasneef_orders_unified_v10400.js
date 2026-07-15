/* Tasneef Orders Unified v10400
   المصدر الوحيد لقسم الأوردرات.
   - يحافظ على كل بيانات orders_shared القديمة دون حذف أو إعادة كتابة جماعية.
   - يمنع تشغيل سكربتات الأوردرات القديمة.
   - نوع الطلب: عميل داخلي / جمعية / أوردر خارجي.
   - منشئ الطلب والمعدل يسجلان تلقائياً من جلسة المستخدم.
   - تحقق إلزامي لاسم العميل ورقمه والوحدة والتفاصيل.
   - سجل تدقيق مستقل لكل إنشاء وتعديل.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersUnifiedV10400) return;
  window.__tasneefOrdersUnifiedV10400=true;

  const URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const AUDIT='order_audit_logs';
  const PAGE_SIZE=15;
  let rows=[], page=1, saving=false, editNo='';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const now=()=>new Date().toISOString();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const timeNow=()=>new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date());
  const notify=(t,type='ok')=>{ try{ if(typeof window.msg==='function') window.msg(t,type); else alert(t); }catch(_){ alert(t); } };
  const user=()=>{ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} };
  const userName=u=>S(u.name||u.full_name||u.display_name||u.username||u.email||'مستخدم النظام');
  const userRole=u=>S(u.role||u.type||u.user_role||'user');
  const orderNo=r=>S(r?.order_no||r?.data?.['رقم الطلب']||r?.data?.order_no||r?.id);
  const dataOf=r=>r&&r.data&&typeof r.data==='object'?r.data:r||{};
  const field=(r,...keys)=>{const d=dataOf(r); for(const k of keys){ if(d[k]!==undefined&&d[k]!==null&&S(d[k])!=='') return d[k]; } return '';};
  const num=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
  const money=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';

  async function api(path,opt={}){
    const res=await fetch(URL+path,{...opt,cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation,resolution=merge-duplicates',...(opt.headers||{})}});
    if(!res.ok) throw new Error((await res.text().catch(()=>''))||('HTTP '+res.status));
    const text=await res.text(); return text?JSON.parse(text):null;
  }
  function projects(){
    const list=(window.data&&Array.isArray(window.data.projects)?window.data.projects:[]);
    return list.map(p=>({id:S(p.id||p.project_id),name:S(p.name||p.project_name||p.official_name||p.client_name)})).filter(x=>x.name);
  }
  function employees(){
    const pools=[]; if(window.data){['users','workers','employees','supervisors','technicians'].forEach(k=>Array.isArray(window.data[k])&&pools.push(...window.data[k]));}
    const m=new Map(); pools.forEach(x=>{const name=S(x.name||x.full_name||x.worker_name||x.username); if(name)m.set(name,name);}); return [...m.values()].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function makeNo(){
    const max=rows.reduce((m,r)=>{const z=orderNo(r).match(/(\d+)/g); return Math.max(m,z?Number(z[z.length-1])||0:0);},0);
    return 'ORD-'+String(max+1).padStart(6,'0');
  }
  function stopLegacy(){
    ['__tasneefOrdersV233','__tasneefOrdersSharedSyncDisabled','__tasneefOrdersRootMasterV10031','__tasneefOrdersRootLockV10033','__tasneefOrdersMasterLockV10024','__tasneefOrdersStabilityPatchV10022','__tasneefOrdersFinalStabilityV10023','__tasneefOrdersRootCleanV10189','__tasneefSupervisorOrdersV10061'].forEach(k=>window[k]=true);
  }
  stopLegacy();

  function injectStyle(){ if($('ordersUnifiedStyle10400'))return; const st=document.createElement('style');st.id='ordersUnifiedStyle10400';st.textContent=`
  .ou-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ou-wide{grid-column:1/-1}.ou-required label:after{content:' *';color:#b42318}.ou-invalid{border-color:#d92d20!important;box-shadow:0 0 0 3px rgba(217,45,32,.12)!important}.ou-select{position:relative}.ou-note{background:#f3f8f6;border:1px solid #d7e7e0;padding:9px;border-radius:11px;color:#315d50}.ou-card{background:#fff;border:1px solid var(--line,#dce7e2);border-radius:17px;padding:13px;display:grid;gap:9px}.ou-head{display:flex;justify-content:space-between;gap:9px}.ou-head h3{margin:0;color:var(--brand,#075e4c)}.ou-chips{display:flex;gap:6px;flex-wrap:wrap}.ou-chip{padding:5px 9px;border-radius:999px;background:#edf7f3;color:#075e4c;font-size:12px;font-weight:800}.ou-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.ou-meta div{padding:8px;background:#f8fbfa;border-radius:10px}.ou-meta small{display:block;color:#6a7974}.ou-actions{display:flex;gap:7px;flex-wrap:wrap}.ou-history{display:grid;gap:8px}.ou-history article{padding:10px;border:1px solid #e0e9e5;border-radius:12px;background:#fbfdfc}.ou-modal{position:fixed;inset:0;background:rgba(0,35,28,.52);z-index:100000;display:grid;place-items:center;padding:16px}.ou-modal>div{width:min(900px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:16px}.ou-creator{font-weight:800;color:#075e4c}@media(max-width:800px){.ou-grid{grid-template-columns:1fr}.ou-wide{grid-column:auto}.ou-meta{grid-template-columns:1fr}}
  `;document.head.appendChild(st);}

  function optionList(id,values){let d=$(id);if(!d){d=document.createElement('datalist');d.id=id;document.body.appendChild(d);}d.innerHTML=[...new Set(values.filter(Boolean))].map(v=>`<option value="${E(v)}"></option>`).join('');}
  function rebuildAdmin(){
    const host=$('orderFormFieldsV233'); if(!host)return false;
    $('orderGroupNoV233')?.closest('.split')?.remove();
    const title=$('orderFormTitleV233'); if(title)title.textContent='إضافة أوردر';
    const note=host.parentElement?.querySelector('.footer-note'); if(note)note.textContent='منشئ الطلب ووقت الإنشاء يسجلان تلقائياً. لا يمكن الحفظ قبل إكمال البيانات الإلزامية.';
    host.className='ou-grid';
    host.innerHTML=`
      <div class="ou-required"><label>نوع الطلب</label><select id="ouType"><option value="">اختر النوع</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select></div>
      <div class="ou-required"><label>المشروع / الموقع</label><input id="ouProject" list="ouProjectsList" placeholder="اكتب للبحث أو اختر"></div>
      <div class="ou-required"><label>اسم العميل / المسؤول</label><input id="ouCustomer" list="ouCustomersList" placeholder="اسم العميل"></div>
      <div class="ou-required"><label>رقم العميل</label><input id="ouPhone" inputmode="tel" placeholder="05xxxxxxxx"></div>
      <div class="ou-required"><label>رقم الشقة / الوحدة / الموقع</label><input id="ouUnit" placeholder="مثال A-12 أو البيسمنت"></div>
      <div><label>المنفذ</label><input id="ouExecutor" list="ouEmployeesList" placeholder="اكتب للبحث"></div>
      <div><label>حالة التنفيذ</label><select id="ouStatus"><option>لم ينفذ</option><option>تحت التنفيذ</option><option>تم التنفيذ</option><option>ملغي</option></select></div>
      <div><label>حالة السداد</label><select id="ouPayment"><option value="">غير محدد</option><option>آجل</option><option>تم السداد</option><option>جزئي</option></select></div>
      <div><label>السعر شامل الضريبة</label><input id="ouPrice" type="number" min="0" step="0.01"></div>
      <div><label>التكلفة</label><input id="ouCost" type="number" min="0" step="0.01"></div>
      <div class="ou-wide ou-required"><label>تفاصيل الطلب</label><textarea id="ouDetails" rows="4" placeholder="اكتب وصف الطلب بوضوح"></textarea></div>
      <div class="ou-wide"><label>ملاحظات</label><textarea id="ouNotes" rows="2"></textarea></div>
      <div class="ou-wide ou-note">منشئ الطلب: <span id="ouCreator" class="ou-creator"></span></div>`;
    optionList('ouProjectsList',projects().map(x=>x.name)); optionList('ouEmployeesList',employees());
    const names=rows.map(r=>S(field(r,'اسم العميل','customer_name'))).filter(Boolean); optionList('ouCustomersList',names);
    $('ouCreator').textContent=userName(user());
    const search=$('orderSearchV233'); if(search)search.placeholder='بحث برقم الأوردر، النوع، المشروع، العميل، الجوال أو التفاصيل';
    const btn=host.parentElement?.querySelector('.actions button'); if(btn){btn.onclick=save;btn.textContent='حفظ الأوردر';}
    const newBtn=host.parentElement?.querySelectorAll('.actions button')[1]; if(newBtn)newBtn.onclick=clear;
    const delBtn=host.parentElement?.querySelectorAll('.actions button')[2]; if(delBtn)delBtn.onclick=deleteCurrent;
    return true;
  }
  function rebuildSupervisor(){
    const form=$('supOrderEditNoV10061')?.parentElement; if(!form)return false;
    const help=form.querySelector('.sup-help'); if(help)help.textContent='أنشئ الطلب بعد إكمال البيانات المطلوبة. اسم منشئ الطلب يسجل تلقائياً من حسابك.';
    const keepTitle=$('supOrderFormTitleV10061');
    form.innerHTML=`<h2 id="supOrderFormTitleV10061">رفع / تعديل أوردر</h2><div class="sup-help">منشئ الطلب يسجل تلقائياً ولا يمكن تغييره.</div><input type="hidden" id="supOrderEditNoV10061"><div class="ou-grid">
      <div class="ou-required"><label>نوع الطلب</label><select id="ouType"><option value="">اختر النوع</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select></div>
      <div class="ou-required"><label>المشروع / الموقع</label><input id="ouProject" list="ouProjectsList" placeholder="اكتب للبحث"></div>
      <div class="ou-required"><label>اسم العميل / المسؤول</label><input id="ouCustomer" list="ouCustomersList"></div>
      <div class="ou-required"><label>رقم العميل</label><input id="ouPhone" inputmode="tel"></div>
      <div class="ou-required"><label>رقم الشقة / الوحدة / الموقع</label><input id="ouUnit"></div>
      <div><label>حالة التنفيذ</label><select id="ouStatus"><option>لم ينفذ</option><option>تحت التنفيذ</option><option>تم التنفيذ</option><option>ملغي</option></select></div>
      <div class="ou-wide ou-required"><label>تفاصيل الطلب</label><textarea id="ouDetails"></textarea></div>
      <div class="ou-wide"><label>ملاحظات</label><textarea id="ouNotes"></textarea></div>
      <div class="ou-wide ou-note">منشئ الطلب: <span id="ouCreator" class="ou-creator"></span></div></div><div class="actions"><button id="ouSaveBtn">حفظ الأوردر</button><button class="light" id="ouNewBtn">أوردر جديد</button></div>`;
    optionList('ouProjectsList',projects().map(x=>x.name));optionList('ouEmployeesList',employees());optionList('ouCustomersList',rows.map(r=>S(field(r,'اسم العميل','customer_name'))));
    $('ouCreator').textContent=userName(user());$('ouSaveBtn').onclick=save;$('ouNewBtn').onclick=clear;return true;
  }

  function values(){
    return {type:S($('ouType')?.value),project:S($('ouProject')?.value),customer:S($('ouCustomer')?.value),phone:S($('ouPhone')?.value),unit:S($('ouUnit')?.value),executor:S($('ouExecutor')?.value),status:S($('ouStatus')?.value)||'لم ينفذ',payment:S($('ouPayment')?.value),price:num($('ouPrice')?.value),cost:num($('ouCost')?.value),details:S($('ouDetails')?.value),notes:S($('ouNotes')?.value)};
  }
  function validate(v){
    const required=[['ouType',v.type,'نوع الطلب'],['ouProject',v.project,'المشروع أو الموقع'],['ouCustomer',v.customer,'اسم العميل'],['ouPhone',v.phone,'رقم العميل'],['ouUnit',v.unit,'رقم الشقة أو الوحدة'],['ouDetails',v.details,'تفاصيل الطلب']];
    document.querySelectorAll('.ou-invalid').forEach(x=>x.classList.remove('ou-invalid'));
    const missing=required.filter(x=>!x[1]); missing.forEach(x=>$(x[0])?.classList.add('ou-invalid'));
    if(missing.length){notify('لا يمكن حفظ الطلب. أكمل: '+missing.map(x=>x[2]).join('، '),'err');$(missing[0][0])?.focus();return false;}
    if(!/^\+?[0-9\s-]{7,15}$/.test(v.phone)){ $('ouPhone')?.classList.add('ou-invalid'); notify('رقم العميل غير صحيح','err'); return false; }
    return true;
  }
  function toData(v,old={}){
    const u=user(), created=old.created_at||old['تاريخ الإنشاء']||now(), creator=old.created_by_name||old['منشئ الطلب']||userName(u);
    const before=v.price/1.15, vat=v.price-before, profit=before-v.cost;
    return {...old,
      order_type:v.type, 'نوع الطلب':v.type==='internal'?'عميل داخلي':v.type==='association'?'جمعية':'أوردر خارجي',
      project_name:v.project,'المشروع':v.project,customer_name:v.customer,'اسم العميل':v.customer,customer_phone:v.phone,'رقم العميل':v.phone,
      unit_number:v.unit,'رقم الشقة':v.unit,executor_name:v.executor,'المنفذ':v.executor,description:v.details,'التفاصيل':v.details,'ملاحظات':v.notes,
      status:v.status,'حالة التنفيذ':v.status,payment_status:v.payment,'حالة السداد':v.payment,
      'السعر (شامل الضريبة)':v.price,'الضريبة 15%':vat,'السعر قبل الضريبة':before,'التكلفة':v.cost,'الربح':profit,
      created_by_id:S(old.created_by_id||u.id||u.user_id||u.email),created_by_name:creator,created_by_role:S(old.created_by_role||userRole(u)),created_at:created,'منشئ الطلب':creator,
      updated_by_id:S(u.id||u.user_id||u.email),updated_by_name:userName(u),updated_by_role:userRole(u),updated_at:now(),'آخر تعديل بواسطة':userName(u)
    };
  }
  function diff(oldD,newD){
    const labels={order_type:'نوع الطلب',project_name:'المشروع',customer_name:'اسم العميل',customer_phone:'رقم العميل',unit_number:'رقم الشقة/الوحدة',executor_name:'المنفذ',description:'تفاصيل الطلب','ملاحظات':'الملاحظات',status:'حالة التنفيذ',payment_status:'حالة السداد','السعر (شامل الضريبة)':'السعر','التكلفة':'التكلفة'};
    return Object.keys(labels).filter(k=>S(oldD[k])!==S(newD[k])).map(k=>({field_name:k,field_label:labels[k],old_value:S(oldD[k]),new_value:S(newD[k])}));
  }
  async function audit(no,action,changes=[]){
    const u=user(); const items=changes.length?changes:[{field_name:'order',field_label:action==='create'?'إنشاء الطلب':'العملية',old_value:'',new_value:action}];
    const payload=items.map(c=>({order_no:no,action_type:action,...c,changed_by_id:S(u.id||u.user_id||u.email),changed_by_name:userName(u),changed_by_role:userRole(u),changed_at:now()}));
    try{await api('/rest/v1/'+AUDIT,{method:'POST',body:JSON.stringify(payload)});}catch(e){console.warn('تعذر حفظ سجل التدقيق',e);}
  }
  async function load(){
    try{rows=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=5000')||[]; render(); optionList('ouCustomersList',rows.map(r=>S(field(r,'اسم العميل','customer_name'))));}
    catch(e){notify('تعذر تحميل الأوردرات: '+e.message,'err');}
  }
  async function save(ev){
    ev?.preventDefault?.(); if(saving)return; const v=values(); if(!validate(v))return; saving=true;
    try{
      const current=editNo?rows.find(r=>orderNo(r)===editNo):null; const no=editNo||makeNo(); const oldD=current?dataOf(current):{}; const d=toData(v,oldD);
      d['رقم الطلب']=no; d.order_no=no; if(!oldD['تاريخ الطلب'])d['تاريخ الطلب']=today(); if(!oldD['وقت الطلب'])d['وقت الطلب']=timeNow(); d['مرسل الطلب']=d.created_by_name;
      await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify([{order_no:no,data:d,flow:current?.flow||{},updated_at:now()}])});
      await audit(no,current?'update':'create',current?diff(oldD,d):[]); notify(current?'تم تعديل الأوردر وتسجيل التغييرات':'تم إنشاء الأوردر وتسجيل المنشئ تلقائياً','ok'); clear(); await load();
    }catch(e){notify('فشل حفظ الأوردر: '+e.message,'err');}finally{saving=false;}
  }
  function clear(){editNo='';['ouType','ouProject','ouCustomer','ouPhone','ouUnit','ouExecutor','ouPayment','ouPrice','ouCost','ouDetails','ouNotes'].forEach(id=>{if($(id))$(id).value='';});if($('ouStatus'))$('ouStatus').value='لم ينفذ';if($('orderNoV233'))$('orderNoV233').value='';if($('orderFormTitleV233'))$('orderFormTitleV233').textContent='إضافة أوردر';if($('supOrderFormTitleV10061'))$('supOrderFormTitleV10061').textContent='رفع أوردر';document.querySelectorAll('.ou-invalid').forEach(x=>x.classList.remove('ou-invalid'));}
  function edit(idx){const r=rows[idx];if(!r)return;const d=dataOf(r);editNo=orderNo(r);const set=(id,v)=>{if($(id))$(id).value=S(v)};set('ouType',d.order_type||(/جمعية/.test(S(d['نوع الطلب']||d['تخص']))?'association':/خارجي/.test(S(d['نوع الطلب']))?'external':'internal'));set('ouProject',field(r,'project_name','المشروع'));set('ouCustomer',field(r,'customer_name','اسم العميل'));set('ouPhone',field(r,'customer_phone','رقم العميل'));set('ouUnit',field(r,'unit_number','رقم الشقة'));set('ouExecutor',field(r,'executor_name','المنفذ'));set('ouStatus',field(r,'status','حالة التنفيذ'));set('ouPayment',field(r,'payment_status','حالة السداد'));set('ouPrice',field(r,'السعر (شامل الضريبة)'));set('ouCost',field(r,'التكلفة'));set('ouDetails',field(r,'description','التفاصيل'));set('ouNotes',field(r,'ملاحظات'));if($('orderNoV233'))$('orderNoV233').value=editNo;if($('orderFormTitleV233'))$('orderFormTitleV233').textContent='تعديل أوردر '+editNo;if($('supOrderFormTitleV10061'))$('supOrderFormTitleV10061').textContent='تعديل أوردر '+editNo;window.scrollTo({top:0,behavior:'smooth'});}
  async function del(idx){const r=rows[idx];if(!r||!confirm('حذف الأوردر '+orderNo(r)+'؟'))return;try{await api('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(orderNo(r)),{method:'DELETE'});await audit(orderNo(r),'delete');notify('تم حذف الأوردر','ok');clear();await load();}catch(e){notify('تعذر الحذف: '+e.message,'err');}}
  function deleteCurrent(){const idx=rows.findIndex(r=>orderNo(r)===editNo);if(idx>=0)del(idx);else notify('اختر أوردر للتعديل أولاً','err');}
  function filterRows(){const q=S($('orderSearchV233')?.value||$('supOrderSearchV10061')?.value).toLowerCase(),pf=S($('orderProjectFilterV233')?.value||$('supOrderFilterProjectV10061')?.value),sf=S($('orderStatusFilterV233')?.value||$('supOrderFilterStatusV10061')?.value);return rows.filter(r=>{const d=dataOf(r);const text=Object.values(d).join(' ').toLowerCase();return(!q||text.includes(q)||orderNo(r).toLowerCase().includes(q))&&(!pf||S(field(r,'المشروع','project_name'))===pf)&&(!sf||S(field(r,'حالة التنفيذ','status'))===sf);});}
  function card(r,idx){const d=dataOf(r),type=S(d['نوع الطلب']||d.order_type||'-'),creator=S(d.created_by_name||d['منشئ الطلب']||d['مرسل الطلب']||'-');return `<article class="ou-card"><div class="ou-head"><div><h3>${E(orderNo(r))}</h3><small>${E(field(r,'تاريخ الطلب','created_at')||'-')}</small></div><span class="ou-chip">${E(type)}</span></div><div class="ou-chips"><span class="ou-chip">${E(field(r,'حالة التنفيذ','status')||'-')}</span><span class="ou-chip">${E(field(r,'حالة السداد','payment_status')||'غير محدد')}</span></div><div class="ou-meta"><div><small>المشروع</small><b>${E(field(r,'المشروع','project_name')||'-')}</b></div><div><small>العميل</small><b>${E(field(r,'اسم العميل','customer_name')||'-')}</b></div><div><small>الجوال</small><b>${E(field(r,'رقم العميل','customer_phone')||'-')}</b></div><div><small>الوحدة</small><b>${E(field(r,'رقم الشقة','unit_number')||'-')}</b></div><div><small>المنشئ</small><b>${E(creator)}</b></div><div><small>آخر تعديل</small><b>${E(d.updated_by_name||'-')}</b></div></div><p>${E(field(r,'التفاصيل','description')||'')}</p><div class="ou-actions"><button onclick="tasneefOrders10400.edit(${idx})">تعديل</button><button class="light" onclick="tasneefOrders10400.history('${E(orderNo(r))}')">سجل التعديلات</button><button class="danger" onclick="tasneefOrders10400.del(${idx})">حذف</button></div></article>`;}
  function render(){
    const list=filterRows(),pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));page=Math.min(page,pages);const slice=list.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    const admin=$('ordersCardsV360'); if(admin){admin.innerHTML=slice.map(r=>card(r,rows.indexOf(r))).join('')||'<div class="ou-note">لا توجد أوردرات</div>';const p=$('ordersPagerV360');if(p)p.innerHTML=`<button class="light" ${page<=1?'disabled':''} onclick="tasneefOrders10400.page(-1)">السابق</button><b>صفحة ${page} من ${pages} — ${list.length} نتيجة</b><button class="light" ${page>=pages?'disabled':''} onclick="tasneefOrders10400.page(1)">التالي</button>`;}
    const sup=$('supOrdersBodyV10061'); if(sup)sup.innerHTML=slice.map(r=>card(r,rows.indexOf(r))).join('')||'<div class="ou-note">لا توجد أوردرات</div>';
    if($('ordersTotalKpiV233'))$('ordersTotalKpiV233').textContent=list.length;if($('ordersDoneKpiV233'))$('ordersDoneKpiV233').textContent=list.filter(r=>/تم التنفيذ/.test(S(field(r,'حالة التنفيذ','status')))).length;if($('ordersDueKpiV233'))$('ordersDueKpiV233').textContent=list.filter(r=>/آجل|جزئي/.test(S(field(r,'حالة السداد','payment_status')))).length;if($('ordersProfitKpiV233'))$('ordersProfitKpiV233').textContent=money(list.reduce((a,r)=>a+num(field(r,'الربح')),0)).replace(' ر.س','');
    hydrateFilters();
  }
  function hydrateFilters(){const fill=(id,vals,first)=>{const el=$(id);if(!el)return;const cur=el.value;el.innerHTML=`<option value="">${first}</option>`+[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')).map(x=>`<option>${E(x)}</option>`).join('');el.value=cur;};fill('orderProjectFilterV233',rows.map(r=>S(field(r,'المشروع','project_name'))),'كل المشاريع');fill('orderStatusFilterV233',rows.map(r=>S(field(r,'حالة التنفيذ','status'))),'كل الحالات');fill('supOrderFilterProjectV10061',rows.map(r=>S(field(r,'المشروع','project_name'))),'كل المشاريع');fill('supOrderFilterStatusV10061',rows.map(r=>S(field(r,'حالة التنفيذ','status'))),'كل الحالات');}
  async function history(no){try{const h=await api('/rest/v1/'+AUDIT+'?order_no=eq.'+encodeURIComponent(no)+'&select=*&order=changed_at.desc');document.body.insertAdjacentHTML('beforeend',`<div class="ou-modal" onclick="if(event.target===this)this.remove()"><div><div class="ou-head"><h2>سجل تعديلات ${E(no)}</h2><button class="light" onclick="this.closest('.ou-modal').remove()">إغلاق</button></div><div class="ou-history">${(h||[]).map(x=>`<article><b>${E(x.changed_by_name||'-')}</b> — ${E(x.field_label||x.action_type||'-')}<br><small>${E(new Date(x.changed_at).toLocaleString('ar-SA',{hour12:true}))}</small><div>${E(x.old_value||'-')} ⟵ ${E(x.new_value||'-')}</div></article>`).join('')||'<div class="ou-note">لا توجد تعديلات مسجلة</div>'}</div></div></div>`);}catch(e){notify('شغّل ملف SQL الخاص بسجل التعديلات أولاً','err');}}
  function bind(){['orderSearchV233','orderProjectFilterV233','orderStatusFilterV233','supOrderSearchV10061','supOrderFilterProjectV10061','supOrderFilterStatusV10061'].forEach(id=>{const el=$(id);if(el&&!el.dataset.ouBound){el.dataset.ouBound='1';el.addEventListener('input',()=>{page=1;render()});el.addEventListener('change',()=>{page=1;render()});}});}
  function boot(){stopLegacy();injectStyle();const ok=rebuildAdmin()||rebuildSupervisor();if(!ok){setTimeout(boot,300);return;}bind();clear();load();setInterval(stopLegacy,2000);}
  window.tasneefOrders10400={load,save,edit,del,history,page:d=>{page=Math.max(1,page+Number(d||0));render()},clear,render};
  window.saveOrderV233=save;window.clearOrderFormV233=clear;window.deleteCurrentOrderV233=deleteCurrent;window.editOrderV233=edit;window.deleteOrderV233=del;window.renderOrdersV233=render;
  window.supOrdersSaveV10061=save;window.supOrdersClearV10061=clear;window.supOrdersRenderV10061=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
