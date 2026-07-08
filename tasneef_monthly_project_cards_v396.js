/* V396 - ربط تقرير الأوقات الشهرية بملف المدة المستغرقة ومعادلات الشهر بدون تصفير */
(function(){
  'use strict';
  window.__tasneefMonthlyV396 = true;
  const VERSION='396';
  const DATA = [{"month":"2026-06","projectName":"برج جوديا مساء","projectType":"زيارة يومية","supervisorCodes":["TS-14","TS-11"],"workerCodes":["TS-12","TS-13","TS-15","TS-16"],"totalMinutes":14322,"hoursText":"238 ساعة و 42 دقيقة","sourceRow":1,"projectId":"june-2026-001","supervisorName":"TS-14 + TS-11 - صالح","workers":["TS-12 - بتشا","TS-13 - علم","TS-15 - ابراهيم","TS-16 - فلومية"],"requiredMinutes":0,"percentage":100.0,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"اتحاد العاصمة","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":3003,"hoursText":"50 ساعة و 3 دقيقة","sourceRow":2,"projectId":"june-2026-002","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":27.2,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"أثل 12","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":3612,"hoursText":"60 ساعة و 12 دقيقة","sourceRow":3,"projectId":"june-2026-003","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":32.7,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"الين 32","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":1773,"hoursText":"29 ساعة و 33 دقيقة","sourceRow":4,"projectId":"june-2026-004","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":16.0,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"جادة 39","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":444,"hoursText":"7 ساعة و 24 دقيقة","sourceRow":5,"projectId":"june-2026-005","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":4.0,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"فرساي 10","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":877,"hoursText":"14 ساعة و 37 دقيقة","sourceRow":6,"projectId":"june-2026-006","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":7.9,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"فرساي 11","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":613,"hoursText":"10 ساعة و 13 دقيقة","sourceRow":7,"projectId":"june-2026-007","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":5.5,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"فرساي 4","projectType":"زيارة يومية","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"totalMinutes":733,"hoursText":"12 ساعة و 13 دقيقة","sourceRow":8,"projectId":"june-2026-008","supervisorName":"TS-06 - حسن","workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"requiredMinutes":0,"percentage":6.6,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"آفاق العربية","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":2103,"hoursText":"35 ساعة و 3 دقيقة","sourceRow":9,"projectId":"june-2026-009","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":16.7,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"تعمير 17","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":2240,"hoursText":"37 ساعة و 20 دقيقة","sourceRow":10,"projectId":"june-2026-010","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":17.7,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"رؤيا 1","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":999,"hoursText":"16 ساعة و 39 دقيقة","sourceRow":11,"projectId":"june-2026-011","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":7.9,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"رايات نجد 5","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":919,"hoursText":"15 ساعة و 19 دقيقة","sourceRow":12,"projectId":"june-2026-012","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":7.3,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"عالم الابتكار 47","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":2367,"hoursText":"39 ساعة و 27 دقيقة","sourceRow":13,"projectId":"june-2026-013","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":18.7,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"فارهين 11","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":733,"hoursText":"12 ساعة و 13 دقيقة","sourceRow":14,"projectId":"june-2026-014","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":5.8,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"فرساي 7","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":1418,"hoursText":"23 ساعة و 38 دقيقة","sourceRow":15,"projectId":"june-2026-015","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":11.2,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"مغنى 29","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":1141,"hoursText":"19 ساعة و 1 دقيقة","sourceRow":16,"projectId":"june-2026-016","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":9.0,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"هاجر 32","projectType":"زيارة يومية","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"totalMinutes":709,"hoursText":"11 ساعة و 49 دقيقة","sourceRow":17,"projectId":"june-2026-017","supervisorName":"TS-01 - فهد","workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"requiredMinutes":0,"percentage":5.6,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"وجود الياسمين","projectType":"دوام كامل","supervisorCodes":["TS-17"],"workerCodes":["TS-18","TS-19","TS-20","TS-21","TS-22","TS-23","TS-24","TS-25","TS-26"],"totalMinutes":16183,"hoursText":"269 ساعة و 43 دقيقة","sourceRow":18,"projectId":"june-2026-018","supervisorName":"TS-17 - مازن الخطيب","workers":["TS-18 - اشرف","TS-19 - الونجير","TS-20 - أنور","TS-21 - تيفور","TS-22 - جابيت","TS-23 - رشيد","TS-24 - شميم","TS-25 - ناظمون","TS-26 - هلال"],"requiredMinutes":15240,"percentage":106.2,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"الرمز 17 A","projectType":"دوام كامل","supervisorCodes":["TS-27"],"workerCodes":["TS-28","TS-29","TS-30"],"totalMinutes":16139,"hoursText":"268 ساعة و 59 دقيقة","sourceRow":19,"projectId":"june-2026-019","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-28 - ديكسان","TS-29 - ميزان","TS-30 - محمد  ياسر"],"requiredMinutes":14640,"percentage":110.2,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"العجلان ريفيرا 19","projectType":"دوام كامل","supervisorCodes":["TS-27"],"workerCodes":["TS-31","TS-33"],"totalMinutes":15655,"hoursText":"260 ساعة و 55 دقيقة","sourceRow":20,"projectId":"june-2026-020","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-31 - رؤوف","TS-33 - اوميت"],"requiredMinutes":14120,"percentage":110.9,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"الماجدية 107","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":4774,"hoursText":"79 ساعة و 34 دقيقة","sourceRow":21,"projectId":"june-2026-021","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":41.2,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"الماجدية 88","projectType":"دوام كامل","supervisorCodes":["TS-27"],"workerCodes":["TS-36","TS-37"],"totalMinutes":9462,"hoursText":"157 ساعة و 42 دقيقة","sourceRow":22,"projectId":"june-2026-022","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-36 - رقيب","TS-37 - عجائب"],"requiredMinutes":14200,"percentage":66.6,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"صفاء 50","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":2788,"hoursText":"46 ساعة و 28 دقيقة","sourceRow":23,"projectId":"june-2026-023","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":24.1,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"كاف A","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":1144,"hoursText":"19 ساعة و 4 دقيقة","sourceRow":24,"projectId":"june-2026-024","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":9.9,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"كاف B","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":724,"hoursText":"12 ساعة و 4 دقيقة","sourceRow":25,"projectId":"june-2026-025","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":6.2,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"كاف c","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":887,"hoursText":"14 ساعة و 47 دقيقة","sourceRow":26,"projectId":"june-2026-026","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":7.7,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"مغنى 14","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":682,"hoursText":"11 ساعة و 22 دقيقة","sourceRow":27,"projectId":"june-2026-027","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":5.9,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"واجهة قرطبة","projectType":"زيارة يومية","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"totalMinutes":591,"hoursText":"9 ساعة و 51 دقيقة","sourceRow":28,"projectId":"june-2026-028","supervisorName":"TS-27 - محمد إبراهيم","workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"requiredMinutes":0,"percentage":5.1,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"جمال الأندلس","projectType":"زيارة يومية","supervisorCodes":["TS-39"],"workerCodes":["TS-40","TS-44"],"totalMinutes":1734,"hoursText":"28 ساعة و 54 دقيقة","sourceRow":29,"projectId":"june-2026-029","supervisorName":"TS-39 - محمد عبده","workers":["TS-40 - راسيل","TS-44 - مهيب"],"requiredMinutes":0,"percentage":100.0,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"صفاء 28","projectType":"دوام كامل","supervisorCodes":["TS-39"],"workerCodes":["TS-43","TS-42","TS-40","TS-41"],"totalMinutes":14594,"hoursText":"243 ساعة و 14 دقيقة","sourceRow":30,"projectId":"june-2026-030","supervisorName":"TS-39 - محمد عبده","workers":["TS-43 - عريف","TS-42 - ديلوا","TS-40 - راسيل","TS-41 - اكرامول"],"requiredMinutes":14280,"percentage":102.2,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"صفاء 65","projectType":"دوام كامل","supervisorCodes":["TS-39"],"workerCodes":["TS-44","TS-45","TS-46"],"totalMinutes":17789,"hoursText":"296 ساعة و 29 دقيقة","sourceRow":31,"projectId":"june-2026-031","supervisorName":"TS-39 - محمد عبده","workers":["TS-44 - مهيب","TS-45 - ليتون","TS-46 - همينتو"],"requiredMinutes":18960,"percentage":93.8,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"الشعلان 50","projectType":"زيارة يومية","supervisorCodes":["TS-47"],"workerCodes":["TS-48","TS-49"],"totalMinutes":13670,"hoursText":"227 ساعة و 50 دقيقة","sourceRow":32,"projectId":"june-2026-032","supervisorName":"TS-47 - محمود","workers":["TS-48 - راجو","TS-49 - اجارول"],"requiredMinutes":0,"percentage":50.5,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"الشعلان 51","projectType":"زيارة يومية","supervisorCodes":["TS-47"],"workerCodes":["TS-48","TS-49"],"totalMinutes":13409,"hoursText":"223 ساعة و 29 دقيقة","sourceRow":33,"projectId":"june-2026-033","supervisorName":"TS-47 - محمود","workers":["TS-48 - راجو","TS-49 - اجارول"],"requiredMinutes":0,"percentage":49.5,"calcNote":"زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر"},{"month":"2026-06","projectName":"العجلان 30","projectType":"دوام كامل","supervisorCodes":["TS-47"],"workerCodes":["TS-50","TS-51","TS-52","TS-53","TS-54","TS-55"],"totalMinutes":6120,"hoursText":"102 ساعة","sourceRow":34,"projectId":"june-2026-034","supervisorName":"TS-47 - محمود","workers":["TS-50 - ثابت","TS-51 - شانتو","TS-52 - عبد السلام","TS-53 - مساد","TS-54 - مختار","TS-55 - ميزان 2"],"requiredMinutes":5580,"percentage":109.7,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"},{"month":"2026-06","projectName":"مكين 37","projectType":"دوام كامل","supervisorCodes":["TS-47"],"workerCodes":["TS-56","TS-57","TS-58","TS-59"],"totalMinutes":15715,"hoursText":"261 ساعة و 55 دقيقة","sourceRow":35,"projectId":"june-2026-035","supervisorName":"TS-47 - محمود","workers":["TS-56 - اكتار","TS-57 - جهيد","TS-58 - جوناب علي","TS-59 - ركيب"],"requiredMinutes":14400,"percentage":109.1,"calcNote":"دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه"}];
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const monthVal=()=>($('mt52Month')?.value||$('ms391Month')?.value||'2026-06');
  const arMins=m=>{m=Math.round(Number(m)||0); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=v=>{const n=Number(v)||0; return (Math.round(n*10)/10).toString().replace(/\.0$/,'')+'%';};
  const isFull=r=>S(r.projectType)==='دوام كامل';
  const byProjectKey=r=>norm(r.projectName||r.project);

  function monthRows(){
    const m=monthVal();
    const source = (m==='2026-06') ? DATA : [];
    const map = new Map();
    source.forEach((r,idx)=>{
      const key = (r.month||m)+'|'+byProjectKey(r);
      if(!map.has(key)){
        map.set(key, JSON.parse(JSON.stringify(r)));
      }else{
        const x=map.get(key);
        x.totalMinutes = (Number(x.totalMinutes)||0) + (Number(r.totalMinutes)||0);
        x.workerCodes = [...new Set([...(x.workerCodes||[]), ...(r.workerCodes||[])])];
        x.workers = [...new Set([...(x.workers||[]), ...(r.workers||[])])];
        x.supervisorCodes = [...new Set([...(x.supervisorCodes||[]), ...(r.supervisorCodes||[])])];
      }
    });
    const rows = [...map.values()];
    // Recalculate percentages from the imported duration file, never from zero snapshot.
    const supTotals = {};
    rows.filter(r=>!isFull(r)).forEach(r=>{
      const key=(r.supervisorCodes&&r.supervisorCodes.length?r.supervisorCodes.join('+'):(r.supervisorName||'-'));
      supTotals[key]=(supTotals[key]||0)+(Number(r.totalMinutes)||0);
    });
    rows.forEach(r=>{
      r.totalMinutes = Number(r.totalMinutes)||0;
      r.requiredMinutes = Number(r.requiredMinutes)||0;
      if(isFull(r)){
        r.percentage = r.requiredMinutes ? (r.totalMinutes/r.requiredMinutes*100) : 100;
        r.calcNote = 'دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه';
      }else{
        const key=(r.supervisorCodes&&r.supervisorCodes.length?r.supervisorCodes.join('+'):(r.supervisorName||'-'));
        r.percentage = supTotals[key] ? (r.totalMinutes/supTotals[key]*100) : 0;
        r.calcNote = 'زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف في الشهر';
      }
    });
    rows.sort((a,b)=> (isFull(a)===isFull(b)?0:(isFull(a)?1:-1)) || S(a.supervisorName).localeCompare(S(b.supervisorName),'ar') || S(a.projectName).localeCompare(S(b.projectName),'ar'));
    return rows;
  }

  function ensureCss(){
    if($('monthlyV396Css')) return;
    const st=document.createElement('style');
    st.id='monthlyV396Css';
    st.textContent=`
      .mt396-alert{background:#ecfdf7;border:1px solid #bfe8d8;color:#075646;border-radius:14px;padding:10px;margin:10px 0;font-weight:800}
      .mt396-section{margin:18px 0}.mt396-section h3{margin:0 0 10px;color:#0a4539;font-size:20px}
      .mt396-super-title{background:#0a4539;color:#fff;border-radius:14px;padding:9px 12px;margin:12px 0 8px;font-weight:900}
      .mt396-grid{display:grid;grid-template-columns:repeat(3,minmax(290px,1fr));gap:12px}
      .mt396-card{background:#fff;border:1px solid #cfe4dc;border-radius:18px;padding:14px;box-shadow:0 8px 18px rgba(0,0,0,.04);break-inside:avoid}
      .mt396-card.full{border:2px solid #123b70;background:#fbfdff}
      .mt396-card h4{margin:0 0 10px;color:#0a4539;text-align:right;font-size:19px}.mt396-card.full h4{color:#123b70}
      .mt396-line{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed #dce9e4;padding:6px 0;align-items:center}
      .mt396-line span{color:#60746c}.mt396-line b{color:#0a4539}
      .mt396-workers{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.mt396-pill{background:#eef9f5;border:1px solid #d3ebe2;border-radius:999px;padding:5px 10px;font-weight:800;color:#0c3f35}
      .mt396-bar{height:10px;background:#e8f1ed;border-radius:999px;overflow:hidden;margin-top:8px}.mt396-bar i{display:block;height:100%;background:#0a4539}.mt396-card.full .mt396-bar i{background:#123b70}
      .mt396-empty{padding:18px;text-align:center;color:#60746c;background:#fff;border:1px solid #dce9e4;border-radius:14px}
      @media(max-width:1200px){.mt396-grid{grid-template-columns:repeat(2,minmax(260px,1fr))}}@media(max-width:760px){.mt396-grid{grid-template-columns:1fr}}
      @media print{.mt396-card,.mt396-section{break-inside:avoid}}
    `;
    document.head.appendChild(st);
  }

  function card(r){
    const workers=(r.workers&&r.workers.length?r.workers:(r.workerCodes||[]));
    return `<article class="mt396-card ${isFull(r)?'full':''}">
      <h4>${esc(r.projectName)}</h4>
      <div class="mt396-line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div>
      <div class="mt396-line"><span>نوع المشروع</span><b>${esc(r.projectType)}</b></div>
      <div class="mt396-line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div>
      <div class="mt396-line"><span>الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>
      ${isFull(r)?`<div class="mt396-line"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}
      <div class="mt396-line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div>
      <div class="mt396-bar"><i style="width:${Math.min(100,Math.max(0,Number(r.percentage)||0)).toFixed(0)}%"></i></div>
      <div class="mt396-workers">${workers.map(w=>`<span class="mt396-pill">${esc(w)}</span>`).join('')||'<span class="mt396-pill">لا يوجد عمال</span>'}</div>
    </article>`;
  }

  function render(){
    ensureCss();
    const rows=monthRows();
    window.tasneefMonthlyV396Rows=rows;
    window.tasneefMonthlyV395Rows=rows;
    window.tasneefMonthlyV393Rows=rows;
    const daily=rows.filter(r=>!isFull(r)), full=rows.filter(isFull);
    const msg=$('mt52Message'); if(msg){msg.classList.remove('hidden'); msg.textContent='تم تحميل بيانات الشهر من ملف الأوقات الشهرية مباشرة: لا يوجد تصفير، ولا يوجد تكرار للمشاريع.';}
    const summary=$('mt52Summary');
    if(summary){
      const total=rows.reduce((a,r)=>a+(Number(r.totalMinutes)||0),0);
      summary.innerHTML=`<div class="mt52-kpi"><small>الشهر</small><b>${esc(monthVal())}</b></div><div class="mt52-kpi"><small>المشاريع بدون تكرار</small><b>${rows.length}</b></div><div class="mt52-kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="mt52-kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="mt52-kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div>`;
    }
    const visitGrid=$('mt52VisitGrid');
    if(visitGrid){
      const groups=new Map();
      daily.forEach(r=>{const k=r.supervisorName||'-'; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);});
      visitGrid.className='';
      visitGrid.innerHTML=`<div class="mt396-alert">مشاريع الزيارة اليومية: كل مشروع مربع مستقل، والنسبة = وقت المشروع ÷ إجمالي وقت المشرف.</div>`+
        [...groups.entries()].map(([sup,list])=>`<section class="mt396-section"><div class="mt396-super-title">${esc(sup)}</div><div class="mt396-grid">${list.map(card).join('')}</div></section>`).join('');
    }
    const workersCard=document.querySelector('.monthly-workers-v10152');
    if(workersCard){
      const h=workersCard.querySelector('h2'); if(h) h.textContent='مشاريع الدوام الكامل';
      const small=workersCard.querySelector('small'); if(small) small.textContent='كل مشروع مربع مستقل، والنسبة = الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه.';
      const grid=$('mt52WorkersGrid');
      if(grid){ grid.className='mt396-grid'; grid.innerHTML= full.length ? full.map(card).join('') : '<div class="mt396-empty">لا توجد مشاريع دوام كامل لهذا الشهر.</div>'; }
    }
    const body=$('mt52Body');
    if(body){
      body.innerHTML=rows.map(r=>`<tr><td>${esc(r.supervisorName||'-')}</td><td>${esc(r.projectName)}</td><td>${(r.workers||[]).map(esc).join('، ')}</td><td>-</td><td>${Math.round(r.totalMinutes).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td>${r.requiredMinutes?Math.round(r.requiredMinutes).toLocaleString('en-US'):'-'}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.projectType)}</td><td>${esc(r.calcNote)}</td><td>ملف الأوقات الشهرية v396</td></tr>`).join('');
    }
    return rows;
  }

  function printReport(ev){
    if(ev){ev.preventDefault();ev.stopPropagation();}
    const rows=render();
    const daily=rows.filter(r=>!isFull(r)), full=rows.filter(isFull);
    const total=rows.reduce((a,r)=>a+(Number(r.totalMinutes)||0),0);
    const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';
    const groups=new Map();
    daily.forEach(r=>{const k=r.supervisorName||'-'; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);});
    const pcard=r=>{
      const workers=(r.workers&&r.workers.length?r.workers:(r.workerCodes||[]));
      return `<article class="p-card ${isFull(r)?'full':''}">
        <h3>${esc(r.projectName)}</h3>
        <div class="line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div>
        <div class="line"><span>نوع المشروع</span><b>${esc(r.projectType)}</b></div>
        <div class="line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div>
        <div class="line"><span>إجمالي الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>
        ${isFull(r)?`<div class="line"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}
        <div class="line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div>
        <div class="bar"><i style="width:${Math.min(100,Math.max(0,Number(r.percentage)||0)).toFixed(0)}%"></i></div>
        <div class="workers"><b>العمال:</b> ${workers.map(esc).join('، ')||'-'}</div>
      </article>`;
    };
    const dailyHtml=[...groups.entries()].map(([sup,list])=>`<section class="super"><h2>${esc(sup)}</h2><div class="grid">${list.map(pcard).join('')}</div></section>`).join('');
    const fullHtml=`<section class="full-section"><h2>مشاريع الدوام الكامل</h2><div class="grid">${full.map(pcard).join('')}</div></section>`;
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${esc(monthVal())}</title><style>
      @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#15231f;background:#fff}
      .head{border:2px solid #0a4539;border-radius:18px;background:#f7fcfa;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .brand{display:flex;gap:12px;align-items:center}.brand img{width:100px;height:58px;object-fit:contain;background:#fff;border:1px solid #dbe8e2;border-radius:12px;padding:6px}
      h1{margin:0;color:#0a4539;font-size:24px}.sub{color:#60746c;margin-top:4px}.month{background:#0a4539;color:#fff;border-radius:16px;padding:9px 18px;text-align:center}.month b{display:block;font-size:24px}
      .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}.kpi{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:8px;text-align:center}.kpi small{display:block;color:#60746c}.kpi b{font-size:18px;color:#0a4539}
      .super,.full-section{border:1px solid #dbe8e2;border-radius:16px;margin:9px 0;overflow:hidden;break-inside:avoid}.super h2,.full-section h2{margin:0;background:#0a4539;color:#fff;padding:9px 12px;font-size:17px}.full-section h2{background:#123b70}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:9px}.p-card{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:10px;break-inside:avoid}.p-card.full{border:2px solid #123b70;background:#fbfdff}
      .p-card h3{margin:0 0 8px;color:#0a4539;font-size:16px}.p-card.full h3{color:#123b70}.line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #d9e5df;padding:5px 0;font-size:12px}.line span{color:#60746c}.line b{color:#0a4539}
      .workers{font-size:12px;line-height:1.8;margin-top:8px}.bar{height:9px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:7px}.bar i{display:block;height:100%;background:#0a4539}.p-card.full .bar i{background:#123b70}
      .footer{display:flex;justify-content:space-between;color:#60746c;border-top:1px solid #dbe8e2;padding-top:7px;margin-top:10px;font-size:11px}@media print{.p-card,.super,.full-section{break-inside:avoid}}
      </style></head><body>
      <header class="head"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div class="sub">مصدر المدة المستغرقة: ملف الأوقات الشهرية المرفق — بدون تصفير وبدون تكرار للمشاريع</div></div></div><div class="month"><small>الشهر</small><b>${esc(monthVal())}</b><small>V${VERSION}</small></div></header>
      <div class="kpis"><div class="kpi"><small>المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div></div>
      <section><h2 style="color:#0a4539">مشاريع الزيارة اليومية</h2>${dailyHtml}</section>${fullHtml}
      <div class="footer"><span>تم إنشاء هذا التقرير من نظام شركة تصنيف لإدارة المرافق ويعتبر معتمدًا ما لم يبرر العميل خلاف ذلك</span><span>${new Date().toLocaleString('en-GB')}</span></div>
      <script>setTimeout(()=>print(),700)<\/script></body></html>`;
    const w=window.open('','_blank');
    if(w){w.document.write(html);w.document.close();}else{window.print();}
    return false;
  }

  function attach(){
    const btn=$('mt52Print');
    if(btn && btn.dataset.v396!=='1'){
      btn.dataset.v396='1';
      btn.textContent='طباعة تقرير الأوقات الشهرية';
      btn.addEventListener('click',printReport,true);
      btn.onclick=printReport;
    }
    ['mt52Refresh','mt52Rebuild'].forEach(id=>{
      const b=$(id); if(b && b.dataset.v396!=='1'){b.dataset.v396='1'; b.addEventListener('click',()=>setTimeout(render,700),true);}
    });
  }

  function boot(){
    attach();
    setInterval(attach,1000);
    [500,1200,2500,4500,7000].forEach(t=>setTimeout(render,t));
  }

  window.tasneefMonthlyV396={render,print:printReport,rows:monthRows};
  window.tasneefPrintMonthlyFormulaV391=printReport;
  window.tasneefPrintMonthlyFormulaV392=printReport;
  window.tasneefPrintMonthlyFormulaV393=printReport;
  window.tasneefPrintMonthlyFormulaV395=printReport;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();