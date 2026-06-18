-- Tasneef v10152 - نظام تحضير العمال وتوزيعهم على المشاريع والأوقات الشهرية
create extension if not exists pgcrypto;

create table if not exists public.daily_worker_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_date date not null,
  supervisor_key text not null,
  supervisor_name text,
  worker_key text not null,
  worker_name text not null,
  status text not null default 'present',
  prepared_at timestamptz default now(),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(attendance_date, supervisor_key, worker_key)
);

create table if not exists public.project_work_groups (
  id uuid primary key default gen_random_uuid(),
  group_key text unique not null,
  group_name text not null,
  allocation jsonb not null default '[]'::jsonb,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.worker_project_movements (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique,
  movement_date date not null,
  supervisor_key text not null,
  supervisor_name text,
  worker_key text not null,
  worker_name text not null,
  target_type text not null default 'project', -- project / group
  project_key text,
  project_name text not null,
  group_key text,
  group_name text,
  allocation jsonb not null default '[]'::jsonb,
  visit_type text default 'surface',
  start_at timestamptz not null,
  end_at timestamptz,
  actual_minutes numeric default 0,
  status text not null default 'open', -- open / closed
  close_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_daily_worker_attendance_date_sup on public.daily_worker_attendance(attendance_date, supervisor_key);
create index if not exists idx_worker_project_movements_month on public.worker_project_movements(movement_date, supervisor_key, worker_key);
create index if not exists idx_worker_project_movements_open on public.worker_project_movements(worker_key, status) where status='open';

insert into public.project_work_groups(group_key, group_name, allocation, is_active, notes)
values (
  'shaalan_50_51',
  'الشعلان 50/51',
  '[{"project_key":"الشعلان 50","project_name":"الشعلان 50","percent":50},{"project_key":"الشعلان 51","project_name":"الشعلان 51","percent":50}]'::jsonb,
  true,
  'مجموعة مشتركة: يتم توزيع وقت العامل بالتساوي بين الشعلان 50 والشعلان 51'
)
on conflict (group_key) do update set
  group_name=excluded.group_name,
  allocation=excluded.allocation,
  is_active=true,
  updated_at=now();
