TASNEEF V10871

Direct repair for supervisor Fahd project ownership:
- Rose Al Narjis (روز النرجس)
- Makeen 52 (مكين 52)

Root cause fixed:
The projects editor could save an employee code in supervisor_employee_code while leaving supervisor_id empty when the supervisor selector value was not numeric. Supervisor portal visibility relies on the real app user id.

Changes:
1) Project save now resolves supervisor employee code/name to app_users.id before saving.
2) Admin startup migration repairs the two target projects when their supervisor_id is empty/legacy or their stored supervisor code/name already identifies Fahd.
3) Current-month monthly_distribution and project_monthly_settings_v387 are synchronized to the same Fahd app user id.
4) The migration does not use allowed_project_ids and does not expose other supervisors' projects.
5) If the projects are later intentionally assigned to another supervisor with a valid id/name, the repair does not force them back to Fahd.
