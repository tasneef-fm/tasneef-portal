-- Tasneef V10852 — Supervisor Ticket RLS Fix
-- Run once in Supabase SQL Editor.
-- Non-destructive: does not delete tickets, projects, users or distribution records.

begin;

create or replace function public.tasneef_try_uuid_v10852(v text)
returns uuid language plpgsql immutable as $$
begin return nullif(trim(coalesce(v,'')),'')::uuid;
exception when others then return null;
end$$;

create or replace function public.tasneef_try_bigint_v10852(v text)
returns bigint language plpgsql immutable as $$
begin return nullif(regexp_replace(trim(coalesce(v,'')),'[^0-9-]','','g'),'')::bigint;
exception when others then return null;
end$$;

create or replace function public.tasneef_try_date_v10852(v text)
returns date language plpgsql immutable as $$
begin return nullif(left(trim(coalesce(v,'')),10),'')::date;
exception when others then return null;
end$$;

create or replace function public.tasneef_month_start_v10852(v text)
returns date language plpgsql immutable as $$
declare x text:=replace(trim(coalesce(v,'')),'/','-');
begin
  if x ~ '^\d{4}-\d{1,2}$' then
    return (split_part(x,'-',1)||'-'||lpad(split_part(x,'-',2),2,'0')||'-01')::date;
  end if;
  return null;
exception when others then return null;
end$$;

create or replace function public.tasneef_norm_v10852(v text)
returns text language sql immutable as $$
  select lower(regexp_replace(
    translate(coalesce(v,''),'إأآىيةؤئـ٠١٢٣٤٥٦٧٨٩','اااييهويا0123456789'),
    '[^[:alnum:]ء-ي]+','','g'
  ))
$$;

create or replace function public.tasneef_session_user_v10852(p_session_token text default null)
returns bigint language plpgsql stable security definer set search_path=public as $$
declare tok uuid:=public.tasneef_try_uuid_v10852(p_session_token); uid bigint; h jsonb;
begin
  if tok is null then
    begin
      h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
      tok:=public.tasneef_try_uuid_v10852(h->>'x-tasneef-session');
    exception when others then tok:=null;
    end;
  end if;
  if tok is null then return null; end if;

  if to_regprocedure('public.session_user_from_token_v10817(uuid)') is not null then
    select public.session_user_from_token_v10817(tok) into uid;
  end if;

  if uid is null and to_regclass('public.tasneef_permission_sessions_v10817') is not null then
    select s.user_id into uid
    from public.tasneef_permission_sessions_v10817 s
    join public.app_users u on u.id=s.user_id
    where s.session_token=tok
      and s.is_active=true
      and s.expires_at>now()
      and coalesce(u.is_active,true)=true
      and coalesce(u.status,'active')='active'
    limit 1;
  end if;
  return uid;
end$$;

-- Resolve supervisor identity from every format historically used in monthly_distribution.
create or replace function public.tasneef_distribution_supervisor_user_v10852(p_row jsonb)
returns bigint language sql stable security definer set search_path=public as $$
  with refs as (
    select
      public.tasneef_try_bigint_v10852(coalesce(
        p_row->>'supervisor_id',p_row->>'supervisor_user_id',p_row->>'app_supervisor_id',
        p_row->>'current_supervisor_id',p_row->>'assigned_supervisor_id',''
      )) direct_id,
      public.tasneef_norm_v10852(coalesce(
        p_row->>'supervisor_employee_code',p_row->>'supervisor_code',
        p_row->>'assigned_supervisor_code',p_row->>'manager_code',''
      )) code_ref,
      public.tasneef_norm_v10852(coalesce(
        p_row->>'supervisor_name',p_row->>'assigned_supervisor_name',
        p_row->>'manager_name',p_row->>'supervisor',''
      )) name_ref
  ), candidates as (
    select u.id,
      case
        when r.direct_id=u.id then 0
        when r.code_ref<>'' and r.code_ref in (
          public.tasneef_norm_v10852(to_jsonb(u)->>'employee_code'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'employee_number'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'code'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'user_code'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'username')
        ) then 1
        when r.name_ref<>'' and r.name_ref in (
          public.tasneef_norm_v10852(to_jsonb(u)->>'full_name'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'name'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'display_name'),
          public.tasneef_norm_v10852(to_jsonb(u)->>'username')
        ) then 2
        else 99
      end score
    from public.app_users u cross join refs r
    where coalesce(u.is_active,true)=true
      and coalesce(u.status,'active')='active'
      and lower(coalesce(to_jsonb(u)->>'role_key',to_jsonb(u)->>'role','')) in ('supervisor','مشرف')
  )
  select id from candidates where score<99 order by score,id limit 1
$$;

create or replace function public.tasneef_supervisor_has_project_v10852(
  p_user_id bigint,
  p_project_id bigint,
  p_on_date date default timezone('Asia/Riyadh',now())::date
)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.monthly_distribution md
    where public.tasneef_try_bigint_v10852(to_jsonb(md)->>'project_id')=p_project_id
      and public.tasneef_distribution_supervisor_user_v10852(to_jsonb(md))=p_user_id
      and lower(coalesce(to_jsonb(md)->>'is_active','true')) not in ('false','0','no')
      and public.tasneef_norm_v10852(coalesce(to_jsonb(md)->>'status',to_jsonb(md)->>'state','active'))
          not in ('inactive','stopped','ended','deleted','archived','موقوف','متوقف','منتهي','محذوف','مورشف')
      and coalesce(
            public.tasneef_try_date_v10852(coalesce(to_jsonb(md)->>'start_date',to_jsonb(md)->>'effective_from','')),
            public.tasneef_month_start_v10852(to_jsonb(md)->>'month_key'),
            p_on_date
          ) <= p_on_date
      and (
        public.tasneef_try_date_v10852(coalesce(to_jsonb(md)->>'end_date',to_jsonb(md)->>'effective_to','')) is null
        or public.tasneef_try_date_v10852(coalesce(to_jsonb(md)->>'end_date',to_jsonb(md)->>'effective_to','')) >= p_on_date
      )
  )
$$;

-- Ensure columns used by the current ticket form exist.
alter table public.tickets add column if not exists ticket_number text;
alter table public.tickets add column if not exists project_id bigint;
alter table public.tickets add column if not exists supervisor_id bigint;
alter table public.tickets add column if not exists category text;
alter table public.tickets add column if not exists priority text;
alter table public.tickets add column if not exists title text;
alter table public.tickets add column if not exists description text;
alter table public.tickets add column if not exists status text;
alter table public.tickets add column if not exists idempotency_key text;
alter table public.tickets add column if not exists created_by bigint;
alter table public.tickets add column if not exists created_at timestamptz default now();
alter table public.tickets add column if not exists updated_at timestamptz default now();
alter table public.tickets add column if not exists claimed_by bigint;
alter table public.tickets add column if not exists claimed_by_name text;
alter table public.tickets add column if not exists claimed_at timestamptz;
alter table public.tickets add column if not exists closed_by bigint;
alter table public.tickets add column if not exists closed_by_name text;
alter table public.tickets add column if not exists closed_at timestamptz;
alter table public.tickets add column if not exists closure_note text;
alter table public.tickets add column if not exists open_duration_minutes integer;
alter table public.tickets add column if not exists processing_duration_minutes integer;
create unique index if not exists tickets_idempotency_v10852_uq
  on public.tickets(idempotency_key) where idempotency_key is not null;

-- Make sure the supervisor role has the standard ticket permissions.
do $$
declare rid bigint; pid bigint; k text;
begin
  if to_regclass('public.tasneef_roles_v10817') is null
     or to_regclass('public.tasneef_permissions_v10817') is null
     or to_regclass('public.tasneef_role_permissions_v10817') is null then
    return;
  end if;
  select id into rid from public.tasneef_roles_v10817 where role_key='supervisor' limit 1;
  if rid is null then return; end if;
  foreach k in array array['tickets.view','tickets.create','tickets.edit','tickets.assign','tickets.close'] loop
    select id into pid from public.tasneef_permissions_v10817 where permission_key=k and is_active=true limit 1;
    if pid is not null then
      insert into public.tasneef_role_permissions_v10817(role_id,permission_id,granted,updated_at)
      values(rid,pid,true,now())
      on conflict(role_id,permission_id) do update set granted=true,updated_at=now();
    end if;
  end loop;
end$$;

-- Sync RLS project scope from the same source shown in Unified Distribution 4.
insert into public.tasneef_user_project_access_v10817(user_id,project_id,access_level,is_active,updated_at)
select distinct
  public.tasneef_distribution_supervisor_user_v10852(to_jsonb(md)) user_id,
  public.tasneef_try_bigint_v10852(to_jsonb(md)->>'project_id') project_id,
  'supervisor',true,now()
from public.monthly_distribution md
where public.tasneef_distribution_supervisor_user_v10852(to_jsonb(md)) is not null
  and public.tasneef_try_bigint_v10852(to_jsonb(md)->>'project_id') is not null
  and lower(coalesce(to_jsonb(md)->>'is_active','true')) not in ('false','0','no')
on conflict(user_id,project_id) do update
set access_level='supervisor',is_active=true,updated_at=now();

create or replace function public.tasneef_supervisor_save_ticket_v10852(
  p_session_token text,
  p_ticket_id bigint,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid bigint;
  pid bigint:=public.tasneef_try_bigint_v10852(p_payload->>'project_id');
  rolekey text;
  is_admin boolean:=false;
  permission_key text;
  tid bigint;
  existing public.tickets%rowtype;
  saved public.tickets%rowtype;
  new_status text:=lower(coalesce(nullif(trim(p_payload->>'status'),''),'open'));
  new_priority text:=lower(coalesce(nullif(trim(p_payload->>'priority'),''),'normal'));
  title_value text:=nullif(trim(coalesce(p_payload->>'title','')),'');
  description_value text:=trim(coalesce(p_payload->>'description',''));
  now_riyadh timestamptz:=now();
begin
  uid:=public.tasneef_session_user_v10852(p_session_token);
  if uid is null then raise exception 'الجلسة غير صالحة'; end if;

  select lower(coalesce(role_key,role::text,'')) into rolekey
  from public.app_users
  where id=uid and coalesce(is_active,true)=true and coalesce(status,'active')='active';
  if rolekey is null then raise exception 'المستخدم موقوف أو غير موجود'; end if;
  is_admin:=rolekey in ('super_admin','system_admin','admin','operations_manager');
  if not is_admin and rolekey not in ('supervisor','مشرف') then
    raise exception 'هذه الخدمة مخصصة للمشرفين والإدارة';
  end if;

  if pid is null then raise exception 'اختر المشروع أولًا'; end if;
  if title_value is null then raise exception 'عنوان التذكرة مطلوب'; end if;
  if description_value='' then raise exception 'وصف التذكرة مطلوب'; end if;
  if new_status not in ('open','processing','closed') then new_status:='open'; end if;
  if new_priority not in ('low','normal','high','urgent') then new_priority:='normal'; end if;

  if not is_admin then
    if not public.tasneef_supervisor_has_project_v10852(uid,pid,timezone('Asia/Riyadh',now())::date) then
      raise exception 'المشروع غير مرتبط بالمشرف في النظام الموحد 4';
    end if;

    -- Keep the legacy RLS scope synchronized, without using it as the operational source.
    insert into public.tasneef_user_project_access_v10817(user_id,project_id,access_level,is_active,updated_at)
    values(uid,pid,'supervisor',true,now())
    on conflict(user_id,project_id) do update
    set access_level='supervisor',is_active=true,updated_at=now();
  end if;

  permission_key:=case when p_ticket_id is null then 'tickets.create' else 'tickets.edit' end;
  if not is_admin and to_regprocedure('public.effective_permission_for_user_v10817(bigint,text,bigint)') is not null then
    if not public.effective_permission_for_user_v10817(uid,permission_key,pid) then
      raise exception 'ليس لديك صلاحية %',case when p_ticket_id is null then 'إنشاء تذكرة' else 'تعديل التذكرة' end;
    end if;
  end if;

  if p_ticket_id is null and nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select * into existing from public.tickets where idempotency_key=p_idempotency_key limit 1;
    if found then return jsonb_build_object('ok',true,'duplicate',true,'ticket',to_jsonb(existing)); end if;
  end if;

  if p_ticket_id is null then
    insert into public.tickets(
      project_id,supervisor_id,category,priority,title,description,status,
      idempotency_key,created_by,created_at,updated_at,
      claimed_by,claimed_by_name,claimed_at,
      closed_by,closed_by_name,closed_at,closure_note,
      open_duration_minutes,processing_duration_minutes
    ) values(
      pid,uid,coalesce(nullif(trim(p_payload->>'category'),''),title_value),new_priority,title_value,description_value,new_status,
      nullif(trim(coalesce(p_idempotency_key,'')),''),uid,now_riyadh,now_riyadh,
      case when new_status='processing' then uid else null end,
      case when new_status='processing' then coalesce(nullif(trim(p_payload->>'claimed_by_name'),''),(select coalesce(full_name,username) from public.app_users where id=uid)) else null end,
      case when new_status='processing' then now_riyadh else null end,
      case when new_status='closed' then uid else null end,
      case when new_status='closed' then coalesce(nullif(trim(p_payload->>'closed_by_name'),''),(select coalesce(full_name,username) from public.app_users where id=uid)) else null end,
      case when new_status='closed' then now_riyadh else null end,
      case when new_status='closed' then nullif(trim(p_payload->>'closure_note'),'') else null end,
      case when new_status='closed' then coalesce(public.tasneef_try_bigint_v10852(p_payload->>'open_duration_minutes')::integer,0) else null end,
      case when new_status='closed' then coalesce(public.tasneef_try_bigint_v10852(p_payload->>'processing_duration_minutes')::integer,0) else null end
    ) returning * into saved;
    tid:=saved.id;
  else
    select * into existing from public.tickets where id=p_ticket_id for update;
    if not found then raise exception 'التذكرة غير موجودة'; end if;
    if not is_admin and existing.supervisor_id is distinct from uid
       and not public.tasneef_supervisor_has_project_v10852(uid,existing.project_id,timezone('Asia/Riyadh',now())::date) then
      raise exception 'لا يمكنك تعديل تذكرة خارج مشاريعك';
    end if;

    update public.tickets set
      project_id=pid,
      supervisor_id=uid,
      category=coalesce(nullif(trim(p_payload->>'category'),''),title_value),
      priority=new_priority,
      title=title_value,
      description=description_value,
      status=new_status,
      updated_at=now_riyadh,
      closed_by=case when new_status='closed' then uid else null end,
      closed_by_name=case when new_status='closed' then coalesce(nullif(trim(p_payload->>'closed_by_name'),''),(select coalesce(full_name,username) from public.app_users where id=uid)) else null end,
      closed_at=case when new_status='closed' then coalesce(existing.closed_at,now_riyadh) else null end,
      closure_note=case when new_status='closed' then nullif(trim(p_payload->>'closure_note'),'') else null end,
      open_duration_minutes=case when new_status='closed' then coalesce(public.tasneef_try_bigint_v10852(p_payload->>'open_duration_minutes')::integer,round(extract(epoch from (now_riyadh-existing.created_at))/60)::integer) else null end,
      processing_duration_minutes=case when new_status='closed' then coalesce(public.tasneef_try_bigint_v10852(p_payload->>'processing_duration_minutes')::integer,existing.processing_duration_minutes,0) else null end
    where id=p_ticket_id
    returning * into saved;
    tid:=saved.id;
  end if;

  if coalesce(saved.ticket_number,'')='' then
    update public.tickets set ticket_number='T-'||lpad(tid::text,4,'0') where id=tid returning * into saved;
  end if;

  return jsonb_build_object('ok',true,'ticket',to_jsonb(saved));
end$$;

grant execute on function public.tasneef_session_user_v10852(text) to anon,authenticated;
grant execute on function public.tasneef_distribution_supervisor_user_v10852(jsonb) to anon,authenticated;
grant execute on function public.tasneef_supervisor_has_project_v10852(bigint,bigint,date) to anon,authenticated;
grant execute on function public.tasneef_supervisor_save_ticket_v10852(text,bigint,jsonb,text) to anon,authenticated;

-- Refresh active supervisor permission bundles/sessions.
update public.app_users
set permissions_version=coalesce(permissions_version,1)+1,updated_at=now()
where lower(coalesce(role_key,role::text,'')) in ('supervisor','مشرف') and coalesce(is_active,true)=true;

update public.tasneef_permission_sessions_v10817 s
set permissions_version=u.permissions_version,last_seen_at=now()
from public.app_users u
where u.id=s.user_id and s.is_active=true
  and lower(coalesce(u.role_key,u.role::text,'')) in ('supervisor','مشرف');

commit;

select jsonb_build_object(
  'ok',true,
  'build','V10852',
  'save_rpc_ready',to_regprocedure('public.tasneef_supervisor_save_ticket_v10852(text,bigint,jsonb,text)') is not null,
  'synced_supervisor_project_scopes',(
    select count(*) from public.tasneef_user_project_access_v10817 where access_level='supervisor' and is_active=true
  )
) as result;
