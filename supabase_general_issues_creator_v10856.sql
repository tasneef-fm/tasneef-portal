-- Tasneef V10856 — General Issues project + permanent ticket creator
-- Run once in Supabase SQL Editor AFTER V10852.
-- Non-destructive: preserves existing projects/tickets and backfills creator names when possible.

begin;

-- A) One shared ticket-only project available to management and all supervisors.
do $$
declare
  gp bigint;
begin
  select id into gp
  from public.projects
  where trim(coalesce(name,''))='مشاكل عامة'
  order by id
  limit 1;

  if gp is null then
    insert into public.projects(name,supervisor_id,status,is_active,notes)
    values(
      'مشاكل عامة',
      null,
      'active',
      true,
      'V10856: مشروع عام للتذاكر والمشاكل المشتركة فقط، غير مخصص للحضور أو التشغيل اليومي.'
    )
    returning id into gp;
  else
    update public.projects
    set is_active=true,
        status='active',
        supervisor_id=null,
        notes=case
          when coalesce(notes,'')='' then 'V10856: مشروع عام للتذاكر والمشاكل المشتركة فقط، غير مخصص للحضور أو التشغيل اليومي.'
          else notes
        end
    where id=gp;
  end if;

  -- Give every active supervisor explicit access to the shared ticket project.
  if to_regclass('public.tasneef_user_project_access_v10817') is not null then
    insert into public.tasneef_user_project_access_v10817(user_id,project_id,access_level,is_active,updated_at)
    select u.id,gp,'supervisor',true,now()
    from public.app_users u
    where coalesce(u.is_active,true)=true
      and coalesce(u.status,'active')='active'
      and lower(coalesce(to_jsonb(u)->>'role_key',to_jsonb(u)->>'role','')) in ('supervisor','مشرف')
    on conflict(user_id,project_id) do update
    set access_level='supervisor',is_active=true,updated_at=now();

    -- Technicians also receive the shared project when the access table accepts the technician level.
    begin
      insert into public.tasneef_user_project_access_v10817(user_id,project_id,access_level,is_active,updated_at)
      select u.id,gp,'technician',true,now()
      from public.app_users u
      where coalesce(u.is_active,true)=true
        and coalesce(u.status,'active')='active'
        and lower(coalesce(to_jsonb(u)->>'role_key',to_jsonb(u)->>'role','')) in ('technician','tech','فني')
      on conflict(user_id,project_id) do update
      set access_level='technician',is_active=true,updated_at=now();
    exception when others then
      raise notice 'V10856: technician project-access row skipped: %', SQLERRM;
    end;
  end if;
end$$;

-- B) Supervisor secure-save RPC: allow the shared "مشاكل عامة" project for every supervisor.
create or replace function public.tasneef_supervisor_has_project_v10852(
  p_user_id bigint,
  p_project_id bigint,
  p_on_date date default timezone('Asia/Riyadh',now())::date
)
returns boolean language sql stable security definer set search_path=public as $$
  select
    exists(
      select 1
      from public.projects p
      where p.id=p_project_id
        and trim(coalesce(p.name,''))='مشاكل عامة'
        and coalesce(p.is_active,true)=true
    )
    or exists(
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

grant execute on function public.tasneef_supervisor_has_project_v10852(bigint,bigint,date) to anon,authenticated;

-- C) Permanent creator identity. Editing a ticket must never replace its original creator.
alter table public.tickets add column if not exists created_by_name text;

update public.tickets t
set created_by_name=coalesce(nullif(trim(u.full_name),''),nullif(trim(u.username),''),u.id::text)
from public.app_users u
where t.created_by=u.id
  and coalesce(trim(t.created_by_name),'')='';

create or replace function public.tasneef_ticket_creator_stamp_v10856()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  creator_label text;
begin
  if tg_op='UPDATE' then
    -- Creator is immutable once recorded.
    if old.created_by is not null then
      new.created_by:=old.created_by;
    end if;
    if coalesce(trim(old.created_by_name),'')<>'' then
      new.created_by_name:=old.created_by_name;
    end if;
  end if;

  if new.created_by is not null and coalesce(trim(new.created_by_name),'')='' then
    select coalesce(nullif(trim(u.full_name),''),nullif(trim(u.username),''),u.id::text)
      into creator_label
    from public.app_users u
    where u.id=new.created_by
    limit 1;
    new.created_by_name:=coalesce(creator_label,new.created_by::text);
  end if;

  return new;
end$$;

drop trigger if exists trg_ticket_creator_stamp_v10856 on public.tickets;
create trigger trg_ticket_creator_stamp_v10856
before insert or update on public.tickets
for each row execute function public.tasneef_ticket_creator_stamp_v10856();

commit;

select jsonb_build_object(
  'ok',true,
  'build','V10856',
  'general_project_id',(
    select id from public.projects where trim(coalesce(name,''))='مشاكل عامة' order by id limit 1
  ),
  'general_project_name','مشاكل عامة',
  'creator_column_ready',exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tickets' and column_name='created_by_name'
  ),
  'creator_trigger_ready',exists(
    select 1 from pg_trigger
    where tgname='trg_ticket_creator_stamp_v10856' and not tgisinternal
  )
) as result;
