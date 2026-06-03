/* TASNEEF v336 - Clean movement allocation view: split one product qty across projects/orders with exact stock/cost totals */
(function(){
  'use strict';
  if(window.__tasneefV336MovementProductSplitClean) return; window.__tasneefV336MovementProductSplitClean=true;

  const LS={items:'tasneef_v312_items',moves:'tasneef_v312_moves'};
  const $=id=>document.getElementById(id);
  const parse=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(_){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const n=v=>Number(String(v??'').replace(/,/g,''))||0;
  const r2=v=>Math.round(n(v)*100)/100;
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const MOVE_TYPES=['صرف','استهلاك','هدر','تالف','سكراب','مرتجع'];
  const outTypes=new Set(['صرف','استهلاك','هدر','تالف','سكراب']);
  const isApproved=m=>['معتمد','تم الصرف'].includes(m.status||'');

  function projects(){return Array.isArray(window.data?.projects)?window.data.projects:[]}
  function supervisors(){return Array.isArray(window.data?.supervisors)?window.data.supervisors:[]}
  function items(){return parse(LS.items).map(i=>({...i,batches:Array.isArray(i.batches)?i.batches:[]}))}
  function moves(){return parse(LS.moves)}
  function setMoves(v){save(LS.moves,v)}
  function setItems(v){save(LS.items,v)}
  function pName(id){const p=projects().find(x=>String(x.id)===String(id));return p?(p.name||p.project_name||p.title||id):(id||'-')}
  function sName(id,fb=''){const s=supervisors().find(x=>String(x.id)===String(id));return s?(s.full_name||s.name||s.username||id):(fb||'-')}
  function itemById(id){return items().find(x=>String(x.id)===String(id))||null}
  function itemCost(it){
    if(!it) return 0;
    const batches=(it.batches||[]).filter(b=>n(b.qty_remaining)>0);
    const q=batches.reduce((a,b)=>a+n(b.qty_remaining),0);
    if(q>0) return batches.reduce((a,b)=>a+n(b.qty_remaining)*n(b.unit_after),0)/q;
    return n(it.price_after||it.price_after_vat||it.price||0);
  }
  function target(m){if((m.cost_type||'FM')==='FM')return pName(m.project_id); if(m.cost_type==='CN')return m.order_no||'-'; return m.general_note||'عام'}
  function signedAmount(m){const amt=n(m.amount||n(m.qty)*n(m.unit_cost_override||m.unit_cost||itemCost(itemById(m.item_id)))); return m.type==='مرتجع' ? -Math.abs(amt) : Math.abs(amt)}
  function projectOptions(v=''){return '<option value="">اختر المشروع</option>'+projects().map(p=>`<option value="${esc(p.id)}" ${String(v)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join('')}
  function itemOptions(v=''){return '<option value="">اختر المنتج</option>'+items().map(i=>`<option value="${esc(i.id)}" ${String(v)===String(i.id)?'selected':''}>${esc(i.code||'')} - ${esc(i.name||'')} (${n(i.qty)} ${esc(i.unit||'')})</option>`).join('')}

  function rebuildStockV336(){
    let all=items().map(i=>{const batches=(i.batches||[]).map(b=>({...b,qty_remaining:n(b.qty_initial)})); return {...i,batches,qty:batches.reduce((a,b)=>a+n(b.qty_remaining),0)}});
    const ms=moves().slice().sort((a,b)=>String(a.created_at||a.date||'').localeCompare(String(b.created_at||b.date||'')));
    for(const m of ms.filter(isApproved)){
      const it=all.find(x=>String(x.id)===String(m.item_id)); if(!it) continue;
      if(outTypes.has(m.type)){
        let need=n(m.qty), amount=0, seg=[];
        for(const b of (it.batches||[])){
          if(need<=0) break;
          const take=Math.min(n(b.qty_remaining),need);
          if(take>0){
            const c=n(m.unit_cost_override||b.unit_after||itemCost(it));
            b.qty_remaining=r2(n(b.qty_remaining)-take); need=r2(need-take);
            amount+=take*c; seg.push({batch_id:b.id,qty:take,unit_cost:c});
          }
        }
        const fallback=n(m.unit_cost_override||m.unit_cost||itemCost(it));
        if(need>0){ amount+=need*fallback; seg.push({batch_id:'negative',qty:need,unit_cost:fallback}); }
        m.segments=seg; m.amount=r2(amount); m.unit_cost=n(m.unit_cost_override||(n(m.qty)?amount/n(m.qty):fallback));
      } else if(m.type==='مرتجع'){
        const cost=n(m.unit_cost_override||m.unit_cost||itemCost(it)); const q=n(m.qty); const bid=m.return_batch_id||uid(); m.return_batch_id=bid;
        it.batches=it.batches||[]; it.batches.push({id:bid,source:'مرتجع',date:m.date||new Date().toISOString().slice(0,10),qty_initial:q,qty_remaining:q,unit_before:cost,unit_vat:0,unit_after:cost,price_mode:'no_tax'});
        m.amount=r2(q*cost); m.unit_cost=cost;
      }
      it.qty=r2((it.batches||[]).reduce((a,b)=>a+n(b.qty_remaining),0));
    }
    setItems(all); setMoves(ms); return all;
  }
  window.rebuildStockV336=rebuildStockV336;

  function groupMoves(){
    const gs={};
    moves().forEach(m=>{
      const id=m.batch_id||m.id;
      if(!gs[id]) gs[id]={id,batch_no:m.batch_no||('MOV-'+String(id).slice(-6).toUpperCase()),date:m.date,supervisor_id:m.supervisor_id,supervisor_name:m.supervisor_name,status:m.status,notes:m.batch_notes||'',lines:[]};
      gs[id].lines.push(m);
    });
    return Object.values(gs).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }
  function byItem(lines){
    const obj={};
    lines.forEach(m=>{const k=m.item_id||'unknown'; if(!obj[k]) obj[k]={item:itemById(k),lines:[]}; obj[k].lines.push(m)});
    return Object.entries(obj).map(([item_id,g])=>({item_id,...g,totalQty:r2(g.lines.reduce((a,m)=>a+n(m.qty),0)),totalCost:r2(g.lines.reduce((a,m)=>a+signedAmount(m),0))}));
  }
  function ensureStyle(){
    if($('v336Style'))return;
    const st=document.createElement('style'); st.id='v336Style'; st.textContent=`
    .v336-modal{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:22px;overflow:auto;direction:rtl}
    .v336-panel{background:#fff;border-radius:18px;max-width:1180px;width:min(1180px,98vw);box-shadow:0 20px 70px rgba(0,0,0,.25);padding:16px;border:1px solid #dcebe5}
    .v336-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e2eee9;padding-bottom:10px;margin-bottom:12px}.v336-head h2{margin:0;color:#064a3a}.v336-close,.v336-save,.v336-btn{border:0;border-radius:11px;padding:10px 14px;font-weight:900;cursor:pointer}.v336-close{background:#c2383d;color:#fff}.v336-save,.v336-btn{background:#064a3a;color:#fff}.v336-light{background:#eef7f3;color:#064a3a;border:1px solid #d6e8e1}.v336-danger{background:#c2383d;color:#fff}
    .v336-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}.v336-kpi{background:#f8fcfa;border:1px solid #d9eae4;border-radius:14px;padding:12px}.v336-kpi small{display:block;color:#789}.v336-kpi b{font-size:18px;color:#064a3a}
    .v336-note{background:#fff8e7;border:1px dashed #dfad2f;color:#674a00;border-radius:14px;padding:10px;margin:10px 0}.v336-product{border:1px solid #d8ebe4;border-radius:18px;margin:12px 0;background:#fbfefd;overflow:hidden}.v336-product-head{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;background:#eef8f4;border-bottom:1px solid #d8ebe4}.v336-product-title b{font-size:18px;color:#063d31}.v336-badges{display:flex;gap:8px;flex-wrap:wrap}.v336-badge{background:#fff;border:1px solid #d5e7e1;border-radius:12px;padding:7px 10px;font-weight:900;color:#064a3a}.v336-badge.minus{color:#b3272f}.v336-badge.plus{color:#087a43}
    .v336-lines{padding:12px}.v336-line{display:grid;grid-template-columns:1.05fr .8fr .7fr .95fr 1.1fr .85fr .9fr .55fr;gap:8px;align-items:end;background:#fff;border:1px solid #e3efeb;border-radius:14px;padding:10px;margin-bottom:8px}.v336-line label,.v336-add label{display:block;font-size:12px;color:#526b62;margin-bottom:4px}.v336-line input,.v336-line select,.v336-add input,.v336-add select{width:100%;box-sizing:border-box;border:1px solid #d6e7e1;border-radius:10px;padding:8px;background:#fff}.v336-total{font-weight:900;color:#064a3a;text-align:center}.v336-add{border:1px dashed #dfad2f;background:#fffdf4;border-radius:15px;padding:12px;margin-top:10px}.v336-add-grid{display:grid;grid-template-columns:1fr .7fr .8fr 1fr .9fr 1.2fr auto;gap:8px;align-items:end}.v336-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #e2eee9;padding-top:12px;margin-top:14px}.v336-mini{font-size:12px;color:#6d837b}
    @media(max-width:1000px){.v336-kpis{grid-template-columns:1fr 1fr}.v336-line,.v336-add-grid{grid-template-columns:1fr 1fr}.v336-panel{padding:10px}.v336-product-head{display:block}.v336-badges{margin-top:8px}}`;
    document.head.appendChild(st);
  }
  function modal(title,html){document.querySelector('.v334-modal')?.remove();document.querySelector('.v336-modal')?.remove();const d=document.createElement('div');d.className='v336-modal';d.innerHTML=`<div class="v336-panel"><div class="v336-head"><h2>${esc(title)}</h2><button class="v336-close" onclick="this.closest('.v336-modal').remove()">إغلاق</button></div>${html}</div>`;document.body.appendChild(d)}
  function targetInput(m){
    const ct=m.cost_type||'FM'; const id=esc(m.id);
    if(ct==='FM') return `<select id="v336Target_${id}">${projectOptions(m.project_id)}</select>`;
    if(ct==='CN') return `<input id="v336Target_${id}" value="${esc(m.order_no||'')}" placeholder="رقم الأوردر">`;
    return `<input id="v336Target_${id}" value="${esc(m.general_note||'عام')}" placeholder="ملاحظة عامة">`;
  }
  function addTargetInput(productId){
    return `<div id="v336AddFm_${esc(productId)}"><label>المشروع</label><select id="v336AddProject_${esc(productId)}">${projectOptions()}</select></div><div id="v336AddCn_${esc(productId)}" style="display:none"><label>رقم الأوردر</label><input id="v336AddOrder_${esc(productId)}" placeholder="رقم الأوردر"></div><div id="v336AddGeneral_${esc(productId)}" style="display:none"><label>عام</label><input id="v336AddGeneralNote_${esc(productId)}" value="عام"></div>`;
  }
  window.v336CostChanged=function(itemId){const ct=$(`v336AddCost_${itemId}`)?.value||'FM'; ['Fm','Cn','General'].forEach(x=>{const el=$(`v336Add${x}_${itemId}`); if(el) el.style.display='none'}); const show=ct==='FM'?'Fm':ct==='CN'?'Cn':'General'; const el=$(`v336Add${show}_${itemId}`); if(el) el.style.display='block'};
  window.v336LineCostChanged=function(id){const ms=moves(); const m=ms.find(x=>String(x.id)===String(id)); if(!m)return; m.cost_type=$(`v336Cost_${id}`)?.value||'FM'; if(m.cost_type==='FM'){m.order_no='';m.general_note=''} if(m.cost_type==='CN'){m.project_id='';m.general_note=''} if(m.cost_type==='GENERAL'){m.project_id='';m.order_no='';m.general_note=m.general_note||'عام'} setMoves(ms); window.v336OpenMove(m.batch_id||m.id)};
  window.v336SaveLine=function(id){
    const ms=moves(); const m=ms.find(x=>String(x.id)===String(id)); if(!m)return;
    m.type=$(`v336Type_${id}`)?.value||m.type; m.qty=n($(`v336Qty_${id}`)?.value); m.unit_cost_override=n($(`v336CostUnit_${id}`)?.value||m.unit_cost_override||m.unit_cost||itemCost(itemById(m.item_id))); m.cost_type=$(`v336Cost_${id}`)?.value||m.cost_type||'FM'; m.notes=$(`v336Notes_${id}`)?.value||'';
    const target=$(`v336Target_${id}`)?.value||'';
    if(m.cost_type==='FM'){m.project_id=target;m.order_no='';m.general_note=''} else if(m.cost_type==='CN'){m.order_no=target;m.project_id='';m.general_note=''} else {m.general_note=target||'عام';m.project_id='';m.order_no=''}
    if(!m.qty){alert('الكمية لا يمكن أن تكون صفر');return}
    if(m.cost_type==='FM'&&!m.project_id){alert('اختر المشروع');return}
    if(m.cost_type==='CN'&&!m.order_no){alert('اكتب رقم الأوردر');return}
    m.amount=r2(m.qty*m.unit_cost_override); setMoves(ms); rebuildStockV336(); window.v336OpenMove(m.batch_id||m.id);
  };
  window.v336DeleteLine=function(id,batch){if(!confirm('حذف هذا التوزيع؟'))return; setMoves(moves().filter(m=>String(m.id)!==String(id))); rebuildStockV336(); window.v336OpenMove(batch)};
  window.v336AddAllocation=function(batch,itemId){
    const group=groupMoves().find(g=>String(g.id)===String(batch)); if(!group)return;
    const it=itemById(itemId); if(!it)return alert('المنتج غير موجود');
    const qty=n($(`v336AddQty_${itemId}`)?.value), type=$(`v336AddType_${itemId}`)?.value||'استهلاك', ct=$(`v336AddCost_${itemId}`)?.value||'FM';
    if(!qty)return alert('اكتب كمية التوزيع');
    const row={id:uid(),batch_id:group.id,batch_no:group.batch_no,date:group.date,created_at:new Date().toISOString(),supervisor_id:group.supervisor_id,supervisor_name:group.supervisor_name,status:group.status||'بانتظار',batch_notes:group.notes||'',item_id:itemId,item_name:it.name||'',qty,type,cost_type:ct,project_id:'',order_no:'',general_note:'',notes:$(`v336AddNotes_${itemId}`)?.value||'',unit_cost_override:n($(`v336AddUnit_${itemId}`)?.value||itemCost(it))};
    if(ct==='FM'){row.project_id=$(`v336AddProject_${itemId}`)?.value||''; if(!row.project_id)return alert('اختر المشروع')} else if(ct==='CN'){row.order_no=$(`v336AddOrder_${itemId}`)?.value||''; if(!row.order_no)return alert('اكتب رقم الأوردر')} else row.general_note=$(`v336AddGeneralNote_${itemId}`)?.value||'عام';
    const ms=moves(); ms.push(row); setMoves(ms); rebuildStockV336(); window.v336OpenMove(batch);
  };
  window.v336AddNewProductAllocation=function(batch){
    const itemId=$('v336GlobalItem')?.value||''; if(!itemId)return alert('اختر المنتج');
    const group=groupMoves().find(g=>String(g.id)===String(batch)); if(!group)return;
    const ms=moves(); ms.push({id:uid(),batch_id:group.id,batch_no:group.batch_no,date:group.date,created_at:new Date().toISOString(),supervisor_id:group.supervisor_id,supervisor_name:group.supervisor_name,status:group.status||'بانتظار',batch_notes:group.notes||'',item_id:itemId,item_name:itemById(itemId)?.name||'',qty:1,type:'استهلاك',cost_type:'FM',project_id:'',order_no:'',general_note:'',notes:'',unit_cost_override:itemCost(itemById(itemId))}); setMoves(ms); rebuildStockV336(); window.v336OpenMove(batch);
  };

  window.v336OpenMove=function(id){
    ensureStyle(); rebuildStockV336(); const group=groupMoves().find(g=>String(g.id)===String(id)); if(!group)return;
    const grouped=byItem(group.lines); const totalOut=group.lines.filter(m=>m.type!=='مرتجع').reduce((a,m)=>a+n(m.qty),0); const totalReturn=group.lines.filter(m=>m.type==='مرتجع').reduce((a,m)=>a+n(m.qty),0); const netQty=r2(totalOut-totalReturn); const netCost=r2(group.lines.reduce((a,m)=>a+signedAmount(m),0));
    const productsHtml=grouped.map(g=>{
      const it=g.item||{}; const out=g.lines.filter(m=>m.type!=='مرتجع').reduce((a,m)=>a+n(m.qty),0); const ret=g.lines.filter(m=>m.type==='مرتجع').reduce((a,m)=>a+n(m.qty),0); const net=r2(out-ret);
      const linesHtml=g.lines.map(m=>`<div class="v336-line"><div><label>نوع الحركة</label><select id="v336Type_${esc(m.id)}">${MOVE_TYPES.map(t=>`<option ${m.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div><label>الكمية</label><input id="v336Qty_${esc(m.id)}" type="number" step="0.01" value="${n(m.qty)}"></div><div><label>مركز التكلفة</label><select id="v336Cost_${esc(m.id)}" onchange="v336LineCostChanged('${esc(m.id)}')"><option ${m.cost_type==='FM'?'selected':''}>FM</option><option ${m.cost_type==='CN'?'selected':''}>CN</option><option ${m.cost_type==='GENERAL'?'selected':''}>GENERAL</option></select></div><div><label>المشروع / الأوردر / عام</label>${targetInput(m)}</div><div><label>تكلفة الحبة</label><input id="v336CostUnit_${esc(m.id)}" type="number" step="0.01" value="${n(m.unit_cost_override||m.unit_cost||itemCost(it))}"></div><div><label>ملاحظات</label><input id="v336Notes_${esc(m.id)}" value="${esc(m.notes||'')}"></div><div class="v336-total"><label>الإجمالي</label>${money(signedAmount(m))}</div><div><button class="v336-btn" onclick="v336SaveLine('${esc(m.id)}')">حفظ</button><button class="v336-btn v336-danger" style="margin-top:5px" onclick="v336DeleteLine('${esc(m.id)}','${esc(group.id)}')">حذف</button></div></div>`).join('');
      return `<section class="v336-product"><div class="v336-product-head"><div class="v336-product-title"><b>${esc(it.name||g.lines[0]?.item_name||'-')}</b><div class="v336-mini">الكود: ${esc(it.code||'-')} | الوحدة: ${esc(it.unit||'-')} | المتبقي الحالي: ${n(it.qty)}</div></div><div class="v336-badges"><span class="v336-badge">إجمالي موزع: ${n(g.totalQty)}</span><span class="v336-badge minus">خارج: ${n(out)}</span><span class="v336-badge plus">مرتجع: ${n(ret)}</span><span class="v336-badge">الصافي: ${n(net)}</span><span class="v336-badge">التكلفة: ${money(g.totalCost)}</span></div></div><div class="v336-lines">${linesHtml}<div class="v336-add"><h3>إضافة توزيع لنفس المنتج على مشروع / أوردر / عام</h3><div class="v336-add-grid"><div><label>النوع</label><select id="v336AddType_${esc(g.item_id)}">${MOVE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div><label>الكمية</label><input id="v336AddQty_${esc(g.item_id)}" type="number" step="0.01"></div><div><label>مركز التكلفة</label><select id="v336AddCost_${esc(g.item_id)}" onchange="v336CostChanged('${esc(g.item_id)}')"><option>FM</option><option>CN</option><option>GENERAL</option></select></div>${addTargetInput(g.item_id)}<div><label>تكلفة الحبة</label><input id="v336AddUnit_${esc(g.item_id)}" type="number" step="0.01" value="${r2(itemCost(it))}"></div><div><label>ملاحظات</label><input id="v336AddNotes_${esc(g.item_id)}" placeholder="مثال: جزء من المنتج لموقع آخر"></div><button class="v336-btn" onclick="v336AddAllocation('${esc(group.id)}','${esc(g.item_id)}')">إضافة توزيع</button></div></div></div></section>`;
    }).join('');
    modal('عرض / تعديل حركة المخزون',`<div class="v336-kpis"><div class="v336-kpi"><small>الحركة</small><b>${esc(group.batch_no)}</b></div><div class="v336-kpi"><small>التاريخ</small><b>${esc(group.date)}</b></div><div class="v336-kpi"><small>المشرف</small><b>${esc(sName(group.supervisor_id,group.supervisor_name))}</b></div><div class="v336-kpi"><small>الصافي / التكلفة</small><b>${n(netQty)} | ${money(netCost)}</b></div></div><div class="v336-note">الفكرة هنا: إذا خرج 3 لتر أو 20 لمبة، تستطيع توزيع نفس المنتج على أكثر من مشروع أو أوردر. عدّل كمية السطر الأصلي وأضف توزيع جديد لنفس المنتج، وسيتم احتساب الداخل والخارج والمتبقي والتكلفة من نفس البيانات في التقارير.</div>${productsHtml}<div class="v336-add"><h3>إضافة منتج آخر داخل نفس الحركة</h3><div class="v336-add-grid" style="grid-template-columns:1fr auto"><select id="v336GlobalItem">${itemOptions()}</select><button class="v336-btn" onclick="v336AddNewProductAllocation('${esc(group.id)}')">إضافة المنتج</button></div></div><div class="v336-footer"><span class="v336-mini">بعد تعديل أي سطر اضغط حفظ. عند الإغلاق يتم تحديث حركة المخزون ومركز التكلفة والتقارير.</span><button class="v336-save" onclick="this.closest('.v336-modal').remove(); if(window.financeV312RenderMovements) financeV312RenderMovements();">تحديث وإغلاق</button></div>`);
  };

  window.v334ViewMove=function(id){return window.v336OpenMove(id)};
  window.v335OpenMove=function(id){return window.v336OpenMove(id)};
  const oldRender=window.financeV312RenderMovements;
  if(typeof oldRender==='function'){
    window.financeV312RenderMovements=function(){const r=oldRender.apply(this,arguments); setTimeout(()=>{document.querySelectorAll('button[onclick^="v334ViewMove"],button[onclick^="v335OpenMove"]').forEach(btn=>{const oc=btn.getAttribute('onclick')||''; const id=(oc.match(/\('([^']+)'\)/)||[])[1]; if(id) btn.setAttribute('onclick',`v336OpenMove('${id}')`);});},50); return r;};
  }
})();
