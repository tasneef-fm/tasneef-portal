(function(){
  'use strict';
  const VERSION='v10069-finance-inventory-stable-no-reset';
  const VAT_RATE=0.15;
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;

  window.__tasneefFinanceDisableRealtime = true;
  window.__tasneefFinanceManualSyncOnly = true;
  window.__tasneefFinanceNoAutoReload = true;
  window.__financeInventoryStablePatchV10069 = true;

  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function uname(){ const u=user(); return S(u.full_name||u.name||u.username||u.email||'غير محدد'); }
  function uid(){ const u=user(); return u.id ?? u.user_id ?? u.uid ?? null; }
  function role(){ return S(user().role); }
  function isAdmin(){ const u=user(); return ['admin','system_admin','general_manager','مدير النظام','مدير عام'].includes(role()) || S(u.username).toLowerCase()==='admin'; }
  function state(){ return window.financeProStateV15 || {items:[],movements:[],invoiceLines:[],distribution:[]}; }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function productType(i){ const raw=S(i?.item_type||i?.type||i?.category||''); return raw||'مادة'; }
  function rowVat(qty,price,mode='before'){
    const total=N(qty)*N(price);
    if(S(mode)==='after'){ const net=total/(1+VAT_RATE); return {net,vat:total-net,gross:total}; }
    if(S(mode)==='none') return {net:total,vat:0,gross:total};
    return {net:total,vat:total*VAT_RATE,gross:total*(1+VAT_RATE)};
  }
  function unitNet(line){ return S(line.tax_mode)==='after' ? N(line.price)/(1+VAT_RATE) : N(line.price); }
  function safeJson(v){ const t=S(v); if(!t.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};} }
  function findItem(line){
    const st=state();
    if(line.item_id || line.existing_item_id){ const id=line.item_id||line.existing_item_id; const f=st.items.find(i=>String(i.id)===String(id)); if(f) return f; }
    const code=S(line.code||line.product_code);
    if(code){ const f=st.items.find(i=>[i.id,i.product_code,i.serial_number,i.barcode,i.supplier_barcode].map(S).includes(code)); if(f) return f; }
    return st.items.find(i=>S(i.name)===S(line.name)) || null;
  }
  function currentQty(item){ return N(item?.quantity); }
  function lineImage(){ return S(window.__financeProLineImageV15||''); }

  const DRAFT_KEY='tasneef_finance_operations_draft_v10069';
  const WATCH_IDS=['finInvSupplierV15','finInvNoV15','finInvDateV15','finExistingProductV15','finLineNameV15','finLineCodeV15','finLineDistributorCodeV15','finLineQtyV15','finLinePriceV15','finLineTaxModeV15','finLineUnitV15','finLineMinQtyV15','finLineSupplierInvoiceV15','finLineTypeV15','finMoveItemV15','finMoveTypeV15','finMoveStaffV15','finMoveQtyV15','finMoveDateV15','finMoveNoteV15','finDistCenterV15','finDistTypeV15','finDistProjectV15','finDistOrderV15','finDistQtyV15','finDistNoteV15'];
  let saving=false;
  function hasAnyDraftValue(d){ return d && (Object.values(d.values||{}).some(S) || A(d.invoiceLines).length || A(d.distribution).length); }
  function saveDraft(){
    if(saving) return;
    const vals={}; WATCH_IDS.forEach(id=>{ const el=$(id); if(el) vals[id]=el.value; });
    const st=state();
    const draft={at:Date.now(),values:vals,invoiceLines:A(st.invoiceLines),distribution:A(st.distribution),editMovementId:st.editMovementId||'', editInvoiceNo:window.__financeV10069_editInvoiceNo||''};
    if(hasAnyDraftValue(draft)) localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));
  }
  function restoreDraft(){
    if(saving) return;
    let draft=null; try{ draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null'); }catch(_){ draft=null; }
    if(!hasAnyDraftValue(draft)) return;
    const st=state();
    Object.entries(draft.values||{}).forEach(([id,val])=>{ const el=$(id); if(el && !S(el.value)) el.value=val; });
    if(A(draft.invoiceLines).length && !A(st.invoiceLines).length){ st.invoiceLines=A(draft.invoiceLines); if(typeof window.financeProRenderInvoiceLinesV10069==='function') window.financeProRenderInvoiceLinesV10069(); }
    if(A(draft.distribution).length && !A(st.distribution).length){ st.distribution=A(draft.distribution); }
    if(draft.editMovementId && !st.editMovementId) st.editMovementId=draft.editMovementId;
    if(draft.editInvoiceNo && !window.__financeV10069_editInvoiceNo) window.__financeV10069_editInvoiceNo=draft.editInvoiceNo;
  }
  function clearDraft(){ localStorage.removeItem(DRAFT_KEY); }
  document.addEventListener('input',e=>{ if(e.target&&e.target.closest&&e.target.closest('#financeDashboard')) saveDraft(); },true);
  document.addEventListener('change',e=>{ if(e.target&&e.target.closest&&e.target.closest('#financeDashboard')) saveDraft(); setTimeout(injectEditProductButton,80); },true);
  const mo=new MutationObserver(()=>{ setTimeout(()=>{ restoreDraft(); injectEditProductButton(); injectStableNotice(); },80); });
  if(document.body) mo.observe(document.body,{childList:true,subtree:true}); else document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{childList:true,subtree:true}));

  function renderInvoiceLines(){
    const st=state();
    const box=$('finInvoiceLinesV15'); if(!box) return;
    const total=A(st.invoiceLines).reduce((a,l)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); a.net+=c.net; a.vat+=c.vat; a.gross+=c.gross; return a; },{net:0,vat:0,gross:0});
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود الداخلي</th><th>كود الموزع</th><th>رقم فاتورة المورد</th><th>النوع</th><th>الكمية</th><th>حد النفاد</th><th>الوحدة</th><th>طريقة الضريبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>${A(st.invoiceLines).map((l,idx)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); const modeLabel={before:'قبل الضريبة',after:'بعد الضريبة',none:'بدون ضريبة'}[S(l.tax_mode||'before')]||'قبل الضريبة'; return `<tr><td>${l.image?`<img src="${esc(l.image)}" style="width:34px;height:34px;object-fit:contain;border-radius:8px;border:1px solid #d9e7e2;background:#fff;margin-left:6px">`:''}${esc(l.name)}</td><td>${esc(l.code)}</td><td>${esc(l.distributor_code||'-')}</td><td>${esc(l.supplier_invoice_no||'-')}</td><td>${esc(l.item_type||'مادة')}</td><td>${N(l.qty)}</td><td>${N(l.min_quantity||1)}</td><td>${esc(l.unit||'حبة')}</td><td>${esc(modeLabel)}</td><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td><td><button class="danger" onclick="financeProRemoveInvoiceLineV15(${idx})">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="13">أضف منتجات الفاتورة هنا. الصورة اختيارية وليست إلزامية.</td></tr>'}</tbody></table></div><div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">قبل الضريبة: <b>${money(total.net)}</b></div><div class="fin-soft">الضريبة: <b>${money(total.vat)}</b></div><div class="fin-soft">بعد الضريبة: <b>${money(total.gross)}</b></div></div>`;
  }
  window.financeProRenderInvoiceLinesV10069=renderInvoiceLines;

  window.financeProAddInvoiceLineV15=function(){
    const st=state();
    const existing=st.items.find(i=>String(i.id)===String($('finExistingProductV15')?.value));
    const line={
      existing_item_id:existing?existing.id:'', name:S($('finLineNameV15')?.value)||(existing?S(existing.name):''), code:S($('finLineCodeV15')?.value)||(existing?itemCode(existing):''), distributor_code:S($('finLineDistributorCodeV15')?.value)||(existing?S(existing.supplier_barcode||existing.distributor_code):''), supplier_invoice_no:S($('finLineSupplierInvoiceV15')?.value), qty:N($('finLineQtyV15')?.value), min_quantity:N($('finLineMinQtyV15')?.value)||N(existing?.min_quantity)||1, price:N($('finLinePriceV15')?.value), tax_mode:S($('finLineTaxModeV15')?.value)||'before', unit:S($('finLineUnitV15')?.value)||S(existing?.unit)||'حبة', item_type:S($('finLineTypeV15')?.value)||productType(existing)||'مادة', image:lineImage()||S(existing?.image_url||'')
    };
    if(!line.name) return alert('اسم المنتج مطلوب');
    if(line.qty<=0) return alert('الكمية مطلوبة');
    if(line.price<0) return alert('السعر غير صحيح');
    st.invoiceLines=A(st.invoiceLines); st.invoiceLines.push(line);
    ['finLineNameV15','finLineDistributorCodeV15','finLineSupplierInvoiceV15','finLineQtyV15','finLineMinQtyV15','finLinePriceV15'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    if($('finExistingProductV15')) $('finExistingProductV15').value='';
    if($('finLineCodeV15') && typeof window.financeProNextInternalCodeV15==='function') $('finLineCodeV15').value=window.financeProNextInternalCodeV15();
    if($('finLineImageV15')) $('finLineImageV15').value='';
    if($('finLineImageNameV15')) $('finLineImageNameV15').textContent='لم يتم اختيار صورة - الصورة اختيارية';
    window.__financeProLineImageV15='';
    renderInvoiceLines(); saveDraft();
  };
  window.financeProRemoveInvoiceLineV15=function(idx){ const st=state(); st.invoiceLines=A(st.invoiceLines); st.invoiceLines.splice(idx,1); renderInvoiceLines(); saveDraft(); };
  window.financeProClearInvoiceV15=function(){ const st=state(); st.invoiceLines=[]; window.__financeV10069_editInvoiceNo=''; clearDraft(); renderInvoiceLines(); };

  function invoiceGroups(){
    const map=new Map();
    A(state().movements).filter(m=>S(m.movement_type)==='in').forEach(m=>{
      const meta=safeJson(m.notes)||{}; const invoiceNo=S(meta.invoiceNo)||(S(m.reason).match(/فاتورة\s+(.+)$/)||[])[1]||'بدون رقم';
      if(!map.has(invoiceNo)) map.set(invoiceNo,{invoiceNo,supplier:S(meta.supplier||m.receiver||''),date:S(m.movement_date||m.created_at).slice(0,10),lines:[]});
      map.get(invoiceNo).lines.push(m);
    });
    return [...map.values()];
  }
  window.financeProEditInvoiceV15=function(encoded){
    if(!isAdmin()) return alert('تعديل الفاتورة متاح لمدير النظام فقط');
    const invoiceNo=decodeURIComponent(encoded||''); const inv=invoiceGroups().find(x=>S(x.invoiceNo)===S(invoiceNo)); if(!inv) return alert('لم يتم العثور على الفاتورة');
    const st=state(); st.tab='add'; st.invoiceLines=inv.lines.map(m=>{ const meta=safeJson(m.notes)||{}; const q=N(m.quantity); const mode=S(meta.taxMode||'before'); const price=mode==='after' && q>0 ? N(meta.afterVat)/q : N(m.unit_cost); return {existing_item_id:m.item_id||'', _originalMovementId:m.id, _oldQty:q, name:S(m.item_name), code:S(m.product_code), distributor_code:S(m.barcode), supplier_invoice_no:S(meta.supplierInvoiceNo), qty:q, min_quantity:N(meta.minQuantity)||1, price, tax_mode:mode, unit:S(m.unit||'حبة'), item_type:S(meta.itemType||'مادة'), image:''}; });
    window.__financeV10069_editInvoiceNo=invoiceNo;
    if(typeof window.financeProTabV15==='function') window.financeProTabV15('add');
    setTimeout(()=>{ if($('finInvSupplierV15')) $('finInvSupplierV15').value=inv.supplier||''; if($('finInvNoV15')) $('finInvNoV15').value=invoiceNo; if($('finInvDateV15')) $('finInvDateV15').value=inv.date||today(); renderInvoiceLines(); saveDraft(); },250);
    if(typeof msg==='function') msg('تم تحميل الفاتورة للتعديل الآمن: تعديل السعر لا يغير الكمية، وتغيير الكمية يضيف/يخصم الفرق فقط.');
  };

  async function updateItemByDelta(item,line,delta,supplier,cost){
    const oldQty=currentQty(item); const nextQty=+(oldQty+delta).toFixed(4);
    const oldCost=itemCost(item); const inDelta=Math.max(0,delta);
    const avg = inDelta>0 && nextQty>0 ? (((oldQty*oldCost)+(inDelta*cost))/(oldQty+inDelta)) : (cost || oldCost);
    const upd={name:S(line.name)||item.name, quantity:nextQty, unit_cost:+N(avg||oldCost).toFixed(4), supplier:supplier||item.supplier, unit:S(line.unit)||item.unit, item_type:S(line.item_type)||item.item_type, type:S(line.item_type)||item.type, product_code:S(line.code)||item.product_code, serial_number:S(line.code)||item.serial_number, barcode:S(line.code)||item.barcode, supplier_barcode:S(line.distributor_code)||item.supplier_barcode, min_quantity:N(line.min_quantity)||N(item.min_quantity)||1, updated_by:uid(), updated_by_name:uname(), updated_at:new Date().toISOString()};
    if(S(line.image)) upd.image_url=S(line.image);
    const res=await sb.from('inventory_items').update(upd).eq('id',item.id).select('*').single();
    if(res.error) throw res.error; return res.data;
  }
  async function insertIncomingMovement(item,line,q,date,supplier,invoiceNo,cost){
    const c=rowVat(q,line.price,line.tax_mode);
    const meta={module:VERSION, invoiceNo, supplier, supplierInvoiceNo:S(line.supplier_invoice_no), minQuantity:N(line.min_quantity)||1, taxMode:S(line.tax_mode||'before'), beforeVat:c.net, vat:c.vat, afterVat:c.gross, itemType:S(line.item_type||'مادة'), createdBy:uid(), createdByName:uname(), createdAt:new Date().toISOString()};
    const mv={item_id:item.id,item_name:item.name,movement_type:'in',quantity:q,movement_date:date,receiver:supplier,reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:S(line.code)||itemCode(item),barcode:S(line.distributor_code)||itemCode(item),unit_cost:+cost.toFixed(4),created_by:uid(),created_by_name:uname(),updated_by:uid(),updated_by_name:uname()};
    const mr=await sb.from('inventory_movements').insert(mv); if(mr.error) throw mr.error;
  }
  window.financeProSaveInvoiceV15=async function(btn){
    try{
      saving=true; if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const st=state(); if(!A(st.invoiceLines).length) throw new Error('أضف منتج واحد على الأقل داخل الفاتورة');
      const supplier=S($('finInvSupplierV15')?.value); const invoiceNo=S($('finInvNoV15')?.value)||('INV-'+Date.now()); const date=S($('finInvDateV15')?.value)||today();
      for(const l of A(st.invoiceLines)){
        const q=N(l.qty), cost=unitNet(l); if(q<0) throw new Error('كمية غير صحيحة في '+S(l.name));
        let item=findItem(l);
        if(l._originalMovementId){
          const oldMove=st.movements.find(m=>String(m.id)===String(l._originalMovementId));
          if(!oldMove) throw new Error('لم يتم العثور على حركة الفاتورة القديمة');
          item=item||st.items.find(i=>String(i.id)===String(oldMove.item_id));
          if(!item) throw new Error('لم يتم العثور على المنتج القديم: '+S(l.name));
          const oldQty=N(l._oldQty||oldMove.quantity); const delta=q-oldQty;
          item=await updateItemByDelta(item,l,delta,supplier,cost);
          const c=rowVat(q,l.price,l.tax_mode);
          const oldMeta=safeJson(oldMove.notes)||{};
          const meta=Object.assign({},oldMeta,{module:VERSION, invoiceNo, supplier, supplierInvoiceNo:S(l.supplier_invoice_no), minQuantity:N(l.min_quantity)||1, taxMode:S(l.tax_mode||'before'), beforeVat:c.net, vat:c.vat, afterVat:c.gross, itemType:S(l.item_type||'مادة'), oldQuantity:oldQty, deltaQuantity:delta, updatedBy:uid(), updatedByName:uname(), updatedAt:new Date().toISOString()});
          const mr=await sb.from('inventory_movements').update({item_id:item.id,item_name:item.name,quantity:q,movement_date:date,receiver:supplier,reason:'تعديل آمن لفاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:S(l.code)||itemCode(item),barcode:S(l.distributor_code)||itemCode(item),unit_cost:+cost.toFixed(4),updated_by:uid(),updated_by_name:uname()}).eq('id',oldMove.id);
          if(mr.error) throw mr.error;
        }else{
          if(item){ item=await updateItemByDelta(item,l,q,supplier,cost); }
          else{
            const ins={name:S(l.name),product_code:S(l.code),serial_number:S(l.code),barcode:S(l.code),supplier_barcode:S(l.distributor_code)||S(l.code),image_url:S(l.image)||'',unit:S(l.unit)||'حبة',item_type:S(l.item_type)||'مادة',type:S(l.item_type)||'مادة',quantity:q,min_quantity:N(l.min_quantity)||1,unit_cost:+cost.toFixed(4),supplier,category:S(l.item_type)||'عام',notes:'تمت الإضافة من فاتورة '+invoiceNo,created_by:uid(),created_by_name:uname(),updated_by:uid(),updated_by_name:uname()};
            const res=await sb.from('inventory_items').insert(ins).select('*').single(); if(res.error) throw res.error; item=res.data;
          }
          await insertIncomingMovement(item,l,q,date,supplier,invoiceNo,cost);
        }
      }
      st.invoiceLines=[]; window.__financeV10069_editInvoiceNo=''; clearDraft();
      if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); else location.reload();
      if(typeof msg==='function') msg('تم حفظ الفاتورة بأمان بدون تصفير أو لخبطة في الكمية');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ saving=false; if(btn) btn.disabled=false; }
  };

  function injectEditProductButton(){
    if(!isAdmin()) return;
    const sel=$('finExistingProductV15'); if(!sel || $('finEditSelectedProductV10069')) return;
    const wrap=sel.closest('div'); if(!wrap) return;
    const btn=document.createElement('button'); btn.type='button'; btn.id='finEditSelectedProductV10069'; btn.className='light'; btn.style.marginTop='8px'; btn.textContent='تعديل المنتج المختار'; btn.onclick=()=>openEditProductModal(sel.value); wrap.appendChild(btn);
  }
  function openEditProductModal(id){
    const item=state().items.find(i=>String(i.id)===String(id)); if(!item) return alert('اختر منتج أولاً');
    const html=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(760px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>تعديل المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-grid two"><div><label>اسم المنتج</label><input id="editProdName10069" value="${esc(item.name)}"></div><div><label>الكود الداخلي</label><input id="editProdCode10069" value="${esc(itemCode(item))}"></div><div><label>كود الموزع</label><input id="editProdDist10069" value="${esc(item.supplier_barcode||'')}"></div><div><label>الوحدة</label><input id="editProdUnit10069" value="${esc(item.unit||'حبة')}"></div><div><label>نوع المنتج</label><input id="editProdType10069" value="${esc(productType(item))}"></div><div><label>حد النفاد</label><input id="editProdMin10069" type="number" step="0.01" value="${N(item.min_quantity||1)}"></div><div><label>تكلفة الوحدة قبل الضريبة</label><input id="editProdCost10069" type="number" step="0.01" value="${N(itemCost(item))}"></div></div><div class="fin-soft" style="margin-top:10px">هذا التعديل لا يغير الكمية، فقط بيانات المنتج والسعر. الكمية تتحرك من الفواتير وحركات المخزون فقط.</div><div class="fin-actions"><button onclick="financeProSaveProductEditV10069('${esc(item.id)}',this)">حفظ تعديل المنتج</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
  }
  window.financeProSaveProductEditV10069=async function(id,btn){
    try{ if(btn) btn.disabled=true; const upd={name:S($('editProdName10069')?.value),product_code:S($('editProdCode10069')?.value),serial_number:S($('editProdCode10069')?.value),barcode:S($('editProdCode10069')?.value),supplier_barcode:S($('editProdDist10069')?.value),unit:S($('editProdUnit10069')?.value)||'حبة',item_type:S($('editProdType10069')?.value)||'مادة',type:S($('editProdType10069')?.value)||'مادة',min_quantity:N($('editProdMin10069')?.value)||1,unit_cost:N($('editProdCost10069')?.value),updated_by:uid(),updated_by_name:uname(),updated_at:new Date().toISOString()}; const res=await sb.from('inventory_items').update(upd).eq('id',id); if(res.error) throw res.error; document.querySelector('.modal-backdrop:last-child')?.remove(); if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); if(typeof msg==='function') msg('تم تعديل المنتج بدون تغيير الكمية'); }catch(e){ alert(e.message||String(e)); } finally{ if(btn) btn.disabled=false; }
  };

  const oldShowMovement=window.financeProShowMovementV15;
  window.financeProShowMovementV15=function(id){
    const st=state(); const m=st.movements.find(x=>Number(x.id)===Number(id)); if(!m && typeof oldShowMovement==='function') return oldShowMovement(id); if(!m) return;
    const meta=safeJson(m.notes)||{}; const maker=S(m.created_by_name||meta.createdByName||meta.created_by_name||'-'); const updater=S(m.updated_by_name||meta.updatedByName||meta.updated_by_name||'-');
    const dist=A(meta.distribution).map(d=>`<tr><td>${esc(d.center)}</td><td>${esc(d.type||m.movement_type)}</td><td>${esc(d.projectName||'-')}</td><td>${esc(d.orderNo||'-')}</td><td>${N(d.qty)}</td><td>${esc(d.note||'')}</td></tr>`).join('')||'<tr><td colspan="6">لا يوجد توزيع محفوظ</td></tr>';
    if(typeof window.__financeOpenPagedV10069==='function') return window.__financeOpenPagedV10069('تفاصيل حركة المخزون',[]);
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(920px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>تفاصيل حركة المخزون</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-grid three"><div class="fin-card"><h3>المنتج</h3><b>${esc(m.item_name||'-')}</b></div><div class="fin-card"><h3>النوع</h3><b>${esc(m.movement_type||'-')}</b></div><div class="fin-card"><h3>الكمية</h3><b>${N(m.quantity)}</b></div><div class="fin-card"><h3>أنشأ العملية</h3><b>${esc(maker)}</b></div><div class="fin-card"><h3>آخر تعديل بواسطة</h3><b>${esc(updater)}</b></div><div class="fin-card"><h3>تاريخ العملية</h3><b>${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}</b></div></div><h3>توزيع الحركة</h3><div class="fin-table"><table><thead><tr><th>المركز</th><th>النوع</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th></tr></thead><tbody>${dist}</tbody></table></div></div></div>`);
  };

  function injectStableNotice(){
    const add=$('finInvoiceLinesV15'); if(!add || $('financeStableNoticeV10069')) return;
    add.insertAdjacentHTML('beforebegin','<div id="financeStableNoticeV10069" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"><b>وضع الثبات مفعل:</b> لا يتم تصفير الصنف عند تعديل الفاتورة. تعديل الكمية يحسب الفرق فقط، والصورة اختيارية.</div>');
  }
  setInterval(()=>{ restoreDraft(); injectEditProductButton(); injectStableNotice(); },1200);
  console.log('Tasneef '+VERSION+' loaded');
})();
