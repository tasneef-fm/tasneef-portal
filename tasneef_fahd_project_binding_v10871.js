/* TASNEEF V10872 — schema-safe direct repair: Rose Al Narjis + Makeen 52 -> Fahd */
(function(){
  'use strict';
  if(window.__tasneefFahdTargetBindingV10872)return;
  window.__tasneefFahdTargetBindingV10872=true;
  const BUILD='V10872_FAHD_SCHEMA_SAFE_DIRECT_BINDING';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const compact=v=>norm(v).replace(/\s+/g,'');
  const targetKeys=new Set(['روزالنرجس','مكين52']);
  const pname=p=>S(p?.name||p?.project_name||p?.title);
  const isTarget=p=>targetKeys.has(compact(pname(p)));
  const isFahd=v=>{const n=norm(v),parts=n.split(' ');return parts.includes('فهد')||parts.includes('fahd');};
  const roleSup=u=>{const r=norm(u?.role_key||u?.role||u?.job_title);return r==='supervisor'||r.includes('مشرف');};
  const uname=u=>S(u?.full_name||u?.name||u?.display_name||u?.username);
  const ucode=u=>S(u?.employee_code||u?.worker_code||u?.code||u?.emp_code||u?.supervisor_employee_code);
  const monthNow=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date()).replace(/\//g,'-');}catch(_){return new Date().toISOString().slice(0,7);}};
  async function rows(q,label){try{const r=await q;if(r?.error){console.warn(BUILD,label,r.error);return [];}return A(r?.data);}catch(e){console.warn(BUILD,label,e);return [];}}
  function pickFahd(users){
    const exact=A(users).filter(u=>roleSup(u)&&isFahd(uname(u))&&u?.is_active!==false);
    if(exact.length===1)return exact[0];
    const byUser=A(users).filter(u=>roleSup(u)&&isFahd(u?.username)&&u?.is_active!==false);
    if(byUser.length===1)return byUser[0];
    return exact[0]||byUser[0]||null;
  }
  async function optionalProjectField(pid,payload){try{const r=await window.sb.from('projects').update(payload).eq('id',pid);if(r?.error)console.info(BUILD,'optional project field skipped',Object.keys(payload)[0]);}catch(_){}}
  async function repair(){
    if(!window.sb?.from)return false;
    const [projects,users]=await Promise.all([
      rows(window.sb.from('projects').select('*').order('id').limit(10000),'projects'),
      rows(window.sb.from('app_users').select('*').limit(5000),'app_users')
    ]);
    const targets=projects.filter(isTarget),fahd=pickFahd(users);
    if(!targets.length){console.warn(BUILD,'target projects not found',projects.map(p=>pname(p)).filter(Boolean));return false;}
    if(!fahd||!S(fahd.id)){console.warn(BUILD,'Fahd app user not resolved');return false;}
    const fid=fahd.id,code=ucode(fahd),name=uname(fahd)||'فهد',month=monthNow();
    let ok=0;
    for(const p of targets){
      // Critical write: one confirmed column only. No optional column can make this update fail.
      const r=await window.sb.from('projects').update({supervisor_id:fid}).eq('id',p.id).select('id,name,supervisor_id');
      if(r?.error){console.error(BUILD,'CRITICAL project supervisor_id update failed',p.id,pname(p),r.error);continue;}
      ok++;
      if(code)await optionalProjectField(p.id,{supervisor_employee_code:code});
      await optionalProjectField(p.id,{supervisor_name:name});
      // Keep current distribution consistent. Each field is written separately so an old schema cannot cancel all writes.
      try{await window.sb.from('monthly_distribution').update({supervisor_id:fid}).eq('month_key',month).eq('project_id',p.id).neq('status','ended');}catch(_){}
      if(code)try{await window.sb.from('monthly_distribution').update({supervisor_employee_code:code}).eq('month_key',month).eq('project_id',p.id).neq('status','ended');}catch(_){}
      try{await window.sb.from('monthly_distribution').update({supervisor_name:name}).eq('month_key',month).eq('project_id',p.id).neq('status','ended');}catch(_){}
    }
    if(ok){
      try{window.ProjectsService?.clearUserCache?.(fid);}catch(_){}
      try{window.dispatchEvent(new CustomEvent('tasneef:project-updated',{detail:{source:BUILD,supervisorId:fid,projectIds:targets.map(x=>x.id)}}));}catch(_){}
      try{if(typeof window.msg==='function')window.msg('تم تثبيت روز النرجس ومكين 52 مباشرة على حساب فهد.','ok');}catch(_){}
      console.log(BUILD,'fixed',ok,'project(s), Fahd id=',fid);
    }
    return ok===targets.length;
  }
  function boot(n=0){if(window.sb?.from){repair().catch(e=>console.error(BUILD,e));return;}if(n<30)setTimeout(()=>boot(n+1),250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot());else boot();
  window.tasneefRepairFahdProjectsV10872=repair;
})();
