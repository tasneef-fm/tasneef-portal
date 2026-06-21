/* ===== Tasneef V10189 - Attendance can be saved before login =====
   Root behavior:
   - تحضير اليوم لا يعتمد على تسجيل دخول المستخدم.
   - يتم تثبيت المشروع والمشرف وقت الحفظ من الكرت/المشروع/بيانات العامل.
   - لا يتم نقل أيام العامل القديمة عند نقله لمشروع أو مشرف آخر.
*/
(function(){
  'use strict';
  if(window.__tasneefAttendanceBeforeLoginV10189) return;
  window.__tasneefAttendanceBeforeLoginV10189 = true;
  const BUILD='V10189_ATTENDANCE_BEFORE_LOGIN_HISTORICAL_SAVE';
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const todayStr = () => (typeof today === 'function' ? today() : new Date().toISOString().slice(0,10));
  const D = () => window.data || {workers:[],projects:[],attendance:[],users:[],supervisors:[]};
  const norm = v => S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').trim();
  const msg2 = (t,type) => { try{ if(typeof msg==='function') return msg(t,type); }catch(_){} try{ if(typeof message==='function') return message(t,type); }catch(_){} alert(t); };

  function workerById(id){ return A(D().workers).find(w => S(w.id) === S(id)) || {}; }
  function projectById(id){ return A(D().projects).find(p => S(p.id) === S(id)) || {}; }
  function firstValue(obj, keys){ for(const k of keys){ if(obj && obj[k] !== undefined && obj[k] !== null && S(obj[k]) !== '') return obj[k]; } return ''; }
  function workerProjectId(w){ return firstValue(w, ['project_id','assigned_project_id','current_project_id','main_project_id','project']); }
  function workerSupervisorId(w){ return firstValue(w, ['supervisor_id','app_supervisor_id','assigned_supervisor_id','current_supervisor_id','supervisor']); }
  function projectSupervisorId(pid){ const p=projectById(pid); return firstValue(p, ['supervisor_id','app_supervisor_id','assigned_supervisor_id','manager_id']); }
  function currentUserSafe(){ try{ return (typeof session==='function' && session()) || (typeof currentUser==='function' && currentUser()) || {}; }catch(_){ return {}; } }
  function cardProjectId(card, worker){
    const selected = $('attendanceProject')?.value || '';
    if(selected) return selected;
    const fromCard = card?.dataset?.project || card?.querySelector('select[data-project]')?.dataset?.project || '';
    return fromCard || workerProjectId(worker) || '';
  }
  function cardWorkerId(card){
    const sel = card?.querySelector('select[data-worker]') || card?.querySelector('select.att-status-v343') || card?.querySelector('select');
    return sel?.dataset?.worker || card?.dataset?.worker || '';
  }
  function cardStatus(card){
    const sel = card?.querySelector('select[data-worker]') || card?.querySelector('select.att-status-v343') || card?.querySelector('select');
    return sel?.value || 'present';
  }
  function cardNote(card){
    return card?.querySelector('input.att-v343-note, input.att-note, input[type="text"]')?.value || '';
  }
  function collectAttendanceCards(){
    let cards = [...document.querySelectorAll('#supervisorAttendanceList .att-v343-card, #supervisorAttendanceList [data-worker]')];
    if(!cards.length){
      cards = [...document.querySelectorAll('#supervisorAttendanceList select[data-worker]')].map(s => s.closest('.att-v343-card') || s.parentElement).filter(Boolean);
    }
    const seen = new Set();
    return cards.filter(c => {
      const wid = cardWorkerId(c);
      if(!wid || seen.has(S(wid))) return false;
      seen.add(S(wid));
      return true;
    });
  }
  async function upsertAttendanceRow(row){
    const base = window.sb || window.supabaseClient || window.supabase;
    if(!base || !base.from) throw new Error('الاتصال بقاعدة البيانات غير جاهز');
    const q = await base.from('attendance').select('id').eq('attendance_date', row.attendance_date).eq('worker_id', row.worker_id).limit(1);
    if(q.error) throw q.error;
    if(q.data && q.data.length){
      const r = await base.from('attendance').update(row).eq('id', q.data[0].id);
      if(r.error) throw r.error;
      return r;
    }
    const r = await base.from('attendance').insert([row]);
    if(r.error) throw r.error;
    return r;
  }

  window.saveSupervisorAttendance = async function(){
    const u = currentUserSafe();
    const uid = N(u.id);
    const date = $('attendanceDate')?.value || todayStr();
    const shift = $('attendanceShiftType')?.value || $('attendancePeriod')?.value || 'زيارة يومية';
    const cards = collectAttendanceCards();
    if(!cards.length) return msg2('لا توجد أسماء ظاهرة للتحضير', 'err');

    let ok=0, fail=0, last='';
    for(const card of cards){
      const workerId = N(cardWorkerId(card));
      if(!workerId) continue;
      const worker = workerById(workerId);
      const projectIdRaw = cardProjectId(card, worker);
      const projectId = N(projectIdRaw) || projectIdRaw || null;
      const supervisorIdRaw = uid || workerSupervisorId(worker) || projectSupervisorId(projectIdRaw) || firstValue(worker, ['supervisor_name']);
      const supervisorId = N(supervisorIdRaw) || supervisorIdRaw || null;
      const note = S(cardNote(card));
      const row = {
        attendance_date: date,
        worker_id: workerId,
        supervisor_id: supervisorId,
        project_id: projectId,
        status: cardStatus(card),
        notes: `الفترة: ${shift}${note ? ' | ' + note : ''}`,
        created_by: uid
      };
      try{
        await upsertAttendanceRow(row);
        ok++;
      }catch(e){
        fail++;
        last = e?.message || String(e);
        console.error('V10189 attendance save failed', row, e);
      }
    }
    if(fail) return msg2(`تم حفظ ${ok} اسم وفشل ${fail}: ${last}`, 'err');
    msg2(`تم حفظ تحضير اليوم لعدد ${ok} اسم بدون الحاجة لتسجيل الدخول`);
    try{ if(typeof loadAll==='function') await loadAll(); }catch(_){ }
    try{ if(typeof window.renderSupervisorAttendanceList==='function') window.renderSupervisorAttendanceList(); }catch(_){ }
    try{ if(typeof window.renderAttendance==='function') window.renderAttendance(); }catch(_){ }
    try{ if(typeof window.renderAttendanceMonthly==='function') window.renderAttendanceMonthly(); }catch(_){ }
  };

  try{ window.TASNEEF_ATTENDANCE_BUILD = BUILD; }catch(_){ }
  console.log('Tasneef '+BUILD+' loaded');
})();
