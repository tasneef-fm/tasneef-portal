TASNEEF V10870

Fix: supervisor project ownership matching for legacy mixed identity values.
- Each supervisor still sees only projects linked to that supervisor.
- supervisor_id can safely match app user id, employee/master id, or employee code when legacy data stores the code in the id field.
- No PermissionsService / allowed_project_ids expansion is used.
- Keeps first-open / after-add / after-delete refresh policy.
- Target symptom fixed: projects linked to Fahd such as Rose Al Narjis and Makeen 52 not appearing in Fahd account when legacy identity format is used.
