-- Tasneef v10107 - Project Contract Smart Storage + schedule support
create table if not exists public.project_contract_smart (
  project_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.project_contract_smart enable row level security;

drop policy if exists "project_contract_smart_all_v10107" on public.project_contract_smart;
create policy "project_contract_smart_all_v10107"
on public.project_contract_smart
for all
using (true)
with check (true);

create index if not exists idx_project_contract_smart_updated_at_v10107
on public.project_contract_smart(updated_at);

-- فحص آخر 10 سجلات
select project_id, payload, updated_at
from public.project_contract_smart
order by updated_at desc
limit 10;
