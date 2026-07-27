-- Tasneef V10850 — Complete client portal payload
-- Run once in Supabase > SQL Editor.

CREATE OR REPLACE FUNCTION public.tasneef_client_portal_payload_v10850(
    p_token text DEFAULT NULL,
    p_project_id text DEFAULT NULL,
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project_id bigint;
    v_from date := COALESCE(p_from, date_trunc('month', CURRENT_DATE)::date);
    v_to date := COALESCE(p_to, CURRENT_DATE);
    v_project jsonb := '{}'::jsonb;
    v_focus_report jsonb := NULL;
    v_smart jsonb := '{}'::jsonb;
    v_logs jsonb := '[]'::jsonb;
    v_attendance jsonb := '[]'::jsonb;
    v_tickets jsonb := '[]'::jsonb;
    v_reports jsonb := '[]'::jsonb;
    v_report_services jsonb := '[]'::jsonb;
    v_annual_services jsonb := '[]'::jsonb;
    v_ratings jsonb := '[]'::jsonb;
    v_work_minutes numeric := 0;
    v_attendance_days integer := 0;
    v_annual_done numeric := 0;
    v_annual_remain numeric := 0;
BEGIN
    IF v_to < v_from THEN
        RAISE EXCEPTION 'تاريخ النهاية يجب ألا يسبق تاريخ البداية';
    END IF;

    -- Resolve the project from a published report token first.
    IF NULLIF(btrim(p_token), '') IS NOT NULL THEN
        SELECT r.project_id, to_jsonb(r)
          INTO v_project_id, v_focus_report
          FROM public.client_reports r
         WHERE r.public_token = btrim(p_token)
           AND r.status = 'published'
         ORDER BY r.id DESC
         LIMIT 1;
    END IF;

    IF v_project_id IS NULL AND NULLIF(btrim(p_project_id), '') IS NOT NULL THEN
        BEGIN
            v_project_id := btrim(p_project_id)::bigint;
        EXCEPTION WHEN invalid_text_representation THEN
            v_project_id := NULL;
        END;
    END IF;

    IF v_project_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'لا يوجد مشروع مرتبط برابط العميل');
    END IF;

    SELECT COALESCE(to_jsonb(p), '{}'::jsonb)
      INTO v_project
      FROM public.projects p
     WHERE p.id = v_project_id
     LIMIT 1;

    IF v_project = '{}'::jsonb THEN
        RETURN jsonb_build_object('ok', false, 'error', 'المشروع غير موجود');
    END IF;

    SELECT COALESCE(to_jsonb(s), '{}'::jsonb)
      INTO v_smart
      FROM public.project_contract_smart s
     WHERE s.project_id = v_project_id
     ORDER BY s.updated_at DESC NULLS LAST
     LIMIT 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.check_in DESC NULLS LAST, l.id DESC), '[]'::jsonb)
      INTO v_logs
      FROM public.time_logs l
     WHERE l.project_id = v_project_id
       AND COALESCE(l.log_date, l.check_in::date, l.created_at::date) BETWEEN v_from AND v_to;

    SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.attendance_date DESC, a.id DESC), '[]'::jsonb)
      INTO v_attendance
      FROM public.attendance a
     WHERE a.project_id = v_project_id
       AND a.attendance_date BETWEEN v_from AND v_to;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC NULLS LAST, t.id DESC), '[]'::jsonb)
      INTO v_tickets
      FROM public.tickets t
     WHERE t.project_id = v_project_id
       AND COALESCE(t.created_at::date, CURRENT_DATE) BETWEEN v_from AND v_to;

    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.report_date DESC NULLS LAST, r.created_at DESC NULLS LAST), '[]'::jsonb)
      INTO v_reports
      FROM public.client_reports r
     WHERE r.project_id = v_project_id
       AND r.status = 'published'
       AND COALESCE(r.report_date, r.created_at::date) BETWEEN v_from AND v_to;

    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.report_id, s.id), '[]'::jsonb)
      INTO v_report_services
      FROM public.client_report_services s
     WHERE s.report_id IN (
        SELECT r.id
          FROM public.client_reports r
         WHERE r.project_id = v_project_id
           AND r.status = 'published'
           AND COALESCE(r.report_date, r.created_at::date) BETWEEN v_from AND v_to
     );

    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]'::jsonb)
      INTO v_annual_services
      FROM public.contract_services c
     WHERE c.project_id = v_project_id
       AND lower(COALESCE(c.status, '')) <> 'مؤرشفة';

    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST, x.id DESC), '[]'::jsonb)
      INTO v_ratings
      FROM public.client_service_ratings x
     WHERE x.project_id = v_project_id
       AND COALESCE(x.created_at::date, CURRENT_DATE) BETWEEN v_from AND v_to;

    SELECT COALESCE(SUM(
        CASE
            WHEN COALESCE(l.duration_minutes, 0) > 0 THEN l.duration_minutes
            WHEN l.check_in IS NOT NULL AND l.check_out IS NOT NULL
                THEN GREATEST(0, EXTRACT(EPOCH FROM (l.check_out - l.check_in)) / 60)
            ELSE COALESCE(l.required_minutes, 0)
        END
    ), 0)
      INTO v_work_minutes
      FROM public.time_logs l
     WHERE l.project_id = v_project_id
       AND COALESCE(l.log_date, l.check_in::date, l.created_at::date) BETWEEN v_from AND v_to;

    SELECT COUNT(DISTINCT d)::integer
      INTO v_attendance_days
      FROM (
        SELECT COALESCE(l.log_date, l.check_in::date, l.created_at::date) AS d
          FROM public.time_logs l
         WHERE l.project_id = v_project_id
           AND COALESCE(l.log_date, l.check_in::date, l.created_at::date) BETWEEN v_from AND v_to
        UNION
        SELECT a.attendance_date AS d
          FROM public.attendance a
         WHERE a.project_id = v_project_id
           AND a.attendance_date BETWEEN v_from AND v_to
           AND lower(COALESCE(a.status, 'present')) IN ('present','active','working','1','true','حاضر')
      ) q
     WHERE d IS NOT NULL;

    SELECT
        COALESCE(SUM(COALESCE(c.executed_count, 0)), 0),
        COALESCE(SUM(COALESCE(c.remaining_count, GREATEST(COALESCE(c.visit_count, 0) - COALESCE(c.executed_count, 0), 0))), 0)
      INTO v_annual_done, v_annual_remain
      FROM public.contract_services c
     WHERE c.project_id = v_project_id
       AND lower(COALESCE(c.status, '')) <> 'مؤرشفة';

    RETURN jsonb_build_object(
        'ok', true,
        'project_id', v_project_id,
        'project_name', COALESCE(v_project->>'name', v_focus_report->>'project_name', 'مشروع العميل'),
        'range_from', v_from,
        'range_to', v_to,
        'project', v_project,
        'focus_report', v_focus_report,
        'smart', v_smart,
        'annual_services', v_annual_services,
        'logs', v_logs,
        'attendance', v_attendance,
        'tickets', v_tickets,
        'reports', v_reports,
        'report_services', v_report_services,
        'ratings', v_ratings,
        'summary', jsonb_build_object(
            'work_minutes', ROUND(v_work_minutes),
            'attendance_days', v_attendance_days,
            'annual_done', v_annual_done,
            'annual_remain', v_annual_remain,
            'contract_end', COALESCE(v_project->>'contract_end', v_project->>'end_date')
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.tasneef_client_portal_payload_v10850(text,text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasneef_client_portal_payload_v10850(text,text,date,date) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
