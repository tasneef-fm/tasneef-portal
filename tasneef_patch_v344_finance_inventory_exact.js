/* TASNEEF v344 - Finance & Inventory exact workflow
   - Hide zero-stock products from warehouse report/list
   - Product view: batches 1/2/3, unit before VAT, VAT, after VAT, totals
   - Movement view: distribute one stock-out movement across many projects, with returns
   - Reports: before VAT / VAT / after VAT, returns excluded from project cost
*/
(function(){
  'use strict';
  if(window.__tasneefV344FinanceInventoryExact) return; window.__tasneefV344FinanceInventoryExact=true;
  const BUILD='v344-finance-inventory-exact';
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
  function itemCode(i){ return i.product_code||i.code||i.serial_number||i.barcode||''; }
  function unitCost(i){ return n(i.unit_cost||i.price_before_vat||i.unit_before||i.price||0); }
  function movementCost(m){ const it=itemById(m.item_id); return n(m.unit_cost||m.unit_cost_override||it.unit_cost||0); }
  function isParentDistributed(m){ return /\[DISTRIBUTED_PARENT\]/.test(S(m.notes)) || /\[DISTRIBUTED_PARENT\]/.test(S(m.reason)); }
  function parentIdOf(m){ return (S(m.notes).match(/\[PARENT:([^\]]+)\]/)||[])[1] || ''; }
  function isChildDistribution(m){ return !!parentIdOf(m) || /\[REPORT_ONLY\]/.test(S(m.notes)); }
  function isOutType(t){ return ['out','consume','استهلاك','صرف'].includes(S(t)); }
  function isReturnType(t){ return ['return','مرتجع'].includes(S(t)); }

  function ensureCss(){
    if($('v344FinanceCss')) return;
    const st=document.createElement('style'); st.id='v344FinanceCss'; st.textContent=`
    .v344-modal{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.46);display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto;direction:rtl}.v344-panel{width:min(1180px,98vw);background:#fff;border:1px solid #d7e8e2;border-radius:24px;padding:16px;box-shadow:0 20px 70px rgba(0,0,0,.24)}.v344-head{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #dcebe6;padding-bottom:10px;margin-bottom:12px}.v344-head h2{margin:0;color:#064a3a}.v344-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.v344-box{border:1px solid #dbeae5;background:#f8fcfa;border-radius:16px;padding:11px}.v344-box small{display:block;color:#687b75}.v344-box b{font-size:18px;color:#064a3a}.v344-table{width:100%;border-collapse:collapse;margin-top:12px}.v344-table th{background:#064a3a;color:white;padding:8px}.v344-table td{border:1px solid #dce8e4;padding:8px;text-align:center}.v344-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.v344-btn{border:0;border-radius:11px;background:#064a3a;color:#fff;padding:8px 12px;font-weight:900;cursor:pointer}.v344-btn.light{background:#eef7f3;color:#064a3a;border:1px solid #cfe2dc}.v344-btn.danger{background:#c2383d}.v344-note{background:#fff8e7;border:1px dashed #d9ad35;border-radius:14px;padding:10px;color:#674a00;margin:10px 0}.v344-split-row{display:grid;grid-template-columns:1.5fr 1fr 1fr 1.2fr .9fr auto;gap:8px;align-items:end;border:1px solid #e0eee9;border-radius:14px;padding:10px;margin:8px 0}.v344-split-row label{font-size:12px;color:#536b63;display:block;margin-bottom:4px}.v344-split-row input,.v344-split-row select{width:100%;border:1px solid #d5e6e0;border-radius:10px;padding:8px;background:#fff;box-sizing:border-box}.v344-pill{display:inline-flex;border-radius:999px;padding:5px 9px;background:#eaf7ef;color:#087047;font-weight:900}.v344-pill.warn{background:#fff4df;color:#a36300}.v344-pill.red{background:#ffe8e5;color:#b42318}@media(max-width:900px){.v344-grid{grid-template-columns:1fr 1fr}.v344-split-row{grid-template-columns:1fr 1fr}.v344-panel{padding:12px}}`;
    document.head.appendChild(st);
  }
  function modal(title,html){ ensureCss(); document.querySelector('.v344-modal')?.remove(); const d=document.createElement('div'); d.className='v344-modal'; d.innerHTML=`<div class="v344-panel"><div class="v344-head"><h2>${esc(title)}</h2><button class="v344-btn danger" onclick="this.closest('.v344-modal').remove()">إغلاق</button></div>${html}</div>`; document.body.appendChild(d); }

  function activeItems(){ return A(ds().inventoryItems).filter(i=>n(i.quantity)>0); }
  function projectOptions(selected=''){ return '<option value="">اختر المشروع</option>'+A(ds().projects).map(p=>`<option value="${esc(p.id)}" ${S(selected)===S(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join(''); }

  // Keep product select/list clean: only products with remaining quantity appear for warehouse stock views.
  function renderItemsV344(){
    const b=$('inventoryItemsBody'); if(!b) return;
    const q=S($('financeSearch')?.value).trim().toLowerCase();
    let rows=activeItems();
    if(q) rows=rows.filter(i=>[i.name,itemCode(i),i.category,i.supplier,i.notes].join(' ').toLowerCase().includes(q));
    b.innerHTML=rows.map(i=>{
      const img=i.image_url?`<img src="${esc(i.image_url)}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;background:#fff;border:1px solid #dce8e4">`:'لا توجد';
      const before=unitCost(i), qn=n(i.quantity), total=before*qn;
      return `<tr><td>${img}</td><td>${esc(itemCode(i)||'-')}</td><td><b>${esc(i.name||'')}</b></td><td>${esc(i.category||'')}</td><td>${qn<=n(i.min_quantity)?`<span class="badge red">${qn}</span>`:qn}</td><td>${esc(i.unit||'')}</td><td>${n(i.min_quantity)}</td><td>${money(before)}</td><td>${money(total)}</td><td>${money(vat(total))}</td><td>${money(gross(total))}</td><td>${esc(i.supplier||'-')}</td><td class="row-actions"><button class="light" onclick="inventoryViewProductV344('${esc(i.id)}')">عرض</button><button onclick="inventoryEditItem('${esc(i.id)}')">تعديل</button><button class="danger" onclick="financeDelete('inventory_items','${esc(i.id)}')">حذف</button></td></tr>`;
    }).join('')||'<tr><td colspan="13">لا توجد أصناف متوفرة في المخزون</td></tr>';
    const table=b.closest('table'); const head=table?.querySelector('thead'); if(head) head.innerHTML='<tr><th>الصورة</th><th>الكود</th><th>الصنف</th><th>التصنيف</th><th>المتوفر</th><th>الوحدة</th><th>حد التنبيه</th><th>سعر الحبة قبل الضريبة</th><th>الإجمالي قبل الضريبة</th><th>الضريبة</th><th>الإجمالي شامل</th><th>المورد</th><th>إجراء</th></tr>';
    try{ if(typeof inventoryFillItemSelect==='function') inventoryFillItemSelect(); if(typeof inventoryFillRequestSelect==='function') inventoryFillRequestSelect(); }catch(_){ }
  }

  function productBatches(item){
    const out=[];
    const batches=A(window.stockBatchesV148);
    batches.forEach((b,idx)=>A(b.lines).forEach(l=>{
      if(S(l.item_id)===S(item.id) || S(l.product_code)===S(itemCode(item)) || S(l.item_name)===S(item.name)){
        const q=n(l.quantity), before=n(l.unit_cost||l.price_before_vat||unitCost(item));
        out.push({no:b.invoice_no||('دفعة '+(idx+1)), date:b.batch_date||b.date||'', supplier:b.supplier||item.supplier||'', qty:q, before, unitVat:n(l.unit_vat)||vat(before), after:n(l.unit_gross)||gross(before), totalBefore:n(l.line_net)||before*q, totalVat:n(l.line_vat)||vat(before*q), totalAfter:n(l.line_gross)||gross(before*q)});
      }
    }));
    if(!out.length){
      A(ds().inventoryMovements).filter(m=>S(m.item_id)===S(item.id)&&S(m.movement_type)==='in').forEach((m,idx)=>{ const q=n(m.quantity), before=movementCost(m)||unitCost(item); out.push({no:'دفعة '+(idx+1),date:m.movement_date||'',supplier:m.receiver||item.supplier||'',qty:q,before,unitVat:vat(before),after:gross(before),totalBefore:before*q,totalVat:vat(before*q),totalAfter:gross(before*q)}); });
    }
    if(!out.length){ const q=n(item.quantity), before=unitCost(item); out.push({no:'الرصيد الحالي',date:'-',supplier:item.supplier||'',qty:q,before,unitVat:vat(before),after:gross(before),totalBefore:before*q,totalVat:vat(before*q),totalAfter:gross(before*q)}); }
    return out;
  }
  window.inventoryViewProductV344=function(id){
    const item=itemById(id); if(!item.id && !item.name) return msg('المنتج غير موجود','err');
    const batches=productBatches(item);
    const rows=batches.map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.no)}</td><td>${esc(b.date)}</td><td>${esc(b.supplier||'-')}</td><td>${n(b.qty)}</td><td>${money(b.before)}</td><td>${money(b.unitVat)}</td><td>${money(b.after)}</td><td>${money(b.totalBefore)}</td><td>${money(b.totalVat)}</td><td>${money(b.totalAfter)}</td></tr>`).join('');
    const sub=batches.reduce((a,b)=>a+n(b.totalBefore),0), tx=batches.reduce((a,b)=>a+n(b.totalVat),0), gr=batches.reduce((a,b)=>a+n(b.totalAfter),0);
    modal('عرض المنتج: '+(item.name||''), `<div class="v344-grid"><div class="v344-box"><small>الكود</small><b>${esc(itemCode(item)||'-')}</b></div><div class="v344-box"><small>المتوفر الآن</small><b>${n(item.quantity)} ${esc(item.unit||'')}</b></div><div class="v344-box"><small>سعر الحبة قبل الضريبة</small><b>${money(unitCost(item))}</b></div><div class="v344-box"><small>المورد</small><b>${esc(item.supplier||'-')}</b></div></div><div class="v344-note">هذا العرض يوضح هل المنتج من الدفعة الأولى أو الثانية أو الثالثة، وسعر الحبة، والإجمالي قبل الضريبة والضريبة والشامل.</div><table class="v344-table"><thead><tr><th>#</th><th>الدفعة / الفاتورة</th><th>التاريخ</th><th>المورد</th><th>الكمية</th><th>سعر الحبة قبل الضريبة</th><th>ضريبة الحبة</th><th>سعر الحبة شامل</th><th>الإجمالي قبل الضريبة</th><th>الضريبة</th><th>الإجمالي شامل</th></tr></thead><tbody>${rows}</tbody></table><div class="v344-grid" style="margin-top:12px"><div class="v344-box"><small>إجمالي قبل الضريبة</small><b>${money(sub)}</b></div><div class="v344-box"><small>إجمالي الضريبة</small><b>${money(tx)}</b></div><div class="v344-box"><small>إجمالي شامل الضريبة</small><b>${money(gr)}</b></div><div class="v344-box"><small>المتبقي بقيمة تقريبية</small><b>${money(n(item.quantity)*unitCost(item))}</b></div></div>`);
  };

  function renderMovementsV344(){
    const b=$('inventoryMovementsBody'); if(!b) return;
    let rows=A(ds().inventoryMovements).filter(m=>!isChildDistribution(m));
    try{ if(typeof financeFilterRows==='function') rows=financeFilterRows(rows,'movement_date'); }catch(_){ }
    const head=b.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>التاريخ</th><th>المنتج</th><th>نوع الحركة</th><th>الكمية</th><th>المشروع</th><th>المستلم</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل</th><th>إجراء</th></tr>';
    b.innerHTML=rows.map(m=>{ const it=itemById(m.item_id); const cost=movementCost(m); const amount=cost*n(m.quantity); const type=isReturnType(m.movement_type)?'مرتجع':(S(m.movement_type)==='in'?'إدخال':(isOutType(m.movement_type)?'صرف':'تعديل')); const cls=isReturnType(m.movement_type)?'green':(isOutType(m.movement_type)?'amber':''); const dist=isOutType(m.movement_type)?`<button class="light" onclick="inventoryShowMovementV344('${esc(m.id)}')">عرض / توزيع</button>`:`<button class="light" onclick="inventoryPrintMovement&&inventoryPrintMovement('${esc(m.id)}')">طباعة</button>`; return `<tr><td>${esc(m.movement_date||'')}</td><td><b>${esc(m.item_name||it.name||'')}</b><br><small>${esc(itemCode(it)||m.product_code||'')}</small></td><td><span class="badge ${cls}">${type}</span>${isParentDistributed(m)?'<br><small class="muted">موزع على مشاريع</small>':''}</td><td>${n(m.quantity)}</td><td>${esc(m.project_name||projectName(m.project_id)||'-')}</td><td>${esc(m.receiver||'-')}</td><td>${money(amount)}</td><td>${money(vat(amount))}</td><td>${money(gross(amount))}</td><td class="row-actions">${dist}<button class="danger" onclick="financeDelete('inventory_movements','${esc(m.id)}',true)">حذف</button></td></tr>`; }).join('')||'<tr><td colspan="10">لا توجد حركة مخزون</td></tr>';
  }

  function childRows(parentId){ return A(ds().inventoryMovements).filter(m=>S(parentIdOf(m))===S(parentId)); }
  window.inventoryShowMovementV344=function(id){
    const m=A(ds().inventoryMovements).find(x=>S(x.id)===S(id)); if(!m) return msg('الحركة غير موجودة','err');
    const it=itemById(m.item_id); const children=childRows(id); const rows=children.length?children:[m];
    const lines=rows.map((r,idx)=>{ const isRet=isReturnType(r.movement_type); return `<div class="v344-split-row" data-v344-line="1"><div><label>المشروع</label><select class="v344-project">${projectOptions(r.project_id)}</select></div><div><label>الكمية</label><input class="v344-qty" type="number" step="0.01" value="${n(r.quantity)}"></div><div><label>نوع الحركة</label><select class="v344-type"><option value="out" ${!isRet?'selected':''}>صرف / استهلاك</option><option value="return" ${isRet?'selected':''}>مرتجع للمخزن</option></select></div><div><label>ملاحظات</label><input class="v344-note-input" value="${esc(S(r.notes).replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim())}" placeholder="ملاحظة اختيارية"></div><div><label>التكلفة</label><div class="v344-pill">${money(movementCost(m)*n(r.quantity))}</div></div><button class="v344-btn danger" type="button" onclick="this.closest('[data-v344-line]').remove()">حذف</button></div>`; }).join('');
    modal('عرض وتوزيع حركة المخزون', `<div class="v344-grid"><div class="v344-box"><small>المنتج</small><b>${esc(m.item_name||it.name||'')}</b></div><div class="v344-box"><small>الكمية الأصلية</small><b>${n(m.quantity)}</b></div><div class="v344-box"><small>سعر الحبة</small><b>${money(movementCost(m))}</b></div><div class="v344-box"><small>الحركة</small><b>MOV-${esc(id)}</b></div></div><div class="v344-note">وزّع الكمية على أكثر من مشروع. أي كمية لا تسجلها كمرتجع تبقى صرف/استهلاك. المرتجع يرجع للمخزن ولا يظهر في تكلفة المشاريع.</div><div id="v344SplitLines">${lines}</div><div class="v344-actions"><button class="v344-btn light" onclick="inventoryAddSplitLineV344()">+ إضافة مشروع</button><button class="v344-btn" onclick="inventorySaveMovementSplitV344('${esc(id)}',this)">حفظ التوزيع</button></div>`);
  };
  window.inventoryAddSplitLineV344=function(){ const box=$('v344SplitLines'); if(!box) return; box.insertAdjacentHTML('beforeend', `<div class="v344-split-row" data-v344-line="1"><div><label>المشروع</label><select class="v344-project">${projectOptions()}</select></div><div><label>الكمية</label><input class="v344-qty" type="number" step="0.01" value="1"></div><div><label>نوع الحركة</label><select class="v344-type"><option value="out">صرف / استهلاك</option><option value="return">مرتجع للمخزن</option></select></div><div><label>ملاحظات</label><input class="v344-note-input" placeholder="ملاحظة اختيارية"></div><div><label>التكلفة</label><div class="v344-pill warn">تحسب بعد الحفظ</div></div><button class="v344-btn danger" type="button" onclick="this.closest('[data-v344-line]').remove()">حذف</button></div>`); };

  window.inventorySaveMovementSplitV344=async function(id,btn){
    try{
      if(btn) btn.disabled=true;
      const m=A(ds().inventoryMovements).find(x=>S(x.id)===S(id)); if(!m) throw new Error('الحركة غير موجودة');
      const originalQty=n(m.quantity); const cost=movementCost(m); const lines=[...document.querySelectorAll('#v344SplitLines [data-v344-line]')].map(el=>({project_id:el.querySelector('.v344-project')?.value||'', qty:n(el.querySelector('.v344-qty')?.value), type:el.querySelector('.v344-type')?.value||'out', note:el.querySelector('.v344-note-input')?.value||''})).filter(x=>x.qty>0);
      if(!lines.length) throw new Error('أضف توزيع واحد على الأقل');
      for(const l of lines){ if(!l.project_id) throw new Error('اختر المشروع لكل سطر'); }
      const outQty=lines.filter(l=>l.type==='out').reduce((a,l)=>a+l.qty,0), retQty=lines.filter(l=>l.type==='return').reduce((a,l)=>a+l.qty,0);
      if(outQty+retQty>originalQty+0.0001) throw new Error('مجموع الصرف والمرتجع أكبر من كمية الحركة الأصلية');
      const remaining=r2(originalQty-outQty-retQty);
      if(remaining>0){ lines.push({project_id:m.project_id||'', qty:remaining, type:'out', note:'باقي صرف على المشروع الأصلي'}); if(!lines[lines.length-1].project_id) throw new Error('يوجد باقي صرف ولا يوجد مشروع أصلي للحركة؛ وزع كل الكمية يدويًا'); }
      const prev=childRows(id); const prevReturn=prev.filter(x=>isReturnType(x.movement_type)).reduce((a,x)=>a+n(x.quantity),0);
      if(prev.length){ const ids=prev.map(x=>x.id); const del=await sb.from('inventory_movements').delete().in('id',ids); if(del.error) throw del.error; }
      const rows=lines.map(l=>({ item_id:Number(m.item_id), item_name:m.item_name||itemById(m.item_id).name||'', movement_type:l.type==='return'?'return':'out', quantity:l.qty, movement_date:m.movement_date||today(), project_id:Number(l.project_id), project_name:projectName(l.project_id), receiver:m.receiver||'', reason:(l.type==='return'?'مرتجع من حركة ':'توزيع صرف من حركة ')+'MOV-'+id, notes:`[PARENT:${id}][REPORT_ONLY] ${l.note||''}`.trim() }));
      const ins=await sb.from('inventory_movements').insert(rows); if(ins.error) throw ins.error;
      const newReturn=lines.filter(l=>l.type==='return').reduce((a,l)=>a+l.qty,0); const deltaReturn=r2(newReturn-prevReturn);
      if(deltaReturn){ const it=itemById(m.item_id); const upd=await sb.from('inventory_items').update({quantity:r2(n(it.quantity)+deltaReturn)}).eq('id',m.item_id); if(upd.error) throw upd.error; }
      const baseNotes=S(m.notes).replace(/\[DISTRIBUTED_PARENT\]/g,'').trim(); const updParent=await sb.from('inventory_movements').update({notes:(baseNotes+' [DISTRIBUTED_PARENT]').trim()}).eq('id',id); if(updParent.error) throw updParent.error;
      msg('تم حفظ توزيع الحركة وتحديث التقارير'); document.querySelector('.v344-modal')?.remove(); if(typeof financeLoadAll==='function') await financeLoadAll(); else location.reload();
    }catch(e){ msg(e.message||String(e),'err'); }
    finally{ if(btn) btn.disabled=false; }
  };

  function usageRowsV344(){
    const rows=[];
    // Approved inventory requests: cost only net consumed after returns.
    A(ds().inventoryRequests).filter(r=>r.status==='approved').forEach(r=>{
      const lines=A(r.request_items||r.items||[]); const realLines=lines.length?lines:[{item_id:r.item_id,item_name:r.item_name,quantity:r.quantity,unit_cost:r.unit_cost}];
      realLines.forEach(l=>{ const it=itemById(l.item_id); const returned=A(ds().inventoryMovements).filter(m=>S(m.request_id)===S(r.id)&&S(m.item_id)===S(l.item_id)&&isReturnType(m.movement_type)).reduce((a,m)=>a+n(m.quantity),0); const out=n(l.quantity), consumed=Math.max(0,out-returned); if(consumed<=0) return; const cost=n(l.unit_cost||it.unit_cost); const val=cost*consumed; rows.push({date:r.request_date||'',project:r.project_name||projectName(r.project_id),person:r.supervisor_name||'',item_id:l.item_id,item:l.item_name||it.name,code:l.product_code||itemCode(it),supplier:it.supplier||'',unit_cost:cost,out,returned,consumed,before:val,vat:vat(val),after:gross(val),type:'أمر صرف معتمد',reason:r.reason||r.notes||'',ref:'REQ-'+r.id,current:n(it.quantity)}); });
    });
    A(ds().inventoryMovements).filter(m=>isOutType(m.movement_type)&&!isParentDistributed(m)).forEach(m=>{ const it=itemById(m.item_id); const q=n(m.quantity); if(q<=0) return; const cost=movementCost(m); const val=cost*q; rows.push({date:m.movement_date||'',project:m.project_name||projectName(m.project_id),person:m.receiver||'',item_id:m.item_id,item:m.item_name||it.name,code:m.product_code||itemCode(it),supplier:it.supplier||'',unit_cost:cost,out:q,returned:0,consumed:q,before:val,vat:vat(val),after:gross(val),type:isChildDistribution(m)?'توزيع صرف على مشروع':'صرف مباشر من المخزون',reason:m.reason||m.notes||'',ref:'MOV-'+m.id,current:n(it.quantity)}); });
    return rows;
  }
  function renderReportsV344(){
    const usage=usageRowsV344();
    const sp=$('stockOutByProjectBody'); if(sp){
      const head=sp.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>المشروع</th><th>المنتج</th><th>سعر الحبة</th><th>الكمية المصروفة</th><th>المرتجع</th><th>الصافي</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th></tr>';
      sp.innerHTML=usage.map(v=>`<tr><td>${esc(v.project||'-')}</td><td>${esc(v.code||'')} - <b>${esc(v.item||'-')}</b></td><td>${money(v.unit_cost)}</td><td>${n(v.out)}</td><td>${n(v.returned)}</td><td>${n(v.consumed)}</td><td>${money(v.before)}</td><td>${money(v.vat)}</td><td>${money(v.after)}</td></tr>`).join('')||'<tr><td colspan="9">لا توجد تكلفة مشاريع</td></tr>';
    }
    const ud=$('inventoryUsageDetailBody'); if(ud){
      const head=ud.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>التاريخ</th><th>المشروع</th><th>المستلم</th><th>المنتج</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th><th>النوع</th><th>المرجع</th></tr>';
      ud.innerHTML=usage.sort((a,b)=>S(b.date).localeCompare(S(a.date))).map(v=>`<tr><td>${esc(v.date)}</td><td>${esc(v.project)}</td><td>${esc(v.person||'-')}</td><td>${esc(v.code||'')} - <b>${esc(v.item||'-')}</b></td><td>${n(v.consumed)}</td><td>${money(v.before)}</td><td>${money(v.vat)}</td><td>${money(v.after)}</td><td>${esc(v.type)}</td><td>${esc(v.ref)}</td></tr>`).join('')||'<tr><td colspan="10">لا توجد بيانات استهلاك</td></tr>';
    }
    const stock=$('stockReportBody'); if(stock){
      const items=activeItems(); const head=stock.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>الكود</th><th>المنتج</th><th>المتوفر</th><th>سعر الحبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th></tr>';
      stock.innerHTML=items.map(i=>{ const val=n(i.quantity)*unitCost(i); return `<tr><td>${esc(itemCode(i)||'-')}</td><td><b>${esc(i.name||'')}</b></td><td>${n(i.quantity)}</td><td>${money(unitCost(i))}</td><td>${money(val)}</td><td>${money(vat(val))}</td><td>${money(gross(val))}</td></tr>`; }).join('')||'<tr><td colspan="7">لا توجد منتجات متوفرة</td></tr>';
      const sub=items.reduce((a,i)=>a+n(i.quantity)*unitCost(i),0); if($('stockReportTotals')) $('stockReportTotals').innerHTML=`قبل الضريبة: <b>${money(sub)}</b> | الضريبة: <b>${money(vat(sub))}</b> | شامل الضريبة: <b>${money(gross(sub))}</b>`;
    }
    const ep=$('expenseByProjectBody'); if(ep){
      const head=ep.closest('table')?.querySelector('thead'); if(head) head.innerHTML='<tr><th>المشروع</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th><th>عدد العمليات</th></tr>';
      const map={}; A(ds().financeExpenses).forEach(e=>{ const k=e.project_name||projectName(e.project_id); map[k]=map[k]||{sub:0,vat:0,total:0,count:0}; map[k].sub+=n(e.subtotal||e.total); map[k].vat+=n(e.vat||vat(e.subtotal||e.total)); map[k].total+=n(e.total||gross(e.subtotal)); map[k].count++; });
      ep.innerHTML=Object.entries(map).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v.sub)}</td><td>${money(v.vat)}</td><td>${money(v.total)}</td><td>${v.count}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات</td></tr>';
    }
  }

  function enhanceItemForm(){
    const cost=$('inventoryItemCost'); if(!cost || $('inventoryItemCostBeforeV344')) return;
    const host=cost.closest('div')||cost.parentElement; if(!host) return;
    host.insertAdjacentHTML('afterend', `<div class="split v344-price-row"><div><label>سعر الحبة قبل الضريبة</label><input id="inventoryItemCostBeforeV344" type="number" step="0.01" placeholder="قبل الضريبة"></div><div><label>الضريبة 15%</label><input id="inventoryItemVatV344" type="number" step="0.01" readonly></div><div><label>سعر الحبة شامل الضريبة</label><input id="inventoryItemGrossV344" type="number" step="0.01" placeholder="شامل"></div></div>`);
    const before=$('inventoryItemCostBeforeV344'), tx=$('inventoryItemVatV344'), gr=$('inventoryItemGrossV344');
    const syncFromBefore=()=>{ const v=n(before.value); tx.value=vat(v).toFixed(2); gr.value=gross(v).toFixed(2); cost.value=v.toFixed(2); };
    const syncFromGross=()=>{ const g=n(gr.value); const b=r2(g/1.15); before.value=b.toFixed(2); tx.value=vat(b).toFixed(2); cost.value=b.toFixed(2); };
    before.addEventListener('input',syncFromBefore); gr.addEventListener('input',syncFromGross); cost.addEventListener('input',()=>{ before.value=n(cost.value).toFixed(2); syncFromBefore(); });
  }

  function wrap(){
    // Override core renderers after all old patches. These are final and intentionally simple.
    window.inventoryRenderItems=renderItemsV344;
    window.inventoryRenderMovements=renderMovementsV344;
    const oldReports=window.financeRenderReports;
    window.financeRenderReports=function(){ try{ if(oldReports) oldReports.apply(this,arguments); }catch(e){ console.warn(e); } renderReportsV344(); };
    const oldAll=window.financeRenderAll;
    window.financeRenderAll=function(){ const out=oldAll?oldAll.apply(this,arguments):undefined; setTimeout(()=>{ enhanceItemForm(); renderItemsV344(); renderMovementsV344(); renderReportsV344(); },80); return out; };
    const oldLoad=window.financeLoadAll;
    if(oldLoad && !oldLoad.v344Wrapped){ window.financeLoadAll=async function(){ const out=await oldLoad.apply(this,arguments); setTimeout(()=>{ enhanceItemForm(); renderItemsV344(); renderMovementsV344(); renderReportsV344(); },120); return out; }; window.financeLoadAll.v344Wrapped=true; }
    document.addEventListener('input',e=>{ if(['financeSearch','inventoryReportSupplier','inventoryReportProduct'].includes(e.target?.id)) setTimeout(()=>{renderItemsV344(); renderReportsV344();},30); });
  }
  function boot(){ try{ enhanceItemForm(); wrap(); if(window.financeRenderAll) window.financeRenderAll(); }catch(e){ console.warn('v344 boot',e); } }
  window.addEventListener('load',()=>setTimeout(boot,900));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));
  setTimeout(boot,1600);
  console.log('Tasneef '+BUILD+' loaded');
})();
