/* Tasneef v10155 - Finance movement filters + product name sync
   Scope: المالية والمخزون فقط.
   - تبويب حركة المخزون: فلتر المشرفين + فلتر التاريخ.
   - اسم المنتج في الحركات يُقرأ من جدول المنتجات الرسمي، لذلك إذا تغير اسم المنتج يظهر الاسم الجديد في الحركات القديمة بدون إنشاء حركة جديدة.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceMovementFiltersSyncV10155) return;
  window.__tasneefFinanceMovementFiltersSyncV10155 = true;

  const VERSION='v10155-finance-movement-filters-sync';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const state=()=>window.financeProStateV15||{};
  const VAT=0.15;
  const filters={supervisor:'', dateFrom:'', dateTo:'', type:''};
  let syncing=false;
  let didAutoSync=false;

  function safeJson(v){
    const t=S(v);
    if(!t.startsWith('finance_pro_v15:')) return {};
    try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function movementDate(m){return S(m&&(m.movement_date||m.date||m.created_at)).slice(0,10);}
  function movementTypeLabel(t){return ({in:'داخل',out:'صرف',consume:'استهلاك',waste:'هدر',damaged:'تالف',scrap:'سكراب',return:'مرتجع'})[S(t)]||S(t)||'-';}
  function movementOutTypes(){return ['out','consume','waste','damaged','scrap'];}
  function productKeys(obj){
    const keys=[];
    [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{
      const x=S(v).toLowerCase();
      if(x&&!keys.includes(x)) keys.push(x);
    });
    return keys;
  }
  function officialItemForMovement(m){
    const st=state();
    const keys=productKeys(m);
    return A(st.items).find(i=>productKeys(i).some(k=>keys.includes(k)))||null;
  }
  function officialProductName(m){
    const it=officialItemForMovement(m);
    return S(it&&(it.name||it.item_name)) || S(m&&m.item_name) || S(m&&m.product_name) || S(m&&m.product_code) || '-';
  }
  function projectName(id){
    const st=state();
    const p=A(st.projects).find(x=>String(x.id)===String(id));
    return S(p&&(p.name||p.project_name))||'';
  }
  function staffName(id){
    const st=state();
    const u=A(st.users).find(x=>String(x.id)===String(id));
    return S(u&&(u.full_name||u.name||u.username))||S(id);
  }
  function movementUnitCost(m){
    const meta=safeJson(m&&m.notes)||{};
    if(N(m&&m.unit_cost)>0) return N(m.unit_cost);
    if(N(meta.beforeVat)>0&&N(m&&m.quantity)>0) return N(meta.beforeVat)/N(m.quantity);
    const it=officialItemForMovement(m);
    return it?itemCost(it):0;
  }
  function movementNet(m){
    const meta=safeJson(m&&m.notes)||{};
    if(N(meta.beforeVat)>0) return N(meta.beforeVat);
    return N(m&&m.quantity)*movementUnitCost(m);
  }
  function movementDistributionRows(m){
    const meta=safeJson(m&&m.notes)||{};
    const rows=A(meta.distribution);
    if(!rows.length) return [{...m,parent_id:m.id,distribution_index:null,base_movement_type:S(m.movement_type),distribution_note:'',order_no:S(m&&m.order_no||''),project_name:S(m&&m.project_name||'')}];
    return rows.map((d,idx)=>({
      ...m,
      parent_id:m.id,
      distribution_index:idx,
      is_distribution_row:true,
      base_movement_type:S(m.movement_type),
      movement_type:S(d.type||m.movement_type)||S(m.movement_type),
      quantity:N(d.qty),
      center:S(d.center||m.cost_center),
      project_id:d.projectId||m.project_id||null,
      project_name:S(d.projectName||projectName(d.projectId)||m.project_name||''),
      order_no:S(d.orderNo||m.order_no||''),
      distribution_note:S(d.note||'')
    })).filter(r=>N(r.quantity)>0);
  }
  function movementStaffId(m){return S(safeJson(m&&m.notes).staffId || m.staff_id || m.supervisor_id || m.user_id || m.created_by || '');}
  function movementStaffName(m){
    const id=movementStaffId(m);
    return S(m&&m.receiver) || (id?staffName(id):'') || '-';
  }
  function supervisorOptions(){
    const st=state();
    const map=new Map();
    A(st.users).forEach(u=>{
      const name=S(u.full_name||u.name||u.username);
      if(!name) return;
      const role=S(u.role||u.user_role||u.type).toLowerCase();
      if(/supervisor|مشرف|admin|manager|مدير/.test(role) || A(st.movements).some(m=>S(m.receiver)===name || movementStaffId(m)===S(u.id))){
        map.set(S(u.id)||name, name);
      }
    });
    A(st.movements).forEach(m=>{ const n=S(m.receiver); if(n&&!map.has(n)) map.set(n,n); });
    return [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar'));
  }
  function movementMatchesSupervisor(m, value){
    if(!value) return true;
    const st=state();
    const mvId=movementStaffId(m);
    const rec=S(m.receiver);
    const u=A(st.users).find(x=>String(x.id)===String(value));
    const names=[value, u&&u.full_name, u&&u.name, u&&u.username].map(S).filter(Boolean);
    if(mvId && String(mvId)===String(value)) return true;
    return names.some(n=>rec===n || rec.includes(n) || n.includes(rec));
  }
  function passesFilters(row){
    const d=movementDate(row);
    if(filters.dateFrom && d && d<filters.dateFrom) return false;
    if(filters.dateTo && d && d>filters.dateTo) return false;
    if(filters.supervisor && !movementMatchesSupervisor(row, filters.supervisor)) return false;
    if(filters.type && S(row.movement_type)!==filters.type) return false;
    return true;
  }
  function currentMovementRows(){
    return A(state().movements).flatMap(movementDistributionRows).filter(passesFilters)
      .sort((a,b)=>S(movementDate(b)||b.created_at).localeCompare(S(movementDate(a)||a.created_at)) || N(b.id)-N(a.id));
  }
  function syncMovementNamesInMemory(){
    const st=state();
    A(st.movements).forEach(m=>{
      const name=officialProductName(m);
      if(name && name!=='-' && S(m.item_name)!==name){ m.item_name=name; }
    });
  }
  async function syncMovementNamesToDb(force){
    if(syncing) return;
    const st=state();
    if(!force && didAutoSync) return;
    const c=client();
    if(!c||!c.from||!A(st.movements).length||!A(st.items).length) return;
    const mismatches=new Map();
    A(st.movements).forEach(m=>{
      const it=officialItemForMovement(m);
      const name=S(it&&(it.name||it.item_name));
      if(!it||!name||S(m.item_name)===name) return;
      const key=S(it.id||itemCode(it)||name);
      if(key) mismatches.set(key,{item:it,name});
    });
    if(!mismatches.size) { didAutoSync=true; return; }
    syncing=true;
    try{
      let count=0;
      for(const {item,name} of mismatches.values()){
        if(count>=60) break;
        if(S(item.id)){
          const r=await c.from('inventory_movements').update({item_name:name}).eq('item_id',item.id);
          if(r.error) console.warn('v10155 sync item_id failed', r.error.message||r.error);
          count++;
        }
        const code=itemCode(item);
        if(code){
          const r2=await c.from('inventory_movements').update({item_name:name}).eq('product_code',code);
          if(r2.error) console.warn('v10155 sync product_code failed', r2.error.message||r2.error);
        }
      }
      didAutoSync=true;
      syncMovementNamesInMemory();
    }catch(e){ console.warn('v10155 sync names failed', e); }
    finally{ syncing=false; }
  }

  function renderEnhancedMovementList(){
    const box=$('finMovementListV10155');
    if(!box) return;
    syncMovementNamesInMemory();
    const rows=currentMovementRows();
    const st=state();
    const totalQty=rows.reduce((a,r)=>a+N(r.quantity),0);
    const totalNet=rows.reduce((a,r)=>a+movementNet(r),0);
    const types=[['','كل الحركات'],['in','داخل'],['out','صرف'],['consume','استهلاك'],['damaged','تالف'],['waste','هدر'],['scrap','سكراب'],['return','مرتجع']];
    const supOpts=supervisorOptions();
    const filterHtml=`<div class="fin-card fm10155-filter-card"><h3>حركة المخزون</h3><div class="fin-actions fm10155-filters">
      <div><label>المشرفين</label><select id="fm10155Supervisor"><option value="">كل المشرفين</option>${supOpts.map(([v,n])=>`<option value="${esc(v)}" ${filters.supervisor===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
      <div><label>من تاريخ</label><input id="fm10155DateFrom" type="date" value="${esc(filters.dateFrom)}"></div>
      <div><label>إلى تاريخ</label><input id="fm10155DateTo" type="date" value="${esc(filters.dateTo)}"></div>
      <div><label>نوع الحركة</label><select id="fm10155Type">${types.map(([v,n])=>`<option value="${esc(v)}" ${filters.type===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
      <button class="light" type="button" id="fm10155ClearFilters">تفريغ الفلاتر</button>
      <button class="light" type="button" id="fm10155SyncNames">مزامنة أسماء المنتجات</button>
    </div><div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">عدد الحركات: <b>${rows.length}</b></div><div class="fin-soft">إجمالي الكمية: <b>${totalQty}</b></div><div class="fin-soft">القيمة قبل الضريبة: <b>${money(totalNet)}</b></div></div></div>`;
    const tableHtml=`<div class="fin-card"><h3>سجل حركة المخزون حسب الفلاتر</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المنتج</th><th>الكود</th><th>نوع الحركة</th><th>الكمية</th><th>المشرف / المستلم</th><th>المشروع</th><th>الأوردر</th><th>القيمة</th><th>إجراء</th></tr></thead><tbody>${rows.map(r=>{
      const parent=r.parent_id||r.id;
      const item=officialItemForMovement(r)||{};
      const productName=officialProductName(r);
      const project=S(r.project_name)||projectName(r.project_id)||'-';
      return `<tr data-fm10155-row="1" data-id="${esc(parent)}"><td>${esc(movementDate(r)||'-')}</td><td><b>${esc(productName)}</b></td><td>${esc(itemCode(item)||r.product_code||r.barcode||'-')}</td><td><span class="fin-badge ${movementOutTypes().includes(S(r.movement_type))?'warn':S(r.movement_type)==='return'?'neutral':''}">${esc(movementTypeLabel(r.movement_type))}</span></td><td>${N(r.quantity)}</td><td>${esc(movementStaffName(r))}</td><td>${esc(project)}</td><td>${esc(r.order_no||'-')}</td><td>${money(movementNet(r))}</td><td class="fin-actions"><button class="light" onclick="financeProShowMovementV15(${Number(parent)||0})">عرض</button><button onclick="financeProEditMovementV15(${Number(parent)||0})">تعديل</button>${(typeof window.financeProDeleteMovementV15==='function')?`<button class="danger" onclick="financeProDeleteMovementV15(${Number(parent)||0})">حذف</button>`:''}</td></tr>`;
    }).join('')||'<tr><td colspan="10">لا توجد حركات حسب الفلاتر.</td></tr>'}</tbody></table></div></div>`;
    box.innerHTML=filterHtml+tableHtml;
    bindFilters();
  }
  function bindFilters(){
    const sup=$('fm10155Supervisor'), from=$('fm10155DateFrom'), to=$('fm10155DateTo'), type=$('fm10155Type');
    if(sup) sup.onchange=()=>{filters.supervisor=S(sup.value); renderEnhancedMovementList();};
    if(from) from.onchange=()=>{filters.dateFrom=S(from.value); renderEnhancedMovementList();};
    if(to) to.onchange=()=>{filters.dateTo=S(to.value); renderEnhancedMovementList();};
    if(type) type.onchange=()=>{filters.type=S(type.value); renderEnhancedMovementList();};
    const clear=$('fm10155ClearFilters'); if(clear) clear.onclick=()=>{filters.supervisor='';filters.dateFrom='';filters.dateTo='';filters.type='';renderEnhancedMovementList();};
    const sync=$('fm10155SyncNames'); if(sync) sync.onclick=async()=>{sync.disabled=true; sync.textContent='جاري المزامنة...'; await syncMovementNamesToDb(true); if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); setTimeout(()=>{sync.disabled=false;sync.textContent='مزامنة أسماء المنتجات'; enhanceMovementTab();},400);};
  }
  function hideCoreMovementLists(body, formCard){
    A([...body.querySelectorAll(':scope > .fin-card')]).forEach(card=>{
      if(card===formCard) return;
      if(card.id==='fm10155Host') return;
      const txt=S(card.textContent);
      if(card.querySelector('.fin-table') && /حركة|الحركات|المخزون|سجل/.test(txt)) card.style.display='none';
    });
  }
  function enhanceMovementTab(){
    const st=state();
    if(!st || st.tab!=='movement') return;
    const body=$('finBodyV15'); if(!body) return;
    syncMovementNamesInMemory();
    const formCard=$('finMoveItemV15')?.closest('.fin-card') || null;
    let host=$('fm10155Host');
    if(!host){
      host=document.createElement('div');
      host.id='fm10155Host';
      host.innerHTML='<div id="finMovementListV10155"></div>';
      if(formCard && formCard.nextSibling) body.insertBefore(host, formCard.nextSibling); else body.appendChild(host);
    }
    hideCoreMovementLists(body, formCard);
    renderEnhancedMovementList();
    syncMovementNamesToDb(false);
  }
  function patchShowMovement(){
    if(window.__fm10155ShowPatched) return; window.__fm10155ShowPatched=true;
    const old=window.financeProShowMovementV15;
    window.financeProShowMovementV15=function(id){
      const st=state();
      const m=A(st.movements).find(x=>String(x.id)===String(id));
      if(!m || !old) return old?old.apply(this,arguments):undefined;
      const oldName=m.item_name;
      const name=officialProductName(m);
      if(name) m.item_name=name;
      const res=old.apply(this,arguments);
      m.item_name=oldName;
      // ensure modal visible name is official even if base copied old value elsewhere
      setTimeout(()=>{
        const cards=[...document.querySelectorAll('.fin-modal-card,.fin-modal-backdrop')];
        cards.forEach(card=>{
          const b=[...card.querySelectorAll('b')].find(x=>S(x.textContent)===S(oldName));
          if(b&&name) b.textContent=name;
        });
      },20);
      return res;
    };
  }
  function patchFinanceHooks(){
    if(window.__fm10155HooksPatched) return; window.__fm10155HooksPatched=true;
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function'){
      window.financeProTabV15=function(){ const r=oldTab.apply(this,arguments); setTimeout(enhanceMovementTab,80); return r; };
    }
    const oldLoad=window.financeProLoadV15;
    if(typeof oldLoad==='function'){
      window.financeProLoadV15=async function(){ const r=await oldLoad.apply(this,arguments); setTimeout(enhanceMovementTab,120); return r; };
    }
    const oldEdit=window.financeProEditMovementV15;
    if(typeof oldEdit==='function'){
      window.financeProEditMovementV15=function(){ const r=oldEdit.apply(this,arguments); setTimeout(enhanceMovementTab,120); return r; };
    }
  }
  function installStyle(){
    if($('fm10155Style')) return;
    const st=document.createElement('style'); st.id='fm10155Style';
    st.textContent=`#fm10155Host{display:block!important;margin-top:12px}.fm10155-filters>div{min-width:180px}.fm10155-filter-card{border-color:#bfe1d6!important;background:linear-gradient(180deg,#fff,#f8fffc)!important}#finMovementListV10155 .fin-table{max-height:64vh}#fm10155SyncNames{border:1px solid #cfe3db!important}`;
    document.head.appendChild(st);
  }
  function boot(){ installStyle(); patchFinanceHooks(); patchShowMovement(); setTimeout(enhanceMovementTab,150); setTimeout(enhanceMovementTab,800); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>setTimeout(boot,600),{once:true});
  console.log('Loaded '+VERSION);
})();
