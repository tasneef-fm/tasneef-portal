/* Tasneef v10142 - Orders final base fix
   Scope: قسم الأوردرات فقط
   - إزالة خانة الإيصال المكررة إن وجدت.
   - استخدام خانة الإيصال الأصلية فقط مع زر عرض الإيصال.
   - حفظ وتعديل الأوردرات مباشرة في Supabase بدون updated_by وبدون مصادر قديمة.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersFinalCoreV10142) return;
  window.__tasneefOrdersFinalCoreV10142=true;

  const VERSION='v10142_orders_final_core';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const RECEIPT_KEY='__tasneef_order_receipt_v10140';
  const RECEIPT_NAME_KEY='الإيصال';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const normalizeNo=v=>S(v).replace(/\s+/g,'').toUpperCase();
  const nowIso=()=>new Date().toISOString();
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const receiptCache=new Map();

  // آخر حماية: أي طلب كتابة إلى orders_shared لا يرسل updated_by نهائياً.
  if(!window.__tasneefOrdersFinalFetchPatchV10142){
    window.__tasneefOrdersFinalFetchPatchV10142=true;
    const rawFetch=window.fetch.bind(window);
    window.fetch=function(input, init){
      try{
        const url=typeof input==='string'?input:(input&&input.url)||'';
        const method=String((init&&init.method)||'GET').toUpperCase();
        if(/\/rest\/v1\/orders_shared/i.test(url) && ['POST','PATCH','PUT'].includes(method) && init && init.body){
          const clean=o=>{ if(o&&typeof o==='object'){ delete o.updated_by; delete o.source; delete o.created_by; } return o; };
          const body=JSON.parse(init.body);
          const next=Array.isArray(body)?body.map(clean):clean(body);
          init=Object.assign({},init,{body:JSON.stringify(next)});
        }
      }catch(_){ }
      return rawFetch(input, init);
    };
  }

  async function api(path, options){
    const res=await fetch(SUPABASE_URL+path, Object.assign({
      cache:'no-store',
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:'Bearer '+SUPABASE_ANON_KEY,
        Accept:'application/json',
        'Content-Type':'application/json',
        Prefer:'return=representation'
      }
    }, options||{}));
    if(!res.ok){
      const txt=await res.text().catch(()=>String(res.status));
      throw new Error(txt||String(res.status));
    }
    if(res.status===204) return [];
    return res.json().catch(()=>[]);
  }

  function removeDuplicateReceiptBox(){
    document.querySelectorAll('#ordersReceiptBoxV10138,#ordersReceiptFallbackV10139,.orders-receipt-base-v10138').forEach(el=>el.remove());
    // لو بقي أكثر من input يحمل نفس id بسبب النسخ السابقة، نترك الأول ونحذف الباقي.
    const inputs=[...document.querySelectorAll('input#orderReceiptFileV233')];
    inputs.slice(1).forEach(el=>{ const box=el.closest('.orders-receipt-base-v10138')||el.parentElement; if(box) box.remove(); else el.remove(); });
  }

  function labelTextFor(el){
    if(!el) return '';
    let parts=[];
    if(el.id){
      try{ const lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(lab) parts.push(lab.textContent); }catch(_){ }
    }
    let p=el.parentElement;
    for(let i=0;p&&i<3;i++,p=p.parentElement){
      const lab=p.querySelector(':scope > label'); if(lab) parts.push(lab.textContent);
      const t=S(p.textContent); if(t) parts.push(t.slice(0,80));
    }
    return S(parts.join(' '));
  }

  function receiptInput(){
    removeDuplicateReceiptBox();
    const form=$('orderFormFieldsV233')||document;
    const files=[...form.querySelectorAll('input[type="file"]')];
    let inp=files.find(el=>/إيصال|ايصال|الايصال|الإيصال/i.test(labelTextFor(el)));
    // لا نأخذ حقل الإجمال أو أي مرفق آخر بالغلط إلا إذا لا يوجد غيره.
    if(!inp) inp=files.find(el=>!/إجمال|اجمال|صورة|مرفق عام/i.test(labelTextFor(el)))||files[0]||null;
    if(inp) inp.id='orderReceiptFileV233';
    return inp;
  }

  function ensureReceiptUI(){
    removeDuplicateReceiptBox();
    const inp=receiptInput();
    if(!inp) return {inp:null,view:null,name:null};
    let view=$('orderReceiptViewV233');
    if(!view){
      view=document.createElement('button');
      view.type='button'; view.id='orderReceiptViewV233'; view.className='light'; view.textContent='عرض الإيصال';
      inp.insertAdjacentElement('afterend',view);
    }
    let name=$('orderReceiptNameV233');
    if(!name){
      name=document.createElement('small'); name.id='orderReceiptNameV233'; name.style.cssText='display:block;color:#60706a;margin-top:6px';
      view.insertAdjacentElement('afterend',name);
    }
    if(!name.textContent) name.textContent='اختياري';
    return {inp,view,name};
  }

  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=()=>reject(r.error||new Error('تعذر قراءة الملف')); r.readAsDataURL(file); });
  }
  function compressImageDataUrl(dataUrl){
    return new Promise(resolve=>{
      try{
        const img=new Image();
        img.onload=()=>{
          const max=1400; let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
          if(w>max||h>max){ const ratio=Math.min(max/w,max/h); w=Math.round(w*ratio); h=Math.round(h*ratio); }
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',0.78));
        };
        img.onerror=()=>resolve(dataUrl); img.src=dataUrl;
      }catch(_){ resolve(dataUrl); }
    });
  }
  async function readReceiptFile(){
    const inp=receiptInput(); const file=inp&&inp.files&&inp.files[0];
    if(!file) return null;
    let data=await fileToDataUrl(file);
    if(/^image\//i.test(file.type||'')) data=await compressImageDataUrl(data);
    return {name:file.name||'receipt', type:file.type||'', size:file.size||0, data, uploaded_at:nowIso()};
  }
  function findReceipt(row){
    row=row||{}; return row[RECEIPT_KEY]||row.receipt||row.order_receipt||row['ملف الإيصال']||row['مرفق الإيصال']||null;
  }
  function openReceipt(rec){
    if(!rec) return alert('لا يوجد إيصال مرفق لهذا الأوردر');
    const url=typeof rec==='string'?rec:(rec.data||rec.url||rec.href||'');
    if(!url) return alert('لا يوجد إيصال مرفق لهذا الأوردر');
    const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ المنبثقة لعرض الإيصال');
    if(String(url).startsWith('data:application/pdf')) w.document.write('<iframe src="'+url+'" style="width:100%;height:100vh;border:0"></iframe>');
    else if(String(url).startsWith('data:image')) w.document.write('<html dir="rtl"><head><title>الإيصال</title><meta charset="utf-8"><style>body{margin:0;background:#f3f6f5;display:grid;place-items:center;min-height:100vh}img{max-width:96vw;max-height:96vh;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18)}</style></head><body><img src="'+url+'"></body></html>');
    else w.location.href=url;
    try{ w.document.close(); }catch(_){ }
  }

  function labelForControl(el){
    if(!el) return '';
    if(el.dataset && el.dataset.label) return S(el.dataset.label);
    if(el.id){
      try{ const lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(lab) return S(lab.textContent).replace(/[:：]/g,''); }catch(_){ }
    }
    const wrap=el.closest('.field,.form-field,.order-field,.input-box,div');
    const lab=wrap && wrap.querySelector('label');
    if(lab) return S(lab.textContent).replace(/[:：]/g,'');
    const aria=el.getAttribute('aria-label')||el.placeholder||el.name||el.id;
    return S(aria).replace(/[:：]/g,'');
  }

  function collectForm(){
    const out={};
    const box=$('orderFormFieldsV233');
    const scan=[];
    if(box) scan.push(...box.querySelectorAll('input,select,textarea'));
    ['orderNoV233','orderGroupNoV233'].forEach(id=>{ const el=$(id); if(el) scan.push(el); });
    scan.forEach(el=>{
      if(!el || el.disabled || el.type==='file' || el.type==='button' || el.type==='submit') return;
      const key=labelForControl(el);
      if(!key) return;
      out[key]=S(el.value);
    });
    const no=S(($('orderNoV233')&&$('orderNoV233').value)||out['رقم الطلب']||out.order_no||out.orderNo);
    const group=S(($('orderGroupNoV233')&&$('orderGroupNoV233').value)||out['رقم الطلب بالجروب']);
    if(no) out['رقم الطلب']=no;
    if(group) out['رقم الطلب بالجروب']=group;
    // أسماء احتياطية لبعض الحقول المهمة لو labels لم تُقرأ.
    const known={
      orderProjectV233:'المشروع', orderClientV233:'اسم العميل', orderClientPhoneV233:'رقم العميل',
      orderExecutorV233:'المنفذ', orderRequesterV233:'مرسل الطلب', orderDetailsV233:'التفاصيل',
      orderNotesV233:'ملاحظات', orderPriceV233:'السعر (شامل الضريبة)', orderStatusV233:'حالة التنفيذ',
      orderPaymentStatusV233:'حالة السداد', orderInvoiceNoV233:'رقم الفاتورة'
    };
    Object.keys(known).forEach(id=>{ const el=$(id); if(el) out[known[id]]=S(el.value); });
    out.order_no=normalizeNo(out['رقم الطلب']); out.orderNo=out['رقم الطلب']; out.__tasneef_updated_at=nowIso();
    return out;
  }

  async function fetchRecord(no){
    no=normalizeNo(no); if(!no) return null;
    const arr=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET'});
    return A(arr)[0]||null;
  }
  async function fetchAll(){
    const arr=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=5000',{method:'GET'});
    return A(arr).map(x=>Object.assign({},x.data||{}, {order_no:x.order_no,__server_updated_at:x.updated_at,__flow:x.flow||{}}));
  }
  function orderNumberValue(r){ const m=normalizeNo(r&& (r['رقم الطلب']||r.order_no||r.orderNo)).match(/(\d+)/g); return m&&m.length?Number(m[m.length-1])||0:0; }
  async function nextOrderNo(){ const rows=await fetchAll().catch(()=>[]); let max=0; rows.forEach(r=>max=Math.max(max,orderNumberValue(r))); return 'ORD'+String(max+1).padStart(4,'0'); }

  async function saveDirect(){
    const btn=document.activeElement; if(btn) try{ btn.disabled=true; }catch(_){ }
    try{
      let row=collectForm();
      let no=normalizeNo(row['رقم الطلب']||row.order_no);
      if(!no){ no=await nextOrderNo(); row['رقم الطلب']=no; row.order_no=no; row.orderNo=no; if($('orderNoV233')) $('orderNoV233').value=no; }
      const old=await fetchRecord(no).catch(()=>null);
      const merged=Object.assign({}, old&&old.data||{}, row, {order_no:no, orderNo:row.orderNo||no, 'رقم الطلب':row['رقم الطلب']||no, __tasneef_updated_at:nowIso()});
      const rec=await readReceiptFile();
      if(rec){ merged[RECEIPT_KEY]=rec; merged[RECEIPT_NAME_KEY]=rec.name; }
      else if(old&&old.data&&findReceipt(old.data)){ merged[RECEIPT_KEY]=findReceipt(old.data); merged[RECEIPT_NAME_KEY]=old.data[RECEIPT_NAME_KEY]||(merged[RECEIPT_KEY]&&merged[RECEIPT_KEY].name)||''; }
      const payload={order_no:no,data:merged,flow:(old&&old.flow)||{},updated_at:nowIso()};
      if(old){
        await api('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(no), {method:'PATCH', body:JSON.stringify(payload)});
      }else{
        await api('/rest/v1/'+TABLE, {method:'POST', body:JSON.stringify(payload)});
      }
      receiptCache.set(no,findReceipt(merged));
      const ri=receiptInput(); if(ri) ri.value='';
      const rn=$('orderReceiptNameV233'); if(rn) rn.textContent=merged[RECEIPT_NAME_KEY]?'مرفق محفوظ: '+merged[RECEIPT_NAME_KEY]:'اختياري';
      try{ if(typeof window.msg==='function') window.msg('تم حفظ الأوردر بنجاح','ok'); else alert('تم حفظ الأوردر بنجاح'); }catch(_){ alert('تم حفظ الأوردر بنجاح'); }
      // تحديث العرض من أكثر من مسار، حسب السكربت القديم الموجود في الصفحة.
      setTimeout(()=>{ try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){ } attachCardReceiptButtons(); },250);
      return true;
    }catch(e){
      alert('لم يتم حفظ الأوردر:\n'+(e.message||e));
      return false;
    }finally{ if(btn) setTimeout(()=>{ try{btn.disabled=false;}catch(_){ } },600); }
  }

  function installSave(){
    window.saveOrderV233=saveDirect;
    const buttons=[...document.querySelectorAll('button')].filter(b=>/حفظ\s*الأوردر|حفظ\s*الاوردر/i.test(S(b.textContent)));
    buttons.forEach(b=>{ b.onclick=function(ev){ if(ev) ev.preventDefault(); return saveDirect(); }; });
  }

  function bindReceiptForm(){
    const {inp,view,name}=ensureReceiptUI();
    if(inp&&!inp.__v10142){ inp.__v10142=true; inp.addEventListener('change',()=>{ if(name) name.textContent=inp.files&&inp.files[0]?'جاهز للحفظ: '+inp.files[0].name:'اختياري'; }); }
    if(view&&!view.__v10142){ view.__v10142=true; view.onclick=async()=>{
      const file=inp&&inp.files&&inp.files[0];
      if(file){ return openReceipt({data:await fileToDataUrl(file),type:file.type,name:file.name}); }
      const no=normalizeNo(($('orderNoV233')&&$('orderNoV233').value)||'');
      if(!no) return alert('لا يوجد أوردر محدد');
      const r=await fetchRecord(no).catch(e=>(alert('تعذر قراءة الإيصال:\n'+(e.message||e)),null));
      openReceipt(r&&r.data&&findReceipt(r.data));
    }; }
  }

  function selectedNoFromCard(card){
    const direct=card&&(card.getAttribute('data-order-no')||card.getAttribute('data-no'));
    if(direct) return normalizeNo(direct);
    const txt=card?card.textContent:''; const m=String(txt).match(/ORD\s*[-_]?\s*\d+/i);
    return m?normalizeNo(m[0]):'';
  }
  function attachCardReceiptButtons(){
    const cards=document.querySelectorAll('#ordersCardsV360 > *, .orders-cards-v360 > *');
    cards.forEach(card=>{
      if(card.querySelector('.orders-card-receipt-v10142,.orders-card-receipt-v10140')) return;
      const no=selectedNoFromCard(card);
      const host=card.querySelector('.row-actions,.actions,.order-actions-v360')||card;
      const btn=document.createElement('button'); btn.type='button'; btn.className='orders-card-receipt-v10142'; btn.textContent='عرض الإيصال';
      btn.style.cssText='background:#0A4B3C;color:white;border:0;border-radius:10px;padding:9px 12px;font-weight:800;width:100%;margin-top:8px';
      btn.disabled=!no;
      btn.onclick=async(e)=>{ e.preventDefault(); e.stopPropagation(); let rec=receiptCache.get(no); if(!rec){ const r=await fetchRecord(no).catch(err=>(alert('تعذر قراءة الإيصال:\n'+(err.message||err)),null)); rec=r&&r.data&&findReceipt(r.data); if(rec) receiptCache.set(no,rec); } openReceipt(rec); };
      host.appendChild(btn);
    });
  }
  async function hydrateReceiptCache(){
    try{ const rows=await fetchAll(); rows.forEach(r=>{ const no=normalizeNo(r['رقم الطلب']||r.order_no||r.orderNo); const rec=findReceipt(r); if(no&&rec) receiptCache.set(no,rec); }); }catch(_){ }
  }
  function boot(){ removeDuplicateReceiptBox(); bindReceiptForm(); installSave(); hydrateReceiptCache().then(()=>attachCardReceiptButtons()); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
  window.addEventListener('load',()=>setTimeout(boot,800),{once:true});
  setInterval(()=>{ try{ boot(); }catch(_){ } },1200);
  console.log('Loaded '+VERSION);
})();
