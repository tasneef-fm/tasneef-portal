/* Tasneef v10117 - Administrative Tasks Users-Only Recipients Workflow
   Scope: new section only. Does not touch finance, inventory, orders, tickets, contracts, attendance, monthly, or permissions.
*/
(function(){
  'use strict';
  if(window.__tasneefAdminTasksV10117) return;
  window.__tasneefAdminTasksV10117 = true;

  const VERSION='v10117-admin-tasks-advanced';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='admin_tasks';
  const LOCAL_KEY='tasneef_admin_tasks_v10117_local';
  const DISMISS_PREFIX='tasneef_admin_task_dismiss_v10117_';

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const nowIso=()=>new Date().toISOString();
  const todayKey=()=>new Date().toISOString().slice(0,10);
  const $=id=>document.getElementById(id);
  const say=(t,type)=>{ try{ if(typeof window.msg==='function') window.msg(t,type); else console.log(t); }catch(_){ console.log(t); } };

  function currentUser(){
    const keys=['tasneef_user','currentUser','user','tasneef_current_user','tasneef_login_user'];
    for(const k of keys){
      try{ const raw=localStorage.getItem(k); if(!raw) continue; const v=JSON.parse(raw); if(v && typeof v==='object') return v; }catch(_){ }
    }
    return {};
  }
  function userName(u=currentUser()){ return S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.email||'مستخدم'); }
  function userLogin(u=currentUser()){ return S(u.username||u.user_name||u.email||u.id||u.name||u.full_name||''); }
  function userRole(u=currentUser()){ return S(u.role||u.user_role||u.type||u.position||''); }
  function isManager(){
    const u=currentUser();
    const txt=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|manager|owner|system|مدير|اداري|إداري|ادارة|إدارة|النظام/.test(txt) || ['admin','general_manager','operations_manager','financial_manager','warehouse_manager','system_admin','owner'].includes(userRole(u));
  }
  function isSupervisor(){ return /supervisor|مشرف/i.test(userRole(currentUser())+' '+userName()); }
  function canCreate(){ return isManager(); }

  async function api(path, options){
    return fetch(SUPABASE_URL+path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'}
    }, options||{}));
  }
  function readLocal(){ try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]')||[];}catch(_){return [];} }
  function writeLocal(rows){ try{localStorage.setItem(LOCAL_KEY,JSON.stringify(A(rows).slice(0,1000)));}catch(e){console.warn('admin tasks local write failed',e);} }

  let state={rows:[], loaded:false, online:true};

  function normalizeTask(t){
    t=t||{};
    return {
      id:t.id || t.local_id || ('L'+Date.now()+Math.random().toString(16).slice(2)),
      title:S(t.title), details:S(t.details), task_type:S(t.task_type||'مهمة إدارية'), priority:S(t.priority||'عادي'), schedule_type:S(t.schedule_type||t.scheduleType||'مجدولة'),
      from_user:S(t.from_user), from_name:S(t.from_name), to_user:S(t.to_user), to_name:S(t.to_name), to_role:S(t.to_role),
      due_at:S(t.due_at), status:S(t.status||'open'), created_at:S(t.created_at||nowIso()), updated_at:S(t.updated_at||nowIso()),
      closed_at:S(t.closed_at), closed_by:S(t.closed_by), approved_at:S(t.approved_at), approved_by:S(t.approved_by), approved_note:S(t.approved_note)
    };
  }
  function sortRows(rows){
    return A(rows).map(normalizeTask).sort((a,b)=>{
      const order={open:0,closed:1,approved:2}; const ao=order[a.status]??3, bo=order[b.status]??3; if(ao!==bo) return ao-bo;
      const ad=a.due_at||'9999', bd=b.due_at||'9999'; const dc=ad.localeCompare(bd); if(dc) return dc;
      return S(b.created_at).localeCompare(S(a.created_at));
    });
  }
  async function loadTasks(){
    try{
      const res=await api('/rest/v1/'+TABLE+'?select=*&order=created_at.desc&limit=1000',{method:'GET'});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      state.rows=sortRows(await res.json());
      state.online=true;
      writeLocal(state.rows);
    }catch(e){
      console.warn('v10117 load online failed, using local', e);
      state.rows=sortRows(readLocal());
      state.online=false;
    }
    state.loaded=true;
    return state.rows;
  }
  async function saveTask(payload){
    payload=normalizeTask(Object.assign({},payload,{updated_at:nowIso()}));
    if(String(payload.id).startsWith('L')) delete payload.id;
    try{
      const res=await api('/rest/v1/'+TABLE,{method:'POST',body:JSON.stringify(payload)});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      const saved=(await res.json())[0];
      await loadTasks();
      return saved;
    }catch(e){
      console.warn('v10117 save online failed, using local', e);
      payload.local_id=payload.id || ('L'+Date.now()+Math.random().toString(16).slice(2));
      const rows=readLocal(); rows.unshift(payload); writeLocal(rows); await loadTasks();
      say('تم الحفظ محليًا فقط. شغّل ملف SQL في Supabase حتى تصبح المهام مشتركة أونلاين.','err');
      return payload;
    }
  }
  async function patchTask(id, patch){
    patch=Object.assign({},patch,{updated_at:nowIso()});
    if(String(id).startsWith('L')){
      const rows=readLocal().map(r=>String(r.id||r.local_id)===String(id)?Object.assign({},r,patch):r); writeLocal(rows); await loadTasks(); return;
    }
    try{
      const res=await api('/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(patch)});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      await loadTasks();
    }catch(e){ console.error('patchTask failed',e); say('لم يتم تحديث المهمة: '+(e.message||e),'err'); }
  }

  function roleLabel(r){
    r=S(r);
    const m={admin:'مدير عام',general_manager:'مدير عام',operations_manager:'مدير تشغيلي',financial_manager:'مدير مالي',warehouse_manager:'مدير مخازن',supervisor:'مشرف',technician:'فني'};
    return m[r]||r;
  }
  let systemUsersCache=[];
  async function collectUsers(){
    const out=[]; const seen=new Set();
    const add=u=>{
      if(!u||typeof u!=='object') return;
      const active = u.active ?? u.is_active ?? u.status;
      if(active===false || active==='false' || active==='موقوف' || active==='inactive') return;
      const name=S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.email);
      const login=S(u.username||u.user_name||u.email||u.id||u.uid||u.user_id||name);
      const role=S(u.role||u.user_role||u.type||u.position||u.job_title||u.title);
      if(!name&&!login) return;
      const key=(login||name).toLowerCase(); if(seen.has(key)) return; seen.add(key);
      out.push({name:name||login, login:login||name, role});
    };

    // المصدر الرسمي: جدول إدارة المستخدمين app_users فقط
    try{
      const res=await api('/rest/v1/app_users?select=*&limit=1000',{method:'GET'});
      if(res.ok){
        const rows=await res.json();
        A(rows).forEach(add);
      }else{
        console.warn('app_users load failed', await res.text().catch(()=>res.status));
      }
    }catch(e){ console.warn('app_users fetch error', e); }

    // احتياط: إذا كان جدول إدارة المستخدمين معروضًا في الصفحة، نقرأ أسماءه فقط
    try{
      document.querySelectorAll('#usersBody tr').forEach(tr=>{
        const cells=[...tr.children].map(td=>S(td.textContent));
        if(cells.length>=2) add({full_name:cells[0], username:cells[1], role:cells[2], active:!/موقوف|false|inactive/i.test(cells[3]||'')});
      });
    }catch(_){ }

    // احتياط محلي محدود جدًا: مفاتيح المستخدمين فقط، وليس العمال أو المشرفين أو المشاريع
    try{
      ['app_users','tasneef_app_users','tasneef_users','users','appUsers'].forEach(k=>{
        const raw=localStorage.getItem(k); if(!raw) return;
        let v; try{v=JSON.parse(raw);}catch(_){return;}
        if(Array.isArray(v)) v.forEach(add);
        else if(v && typeof v==='object') A(v.rows||v.data||v.users||[]).forEach(add);
      });
    }catch(_){ }

    // تأكد أن المستخدم الحالي موجود في القائمة، إذا لم تصل بيانات إدارة المستخدمين لأي سبب
    add(currentUser());
    out.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    systemUsersCache=out;
    return out;
  }

  function injectCss(){
    if($('tasneefAdminTasksStyleV10117')) return;
    const st=document.createElement('style'); st.id='tasneefAdminTasksStyleV10117';
    st.textContent=`
      .at10117-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .at10117-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px}.at10117-grid .wide{grid-column:span 2}.at10117-grid .full{grid-column:1/-1}
      .at10117-muted{color:#60706a;font-size:13px;line-height:1.7}.at10117-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.at10117-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 9px;background:#eef6f3;color:#0A4033;font-weight:900;font-size:12px}.at10117-chip.red{background:#fde8e8;color:#9d2222}.at10117-chip.amber{background:#fff5da;color:#8a6700}.at10117-chip.green{background:#e8f4ee;color:#137a4b}.at10117-btn-mini{padding:7px 9px!important;border-radius:9px!important;font-size:12px!important}.at10117-form{display:none}.at10117-form.show{display:block}.at10117-empty{padding:18px;text-align:center;color:#60706a}.at10117-task-title{font-weight:900;color:#0A4033}.at10117-details{max-width:420px;white-space:normal;line-height:1.7;color:#263b35}.at10117-badge-count{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#b83232;color:#fff;font-size:11px;margin-inline-start:6px;padding:0 5px}
      .at10117-modal{position:fixed;inset:0;background:rgba(2,15,11,.48);z-index:999999;display:none;align-items:center;justify-content:center;padding:18px}.at10117-modal.show{display:flex}.at10117-box{width:min(560px,96vw);background:#fff;border-radius:24px;border:1px solid #dce6e2;box-shadow:0 24px 70px rgba(0,0,0,.25);overflow:hidden}.at10117-box-head{background:linear-gradient(135deg,#0A4033,#0f5a47);color:#fff;padding:18px 20px}.at10117-box-head h3{margin:0 0 6px}.at10117-box-body{padding:18px 20px}.at10117-reminder-card{background:#f8fbfa;border:1px solid #dce6e2;border-radius:16px;padding:13px;line-height:1.8}.at10117-box-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:0 20px 20px}.at10117-box-actions .light{background:#eef6f3;color:#0A4033;border:1px solid #dce6e2}
      .at10117-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.at10117-tab{border:1px solid #dce6e2;background:#fff;color:#0A4033;border-radius:999px;padding:9px 14px;font-weight:900;cursor:pointer}.at10117-tab.active{background:#0A4033;color:#fff}.at10117-tab .count{display:inline-grid;place-items:center;min-width:20px;height:20px;background:#f0b429;color:#0A4033;border-radius:999px;margin-inline-start:6px;padding:0 5px;font-size:11px}
      @media(max-width:900px){.at10117-grid{grid-template-columns:1fr}.at10117-grid .wide{grid-column:auto}.at10117-details{max-width:260px}.at10117-head{align-items:flex-start}}
    `;
    document.head.appendChild(st);
  }

  function ensureNavAndSection(){
    injectCss();
    if(!$('adminTasks')){
      const content=document.querySelector('.content')||document.body;
      const sec=document.createElement('section'); sec.id='adminTasks'; sec.className='page hidden';
      sec.innerHTML=`
        <div class="card section-head at10117-head">
          <div><h2>مهام إدارية</h2><p>إرسال ومتابعة المهام بين الإداريين والمشرفين مع مهمة فورية أو مجدولة، وإغلاق ثم اعتماد من منشئ المهمة.</p></div>
          <div class="at10117-actions"><button onclick="window.tasneefAdminTasksV10117.openNew()" id="at10117NewBtn">إضافة مهمة</button><button class="light" onclick="window.tasneefAdminTasksV10117.refresh()">تحديث</button></div>
        </div>
        <div class="card at10117-form" id="at10117FormCard">
          <h2>إضافة مهمة إدارية</h2>
          <div class="at10117-muted">المرسل يتم تسجيله تلقائيًا باسم المستخدم الحالي. المستلم يتم اختياره من أسماء المستخدمين في إدارة المستخدمين فقط، وتظهر المهمة في حساب المستلم وللمرسل لمتابعة الإغلاق والاعتماد.</div>
          <div class="at10117-grid">
            <div class="wide"><label>عنوان المهمة</label><input id="at10117Title" placeholder="مثال: مراجعة تقرير التشغيل اليومي"></div>
            <div><label>نوع الجدولة</label><select id="at10117ScheduleType" onchange="window.tasneefAdminTasksV10117.toggleSchedule()"><option>مهمة فورية</option><option selected>مجدولة</option></select></div>
            <div><label>الأولوية</label><select id="at10117Priority"><option>عادي</option><option>مهم</option><option>عاجل</option></select></div>
            <div><label>تاريخ ووقت الجدولة</label><input id="at10117Due" type="datetime-local"></div>
            <div class="wide"><label>المستلم من إدارة المستخدمين</label><select id="at10117Recipient"></select><div class="at10117-muted">تظهر هنا أسماء المستخدمين المسجلين في قسم إدارة المستخدمين فقط.</div></div>
            <div class="wide"><label>نوع المهمة</label><select id="at10117Type"><option>مهمة إدارية</option><option>متابعة تشغيل</option><option>متابعة مالية</option><option>متابعة مشروع</option><option>طلب تقرير</option><option>ملاحظة عاجلة</option></select></div>
            <div class="full"><label>تفاصيل المهمة</label><textarea id="at10117Details" placeholder="اكتب تفاصيل المهمة المطلوبة بوضوح..."></textarea></div>
          </div>
          <div class="actions"><button onclick="window.tasneefAdminTasksV10117.create()">حفظ المهمة</button><button class="light" onclick="window.tasneefAdminTasksV10117.closeNew()">إلغاء</button></div>
        </div>
        <div class="kpis small" id="at10117Kpis"></div>
        <div class="card">
          <div class="at10117-tabs" id="at10117Tabs">
            <button class="at10117-tab active" data-tab="mine" onclick="window.tasneefAdminTasksV10117.setTab('mine')">مهامي <span class="count" id="at10117CountMine">0</span></button>
            <button class="at10117-tab" data-tab="open" onclick="window.tasneefAdminTasksV10117.setTab('open')">مهام مفتوحة <span class="count" id="at10117CountOpen">0</span></button>
            <button class="at10117-tab" data-tab="closed" onclick="window.tasneefAdminTasksV10117.setTab('closed')">مهام مغلقة <span class="count" id="at10117CountClosed">0</span></button>
            <button class="at10117-tab" data-tab="approved" onclick="window.tasneefAdminTasksV10117.setTab('approved')">تم الاعتماد <span class="count" id="at10117CountApproved">0</span></button>
          </div>
          <div class="filters">
            <input id="at10117Search" placeholder="بحث في المهام" oninput="window.tasneefAdminTasksV10117.render()">
            <select id="at10117PriorityFilter" onchange="window.tasneefAdminTasksV10117.render()"><option value="">كل الأولويات</option><option>عادي</option><option>مهم</option><option>عاجل</option></select>
            <select id="at10117TypeFilter" onchange="window.tasneefAdminTasksV10117.render()"><option value="">كل أنواع المهام</option><option>مهمة إدارية</option><option>متابعة تشغيل</option><option>متابعة مالية</option><option>متابعة مشروع</option><option>طلب تقرير</option><option>ملاحظة عاجلة</option></select>
            <select id="at10117ScheduleFilter" onchange="window.tasneefAdminTasksV10117.render()"><option value="">فورية ومجدولة</option><option>مهمة فورية</option><option>مجدولة</option></select>
            <input id="at10117FromDate" type="date" title="من تاريخ" onchange="window.tasneefAdminTasksV10117.render()">
            <input id="at10117ToDate" type="date" title="إلى تاريخ" onchange="window.tasneefAdminTasksV10117.render()">
            <button class="light" onclick="window.tasneefAdminTasksV10117.print()">طباعة المعروض</button>
          </div>
          <div class="table-wrap"><table><thead><tr><th>الحالة</th><th>المهمة</th><th>من</th><th>إلى</th><th>الجدولة</th><th>أنشئت</th><th>أغلقت</th><th>اعتمدت</th><th>إجراء</th></tr></thead><tbody id="at10117Body"></tbody></table></div>
        </div>`;
      content.appendChild(sec);
    }
    if(!$('at10117Modal')){
      const modal=document.createElement('div'); modal.id='at10117Modal'; modal.className='at10117-modal';
      modal.innerHTML=`<div class="at10117-box"><div class="at10117-box-head"><h3>تذكير مهمة إدارية</h3><div id="at10117ModalSub">لديك مهمة تحتاج متابعة</div></div><div class="at10117-box-body"><div id="at10117ModalContent" class="at10117-reminder-card"></div></div><div class="at10117-box-actions"><button class="light" onclick="window.tasneefAdminTasksV10117.dismissReminder()">إغلاق التذكير</button><button onclick="window.tasneefAdminTasksV10117.openFromReminder()">فتح المهمة</button></div></div>`;
      document.body.appendChild(modal);
    }
    if(!document.querySelector('button.nav[data-page="adminTasks"]')){
      const btn=document.createElement('button'); btn.className='nav'; btn.setAttribute('data-page','adminTasks');
      btn.innerHTML='مهام إدارية <span id="at10117NavBadge" class="at10117-badge-count" style="display:none">0</span>';
      btn.onclick=function(){ openPage(); };
      const logout=[...document.querySelectorAll('.side .nav')].find(b=>/تسجيل\s*خروج/.test(S(b.textContent)));
      if(logout && logout.parentNode) logout.parentNode.insertBefore(btn, logout); else (document.querySelector('.side')||document.body).appendChild(btn);
    }
    fillRecipients();
    if(!canCreate()){
      const nb=$('at10117NewBtn'); if(nb) nb.style.display='none';
      const fc=$('at10117FormCard'); if(fc) fc.classList.remove('show');
    }
  }

  async function fillRecipients(){
    const sel=$('at10117Recipient'); if(!sel) return;
    const old=sel.value;
    sel.innerHTML=`<option value="">جاري تحميل أسماء المستخدمين...</option>`;
    let users=[];
    try{ users=await collectUsers(); }catch(e){ console.warn('collect system users failed', e); users=systemUsersCache||[]; }
    let html=`<option value="">اختر المستلم من إدارة المستخدمين</option>`;
    users.forEach(u=>{ html+=`<option value="user:${esc(u.login)}|${esc(u.name)}|${esc(u.role)}">${esc(u.name)}${u.role?' - '+esc(roleLabel(u.role)):''}</option>`; });
    if(!users.length) html+=`<option value="">لا توجد أسماء مستخدمين - راجع إدارة المستخدمين</option>`;
    sel.innerHTML=html;
    if(old) sel.value=old;
  }
  function parseRecipient(){
    const val=S($('at10117Recipient')&&$('at10117Recipient').value);
    const parts=val.split('|');
    if(!val) return {to_user:'',to_name:'',to_role:''};
    return {to_user:S((parts[0]||'').replace('user:','')),to_name:S(parts[1]),to_role:S(parts[2])};
  }
  function dtLocalToIso(v){ if(!S(v)) return ''; const d=new Date(v); return isNaN(d.getTime())?'':d.toISOString(); }
  function formatDate(v){ if(!S(v)) return '—'; try{return new Date(v).toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(_){return S(v);} }
  function priorityChip(p){ p=S(p)||'عادي'; const cls=p==='عاجل'?'red':(p==='مهم'?'amber':'green'); return `<span class="at10117-chip ${cls}">${esc(p)}</span>`; }
  function statusChip(t){ return t.status==='approved'?'<span class="at10117-chip green">تم الاعتماد</span>':(t.status==='closed'?'<span class="at10117-chip amber">مغلقة</span>':'<span class="at10117-chip amber">مفتوحة</span>'); }
  function isOverdue(t){ return t.status==='open' && S(t.due_at) && new Date(t.due_at).getTime() < Date.now(); }
  function matchesCurrentUser(t){
    const u=currentUser(); const login=userLogin(u).toLowerCase(); const name=userName(u).toLowerCase(); const role=userRole(u).toLowerCase();
    const tu=S(t.to_user).toLowerCase(), tn=S(t.to_name).toLowerCase(), tr=S(t.to_role).toLowerCase();
    if(tu && (tu===login || tu===name || login.includes(tu) || name.includes(tu))) return true;
    if(tn && (tn===name || tn===login || name.includes(tn) || login.includes(tn))) return true;
    if(tr && (tr===role || (tr==='supervisor' && isSupervisor()) || (tr==='admin' && isManager()))) return true;
    return false;
  }
  function isSender(t){
    const login=userLogin().toLowerCase(), name=userName().toLowerCase();
    const f=[t.from_user,t.from_name].join(' ').toLowerCase();
    return !!((login && f.includes(login)) || (name && f.includes(name)));
  }
  function isRelevant(t){ return matchesCurrentUser(t) || isSender(t); }
  let currentTab='mine';

  function filteredRows(){
    const q=S($('at10117Search')&&$('at10117Search').value).toLowerCase();
    const pr=S($('at10117PriorityFilter')&&$('at10117PriorityFilter').value);
    const tf=S($('at10117TypeFilter')&&$('at10117TypeFilter').value);
    const sf=S($('at10117ScheduleFilter')&&$('at10117ScheduleFilter').value);
    const from=S($('at10117FromDate')&&$('at10117FromDate').value);
    const to=S($('at10117ToDate')&&$('at10117ToDate').value);
    return state.rows.filter(t=>{
      if(!isRelevant(t)) return false;
      if(pr && t.priority!==pr) return false;
      if(tf && t.task_type!==tf) return false;
      if(sf && t.schedule_type!==sf) return false;
      if(from && S(t.created_at).slice(0,10)<from) return false;
      if(to && S(t.created_at).slice(0,10)>to) return false;
      if(q && ![t.title,t.details,t.from_name,t.to_name,t.task_type,t.priority,t.schedule_type].join(' ').toLowerCase().includes(q)) return false;
      if(currentTab==='mine' && !(t.status==='open' && matchesCurrentUser(t))) return false;
      if(currentTab==='open' && !(t.status==='open' && isRelevant(t))) return false;
      if(currentTab==='closed' && !(t.status==='closed' && isRelevant(t))) return false;
      if(currentTab==='approved' && !(t.status==='approved' && isRelevant(t))) return false;
      return true;
    });
  }


  function render(){
    ensureNavAndSection();
    const rows=filteredRows();
    const rel=state.rows.filter(isRelevant);
    const open=rel.filter(t=>t.status==='open').length;
    const closed=rel.filter(t=>t.status==='closed').length;
    const approved=rel.filter(t=>t.status==='approved').length;
    const mine=rel.filter(t=>t.status==='open'&&matchesCurrentUser(t)).length;
    const overdue=rel.filter(isOverdue).length;
    const k=$('at10117Kpis'); if(k) k.innerHTML=`<div class="kpi"><small>مهامي</small><b>${mine}</b></div><div class="kpi"><small>مهام مفتوحة</small><b>${open}</b></div><div class="kpi"><small>مهام مغلقة تنتظر اعتماد</small><b>${closed}</b></div><div class="kpi"><small>المهام المتأخرة</small><b>${overdue}</b></div>`;
    const badge=$('at10117NavBadge'); if(badge){ badge.textContent=mine; badge.style.display=mine? 'inline-grid':'none'; }
    const counts={Mine:mine,Open:open,Closed:closed,Approved:approved}; Object.keys(counts).forEach(k2=>{ const el=$('at10117Count'+k2); if(el) el.textContent=counts[k2]; });
    document.querySelectorAll('.at10117-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===currentTab));
    const body=$('at10117Body'); if(!body) return;
    if(!rows.length){ body.innerHTML=`<tr><td colspan="9" class="at10117-empty">لا توجد مهام حسب الفلتر الحالي</td></tr>`; return; }
    body.innerHTML=rows.map(t=>`
      <tr data-at-id="${esc(t.id)}">
        <td>${statusChip(t)}${isOverdue(t)?' <span class="at10117-chip red">متأخرة</span>':''}</td>
        <td><div class="at10117-task-title">${esc(t.title||'بدون عنوان')}</div><div>${priorityChip(t.priority)} <span class="at10117-chip">${esc(t.task_type||'مهمة إدارية')}</span> <span class="at10117-chip">${esc(t.schedule_type||'مجدولة')}</span></div><div class="at10117-details">${esc(t.details||'')}</div></td>
        <td>${esc(t.from_name||t.from_user||'—')}</td>
        <td>${esc(t.to_name||roleLabel(t.to_role)||t.to_user||'—')}</td>
        <td>${formatDate(t.due_at)}</td>
        <td>${formatDate(t.created_at)}</td>
        <td>${t.closed_at?formatDate(t.closed_at):'—'}</td>
        <td>${t.approved_at?formatDate(t.approved_at):'—'}</td>
        <td><div class="row-actions"><button class="light at10117-btn-mini" onclick="window.tasneefAdminTasksV10117.view('${esc(t.id)}')">عرض</button>${t.status==='open'&&matchesCurrentUser(t)?`<button class="at10117-btn-mini" onclick="window.tasneefAdminTasksV10117.closeTask('${esc(t.id)}')">إغلاق المهمة</button>`:''}${t.status==='closed'&&isSender(t)?`<button class="at10117-btn-mini" onclick="window.tasneefAdminTasksV10117.approveTask('${esc(t.id)}')">اعتماد</button>`:''}</div></td>
      </tr>`).join('');
  }
  async function refresh(){ await loadTasks(); render(); }
  function openNew(){ if(!canCreate()) return alert('إضافة المهام متاحة للإدارة فقط'); ensureNavAndSection(); $('at10117FormCard').classList.add('show'); fillRecipients(); }
  function closeNew(){ const f=$('at10117FormCard'); if(f) f.classList.remove('show'); }
  async function create(){
    if(!canCreate()) return alert('إضافة المهام متاحة للإدارة فقط');
    const title=S($('at10117Title')&&$('at10117Title').value); if(!title) return alert('اكتب عنوان المهمة');
    const rec=parseRecipient(); if(!rec.to_user && !rec.to_name) return alert('اختر المستلم من إدارة المستخدمين');
    const u=currentUser();
    const scheduleType=S($('at10117ScheduleType')&&$('at10117ScheduleType').value)||'مجدولة';
    const dueVal = scheduleType==='مهمة فورية' ? nowIso() : dtLocalToIso($('at10117Due')&&$('at10117Due').value);
    const payload=Object.assign({
      title, details:S($('at10117Details')&&$('at10117Details').value), task_type:S($('at10117Type')&&$('at10117Type').value)||'مهمة إدارية', priority:S($('at10117Priority')&&$('at10117Priority').value)||'عادي', schedule_type:scheduleType,
      from_user:userLogin(u), from_name:userName(u), due_at:dueVal, status:'open', created_at:nowIso(), updated_at:nowIso()
    }, rec);
    await saveTask(payload);
    ['at10117Title','at10117Details','at10117Due'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    closeNew(); render(); say('تم إنشاء المهمة الإدارية','ok');
  }
  function view(id){
    const t=state.rows.find(x=>String(x.id)===String(id)); if(!t) return;
    ensureNavAndSection();
    $('at10117ModalSub').textContent='عرض مهمة إدارية';
    $('at10117ModalContent').innerHTML=`<b>${esc(t.title)}</b><br><br><b>من:</b> ${esc(t.from_name||t.from_user||'—')}<br><b>إلى:</b> ${esc(t.to_name||roleLabel(t.to_role)||t.to_user||'—')}<br><b>الأولوية:</b> ${esc(t.priority)}<br><b>نوع الجدولة:</b> ${esc(t.schedule_type||'مجدولة')}<br><b>الجدولة:</b> ${formatDate(t.due_at)}<br><b>أنشئت:</b> ${formatDate(t.created_at)}<br><b>أغلقت:</b> ${t.closed_at?formatDate(t.closed_at):'—'}<br><b>اعتمدت:</b> ${t.approved_at?formatDate(t.approved_at):'—'}<hr style="border:0;border-top:1px solid #dce6e2"><div style="white-space:pre-wrap;line-height:1.8">${esc(t.details||'لا توجد تفاصيل')}</div>`;
    const modal=$('at10117Modal'); if(modal) modal.classList.add('show');
    window.__at10117ReminderTaskId=id;
  }
  async function closeTask(id){
    if(!matchesCurrentUser(state.rows.find(x=>String(x.id)===String(id))||{})) return alert('الإغلاق متاح للمستلم فقط');
    if(!confirm('تأكيد إغلاق المهمة؟ ستنتظر اعتماد منشئ المهمة.')) return;
    await patchTask(id,{status:'closed',closed_at:nowIso(),closed_by:userName()});
    render(); say('تم إغلاق المهمة وتنتظر اعتماد منشئ المهمة','ok');
  }
  async function approveTask(id){
    const t=state.rows.find(x=>String(x.id)===String(id));
    if(!t) return;
    if(!isSender(t)) return alert('الاعتماد متاح فقط لمن أنشأ المهمة');
    if(t.status!=='closed') return alert('لا يمكن اعتماد المهمة قبل إغلاقها من المستلم');
    if(!confirm('اعتماد إغلاق المهمة؟')) return;
    await patchTask(id,{status:'approved',approved_at:nowIso(),approved_by:userName()});
    currentTab='approved'; render(); say('تم اعتماد المهمة','ok');
  }
  function setTab(tab){ currentTab=tab||'mine'; render(); }
  function toggleSchedule(){
    const st=S($('at10117ScheduleType')&&$('at10117ScheduleType').value);
    const due=$('at10117Due'); if(!due) return;
    if(st==='مهمة فورية'){ due.value=''; due.disabled=true; }
    else due.disabled=false;
  }

  function openPage(){
    ensureNavAndSection();
    const nav=document.querySelector('button.nav[data-page="adminTasks"]');
    try{ if(typeof window.showPage==='function') window.showPage('adminTasks',nav); else throw new Error('no showPage'); }
    catch(_){
      document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
      const sec=$('adminTasks'); if(sec) sec.classList.remove('hidden');
      document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active')); if(nav) nav.classList.add('active');
    }
    refresh();
  }
  function dueForReminder(t){ if(t.status!=='open') return false; if(!matchesCurrentUser(t)) return false; if(!S(t.due_at)) return true; return new Date(t.due_at).getTime() <= Date.now(); }
  let reminderTask=null;
  function showReminderIfAny(){
    const tasks=state.rows.filter(dueForReminder).filter(t=>localStorage.getItem(DISMISS_PREFIX+t.id+'_'+todayKey())!=='1');
    if(!tasks.length) return;
    reminderTask=tasks[0];
    ensureNavAndSection();
    $('at10117ModalSub').textContent=tasks.length>1?`لديك ${tasks.length} مهام مفتوحة تحتاج متابعة`:'لديك مهمة مفتوحة تحتاج متابعة';
    $('at10117ModalContent').innerHTML=`<b>${esc(reminderTask.title)}</b><br><br><b>من:</b> ${esc(reminderTask.from_name||reminderTask.from_user||'—')}<br><b>الأولوية:</b> ${esc(reminderTask.priority)}<br><b>الجدولة:</b> ${formatDate(reminderTask.due_at)}<br><br><div style="white-space:pre-wrap">${esc(reminderTask.details||'')}</div>`;
    $('at10117Modal').classList.add('show');
  }
  function dismissReminder(){
    const m=$('at10117Modal'); if(m) m.classList.remove('show');
    const id=reminderTask && reminderTask.id || window.__at10117ReminderTaskId;
    if(id) try{localStorage.setItem(DISMISS_PREFIX+id+'_'+todayKey(),'1');}catch(_){ }
  }
  function openFromReminder(){
    const m=$('at10117Modal'); if(m) m.classList.remove('show');
    openPage();
    const id=reminderTask && reminderTask.id;
    setTimeout(()=>{ const tr=document.querySelector(`tr[data-at-id="${CSS.escape(String(id||''))}"]`); if(tr) tr.scrollIntoView({behavior:'smooth',block:'center'}); },450);
  }
  function printTasks(){
    const rows=filteredRows();
    const html=`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طباعة المهام الإدارية</title><style>body{font-family:Tahoma,Arial;padding:24px;color:#10231d}h1{color:#0A4033}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right;vertical-align:top}th{background:#eef6f3}.details{white-space:pre-wrap;line-height:1.6}</style></head><body><h1>تقرير المهام الإدارية</h1><p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p><table><thead><tr><th>الحالة</th><th>المهمة</th><th>من</th><th>إلى</th><th>الأولوية</th><th>الجدولة</th><th>أنشئت</th><th>أغلقت</th><th>اعتمدت</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${t.status==='approved'?'تم الاعتماد':(t.status==='closed'?'مغلقة':'مفتوحة')}</td><td><b>${esc(t.title)}</b><div class="details">${esc(t.details)}</div></td><td>${esc(t.from_name||t.from_user)}</td><td>${esc(t.to_name||roleLabel(t.to_role)||t.to_user)}</td><td>${esc(t.priority)}</td><td>${formatDate(t.due_at)}</td><td>${formatDate(t.created_at)}</td><td>${t.closed_at?formatDate(t.closed_at):'—'}</td><td>${t.approved_at?formatDate(t.approved_at):'—'}</td></tr>`).join('')}</tbody></table></body></html>`;
    const w=window.open('','_blank'); if(!w) return alert('اسمح بالنوافذ المنبثقة للطباعة'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  }

  async function init(){
    ensureNavAndSection();
    await loadTasks();
    render();
    setTimeout(showReminderIfAny,900);
  }

  window.tasneefAdminTasksV10117={init,refresh,render,open:openPage,openNew,closeNew,create,view,closeTask,approveTask,setTab,toggleSchedule,dismissReminder,openFromReminder,print:printTasks};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init,300);
})();
