مهم قبل الرفع / قبل تجربة إدارة المستخدمين:

سبب الخطأ:
قاعدة البيانات في Supabase لا تسمح بالأدوار الجديدة مثل:
financial_manager / operations_manager / warehouse_manager
لذلك تظهر رسالة:
violates check constraint app_users_role_check

الحل:
1) افتح Supabase.
2) ادخل SQL Editor.
3) افتح الملف:
sql/schema_update_v203_app_users_role_fix.sql
4) انسخ محتواه وشغله مرة واحدة.
5) بعد ذلك ارفع ملفات الموقع.
6) افتح المتصفح واضغط Ctrl + F5.

ملفات الرفع للموقع هي كل الملفات الأساسية في هذا المجلد، أما مجلد sql لا يرفع للموقع، فقط يستخدم في Supabase.
