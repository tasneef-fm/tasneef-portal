/* TASNEEF V10871 — one-time repair for Rose Al Narjis + Makeen 52 supervisor binding */
(function(){
  'use strict';
  if(window.__tasneefFahdTargetBindingV10871)return;
  window.__tasneefFahdTargetBindingV10871=true;
  const BUILD='V10871_FAHD_TARGET_PROJECT_BINDING';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const arabicDigits=s=>S(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const norm=v=>arabicDigits(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const compact=v=>norm(v).replace(/\s+/g,'');
  const targetKeys=new Set(['روزالنرجس','مكين52']);
  const projectName=p=>S(p?.name||p?.project_name||p?.title);
  const isTarget=p=>targetKeys.has(compact(projectName(p)));
  const isFahdText=v=>{const n=norm(v);return n==='فهد'||n.startsWith('فهد ')||n==='fahd'||n.startsWith('fahd ');};
  const monthNow=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date()).replace(/\//g,'-');}catch(_){return new Date().toISOString().slice(0,7);}};
  const roleIsSupervisor=u=>{const r=norm(u?.role_key||u?.role||u?.job_title);return r.includes('supervisor')||r.includes('مشرف');};
  const userName=u=>S(u?.full_name||u?.name||u?.display_name||u?.username);
  const userCode=u=>S(u?.employee_code||u?.worker_code||u?.code||u?.emp_code||u?.supervisor_employee_code);
  async function safe(q,label){try{const r=await q;if(r?.error){console.warn(BUILD,label,r.error);return [];}return A(r?.data);}catch(e){console.warn(BUILD,label,e);return [];}}
  function pickFahd(users,employees,targets){
    const refCodes=new Set(),refNames=new Set(),refIds=new Set();
    targets.forEach(p=>{
      [p?.supervisor_employee_code,p?.supervisor_code,p?.current_supervisor_code].map(norm).filter(Boolean).forEach(x=>refCodes.add(x));
      [p?.supervisor_name,p?.manager_name,p?.current_supervisor_name].map(norm).filter(Boolean).forEach(x=>refNames.add(x));
      [p?.supervisor_id,p?.current_supervisor_id,p?.app_supervisor_id].map(S).filter(Boolean).forEach(x=>refIds.add(x));
    });
    const empFahd=A(employees).filter(e=>roleIsSupervisor(e)&&isFahdText(e?.app_name||e?.employee_name||e?.name||e?.iqama_name));
    empFahd.forEach(e=>{const c=norm(e?.employee_code||e?.code);if(c)refCodes.add(c);const n=norm(e?.app_name||e?.employee_name||e?.name||e?.iqama_name);if(n)refNames.add(n);});
    const scored=A(users).map(u=>{
      let score=0;const id=S(u?.id),code=norm(userCode(u)),name=norm(userName(u)),username=norm(u?.username);
      if(refIds.has(id))score+=120;
      if(code&&refCodes.has(code))score+=110;
      if(name&&refNames.has(name))score+=90;
      if(isFahdText(name))score+=55;
      if(isFahdText(username))score+=45;
      if(roleIsSupervisor(u))score+=25;
      if(u?.is_active===false||['inactive','suspended','disabled'].includes(norm(u?.status)))score-=80;
      return {u,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!scored.length)return null;
    const top=scored[0];
    // لا نختار مستخدمًا غير مشرف اعتمادًا على الاسم فقط.
    if(!roleIsSupervisor(top.u) && top.score<100)return null;
    if(scored[1]&&scored[1].score===top.score&&S(scored[1].u?.id)!==S(top.u?.id))return null;
    return top.u;
  }
  async function repair(){
    if(!window.sb?.from)return false;
    const projects=await safe(window.sb.from('projects').select('*').order('id').limit(10000),'projects');
    const targets=projects.filter(isTarget);
    if(!targets.length){console.warn(BUILD,'target projects not found');return false;}
    const [users,employees]=await Promise.all([
      safe(window.sb.from('app_users').select('*').limit(5000),'app_users'),
      safe(window.sb.from('employees_master_v386').select('*').limit(5000),'employees_master_v386')
    ]);
    const fahd=pickFahd(users,employees,targets);
    if(!fahd||!S(fahd.id)){console.warn(BUILD,'Fahd app user could not be resolved safely');return false;}
    let code=userCode(fahd),name=userName(fahd);
    const emp=A(employees).find(e=>isFahdText(e?.app_name||e?.employee_name||e?.name||e?.iqama_name) && (!code||norm(e?.employee_code||e?.code)===norm(code)));
    if(!code&&emp)code=S(emp?.employee_code||emp?.code);
    if(!name&&emp)name=S(emp?.app_name||emp?.employee_name||emp?.name||emp?.iqama_name);
    if(!name)name='فهد';
    const now=new Date().toISOString(),month=monthNow();let changed=0;
    for(const p of targets){
      const currentId=S(p?.supervisor_id||p?.current_supervisor_id||p?.app_supervisor_id);
      const projectSaysFahd=isFahdText(p?.supervisor_name||p?.manager_name) || (!!code&&norm(p?.supervisor_employee_code||p?.supervisor_code)===norm(code));
      // V10871 مخصص للإصلاح: نصلح الربط الفارغ/القديم أو الربط الذي يحمل اسم/كود فهد.
      // إذا نُقل المشروع مستقبلًا لمشرف آخر مع معرف صحيح واسم مختلف، لا نعيده قسرًا إلى فهد.
      if(currentId&&currentId!==S(fahd.id)&&!projectSaysFahd)continue;
      if(currentId===S(fahd.id)&&norm(p?.supervisor_employee_code)===norm(code)&&norm(p?.supervisor_name)===norm(name))continue;
      const payload={supervisor_id:fahd.id,current_supervisor_id:fahd.id,app_supervisor_id:fahd.id,supervisor_employee_code:code||null,supervisor_name:name,updated_at:now};
      const r=await window.sb.from('projects').update(payload).eq('id',p.id).select('id,name,supervisor_id,supervisor_employee_code,supervisor_name');
      if(r?.error){console.warn(BUILD,'project update',p.id,r.error);continue;}
      changed++;
      try{await window.sb.from('monthly_distribution').update({supervisor_id:fahd.id,supervisor_employee_code:code||null,supervisor_name:name,updated_at:now}).eq('month_key',month).eq('project_id',p.id);}catch(_){}
      try{await window.sb.from('project_monthly_settings_v387').update({supervisor_id:fahd.id,supervisor_name:name,updated_at:now}).eq('month_key',month).eq('project_id',p.id);}catch(_){}
    }
    if(changed){
      console.log(BUILD,'repaired',changed,'project(s) for',name,'id=',fahd.id);
      try{window.dispatchEvent(new CustomEvent('tasneef:project-updated',{detail:{source:'v10871-fahd-binding',supervisorId:fahd.id}}));}catch(_){}
      try{if(typeof window.msg==='function')window.msg('تم تثبيت ربط روز النرجس ومكين 52 بحساب فهد.','ok');}catch(_){}
      try{if(window.tasneefProjectsCleanV390?.refreshAll)await window.tasneefProjectsCleanV390.refreshAll();}catch(_){}
    }
    return true;
  }
  function boot(attempt=0){
    if(window.sb?.from){repair().catch(e=>console.warn(BUILD,e));return;}
    if(attempt<20)setTimeout(()=>boot(attempt+1),250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot());else boot();
  window.tasneefRepairFahdProjectsV10871=repair;
})();
