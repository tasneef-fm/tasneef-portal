/* Tasneef Finance Inventory Stable Root v10074
   حل سريع وجذري:
   - تحميل المنتجات من Supabase في الخلفية فور فتح الصفحة، قبل دخول قسم المالية.
   - إظهار المنتجات من الذاكرة المحملة مباشرة عند فتح القسم.
   - منع ملفات v10071/v10072/v10073 من إعادة الرندر المتكرر.
   - زر إضافة صورة المنتج من قسم المنتجات.
   - زر طباعة بجانب كل عملية داخل فاتورة العمليات.
   - زر طباعة بجانب حركة المخزون وفي تفاصيل الحركة.
*/
(function(){
  'use strict';
  if(window.__financeInventoryStableRootV10074) return;
  window.__financeInventoryStableRootV10074 = true;

  // تعطيل سكربتات كانت تعمل تحديث/وميض
  window.__financeInventoryStableRootV10071 = true;
  window.__financeInventoryStableRootV10072 = true;
  window.__financeInventoryStableRootV10073 = true;
  window.__tasneefFinanceDisableRealtime = true;
  window.__tasneefFinanceManualSyncOnly = true;
  window.__tasneefFinanceNoAutoReload = true;

  const VERSION='v10074-fast-products-print';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const VAT=0.15;

  let itemsCache=[];
  let preloadStarted=false;
  let preloadDone=false;
  let preloadPromise=null;

  function st(){ return window.financeProStateV15 || (window.financeProStateV15={items:[],movements:[],invoiceLines:[],distribution:[]}); }
  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function uname(){ const u=user(); return S(u.full_name||u.name||u.username||u.email||'غير محدد'); }
  function isAdmin(){ const u=user(); const t=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase(); return /admin|system|manager|owner|مدير|النظام|ادارة|الإدارة/.test(t); }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function productType(i){ return S(i?.item_type||i?.type||i?.category||'مادة')||'مادة'; }
  function taxCalc(q,price,mode){ const total=N(q)*N(price); if(S(mode)==='after'){ const net=total/(1+VAT); return {net,vat:total-net,gross:total}; } if(S(mode)==='none') return {net:total,vat:0,gross:total}; return {net:total,vat:total*VAT,gross:total*(1+VAT)}; }

  function waitSupabase(){
    return new Promise(resolve=>{
      let tries=0;
      const t=setInterval(()=>{
        tries++;
        if(window.sb || tries>80){ clearInterval(t); resolve(window.sb); }
      },100);
    });
  }

  function setStatus(txt,err){
    let root=$('financeDashboard') || document.body;
    let box=$('finFastProductsStatusV10074');
    if(!box && root){
      root.insertAdjacentHTML('afterbegin',`<div id="finFastProductsStatusV10074" class="fin-soft" style="margin:10px 0;background:${err?'#fde8e8':'#eef8f4'};border-color:${err?'#efc3c3':'#c7e7da'}"></div>`);
      box=$('finFastProductsStatusV10074');
    }
    if(box){ box.style.background=err?'#fde8e8':'#eef8f4'; box.textContent=txt; }
  }

  async function preloadProducts(force=false){
    if(preloadPromise && !force) return preloadPromise;
    preloadStarted=true;
    preloadPromise=(async()=>{
      const sb=await waitSupabase();
      if(!sb) throw new Error('الاتصال غير جاهز');
      const res=await sb.from('inventory_items').select('*').order('name',{ascending:true}).limit(10000);
      if(res.error) throw res.error;
      itemsCache=A(res.data);
      preloadDone=true;
      st().items=itemsCache.slice();
      localStorage.setItem('tasneef_fast_inventory_items_v10074', JSON.stringify({at:Date.now(), items:itemsCache.slice(0,3000)}));
      renderProductsEverywhere(itemsCache);
      return itemsCache;
    })().catch(e=>{ console.warn('v10074 preload failed',e); setStatus(e.message||String(e), true); return itemsCache; });
    return preloadPromise;
  }

  // تحميل فوري في الخلفية عند فتح الصفحة وليس عند دخول القسم
  waitSupabase().then(()=>preloadProducts(false));

  function loadCachedFirst(){
    try{
      const d=JSON.parse(localStorage.getItem('tasneef_fast_inventory_items_v10074')||'null');
      if(d && A(d.items).length){ itemsCache=A(d.items); st().items=itemsCache.slice(); renderProductsEverywhere(itemsCache); }
    }catch(_){ }
  }

  function syncProductSelect(items){
    const sel=$('finExistingProductV15');
    if(!sel) return;
    const cur=sel.value;
    sel.innerHTML='<option value="">منتج جديد</option>'+A(items).map(i=>`<option value="${esc(i.id)}">${esc(i.name||'-')} - ${esc(itemCode(i)||'بدون كود')} - ${N(i.quantity)}</option>`).join('');
    if(cur) sel.value=cur;
  }
  function findProductBody(){
    const ids=['finProductsBodyV15','finItemsBodyV15','inventoryItemsBody','financeProductsBody','inventoryProductsBody'];
    for(const id of ids){ const el=$(id); if(el) return el; }
    const bodies=[...document.querySelectorAll('#financeDashboard table tbody')];
    return bodies.find(tb=>/المنتج|الكود|الكمية|حد النفاد|الوحدة/.test(tb.closest('table')?.innerText||''));
  }
  function renderProductsTable(items){
    const body=findProductBody();
    if(!body || !A(items).length) return;
    body.innerHTML=A(items).map(i=>{
      const img=S(i.image_url)?`<img src="${esc(i.image_url)}" style="width:42px;height:42px;object-fit:contain;border:1px solid #dce6e2;border-radius:10px;background:#fff;padding:2px">`:'<span class="inventory-image-empty">بدون صورة</span>';
      const acts=`<button class="light" onclick="financeProShowProductV15&&financeProShowProductV15('${esc(i.id)}')">عرض</button>${isAdmin()?`<button class="light" onclick="financeProOpenProductImageModalV10074('${esc(i.id)}')">إضافة صورة</button>`:''}`;
      return `<tr data-prod-fast-v10074="1"><td>${img}</td><td>${esc(i.name||'-')}</td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||1)}</td><td>${esc(i.unit||'حبة')}</td><td>${money(itemCost(i))}</td><td class="fin-actions">${acts}</td></tr>`;
    }).join('');
  }
  function renderProductsEverywhere(items){
    st().items=A(items).slice();
    syncProductSelect(items);
    try{ if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15(); }catch(_){ }
    renderProductsTable(items);
    injectToolbar();
  }

  window.financeProLoadProductsFastV10074=async function(btn){
    try{ if(btn){btn.disabled=true;btn.textContent='جاري التحميل...';} setStatus('جاري تحميل المنتجات من السيرفر...'); const items=await preloadProducts(true); setStatus(`تم تحميل ${A(items).length} منتج من السيرفر`); }
    catch(e){ setStatus(e.message||String(e),true); alert(e.message||String(e)); }
    finally{ if(btn){btn.disabled=false;btn.textContent='تحميل المنتجات من السيرفر';} }
  };

  function printWindow(title, html){
    const w=window.open('','_blank','width=950,height=720');
    if(!w) return alert('المتصفح منع نافذة الطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#10231d}h1{color:#0A4033;margin:0 0 12px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #0A4033;padding-bottom:10px;margin-bottom:14px}.box{border:1px solid #dce6e2;border-radius:12px;padding:12px;margin:8px 0;line-height:1.9}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#eef6f3}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:35px}.sign div{border-top:1px solid #333;padding-top:8px;text-align:center}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة</button><div class="head"><h1>${esc(title)}</h1><div>شركة تصنيف لإدارة المرافق<br>${new Date().toLocaleString('ar-SA')}</div></div>${html}</body></html>`);
    w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(_){}},350);
  }
  window.financeProPrintInvoiceLineV10074=function(idx){
    const l=A(st().invoiceLines)[idx]; if(!l) return alert('لا توجد عملية للطباعة');
    const c=taxCalc(l.qty,l.price,l.tax_mode);
    printWindow('طباعة عملية مخزون',`<div class="box"><b>المنتج:</b> ${esc(l.name)}<br><b>الكود الداخلي:</b> ${esc(l.code||'-')}<br><b>كود الموزع:</b> ${esc(l.distributor_code||'-')}<br><b>الكمية:</b> ${N(l.qty)} ${esc(l.unit||'حبة')}<br><b>المستخدم:</b> ${esc(uname())}</div><table><thead><tr><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody><tr><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td></tr></tbody></table><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`);
  };
  window.financeProPrintMovementV10074=function(id){
    const m=A(st().movements).find(x=>String(x.id)===String(id)); if(!m) return alert('لا توجد حركة للطباعة');
    printWindow('طباعة حركة مخزون',`<div class="box"><b>المنتج:</b> ${esc(m.item_name||'-')}<br><b>نوع الحركة:</b> ${esc(m.movement_type||'-')}<br><b>الكمية:</b> ${N(m.quantity)}<br><b>التاريخ:</b> ${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}<br><b>المورد/المستلم:</b> ${esc(m.receiver||'-')}<br><b>السبب:</b> ${esc(m.reason||'-')}<br><b>أنشأها:</b> ${esc(m.created_by_name||'-')}<br><b>آخر تعديل:</b> ${esc(m.updated_by_name||'-')}</div><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`);
  };

  function addPrintButtons(){
    const box=$('finInvoiceLinesV15');
    if(box){ [...box.querySelectorAll('tbody tr')].forEach((tr,idx)=>{ const last=tr.querySelector('td:last-child'); if(last && A(st().invoiceLines)[idx] && !last.querySelector('.print-v10074')){ const b=document.createElement('button'); b.type='button'; b.className='light print-v10074'; b.textContent='طباعة'; b.onclick=()=>window.financeProPrintInvoiceLineV10074(idx); last.prepend(b); } }); }
    document.querySelectorAll('button[onclick*="financeProShowMovementV15"],button[onclick*="financeProEditMovementV15"]').forEach(btn=>{ const cell=btn.closest('td,.fin-actions'); if(!cell || cell.querySelector('.print-move-v10074')) return; const txt=btn.getAttribute('onclick')||''; const m=txt.match(/financePro(?:Show|Edit)MovementV15\((\d+)\)/); if(!m) return; const b=document.createElement('button'); b.type='button'; b.className='light print-move-v10074'; b.textContent='طباعة'; b.onclick=()=>window.financeProPrintMovementV10074(m[1]); cell.insertBefore(b, cell.firstChild); });
  }

  async function compressImage(file,max=520,quality=.72){
    return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ const sc=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*sc)); c.height=Math.max(1,Math.round(img.height*sc)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',quality)); }; img.onerror=reject; img.src=r.result; }; r.onerror=reject; r.readAsDataURL(file); });
  }
  function openProductImage(id){
    if(!isAdmin()) return alert('إضافة الصورة متاحة لمدير النظام فقط');
    const items=A(st().items).length?A(st().items):itemsCache;
    if(!items.length) return alert('اضغط تحميل المنتجات من السيرفر أولاً');
    const opts=items.map(i=>`<option value="${esc(i.id)}" ${String(i.id)===String(id)?'selected':''}>${esc(i.name)} - ${esc(itemCode(i)||'بدون كود')}</option>`).join('');
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(720px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>إضافة / تعديل صورة المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><label>المنتج</label><select id="prodImgItemV10074">${opts}</select><label>الصورة</label><input id="prodImgFileV10074" type="file" accept="image/*"><div id="prodImgPreviewV10074" class="fin-soft" style="margin-top:10px">اختر الصورة وسيتم ضغطها قبل الحفظ.</div><div class="fin-actions"><button onclick="financeProSaveProductImageV10074(this)">حفظ الصورة</button></div></div></div>`);
    setTimeout(()=>{ const f=$('prodImgFileV10074'); if(f) f.onchange=async()=>{ const file=f.files&&f.files[0]; if(!file) return; const data=await compressImage(file); window.__prodImgV10074=data; $('prodImgPreviewV10074').innerHTML=`<img src="${data}" style="width:120px;height:120px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px"><p>جاهزة للحفظ</p>`; }; },50);
  }
  window.financeProOpenProductImageModalV10074=openProductImage;
  window.financeProOpenProductImageModalV10073=openProductImage;
  window.financeProSaveProductImageV10074=async function(btn){
    try{ if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...';} const id=S($('prodImgItemV10074')?.value); const data=S(window.__prodImgV10074||''); if(!id) throw new Error('اختر المنتج'); if(!data) throw new Error('اختر الصورة'); const res=await sb.from('inventory_items').update({image_url:data,updated_at:new Date().toISOString()}).eq('id',id).select('*').single(); if(res.error) throw res.error; const idx=itemsCache.findIndex(i=>String(i.id)===String(id)); if(idx>=0) itemsCache[idx]=res.data; const sidx=A(st().items).findIndex(i=>String(i.id)===String(id)); if(sidx>=0) st().items[sidx]=res.data; document.querySelector('.modal-backdrop:last-child')?.remove(); renderProductsEverywhere(st().items); if(window.msg) msg('تم حفظ صورة المنتج'); }catch(e){ alert(e.message||String(e)); } finally{ if(btn){btn.disabled=false;btn.textContent='حفظ الصورة';} }
  };

  function injectToolbar(){
    const fin=$('financeDashboard'); if(!fin) return;
    if(!$('finFastProductsBarV10074')){
      const where=$('finInvoiceLinesV15') || document.querySelector('#financeDashboard .card') || fin;
      where.insertAdjacentHTML('beforebegin',`<div id="finFastProductsBarV10074" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"><b>v10074:</b> تحميل المنتجات يبدأ فور فتح الصفحة، وليس عند دخول القسم. <button type="button" class="light" onclick="financeProLoadProductsFastV10074(this)">تحميل المنتجات من السيرفر</button> ${isAdmin()?`<button type="button" class="light" onclick="financeProOpenProductImageModalV10074()">إضافة صورة للمنتج</button>`:''}</div>`);
    }
    const tabs=document.querySelector('#finTabsV15,.finance-tabs');
    if(tabs && isAdmin() && !$('finProductImageBtnV10074')){ const b=document.createElement('button'); b.id='finProductImageBtnV10074'; b.type='button'; b.className='light'; b.textContent='إضافة صورة للمنتج'; b.onclick=()=>openProductImage(); tabs.appendChild(b); }
    addPrintButtons();
  }

  function patchMovementDetails(){
    const old=window.financeProShowMovementV15;
    if(typeof old==='function' && !old.__v10074){
      const wrap=function(id){ const r=old.apply(this,arguments); setTimeout(()=>{ const modal=[...document.querySelectorAll('.modal-backdrop .card')].pop(); if(modal && /تفاصيل حركة المخزون/.test(modal.innerText||'') && !modal.querySelector('.print-move-detail-v10074')){ const b=document.createElement('button'); b.type='button'; b.className='light print-move-detail-v10074'; b.textContent='طباعة الحركة'; b.onclick=()=>window.financeProPrintMovementV10074(id); modal.querySelector('.fin-actions')?.appendChild(b); } },80); return r; };
      wrap.__v10074=true; window.financeProShowMovementV15=wrap;
    }
  }

  function patchNavigation(){
    if(window.__finV10074NavPatched) return;
    window.__finV10074NavPatched=true;
    const oldShow=window.showPage;
    if(typeof oldShow==='function'){
      window.showPage=function(id,btn){
        const r=oldShow.apply(this,arguments);
        if(id==='financeDashboard'){
          loadCachedFirst();
          preloadProducts(false).then(items=>{ renderProductsEverywhere(items); setStatus(`المنتجات جاهزة: ${A(items).length}`); });
        }
        setTimeout(()=>{ injectToolbar(); renderProductsEverywhere(st().items); addPrintButtons(); },180);
        return r;
      };
      try{ showPage=window.showPage; }catch(_){ }
    }
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function' && !oldTab.__v10074){
      const wrap=function(tab){ const r=oldTab.apply(this,arguments); if(/product|item|inventory|منتج|مخزون|add/.test(S(tab))){ loadCachedFirst(); preloadProducts(false).then(renderProductsEverywhere); } setTimeout(()=>{injectToolbar();addPrintButtons();},120); return r; };
      wrap.__v10074=true; window.financeProTabV15=wrap;
    }
  }

  function boot(){
    loadCachedFirst();
    patchNavigation();
    patchMovementDetails();
    injectToolbar();
    addPrintButtons();
    preloadProducts(false);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  document.addEventListener('click',()=>setTimeout(()=>{injectToolbar();addPrintButtons();},100),true);
  document.addEventListener('change',()=>setTimeout(()=>{injectToolbar();addPrintButtons();},100),true);
  console.log('Tasneef '+VERSION+' loaded');
})();
