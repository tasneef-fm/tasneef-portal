Tasneef V10852 — Supervisor Ticket RLS Fix

المشكلة:
كانت صفحة المشرف تحفظ التذكرة مباشرة في public.tickets، بينما سياسة RLS V10817 تتحقق من نطاق مشروع قديم. لذلك قد يرى المشرف المشروع من النظام الموحد 4، ثم يرفض السيرفر إضافة التذكرة.

الإصلاح:
1) حفظ تذاكر المشرف عبر RPC آمنة باسم tasneef_supervisor_save_ticket_v10852.
2) التحقق من جلسة المشرف وصلاحية tickets.create أو tickets.edit.
3) التحقق من أن المشروع مرتبط بالمشرف حاليًا في monthly_distribution.
4) مزامنة نطاق المشروع في tasneef_user_project_access_v10817.
5) منع الحفظ المكرر عبر idempotency_key.

خطوات التركيب:
- ارفع جميع ملفات هذه النسخة.
- نفذ supabase_supervisor_ticket_rls_v10852.sql مرة واحدة في Supabase SQL Editor.
- سجل خروج المشرف ثم ادخل مجددًا.
- اضغط Ctrl + F5.
