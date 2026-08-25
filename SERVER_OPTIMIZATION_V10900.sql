-- TASNEEF V10900 — SAFE SERVER PERFORMANCE INDEXES
-- Run once in Supabase SQL Editor.
-- It does not delete/update business data. It creates indexes only when the table+columns exist.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('projects','idx_tasneef_projects_supervisor_v10900','supervisor_id'),
      ('projects','idx_tasneef_projects_status_v10900','status'),
      ('workers','idx_tasneef_workers_project_supervisor_v10900','project_id, supervisor_id'),
      ('workers','idx_tasneef_workers_active_v10900','is_active'),
      ('monthly_distribution','idx_tasneef_monthly_dist_month_sup_project_v10900','month_key, supervisor_id, project_id'),
      ('monthly_distribution','idx_tasneef_monthly_dist_month_project_v10900','month_key, project_id'),
      ('tickets','idx_tasneef_tickets_project_created_v10900','project_id, created_at DESC'),
      ('tickets','idx_tasneef_tickets_supervisor_created_v10900','supervisor_id, created_at DESC'),
      ('tickets','idx_tasneef_tickets_status_created_v10900','status, created_at DESC'),
      ('time_logs','idx_tasneef_logs_date_sup_project_v10900','log_date, supervisor_id, project_id'),
      ('time_logs','idx_tasneef_logs_checkin_v10900','check_in DESC'),
      ('attendance','idx_tasneef_att_date_project_v10900','attendance_date, project_id'),
      ('attendance','idx_tasneef_att_date_supervisor_v10900','attendance_date, supervisor_id'),
      ('app_users','idx_tasneef_users_role_active_v10900','role, is_active')
    ) AS x(tbl,idx,cols)
  LOOP
    IF to_regclass('public.'||r.tbl) IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM unnest(string_to_array(replace(r.cols,' DESC',''), ', ')) c(col)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=r.tbl AND column_name=c.col
      )
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)',r.idx,r.tbl,r.cols);
    END IF;
  END LOOP;
END $$;

-- Refresh planner statistics after index creation.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','workers','monthly_distribution','tickets','time_logs','attendance','app_users']
  LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN EXECUTE format('ANALYZE public.%I',t); END IF;
  END LOOP;
END $$;
