from pathlib import Path
import subprocess, sys
root=Path(__file__).parent
core=(root/'tasneef_core_unified_v413.js').read_text(encoding='utf-8')
mod=(root/'tasneef_unified_employee_excel_v10809.js').read_text(encoding='utf-8')
admin=(root/'admin.html').read_text(encoding='utf-8')
checks=[]
def check(name, cond):
    checks.append((name,bool(cond)))

check('Build V10809 موجود', 'V10809-UNIFIED-EMPLOYEE-IQAMA-WORKPLACE' in admin)
check('ملف Excel الجديد محمل', 'tasneef_unified_employee_excel_v10809.js' in admin)
check('ملف Excel محمل بعد إصلاح التكتات', admin.find('tasneef_unified_employee_excel_v10809.js') > admin.find('tasneef_ticket_receive_visibility_v10808.js'))
check('حقل الاسم في الإقامة موجود في النموذج', 'id="cu413WIqamaName"' in core)
check('اسم الإقامة يظهر في البطاقة', 'الاسم في الإقامة:</b>' in core)
check('حفظ iqama_name في المصدر الرئيسي', "iqama_name:S($('cu413WIqamaName')" in core)
check('استعادة اسم الإقامة عند التعديل', "$('cu413WIqamaName').value=workerIqamaName(w)" in core)
check('البحث يشمل اسم الإقامة', "workerDisplay(w)+' '+workerIqamaName(w)" in core)
check('عنوان اسم الموظف مع الكود', "'اسم الموظف مع الكود'" in mod)
check('عمود اسم الإقامة', "'الاسم في الإقامة'" in mod)
check('عمود مكان العمل', "'مكان العمل'" in mod)
check('عمود الراتب', "'الراتب'" in mod)
check('عمود بداية الدوام', "'بداية الدوام'" in mod)
check('عمود نهاية الدوام', "'نهاية الدوام'" in mod)
check('عمود أيام الحضور', "'أيام الحضور'" in mod)
check('عمود أيام الغياب', "'أيام الغياب'" in mod)
check('الزيارة اليومية تعرض اسم المشرف', "i.full?i.name:sup.name" in mod)
check('الدوام الكامل يعرض اسم المشروع', "return t.includes('دوام')" in mod and "i.full?i.name:sup.name" in mod)
check('المشرف يظهر كسجل مستقل', "roleGroup:'supervisor'" in mod and "'المشرف'" in mod)
check('العمالة مجمعة حسب المشروع', "const byProject=new Map()" in mod and "المشروع: ${project}" in mod)
check('ترتيب داخل المشروع', "a.roleOrder-b.roleOrder" in mod)
check('كشف يومي موجود', "'كشف يومي'" in mod)
check('الفلاتر الحالية مستخدمة', 'currentFilters()' in mod and 'matchesFilter' in mod)
check('منع الضغط المكرر', "if(btn?.disabled)return" in mod)
check('النسخة القديمة لا تسيطر على الزر بعد التحميل', "btn.dataset.v10809" in mod and "tasneefCoreUnifiedV413.exportSupervisorEmployeesExcel" in mod)

syntax_ok=True
for f in ['tasneef_core_unified_v413.js','tasneef_unified_employee_excel_v10809.js']:
    r=subprocess.run(['node','--check',str(root/f)],capture_output=True,text=True)
    if r.returncode!=0:
        syntax_ok=False
        print(r.stderr)
check('فحص Syntax لملفات JavaScript', syntax_ok)

passed=sum(v for _,v in checks)
for name,ok in checks:
    print(('PASS' if ok else 'FAIL')+' | '+name)
print(f'RESULT {passed}/{len(checks)}')
sys.exit(0 if passed==len(checks) else 1)
