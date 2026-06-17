/* Tasneef v10173 - Finance performance accelerator (safe patch)
   - Fast movement save/edit without full reload of all finance tables.
   - Lazy/async product images to reduce image rendering delay.
   - Background warm preload for finance data without touching existing logic.
*/
(function(){
  'use strict';
  const VERSION='v10173-finance-speed-safe';
  if(window.__tasneefFinanceSpeedV10173) return;
  window.__tasneefFinanceSpeedV10173=true;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const VAT=0.15;
  const today=()=>new Date().toISOString().slice(0,10);
  const state=()=>window.financeProStateV15||{};
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const msg=(t,type)=>{ try{ if(typeof window.msg==='function') window.msg(t,type); }catch(_){} };
  const movementOutTypes=()=>['out','consume','waste','damaged','scrap'];
  const moveSign=t=>{ t=S(t); if(t==='in'||t==='return') return 1; if(movementOutTypes().includes(t)) return -1; return 0; };
  const itemCode=i=>S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));
  const staffName=id=>{
    const st=state();
    const u=A(st.users).find(x=>String(x.id)===String(id));
    return S(u&&(u.full_name||u.name||u.username))||S(id)||'-';
  };
  const safeJson=v=>{const t=S(v); if(!t.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}};
  const movementStockDelta=m=>{ const meta=safeJson(m&&m.notes)||{}; if(S(meta.stockEffect)==='none') return 0; return N(m&&m.quantity)*moveSign(m&&m.movement_type); };
  const movementComputedDelta=m=>{
    const meta=safeJson(m&&m.notes)||{};
    const returned=A(meta.distribution).filter(d=>S(d.type)==='return'&&S(m&&m.movement_type)!=='return').reduce((a,d)=>a+N(d.qty),0);
    return movementStockDelta(m)+returned;
  };
  const computedItemQty=item=>N(item&&item.quantity);
  const itemUnitCost=item=>N(item&&(item.unit_cost||item.cost||item.price||item.purchase_price));
  const reasonFor=t=>({return:'مرتجع مخزون',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف مخزون'})[S(t)]||'صرف مخزون';

  function forceRefreshFinance(){
    try{
      if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15();
      else if(typeof window.financeProTabV15==='function') window.financeProTabV15((state().tab)||'movement');
      setTimeout(patchLazyImages,80);
    }catch(_){
      try{ if(typeof window.financeProLoadV15==='function') window.financeProLoadV15(false); }catch(__){}
    }
  }

  async function fastReloadMovementsAndItems(){
    // Light refresh only for the two tables that changed. No projects/users/tickets/contracts reload.
    const st=state(), c=client(); if(!c) return false;
    const [items,moves]=await Promise.all([
      c.from('inventory_items').select('*').limit(8000),
      c.from('inventory_movements').select('*').limit(8000)
    ]);
    if(items.error||moves.error) return false;
    st.items=A(items.data); st.movements=A(moves.data);
    return true;
  }

  function patchMovementSave(){
    const oldSave=window.financeProSaveMovementV15;
    window.__financeProSaveMovementV15Original=oldSave||window.__financeProSaveMovementV15Original;
    window.financeProSaveMovementV15=async function(btn){
      const t0=Date.now();
      try{
        if(btn){ btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='جاري الحفظ...'; }
        const c=client(); if(!c) throw new Error('الاتصال غير جاهز');
        const st=state();
        const item=A(st.items).find(i=>String(i.id)===String($('finMoveItemV15')?.value));
        if(!item) throw new Error('اختر المنتج');
        const qty=N($('finMoveQtyV15')?.value), type=S($('finMoveTypeV15')?.value)||'out';
        if(qty<=0) throw new Error('الكمية مطلوبة');
        const old=st.editMovementId?A(st.movements).find(m=>String(m.id)===String(st.editMovementId)):null;
        const same=old&&String(old.item_id)===String(item.id)?old:null;
        const oldItem=old&&!same?A(st.items).find(i=>String(i.id)===String(old.item_id)):null;
        const availableBeforeOld = same ? (computedItemQty(item)-movementComputedDelta(old)) : computedItemQty(item);
        if(movementOutTypes().includes(type)&&availableBeforeOld<qty) throw new Error('الكمية المتوفرة لا تكفي');
        const dist=A(st.distribution);
        const distTotal=dist.reduce((s,d)=>s+N(d.qty),0);
        if(movementOutTypes().includes(type)&&dist.length&&Math.abs(distTotal-qty)>.001) throw new Error('إجمالي التوزيع يجب أن يساوي كمية الحركة');
        const staff=S($('finMoveStaffV15')?.value);
        const meta={module:VERSION,staffId:staff,note:S($('finMoveNoteV15')?.value),distribution:dist,stockEffect:'normal',updatedBy:S((JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{}).full_name||''),updatedAt:new Date().toISOString()};
        const mv={
          item_id:item.id,
          item_name:item.name,
          movement_type:type,
          quantity:qty,
          movement_date:S($('finMoveDateV15')?.value)||today(),
          receiver:staffName(staff),
          reason:reasonFor(type),
          notes:'finance_pro_v15:'+JSON.stringify(meta),
          product_code:itemCode(item),
          barcode:itemCode(item),
          unit_cost:+itemUnitCost(item).toFixed(4)
        };
        let saved;
        if(old){
          const res=await c.from('inventory_movements').update(mv).eq('id',old.id).select('*');
          if(res.error) throw res.error;
          saved=A(res.data)[0]||{...old,...mv};
        }else{
          const res=await c.from('inventory_movements').insert(mv).select('*');
          if(res.error) throw res.error;
          saved=A(res.data)[0]||mv;
        }
        if(oldItem){
          const oldRawBefore=N(oldItem.quantity)-movementStockDelta(old);
          const updOld=await c.from('inventory_items').update({quantity:oldRawBefore}).eq('id',oldItem.id).select('*');
          if(updOld.error) throw updOld.error;
          const oi=A(updOld.data)[0];
          const idx=st.items.findIndex(i=>String(i.id)===String(oldItem.id));
          if(idx>=0) st.items[idx]=oi||{...oldItem,quantity:oldRawBefore};
        }
        const oldMainDelta=same?movementStockDelta(old):0;
        const baseRaw=N(item.quantity)-oldMainDelta;
        const newRaw=baseRaw+(qty*moveSign(type));
        const upd=await c.from('inventory_items').update({quantity:newRaw}).eq('id',item.id).select('*');
        if(upd.error) throw upd.error;
        const updatedItem=A(upd.data)[0]||{...item,quantity:newRaw};
        const itemIdx=st.items.findIndex(i=>String(i.id)===String(item.id));
        if(itemIdx>=0) st.items[itemIdx]=updatedItem;
        if(old){
          const mIdx=st.movements.findIndex(m=>String(m.id)===String(old.id));
          if(mIdx>=0) st.movements[mIdx]=saved; else st.movements.push(saved);
        }else{
          st.movements.push(saved);
        }
        st.distribution=[]; st.editMovementId='';
        forceRefreshFinance();
        msg(old?'تم تعديل حركة المخزون بسرعة':'تم حفظ حركة المخزون بسرعة');
        // Quiet sync after screen updates, to ensure any DB-calculated fields are reflected without blocking user.
        setTimeout(async()=>{ try{ if(await fastReloadMovementsAndItems()) forceRefreshFinance(); }catch(_){} }, 900);
        console.log('Tasneef finance fast movement save', Date.now()-t0, 'ms');
      }catch(e){
        alert(e.message||String(e)); msg(e.message||String(e),'err');
        // fallback to original only if our fast path failed before any write is likely useful
      }finally{
        if(btn){ btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ الحركة'; }
      }
      return false;
    };
  }

  function patchMovementDelete(){
    const oldDel=window.financeProDeleteMovementV15;
    window.__financeProDeleteMovementV15Original=oldDel||window.__financeProDeleteMovementV15Original;
    window.financeProDeleteMovementV15=async function(id){
      try{
        const st=state(), c=client(); if(!c) throw new Error('الاتصال غير جاهز');
        const m=A(st.movements).find(x=>Number(x.id)===Number(id)); if(!m) return;
        if(!confirm('هل تريد حذف الحركة؟ سيتم عكس أثرها على رصيد المنتج.')) return;
        const item=A(st.items).find(i=>String(i.id)===String(m.item_id));
        if(item){
          const next=N(item.quantity)-movementStockDelta(m);
          const upd=await c.from('inventory_items').update({quantity:next}).eq('id',item.id).select('*');
          if(upd.error) throw upd.error;
          const idx=st.items.findIndex(i=>String(i.id)===String(item.id));
          if(idx>=0) st.items[idx]=A(upd.data)[0]||{...item,quantity:next};
        }
        const res=await c.from('inventory_movements').delete().eq('id',id);
        if(res.error) throw res.error;
        st.movements=st.movements.filter(x=>Number(x.id)!==Number(id));
        forceRefreshFinance();
        msg('تم حذف الحركة بسرعة');
      }catch(e){ alert(e.message||String(e)); }
    };
  }

  function patchLazyImages(){
    try{
      document.querySelectorAll('#financeDashboard img.fin-thumb, #financeDashboard img[src]').forEach(img=>{
        img.loading='lazy';
        img.decoding='async';
        img.fetchPriority='low';
        img.style.contentVisibility='auto';
        img.style.containIntrinsicSize='76px 76px';
      });
    }catch(_){}
  }

  function patchProductRender(){
    if(window.__financeProProductLazyPatchV10173) return;
    window.__financeProProductLazyPatchV10173=true;
    const old=window.financeProRenderProductListV15;
    if(typeof old==='function'){
      window.financeProRenderProductListV15=function(){
        const r=old.apply(this,arguments);
        setTimeout(patchLazyImages,30);
        return r;
      };
    }
    const obs=new MutationObserver(()=>patchLazyImages());
    const start=()=>{
      const node=document.getElementById('financeDashboard');
      if(node&&!node.__lazyObs10173){ node.__lazyObs10173=true; obs.observe(node,{childList:true,subtree:true}); }
      patchLazyImages();
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  }

  function patchFinanceOpenWarmup(){
    if(window.__financeShowPageWarmV10173) return;
    window.__financeShowPageWarmV10173=true;
    const warm=()=>{
      try{
        const st=state();
        if(!st.loaded && typeof window.financeProLoadV15==='function'){
          // start in background after first page settles; no force reload.
          window.financeProLoadV15(false).catch(()=>{});
        }
      }catch(_){}
    };
    if('requestIdleCallback' in window) requestIdleCallback(warm,{timeout:7000}); else setTimeout(warm,5000);
  }

  function boot(){
    patchMovementSave();
    patchMovementDelete();
    patchProductRender();
    patchFinanceOpenWarmup();
    console.log('Tasneef '+VERSION+' loaded');
  }

  // Wait until the original finance functions exist, then patch.
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.financeProStateV15 && (window.financeProSaveMovementV15 || tries>30)){
      clearInterval(timer);
      boot();
    }
  },200);
})();
