/* Tasneef v10187 - Orders System Projects + Receipt Attachment
   Scope: ORDERS ONLY
   - يحصر مشروع الأوردر في مشاريع النظام فقط.
   - يحول خانة المشروع في نموذج الأوردر إلى خانة كتابة ذكية بنفس شكل الحقول.
   - يضيف إرفاق الإيصال ويحفظه داخل data في orders_shared بدون أعمدة جديدة.
   - لا يلمس المالية، التكتات، العقود، المهام أو أي قسم آخر.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersSystemProjectsOnlyV10187) return;
  window.__tasneefOrdersSystemProjectsOnlyV10187 = true;

  const VERSION='v10187-orders-system-projects-receipt';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const ORDERS_TABLE='orders_shared';
  const MAX_RECEIPT_BYTES=3.5*1024*1024;
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>S(v).replace(/[\u0640]/g,'').replace(/\s+/g,' ').trim();
  const lower=v=>norm(v).toLowerCase();
  const $=id=>document.getElementById(id);

  let projectsCache=[];
  let projectsLoading=null;
  let receiptObject=null;
  let saveRunning=false;

  function fieldId(header){
    try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}
    catch(_){return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  }
  function unique(arr){
    const out=[], seen=new Set();
    A(arr).forEach(v=>{v=norm(v); const k=lower(v); if(v&&!seen.has(k)){seen.add(k); out.push(v);}});
    return out.sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function headers(extra={}){return Object.assign({apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json'},extra||{});}
  async function api(path,opt={}){
    const res=await fetch(SUPABASE_URL+path,Object.assign({cache:'no-store',headers:headers({'Content-Type':'application/json'})},opt||{}));
    const text=await res.text(); let data=null; try{data=text?JSON.parse(text):null;}catch(_){data=text;}
    if(!res.ok) throw new Error((data&&data.message)||text||('HTTP '+res.status));
    return data;
  }
  function localProjectNames(){
    const d=window.data||{};
    let names=A(d.projects).map(p=>p.name||p.project_name||p.title||p.project||p.label);
    ['tasneef_projects','projects','tasneef_data','tasneef_app_data'].forEach(k=>{
      try{
        const raw=localStorage.getItem(k); if(!raw) return;
        const obj=JSON.parse(raw); const arr=Array.isArray(obj)?obj:A(obj.projects);
        names=names.concat(arr.map(p=>p.name||p.project_name||p.title||p.project||p.label));
      }catch(_){ }
    });
    return unique(names);
  }
  async function fetchProjects(){
    if(projectsLoading) return projectsLoading;
    projectsLoading=(async()=>{
      try{
        const rows=await api('/rest/v1/projects?select=*&order=id.asc&limit=10000',{method:'GET',headers:headers()});
        const names=unique(A(rows).filter(p=>{
          const deleted=S(p.deleted_at||p.is_deleted||'');
          return !(deleted && deleted!=='false' && deleted!=='0');
        }).map(p=>p.name||p.project_name||p.title||p.project||p.label));
        projectsCache=names.length?names:localProjectNames();
      }catch(e){
        console.warn(VERSION,'projects fetch failed, fallback local',e);
        projectsCache=localProjectNames();
      }
      projectsLoading=null;
      return projectsCache;
    })();
    return projectsLoading;
  }
  function projectAllowed(v){
    v=lower(v); if(!v) return true;
    return projectsCache.some(p=>lower(p)===v);
  }
  function fillDatalist(values){
    const id='ordersSystemProjectsListV10187';
    let dl=$(id); if(!dl){dl=document.createElement('datalist'); dl.id=id; document.body.appendChild(dl);}
    dl.innerHTML=unique(values).map(v=>'<option value="'+esc(v)+'"></option>').join('');
    return id;
  }
  function replaceProjectFieldWithSearch(el, values){
    if(!el) return null;
    const listId=fillDatalist(values);
    if(el.tagName==='INPUT'){
      el.setAttribute('list',listId);
      el.placeholder='اكتب اسم المشروع أو اختر من القائمة';
      el.dataset.systemProjectsOnly='v10187';
      return el;
    }
    if(el.tagName==='SELECT'){
      const input=document.createElement('input');
      input.id=el.id;
      input.name=el.name||el.id;
      input.className=el.className;
      input.value=S(el.value);
      input.placeholder='اكتب اسم المشروع أو اختر من القائمة';
      input.setAttribute('list',listId);
      input.dataset.systemProjectsOnly='v10187';
      el.replaceWith(input);
      return input;
    }
    return el;
  }
  function setFilterOptions(el, values, placeholder){
    if(!el || el.tagName!=='SELECT') return;
    const old=S(el.value); const vals=unique(values); const allowed=new Set(vals.map(lower));
    el.innerHTML='<option value="">'+esc(placeholder||'كل المشاريع')+'</option>'+vals.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
    if(old && allowed.has(lower(old))) el.value=old;
  }
  function orderProjectField(){return $(fieldId('المشروع'))||null;}
  function hydrateProjects(values){
    if(!values.length) return;
    const f=orderProjectField();
    const input=replaceProjectFieldWithSearch(f,values);
    if(input && !input.__projectsOnlyV10187){
      input.__projectsOnlyV10187=true;
      input.addEventListener('input',()=>{ input.dataset.validProject = projectAllowed(input.value)?'1':'0'; });
      input.addEventListener('blur',()=>{
        const v=norm(input.value); if(v && !projectAllowed(v)){ alert('المشروع غير موجود في النظام. اختر مشروعًا من قائمة المشاريع فقط.'); input.value=''; }
      });
    }
    setFilterOptions($('orderProjectFilterV233'),values,'كل المشاريع');
    const sup=$('supOrderProjectV10061'); if(sup) replaceProjectFieldWithSearch(sup,values);
    setFilterOptions($('supOrderFilterProjectV10061'),values,'كل المشاريع');
  }
  async function enforceProjects(){const vals=await fetchProjects(); hydrateProjects(vals); return vals;}
  function validateProjectBeforeSave(){
    const el=orderProjectField();
    if(!el) return true;
    const v=norm(el.value);
    if(!v) return true;
    if(projectAllowed(v)) return true;
    alert('المشروع غير موجود في النظام. اختر مشروعًا من قائمة المشاريع فقط.');
    try{el.focus();}catch(_){ }
    return false;
  }

  function ensureReceiptUi(){
    const formFields=$('orderFormFieldsV233');
    if(!formFields || $('orderReceiptBoxV10187')) return;
    const hiddenId=fieldId('إرفاق الإيصال');
    const box=document.createElement('div');
    box.id='orderReceiptBoxV10187';
    box.className='order-receipt-box-v10187';
    box.innerHTML=`<label>إرفاق الإيصال</label>
      <input id="orderReceiptFileV10187" type="file" accept="image/*,.pdf">
      <input id="${hiddenId}" type="hidden">
      <div id="orderReceiptPreviewV10187" class="order-receipt-preview-v10187">لم يتم اختيار إيصال</div>`;
    formFields.appendChild(box);
    const file=$('orderReceiptFileV10187');
    if(file && !file.__receiptV10187){
      file.__receiptV10187=true;
      file.addEventListener('change',readReceiptFile);
    }
  }
  function readReceiptFile(){
    const file=$('orderReceiptFileV10187')?.files?.[0]||null;
    const out=$('orderReceiptPreviewV10187');
    receiptObject=null;
    const hid=$(fieldId('إرفاق الإيصال')); if(hid) hid.value='';
    if(!file){ if(out) out.textContent='لم يتم اختيار إيصال'; return; }
    if(file.size>MAX_RECEIPT_BYTES){ alert('حجم الإيصال كبير. يفضل ألا يتجاوز 3.5 ميجا حتى لا يبطئ حفظ الأوردر.'); $('orderReceiptFileV10187').value=''; if(out) out.textContent='لم يتم اختيار إيصال'; return; }
    const r=new FileReader();
    r.onload=()=>{
      receiptObject={name:file.name,type:file.type||'file',size:file.size,dataUrl:String(r.result||''),uploaded_at:new Date().toISOString()};
      if(hid) hid.value=JSON.stringify({name:receiptObject.name,type:receiptObject.type,size:receiptObject.size,uploaded_at:receiptObject.uploaded_at});
      if(out) out.innerHTML='تم اختيار الإيصال: <b>'+esc(file.name)+'</b>';
    };
    r.readAsDataURL(file);
  }
  function currentOrderNo(){ return S($('orderNoV233')?.value||''); }
  async function fetchOrder(no){
    no=S(no); if(!no) return null;
    const rows=await api('/rest/v1/'+ORDERS_TABLE+'?select=order_no,data,flow&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET',headers:headers()});
    return A(rows)[0]||null;
  }
  async function saveReceiptForOrder(no){
    if(!receiptObject || !no) return;
    try{
      const rec=await fetchOrder(no); if(!rec) return;
      const data=Object.assign({},rec.data||{});
      data['إرفاق الإيصال']={name:receiptObject.name,type:receiptObject.type,size:receiptObject.size,uploaded_at:receiptObject.uploaded_at,dataUrl:receiptObject.dataUrl};
      data.receipt_attachment=data['إرفاق الإيصال'];
      data.receipt_name=receiptObject.name;
      await api('/rest/v1/'+ORDERS_TABLE+'?on_conflict=order_no',{method:'POST',headers:headers({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({order_no:no,data,flow:rec.flow||{},updated_at:new Date().toISOString(),updated_by:VERSION})});
      receiptObject=null;
      const file=$('orderReceiptFileV10187'); if(file) file.value='';
      const out=$('orderReceiptPreviewV10187'); if(out) out.textContent='تم حفظ الإيصال داخل الأوردر';
    }catch(e){
      console.warn(VERSION,'receipt save failed',e);
      alert('تم حفظ الأوردر، لكن لم يتم حفظ الإيصال: '+(e.message||e));
    }
  }
  function patchSave(){
    const old=window.saveOrderV233;
    if(typeof old!=='function' || old.__ordersV10187) return;
    window.saveOrderV233=async function(){
      if(saveRunning) return;
      saveRunning=true;
      try{
        await enforceProjects();
        ensureReceiptUi();
        if(!validateProjectBeforeSave()) return;
        const before=currentOrderNo();
        const ret=await old.apply(this,arguments);
        setTimeout(async()=>{
          const no=currentOrderNo()||before;
          await saveReceiptForOrder(no);
        },350);
        return ret;
      }finally{ saveRunning=false; }
    };
    window.saveOrderV233.__ordersV10187=true;
  }
  function patchRender(){
    const oldRender=window.renderOrdersV233;
    if(typeof oldRender==='function' && !oldRender.__ordersV10187){
      window.renderOrdersV233=function(){
        const r=oldRender.apply(this,arguments);
        setTimeout(()=>{ensureReceiptUi();enforceProjects();addReceiptButtonsToCards();},120);
        return r;
      };
      window.renderOrdersV233.__ordersV10187=true;
    }
    const oldClear=window.clearOrderFormV233;
    if(typeof oldClear==='function' && !oldClear.__ordersV10187){
      window.clearOrderFormV233=function(){
        const r=oldClear.apply(this,arguments);
        receiptObject=null;
        setTimeout(()=>{ensureReceiptUi(); enforceProjects(); const out=$('orderReceiptPreviewV10187'); if(out) out.textContent='لم يتم اختيار إيصال';},80);
        return r;
      };
      window.clearOrderFormV233.__ordersV10187=true;
    }
    const oldShow=window.showPage;
    if(typeof oldShow==='function' && !oldShow.__ordersV10187){
      window.showPage=function(id,btn){
        const r=oldShow.apply(this,arguments);
        if(id==='orders'||id==='ordersPage'||id==='ordersRoot') setTimeout(()=>{ensureReceiptUi();enforceProjects();patchSave();patchRender();},150);
        return r;
      };
      window.showPage.__ordersV10187=true;
    }
  }
  function cardOrderNo(card){
    const txt=S(card.textContent);
    let m=txt.match(/ORD[-\s]?\d{3,}|\b\d{3,}\b/); return m?m[0]:'';
  }
  async function openReceiptForOrder(no){
    try{
      const rec=await fetchOrder(no); const d=rec&&rec.data||{}; const r=d['إرفاق الإيصال']||d.receipt_attachment;
      if(!r||!r.dataUrl){ alert('لا يوجد إيصال محفوظ لهذا الأوردر'); return; }
      const w=window.open('', '_blank');
      if(!w){ alert('اسمح بالنوافذ المنبثقة لعرض الإيصال'); return; }
      if(/^data:application\/pdf/i.test(r.dataUrl)){
        w.document.write('<iframe src="'+r.dataUrl+'" style="width:100%;height:100vh;border:0"></iframe>');
      }else{
        w.document.write('<img src="'+r.dataUrl+'" style="max-width:100%;height:auto;display:block;margin:auto">');
      }
      w.document.title=r.name||'إيصال الأوردر';
    }catch(e){ alert(e.message||String(e)); }
  }
  function addReceiptButtonsToCards(){
    document.querySelectorAll('#ordersCardsV360 > *').forEach(card=>{
      if(card.querySelector('.order-receipt-btn-v10187')) return;
      const no=cardOrderNo(card); if(!no) return;
      const btn=document.createElement('button');
      btn.type='button'; btn.className='light order-receipt-btn-v10187'; btn.textContent='عرض الإيصال';
      btn.style.marginInlineStart='6px';
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();openReceiptForOrder(no);};
      const host=card.querySelector('.actions,.row-actions')||card;
      host.appendChild(btn);
    });
  }
  function style(){
    if($('ordersV10187Style')) return;
    const st=document.createElement('style'); st.id='ordersV10187Style'; st.textContent=`
      #orderReceiptBoxV10187{grid-column:1/-1;background:#f8fbfa;border:1px dashed #b9d8ca;border-radius:14px;padding:10px}
      #orderReceiptFileV10187{background:#fff}.order-receipt-preview-v10187{margin-top:7px;color:#60706a;font-size:12px}
      input[data-system-projects-only="v10187"]{background:#fff!important}
    `; document.head.appendChild(st);
  }
  function init(){
    style(); ensureReceiptUi(); patchSave(); patchRender(); enforceProjects(); addReceiptButtonsToCards();
    [300,900,1800,3500].forEach(t=>setTimeout(()=>{style();ensureReceiptUi();patchSave();patchRender();enforceProjects();addReceiptButtonsToCards();},t));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.addEventListener('load',()=>setTimeout(init,500),{once:true});
  console.log('Loaded '+VERSION);
})();
