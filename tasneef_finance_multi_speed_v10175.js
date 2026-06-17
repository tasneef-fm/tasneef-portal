/* Tasneef v10175 - Finance operations fast save + multi-product movement
   Safe add-on only: does not replace sections, does not remove existing single movement flow.
*/
(function(){
  'use strict';
  const VERSION='v10175-finance-multi-speed';
  if(window.__tasneefFinanceMultiSpeedV10175) return;
  window.__tasneefFinanceMultiSpeedV10175=true;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const VAT=0.15;
  const today=()=>new Date().toISOString().slice(0,10);
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const state=()=>window.financeProStateV15||{};
  const msg=(t,type)=>{try{if(typeof window.msg==='function')window.msg(t,type);}catch(_){}};
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}};
  const currentUserName=()=>{const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||u.id||'');};
  const safeJson=v=>{const t=S(v); if(!t.startsWith('finance_pro_v15:'))return{}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}};
  const itemCode=i=>S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));
  const itemCost=i=>N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));
  const itemType=i=>S(i&&(i.item_type||i.type||i.category))||'مادة';
  const movementOutTypes=()=>['out','consume','waste','damaged','scrap'];
  const moveSign=t=>{t=S(t); if(t==='in'||t==='return')return 1; if(movementOutTypes().includes(t))return -1; return 0;};
  const reasonFor=t=>({return:'مرتجع مخزون',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف مخزون'})[S(t)]||'صرف مخزون';
  const movementTypeLabel=t=>({in:'داخل',out:'صرف',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',return:'مرتجع'})[S(t)]||S(t)||'-';
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const staffName=id=>{const u=A(state().users).find(x=>String(x.id)===String(id)); return S(u&&(u.full_name||u.name||u.username))||S(id)||'-';};

  function rowVat(qty,price,mode='before'){
    const total=N(qty)*N(price); mode=S(mode||'before');
    if(mode==='after'){const net=total/(1+VAT); return {net,vat:total-net,gross:total};}
    if(mode==='none') return {net:total,vat:0,gross:total};
    return {net:total,vat:total*VAT,gross:total*(1+VAT)};
  }
  function unitNetFromLine(l){return S(l.tax_mode)==='after'?N(l.price)/(1+VAT):N(l.price);}
  function productItems(){return A(state().items);}
  function findItem(line){
    const code=S(line.code), dist=S(line.distributor_code), name=S(line.name).toLowerCase();
    return productItems().find(i=>line.existing_item_id&&String(i.id)===String(line.existing_item_id))
      || productItems().find(i=>code&&[i.product_code,i.serial_number,i.barcode,i.code].map(S).includes(code))
      || productItems().find(i=>dist&&[i.supplier_barcode,i.distributor_code].map(S).includes(dist))
      || productItems().find(i=>S(i.name).toLowerCase()===name);
  }
  function patchStateItem(item){
    const st=state(); st.items=Array.isArray(st.items)?st.items:[];
    const idx=st.items.findIndex(i=>String(i.id)===String(item.id));
    if(idx>=0) st.items[idx]={...st.items[idx],...item}; else st.items.push(item);
  }
  function patchStateMovements(rows){
    const st=state(); st.movements=Array.isArray(st.movements)?st.movements:[];
    A(rows).forEach(m=>{
      const idx=st.movements.findIndex(x=>String(x.id)===String(m.id));
      if(idx>=0) st.movements[idx]={...st.movements[idx],...m}; else st.movements.push(m);
    });
  }
  function refreshFinance(){
    try{ if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15(); }
    catch(_){ try{ if(typeof window.financeProTabV15==='function') window.financeProTabV15(state().tab||'movement'); }catch(__){} }
    setTimeout(injectMultiProductUI,80);
  }
  function nextInvoiceNo(){
    let max=0;
    A(state().movements).forEach(m=>{
      const meta=safeJson(m.notes)||{};
      const no=S(meta.invoiceNo||m.invoice_no||'');
      const mt=no.match(/INV[-_ ]?(\d+)/i);
      if(mt) max=Math.max(max,N(mt[1]));
    });
    return 'INV-'+String(max+1).padStart(6,'0');
  }

  async function saveInvoiceFast(btn){
    const started=performance.now();
    try{
      const st=state(), c=client(); if(!c) throw new Error('الاتصال غير جاهز');
      if(btn){btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='حفظ سريع...';}
      const lines=A(st.invoiceLines);
      if(!lines.length) throw new Error('أضف منتج واحد على الأقل داخل الفاتورة');
      const supplier=S($('finInvSupplierV15')?.value);
      const invoiceNo=S($('finInvNoV15')?.value)||nextInvoiceNo();
      const date=S($('finInvDateV15')?.value)||today();
      const movementRows=[];
      const user=currentUserName();
      for(const l of lines){
        const old=findItem(l);
        let item=old;
        const q=N(l.qty), cost=unitNetFromLine(l);
        if(q<=0) throw new Error('كمية غير صحيحة في المنتج: '+S(l.name));
        if(old){
          const oldQty=N(old.quantity), oldCost=itemCost(old), newQty=oldQty+q;
          const avg=newQty>0?((oldQty*oldCost)+(q*cost))/newQty:cost;
          const upd={
            quantity:newQty, unit_cost:+avg.toFixed(4), supplier:supplier||old.supplier,
            unit:l.unit||old.unit||'حبة', item_type:l.item_type||old.item_type||'مادة', type:l.item_type||old.type||'مادة',
            product_code:l.code||old.product_code, serial_number:l.code||old.serial_number, barcode:l.code||old.barcode,
            supplier_barcode:l.distributor_code||old.supplier_barcode, min_quantity:N(l.min_quantity)||N(old.min_quantity)||1
          };
          if(l.image) upd.image_url=l.image;
          const res=await c.from('inventory_items').update(upd).eq('id',old.id).select('*');
          if(res.error) throw res.error;
          item=A(res.data)[0]||{...old,...upd};
          patchStateItem(item);
        }else{
          const ins={
            name:S(l.name), product_code:S(l.code), serial_number:S(l.code), barcode:S(l.code), supplier_barcode:S(l.distributor_code)||S(l.code),
            image_url:S(l.image)||'', unit:S(l.unit)||'حبة', item_type:S(l.item_type)||'مادة', type:S(l.item_type)||'مادة',
            quantity:q, min_quantity:N(l.min_quantity)||1, unit_cost:+cost.toFixed(4), supplier, category:S(l.item_type)||'عام',
            notes:'تمت الإضافة من فاتورة '+invoiceNo
          };
          const res=await c.from('inventory_items').insert(ins).select('*');
          if(res.error) throw res.error;
          item=A(res.data)[0]||ins;
          patchStateItem(item);
        }
        const rv=rowVat(q,l.price,l.tax_mode);
        const meta={module:VERSION,invoiceNo,supplier,supplierInvoiceNo:S(l.supplier_invoice_no),minQuantity:N(l.min_quantity)||1,taxMode:S(l.tax_mode||'before'),beforeVat:+rv.net.toFixed(2),vat:+rv.vat.toFixed(2),afterVat:+rv.gross.toFixed(2),createdBy:user,createdAt:new Date().toISOString()};
        movementRows.push({
          item_id:item.id,item_name:item.name,movement_type:'in',quantity:q,movement_date:date,receiver:supplier,
          reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),
          product_code:S(l.code)||itemCode(item),barcode:S(l.distributor_code)||S(l.code)||itemCode(item),unit_cost:+cost.toFixed(4)
        });
      }
      const mr=await c.from('inventory_movements').insert(movementRows).select('*');
      if(mr.error) throw mr.error;
      patchStateMovements(A(mr.data).length?A(mr.data):movementRows);
      st.invoiceLines=[];
      refreshFinance();
      msg('تم حفظ العملية بسرعة: '+invoiceNo);
      console.log('Tasneef fast invoice operation save', Math.round(performance.now()-started)+'ms');
    }catch(e){alert(e.message||String(e)); msg(e.message||String(e),'err');}
    finally{if(btn){btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ الفاتورة';}}
    return false;
  }

  const cart=[];
  function opNo(){
    let max=0;
    A(state().movements).forEach(m=>{const no=S((safeJson(m.notes)||{}).operationNo); const mt=no.match(/MOV[-_ ]?(\d+)/i); if(mt) max=Math.max(max,N(mt[1]));});
    cart.forEach(r=>{const mt=S(r.operationNo).match(/MOV[-_ ]?(\d+)/i); if(mt) max=Math.max(max,N(mt[1]));});
    return 'MOV-'+String(max+1).padStart(6,'0');
  }
  async function resolveSelectedItem(){
    const val=S($('finMoveItemV15')?.value);
    let item=productItems().find(i=>String(i.id)===String(val));
    if(item) return item;
    if(window.__financeProEnterpriseResolveItemV10174) return window.__financeProEnterpriseResolveItemV10174();
    throw new Error('اختر المنتج');
  }
  function getCurrentDistribution(){return A(state().distribution).map(d=>({...d,qty:N(d.qty)}));}
  function renderCart(){
    const box=$('finMultiCartRows10175'); if(!box) return;
    if(!cart.length){box.innerHTML='<tr><td colspan="9" style="text-align:center;color:#667c75">لم تتم إضافة منتجات للعملية بعد</td></tr>'; return;}
    box.innerHTML=cart.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.item_name)}</td><td>${esc(r.code||'-')}</td><td>${esc(movementTypeLabel(r.type))}</td><td>${N(r.qty)}</td><td>${esc(r.receiver||'-')}</td><td>${esc(r.date||'-')}</td><td>${esc(r.distSummary||'-')}</td><td><button class="danger" type="button" onclick="financeMultiRemoveLine10175(${i})">حذف</button></td></tr>`).join('');
  }
  window.financeMultiRemoveLine10175=function(i){cart.splice(i,1); renderCart();};
  window.financeMultiClear10175=function(){cart.length=0; renderCart();};
  window.financeMultiAddLine10175=async function(btn){
    try{
      if(btn) btn.disabled=true;
      const item=await resolveSelectedItem();
      const qty=N($('finMoveQtyV15')?.value), type=S($('finMoveTypeV15')?.value)||'out';
      if(qty<=0) throw new Error('الكمية مطلوبة');
      const dist=getCurrentDistribution();
      const distTotal=dist.reduce((s,d)=>s+N(d.qty),0);
      if(movementOutTypes().includes(type)&&dist.length&&Math.abs(distTotal-qty)>.001) throw new Error('إجمالي التوزيع يجب أن يساوي كمية المنتج');
      const already=cart.filter(r=>String(r.item_id)===String(item.id)&&movementOutTypes().includes(r.type)).reduce((a,r)=>a+N(r.qty),0);
      if(movementOutTypes().includes(type) && (N(item.quantity)-already)<qty) throw new Error('الكمية المتوفرة لا تكفي لهذا المنتج داخل العملية');
      const staff=S($('finMoveStaffV15')?.value);
      cart.push({
        item_id:item.id,item_name:item.name,code:itemCode(item),type,qty,date:S($('finMoveDateV15')?.value)||today(),staff,receiver:staffName(staff),
        note:S($('finMoveNoteV15')?.value),unit_cost:itemCost(item),distribution:dist,
        distSummary:dist.length?dist.map(d=>`${S(d.projectName||d.center||'-')}: ${N(d.qty)}`).join(' / '):'بدون توزيع'
      });
      renderCart();
      msg('تمت إضافة المنتج للعملية');
    }catch(e){alert(e.message||String(e));}
    finally{if(btn) btn.disabled=false;}
  };
  window.financeMultiSave10175=async function(btn){
    const started=performance.now();
    try{
      const c=client(), st=state(); if(!c) throw new Error('الاتصال غير جاهز');
      if(!cart.length) throw new Error('أضف منتج واحد على الأقل للعملية');
      if(btn){btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='حفظ سريع...';}
      const operationNo=opNo();
      const user=currentUserName();
      const nowIso=new Date().toISOString();
      const movementRows=[];
      const itemUpdates=[];
      for(const r of cart){
        const item=productItems().find(i=>String(i.id)===String(r.item_id));
        if(!item) throw new Error('لم يتم العثور على المنتج: '+r.item_name);
        const next=N(item.quantity)+(N(r.qty)*moveSign(r.type));
        if(next<0) throw new Error('الكمية المتوفرة لا تكفي: '+r.item_name);
        const meta={module:VERSION,operationNo,isMultiProduct:true,batchCount:cart.length,staffId:r.staff,note:r.note,distribution:r.distribution,stockEffect:'normal',createdBy:user,createdAt:nowIso};
        movementRows.push({
          item_id:r.item_id,item_name:r.item_name,movement_type:r.type,quantity:N(r.qty),movement_date:r.date,receiver:r.receiver,reason:reasonFor(r.type),
          notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:r.code,barcode:r.code,unit_cost:+N(r.unit_cost).toFixed(4)
        });
        itemUpdates.push({id:r.item_id,next,item});
      }
      const mvRes=await c.from('inventory_movements').insert(movementRows).select('*');
      if(mvRes.error) throw mvRes.error;
      const upds=await Promise.all(itemUpdates.map(u=>c.from('inventory_items').update({quantity:u.next}).eq('id',u.id).select('*')));
      const bad=upds.find(x=>x&&x.error); if(bad) throw bad.error;
      upds.forEach((res,idx)=>{const row=A(res.data)[0]||{...itemUpdates[idx].item,quantity:itemUpdates[idx].next}; patchStateItem(row);});
      patchStateMovements(A(mvRes.data).length?A(mvRes.data):movementRows);
      cart.length=0; st.distribution=[]; st.editMovementId='';
      refreshFinance();
      msg('تم حفظ العملية متعددة المنتجات بسرعة: '+operationNo);
      console.log('Tasneef multi movement save', Math.round(performance.now()-started)+'ms');
    }catch(e){alert(e.message||String(e)); msg(e.message||String(e),'err');}
    finally{if(btn){btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ العملية';}}
  };

  function injectMultiProductUI(){
    try{
      const st=state(); if(S(st.tab)!=='movement') return;
      const body=$('finBodyV15'); if(!body || $('finMultiProductOp10175')) return;
      const cards=body.querySelectorAll('.fin-card'); const target=cards[0]||body;
      const html=`<div id="finMultiProductOp10175" class="fin-card" style="border:2px solid #d8ebe3;background:#fbfffd">
        <h3>عملية متعددة المنتجات</h3>
        <p class="fin-soft">اختَر المنتج والكمية من نفس النموذج أعلاه ثم اضغط <b>إضافة المنتج للعملية</b>. بعد إدخال كل المنتجات اضغط <b>حفظ كل المنتجات</b>. الحركة المفردة الحالية تبقى كما هي.</p>
        <div class="fin-actions" style="margin-bottom:10px">
          <button type="button" onclick="financeMultiAddLine10175(this)">إضافة المنتج للعملية</button>
          <button type="button" class="light" onclick="financeMultiSave10175(this)">حفظ كل المنتجات</button>
          <button type="button" class="danger" onclick="financeMultiClear10175()">تفريغ العملية</button>
        </div>
        <div class="fin-table" style="max-height:260px"><table><thead><tr><th>#</th><th>المنتج</th><th>الكود</th><th>نوع الحركة</th><th>الكمية</th><th>المستلم</th><th>التاريخ</th><th>التوزيع</th><th>إجراء</th></tr></thead><tbody id="finMultiCartRows10175"></tbody></table></div>
      </div>`;
      target.insertAdjacentHTML('afterend',html);
      renderCart();
    }catch(_){ }
  }
  function patchHooks(){
    if(!window.__financeMultiHooks10175){
      window.__financeMultiHooks10175=true;
      const oldRender=window.financeProRenderCurrentV15;
      if(typeof oldRender==='function') window.financeProRenderCurrentV15=function(){const r=oldRender.apply(this,arguments); setTimeout(injectMultiProductUI,80); return r;};
      const oldTab=window.financeProTabV15;
      if(typeof oldTab==='function') window.financeProTabV15=function(tab){const r=oldTab.apply(this,arguments); setTimeout(injectMultiProductUI,120); return r;};
      const oldInvoice=window.financeProSaveInvoiceV15;
      window.__financeProSaveInvoiceV15Original10175=oldInvoice||window.__financeProSaveInvoiceV15Original10175;
      window.financeProSaveInvoiceV15=saveInvoiceFast;
    }
    injectMultiProductUI();
  }
  function boot(){patchHooks();}
  let tries=0;
  const timer=setInterval(()=>{tries++; if(window.financeProStateV15){clearInterval(timer); boot();} if(tries>80){clearInterval(timer); boot();}},150);
  window.addEventListener('load',()=>setTimeout(boot,700));
})();
