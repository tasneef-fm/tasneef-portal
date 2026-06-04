/* TASNEEF v337 - Product parent movement view + balanced FIFO stock/cost for consume/return distributions */
(function(){
  'use strict';
  if(window.__tasneefV337ProductParentFifoBalance) return; window.__tasneefV337ProductParentFifoBalance=true;

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
  const OUT_TYPES=new Set(['صرف','استهلاك','هدر','تالف','سكراب']);
  const isApproved=m=>['معتمد','تم الصرف'].includes(m.status||'');

  function projects(){return Array.isArray(window.data?.projects)?window.data.projects:[]}
  function supervisors(){return Array.isArray(window.data?.supervisors)?window.data.supervisors:[]}
  function items(){return parse(LS.items).map(i=>({...i,batches:Array.isArray(i.batches)?i.batches:[]}))}
  function moves(){return parse(LS.moves)}
  function setItems(v){save(LS.items,v)}
  function setMoves(v){save(LS.moves,v)}
  function itemById(id){return items().find(x=>String(x.id)===String(id))||null}
  function pName(id){const p=projects().find(x=>String(x.id)===String(id));return p?(p.name||p.project_name||p.title||id):(id||'-')}
  function sName(id,fb=''){const s=supervisors().find(x=>String(x.id)===String(id));return s?(s.full_name||s.name||s.username||id):(fb||'-')}
  function imgHtml(src){return src?`<img src="${esc(src)}" alt="صورة المنتج">`:'<span>لا توجد صورة</span>'}
  function targetName(m){if((m.cost_type||'FM')==='FM')return pName(m.project_id); if(m.cost_type==='CN')return m.order_no||'-'; return m.general_note||'عام'}
  function projectOptions(v=''){return '<option value="">اختر المشروع</option>'+projects().map(p=>`<option value="${esc(p.id)}" ${String(v)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join('')}
  function itemOptions(v=''){return '<option value="">اختر المنتج</option>'+items().map(i=>`<option value="${esc(i.id)}" ${String(v)===String(i.id)?'selected':''}>${esc(i.code||'')} - ${esc(i.name||'')} (${n(i.qty)} ${esc(i.unit||'')})</option>`).join('')}
  function avgCost(it){ if(!it)return 0; const rem=(it.batches||[]).filter(b=>n(b.qty_remaining)>0); const q=rem.reduce((a,b)=>a+n(b.qty_remaining),0); if(q>0)return rem.reduce((a,b)=>a+n(b.qty_remaining)*n(b.unit_after),0)/q; return n(it.price_after||it.price_after_vat||it.price||0); }
  function signedAmount(m){const amount=n(m.amount||n(m.qty)*n(m.unit_cost_override||m.unit_cost||avgCost(itemById(m.item_id)))); return m.type==='مرتجع'?-Math.abs(amount):Math.abs(amount)}

  function batchKey(m){return String(m.batch_id||m.id||'')+'__'+String(m.item_id||'')}
  function moveGroupsByBatchItem(ms){const g={}; ms.forEach(m=>{const k=batchKey(m); if(!g[k])g[k]=[]; g[k].push(m)}); return Object.values(g)}

  // Important rule:
  // - If a product has خروج + مرتجع inside the same movement, only خروج affects stock; مرتجع is a return line for reporting/cost offset.
  // - If a movement line is مرتجع only without any خروج in same product movement, it increases stock as a real return to warehouse.
  function rebuildStockV337(){
    const all=items().map(i=>{const batches=(i.batches||[]).map(b=>({...b,qty_remaining:n(b.qty_initial)})); return {...i,batches,qty:r2(batches.reduce((a,b)=>a+n(b.qty_remaining),0))}});
    const raw=moves();
    const approved=raw.filter(isApproved).sort((a,b)=>String(a.created_at||a.date||'').localeCompare(String(b.created_at||b.date||'')));
    const groups=moveGroupsByBatchItem(approved);
    for(const lines of groups){
      const outLines=lines.filter(m=>OUT_TYPES.has(m.type));
      const retLines=lines.filter(m=>m.type==='مرتجع');
      const itemId=(lines[0]||{}).item_id;
      const it=all.find(x=>String(x.id)===String(itemId)); if(!it) continue;
      // FIFO consume out lines in line order
      for(const m of outLines){
        let need=n(m.qty), amount=0, seg=[];
        for(const b of (it.batches||[])){
          if(need<=0) break;
          const take=Math.min(n(b.qty_remaining),need);
          if(take>0){
            const cost=n(m.unit_cost_override||b.unit_after||avgCost(it));
            b.qty_remaining=r2(n(b.qty_remaining)-take);
            need=r2(need-take);
            amount+=take*cost;
            seg.push({batch_id:b.id,qty:take,unit_cost:cost});
          }
        }
        const fallback=n(m.unit_cost_override||m.unit_cost||avgCost(it));
        if(need>0){amount+=need*fallback; seg.push({batch_id:'negative',qty:need,unit_cost:fallback});}
        m.segments=seg; m.amount=r2(amount); m.unit_cost=n(m.unit_cost_override||(n(m.qty)?amount/n(m.qty):fallback));
      }
      // Return lines: if same product movement has out lines, return is only offset/cost report and does not add stock again.
      // If standalone return, add it back to stock.
      for(const m of retLines){
        const cost=n(m.unit_cost_override||m.unit_cost||avgCost(it));
        const q=n(m.qty);
        if(!outLines.length){
          const bid=m.return_batch_id||uid(); m.return_batch_id=bid;
          it.batches=it.batches||[];
          it.batches.push({id:bid,source:'مرتجع',date:m.date||new Date().toISOString().slice(0,10),qty_initial:q,qty_remaining:q,unit_before:cost,unit_vat:0,unit_after:cost,price_mode:'no_tax'});
        }
        m.amount=r2(q*cost); m.unit_cost=cost;
      }
      it.qty=r2((it.batches||[]).reduce((a,b)=>a+n(b.qty_remaining),0));
    }
    const approvedIds=new Set(approved.map(x=>String(x.id)));
    const merged=approved.concat(raw.filter(x=>!approvedIds.has(String(x.id))));
    setItems(all); setMoves(merged); return all;
  }
  window.rebuildStockV337=rebuildStockV337;
  window.rebuildStockV336=rebuildStockV337;

  function productStats(itemId){
    rebuildStockV337();
    const it=itemById(itemId)||{}; const ms=moves().filter(m=>String(m.item_id)===String(itemId)&&isApproved(m));
    const incoming=(it.batches||[]).filter(b=>b.source!=='مرتجع').reduce((a,b)=>a+n(b.qty_initial),0);
    const outgoing=ms.filter(m=>OUT_TYPES.has(m.type)).reduce((a,m)=>a+n(m.qty),0);
    const returns=ms.filter(m=>m.type==='مرتجع').reduce((a,m)=>a+n(m.qty),0);
    const remaining=n(it.qty);
    const value=(it.batches||[]).reduce((a,b)=>a+n(b.qty_remaining)*n(b.unit_after),0);
    return {incoming,outgoing,returns,remaining,value};
  }
  function groupMoves(){
    const gs={};
    moves().forEach(m=>{const id=m.batch_id||m.id; if(!gs[id])gs[id]={id,batch_no:m.batch_no||('MOV-'+String(id).slice(-6).toUpperCase()),date:m.date,supervisor_id:m.supervisor_id,supervisor_name:m.supervisor_name,status:m.status,notes:m.batch_notes||'',lines:[]}; gs[id].lines.push(m)});
    return Object.values(gs).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }
  function byItem(lines){const o={}; lines.forEach(m=>{const k=m.item_id||'unknown'; if(!o[k])o[k]={item:itemById(k),lines:[]}; o[k].lines.push(m)}); return Object.entries(o).map(([item_id,g])=>({item_id,...g}))}
  function targetInput(m){const ct=m.cost_type||'FM', id=esc(m.id); if(ct==='FM')return `<select id="v337Target_${id}">${projectOptions(m.project_id)}</select>`; if(ct==='CN')return `<input id="v337Target_${id}" value="${esc(m.order_no||'')}" placeholder="رقم الأوردر">`; return `<input id="v337Target_${id}" value="${esc(m.general_note||'عام')}" placeholder="ملاحظة عامة">`;}
  function addTargetInput(productId){return `<div id="v337AddFm_${esc(productId)}"><label>المشروع</label><select id="v337AddProject_${esc(productId)}">${projectOptions()}</select></div><div id="v337AddCn_${esc(productId)}" style="display:none"><label>رقم الأوردر</label><input id="v337AddOrder_${esc(productId)}" placeholder="رقم الأوردر"></div><div id="v337AddGeneral_${esc(productId)}" style="display:none"><label>عام</label><input id="v337AddGeneralNote_${esc(productId)}" value="عام"></div>`}

  function ensureStyle(){
    if($('v337Style'))return;
    const st=document.createElement('style'); st.id='v337Style'; st.textContent=`
    .v337-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto;direction:rtl}.v337-panel{background:#fff;border-radius:20px;width:min(1240px,98vw);box-shadow:0 20px 70px rgba(0,0,0,.24);padding:16px;border:1px solid #d8eae4}.v337-head{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #e2eee9;padding-bottom:10px;margin-bottom:12px}.v337-head h2{margin:0;color:#064a3a}.v337-btn{border:0;border-radius:11px;padding:9px 13px;background:#064a3a;color:#fff;font-weight:900;cursor:pointer}.v337-danger{background:#c2383d}.v337-light{background:#eef7f3;color:#064a3a;border:1px solid #d6e8e1}.v337-note{background:#fff8e7;border:1px dashed #dfad2f;color:#674a00;border-radius:14px;padding:10px;margin:10px 0}.v337-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.v337-kpi{background:#f8fcfa;border:1px solid #d9eae4;border-radius:14px;padding:11px}.v337-kpi small{display:block;color:#789}.v337-kpi b{font-size:18px;color:#064a3a}.v337-product{border:1px solid #d8ebe4;border-radius:20px;margin:14px 0;background:#fbfefd;overflow:hidden}.v337-product-head{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;background:#eef8f4;border-bottom:1px solid #d8ebe4;padding:12px}.v337-img{width:100px;height:82px;border-radius:14px;background:#f3faf7;border:1px solid #d8e9e3;display:grid;place-items:center;overflow:hidden;color:#789;font-weight:900}.v337-img img{width:100%;height:100%;object-fit:cover}.v337-title b{font-size:20px;color:#063d31}.v337-mini{font-size:12px;color:#6d837b}.v337-badges{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.v337-badge{background:#fff;border:1px solid #d5e7e1;border-radius:12px;padding:7px 9px;font-weight:900;color:#064a3a}.v337-badge.out{color:#b3272f}.v337-badge.ret{color:#087a43}.v337-lines{padding:12px}.v337-line,.v337-add-grid{display:grid;grid-template-columns:.9fr .65fr .8fr 1fr .8fr 1.1fr .8fr .55fr;gap:8px;align-items:end;background:#fff;border:1px solid #e3efeb;border-radius:14px;padding:10px;margin-bottom:8px}.v337-line label,.v337-add label{display:block;font-size:12px;color:#526b62;margin-bottom:4px}.v337-line input,.v337-line select,.v337-add input,.v337-add select{width:100%;box-sizing:border-box;border:1px solid #d6e7e1;border-radius:10px;padding:8px;background:#fff}.v337-total{font-weight:900;color:#064a3a;text-align:center}.v337-add{border:1px dashed #dfad2f;background:#fffdf4;border-radius:15px;padding:12px;margin-top:10px}.v337-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #e2eee9;padding-top:12px;margin-top:14px}@media(max-width:1000px){.v337-kpis{grid-template-columns:1fr 1fr}.v337-product-head{grid-template-columns:1fr}.v337-badges{justify-content:flex-start}.v337-line,.v337-add-grid{grid-template-columns:1fr 1fr}.v337-img{width:100%;height:140px}}`;
    document.head.appendChild(st);
  }
  function modal(title,html){document.querySelector('.v336-modal')?.remove();document.querySelector('.v337-modal')?.remove();const d=document.createElement('div');d.className='v337-modal';d.innerHTML=`<div class="v337-panel"><div class="v337-head"><h2>${esc(title)}</h2><button class="v337-btn v337-danger" onclick="this.closest('.v337-modal').remove()">إغلاق</button></div>${html}</div>`;document.body.appendChild(d)}

  window.v337CostChanged=function(itemId){const ct=$(`v337AddCost_${itemId}`)?.value||'FM'; ['Fm','Cn','General'].forEach(x=>{const el=$(`v337Add${x}_${itemId}`); if(el) el.style.display='none'}); const el=$(`v337Add${ct==='FM'?'Fm':ct==='CN'?'Cn':'General'}_${itemId}`); if(el) el.style.display='block'};
  window.v337LineCostChanged=function(id){const ms=moves(); const m=ms.find(x=>String(x.id)===String(id)); if(!m)return; m.cost_type=$(`v337Cost_${id}`)?.value||'FM'; if(m.cost_type==='FM'){m.order_no='';m.general_note=''} if(m.cost_type==='CN'){m.project_id='';m.general_note=''} if(m.cost_type==='GENERAL'){m.project_id='';m.order_no='';m.general_note=m.general_note||'عام'} setMoves(ms); window.v337OpenMove(m.batch_id||m.id)};
  window.v337SaveLine=function(id){
    const ms=moves(); const m=ms.find(x=>String(x.id)===String(id)); if(!m)return;
    m.type=$(`v337Type_${id}`)?.value||m.type; m.qty=n($(`v337Qty_${id}`)?.value); m.unit_cost_override=n($(`v337CostUnit_${id}`)?.value||m.unit_cost_override||m.unit_cost||avgCost(itemById(m.item_id))); m.cost_type=$(`v337Cost_${id}`)?.value||m.cost_type||'FM'; m.notes=$(`v337Notes_${id}`)?.value||'';
    const target=$(`v337Target_${id}`)?.value||'';
    if(m.cost_type==='FM'){m.project_id=target;m.order_no='';m.general_note=''} else if(m.cost_type==='CN'){m.order_no=target;m.project_id='';m.general_note=''} else {m.general_note=target||'عام';m.project_id='';m.order_no=''}
    if(!m.qty){alert('الكمية لا يمكن أن تكون صفر');return}
    if(m.cost_type==='FM'&&!m.project_id){alert('اختر المشروع');return}
    if(m.cost_type==='CN'&&!m.order_no){alert('اكتب رقم الأوردر');return}
    m.amount=r2(m.qty*m.unit_cost_override); setMoves(ms); rebuildStockV337(); window.v337OpenMove(m.batch_id||m.id);
  };
  window.v337DeleteLine=function(id,batch){if(!confirm('حذف هذا التوزيع؟'))return; setMoves(moves().filter(m=>String(m.id)!==String(id))); rebuildStockV337(); window.v337OpenMove(batch)};
  window.v337AddAllocation=function(batch,itemId){
    const group=groupMoves().find(g=>String(g.id)===String(batch)); if(!group)return;
    const it=itemById(itemId); if(!it)return alert('المنتج غير موجود');
    const qty=n($(`v337AddQty_${itemId}`)?.value), type=$(`v337AddType_${itemId}`)?.value||'استهلاك', ct=$(`v337AddCost_${itemId}`)?.value||'FM';
    if(!qty)return alert('اكتب كمية التوزيع');
    const row={id:uid(),batch_id:group.id,batch_no:group.batch_no,date:group.date,created_at:new Date().toISOString(),supervisor_id:group.supervisor_id,supervisor_name:group.supervisor_name,status:group.status||'بانتظار',batch_notes:group.notes||'',item_id:itemId,item_name:it.name||'',qty,type,cost_type:ct,project_id:'',order_no:'',general_note:'',notes:$(`v337AddNotes_${itemId}`)?.value||'',unit_cost_override:n($(`v337AddUnit_${itemId}`)?.value||avgCost(it))};
    if(ct==='FM'){row.project_id=$(`v337AddProject_${itemId}`)?.value||''; if(!row.project_id)return alert('اختر المشروع')} else if(ct==='CN'){row.order_no=$(`v337AddOrder_${itemId}`)?.value||''; if(!row.order_no)return alert('اكتب رقم الأوردر')} else row.general_note=$(`v337AddGeneralNote_${itemId}`)?.value||'عام';
    const ms=moves(); ms.push(row); setMoves(ms); rebuildStockV337(); window.v337OpenMove(batch);
  };
  window.v337AddNewProductAllocation=function(batch){const itemId=$('v337GlobalItem')?.value||''; if(!itemId)return alert('اختر المنتج'); const group=groupMoves().find(g=>String(g.id)===String(batch)); if(!group)return; const it=itemById(itemId); const ms=moves(); ms.push({id:uid(),batch_id:group.id,batch_no:group.batch_no,date:group.date,created_at:new Date().toISOString(),supervisor_id:group.supervisor_id,supervisor_name:group.supervisor_name,status:group.status||'بانتظار',batch_notes:group.notes||'',item_id:itemId,item_name:it?.name||'',qty:1,type:'استهلاك',cost_type:'FM',project_id:'',order_no:'',general_note:'',notes:'',unit_cost_override:avgCost(it)}); setMoves(ms); rebuildStockV337(); window.v337OpenMove(batch)};

  window.v337OpenMove=function(id){
    ensureStyle(); rebuildStockV337();
    const group=groupMoves().find(g=>String(g.id)===String(id)); if(!group)return;
    const grouped=byItem(group.lines);
    const totalOut=group.lines.filter(m=>OUT_TYPES.has(m.type)).reduce((a,m)=>a+n(m.qty),0), totalReturn=group.lines.filter(m=>m.type==='مرتجع').reduce((a,m)=>a+n(m.qty),0), netQty=r2(totalOut-totalReturn), netCost=r2(group.lines.reduce((a,m)=>a+signedAmount(m),0));
    const productsHtml=grouped.map(g=>{
      const it=g.item||{}; const stats=productStats(g.item_id); const out=g.lines.filter(m=>OUT_TYPES.has(m.type)).reduce((a,m)=>a+n(m.qty),0); const ret=g.lines.filter(m=>m.type==='مرتجع').reduce((a,m)=>a+n(m.qty),0); const net=r2(out-ret); const cost=r2(g.lines.reduce((a,m)=>a+signedAmount(m),0));
      const linesHtml=g.lines.map(m=>`<div class="v337-line"><div><label>الحركة تحت المنتج</label><select id="v337Type_${esc(m.id)}">${MOVE_TYPES.map(t=>`<option ${m.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div><label>الكمية</label><input id="v337Qty_${esc(m.id)}" type="number" step="0.01" value="${n(m.qty)}"></div><div><label>مركز التكلفة</label><select id="v337Cost_${esc(m.id)}" onchange="v337LineCostChanged('${esc(m.id)}')"><option ${m.cost_type==='FM'?'selected':''}>FM</option><option ${m.cost_type==='CN'?'selected':''}>CN</option><option ${m.cost_type==='GENERAL'?'selected':''}>GENERAL</option></select></div><div><label>المشروع / الأوردر / عام</label>${targetInput(m)}</div><div><label>تكلفة الوحدة FIFO</label><input id="v337CostUnit_${esc(m.id)}" type="number" step="0.01" value="${n(m.unit_cost_override||m.unit_cost||avgCost(it))}"></div><div><label>ملاحظات</label><input id="v337Notes_${esc(m.id)}" value="${esc(m.notes||'')}" placeholder="مثال: استهلاك في مشروع / ارتجاع"></div><div class="v337-total"><label>الإجمالي</label>${money(signedAmount(m))}</div><div><button class="v337-btn" onclick="v337SaveLine('${esc(m.id)}')">حفظ</button><button class="v337-btn v337-danger" style="margin-top:5px" onclick="v337DeleteLine('${esc(m.id)}','${esc(group.id)}')">حذف</button></div></div>`).join('');
      return `<section class="v337-product"><div class="v337-product-head"><div class="v337-img">${imgHtml(it.image_data||it.image_url||'')}</div><div class="v337-title"><b>${esc(it.name||g.lines[0]?.item_name||'-')}</b><div class="v337-mini">الكود: ${esc(it.code||'-')} | كود الشركة: ${esc(it.company_code||'-')} | الوحدة: ${esc(it.unit||'-')}</div><div class="v337-mini">FIFO: يستهلك من الدفعة القديمة أولًا ثم الجديدة، والمرتجع داخل نفس الحركة يظهر كمرتجع في التقرير ويوازن الصافي.</div></div><div class="v337-badges"><span class="v337-badge">دخل: ${n(stats.incoming)}</span><span class="v337-badge out">خرج: ${n(stats.outgoing)}</span><span class="v337-badge ret">مرتجع: ${n(stats.returns)}</span><span class="v337-badge">متبقي: ${n(stats.remaining)}</span><span class="v337-badge">قيمة المتبقي: ${money(stats.value)}</span></div></div><div class="v337-lines"><div class="v337-note">هذا هو المنتج، وتحت المنتج تسجل ما تم: استهلاك في مشروع، صرف، هدر، تالف، سكراب، أو مرتجع. كل سطر يدخل في تقرير المشروع ومركز التكلفة.</div>${linesHtml}<div class="v337-add"><h3>إضافة استخدام / مرتجع تحت نفس المنتج</h3><div class="v337-add-grid"><div><label>نوع الحركة</label><select id="v337AddType_${esc(g.item_id)}">${MOVE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div><label>الكمية</label><input id="v337AddQty_${esc(g.item_id)}" type="number" step="0.01"></div><div><label>مركز التكلفة</label><select id="v337AddCost_${esc(g.item_id)}" onchange="v337CostChanged('${esc(g.item_id)}')"><option>FM</option><option>CN</option><option>GENERAL</option></select></div>${addTargetInput(g.item_id)}<div><label>تكلفة الوحدة</label><input id="v337AddUnit_${esc(g.item_id)}" type="number" step="0.01" value="${r2(avgCost(it))}"></div><div><label>ملاحظات</label><input id="v337AddNotes_${esc(g.item_id)}" placeholder="مثال: استهلاك في مشروع أو مرتجع للمخزن"></div><button class="v337-btn" onclick="v337AddAllocation('${esc(group.id)}','${esc(g.item_id)}')">إضافة</button></div><div class="v337-mini">الصافي داخل هذه الحركة لهذا المنتج: خارج ${n(out)} - مرتجع ${n(ret)} = ${n(net)} | التكلفة ${money(cost)}</div></div></div></section>`;
    }).join('');
    modal('عرض / تعديل حركة المخزون حسب المنتج',`<div class="v337-kpis"><div class="v337-kpi"><small>الحركة</small><b>${esc(group.batch_no)}</b></div><div class="v337-kpi"><small>التاريخ</small><b>${esc(group.date)}</b></div><div class="v337-kpi"><small>المشرف</small><b>${esc(sName(group.supervisor_id,group.supervisor_name))}</b></div><div class="v337-kpi"><small>الصافي / التكلفة</small><b>${n(netQty)} | ${money(netCost)}</b></div></div><div class="v337-note">الآلية: اسم المنتج في الأعلى، وتحته كل ما تم عليه: استهلاك في مشروع، صرف، مرتجع، هدر، تالف أو سكراب. الدخل والخرج والمرتجع والمتبقي والتقارير تُحسب من نفس هذه السطور مع FIFO.</div>${productsHtml}<div class="v337-add"><h3>إضافة منتج آخر داخل نفس الحركة</h3><div class="v337-add-grid" style="grid-template-columns:1fr auto"><select id="v337GlobalItem">${itemOptions()}</select><button class="v337-btn" onclick="v337AddNewProductAllocation('${esc(group.id)}')">إضافة المنتج</button></div></div><div class="v337-footer"><span class="v337-mini">بعد حفظ أي سطر، سيتم تحديث المخزون والتقارير مباشرة.</span><button class="v337-btn" onclick="this.closest('.v337-modal').remove(); if(window.financeV312RenderMovements) financeV312RenderMovements();">تحديث وإغلاق</button></div>`);
  };

  window.v334ViewMove=function(id){return window.v337OpenMove(id)};
  window.v335OpenMove=function(id){return window.v337OpenMove(id)};
  window.v336OpenMove=function(id){return window.v337OpenMove(id)};

  const oldRender=window.financeV312RenderMovements;
  if(typeof oldRender==='function'){
    window.financeV312RenderMovements=function(){const r=oldRender.apply(this,arguments); setTimeout(()=>{document.querySelectorAll('button[onclick*="v334ViewMove"],button[onclick*="v335OpenMove"],button[onclick*="v336OpenMove"]').forEach(btn=>{const oc=btn.getAttribute('onclick')||''; const id=(oc.match(/\('([^']+)'\)/)||[])[1]; if(id)btn.setAttribute('onclick',`v337OpenMove('${id}')`);});},80); return r;};
  }
  setTimeout(()=>{try{rebuildStockV337();}catch(e){console.warn('v337 rebuild',e)}},600);
})();
