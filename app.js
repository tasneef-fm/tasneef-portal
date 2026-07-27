'use strict';

const PORTAL_MODE = document.body?.dataset.portal || 'customer';
const ADMIN_ROLE_CODES = new Set(['super_admin','admin','management','accountant']);
const EMPLOYEE_PAGE_IDS = new Set(['dashboard','pos','orders','bookings','quotes','workorders','products','inventory','purchases','customers','smart','reports','attendance','leaves','payroll']);

function portalForRole(roleCode='') {
  if (roleCode === 'customer') return 'customer';
  return ADMIN_ROLE_CODES.has(roleCode) ? 'admin' : 'employee';
}
function portalUrl(mode) { return mode === 'admin' ? 'admin.html' : mode === 'employee' ? 'employee.html' : 'index.html'; }
function availablePages() {
  let allowed = pages.filter(p => can(p.permission));
  if (PORTAL_MODE === 'employee') allowed = allowed.filter(p => EMPLOYEE_PAGE_IDS.has(p.id));
  return allowed;
}
function pageLabel(meta) {
  if (PORTAL_MODE === 'employee' && meta?.id === 'dashboard') return 'لوحة الموظف';
  return meta?.label || 'النظام';
}

function resolveDomRoot(root=document) {
  if (typeof root === 'string') return document.querySelector(root);
  return root || document;
}
const $ = (s, root=document) => {
  const scope = resolveDomRoot(root);
  return typeof scope?.querySelector === 'function' ? scope.querySelector(s) : null;
};
const $$ = (s, root=document) => {
  const scope = resolveDomRoot(root);
  return typeof scope?.querySelectorAll === 'function' ? Array.from(scope.querySelectorAll(s)) : [];
};
const state = {
  user: null,
  publicData: {products:[],categories:[],services:[],reviews:[]},
  cart: JSON.parse(localStorage.getItem('wardat_cart') || '[]'),
  currentPage: 'dashboard',
  posCart: [],
  cache: {},
  category: null,
  permissionMatrix: null
};

const pages = [
  {id:'dashboard',icon:'◈',label:'لوحة الإدارة',permission:'dashboard.view'},
  {id:'pos',icon:'▣',label:'نقطة البيع',permission:'pos.view'},
  {id:'orders',icon:'▤',label:'الطلبات',permission:'orders.view'},
  {id:'bookings',icon:'◫',label:'الحجوزات والمناسبات',permission:'bookings.view'},
  {id:'quotes',icon:'◰',label:'عروض الأسعار',permission:'quotations.view'},
  {id:'workorders',icon:'✓',label:'أوامر العمل',permission:'workorders.view'},
  {id:'products',icon:'✿',label:'المنتجات',permission:'products.view'},
  {id:'inventory',icon:'▦',label:'المخزون',permission:'inventory.view'},
  {id:'purchases',icon:'⇣',label:'المشتريات والموردون',permission:'purchases.view'},
  {id:'customers',icon:'◎',label:'العملاء والولاء',permission:'customers.view'},
  {id:'smart',icon:'✦',label:'المساعد الذكي',permission:'smart.view'},
  {id:'reports',icon:'▥',label:'التقارير',permission:'reports.view'},
  {id:'attendance',icon:'◷',label:'الحضور والانصراف',permission:'attendance.view_self'},
  {id:'leaves',icon:'⌛',label:'الإجازات والمأذونيات',permission:'leaves.view'},
  {id:'payroll',icon:'﷼',label:'مسير الرواتب',permission:'payroll.view_self'},
  {id:'compensation',icon:'±',label:'السلف والجزاءات والمكافآت',permission:'compensation.view'},
  {id:'users',icon:'♙',label:'المستخدمون والصلاحيات',permission:'users.view'},
  {id:'audit',icon:'⌁',label:'سجل التعديلات',permission:'audit.view'},
  {id:'dataquality',icon:'◇',label:'جودة البيانات',permission:'data_quality.view'},
  {id:'settings',icon:'⚙',label:'الإعدادات',permission:'settings.view'}
];

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function money(v=0){if(v===null||v===undefined||v==='')return '—';return window.WardatFinancial?.format(v)||new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);}
function can(permissionKey){return window.PermissionsService?.can(permissionKey)===true;}
function guard(permissionKey){if(can(permissionKey))return true;toast('ليس لديك صلاحية لتنفيذ هذه العملية','error');return false;}
function dt(v){ if(!v)return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(d); }
function dateOnly(v){ if(!v)return '—'; const d=new Date(v); return new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeZone:'Asia/Riyadh'}).format(d); }
function number(v){return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(Number(v)||0);}
function toast(msg,type='ok'){ const el=$('#toast'); el.textContent=msg;el.className=`toast show ${type==='error'?'error':''}`;clearTimeout(el._t);el._t=setTimeout(()=>el.className='toast',3500); }
function show(id){ $('#'+id)?.classList.remove('hidden'); }
function hide(id){ $('#'+id)?.classList.add('hidden'); }
function saveCart(){ localStorage.setItem('wardat_cart',JSON.stringify(state.cart)); updateCartCount(); }
async function api(url, options={}){
  try {
    return await window.WardatBackend.request(url, options);
  } catch (error) {
    if ((error.status===401 || /يلزم تسجيل الدخول/.test(error.message)) && state.user) {
      state.user=null;
      if (PORTAL_MODE === 'customer') showStore(); else showPortalLogin();
    }
    throw error;
  }
}
function formDataObj(form){const fd=new FormData(form),o={};for(const [k,v] of fd.entries()){if(o[k]!==undefined){o[k]=Array.isArray(o[k])?[...o[k],v]:[o[k],v]}else o[k]=v;}$$('input[type=checkbox]',form).forEach(i=>o[i.name]=i.checked);return o;}
function statusMeta(s){
  const map={
    new:['جديد','amber'],waiting_payment:['بانتظار الدفع','amber'],unpaid:['غير مدفوع','red'],partial:['مدفوع جزئيًا','amber'],paid:['مدفوع','green'],preparing:['جاري التجهيز','amber'],ready:['جاهز','green'],out_for_delivery:['خرج للتوصيل','amber'],delivered:['تم التسليم','green'],completed:['مكتمل','green'],cancelled:['ملغي','red'],returned:['مرتجع','red'],
    waiting_contact:['بانتظار التواصل','amber'],inspection_scheduled:['موعد معاينة','amber'],inspected:['تمت المعاينة','green'],quotation_preparing:['إعداد عرض السعر','amber'],quotation_sent:['تم إرسال العرض','amber'],pending_client:['بانتظار العميل','amber'],deposit_paid:['تم دفع العربون','green'],confirmed:['مؤكد','green'],installing:['جاري التركيب','amber'],executed:['تم التنفيذ','green'],dismantled:['تم الفك','green'],
    draft:['مسودة','gray'],sent:['مرسل','amber'],approved:['معتمد','green'],rejected:['مرفوض','red'],
    received:['تم الاستلام','amber'],ready_to_leave:['جاهز للخروج','green'],on_way:['في الطريق','amber'],arrived:['وصل الموقع','amber'],installed:['تم التركيب','green'],documented:['تم التوثيق','green'],waiting_dismantle:['بانتظار الفك','amber'],equipment_returned:['تمت إعادة المعدات','green'],note:['توجد ملاحظة','red'],
    pending:['معلق','amber'],received_po:['تم الاستلام','green'],present:['حاضر','green'],late:['متأخر','amber'],early_leave:['انصراف مبكر','amber'],absent:['غائب','red'],leave:['إجازة','gray'],missing_checkout:['لم يسجل انصراف','red'],pending_supervisor:['بانتظار المسؤول','amber'],pending_admin:['بانتظار الإدارة','amber'],under_review:['تحت المراجعة','amber'],pending_approval:['بانتظار الاعتماد','amber'],ready_to_pay:['جاهز للصرف','green'],partially_paid:['مصروف جزئيًا','amber']
  };
  return map[s]||[s||'—','gray'];
}
function statusBadge(s){const [l,c]=statusMeta(s);return `<span class="status ${c}">${escapeHtml(l)}</span>`;}
function downloadCsv(rows, filename='report.csv'){
  if(!rows?.length)return toast('لا توجد بيانات للتصدير','error');
  const cols=Object.keys(rows[0]); const csv='\ufeff'+[cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
function debounce(fn,wait=350){let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),wait);};}
function pagerHtml(meta,key){const page=Number(meta.page||1),pages=Math.max(1,Number(meta.pages||1)),total=Number(meta.total||0);return `<div class="pager" data-pager="${key}"><button class="mini-btn" data-page="${page-1}" ${page<=1?'disabled':''}>السابق</button><span>صفحة ${number(page)} من ${number(pages)} · ${number(total)} سجل</span><button class="mini-btn" data-page="${page+1}" ${page>=pages?'disabled':''}>التالي</button></div>`;}
function bindPager(key,renderFn,search=''){$$(`[data-pager="${key}"] [data-page]`).forEach(b=>b.onclick=()=>renderFn({page:Number(b.dataset.page),search}));}
function draftKey(title,form){return form?.dataset?.draftKey||`wardat:draft:${state.user?.id||'public'}:${state.currentPage||PORTAL_MODE}:${title}`;}
function bindFormDraft(title,form){if(!form||form.dataset.noDraft==='true')return()=>{};const key=draftKey(title,form);try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){Object.entries(saved).forEach(([name,value])=>{const nodes=$$(`[name="${CSS.escape(name)}"]`,form);nodes.forEach(node=>{if(node.type==='password'||node.type==='file')return;if(node.type==='checkbox')node.checked=Boolean(value);else if(node.type==='radio')node.checked=node.value===value;else node.value=value??'';});});toast('تم استعادة مسودة النموذج');}}catch{}
  const save=debounce(()=>{const data={};$$('[name]',form).forEach(node=>{if(node.type==='password'||node.type==='file'||!node.name)return;if(node.type==='checkbox')data[node.name]=node.checked;else if(node.type==='radio'){if(node.checked)data[node.name]=node.value;}else data[node.name]=node.value;});localStorage.setItem(key,JSON.stringify(data));},250);form.addEventListener('input',save);form.addEventListener('change',save);return()=>localStorage.removeItem(key);}
function openForm(title, html, onSubmit){
  $('#formModalContent').innerHTML=`<h2>${escapeHtml(title)}</h2>${html}`;show('formModal');setTimeout(()=>enhanceSearchableSelects($('#formModalContent')),0);
  const form=$('#formModalContent form');const clearDraft=bindFormDraft(title,form);if(form)form.addEventListener('submit',async e=>{e.preventDefault();const btn=$('button[type=submit]',form);btn.disabled=true;try{await onSubmit(formDataObj(form),form);clearDraft();hide('formModal');}catch(err){toast(err.message,'error')}finally{btn.disabled=false;}});
}

async function init(){
  bindGlobal();
  await window.WardatFinancial?.load().catch(()=>{});
  await window.WardatDocuments?.loadSettings().catch(()=>{});

  if (PORTAL_MODE === 'customer') {
    updateCartCount();
    if (!window.WardatBackend?.isConfigured()) {
      if ($('#storeProducts')) $('#storeProducts').innerHTML='<div class="empty"><h3>التطبيق جاهز للنشر ويحتاج ربط Supabase</h3><p>أدخل رابط المشروع وAnon Key في ملف <b>config.js</b>، ثم نفّذ ملف <b>supabase/schema.sql</b>.</p></div>';
      if ($('#servicesGrid')) $('#servicesGrid').innerHTML='<div class="empty">بعد الربط ستظهر المنتجات والخدمات من قاعدة البيانات الموحدة.</div>';
      return;
    }
    try {
      await loadPublic();
      renderStore();
    } catch (error) {
      if ($('#storeProducts')) $('#storeProducts').innerHTML=`<div class="empty"><h3>تعذر الاتصال بقاعدة البيانات</h3><p>${escapeHtml(error.message)}</p></div>`;
      toast(error.message,'error');
    }
    return;
  }

  if (!window.WardatBackend?.isConfigured()) {
    showPortalLogin('لم يتم ربط الصفحة بقاعدة Supabase. راجع ملف config.js.');
    return;
  }

  try {
    const {user}=await api('/api/auth/me');
    if(user){
      state.user=user;
      const correctPortal=portalForRole(user.role_code);
      if(correctPortal !== PORTAL_MODE){
        // لا نُرجع صفحة الإدارة فورًا إلى المتجر بسبب جلسة عميل قديمة؛
        // ننهي الجلسة القديمة ونُبقي صفحة الدخول الإدارية ظاهرة.
        if (correctPortal === 'customer') {
          await api('/api/auth/logout',{method:'POST'}).catch(()=>{});
          window.PermissionsService?.clear();
          state.user=null;
          showPortalLogin('تم إنهاء جلسة عميل سابقة. سجّل الدخول بحساب الإدارة أو الموظف.');
          return;
        }
        window.location.replace(portalUrl(correctPortal));
        return;
      }
      await showApp();
    } else showPortalLogin();
  } catch (error) {
    showPortalLogin(error.message);
  }
}
function bindGlobal(){
  window.addEventListener('error',e=>{if(state.user)window.WardatBackend?.logClientError?.(e.message,location.pathname,e.error?.stack);});
  window.addEventListener('unhandledrejection',e=>{if(state.user)window.WardatBackend?.logClientError?.(e.reason?.message||String(e.reason),location.pathname,e.reason?.stack);});
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');if(close)hide(close.dataset.close);
    const scroll=e.target.closest('[data-scroll]');if(scroll)$('#'+scroll.dataset.scroll)?.scrollIntoView({behavior:'smooth'});
  });

  if (PORTAL_MODE === 'customer') {
    if ($('#cartBtn')) $('#cartBtn').onclick=renderCartDrawer;
    if ($('#checkoutBtn')) $('#checkoutBtn').onclick=()=>{if(!state.cart.length)return toast('السلة فارغة','error');hide('cartDrawer');show('checkoutModal');};
    if ($('#checkoutForm')) $('#checkoutForm').onsubmit=checkout;
    if ($('#publicBookingForm')) $('#publicBookingForm').onsubmit=submitPublicBooking;
    ['openBookingBtn','openBookingBtn2'].forEach(i=>{if($('#'+i))$('#'+i).onclick=()=>show('bookingModal');});
    ['openAssistantBtn','openAssistantBtn2'].forEach(i=>{if($('#'+i))$('#'+i).onclick=()=>show('assistantModal');});
    if ($('#assistantForm')) $('#assistantForm').onsubmit=assistantRecommend;
    if ($('#showAllProducts')) $('#showAllProducts').onclick=()=>{state.category=null;renderStoreProducts();$('#productsSection')?.scrollIntoView({behavior:'smooth'});};
    return;
  }

  if ($('#loginForm')) $('#loginForm').onsubmit=login;
  if ($('#logoutBtn')) $('#logoutBtn').onclick=logout;
  if ($('#logoutTopBtn')) $('#logoutTopBtn').onclick=logout;
  if ($('#backToStore')) $('#backToStore').onclick=()=>window.location.href='index.html';
  if ($('#menuBtn')) $('#menuBtn').onclick=()=>$('.sidebar')?.classList.toggle('open');
  if ($('#refreshBtn')) $('#refreshBtn').onclick=()=>state.currentPage&&renderPage(state.currentPage,true);
  if ($('#notificationsBtn')) $('#notificationsBtn').onclick=renderNotifications;
}
async function loadPublic(){state.publicData=await api('/api/public/bootstrap');}
function renderStore(){
  const {categories,services}=state.publicData;
  $('#categoryChips').innerHTML=`<button class="chip ${!state.category?'active':''}" data-cat="">الكل</button>`+categories.map(c=>`<button class="chip ${state.category===c.id?'active':''}" data-cat="${c.id}">${escapeHtml(c.name_ar)}</button>`).join('');
  $$('.chip','#categoryChips').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat||null;renderStore();});
  renderStoreProducts();
  $('#servicesGrid').innerHTML=services.slice(0,6).map(s=>`<article class="service-card"><h3>${escapeHtml(s.name_ar)}</h3><p>${escapeHtml(s.description||'خدمة مصممة بعناية حسب تفاصيل مناسبتك.')}</p><div class="service-price">تبدأ من ${money(s.base_price)}</div></article>`).join('');
}
function renderStoreProducts(){
  let products=state.publicData.products.filter(p=>!state.category||p.category_id===state.category);
  $('#storeProducts').innerHTML=products.length?products.map(p=>`<article class="product-card"><div class="product-image"><img loading="lazy" src="${escapeHtml(p.image_url||'assets/logo.png')}" alt="${escapeHtml(p.name_ar)}"><span class="product-badge">${escapeHtml(p.category_name||'وردة أشبيليا')}</span></div><div class="product-body"><small>${escapeHtml(p.sku)}</small><h3>${escapeHtml(p.name_ar)}</h3><p>${escapeHtml(p.description||'تنسيق فاخر حسب الطلب')}</p><div class="product-foot"><span class="price">${money(p.sale_price)} ${p.compare_price?`<del>${money(p.compare_price)}</del>`:''}</span><button class="add-btn" data-add="${p.id}" aria-label="أضف للسلة">+</button></div></div></article>`).join(''):`<div class="empty">لا توجد منتجات في هذا التصنيف.</div>`;
  $$('[data-add]','#storeProducts').forEach(b=>b.onclick=()=>addToCart(b.dataset.add));
}
function addToCart(productId){const p=state.publicData.products.find(x=>x.id===productId);if(!p)return;const existing=state.cart.find(x=>x.product_id===productId);const available=Number(p.stock_qty)-Number(p.reserved_qty);if(existing){if(existing.qty>=available)return toast('لا توجد كمية إضافية متاحة','error');existing.qty++;}else{if(available<1)return toast('المنتج غير متاح حاليًا','error');state.cart.push({product_id:p.id,name:p.name_ar,price:Number(p.sale_price),qty:1,image:p.image_url});}saveCart();toast('تمت إضافة المنتج للسلة');}
function updateCartCount(){$('#cartCount').textContent=state.cart.reduce((s,i)=>s+i.qty,0);}
function renderCartDrawer(){
  $('#cartItems').innerHTML=state.cart.length?state.cart.map((i,idx)=>`<div class="cart-line"><div><b>${escapeHtml(i.name)}</b><small>${money(i.price)}</small></div><div class="qty-control"><button data-dec="${idx}">−</button><span>${i.qty}</span><button data-inc="${idx}">+</button></div><button class="mini-btn" data-remove="${idx}">حذف</button></div>`).join(''):`<div class="empty">السلة فارغة</div>`;
  const subtotal=state.cart.reduce((s,i)=>s+i.price*i.qty,0),vat=subtotal*.15,total=subtotal+vat;
  $('#cartTotals').innerHTML=`<div class="total-row"><span>قبل الضريبة</span><b>${money(subtotal)}</b></div><div class="total-row"><span>الضريبة 15%</span><b>${money(vat)}</b></div><div class="total-row grand"><span>الإجمالي</span><b>${money(total)}</b></div>`;
  $$('[data-inc]','#cartItems').forEach(b=>b.onclick=()=>{const i=state.cart[+b.dataset.inc];const p=state.publicData.products.find(x=>x.id===i.product_id);if(i.qty>=Number(p.stock_qty)-Number(p.reserved_qty))return toast('الكمية غير متاحة','error');i.qty++;saveCart();renderCartDrawer();});
  $$('[data-dec]','#cartItems').forEach(b=>b.onclick=()=>{const i=state.cart[+b.dataset.dec];i.qty--;if(i.qty<=0)state.cart.splice(+b.dataset.dec,1);saveCart();renderCartDrawer();});
  $$('[data-remove]','#cartItems').forEach(b=>b.onclick=()=>{state.cart.splice(+b.dataset.remove,1);saveCart();renderCartDrawer();});show('cartDrawer');
}
async function checkout(e){e.preventDefault();const b=formDataObj(e.target);b.items=state.cart.map(i=>({product_id:i.product_id,qty:i.qty}));b.idempotency_key=crypto.randomUUID();const btn=$('button[type=submit]',e.target);btn.disabled=true;try{const {order}=await api('/api/public/orders',{method:'POST',body:b});state.cart=[];saveCart();hide('checkoutModal');e.target.reset();toast(`تم تسجيل طلبك بنجاح: ${order.order_no}`);await loadPublic();renderStore();}catch(err){toast(err.message,'error')}finally{btn.disabled=false;}}
async function submitPublicBooking(e){e.preventDefault();const b=formDataObj(e.target);b.idempotency_key=crypto.randomUUID();const btn=$('button[type=submit]',e.target);btn.disabled=true;try{const {booking}=await api('/api/public/bookings',{method:'POST',body:b});hide('bookingModal');e.target.reset();toast(`تم استلام طلب الحجز: ${booking.booking_no}`);}catch(err){toast(err.message,'error')}finally{btn.disabled=false;}}
function assistantRecommend(e){e.preventDefault();const b=formDataObj(e.target),budget=Number(b.budget)||0;let products=state.publicData.products.filter(p=>Number(p.sale_price)*1.15<=budget*1.15).sort((a,c)=>Math.abs(Number(a.sale_price)-budget)-Math.abs(Number(c.sale_price)-budget)).slice(0,3);if(!products.length)products=state.publicData.products.slice(0,3);$('#assistantResults').innerHTML=products.map((p,i)=>`<div class="assistant-option"><small>الخيار ${i+1}</small><h4>${escapeHtml(p.name_ar)}</h4><p>${escapeHtml(p.description||'خيار مناسب للمناسبة والألوان المختارة.')}</p><b>${money(Number(p.sale_price)*1.15)}</b><button class="btn btn-outline wide" data-assist-add="${p.id}">أضف للسلة</button></div>`).join('');$$('[data-assist-add]').forEach(x=>x.onclick=()=>addToCart(x.dataset.assistAdd));}

async function login(e){
  e.preventDefault();
  const b=formDataObj(e.target),btn=$('button[type=submit]',e.target);
  btn.disabled=true;
  try{
    const r=await api('/api/auth/login',{method:'POST',body:b});
    state.user=r.user;
    const correctPortal=portalForRole(state.user.role_code);
    if(correctPortal==='customer'){
      await api('/api/auth/logout',{method:'POST'}).catch(()=>{});
      state.user=null;
      throw new Error('هذا حساب عميل وليس حساب إدارة أو موظف');
    }
    if(correctPortal!==PORTAL_MODE){
      window.location.replace(portalUrl(correctPortal));
      return;
    }
    await showApp();
    toast(PORTAL_MODE==='admin'?'مرحبًا بك في لوحة الإدارة':'مرحبًا بك في صفحة الموظف');
  }catch(err){
    showPortalLogin(err.message);
    toast(err.message,'error');
  }finally{btn.disabled=false;}
}
async function logout(){
  await api('/api/auth/logout',{method:'POST'}).catch(()=>{});
  window.PermissionsService?.clear();
  state.user=null;state.cache={};state.currentPage='dashboard';
  showPortalLogin();
  toast('تم تسجيل الخروج');
}
function showStore(){
  if(PORTAL_MODE!=='customer'){window.location.href='index.html';return;}
  hide('appView');show('storeView');$('.sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});
}
function showPortalLogin(message=''){
  hide('appView');show('portalLoginView');$('.sidebar')?.classList.remove('open');
  const msg=$('#portalLoginMessage');
  if(msg){msg.textContent=message|| (PORTAL_MODE==='admin'?'استخدم حساب الإدارة المخول للدخول.':'استخدم حساب الموظف وسيتم عرض الأقسام المسموحة له فقط.');}
  const pass=$('#loginForm input[name=password]');if(pass)pass.value='';
}
async function showApp(){
  if(!state.user)return showPortalLogin();
  const correctPortal=portalForRole(state.user.role_code);
  if(correctPortal!==PORTAL_MODE){window.location.replace(portalUrl(correctPortal));return;}
  await window.PermissionsService.initialize(state.user);
  hide('portalLoginView');show('appView');
  if($('#userName'))$('#userName').textContent=state.user.name;
  if($('#userRole'))$('#userRole').textContent=state.user.role_name||state.user.role_code;
  if($('#userAvatar'))$('#userAvatar').textContent=state.user.name?.slice(0,1)||'و';
  if($('#portalSideLabel'))$('#portalSideLabel').textContent=PORTAL_MODE==='admin'?'نظام الإدارة':'بوابة الموظفين';
  if($('#portalHeaderTitle'))$('#portalHeaderTitle').textContent=PORTAL_MODE==='admin'?'لوحة الإدارة':'صفحة الموظف';
  if($('#portalHeaderSubtitle'))$('#portalHeaderSubtitle').textContent=PORTAL_MODE==='admin'?'الإدارة والمبيعات والتشغيل':'المهام والطلبات المسموحة حسب الصلاحية';
  renderNav();
  const allowed=availablePages();
  if(!allowed.some(p=>p.id===state.currentPage))state.currentPage=allowed[0]?.id||null;
  if(state.currentPage)await renderPage(state.currentPage);
  else if($('#content'))$('#content').innerHTML='<div class="empty">لا توجد أقسام مسموحة لهذا المستخدم. راجع إدارة الصلاحيات.</div>';
  loadNotificationCount();
}
function renderNav(){
  const nav=$('#sideNav');if(!nav)return;
  const allowed=availablePages();
  nav.innerHTML=allowed.map(p=>`<button class="nav-item ${state.currentPage===p.id?'active':''}" data-page="${p.id}"><span class="ico">${p.icon}</span>${escapeHtml(pageLabel(p))}</button>`).join('');
  $$('[data-page]',nav).forEach(b=>b.onclick=()=>{state.currentPage=b.dataset.page;renderNav();renderPage(state.currentPage);$('.sidebar')?.classList.remove('open');});
}
async function renderPage(page,force=false){const meta=availablePages().find(p=>p.id===page);if(!meta||!can(meta.permission)){state.currentPage=null;renderNav();$('#pageTitle').textContent='غير مصرح';$('#pageSubtitle').textContent='تم منع فتح الرابط المباشر';$('#content').innerHTML='<div class="empty"><h3>ليس لديك صلاحية لفتح هذا القسم</h3><p>تم منع تحميل بيانات القسم.</p></div>';return;}state.currentPage=page;renderNav();$('#pageTitle').textContent=pageLabel(meta);$('#pageSubtitle').textContent=pageSub(page);$('#content').innerHTML='<div class="empty">جاري تحميل البيانات...</div>';try{switch(page){case'dashboard':await renderDashboard();break;case'products':await renderProducts();break;case'inventory':await renderInventory();break;case'pos':await renderPOS();break;case'orders':await renderOrders();break;case'bookings':await renderBookings();break;case'quotes':await renderQuotes();break;case'workorders':await renderWorkOrders();break;case'customers':await renderCustomers();break;case'purchases':await renderPurchases();break;case'smart':await renderSmart();break;case'reports':await renderReports();break;case'users':await renderUsers();break;case'audit':await renderAudit();break;case'dataquality':await renderDataQuality();break;case'attendance':await renderAttendance();break;case'leaves':await renderLeaves();break;case'payroll':await renderPayroll();break;case'compensation':await renderCompensation();break;case'settings':renderSettings();break;default:$('#content').innerHTML='<div class="empty">القسم قيد الإعداد</div>';}applyPagePermissions(page);enhanceCurrentPageTables(page);enhanceSearchableSelects($('#content'));bindRecordActions();}catch(err){$('#content').innerHTML=`<div class="empty">${escapeHtml(err.message)}</div>`;toast(err.message,'error');}}
function pageSub(p){return {dashboard:'نظرة مباشرة على التشغيل والمبيعات',products:'إدارة المنتجات والأسعار والتصنيفات',inventory:'الكميات والحركات والتنبيهات',pos:'بيع مباشر وإصدار فاتورة وخصم المخزون',orders:'متابعة الطلبات والمدفوعات والتسليم',bookings:'تقويم الأعراس والمناسبات والمعاينات',quotes:'من عرض السعر إلى الحجز وأمر العمل',workorders:'تنفيذ المهام والتوثيق وإعادة المعدات',customers:'سجل العميل والطلبات ونقاط الولاء',purchases:'الموردون وأوامر الشراء والاستلام',smart:'تنبيهات واقتراحات مبنية على بيانات النظام',reports:'تقارير قابلة للفلترة والتصدير',users:'إدارة المستخدمين والأدوار والصلاحيات الفعلية',audit:'كل تعديل وحذف واعتماد داخل النظام',dataquality:'كشف التكرار وعدم التطابق والأخطاء قبل أن تؤثر على التشغيل',attendance:'تسجيل وتحضير ومراجعة الحضور والغياب والأوفر تايم',leaves:'طلبات الإجازات والمأذونيات وربطها بالحضور والراتب',payroll:'الاحتساب والمراجعة والاعتماد والقسائم والصرف',compensation:'السلف والأقساط والجزاءات والمكافآت والعمولات',settings:'بيانات المنشأة والتجربة والإعدادات'}[p]||'';}

async function renderDashboard(){
  const d=await api('/api/dashboard');const m=d.metrics;
  const metric=(label,val,sub='')=>`<div class="metric-card"><small>${label}</small><strong>${val}</strong><div class="trend">${sub||'محدث الآن'}</div></div>`;
  $('#content').innerHTML=`<div class="metrics">${metric('مبيعات اليوم',money(m.sales_today))}${metric('مبيعات الشهر',money(m.sales_month))}${metric('الحجوزات المؤكدة',number(m.bookings_confirmed))}${metric('الطلبات الجديدة',number(m.orders_new))}${metric('صافي ربح الشهر',money(m.profit_month))}${metric('قيمة المخزون',money(m.inventory_value))}${metric('أصناف منخفضة',number(m.low_stock),m.low_stock?'تحتاج متابعة':'الوضع مستقر')}${metric('أوامر عمل مفتوحة',number(m.pending_work_orders))}</div><div class="grid-2"><section class="panel"><div class="panel-head"><h3>اتجاه المبيعات</h3><small>آخر 14 يومًا</small></div><div class="chart-bars">${chartBars(d.salesTrend)}</div></section><section class="panel"><div class="panel-head"><h3>المناسبات القادمة</h3><button class="mini-btn" data-go="bookings">فتح الحجوزات</button></div><div class="list">${d.upcoming.length?d.upcoming.map(x=>`<div class="list-item"><div><b>${escapeHtml(x.event_type)} · ${escapeHtml(x.customer_name)}</b><small>${dt(x.start_at)} · ${escapeHtml(x.venue_name||'الموقع غير محدد')}</small></div>${statusBadge(x.status)}</div>`).join(''):'<div class="empty">لا توجد مناسبات قادمة</div>'}</div></section></div><div class="grid-2"><section class="panel"><div class="panel-head"><h3>الأكثر مبيعًا</h3></div><div class="list">${d.topProducts.length?d.topProducts.map((x,i)=>`<div class="list-item"><div><b>${i+1}. ${escapeHtml(x.name)}</b><small>${number(x.qty)} قطعة</small></div><strong>${money(x.total)}</strong></div>`).join(''):'<div class="empty">تظهر البيانات بعد تسجيل مبيعات</div>'}</div></section><section class="panel"><div class="panel-head"><h3>التحصيل والتشغيل</h3></div><div class="list"><div class="list-item"><span>العربون المستلم</span><b>${money(m.deposits_received)}</b></div><div class="list-item"><span>المبالغ المتبقية</span><b>${money(m.remaining_amounts)}</b></div><div class="list-item"><span>عروض بانتظار العميل</span><b>${number(m.pending_quotes)}</b></div><div class="list-item"><span>مصروفات الشهر</span><b>${money(m.expenses_month)}</b></div></div></section></div>`;
  $$('[data-go]').forEach(b=>b.onclick=()=>renderPage(b.dataset.go));
}
function chartBars(rows){if(!rows.length)return '<div class="empty">لا توجد مبيعات بعد</div>';const max=Math.max(...rows.map(r=>Number(r.total)),1);return rows.map(r=>`<div class="bar-wrap" title="${money(r.total)}"><div class="bar" style="height:${Math.max(6,Number(r.total)/max*100)}%"></div><small>${r.day.slice(5)}</small></div>`).join('');}


function recordActionButtons(entity,row,options={}){
 const id=row?.id;if(!id)return'';const map={product:{view:'products.view',edit:'products.edit',del:'products.delete',print:'products.print'},customer:{view:'customers.view',edit:'customers.edit',del:'customers.delete',print:'customers.print'},order:{view:'orders.view',edit:'orders.edit',del:'orders.delete',print:'orders.print'},booking:{view:'bookings.view',edit:'bookings.edit',del:'bookings.delete',print:'bookings.print'},quotation:{view:'quotations.view',edit:'quotations.create',del:'quotations.delete',print:'quotations.print'},supplier:{view:'suppliers.view',edit:'suppliers.edit',del:'suppliers.delete',print:'suppliers.print'},purchase_order:{view:'purchases.view',edit:'purchases.create',del:'purchases.delete',print:'purchases.print'},work_order:{view:'workorders.view',edit:'workorders.edit',del:'workorders.delete',print:'workorders.print'}}[entity]||{};
 return `<div class="actions unified-actions">${map.view&&can(map.view)?`<button class="mini-btn" data-record-view="${entity}" data-id="${id}">عرض</button>`:''}${options.edit&&map.edit&&can(map.edit)?`<button class="mini-btn" data-record-edit="${entity}" data-id="${id}">تعديل</button>`:''}${map.del&&can(map.del)?`<button class="mini-btn danger-lite" data-record-delete="${entity}" data-id="${id}">حذف</button>`:''}${map.print&&can(map.print)?`<button class="mini-btn" data-record-print="${entity}" data-id="${id}">طباعة</button><button class="mini-btn" data-record-pdf="${entity}" data-id="${id}">PDF</button><button class="mini-btn" data-record-whatsapp="${entity}" data-id="${id}">واتساب</button>`:''}${can('audit.view')?`<button class="mini-btn" data-record-audit="${entity}" data-id="${id}">السجل</button>`:''}${options.extra||''}</div>`;
}
function bindRecordActions(){
 $$('[data-record-view]').forEach(b=>b.onclick=()=>window.WardatDocuments.open(b.dataset.recordView,b.dataset.id));
 $$('[data-record-print]').forEach(b=>b.onclick=()=>window.WardatDocuments.open(b.dataset.recordPrint,b.dataset.id));
 $$('[data-record-pdf]').forEach(b=>b.onclick=()=>window.WardatDocuments.open(b.dataset.recordPdf,b.dataset.id,{autoPdf:true}));
 $$('[data-record-whatsapp]').forEach(b=>b.onclick=()=>window.WardatDocuments.whatsapp(b.dataset.recordWhatsapp,b.dataset.id));
 $$('[data-record-delete]').forEach(b=>b.onclick=async()=>{const reason=prompt('اكتب سبب الحذف الآمن:');if(!reason)return;if(!confirm('سيتم نقل السجل إلى المحذوفات مع حفظ سجل التعديلات. متابعة؟'))return;await api(`/api/records/${b.dataset.recordDelete}/${b.dataset.id}/soft-delete`,{method:'POST',body:{reason}});toast('تم نقل السجل إلى المحذوفات');await renderPage(state.currentPage,true);});
 $$('[data-record-audit]').forEach(b=>b.onclick=async()=>{const d=await api(`/api/records/${b.dataset.recordAudit}/${b.dataset.id}/audit`);openForm('سجل التعديلات',`<div class="list">${d.items?.length?d.items.map(x=>`<div class="list-item"><div><b>${escapeHtml(x.action)}</b><small>${escapeHtml(x.user_name||'النظام')} · ${dt(x.created_at)}</small></div><span>${escapeHtml(x.reason||'')}</span></div>`).join(''):'<div class="empty">لا توجد تعديلات مسجلة</div>'}</div>`,async()=>{});});
}
function financialSummaryMarkup(id){return window.WardatFinancial?.summaryHtml(id)||'';}

async function renderProducts(options={}){
  const page=Number(options.page||state.cache.productsPage?.page||1),search=options.search??state.cache.productsPage?.search??'';
  const [{items,...meta},cats]=await Promise.all([api(`/api/products?page=${page}&page_size=40&search=${encodeURIComponent(search)}`),api('/api/categories')]);
  state.cache.products=items;state.cache.categories=cats.items;state.cache.productsPage={...meta,page,search};
  $('#content').innerHTML=`<div class="toolbar"><input class="search" id="productSearch" value="${escapeHtml(search)}" placeholder="ابحث بالاسم أو الكود أو الباركود"><div><button class="btn btn-outline" id="addCategory">تصنيف جديد</button> <button class="btn btn-primary" id="addProduct">منتج جديد</button></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>المنتج</th><th>الكود</th><th>التصنيف</th><th>سعر البيع</th><th>المتاح</th><th>الحد الأدنى</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody id="productRows"></tbody></table></div>${pagerHtml({...meta,page},'products')}`;
  renderProductRows(items);const input=$('#productSearch');input.oninput=debounce(e=>renderProducts({page:1,search:e.target.value.trim()}),400);input.focus();input.setSelectionRange(input.value.length,input.value.length);$('#addProduct').onclick=()=>productForm();$('#addCategory').onclick=categoryForm();bindPager('products',renderProducts,search);
}
function renderProductRows(items){$('#productRows').innerHTML=items.map(p=>`<tr><td><div style="display:flex;align-items:center;gap:10px"><img class="thumb" src="${escapeHtml(p.image_url||'assets/logo.png')}"><div><b>${escapeHtml(p.name_ar)}</b><small>${escapeHtml(p.unit||'قطعة')}</small></div></div></td><td>${escapeHtml(p.sku)}</td><td>${escapeHtml(p.category_name||'—')}</td><td>${money(p.sale_price)}</td><td>${number(p.available_qty)}</td><td>${number(p.min_stock)}</td><td>${p.is_active?statusBadge('completed'):statusBadge('cancelled')}</td><td>${recordActionButtons('product',p,{edit:true,extra:`<button class="mini-btn" data-stock-product="${p.id}">مخزون</button>`})}</td></tr>`).join('');$$('[data-record-edit="product"]').forEach(b=>b.onclick=()=>productForm(state.cache.products.find(x=>x.id===b.dataset.id)));$$('[data-stock-product]').forEach(b=>b.onclick=()=>inventoryAdjustForm(b.dataset.stockProduct));bindRecordActions();}
function productForm(p=null){if(!guard(p?'products.edit':'products.create'))return;const financialView=can('products.view_financial'),financialEdit=can('products.edit_financial');const cats=state.cache.categories||[];openForm(p?'تعديل المنتج':'إضافة منتج',`<form class="form-grid" id="productFinanceForm"><label>اسم المنتج<input name="name_ar" value="${escapeHtml(p?.name_ar||'')}" required></label><label>كود الصنف<input name="sku" value="${escapeHtml(p?.sku||'')}" required></label><label>الباركود<input name="barcode" value="${escapeHtml(p?.barcode||'')}"></label><label>التصنيف<select name="category_id"><option value="">بدون تصنيف</option>${cats.map(c=>`<option value="${c.id}" ${p?.category_id===c.id?'selected':''}>${escapeHtml(c.name_ar)}</option>`).join('')}</select></label><label>طريقة إدخال سعر البيع<select name="price_input_mode"><option value="exclusive">غير شامل الضريبة</option><option value="inclusive">شامل الضريبة</option><option value="exempt">معفى من الضريبة</option></select></label><label>سعر الشراء<input type="number" step="0.01" name="purchase_price" value="${financialView?(p?.purchase_price||0):''}" ${financialEdit?'':'disabled'}></label><label>متوسط التكلفة<input type="number" step="0.01" name="average_cost" value="${financialView?(p?.average_cost||0):''}" ${financialEdit?'':'disabled'}></label><label>سعر البيع<input type="number" step="0.01" name="sale_price" value="${p?.sale_price||0}" ${financialEdit?'required':'disabled'}></label><label>الحد الأدنى للربح<input type="number" step="0.01" name="min_profit" value="${financialView?(p?.min_profit||0):''}" ${financialEdit?'':'disabled'}></label>${p?'':`<label>الرصيد الافتتاحي<input type="number" step="0.01" name="stock_qty" value="0"></label>`}<label>حد إعادة الطلب<input type="number" step="0.01" name="min_stock" value="${p?.min_stock||0}"></label><label>الوحدة<input name="unit" value="${escapeHtml(p?.unit||'قطعة')}"></label><label>رابط الصورة<input name="image_url" value="${escapeHtml(p?.image_url||'')}"></label><label class="span-2">الوصف<textarea name="description">${escapeHtml(p?.description||'')}</textarea></label><div class="span-2">${financialSummaryMarkup('productFinancialSummary')}</div><label><input type="checkbox" name="is_featured" ${p?.is_featured?'checked':''}> منتج مميز</label><label><input type="checkbox" name="is_active" ${p?.is_active!==0?'checked':''}> نشط</label><button class="btn btn-primary span-2" type="submit">حفظ المنتج</button></form>`,async b=>{['purchase_price','average_cost','sale_price','min_profit','stock_qty','min_stock'].forEach(k=>{if(b[k]!==undefined)b[k]=Number(b[k])||0;});await api(p?`/api/products/${p.id}`:'/api/products',{method:p?'PUT':'POST',body:b});toast('تم حفظ المنتج');await renderProducts();});setTimeout(()=>{const f=$('#productFinanceForm'),summary=$('#productFinancialSummary');const calc=()=>{const r=window.WardatFinancial.document({lines:[{qty:1,unitPrice:f.sale_price.value,cost:f.average_cost.value,priceMode:f.price_input_mode.value}]});window.WardatFinancial.paint(summary,r,financialView);};f?.addEventListener('input',calc);f?.addEventListener('change',calc);calc();},0);}
function categoryForm(){if(!guard('categories.create'))return;openForm('إضافة تصنيف',`<form class="form-grid single"><label>اسم التصنيف<input name="name_ar" required></label><label>الاسم الإنجليزي<input name="name_en"></label><label>الرابط المختصر<input name="slug"></label><button class="btn btn-primary" type="submit">حفظ التصنيف</button></form>`,async b=>{await api('/api/categories',{method:'POST',body:b});toast('تم حفظ التصنيف');await renderProducts();});}

async function renderInventory(){const d=await api('/api/inventory');state.cache.inventory=d.items;const mayMove=window.PermissionsService.canAny(['inventory.adjust','inventory.issue','inventory.receive']);const inventoryValue=can('inventory.view_financial')?money(d.items.reduce((s,x)=>s+Number(x.current_qty)*Number(x.average_cost),0)):'—';$('#content').innerHTML=`<div class="toolbar"><input class="search" id="inventorySearch" placeholder="ابحث في المخزون">${mayMove?'<button class="btn btn-primary" id="inventoryAdjust">تسجيل حركة</button>':''}</div><div class="metrics">${metricHtml('إجمالي الأصناف',d.items.length)}${metricHtml('منخفضة الكمية',d.items.filter(x=>Number(x.available_qty)<=Number(x.min_qty)).length)}${metricHtml('القيمة التقريبية',inventoryValue)}${metricHtml('الكميات المحجوزة',number(d.items.reduce((s,x)=>s+Number(x.reserved_qty),0)))}</div><div class="grid-2"><section class="panel"><div class="panel-head"><h3>الأرصدة الحالية</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>الصنف</th><th>الحالي</th><th>المحجوز</th><th>المتاح</th><th>التالف</th><th>الموقع</th><th>تنبيه</th></tr></thead><tbody id="inventoryRows">${inventoryRows(d.items)}</tbody></table></div></section><section class="panel"><div class="panel-head"><h3>آخر الحركات</h3></div><div class="list">${d.movements.slice(0,18).map(m=>`<div class="list-item"><div><b>${escapeHtml(m.product_name||'صنف')}</b><small>${escapeHtml(m.movement_type)} · ${dt(m.created_at)}</small></div><strong style="color:${Number(m.qty)>=0?'var(--green)':'var(--red)'}">${Number(m.qty)>=0?'+':''}${number(m.qty)}</strong></div>`).join('')}</div></section></div>`;if($('#inventoryAdjust'))$('#inventoryAdjust').onclick=()=>inventoryAdjustForm();$('#inventorySearch').oninput=e=>{$('#inventoryRows').innerHTML=inventoryRows(d.items.filter(x=>`${x.name_ar} ${x.sku}`.toLowerCase().includes(e.target.value.toLowerCase())));};}
function metricHtml(label,val){return `<div class="metric-card"><small>${label}</small><strong>${val}</strong></div>`;}
function inventoryRows(items){return items.map(i=>`<tr><td><b>${escapeHtml(i.name_ar)}</b><small>${escapeHtml(i.sku)}</small></td><td>${number(i.current_qty)}</td><td>${number(i.reserved_qty)}</td><td>${number(i.available_qty)}</td><td>${number(i.damaged_qty)}</td><td>${escapeHtml(i.location_code||'—')}</td><td>${Number(i.available_qty)<=Number(i.min_qty)?'<span class="status red">منخفض</span>':'<span class="status green">جيد</span>'}</td></tr>`).join('');}
async function inventoryAdjustForm(productId=''){
  if(!window.PermissionsService.canAny(['inventory.adjust','inventory.issue','inventory.receive']))return toast('ليس لديك صلاحية تسجيل حركة مخزون','error');
  let products=state.cache.products;if(!products){products=(await api('/api/products?active=1')).items;state.cache.products=products;}
  const types=[];
  if(can('inventory.receive'))types.push(['purchase','شراء/إضافة'],['return_event','إعادة من مناسبة']);
  if(can('inventory.issue'))types.push(['sale','بيع/خصم'],['work_order_issue','صرف لأمر عمل']);
  if(can('inventory.adjust'))types.push(['damage','تلف'],['loss','فقد'],['adjustment_in','تسوية زيادة']);
  openForm('تسجيل حركة مخزون',`<form class="form-grid"><label>الصنف<select name="product_id" required><option value="">اختر</option>${products.map(p=>`<option value="${p.id}" ${productId===p.id?'selected':''}>${escapeHtml(p.name_ar)} (${number(p.available_qty)} متاح)</option>`).join('')}</select></label><label>نوع الحركة<select name="movement_type">${types.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>الكمية<input type="number" step="0.01" name="qty" required></label><label>تكلفة الوحدة<input type="number" step="0.01" name="unit_cost" ${can('inventory.view_financial')?'':'disabled'}></label><label class="span-2">الملاحظات والسبب<textarea name="notes" required></textarea></label><button class="btn btn-primary span-2" type="submit">اعتماد الحركة</button></form>`,async b=>{
    const key=['sale','work_order_issue'].includes(b.movement_type)?'inventory.issue':['purchase','return_event'].includes(b.movement_type)?'inventory.receive':'inventory.adjust';if(!guard(key))throw new Error('ليست لديك صلاحية هذه الحركة');
    b.qty=Number(b.qty);b.unit_cost=can('inventory.view_financial')?(Number(b.unit_cost)||0):0;await api('/api/inventory/adjust',{method:'POST',body:b});toast('تم تحديث المخزون');await renderInventory();
  });
}

async function renderPOS(){const [{items:products},{items:customers}]=await Promise.all([api('/api/products?active=1'),api('/api/customers')]);state.cache.products=products;state.cache.customers=customers;$('#content').innerHTML=`<div class="pos-layout"><section><div class="toolbar"><input class="search" id="posSearch" placeholder="بحث بالمنتج أو الباركود"><span class="kpi-pill">المتاح للبيع: ${products.filter(p=>Number(p.available_qty)>0).length}</span></div><div id="posProducts" class="pos-products">${posProductCards(products)}</div></section><aside class="panel cart-panel"><div class="panel-head"><h3>فاتورة جديدة</h3><button class="mini-btn" id="clearPos">مسح</button></div><div id="posCart"></div><div class="form-grid single"><label>طريقة إدخال السعر<select id="posPriceMode"><option value="exclusive">غير شامل الضريبة</option><option value="inclusive">شامل الضريبة</option><option value="exempt">معفى من الضريبة</option></select></label><label>نوع خصم الفاتورة<select id="posDiscountType"><option value="fixed">مبلغ ثابت</option><option value="percent">نسبة مئوية</option></select></label><label>قيمة الخصم<input id="posDiscount" type="number" min="0" step="0.01" value="0"></label><label>التوصيل<input id="posDelivery" type="number" min="0" step="0.01" value="0"></label><label>إضافات أخرى<input id="posExtras" type="number" min="0" step="0.01" value="0"></label><label>المبلغ المدفوع<input id="posPaid" type="number" min="0" step="0.01" value="0"></label><label>العميل<select id="posCustomer"><option value="">عميل نقدي سريع</option>${customers.map(c=>`<option value="${c.id}">${escapeHtml(c.name)} · ${escapeHtml(c.phone)}</option>`).join('')}</select></label><label>طريقة الدفع<select id="posMethod"><option value="cash">نقدًا</option><option value="mada">مدى/شبكة</option><option value="bank_transfer">تحويل بنكي</option><option value="online">دفع إلكتروني</option></select></label></div>${financialSummaryMarkup('posTotals')}<button class="btn btn-primary wide" id="completeSale">إتمام البيع وإصدار الفاتورة</button></aside></div>`;renderPosCart();$('#posSearch').oninput=e=>$('#posProducts').innerHTML=posProductCards(products.filter(p=>`${p.name_ar} ${p.sku} ${p.barcode||''}`.toLowerCase().includes(e.target.value.toLowerCase())));$('#posProducts').onclick=e=>{const b=e.target.closest('[data-pos-add]');if(b)posAdd(b.dataset.posAdd);};$('#clearPos').onclick=()=>{state.posCart=[];renderPosCart();};['posDiscount','posDiscountType','posDelivery','posExtras','posPaid','posPriceMode'].forEach(id=>$('#'+id)?.addEventListener('input',renderPosCart));$('#completeSale').onclick=completeSale;}
function posProductCards(items){return items.map(p=>`<article class="pos-card"><img src="${escapeHtml(p.image_url||'assets/logo.png')}" alt=""><div><h4>${escapeHtml(p.name_ar)}</h4><small>${number(p.available_qty)} ${escapeHtml(p.unit)}</small><div class="product-foot"><b>${money(p.sale_price)}</b><button class="add-btn" data-pos-add="${p.id}" ${Number(p.available_qty)<=0?'disabled':''}>+</button></div></div></article>`).join('');}
function posAdd(pid){const p=state.cache.products.find(x=>x.id===pid),line=state.posCart.find(x=>x.product_id===pid);if(!p)return;if(line){if(line.qty>=Number(p.available_qty))return toast('الكمية غير متاحة','error');line.qty++;}else state.posCart.push({product_id:p.id,name:p.name_ar,price:Number(p.sale_price),cost:Number(p.average_cost||0),qty:1,available:Number(p.available_qty)});renderPosCart();}
function currentPosFinancials(){return window.WardatFinancial.document({lines:state.posCart.map(i=>({qty:i.qty,unitPrice:i.price,cost:i.cost,priceMode:$('#posPriceMode')?.value})),invoiceDiscountType:$('#posDiscountType')?.value,invoiceDiscountValue:$('#posDiscount')?.value,deliveryFee:$('#posDelivery')?.value,extrasTotal:$('#posExtras')?.value,paid:$('#posPaid')?.value});}
function renderPosCart(){const el=$('#posCart');if(!el)return null;el.innerHTML=state.posCart.length?state.posCart.map((i,idx)=>`<div class="cart-line"><div><b>${escapeHtml(i.name)}</b><small>${money(i.price)}</small></div><div class="qty-control"><button data-pdec="${idx}">−</button><span>${i.qty}</span><button data-pinc="${idx}">+</button></div><b>${money(i.qty*i.price)}</b></div>`).join(''):'<div class="empty">أضف المنتجات للفاتورة</div>';const r=currentPosFinancials();window.WardatFinancial.paint($('#posTotals'),r,can('orders.view_financial'));$$('[data-pinc]').forEach(b=>b.onclick=()=>{const i=state.posCart[+b.dataset.pinc];if(i.qty>=i.available)return toast('الكمية غير متاحة','error');i.qty++;renderPosCart();});$$('[data-pdec]').forEach(b=>b.onclick=()=>{const i=state.posCart[+b.dataset.pdec];i.qty--;if(i.qty<=0)state.posCart.splice(+b.dataset.pdec,1);renderPosCart();});return r;}
async function completeSale(){if(!guard('pos.create_sale'))return;if(!state.posCart.length)return toast('أضف منتجًا واحدًا على الأقل','error');const r=renderPosCart(),customerId=$('#posCustomer').value,customer=state.cache.customers.find(c=>c.id===customerId),paid=Number($('#posPaid').value)||r.total;if(r.totalDiscount>0&&!guard('pos.apply_discount'))return;if(paid<r.total&&!guard('pos.partial_payment'))return;try{const result=await api('/api/orders',{method:'POST',body:{customer_id:customerId||null,customer_name:customer?.name||'عميل نقدي',phone:customer?.phone||'',items:state.posCart.map(i=>({product_id:i.product_id,qty:i.qty,unit_price:i.price,price_input_mode:$('#posPriceMode').value})),discount_type:$('#posDiscountType').value,discount_value:Number($('#posDiscount').value)||0,delivery_fee:Number($('#posDelivery').value)||0,extras_total:Number($('#posExtras').value)||0,price_input_mode:$('#posPriceMode').value,paid_amount:paid,payment_method:$('#posMethod').value,idempotency_key:crypto.randomUUID()}});toast(`تمت عملية البيع: ${result.item.order_no}`);state.posCart=[];await renderPOS();await window.WardatDocuments.open('order',result.item.id);}catch(err){toast(err.message,'error');}}
async function renderOrders(options={}){const page=Number(options.page||state.cache.ordersPage?.page||1),search=options.search??state.cache.ordersPage?.search??'';const {items,...meta}=await api(`/api/orders?page=${page}&page_size=40&search=${encodeURIComponent(search)}`);state.cache.orders=items;state.cache.ordersPage={...meta,page,search};$('#content').innerHTML=`<div class="toolbar"><input class="search" id="orderSearch" value="${escapeHtml(search)}" placeholder="رقم الطلب، العميل أو الجوال"><div class="kpi-row"><span class="kpi-pill">سجلات الصفحة ${number(items.length)}</span><span class="kpi-pill">إجمالي النتائج ${number(meta.total||0)}</span></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>الطلب</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody id="orderRows">${orderRows(items)}</tbody></table></div>${pagerHtml({...meta,page},'orders')}`;const input=$('#orderSearch');input.oninput=debounce(e=>renderOrders({page:1,search:e.target.value.trim()}),400);input.focus();input.setSelectionRange(input.value.length,input.value.length);bindOrderActions();bindPager('orders',renderOrders,search);}
function orderRows(items){return items.map(o=>`<tr><td><b>${escapeHtml(o.order_no)}</b><small>${escapeHtml(o.fulfillment_type)}</small></td><td>${escapeHtml(o.customer_name||'عميل نقدي')}<small>${escapeHtml(o.phone||'')}</small></td><td>${money(o.total)}</td><td>${money(o.paid_amount)}</td><td>${statusBadge(o.payment_status)}</td><td>${statusBadge(o.status)}</td><td>${dt(o.created_at)}</td><td>${recordActionButtons('order',o,{edit:true,extra:`<button class="mini-btn" data-order-status="${o.id}">الحالة</button>`})}</td></tr>`).join('');}
function bindOrderActions(){$$('[data-order-status]').forEach(b=>b.onclick=async()=>{if(!window.PermissionsService.canAny(['orders.edit','orders.cancel','orders.return']))return toast('ليس لديك صلاحية لتحديث الطلب','error');const o=state.cache.orders.find(x=>x.id===b.dataset.orderStatus),flow=await api(`/api/workflows/transitions?entity=order&status=${encodeURIComponent(o.status)}`);openForm(`تحديث ${o.order_no}`,`<form class="form-grid single"><label>الحالة<select name="status">${flow.items.map(x=>`<option value="${x.status}" ${x.current?'selected':''}>${escapeHtml(x.label)}</option>`).join('')}</select></label><label>سبب التعديل<textarea name="reason" required></textarea></label><button class="btn btn-primary" type="submit">حفظ</button></form>`,async d=>{const key=d.status==='cancelled'?'orders.cancel':d.status==='returned'?'orders.return':'orders.edit';if(!guard(key))throw new Error('ليست لديك صلاحية للحالة المختارة');await api(`/api/orders/${o.id}`,{method:'PATCH',body:d});toast('تم تحديث الطلب');await renderOrders();});});$$('[data-record-edit="order"]').forEach(b=>b.onclick=()=>document.querySelector(`[data-order-status="${b.dataset.id}"]`)?.click());bindRecordActions();}

async function renderBookings(options={}){const page=Number(options.page||state.cache.bookingsPage?.page||1),search=options.search??state.cache.bookingsPage?.search??'';const {items,...meta}=await api(`/api/bookings?page=${page}&page_size=40&search=${encodeURIComponent(search)}`);state.cache.bookings=items;state.cache.bookingsPage={...meta,page,search};$('#content').innerHTML=`<div class="toolbar"><input class="search" id="bookingSearch" value="${escapeHtml(search)}" placeholder="رقم الحجز، العميل أو المناسبة"><button class="btn btn-primary" id="addBooking">حجز جديد</button></div><div class="metrics">${metricHtml('نتائج البحث',number(meta.total||0))}${metricHtml('مؤكدة في الصفحة',items.filter(x=>['confirmed','preparing','installing'].includes(x.status)).length)}${metricHtml('بانتظار العميل في الصفحة',items.filter(x=>['new','waiting_contact','pending_client'].includes(x.status)).length)}${metricHtml('قيمة الصفحة',money(items.reduce((s,x)=>s+Number(x.budget||0),0)))}</div><div class="table-wrap" style="margin-top:18px"><table class="data-table"><thead><tr><th>الحجز</th><th>العميل</th><th>المناسبة</th><th>الموعد</th><th>الموقع</th><th>الميزانية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="bookingRows">${bookingRows(items)}</tbody></table></div>${pagerHtml({...meta,page},'bookings')}`;$('#addBooking').onclick=bookingForm;const input=$('#bookingSearch');input.oninput=debounce(e=>renderBookings({page:1,search:e.target.value.trim()}),400);input.focus();input.setSelectionRange(input.value.length,input.value.length);bindBookingActions();bindPager('bookings',renderBookings,search);}
function bookingRows(items){return items.map(b=>`<tr><td><b>${escapeHtml(b.booking_no)}</b></td><td>${escapeHtml(b.customer_name)}<small>${escapeHtml(b.phone)}</small></td><td>${escapeHtml(b.event_type)}</td><td>${dt(b.start_at)}</td><td>${escapeHtml(b.venue_name||b.district||'—')}</td><td>${money(b.budget)}</td><td>${statusBadge(b.status)}</td><td>${recordActionButtons('booking',b,{edit:true,extra:`<button class="mini-btn" data-booking-status="${b.id}">الحالة</button><button class="mini-btn" data-booking-quote="${b.id}">عرض سعر</button>`})}</td></tr>`).join('');}
function bindBookingActions(){$$('[data-booking-status]').forEach(x=>x.onclick=()=>bookingStatusForm(x.dataset.bookingStatus));$$('[data-booking-quote]').forEach(x=>x.onclick=()=>quoteForm(state.cache.bookings.find(b=>b.id===x.dataset.bookingQuote)));$$('[data-record-edit="booking"]').forEach(x=>x.onclick=()=>bookingStatusForm(x.dataset.id));bindRecordActions();}
function bookingForm(){if(!guard('bookings.create'))return;openForm('إضافة حجز مناسبة',`<form class="form-grid"><label>اسم العميل<input name="customer_name" required></label><label>الجوال<input name="phone" required></label><label>نوع المناسبة<select name="event_type"><option>زفاف</option><option>خطوبة</option><option>ملكة</option><option>تخرج</option><option>عيد ميلاد</option><option>استقبال مولود</option><option>مناسبة شركات</option></select></label><label>عدد الضيوف<input type="number" name="guest_count"></label><label>بداية المناسبة<input type="datetime-local" name="start_at" required></label><label>نهاية المناسبة<input type="datetime-local" name="end_at" required></label><label>القاعة/الموقع<input name="venue_name"></label><label>الحي<input name="district"></label><label>الميزانية<input type="number" name="budget"></label><label>الألوان<input name="preferred_colors"></label><label class="span-2">التفاصيل<textarea name="details"></textarea></label><label><input type="checkbox" name="inspection_required"> معاينة مطلوبة</label><button class="btn btn-primary" type="submit">حفظ الحجز</button></form>`,async b=>{b.guest_count=Number(b.guest_count)||0;b.budget=Number(b.budget)||0;b.idempotency_key=crypto.randomUUID();await api('/api/bookings',{method:'POST',body:b});toast('تم إنشاء الحجز');await renderBookings();});}
async function bookingStatusForm(id){if(!window.PermissionsService.canAny(['bookings.edit','bookings.approve','bookings.cancel']))return toast('ليس لديك صلاحية لتحديث الحجز','error');const b=state.cache.bookings.find(x=>x.id===id),flow=await api(`/api/workflows/transitions?entity=booking&status=${encodeURIComponent(b.status)}`);openForm(`تحديث ${b.booking_no}`,`<form class="form-grid single"><label>الحالة<select name="status">${flow.items.map(x=>`<option value="${x.status}" ${x.current?'selected':''}>${escapeHtml(x.label)}</option>`).join('')}</select></label><label>المبلغ المدفوع<input type="number" step="0.01" name="paid_amount" value="${b.paid_amount||0}" ${can('bookings.view_financial')?'':'disabled'}></label><label>سبب التعديل<textarea name="reason" required></textarea></label><button class="btn btn-primary" type="submit">حفظ</button></form>`,async d=>{const key=d.status==='confirmed'?'bookings.approve':d.status==='cancelled'?'bookings.cancel':'bookings.edit';if(!guard(key))throw new Error('ليست لديك صلاحية للحالة المختارة');if(d.paid_amount!==undefined)d.paid_amount=Number(d.paid_amount)||0;else d.paid_amount=Number(b.paid_amount)||0;await api(`/api/bookings/${id}`,{method:'PATCH',body:d});toast('تم تحديث الحجز');await renderBookings();});}

async function renderQuotes(){const {items}=await api('/api/quotations');state.cache.quotes=items;$('#content').innerHTML=`<div class="toolbar"><input class="search" id="quoteSearch" placeholder="رقم العرض أو العميل"><button class="btn btn-primary" id="addQuote">عرض سعر جديد</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>عرض السعر</th><th>العميل</th><th>المناسبة</th><th>الإجمالي</th><th>العربون</th><th>المتبقي</th><th>الصلاحية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="quoteRows">${quoteRows(items)}</tbody></table></div>`;$('#addQuote').onclick=()=>quoteForm();$('#quoteSearch').oninput=e=>{$('#quoteRows').innerHTML=quoteRows(items.filter(x=>`${x.quotation_no} ${x.customer_name}`.toLowerCase().includes(e.target.value.toLowerCase())));bindQuoteActions();};bindQuoteActions();}
function quoteRows(items){return items.map(q=>`<tr><td><b>${escapeHtml(q.quotation_no)}</b><small>${q.item_count} بنود</small></td><td>${escapeHtml(q.customer_name)}<small>${escapeHtml(q.phone||'')}</small></td><td>${dateOnly(q.event_date)}</td><td>${money(q.total)}</td><td>${money(q.deposit)}</td><td>${money(q.remaining)}</td><td>${dateOnly(q.valid_until)}</td><td>${statusBadge(q.status)}</td><td>${recordActionButtons('quotation',q,{extra:q.status!=='approved'?`<button class="mini-btn" data-approve-quote="${q.id}">اعتماد وتحويل</button>`:'<span class="status green">تم التحويل</span>'})}</td></tr>`).join('');}
function bindQuoteActions(){$$('[data-approve-quote]').forEach(b=>b.onclick=async()=>{if(!confirm('سيتم إنشاء حجز مؤكد وعقد وأمر عمل. متابعة؟'))return;try{await api(`/api/quotations/${b.dataset.approveQuote}/approve`,{method:'POST'});toast('تم اعتماد العرض وإنشاء أمر العمل');await renderQuotes();}catch(err){toast(err.message,'error')}});}
function quoteForm(booking=null){if(!guard('quotations.create'))return;openForm('إنشاء عرض سعر',`<form class="form-grid" id="quoteCreate"><input type="hidden" name="booking_id" value="${booking?.id||''}"><label>اسم العميل<input name="customer_name" value="${escapeHtml(booking?.customer_name||'')}" required></label><label>الجوال<input name="phone" value="${escapeHtml(booking?.phone||'')}"></label><label>تاريخ المناسبة<input type="date" name="event_date" value="${booking?.start_at?.slice(0,10)||''}"></label><label>مكان التنفيذ<input name="venue" value="${escapeHtml(booking?.venue_name||'')}"></label><label>العربون<input type="number" step="0.01" name="deposit" value="${booking?.deposit||0}"></label><label>صالح حتى<input type="date" name="valid_until"></label><div class="span-2"><div class="panel-head"><h3>البنود</h3><button type="button" class="mini-btn" id="addQuoteLine">إضافة بند</button></div><div id="quoteLines"></div></div><label class="span-2">شروط الدفع<textarea name="payment_terms">العربون لتأكيد الحجز والباقي قبل التنفيذ.</textarea></label><label class="span-2">ملاحظات<textarea name="notes">${escapeHtml(booking?.details||'')}</textarea></label><button class="btn btn-primary span-2" type="submit">حفظ عرض السعر</button></form>`,async b=>{const lines=$$('.quote-line','#quoteCreate').map(l=>({description:$('[name=description]',l).value,qty:Number($('[name=qty]',l).value)||1,unit_price:Number($('[name=unit_price]',l).value)||0,discount:Number($('[name=line_discount]',l).value)||0})).filter(x=>x.description);b.items=lines;b.deposit=Number(b.deposit)||0;b.idempotency_key=crypto.randomUUID();await api('/api/quotations',{method:'POST',body:b});toast('تم إنشاء عرض السعر');await renderQuotes();});setTimeout(()=>{const add=()=>{$('#quoteLines').insertAdjacentHTML('beforeend',`<div class="quote-line form-grid" style="margin-bottom:10px"><label>الوصف<input name="description" required></label><label>الكمية<input type="number" name="qty" value="1"></label><label>سعر الوحدة<input type="number" step="0.01" name="unit_price"></label><label>خصم البند<input type="number" step="0.01" name="line_discount" value="0"></label></div>`);};$('#addQuoteLine').onclick=add;add();},0);}

async function renderWorkOrders(){
  const woPromise=api('/api/work-orders');
  const employeePromise=window.PermissionsService.canAny(['employees.view','workorders.assign'])?api('/api/employees'):Promise.resolve({items:[]});
  const [{items},emps]=await Promise.all([woPromise,employeePromise]);
  state.cache.workorders=items;state.cache.employees=emps.items||[];
  const canCreate=can('workorders.create');
  $('#content').innerHTML=`<div class="toolbar"><input class="search" id="woSearch" placeholder="رقم أمر العمل أو العميل">${canCreate?'<button class="btn btn-primary" id="addWO">أمر عمل جديد</button>':''}</div><div class="metrics">${metricHtml('أوامر مفتوحة',items.filter(x=>!['completed','cancelled'].includes(x.status)).length)}${metricHtml('جاري التنفيذ',items.filter(x=>['on_way','arrived','installing'].includes(x.status)).length)}${metricHtml('بانتظار الفك',items.filter(x=>x.status==='waiting_dismantle').length)}${metricHtml('مكتملة',items.filter(x=>x.status==='completed').length)}</div><div class="table-wrap" style="margin-top:18px"><table class="data-table"><thead><tr><th>الأمر</th><th>العنوان</th><th>العميل</th><th>الموظف</th><th>الموعد</th><th>الحالة</th><th>الموقع</th><th>تحديث</th></tr></thead><tbody id="woRows">${woRows(items)}</tbody></table></div>`;
  if($('#addWO'))$('#addWO').onclick=workOrderForm;
  $('#woSearch').oninput=e=>{$('#woRows').innerHTML=woRows(items.filter(x=>`${x.work_order_no} ${x.title} ${x.customer_name||''}`.toLowerCase().includes(e.target.value.toLowerCase())));bindWOActions();};
  bindWOActions();
}
function woRows(items){const mayUpdate=window.PermissionsService.canAny(['workorders.edit','workorders.assign','workorders.update_status','workorders.upload_files','workorders.complete']);return items.map(w=>`<tr><td><b>${escapeHtml(w.work_order_no)}</b></td><td>${escapeHtml(w.title)}</td><td>${escapeHtml(w.customer_name||'—')}<small>${escapeHtml(w.customer_phone||'')}</small></td><td>${escapeHtml(w.employee_name||'غير مسند')}</td><td>${dt(w.scheduled_start)}</td><td>${statusBadge(w.status)}</td><td>${w.map_url?`<a target="_blank" rel="noopener" href="${escapeHtml(w.map_url)}">فتح الخريطة</a>`:escapeHtml(w.location||'—')}</td><td>${mayUpdate?`<button class="mini-btn" data-wo-update="${w.id}">تحديث</button>`:'—'}</td></tr>`).join('');}
function bindWOActions(){$$('[data-wo-update]').forEach(b=>b.onclick=()=>workOrderUpdateForm(b.dataset.woUpdate));}
function workOrderForm(){if(!guard('workorders.create'))return;const emps=state.cache.employees||[],canAssign=can('workorders.assign');openForm('إنشاء أمر عمل',`<form class="form-grid"><label>العنوان<input name="title" required></label><label>الموظف<select name="assigned_employee_id" ${canAssign?'':'disabled'}><option value="">بدون</option>${emps.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}</select></label><label>بداية المهمة<input type="datetime-local" name="scheduled_start"></label><label>نهاية المهمة<input type="datetime-local" name="scheduled_end"></label><label>الموقع<input name="location"></label><label>رابط الخريطة<input type="url" name="map_url"></label><label class="span-2">الوصف<textarea name="description"></textarea></label><button class="btn btn-primary span-2" type="submit">إنشاء أمر العمل</button></form>`,async b=>{if(b.assigned_employee_id&&!guard('workorders.assign'))throw new Error('ليست لديك صلاحية تعيين الموظف');b.idempotency_key=crypto.randomUUID();await api('/api/work-orders',{method:'POST',body:b});toast('تم إنشاء أمر العمل');await renderWorkOrders();});}
async function workOrderUpdateForm(id){
  if(!window.PermissionsService.canAny(['workorders.edit','workorders.assign','workorders.update_status','workorders.upload_files','workorders.complete']))return toast('ليس لديك صلاحية تحديث أمر العمل','error');
  const w=state.cache.workorders.find(x=>x.id===id),emps=state.cache.employees||[],flow=await api(`/api/workflows/transitions?entity=work_order&status=${encodeURIComponent(w.status)}`);
  const canStatus=can('workorders.update_status')||can('workorders.complete'),canAssign=can('workorders.assign'),canFiles=can('workorders.upload_files'),canEdit=can('workorders.edit');
  openForm(`تحديث ${w.work_order_no}`,`<form class="form-grid"><label>الحالة<select name="status" ${canStatus?'':'disabled'}>${flow.items.map(x=>`<option value="${x.status}" ${x.current?'selected':''}>${escapeHtml(x.label)}</option>`).join('')}</select></label><label>الموظف<select name="assigned_employee_id" ${canAssign?'':'disabled'}><option value="">بدون</option>${emps.map(e=>`<option value="${e.id}" ${w.assigned_employee_id===e.id?'selected':''}>${escapeHtml(e.name)}</option>`).join('')}</select></label><label>صور قبل التنفيذ (روابط)<textarea name="before_images" ${canFiles?'':'disabled'}>${escapeHtml(w.before_images||'')}</textarea></label><label>صور بعد التنفيذ (روابط)<textarea name="after_images" ${canFiles?'':'disabled'}>${escapeHtml(w.after_images||'')}</textarea></label><label class="span-2">الملاحظات والمواد المستخدمة<textarea name="notes" ${canEdit?'':'disabled'}>${escapeHtml(w.notes||'')}</textarea></label><label class="span-2">توقيع/اسم العميل<input name="customer_signature" value="${escapeHtml(w.customer_signature||'')}" ${canEdit?'':'disabled'}></label><label class="span-2">سبب التحديث<input name="reason" required></label><button class="btn btn-primary span-2" type="submit">حفظ التحديث</button></form>`,async b=>{
    const payload={reason:b.reason};
    if(canStatus){payload.status=b.status;if(b.status==='completed'&&!guard('workorders.complete'))throw new Error('ليست لديك صلاحية إكمال أمر العمل');if(b.status!=='completed'&&b.status!==w.status&&!guard('workorders.update_status'))throw new Error('ليست لديك صلاحية تحديث الحالة');}
    if(canAssign)payload.assigned_employee_id=b.assigned_employee_id;
    if(canFiles){payload.before_images=b.before_images;payload.after_images=b.after_images;}
    if(canEdit){payload.notes=b.notes;payload.customer_signature=b.customer_signature;}
    await api(`/api/work-orders/${id}`,{method:'PATCH',body:payload});toast('تم تحديث أمر العمل');await renderWorkOrders();
  });
}

async function renderCustomers(options={}){const page=Number(options.page||state.cache.customersPage?.page||1),search=options.search??state.cache.customersPage?.search??'';const {items,...meta}=await api(`/api/customers?page=${page}&page_size=40&search=${encodeURIComponent(search)}`);state.cache.customers=items;state.cache.customersPage={...meta,page,search};$('#content').innerHTML=`<div class="toolbar"><input class="search" id="customerSearch" value="${escapeHtml(search)}" placeholder="اسم العميل أو الجوال"><button class="btn btn-primary" id="addCustomer">عميل جديد</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>العميل</th><th>الجوال</th><th>البريد</th><th>الطلبات</th><th>إجمالي المشتريات</th><th>نقاط الولاء</th><th>الملاحظات</th><th>الإجراءات</th></tr></thead><tbody id="customerRows">${customerRows(items)}</tbody></table></div>${pagerHtml({...meta,page},'customers')}`;$('#addCustomer').onclick=customerForm;const input=$('#customerSearch');input.oninput=debounce(e=>renderCustomers({page:1,search:e.target.value.trim()}),400);input.focus();input.setSelectionRange(input.value.length,input.value.length);bindPager('customers',renderCustomers,search);bindRecordActions();}
function customerRows(items){return items.map(c=>`<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.customer_no)}</small></td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.email||'—')}</td><td>${number(c.orders_count)}</td><td>${money(c.lifetime_value)}</td><td>${number(c.loyalty_points)}</td><td>${escapeHtml(c.notes||'—')}</td><td>${recordActionButtons('customer',c)}</td></tr>`).join('');}
function customerForm(){if(!guard('customers.create'))return;openForm('إضافة عميل',`<form class="form-grid"><label>الاسم<input name="name" required></label><label>رقم الجوال<input name="phone" required></label><label>البريد<input type="email" name="email"></label><label>تاريخ الميلاد<input type="date" name="birthday"></label><label class="span-2">ملاحظات<textarea name="notes"></textarea></label><button class="btn btn-primary span-2" type="submit">حفظ العميل</button></form>`,async b=>{const r=await api('/api/customers',{method:'POST',body:b});toast(r.duplicate?'العميل موجود مسبقًا':'تمت إضافة العميل');await renderCustomers();});}

async function renderPurchases(){const [sup,po,prod]=await Promise.all([api('/api/suppliers'),api('/api/purchase-orders'),api('/api/products?active=1')]);state.cache.suppliers=sup.items;state.cache.purchaseOrders=po.items;state.cache.products=prod.items;$('#content').innerHTML=`<div class="toolbar"><div><button class="btn btn-outline" id="addSupplier">مورد جديد</button> <button class="btn btn-primary" id="addPO">أمر شراء</button></div><div class="kpi-row"><span class="kpi-pill">الموردون ${sup.items.length}</span><span class="kpi-pill">أوامر قيد الاستلام ${po.items.filter(x=>x.receiving_status!=='received').length}</span></div></div><div class="grid-2"><section class="panel"><div class="panel-head"><h3>أوامر الشراء</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>الأمر</th><th>المورد</th><th>الإجمالي</th><th>الاستلام</th><th>السداد</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>${po.items.map(x=>`<tr><td><b>${escapeHtml(x.po_no)}</b><small>${x.item_count} بنود</small></td><td>${escapeHtml(x.supplier_name||'—')}</td><td>${money(x.total)}</td><td>${x.receiving_status==='received'?statusBadge('completed'):statusBadge('pending')}</td><td>${statusBadge(x.payment_status)}</td><td>${dt(x.created_at)}</td><td>${x.receiving_status!=='received'?`<button class="mini-btn" data-receive-po="${x.id}">استلام كامل</button>`:'—'}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-head"><h3>الموردون</h3></div><div class="list">${sup.items.map(s=>`<div class="list-item"><div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.phone||'')} · ${escapeHtml(s.material_types||'')}</small></div><span>${number(s.rating)} ★</span></div>`).join('')}</div></section></div>`;$('#addSupplier').onclick=supplierForm;$('#addPO').onclick=purchaseOrderForm;if(!can('purchases.create')||!can('purchases.approve')||!can('purchases.view_financial'))$('#addPO').hidden=true;if(!can('purchases.receive')||!can('inventory.receive')||!can('purchases.view_financial'))$$('[data-receive-po]').forEach(b=>b.hidden=true);$$('[data-receive-po]').forEach(b=>b.onclick=async()=>{if(!guard('purchases.receive')||!guard('inventory.receive')||!guard('purchases.view_financial'))return;if(!confirm('تأكيد الاستلام الكامل وإضافة الكميات للمخزون؟'))return;try{await api(`/api/purchase-orders/${b.dataset.receivePo}/receive`,{method:'POST'});toast('تم استلام أمر الشراء وإضافة المخزون');await renderPurchases();}catch(err){toast(err.message,'error')}});}
function supplierForm(){if(!guard('suppliers.create'))return;openForm('إضافة مورد',`<form class="form-grid"><label>اسم المورد<input name="name" required></label><label>الجوال<input name="phone"></label><label>البريد<input type="email" name="email"></label><label>الرقم الضريبي<input name="tax_no"></label><label>نوع المواد<input name="material_types"></label><label>التقييم<input type="number" min="0" max="5" step="0.5" name="rating" value="0" placeholder="0 إلى 5"></label><label class="span-2">العنوان والملاحظات<textarea name="address"></textarea></label><button class="btn btn-primary span-2" type="submit">حفظ المورد</button></form>`,async b=>{b.rating=b.rating===''||b.rating==null?0:Number(b.rating);if(!Number.isFinite(b.rating)||b.rating<0||b.rating>5)throw new Error('التقييم يجب أن يكون بين 0 و5');await api('/api/suppliers',{method:'POST',body:b});toast('تم حفظ المورد');await renderPurchases();});}
function purchaseOrderForm(){if(!guard('purchases.create')||!guard('purchases.approve')||!guard('purchases.view_financial'))return;const suppliers=state.cache.suppliers||[],products=state.cache.products||[];openForm('إنشاء أمر شراء',`<form class="form-grid" id="poCreate"><label>المورد<select name="supplier_id" required><option value="">اختر المورد</option>${suppliers.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></label><label>التوريد المتوقع<input type="date" name="expected_at"></label><div class="span-2"><div class="panel-head"><h3>الأصناف</h3><button type="button" class="mini-btn" id="addPOLine">إضافة صنف</button></div><div id="poLines"></div></div><button class="btn btn-primary span-2" type="submit">اعتماد أمر الشراء</button></form>`,async b=>{b.idempotency_key=crypto.randomUUID();b.items=$$('.po-line','#poCreate').map(l=>{const pid=$('[name=product_id]',l).value,p=products.find(x=>x.id===pid);return{product_id:pid,description:p?.name_ar,qty:Number($('[name=qty]',l).value)||0,unit_price:Number($('[name=unit_price]',l).value)||0};}).filter(x=>x.product_id&&x.qty>0);await api('/api/purchase-orders',{method:'POST',body:b});toast('تم إنشاء أمر الشراء');await renderPurchases();});setTimeout(()=>{const add=()=>$('#poLines').insertAdjacentHTML('beforeend',`<div class="po-line form-grid" style="margin-bottom:10px"><label>الصنف<select name="product_id"><option value="">اختر</option>${products.map(p=>`<option value="${p.id}">${escapeHtml(p.name_ar)}</option>`).join('')}</select></label><label>الكمية<input type="number" name="qty" value="1"></label><label>سعر الوحدة<input type="number" step="0.01" name="unit_price"></label></div>`);$('#addPOLine').onclick=add;add();},0);}

async function renderSmart(){const d=await api('/api/smart/suggestions');$('#content').innerHTML=`<div class="grid-2"><section><div class="panel-head"><h3>اقتراحات اليوم</h3></div>${d.suggestions.length?d.suggestions.map(s=>`<article class="smart-card"><span class="eyebrow">${escapeHtml(s.type)}</span><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.message)}</p>${s.items?.length?`<div class="list">${s.items.slice(0,6).map(i=>`<div class="list-item"><span>${escapeHtml(i.name_ar||i.booking_no||'عنصر')}</span><b>${i.stock_qty!==undefined?number(Number(i.stock_qty)-Number(i.reserved_qty)):i.customer_name?escapeHtml(i.customer_name):''}</b></div>`).join('')}</div>`:''}</article>`).join(''):'<div class="panel empty">لا توجد تنبيهات حرجة اليوم.</div>'}</section><section class="panel"><div class="panel-head"><h3>المنتجات الأعلى هامشًا</h3></div><div class="list">${d.highProfit.length?d.highProfit.map(p=>`<div class="list-item"><div><b>${escapeHtml(p.name_ar)}</b><small>بيع ${money(p.sale_price)} · تكلفة ${money(p.average_cost)}</small></div><strong>${money(p.margin)}</strong></div>`).join(''):'<div class="empty">تحتاج صلاحية مالية لعرض هوامش الربح.</div>'}</div><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>قاعدة العروض الذكية</h3><p style="color:var(--muted);line-height:1.8">يقترح النظام العروض، لكنه لا يطبق خصمًا يخفض السعر عن حد الربح المسجل لكل منتج. راجع دائمًا المخزون والحجوزات قبل النشر.</p></section></div>`;}

async function renderReports(){const today=new Date().toISOString().slice(0,10),month=today.slice(0,7)+'-01',financial=can('reports.view_financial');const reportOptions=financial?'<option value="sales">المبيعات</option><option value="bookings">الحجوزات</option><option value="inventory">المخزون</option><option value="purchases">المشتريات</option><option value="expenses">المصروفات</option><option value="equipment_out">المعدات خارج المخزن</option>':'<option value="equipment_out">المعدات خارج المخزن</option>';$('#content').innerHTML=`<section class="panel"><div class="report-filters"><label>نوع التقرير<select id="reportType">${reportOptions}</select></label><label>من<input type="date" id="reportFrom" value="${month}"></label><label>إلى<input type="date" id="reportTo" value="${today}"></label><button class="btn btn-primary" id="runReport">عرض التقرير</button><button class="btn btn-outline" id="exportReport">تصدير Excel/CSV</button><button class="btn btn-outline" id="printReport">طباعة / PDF</button></div></section><div id="reportArea" style="margin-top:18px"></div>`;let last=[];const run=async()=>{const type=$('#reportType').value,from=$('#reportFrom').value,to=$('#reportTo').value,d=await api(`/api/reports?type=${encodeURIComponent(type)}&from=${from}&to=${to}`);last=d.rows;renderReportTable(d.rows,type);};$('#runReport').onclick=run;$('#exportReport').onclick=()=>{if(!guard('reports.export'))return;downloadCsv(last,`wardat-${$('#reportType').value}-${today}.csv`);};$('#printReport').onclick=()=>{if(!guard('reports.print'))return;window.WardatDocuments.open('report',null,{document:{type:'report',title:`تقرير ${$('#reportType').value}`,header:{document_no:`RPT-${today}`,created_at:new Date().toISOString()},items:last,generic:true,show_totals:false}});};await run();}
function renderReportTable(rows,type){if(!rows.length){$('#reportArea').innerHTML='<div class="panel empty">لا توجد بيانات ضمن الفترة المحددة.</div>';return;}const cols=Object.keys(rows[0]);$('#reportArea').innerHTML=`<section class="panel"><div class="panel-head"><h3>تقرير ${escapeHtml(type)} · ${rows.length} سجل</h3><strong>${rows[0].total!==undefined?money(rows.reduce((s,r)=>s+Number(r.total||0),0)):''}</strong></div><div class="table-wrap"><table class="data-table"><thead><tr>${cols.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${typeof r[c]==='number'&&/total|amount|price|cost|profit|vat|discount|value/.test(c)?money(r[c]):escapeHtml(r[c]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;}


function applyPagePermissions(page){
  const rules={
    products:{'#addCategory':'categories.create','#addProduct':'products.create','[data-edit-product]':'products.edit','[data-stock-product]':['inventory.adjust','inventory.issue','inventory.receive']},
    inventory:{'#inventoryAdjust':['inventory.adjust','inventory.issue','inventory.receive']},
    pos:{'#completeSale':'pos.create_sale','#posDiscount':'pos.apply_discount','#posPaid':'pos.partial_payment'},
    orders:{'[data-order-status]':['orders.edit','orders.cancel','orders.return']},
    bookings:{'#addBooking':'bookings.create','[data-booking-status]':['bookings.edit','bookings.approve','bookings.cancel'],'[data-booking-quote]':'quotations.create'},
    quotes:{'#addQuote':'quotations.create','[data-approve-quote]':'quotations.approve'},
    workorders:{'#addWO':'workorders.create','[data-wo-update]':['workorders.edit','workorders.assign','workorders.update_status','workorders.upload_files','workorders.complete']},
    customers:{'#addCustomer':'customers.create'},
    purchases:{'#addSupplier':'suppliers.create'},
    reports:{'#exportReport':'reports.export','#printReport':'reports.print'},
    settings:{'#clearDemo':'settings.clear_demo'},
    users:{'#addUserBtn':'users.create','[data-manage-user]':'users.manage_permissions','[data-toggle-user]':'users.disable'}
  };
  window.PermissionsService.applyDom(rules[page]||{});
}

async function renderUsers(){
  const [{items},{items:roles}]=await Promise.all([api('/api/access/users'),api('/api/access/roles')]);
  state.cache.accessUsers=items;state.cache.accessRoles=roles;
  $('#content').innerHTML=`<div class="toolbar">${can('users.create')?'<button class="btn btn-primary" id="addUserBtn">إضافة مستخدم موظف</button>':''}<input class="search" id="usersSearch" placeholder="ابحث بالاسم أو البريد أو الدور"><div class="kpi-row"><span class="kpi-pill">المستخدمون ${items.length}</span><span class="kpi-pill">النشطون ${items.filter(x=>x.is_active).length}</span></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>نطاق البيانات</th><th>آخر دخول</th><th>إصدار الصلاحيات</th><th>الإجراءات</th></tr></thead><tbody id="usersRows">${userAccessRows(items)}</tbody></table></div>`;
  $('#usersSearch').oninput=e=>{$('#usersRows').innerHTML=userAccessRows(items.filter(x=>`${x.name||''} ${x.email||''} ${x.role_name||''}`.toLowerCase().includes(e.target.value.toLowerCase())));bindUserAccessActions();};
  bindUserAccessActions();
  $('#addUserBtn')?.addEventListener('click',openAddStaffUser);
  applyPagePermissions('users');
}

function openAddStaffUser(){
  if(!guard('users.create'))return;
  const allRoles=state.cache.accessRoles||[];
  const roles=allRoles.filter(r=>r.code!=='customer'&&(state.user?.role_code==='super_admin'||r.code!=='super_admin'));
  if(!roles.length)return toast('لا توجد أدوار موظفين متاحة','error');

  openForm('إضافة مستخدم موظف',`<form class="form-grid" id="addStaffUserForm">
    <label>اسم الموظف<input name="name" required maxlength="120" placeholder="الاسم الكامل"></label>
    <label>البريد الإلكتروني<input type="email" name="email" required autocomplete="off" placeholder="employee@example.com"></label>
    <label>رقم الجوال<input name="phone" inputmode="tel" maxlength="30" placeholder="05xxxxxxxx"></label>
    <label>المسمى الوظيفي<input name="job_title" maxlength="120" placeholder="مثال: منسق ورود"></label>
    <label>الدور<select name="role_code" required>${roles.map(r=>`<option value="${escapeHtml(r.code)}">${escapeHtml(r.name_ar)}</option>`).join('')}</select></label>
    <label>نطاق البيانات<select name="access_scope">
      <option value="assigned">المسند إليه فقط</option>
      <option value="own">السجلات التي أنشأها</option>
      <option value="specific">نطاق محدد</option>
      ${state.user?.role_code==='super_admin'?'<option value="all">جميع البيانات</option>':''}
    </select></label>
    <label>كلمة مرور مؤقتة<input type="password" name="password" minlength="10" required autocomplete="new-password" placeholder="10 أحرف على الأقل"></label>
    <label>تأكيد كلمة المرور<input type="password" name="password_confirm" minlength="10" required autocomplete="new-password"></label>
    <label class="check-label"><input type="checkbox" name="create_employee" checked> إنشاء سجل موظف وربطه بالحساب</label>
    <label class="check-label"><input type="checkbox" name="is_active" checked> تفعيل الحساب مباشرة</label>
    <label class="span-2">سبب إنشاء المستخدم<input name="reason" required maxlength="250" placeholder="مثال: تعيين موظف مبيعات جديد"></label>
    <div class="span-2 demo-note">سيتم إنشاء الحساب داخل Supabase Authentication وربطه بجدول الموظفين. لا تُحفظ كلمة المرور داخل سجل النظام.</div>
    <button class="btn btn-primary span-2" type="submit">إنشاء المستخدم</button>
  </form>`,async b=>{
    if(String(b.password)!==String(b.password_confirm))throw new Error('كلمتا المرور غير متطابقتين');
    if(String(b.password||'').length<10)throw new Error('كلمة المرور يجب ألا تقل عن 10 أحرف');

    const result=await api('/api/access/users',{
      method:'POST',
      body:{
        name:String(b.name||'').trim(),
        email:String(b.email||'').trim().toLowerCase(),
        phone:String(b.phone||'').trim(),
        job_title:String(b.job_title||'').trim(),
        role_code:b.role_code,
        access_scope:b.access_scope,
        password:b.password,
        create_employee:Boolean(b.create_employee),
        is_active:Boolean(b.is_active),
        reason:String(b.reason||'').trim()
      }
    });

    toast(`تم إنشاء المستخدم ${result.email||''}`);
    await renderUsers();
    if(result.user_id&&can('users.manage_permissions'))setTimeout(()=>openPermissionsManager(result.user_id),100);
  });
}

function userAccessRows(items){return items.map(u=>`<tr><td><b>${escapeHtml(u.name||'بدون اسم')}</b><small>${escapeHtml(u.email||'')}</small></td><td>${escapeHtml(u.role_name||u.role_code)}</td><td>${u.is_active?'<span class="status green">نشط</span>':'<span class="status red">موقوف</span>'}</td><td>${escapeHtml(({all:'جميع البيانات',own:'سجلاته فقط',assigned:'المسند إليه',specific:'نطاق محدد'})[u.access_scope]||u.access_scope||'—')}</td><td>${dt(u.last_sign_in_at)}</td><td>${number(u.permissions_version||0)}</td><td class="actions"><button class="mini-btn" data-manage-user="${u.id}">الصلاحيات</button><button class="mini-btn" data-toggle-user="${u.id}" data-active="${u.is_active?'1':'0'}">${u.is_active?'إيقاف':'تفعيل'}</button></td></tr>`).join('');}
function bindUserAccessActions(){
  $$('[data-manage-user]').forEach(b=>b.onclick=()=>openPermissionsManager(b.dataset.manageUser));
  $$('[data-toggle-user]').forEach(b=>b.onclick=async()=>{if(!guard('users.disable'))return;const u=state.cache.accessUsers.find(x=>x.id===b.dataset.toggleUser);if(!u)return;const reason=prompt(`سبب ${u.is_active?'إيقاف':'تفعيل'} المستخدم:`);if(!reason)return;try{await api(`/api/access/users/${u.id}`,{method:'PATCH',body:{role_code:u.role_code,is_active:!u.is_active,access_scope:u.access_scope,reason}});toast('تم تحديث حالة المستخدم');await renderUsers();}catch(err){toast(err.message,'error')}});
}
async function openPermissionsManager(userId){
  if(!guard('users.manage_permissions'))return;
  const matrix=await api(`/api/access/permissions/${userId}`);state.permissionMatrix=matrix;
  const users=state.cache.accessUsers||[];
  const groups=Object.groupBy?Object.groupBy(matrix.permissions,p=>p.module):matrix.permissions.reduce((a,p)=>((a[p.module]??=[]).push(p),a),{});
  const permissionHtml=Object.entries(groups).map(([module,items])=>`<section class="permission-group"><div class="permission-group-head"><h3>${escapeHtml(module)}</h3><div><button type="button" class="mini-btn" data-section-all="${escapeHtml(module)}" data-value="grant">تفعيل القسم</button><button type="button" class="mini-btn" data-section-all="${escapeHtml(module)}" data-value="deny">إلغاء القسم</button></div></div><div class="permission-grid">${items.map(p=>`<label class="permission-row"><span><b>${escapeHtml(p.name_ar)}</b><small>${escapeHtml(p.code)} · ${escapeHtml(p.source_label)}</small></span><select data-permission-code="${escapeHtml(p.code)}" data-initial="${p.user_override===null?'inherit':p.user_override?'grant':'deny'}"><option value="inherit" ${p.user_override===null?'selected':''}>وراثة من الدور</option><option value="grant" ${p.user_override===true?'selected':''}>مسموح للمستخدم</option><option value="deny" ${p.user_override===false?'selected':''}>ممنوع للمستخدم</option></select></label>`).join('')}</div></section>`).join('');
  openForm('إدارة صلاحيات المستخدم',`<form id="permissionManager" class="form-grid"><div class="span-2 user-permission-summary"><div><b>${escapeHtml(matrix.user.name||'')}</b><small>${escapeHtml(matrix.user.email||'')}</small></div><span class="status ${matrix.user.is_active?'green':'red'}">${matrix.user.is_active?'نشط':'موقوف'}</span></div><label>الدور<select name="role_code">${matrix.roles.map(r=>`<option value="${r.code}" ${r.code===matrix.user.role_code?'selected':''}>${escapeHtml(r.name_ar)}</option>`).join('')}</select></label><label>الحالة<select name="is_active"><option value="true" ${matrix.user.is_active?'selected':''}>نشط</option><option value="false" ${!matrix.user.is_active?'selected':''}>موقوف</option></select></label><label>نطاق البيانات<select name="access_scope"><option value="all" ${matrix.user.access_scope==='all'?'selected':''}>جميع البيانات</option><option value="own" ${matrix.user.access_scope==='own'?'selected':''}>السجلات التي أنشأها</option><option value="assigned" ${matrix.user.access_scope==='assigned'?'selected':''}>المسند إليه فقط</option><option value="specific" ${matrix.user.access_scope==='specific'?'selected':''}>نطاق محدد</option></select></label><label>سبب التعديل<input name="reason" required placeholder="اكتب سببًا واضحًا"></label><div class="span-2 permission-tools"><button type="button" class="mini-btn" id="applyRoleTemplate">تطبيق قالب الدور</button><select id="copyFromUser"><option value="">نسخ صلاحيات مستخدم...</option>${users.filter(x=>x.id!==userId).map(u=>`<option value="${u.id}">${escapeHtml(u.name||u.email)}</option>`).join('')}</select><button type="button" class="mini-btn" id="copyPermissions">نسخ</button><button type="button" class="mini-btn" id="diagnosePermissions">فحص الصلاحيات</button>${matrix.can_grant_all?'<button type="button" class="mini-btn" id="grantAllPermissions">تفعيل جميع الصلاحيات</button><button type="button" class="mini-btn" id="revokeAllPermissions">إلغاء جميع الصلاحيات</button>':''}</div><div class="span-2 permissions-scroll">${permissionHtml}</div><button class="btn btn-primary span-2" type="submit">حفظ التغييرات الفعلية</button></form>`,async(b,form)=>{
    const changes=$$('[data-permission-code]',form).map(s=>({permission_code:s.dataset.permissionCode,value:s.value})).filter(x=>{const el=form.querySelector(`[data-permission-code="${CSS.escape(x.permission_code)}"]`);return x.value!==el.dataset.initial;}).map(x=>({permission_code:x.permission_code,granted:x.value==='inherit'?null:x.value==='grant'}));
    const reason=String(b.reason||'').trim();
    await api(`/api/access/users/${userId}`,{method:'PATCH',body:{role_code:b.role_code,is_active:b.is_active==='true',access_scope:b.access_scope,reason}});
    if(changes.length)await api(`/api/access/permissions/${userId}`,{method:'POST',body:{changes,reason}});
    toast(`تم حفظ ${changes.length} تغييرًا وإعادة قراءة الصلاحيات`);await renderUsers();
  });
  setTimeout(()=>bindPermissionManagerActions(userId),0);
}
function bindPermissionManagerActions(userId){
  const form=$('#permissionManager');if(!form)return;
  $$('[data-section-all]',form).forEach(b=>b.onclick=()=>{$$('[data-permission-code]',form).filter(s=>state.permissionMatrix.permissions.find(p=>p.code===s.dataset.permissionCode)?.module===b.dataset.sectionAll).forEach(s=>s.value=b.dataset.value);});
  $('#applyRoleTemplate').onclick=async()=>{const reason=$('[name=reason]',form).value.trim();if(!reason)return toast('اكتب سبب التعديل','error');if(!confirm('سيتم تطبيق قالب الدور ومسح الاستثناءات الخاصة. متابعة؟'))return;await api(`/api/access/role-template/${userId}`,{method:'POST',body:{role_code:$('[name=role_code]',form).value,reason}});toast('تم تطبيق قالب الدور');hide('formModal');await renderUsers();};
  $('#copyPermissions').onclick=async()=>{const source=$('#copyFromUser').value,reason=$('[name=reason]',form).value.trim();if(!source||!reason)return toast('اختر مستخدمًا واكتب السبب','error');await api(`/api/access/copy/${userId}`,{method:'POST',body:{source_user_id:source,reason}});toast('تم نسخ الصلاحيات');hide('formModal');await renderUsers();};
  $('#grantAllPermissions')?.addEventListener('click',async()=>{const reason=$('[name=reason]',form).value.trim();if(!reason)return toast('سبب المنح إلزامي','error');if(!confirm(`سيتم منح ${state.permissionMatrix.permissions.length} صلاحية. متابعة؟`))return;await api(`/api/access/grant-all/${userId}`,{method:'POST',body:{reason}});toast('تم تفعيل جميع الصلاحيات');hide('formModal');await renderUsers();});
  $('#revokeAllPermissions')?.addEventListener('click',async()=>{const reason=$('[name=reason]',form).value.trim();if(!reason)return toast('سبب الإلغاء إلزامي','error');if(!confirm('سيتم منع جميع الصلاحيات الخاصة بهذا المستخدم. متابعة؟'))return;await api(`/api/access/revoke-all/${userId}`,{method:'POST',body:{reason}});toast('تم إلغاء جميع الصلاحيات');hide('formModal');await renderUsers();});
  $('#diagnosePermissions').onclick=async()=>{const d=await api(`/api/access/diagnostics/${userId}`);$('#formModalContent').insertAdjacentHTML('beforeend',`<div class="diagnostic-box"><h3>نتيجة الفحص</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>الصلاحية</th><th>القيمة</th><th>المصدر</th><th>الواجهة</th><th>الخدمة</th><th>RLS</th></tr></thead><tbody>${d.items.map(x=>`<tr><td>${escapeHtml(x.permission_code)}</td><td>${x.effective?'مسموح':'ممنوع'}</td><td>${escapeHtml(x.source)}</td><td>${x.ui_covered?'✓':'—'}</td><td>${x.service_covered?'✓':'—'}</td><td>${x.rls_covered?'✓':'—'}</td></tr>`).join('')}</tbody></table></div>${d.mismatches?`<p class="status red">${d.mismatches} حالات عدم تطابق تحتاج مراجعة</p>`:'<p class="status green">لا يوجد عدم تطابق مكتشف</p>'}</div>`);};
}

async function renderDataQuality(){
  const d=await api('/api/data-quality');const s=d.summary||{};
  const severityLabel={critical:'حرج',warning:'تنبيه',info:'معلومة'};
  $('#content').innerHTML=`<div class="toolbar"><div class="kpi-row"><span class="kpi-pill">آخر فحص ${dt(d.generated_at)}</span><span class="kpi-pill">المشاكل ${number(s.total||0)}</span></div><button class="btn btn-primary" id="refreshQuality">إعادة الفحص</button></div><div class="metrics">${metricHtml('حرجة',number(s.critical||0))}${metricHtml('تنبيهات',number(s.warning||0))}${metricHtml('معلومات',number(s.info||0))}${metricHtml('قابلة للإصلاح التلقائي',number(s.fixable||0))}</div><section class="panel quality-panel"><div class="panel-head"><h3>مشاكل جودة البيانات</h3><small>لا يتم حذف أي سجل تلقائيًا</small></div><div class="quality-list">${d.issues?.length?d.issues.map(i=>`<article class="quality-item ${i.severity}"><div class="quality-icon">${i.severity==='critical'?'!':i.severity==='warning'?'△':'i'}</div><div class="quality-copy"><div><span class="status ${i.severity==='critical'?'red':i.severity==='warning'?'amber':'gray'}">${severityLabel[i.severity]||i.severity}</span><small>${escapeHtml(i.issue_code)}</small></div><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.detail)}</p></div><div class="quality-actions">${i.fixable&&can('data_quality.resolve')?`<button class="mini-btn" data-quality-action="fix" data-code="${i.issue_code}" data-id="${escapeHtml(i.entity_id)}">إصلاح تلقائي</button>`:''}${can('data_quality.resolve')?`<button class="mini-btn" data-quality-action="waive" data-code="${i.issue_code}" data-id="${escapeHtml(i.entity_id)}">تجاهل موثق</button>`:''}<button class="mini-btn" data-open-quality-page="${escapeHtml(i.target_page||'dashboard')}">فتح القسم</button></div></article>`).join(''):'<div class="empty quality-success"><h3>البيانات متطابقة</h3><p>لم يكتشف النظام مشكلة نشطة ضمن قواعد الفحص الحالية.</p></div>'}</div></section>${can('system.health_view')?`<section class="panel" id="systemHealth"><div class="panel-head"><h3>صحة النظام</h3><small>أخطاء الواجهة المجمعة خلال الاستخدام</small></div><div class="list">${d.errors?.length?d.errors.map(e=>`<div class="list-item"><div><b>${escapeHtml(e.message)}</b><small>${escapeHtml(e.context||'')} · آخر ظهور ${dt(e.last_seen_at)}</small></div><span class="status ${Number(e.occurrence_count)>3?'red':'amber'}">${number(e.occurrence_count)} مرة</span></div>`).join(''):'<div class="empty">لا توجد أخطاء غير معالجة.</div>'}</div></section>`:''}`;
  $('#refreshQuality').onclick=renderDataQuality;
  $$('[data-open-quality-page]').forEach(b=>b.onclick=()=>renderPage(b.dataset.openQualityPage));
  $$('[data-quality-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.qualityAction,label=action==='fix'?'الإصلاح التلقائي':'التجاهل الموثق';openForm(label,`<form class="form-grid single"><label>سبب الإجراء<textarea name="reason" required placeholder="اكتب سببًا واضحًا لحماية سجل الرقابة"></textarea></label><button class="btn btn-primary" type="submit">تأكيد</button></form>`,async x=>{await api('/api/data-quality/action',{method:'POST',body:{issue_code:b.dataset.code,entity_id:b.dataset.id,action,reason:x.reason}});toast('تم تنفيذ الإجراء');await renderDataQuality();});});
}

async function renderAudit(){const {items}=await api('/api/audit');$('#content').innerHTML=`<div class="toolbar"><input class="search" id="auditSearch" placeholder="المستخدم أو العملية أو القسم"><span class="kpi-pill">آخر ${items.length} عملية</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>المستخدم</th><th>العملية</th><th>القسم</th><th>المعرف</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody id="auditRows">${auditRows(items)}</tbody></table></div>`;$('#auditSearch').oninput=e=>$('#auditRows').innerHTML=auditRows(items.filter(x=>`${x.user_name} ${x.action} ${x.entity}`.toLowerCase().includes(e.target.value.toLowerCase())));}
function auditRows(items){return items.map(a=>`<tr><td>${escapeHtml(a.user_name||'النظام')}</td><td><b>${escapeHtml(a.action)}</b></td><td>${escapeHtml(a.entity)}</td><td>${escapeHtml(a.entity_id||'—')}</td><td>${escapeHtml(a.reason||'—')}</td><td>${dt(a.created_at)}</td></tr>`).join('');}

async function renderSettings(){const s=await api('/api/settings/financial');$('#content').innerHTML=`<div class="grid-2"><section class="panel"><div class="panel-head"><h3>الحسابات التلقائية</h3></div><form class="form-grid" id="financialSettingsForm"><label>نسبة الضريبة %<input type="number" step="0.01" min="0" max="100" name="vat_percent" value="${Number(s.tax_rate||0)*100}"></label><label>طريقة إدخال السعر الافتراضية<select name="default_price_mode"><option value="exclusive" ${s.default_price_mode==='exclusive'?'selected':''}>غير شامل الضريبة</option><option value="inclusive" ${s.default_price_mode==='inclusive'?'selected':''}>شامل الضريبة</option><option value="exempt" ${s.default_price_mode==='exempt'?'selected':''}>معفى</option></select></label><label>الحد الأدنى لهامش الربح %<input type="number" step="0.01" name="minimum_profit_percent" value="${s.minimum_profit_percent||0}"></label><label><input type="checkbox" name="delivery_taxable" ${s.delivery_taxable?'checked':''}> التوصيل خاضع للضريبة</label><label><input type="checkbox" name="extras_taxable" ${s.extras_taxable?'checked':''}> الإضافات خاضعة للضريبة</label><button class="btn btn-primary span-2" type="submit">حفظ الإعدادات المالية</button></form></section><section class="panel"><div class="panel-head"><h3>هوية الطباعة</h3></div><form class="form-grid" id="printSettingsForm"><label>الجوال<input name="business_phone" value="${escapeHtml(s.business_phone||'')}"></label><label>البريد<input type="email" name="business_email" value="${escapeHtml(s.business_email||'')}"></label><label>الرقم الضريبي<input name="business_tax_no" value="${escapeHtml(s.business_tax_no||'')}"></label><label>السجل التجاري<input name="commercial_register" value="${escapeHtml(s.commercial_register||'')}"></label><label class="span-2">العنوان<input name="business_address" value="${escapeHtml(s.business_address||'')}"></label><label>رقم واتساب<input name="whatsapp" value="${escapeHtml(s.whatsapp||'')}"></label><button class="btn btn-primary span-2" type="submit">حفظ هوية الطباعة</button></form></section></div><section class="panel" style="margin-top:18px"><h3>بيانات التجربة</h3><button class="btn btn-danger" id="clearDemo">حذف البيانات التجريبية</button></section>`;const save=async form=>{if(!guard('settings.manage'))return;const b=formDataObj(form);if(b.vat_percent!==undefined){b.vat_rate=(Number(b.vat_percent)||0)/100;delete b.vat_percent;}await api('/api/settings/financial',{method:'POST',body:b});await window.WardatFinancial.load();await window.WardatDocuments.loadSettings();toast('تم حفظ الإعدادات');};$('#financialSettingsForm').onsubmit=e=>{e.preventDefault();save(e.target)};$('#printSettingsForm').onsubmit=e=>{e.preventDefault();save(e.target)};$('#clearDemo').onclick=async()=>{if(!guard('settings.clear_demo'))return;if(!confirm('سيتم حذف كل السجلات التجريبية فقط. هل أنت متأكد؟'))return;await api('/api/settings/clear-demo',{method:'POST'});toast('تم حذف البيانات التجريبية');};}
async function renderNotifications(){try{const {items}=await api('/api/notifications');openForm('الإشعارات',`<div class="list">${items.length?items.map(n=>`<div class="list-item"><div><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.message)} · ${dt(n.created_at)}</small></div>${n.status==='unread'?'<span class="status amber">جديد</span>':'<span class="status gray">مقروء</span>'}</div>`).join(''):'<div class="empty">لا توجد إشعارات</div>'}</div><button class="btn btn-outline wide" id="markRead" style="margin-top:15px">تعليم الكل كمقروء</button>`,async()=>{});setTimeout(()=>{$('#markRead').onclick=async()=>{await api('/api/notifications/read',{method:'POST',body:{}});hide('formModal');loadNotificationCount();};},0);}catch(err){toast(err.message,'error')}}
async function loadNotificationCount(){if(!$('#notificationCount')||!can('notifications.view'))return;try{const {items}=await api('/api/notifications');$('#notificationCount').textContent=items.filter(x=>x.status==='unread').length;}catch{}}

window.addEventListener('wardat:permissions-changed',async()=>{try{state.user=(await api('/api/auth/me')).user;if(!state.user)return logout();const correctPortal=portalForRole(state.user.role_code);if(correctPortal!==PORTAL_MODE){window.location.replace(portalUrl(correctPortal));return;}renderNav();const meta=availablePages().find(p=>p.id===state.currentPage);if(!meta||!can(meta.permission)){const first=availablePages()[0];if(first)await renderPage(first.id);else if($('#content'))$('#content').innerHTML='<div class="empty">تم إلغاء صلاحيات القسم المفتوح.</div>';}else await renderPage(state.currentPage,true);toast('تم تحديث صلاحياتك تلقائيًا');}catch{}});
window.addEventListener('wardat:user-disabled',()=>{state.user=null;if(PORTAL_MODE==='customer')showStore();else showPortalLogin('تم إيقاف الحساب. راجع الإدارة.');toast('تم إيقاف الحساب وإنهاء الوصول','error');});
init();
