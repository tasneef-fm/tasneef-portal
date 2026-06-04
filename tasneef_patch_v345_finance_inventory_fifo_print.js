/* TASNEEF v345 - Finance & Inventory final refinement
   - Auto internal product code PRD-00001...
   - Product detail opens our full FIFO batches view from every product عرض button
   - FIFO: first batch out first for outgoing movement unit cost
   - Movement detail: distribute to many projects and edit cost per line
   - Returns are excluded from project cost reports
   - Report print buttons and totals at the end of reports
*/
(function(){
  'use strict';
  if(window.__tasneefV345FinanceInventoryFifoPrint) return; window.__tasneefV345FinanceInventoryFifoPrint=true;
  const BUILD='v345-finance-inventory-fifo-print';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'');
  const n=v=>{const x=Number(S(v).replace(/,/g,'').trim()); return Number.isFinite(x)?x:0;};
  const r2=v=>Math.round(n(v)*100)/100;
  const esc=s=>S(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const today=()=>new Date().toISOString().slice(0,10);
  const vat=v=>r2(n(v)*0.15), gross=v=>r2(n(v)+vat(v));
  const msg=(t,cls)=>{ try{ window.msg?window.msg(t,cls):alert(t); }catch(_){ alert(t); } };
  function ds(){ return window.data || {}; }
  function itemById(id){ return A(ds().inventoryItems).find(x=>S(x.id)===S(id)) || {}; }
  function projectName(id){ const p=A(ds().projects).find(x=>S(x.id)===S(id)); return p?(p.name||p.project_name||p.title||id):(id||'بدون مشروع'); }
  function itemCode(i){ return i?.product_code||i?.serial_number||i?.barcode||''; }
  function unitCost(i){ return n(i?.unit_cost||i?.price_before_vat||i?.unit_before||i?.price||0); }
  function movementCost(m){ const it=itemById(m.item_id); return n(m.unit_cost||m.unit_cost_override||it.unit_cost||0); }
  function isOutType(t){ return ['out','consume','استهلاك','صرف'].includes(S(t)); }
  function isReturnType(t){ return ['return','مرتجع','إرجاع'].includes(S(t)); }
  function parentIdOf(m){ return (S(m.notes).match(/\[PARENT:([^\]]+)\]/)||[])[1] || ''; }
  function isParentDistributed(m){ return /\[DISTRIBUTED_PARENT\]/.test(S(m.notes)) || /\[DISTRIBUTED_PARENT\]/.test(S(m.reason)); }
  function isChildDistribution(m){ return !!parentIdOf(m) || /\[REPORT_ONLY\]/.test(S(m.notes)); }
  function childRows(parentId){ return A(ds().inventoryMovements).filter(m=>S(parentIdOf(m))===S(parentId)); }
  function projectOptions(selected=''){ return '<option value="">اختر المشروع</option>'+A(ds().projects).map(p=>`<option value="${esc(p.id)}" ${S(selected)===S(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join(''); }

  function ensureCss(){
    if($('v345FinanceCss')) return;
    const st=document.createElement('style'); st.id='v345FinanceCss'; st.textContent=`
    .v345-modal{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.46);display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto;direction:rtl}.v345-panel{width:min(1240px,98vw);background:#fff;border:1px solid #d7e8e2;border-radius:24px;padding:16px;box-shadow:0 20px 70px rgba(0,0,0,.24)}.v345-head{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #dcebe6;padding-bottom:10px;margin-bottom:12px}.v345-head h2{margin:0;color:#064a3a}.v345-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.v345-box{border:1px solid #dbeae5;background:#f8fcfa;border-radius:16px;padding:11px}.v345-box small{display:block;color:#687b75}.v345-box b{font-size:18px;color:#064a3a}.v345-table{width:100%;border-collapse:collapse;margin-top:12px}.v345-table th{background:#064a3a;color:white;padding:8px}.v345-table td,.v345-table tfoot th{border:1px solid #dce8e4;padding:8px;text-align:center}.v345-table tfoot th{background:#f2faf6;color:#064a3a}.v345-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.v345-btn{border:0;border-radius:11px;background:#064a3a;color:#fff;padding:8px 12px;font-weight:900;cursor:pointer}.v345-btn.light{background:#eef7f3;color:#064a3a;border:1px solid #cfe2dc}.v345-btn.danger{background:#c2383d}.v345-note{background:#fff8e7;border:1px dashed #d9ad35;border-radius:14px;padding:10px;color:#674a00;margin:10px 0}.v345-split-row{display:grid;grid-template-columns:1.35fr .8fr .85fr .85fr 1.2fr auto;gap:8px;align-items:end;border:1px solid #e0eee9;border-radius:14px;padding:10px;margin:8px 0}.v345-split-row label{font-size:12px;color:#536b63;display:block;margin-bottom:4px}.v345-split-row input,.v345-split-row select{width:100%;border:1px solid #d5e6e0;border-radius:10px;padding:8px;background:#fff;box-sizing:border-box}.v345-pill{display:inline-flex;border-radius:999px;padding:5px 9px;background:#eaf7ef;color:#087047;font-weight:900}.v345-print-tools{display:flex;justify-content:flex-end;gap:8px;margin:8px 0}.v345-total-row td{background:#f2faf6!important;color:#064a3a;font-weight:900}.v345-fifo-ok{background:#eaf7ef;color:#087047;border-radius:999px;padding:5px 9px;font-weight:900}.v345-fifo-used{background:#fff4df;color:#a36300;border-radius:999px;padding:5px 9px;font-weight:900}@media(max-width:900px){.v345-grid{grid-template-columns:1fr 1fr}.v345-split-row{grid-template-columns:1fr 1fr}.v345-panel{padding:12px}}`;
    document.head.appendChild(st);
  }
  function modal(title,html){ ensureCss(); document.querySelector('.v345-modal')?.remove(); document.querySelector('.v344-modal')?.remove(); const d=document.createElement('div'); d.className='v345-modal'; d.innerHTML=`<div class="v345-panel"><div class="v345-head"><h2>${esc(title)}</h2><button class="v345-btn danger" onclick="this.closest('.v345-modal').remove()">إغلاق</button></div>${html}</div>`; document.body.appendChild(d); }

  function nextProductCode(){
    let max=0; A(ds().inventoryItems).forEach(i=>{ const c=S(itemCode(i)); const m=c.match(/PRD-(\d+)/i); if(m) max=Math.max(max,Number(m[1])); });
    return 'PRD-'+String(max+1).padStart(5,'0');
  }
  function ensureAutoCode(){
    const serial=$('inventoryItemSerial') || $('inventoryItemCode') || $('productCode');
    if(serial && !S(serial.value).trim()) serial.value=nextProductCode();
  }

  function allMovementsForItem(itemId){ return A(ds().inventoryMovements).filter(m=>S(m.item_id)===S(itemId)); }
  function fifoBatches(item){
    const itemId=item.id;
    let inRows=allMovementsForItem(itemId).filter(m=>S(m.movement_type)==='in').sort((a,b)=>S(a.movement_date||a.created_at).localeCompare(S(b.movement_date||b.created_at)) || n(a.id)-n(b.id));
    let batches=inRows.map((m,idx)=>({
      no:'الدفعة '+(idx+1), ref:'MOV-'+m.id, date:m.movement_date||S(m.created_at).slice(0,10)||'-', supplier:m.receiver||item.supplier||'-', inQty:n(m.quantity), before:movementCost(m)||unitCost(item)
    }));
    const current=n(item.quantity);
    const entered=batches.reduce((a,b)=>a+b.inQty,0);
    if(!batches.length){ batches.push({no:'الدفعة 1',ref:'الرصيد الافتتاحي/الحالي',date:'-',supplier:item.supplier||'-',inQty:Math.max(current, n(item.initial_quantity||item.opening_quantity||current)),before:unitCost(item)}); }
    else if(current>entered){ batches.unshift({no:'دفعة افتتاحية',ref:'فرق رصيد سابق',date:'-',supplier:item.supplier||'-',inQty:r2(current-entered),before:unitCost(item)}); }
    let netOut=0;
    allMovementsForItem(itemId).forEach(m=>{
      if(isParentDistributed(m)) return;
      if(isOutType(m.movement_type)) netOut += n(m.quantity);
      if(isReturnType(m.movement_type)) netOut -= n(m.quantity);
    });
    netOut=Math.max(0,netOut);
    batches=batches.map(b=>{ const used=Math.min(b.inQty, netOut); netOut=r2(netOut-used); const remain=r2(b.inQty-used); return {...b, used, remain, unitVat:vat(b.before), after:gross(b.before), totalBefore:b.remainBefore||r2(remain*b.before), totalVat:vat(remain*b.before), totalAfter:gross(remain*b.before)}; });
    // If data history is incomplete, force remaining total to match product quantity by correcting the last batch.
    const remSum=batches.reduce((a,b)=>a+n(b.remain),0);
    const diff=r2(current-remSum);
    if(Math.abs(diff)>0.001 && batches.length){ const last=batches[batches.length-1]; last.remain=r2(n(last.remain)+diff); last.totalBefore=r2(last.remain*last.before); last.totalVat=vat(last.totalBefore); last.totalAfter=gross(last.totalBefore); }
    return batches;
  }
  function fifoCostForQty(itemId,qty){
    const item=itemById(itemId); const batches=fifoBatches(item).filter(b=>n(b.remain)>0); let need=n(qty), total=0, taken=0;
    for(const b of batches){ if(need<=0) break; const q=Math.min(need,n(b.remain)); total+=q*n(b.before); taken+=q; need=r2(need-q); }
    if(need>0){ total+=need*unitCost(item); taken+=need; }
    return taken? r2(total/taken) : unitCost(item);
  }

  function renderProductDetail(id){
    const item=itemById(id); if(!item.id && !item.name) return msg('المنتج غير موجود','err');
    const batches=fifoBatches(item);
    const rows=batches.map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.no)}</td><td>${esc(b.ref)}</td><td>${esc(b.date)}</td><td>${esc(b.supplier)}</td><td>${n(b.inQty)}</td><td>${n(b.used)}</td><td>${n(b.remain)}</td><td>${money(b.before)}</td><td>${money(b.unitVat)}</td><td>${money(b.after)}</td><td>${money(b.totalBefore)}</td><td>${money(b.totalVat)}</td><td>${money(b.totalAfter)}</td><td>${n(b.remain)>0?'<span class="v345-fifo-ok">متبقي</span>':'<span class="v345-fifo-used">مصروف</span>'}</td></tr>`).join('');
    const sub=batches.reduce((a,b)=>a+n(b.totalBefore),0), tx=batches.reduce((a,b)=>a+n(b.totalVat),0), gr=batches.reduce((a,b)=>a+n(b.totalAfter),0);
    const img=item.image_url?`<img src="${esc(item.image_url)}" style="width:160px;height:160px;object-fit:contain;border:1px solid #dce8e4;border-radius:18px;background:#fff">`:'';
    modal('عرض المنتج: '+(item.name||''), `<div class="v345-grid"><div class="v345-box"><small>الكود الداخلي التلقائي</small><b>${esc(itemCode(item)||'-')}</b></div><div class="v345-box"><small>اسم المنتج</small><b>${esc(item.name||'-')}</b></div><div class="v345-box"><small>المتوفر الآن</small><b>${n(item.quantity)} ${esc(item.unit||'')}</b></div><div class="v345-box"><small>سعر الحبة الحالي قبل الضريبة</small><b>${money(unitCost(item))}</b></div><div class="v345-box"><small>المورد</small><b>${esc(item.supplier||'-')}</b></div><div class="v345-box"><small>التصنيف</small><b>${esc(item.category||'-')}</b></div><div class="v345-box"><small>إجمالي المتبقي قبل الضريبة</small><b>${money(sub)}</b></div><div class="v345-box"><small>إجمالي المتبقي شامل</small><b>${money(gr)}</b></div></div>${img?`<div style="margin:12px 0">${img}</div>`:''}<div class="v345-note">نظام الصرف هنا FIFO: الخارج أولًا من الدفعة الأولى، ثم الثانية، ثم الثالثة. يظهر لك المتبقي من كل دفعة وسعر الحبة ومجموعها.</div><table class="v345-table"><thead><tr><th>#</th><th>الدفعة</th><th>المرجع</th><th>التاريخ</th><th>المورد</th><th>دخل</th><th>مصروف FIFO</th><th>متبقي</th><th>سعر الحبة قبل الضريبة</th><th>ضريبة الحبة</th><th>سعر الحبة شامل</th><th>إجمالي المتبقي قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="11">إجمالي المتبقي</th><th>${money(sub)}</th><th>${money(tx)}</th><th>${money(gr)}</th><th></th></tr></tfoot></table>`);
  }
  window.inventoryViewProductV344=renderProductDetail;
  window.inventoryOpenItemSmart=renderProductDetail;
  window.v118ShowProductDetail=renderProductDetail;

  function renderMovements(){
    const b=$('inventoryMovementsBody'); if(!b) return;
    let rows=A(ds().inventoryMovements).filter(m=>!isChildDistribution(m));
    try{ if(typeof financeFilterRows==='function') rows=financeFilterRows(rows,'movement_date'); }catch(_){ }
    const head=b.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>التاريخ</th><th>المنتج</th><th>نوع الحركة</th><th>الكمية</th><th>المشروع</th><th>المستلم</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل</th><th>إجراء</th></tr>';
    b.innerHTML=rows.map(m=>{ const it=itemById(m.item_id); const cost=movementCost(m); const amount=cost*n(m.quantity); const type=isReturnType(m.movement_type)?'مرتجع':(S(m.movement_type)==='in'?'إدخال':(isOutType(m.movement_type)?'صرف':'تعديل')); const cls=isReturnType(m.movement_type)||S(m.movement_type)==='in'?'green':(isOutType(m.movement_type)?'amber':''); const dist=isOutType(m.movement_type)?`<button class="light" onclick="inventoryShowMovementV345('${esc(m.id)}')">عرض / توزيع</button>`:`<button class="light" onclick="inventoryPrintMovement&&inventoryPrintMovement('${esc(m.id)}')">طباعة</button>`; return `<tr><td>${esc(m.movement_date||'')}</td><td><b>${esc(m.item_name||it.name||'')}</b><br><small>${esc(itemCode(it)||m.product_code||'')}</small></td><td><span class="badge ${cls}">${type}</span>${isParentDistributed(m)?'<br><small class="muted">موزع على مشاريع</small>':''}</td><td>${n(m.quantity)}</td><td>${esc(m.project_name||projectName(m.project_id)||'-')}</td><td>${esc(m.receiver||'-')}</td><td>${money(amount)}</td><td>${money(vat(amount))}</td><td>${money(gross(amount))}</td><td class="row-actions">${dist}<button class="danger" onclick="financeDelete('inventory_movements','${esc(m.id)}',true)">حذف</button></td></tr>`; }).join('')||'<tr><td colspan="10">لا توجد حركة مخزون</td></tr>';
  }

  window.inventoryShowMovementV345=function(id){
    const m=A(ds().inventoryMovements).find(x=>S(x.id)===S(id)); if(!m) return msg('الحركة غير موجودة','err');
    const it=itemById(m.item_id); const children=childRows(id); const rows=children.length?children:[m];
    const lines=rows.map(r=>{ const isRet=isReturnType(r.movement_type); const c=movementCost(r)||movementCost(m)||fifoCostForQty(m.item_id,r.quantity); return `<div class="v345-split-row" data-v345-line="1"><div><label>المشروع</label><select class="v345-project">${projectOptions(r.project_id)}</select></div><div><label>الكمية</label><input class="v345-qty" type="number" step="0.01" value="${n(r.quantity)}"></div><div><label>نوع الحركة</label><select class="v345-type"><option value="out" ${!isRet?'selected':''}>صرف / استهلاك</option><option value="return" ${isRet?'selected':''}>مرتجع للمخزن</option></select></div><div><label>سعر الحبة قبل الضريبة</label><input class="v345-cost" type="number" step="0.01" value="${c}"></div><div><label>ملاحظات</label><input class="v345-note-input" value="${esc(S(r.notes).replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim())}" placeholder="ملاحظة اختيارية"></div><button class="v345-btn danger" type="button" onclick="this.closest('[data-v345-line]').remove()">حذف</button></div>`; }).join('');
    modal('عرض وتوزيع حركة المخزون MOV-'+id, `<div class="v345-grid"><div class="v345-box"><small>المنتج</small><b>${esc(m.item_name||it.name||'')}</b></div><div class="v345-box"><small>الكمية الأصلية</small><b>${n(m.quantity)}</b></div><div class="v345-box"><small>تكلفة FIFO المقترحة</small><b>${money(fifoCostForQty(m.item_id,m.quantity))}</b></div><div class="v345-box"><small>الحركة</small><b>MOV-${esc(id)}</b></div></div><div class="v345-note">وزّع الكمية على أكثر من مشروع، ويمكن تعديل سعر الحبة لكل سطر. أي كمية لا تسجلها كمرتجع تبقى صرف/استهلاك. المرتجع يرجع للمخزن ولا يظهر في تكلفة المشاريع.</div><div id="v345SplitLines">${lines}</div><div class="v345-actions"><button class="v345-btn light" onclick="inventoryAddSplitLineV345('${esc(m.item_id)}')">+ إضافة مشروع</button><button class="v345-btn" onclick="inventorySaveMovementSplitV345('${esc(id)}',this)">حفظ التوزيع</button></div>`);
  };
  window.inventoryAddSplitLineV345=function(itemId){ const box=$('v345SplitLines'); if(!box) return; const c=fifoCostForQty(itemId,1); box.insertAdjacentHTML('beforeend', `<div class="v345-split-row" data-v345-line="1"><div><label>المشروع</label><select class="v345-project">${projectOptions()}</select></div><div><label>الكمية</label><input class="v345-qty" type="number" step="0.01" value="1"></div><div><label>نوع الحركة</label><select class="v345-type"><option value="out">صرف / استهلاك</option><option value="return">مرتجع للمخزن</option></select></div><div><label>سعر الحبة قبل الضريبة</label><input class="v345-cost" type="number" step="0.01" value="${c}"></div><div><label>ملاحظات</label><input class="v345-note-input" placeholder="ملاحظة اختيارية"></div><button class="v345-btn danger" type="button" onclick="this.closest('[data-v345-line]').remove()">حذف</button></div>`); };
  window.inventorySaveMovementSplitV345=async function(id,btn){
    try{
      if(btn) btn.disabled=true;
      const m=A(ds().inventoryMovements).find(x=>S(x.id)===S(id)); if(!m) throw new Error('الحركة غير موجودة');
      const originalQty=n(m.quantity);
      const lines=[...document.querySelectorAll('#v345SplitLines [data-v345-line]')].map(el=>({project_id:el.querySelector('.v345-project')?.value||'', qty:n(el.querySelector('.v345-qty')?.value), type:el.querySelector('.v345-type')?.value||'out', cost:n(el.querySelector('.v345-cost')?.value), note:el.querySelector('.v345-note-input')?.value||''})).filter(x=>x.qty>0);
      if(!lines.length) throw new Error('أضف توزيع واحد على الأقل');
      for(const l of lines){ if(!l.project_id) throw new Error('اختر المشروع لكل سطر'); if(l.cost<=0) l.cost=movementCost(m)||fifoCostForQty(m.item_id,l.qty); }
      const total=lines.reduce((a,l)=>a+l.qty,0); if(total>originalQty+0.0001) throw new Error('مجموع الصرف والمرتجع أكبر من كمية الحركة الأصلية');
      const remaining=r2(originalQty-total); if(remaining>0){ if(!m.project_id) throw new Error('يوجد باقي صرف ولا يوجد مشروع أصلي للحركة؛ وزع كل الكمية يدويًا'); lines.push({project_id:m.project_id,qty:remaining,type:'out',cost:movementCost(m)||fifoCostForQty(m.item_id,remaining),note:'باقي صرف على المشروع الأصلي'}); }
      const prev=childRows(id); const prevReturn=prev.filter(x=>isReturnType(x.movement_type)).reduce((a,x)=>a+n(x.quantity),0);
      if(prev.length){ const del=await sb.from('inventory_movements').delete().in('id',prev.map(x=>x.id)); if(del.error) throw del.error; }
      const it=itemById(m.item_id);
      const rows=lines.map(l=>({ item_id:Number(m.item_id), item_name:m.item_name||it.name||'', movement_type:l.type==='return'?'return':'out', quantity:l.qty, movement_date:m.movement_date||today(), project_id:Number(l.project_id), project_name:projectName(l.project_id), receiver:m.receiver||'', reason:(l.type==='return'?'مرتجع من حركة ':'توزيع صرف من حركة ')+'MOV-'+id, notes:`[PARENT:${id}][REPORT_ONLY] ${l.note||''}`.trim(), product_code:itemCode(it), unit_cost:l.cost }));
      const ins=await sb.from('inventory_movements').insert(rows); if(ins.error) throw ins.error;
      const newReturn=lines.filter(l=>l.type==='return').reduce((a,l)=>a+l.qty,0); const deltaReturn=r2(newReturn-prevReturn);
      if(deltaReturn){ const upd=await sb.from('inventory_items').update({quantity:r2(n(it.quantity)+deltaReturn)}).eq('id',m.item_id); if(upd.error) throw upd.error; }
      const baseNotes=S(m.notes).replace(/\[DISTRIBUTED_PARENT\]/g,'').trim(); const updParent=await sb.from('inventory_movements').update({notes:(baseNotes+' [DISTRIBUTED_PARENT]').trim()}).eq('id',id); if(updParent.error) throw updParent.error;
      msg('تم حفظ التوزيع وتحديث تكلفة المشاريع'); document.querySelector('.v345-modal')?.remove(); if(typeof financeLoadAll==='function') await financeLoadAll(); else location.reload();
    }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
  };

  async function saveMovement(btn){
    try{
      if(btn) btn.disabled=true;
      const itemId=$('inventoryMovementItem')?.value; if(!itemId) throw new Error('اختر الصنف');
      const item=itemById(itemId); const type=$('inventoryMovementType')?.value||'out', qty=n($('inventoryMovementQty')?.value); if(qty<=0) throw new Error('الكمية مطلوبة');
      if(isOutType(type) && qty>n(item.quantity)+0.0001) throw new Error('الكمية أكبر من المتوفر في المخزون');
      const pid=$('inventoryMovementProject')?.value||null; const cost=(isOutType(type)||S(type)==='consume')?fifoCostForQty(itemId,qty):unitCost(item);
      const row={item_id:Number(itemId),item_name:item?.name||'',movement_type:type,quantity:qty,movement_date:$('inventoryMovementDate')?.value||today(),project_id:pid?Number(pid):null,project_name:pid?projectName(pid):'',receiver:$('inventoryMovementReceiver')?.value||'',reason:$('inventoryMovementReason')?.value||'',notes:$('inventoryMovementNotes')?.value||'',product_code:itemCode(item),unit_cost:cost};
      if($('inventoryMovementId')?.value) throw new Error('تعديل حركة المخزون غير متاح؛ احذف الحركة وأضف حركة جديدة للحفاظ على دقة الرصيد');
      const res=await sb.from('inventory_movements').insert(row); if(res.error) throw res.error;
      let newQty=n(item?.quantity); if(type==='in') newQty+=qty; else if(isOutType(type)) newQty-=qty; else if(isReturnType(type)) newQty+=qty; else if(type==='adjust') newQty=qty;
      const upd=await sb.from('inventory_items').update({quantity:r2(newQty)}).eq('id',itemId); if(upd.error) throw upd.error;
      msg('تم حفظ حركة المخزون بتكلفة FIFO وتحديث الرصيد'); if(typeof inventoryClearMovementForm==='function') inventoryClearMovementForm(); await financeLoadAll();
    }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
  }

  function usageRows(){
    const rows=[];
    // Source of truth: inventory movements. Parent distributed rows are hidden to avoid double-counting; returns are not cost rows.
    A(ds().inventoryMovements).filter(m=>isOutType(m.movement_type)&&!isParentDistributed(m)).forEach(m=>{
      const it=itemById(m.item_id); const q=n(m.quantity); if(q<=0) return; const cost=movementCost(m)||fifoCostForQty(m.item_id,q); const val=r2(cost*q);
      rows.push({date:m.movement_date||'',project:m.project_name||projectName(m.project_id),person:m.receiver||'',item_id:m.item_id,item:m.item_name||it.name,code:m.product_code||itemCode(it),supplier:it.supplier||'',unit_cost:cost,out:q,returned:0,consumed:q,before:val,vat:vat(val),after:gross(val),type:isChildDistribution(m)?'توزيع صرف على مشروع':'صرف مباشر من المخزون',reason:S(m.reason||m.notes||'').replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim(),ref:'MOV-'+m.id,current:n(it.quantity)});
    });
    // Fallback: approved request without generated movement only.
    A(ds().inventoryRequests).filter(r=>r.status==='approved').forEach(r=>{
      if(A(ds().inventoryMovements).some(m=>S(m.request_id)===S(r.id))) return;
      const lines=A(r.request_items||r.items||[]); const real=lines.length?lines:[{item_id:r.item_id,item_name:r.item_name,quantity:r.quantity,unit_cost:r.unit_cost}];
      real.forEach(l=>{ const it=itemById(l.item_id); const q=n(l.quantity); if(q<=0) return; const cost=n(l.unit_cost||it.unit_cost); const val=r2(cost*q); rows.push({date:r.request_date||'',project:r.project_name||projectName(r.project_id),person:r.supervisor_name||'',item_id:l.item_id,item:l.item_name||it.name,code:l.product_code||itemCode(it),supplier:it.supplier||'',unit_cost:cost,out:q,returned:0,consumed:q,before:val,vat:vat(val),after:gross(val),type:'أمر صرف معتمد',reason:r.reason||r.notes||'',ref:'REQ-'+r.id,current:n(it.quantity)}); });
    });
    return rows;
  }
  function totalRow(cols,label,rows){ const sub=rows.reduce((a,b)=>a+n(b.before||b.val),0), tx=rows.reduce((a,b)=>a+n(b.vat),0), gr=rows.reduce((a,b)=>a+n(b.after||b.gross),0); return `<tr class="v345-total-row"><td colspan="${cols}">${label}</td><td>${money(sub)}</td><td>${money(tx)}</td><td>${money(gr)}</td><td></td></tr>`; }
  function ensurePrintButton(bodyId,title){
    const body=$(bodyId); if(!body) return; const table=body.closest('table'); if(!table || table.dataset.v345Print) return; table.dataset.v345Print='1';
    const tools=document.createElement('div'); tools.className='v345-print-tools'; tools.innerHTML=`<button type="button" class="light" onclick="v345PrintTable('${bodyId}','${esc(title)}')">طباعة PDF</button>`; table.parentElement.insertBefore(tools,table);
  }
  window.v345PrintTable=function(bodyId,title){
    const body=$(bodyId), table=body?.closest('table'); if(!table) return;
    const w=window.open('','_blank'); if(!w) return msg('اسمح بفتح النوافذ للطباعة','err');
    w.document.write(`<html dir="rtl"><head><title>${esc(title)}</title><style>body{font-family:Arial;padding:20px;color:#063f33}h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#064a3a;color:#fff}td,th{border:1px solid #ccdcd6;padding:7px;text-align:center}.v345-total-row td{background:#f2faf6;font-weight:bold}</style></head><body><h2>${esc(title)}</h2>${table.outerHTML}</body></html>`); w.document.close(); setTimeout(()=>{w.print();},400);
  };

  function renderReports(){
    const usage=usageRows();
    const sp=$('stockOutByProjectBody'); if(sp){
      const head=sp.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>المشروع</th><th>المنتج</th><th>سعر الحبة</th><th>الكمية المصروفة</th><th>المرتجع</th><th>الصافي</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th><th>ملاحظة</th></tr>';
      sp.innerHTML=usage.map(v=>`<tr><td>${esc(v.project||'-')}</td><td>${esc(v.code||'')} - <b>${esc(v.item||'-')}</b></td><td>${money(v.unit_cost)}</td><td>${n(v.out)}</td><td>0</td><td>${n(v.consumed)}</td><td>${money(v.before)}</td><td>${money(v.vat)}</td><td>${money(v.after)}</td><td>${esc(v.reason||'-')}</td></tr>`).join('')||'<tr><td colspan="10">لا توجد تكلفة مشاريع</td></tr>';
      if(usage.length) sp.insertAdjacentHTML('beforeend', totalRow(6,'إجمالي تكلفة المشاريع',usage)); ensurePrintButton('stockOutByProjectBody','تقرير تكلفة المشاريع');
    }
    const sr=$('stockOutBySupervisorBody'); if(sr){
      const head=sr.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>المستلم / المشرف</th><th>المشروع</th><th>المنتج</th><th>سعر الحبة</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th><th>المرجع</th></tr>';
      sr.innerHTML=usage.map(v=>`<tr><td>${esc(v.person||'-')}</td><td>${esc(v.project||'-')}</td><td>${esc(v.code||'')} - <b>${esc(v.item||'-')}</b></td><td>${money(v.unit_cost)}</td><td>${n(v.consumed)}</td><td>${money(v.before)}</td><td>${money(v.vat)}</td><td>${money(v.after)}</td><td>${esc(v.ref)}</td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';
      if(usage.length) sr.insertAdjacentHTML('beforeend', totalRow(5,'الإجمالي',usage)); ensurePrintButton('stockOutBySupervisorBody','تقرير الصرف حسب المشرف');
    }
    const ud=$('inventoryUsageDetailBody'); if(ud){
      const head=ud.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>التاريخ</th><th>المشروع</th><th>المستلم</th><th>الكود</th><th>المنتج</th><th>المورد</th><th>سعر الحبة</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th><th>النوع</th><th>المرجع</th></tr>';
      ud.innerHTML=usage.sort((a,b)=>S(b.date).localeCompare(S(a.date))).map(v=>`<tr><td>${esc(v.date)}</td><td>${esc(v.project)}</td><td>${esc(v.person||'-')}</td><td>${esc(v.code||'-')}</td><td><b>${esc(v.item||'-')}</b></td><td>${esc(v.supplier||'-')}</td><td>${money(v.unit_cost)}</td><td>${n(v.consumed)}</td><td>${money(v.before)}</td><td>${money(v.vat)}</td><td>${money(v.after)}</td><td>${esc(v.type)}</td><td>${esc(v.ref)}</td></tr>`).join('')||'<tr><td colspan="13">لا توجد بيانات استهلاك</td></tr>';
      if(usage.length) ud.insertAdjacentHTML('beforeend', totalRow(8,'إجمالي الاستهلاك',usage)); ensurePrintButton('inventoryUsageDetailBody','تقرير الاستهلاك التفصيلي');
    }
    const stock=$('stockReportBody'); if(stock){
      const items=A(ds().inventoryItems).filter(i=>n(i.quantity)>0); const head=stock.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>الكود</th><th>المنتج</th><th>المتوفر</th><th>سعر الحبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th></tr>';
      stock.innerHTML=items.map(i=>{ const val=n(i.quantity)*unitCost(i); return `<tr><td>${esc(itemCode(i)||'-')}</td><td><b>${esc(i.name||'')}</b></td><td>${n(i.quantity)}</td><td>${money(unitCost(i))}</td><td>${money(val)}</td><td>${money(vat(val))}</td><td>${money(gross(val))}</td></tr>`; }).join('')||'<tr><td colspan="7">لا توجد منتجات متوفرة</td></tr>';
      const rows=items.map(i=>{ const before=n(i.quantity)*unitCost(i); return {before,vat:vat(before),after:gross(before)}; }); if(rows.length) stock.insertAdjacentHTML('beforeend', totalRow(4,'إجمالي قيمة المخزون المتوفر',rows)); ensurePrintButton('stockReportBody','تقرير المخزون');
    }
  }

  function hookSaveItem(){
    if(window.inventorySaveItem && !window.inventorySaveItem.v345Wrapped){
      const old=window.inventorySaveItem;
      window.inventorySaveItem=async function(btn){ ensureAutoCode(); return old.apply(this,arguments); };
      window.inventorySaveItem.v345Wrapped=true;
    }
  }
  function boot(){
    try{
      ensureCss(); hookSaveItem(); window.inventorySaveMovement=saveMovement; window.inventoryRenderMovements=renderMovements;
      const oldReports=window.financeRenderReports; window.financeRenderReports=function(){ try{ if(oldReports) oldReports.apply(this,arguments); }catch(e){ console.warn(e); } setTimeout(renderReports,20); };
      const oldAll=window.financeRenderAll; window.financeRenderAll=function(){ const out=oldAll?oldAll.apply(this,arguments):undefined; setTimeout(()=>{ hookSaveItem(); renderMovements(); renderReports(); },160); return out; };
      const oldLoad=window.financeLoadAll; if(oldLoad && !oldLoad.v345Wrapped){ window.financeLoadAll=async function(){ const out=await oldLoad.apply(this,arguments); setTimeout(()=>{ hookSaveItem(); renderMovements(); renderReports(); },180); return out; }; window.financeLoadAll.v345Wrapped=true; }
      document.addEventListener('focusin',e=>{ if(['inventoryItemSerial','inventoryItemCode','productCode'].includes(e.target?.id)) ensureAutoCode(); });
      document.addEventListener('input',e=>{ if(['inventoryReportSupplier','inventoryReportProduct','inventoryReportPerson','financeSearch'].includes(e.target?.id)) setTimeout(renderReports,40); });
      if(window.financeRenderAll) window.financeRenderAll();
    }catch(e){ console.warn('v345 boot',e); }
  }
  window.addEventListener('load',()=>setTimeout(boot,1000));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1000));
  setTimeout(boot,1800);
  console.log('Tasneef '+BUILD+' loaded');
})();
