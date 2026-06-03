/* TASNEEF v335 - Movement modal: edit qty + add project/order distributions */
(function(){
  'use strict';
  if(window.__tasneefV335MoveQtyAllocEdit) return; window.__tasneefV335MoveQtyAllocEdit=true;
  const LS={items:'tasneef_v312_items',moves:'tasneef_v312_moves'};
  const $=id=>document.getElementById(id);
  const parse=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(_){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const n=v=>Number(String(v??'').replace(/,/g,''))||0;
  const r2=v=>Math.round(n(v)*100)/100;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const MOVE_TYPES=['صرف','استهلاك','هدر','تالف','سكراب','مرتجع'];
  const outTypes=new Set(['صرف','استهلاك','هدر','تالف','سكراب']);
  const isApproved=m=>['معتمد','تم الصرف'].includes(m.status||'');
  function projects(){return Array.isArray(window.data?.projects)?window.data.projects:[]}
  function supervisors(){return Array.isArray(window.data?.supervisors)?window.data.supervisors:[]}
  function items(){return parse(LS.items).map(i=>({...i,batches:Array.isArray(i.batches)?i.batches:[]}))}
  function moves(){return parse(LS.moves)}
  function pName(id){const p=projects().find(x=>String(x.id)===String(id));return p?(p.name||p.project_name||p.title||id):(id||'-')}
  function sName(id,fb=''){const s=supervisors().find(x=>String(x.id)===String(id));return s?(s.full_name||s.name||s.username||id):(fb||'-')}
  function itemById(id){return items().find(x=>String(x.id)===String(id))||null}
  function itemCost(it){if(!it)return 0; const batches=(it.batches||[]).filter(b=>n(b.qty_remaining)>0); const q=batches.reduce((a,b)=>a+n(b.qty_remaining),0); if(q>0) return batches.reduce((a,b)=>a+n(b.qty_remaining)*n(b.unit_after),0)/q; return n(it.price_after||it.price_after_vat||it.price||0)}
  function target(m){if((m.cost_type||'FM')==='FM')return pName(m.project_id); if(m.cost_type==='CN')return m.order_no||'-'; return m.general_note||'عام'}
  function itemOptions(v=''){return '<option value="">اختر المنتج</option>'+items().map(i=>`<option value="${esc(i.id)}" ${String(v)===String(i.id)?'selected':''}>${esc(i.code||'')} - ${esc(i.name||'')} (${n(i.qty)} ${esc(i.unit||'')})</option>`).join('')}
  function projectOptions(v=''){return '<option value="">اختر المشروع</option>'+projects().map(p=>`<option value="${esc(p.id)}" ${String(v)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join('')}
  function centerFields(m,prefix){const ct=m.cost_type||'FM'; if(ct==='FM') return `<select id="${prefix}_project">${projectOptions(m.project_id)}</select>`; if(ct==='CN') return `<input id="${prefix}_order" value="${esc(m.order_no||'')}" placeholder="رقم الأوردر">`; return `<input id="${prefix}_general" value="${esc(m.general_note||'عام')}" placeholder="ملاحظة عامة">`;}
  function signedAmount(m){const amt=n(m.amount||n(m.qty)*n(m.unit_cost||m.unit_cost_override||itemCost(itemById(m.item_id)))); return m.type==='مرتجع' ? -Math.abs(amt) : amt;}
  function rebuildStockV335(){
    let all=items().map(i=>{const batches=(i.batches||[]).map(b=>({...b,qty_remaining:n(b.qty_initial)})); return {...i,batches,qty:batches.reduce((a,b)=>a+n(b.qty_remaining),0)}});
    const ms=moves().slice().sort((a,b)=>String(a.created_at||a.date||'').localeCompare(String(b.created_at||b.date||'')));
    for(const m of ms.filter(isApproved)){
      const it=all.find(x=>String(x.id)===String(m.item_id)); if(!it) continue;
      if(outTypes.has(m.type)){
        let need=n(m.qty), amount=0, seg=[];
        for(const b of (it.batches||[])){
          if(need<=0) break;
          const take=Math.min(n(b.qty_remaining),need);
          if(take>0){b.qty_remaining=r2(n(b.qty_remaining)-take); need=r2(need-take); const c=n(m.unit_cost_override||b.unit_after||itemCost(it)); amount+=take*c; seg.push({batch_id:b.id,qty:take,unit_cost:c});}
        }
        m.segments=seg; m.amount=r2(amount); m.unit_cost=n(m.unit_cost_override||(n(m.qty)?amount/n(m.qty):itemCost(it)));
      } else if(m.type==='مرتجع'){
        const cost=n(m.unit_cost_override||m.unit_cost||itemCost(it)); const q=n(m.qty); const bid=m.return_batch_id||uid(); m.return_batch_id=bid;
        it.batches=it.batches||[]; it.batches.push({id:bid,source:'مرتجع',date:m.date||new Date().toISOString().slice(0,10),qty_initial:q,qty_remaining:q,unit_before:cost,unit_vat:0,unit_after:cost,price_mode:'no_tax'});
        m.amount=r2(q*cost); m.unit_cost=cost;
      }
      it.qty=r2((it.batches||[]).reduce((a,b)=>a+n(b.qty_remaining),0));
    }
    save(LS.items,all); save(LS.moves,ms); return all;
  }
  function groupMoves(){const gs={}; moves().forEach(m=>{const id=m.batch_id||m.id; if(!gs[id]) gs[id]={id,batch_no:m.batch_no||('MOV-'+String(id).slice(-6).toUpperCase()),date:m.date,supervisor_id:m.supervisor_id,supervisor_name:m.supervisor_name,status:m.status,notes:m.batch_notes||'',lines:[]}; gs[id].lines.push(m)}); return Object.values(gs).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))}
  function ensureModalStyle(){if($('v335Style'))return; const st=document.createElement('style'); st.id='v335Style'; st.textContent=`
  .v335-table{width:100%;border-collapse:separate;border-spacing:0 8px;direction:rtl}.v335-table th{background:#eef7f3;padding:10px;color:#063d31}.v335-table td{background:#fbfefd;border-top:1px solid #dfece7;border-bottom:1px solid #dfece7;padding:8px}.v335-table input,.v335-table select,.v335-add input,.v335-add select{width:100%;box-sizing:border-box;border:1px solid #d8e8e2;border-radius:10px;padding:8px;background:#fff}.v335-add{border:1px dashed #e0b64e;background:#fffdf4;border-radius:16px;padding:12px;margin-top:12px}.v335-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;align-items:end}.v335-note{background:#fff8e6;border:1px dashed #e0b64e;border-radius:12px;padding:10px;margin:10px 0;color:#6b4d00}.v335-btn{border:0;border-radius:10px;padding:9px 12px;background:#064a3a;color:white;font-weight:900;cursor:pointer}.v335-danger{background:#bb2f35}@media(max-width:900px){.v335-grid{grid-template-columns:1fr 1fr}.v335-table{font-size:12px}}`;
  document.head.appendChild(st)}
  function modal(title,html){document.querySelector('.v334-modal')?.remove(); const d=document.createElement('div'); d.className='v334-modal'; d.innerHTML=`<div class="v334-panel"><div class="v334-head"><h2>${esc(title)}</h2><button class="v334-btn danger" onclick="this.closest('.v334-modal').remove()">إغلاق</button></div>${html}</div>`; document.body.appendChild(d)}

  window.v335CenterChanged=function(id,val){const ms=moves(); const m=ms.find(x=>String(x.id)===String(id)); if(m){m.cost_type=val; if(val==='FM'){m.order_no='';m.general_note=''} if(val==='CN'){m.project_id='';m.general_note=''} if(val==='GENERAL'){m.project_id='';m.order_no=''; if(!m.general_note)m.general_note='عام'} save(LS.moves,ms); window.v335OpenMove(m.batch_id||m.id)}};
  window.v335UpdateMove=function(id,field,val){const ms=moves(); const m=ms.find(x=>String(x.id)===String(id)); if(!m)return; if(field==='qty'||field==='unit_cost_override') m[field]=n(val); else m[field]=val; if(field==='project_id'){m.order_no='';m.general_note=''} if(field==='order_no'){m.project_id='';m.general_note=''} if(field==='general_note'){m.project_id='';m.order_no=''} if(field==='type' && m.type==='مرتجع' && !m.unit_cost_override) m.unit_cost_override=n(m.unit_cost||itemCost(itemById(m.item_id))); m.amount=r2(n(m.qty)*n(m.unit_cost_override||m.unit_cost||itemCost(itemById(m.item_id)))); save(LS.moves,ms); rebuildStockV335();};
  window.v335DeleteLine=function(id,batch){if(!confirm('حذف هذا السطر من الحركة؟'))return; save(LS.moves,moves().filter(m=>String(m.id)!==String(id))); rebuildStockV335(); window.v335OpenMove(batch)};
  window.v335AddMoveLine=function(batch){const group=groupMoves().find(g=>String(g.id)===String(batch)); if(!group)return; const item_id=$('v335NewItem')?.value||'', qty=n($('v335NewQty')?.value), type=$('v335NewType')?.value||'استهلاك', ct=$('v335NewCost')?.value||'FM'; if(!item_id)return alert('اختر المنتج'); if(!qty)return alert('اكتب الكمية'); const row={id:uid(),batch_id:group.id,batch_no:group.batch_no,date:group.date,created_at:new Date().toISOString(),supervisor_id:group.supervisor_id,supervisor_name:group.supervisor_name,status:group.status||'بانتظار',batch_notes:group.notes||'',item_id,item_name:itemById(item_id)?.name||'',qty,type,cost_type:ct,project_id:'',order_no:'',general_note:'',notes:$('v335NewNotes')?.value||'',unit_cost_override:n($('v335NewCostUnit')?.value||itemCost(itemById(item_id)))}; if(ct==='FM'){row.project_id=$('v335NewProject')?.value||''; if(!row.project_id)return alert('اختر المشروع')} else if(ct==='CN'){row.order_no=$('v335NewOrder')?.value||''; if(!row.order_no)return alert('اكتب رقم الأوردر')} else row.general_note=$('v335NewGeneral')?.value||'عام'; const ms=moves(); ms.push(row); save(LS.moves,ms); rebuildStockV335(); window.v335OpenMove(batch)};
  window.v335NewCostChanged=function(){const ct=$('v335NewCost')?.value||'FM'; ['v335NewProjectBox','v335NewOrderBox','v335NewGeneralBox'].forEach(id=>{if($(id))$(id).style.display='none'}); if(ct==='FM'&&$('v335NewProjectBox'))$('v335NewProjectBox').style.display='block'; if(ct==='CN'&&$('v335NewOrderBox'))$('v335NewOrderBox').style.display='block'; if(ct==='GENERAL'&&$('v335NewGeneralBox'))$('v335NewGeneralBox').style.display='block';};
  window.v335OpenMove=function(id){ensureModalStyle(); rebuildStockV335(); const group=groupMoves().find(g=>String(g.id)===String(id)); if(!group)return; const rows=group.lines.map(m=>{const prefix='v335_'+m.id; return `<tr><td><b>${esc(itemById(m.item_id)?.name||m.item_name||'-')}</b><br><small>${esc(itemById(m.item_id)?.code||'-')}</small></td><td><select onchange="v335UpdateMove('${m.id}','type',this.value)">${MOVE_TYPES.map(t=>`<option ${m.type===t?'selected':''}>${t}</option>`).join('')}</select></td><td><input type="number" step="0.01" value="${n(m.qty)}" onchange="v335UpdateMove('${m.id}','qty',this.value)"></td><td><select onchange="v335CenterChanged('${m.id}',this.value)"><option ${m.cost_type==='FM'?'selected':''}>FM</option><option ${m.cost_type==='CN'?'selected':''}>CN</option><option ${m.cost_type==='GENERAL'?'selected':''}>GENERAL</option></select></td><td>${centerFields(m,prefix)}<button class="v335-btn" style="margin-top:5px" onclick="v335UpdateMove('${m.id}','${(m.cost_type||'FM')==='FM'?'project_id':m.cost_type==='CN'?'order_no':'general_note'}',document.getElementById('${prefix}_${(m.cost_type||'FM')==='FM'?'project':m.cost_type==='CN'?'order':'general'}').value)">حفظ الوجهة</button></td><td><input type="number" step="0.01" value="${n(m.unit_cost_override||m.unit_cost||itemCost(itemById(m.item_id)))}" onchange="v335UpdateMove('${m.id}','unit_cost_override',this.value)"></td><td>${money(signedAmount(m))}</td><td><button class="v335-btn v335-danger" onclick="v335DeleteLine('${m.id}','${group.id}')">حذف</button></td></tr>`}).join('');
    modal('عرض / تعديل حركة المخزون',`<div class="v334-kpis"><div class="v334-kpi"><small>الحركة</small><b>${esc(group.batch_no)}</b></div><div class="v334-kpi"><small>التاريخ</small><b>${esc(group.date)}</b></div><div class="v334-kpi"><small>المشرف</small><b>${esc(sName(group.supervisor_id,group.supervisor_name))}</b></div></div><div class="v335-note">يمكنك تعديل الكمية، نوع الاستخدام، التكلفة، وتوزيع المنتج على أكثر من مشروع أو أوردر من نفس النافذة. بعد التعديل ستتطابق البيانات مع حركة المخزون ومركز التكلفة والتقارير.</div><table class="v335-table"><thead><tr><th>المنتج</th><th>النوع</th><th>الكمية</th><th>مركز التكلفة</th><th>الوجهة</th><th>تكلفة الحبة</th><th>الإجمالي</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table><div class="v335-add"><h3>إضافة توزيع جديد داخل نفس الحركة</h3><div class="v335-grid"><div><label>المنتج</label><select id="v335NewItem">${itemOptions()}</select></div><div><label>النوع</label><select id="v335NewType">${MOVE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div><label>الكمية</label><input id="v335NewQty" type="number" step="0.01"></div><div><label>مركز التكلفة</label><select id="v335NewCost" onchange="v335NewCostChanged()"><option>FM</option><option>CN</option><option>GENERAL</option></select></div><div id="v335NewProjectBox"><label>المشروع</label><select id="v335NewProject">${projectOptions()}</select></div><div id="v335NewOrderBox" style="display:none"><label>رقم الأوردر</label><input id="v335NewOrder"></div><div id="v335NewGeneralBox" style="display:none"><label>عام</label><input id="v335NewGeneral" value="عام"></div><div><label>تكلفة الحبة</label><input id="v335NewCostUnit" type="number" step="0.01"></div><div><label>ملاحظات</label><input id="v335NewNotes"></div><div><button class="v335-btn" onclick="v335AddMoveLine('${group.id}')">إضافة للحركة</button></div></div></div><div class="v334-actions"><button onclick="document.querySelector('.v334-modal')?.remove(); try{rebuildStockV335&&rebuildStockV335()}catch(e){}; if(window.financeV312RenderMovements) financeV312RenderMovements();">تحديث وإغلاق</button></div>`); v335NewCostChanged(); };
  // Override existing view button handler and ensure future tables use it.
  const oldView=window.v334ViewMove;
  window.v334ViewMove=function(id){return window.v335OpenMove(id)};
  const oldRender=window.financeV312RenderMovements;
  if(typeof oldRender==='function'){
    window.financeV312RenderMovements=function(){const r=oldRender.apply(this,arguments); setTimeout(()=>{document.querySelectorAll('button[onclick^="v334ViewMove"]').forEach(btn=>{const oc=btn.getAttribute('onclick')||''; const id=(oc.match(/v334ViewMove\('([^']+)'\)/)||[])[1]; if(id) btn.setAttribute('onclick',`v335OpenMove('${id}')`);});},30); return r;};
  }
})();
