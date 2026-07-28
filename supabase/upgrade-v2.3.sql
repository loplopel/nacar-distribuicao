create table if not exists public.seller_goals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  revenue_goal numeric(14,2) not null default 0 check (revenue_goal >= 0),
  orders_goal integer not null default 0 check (orders_goal >= 0),
  customers_goal integer not null default 0 check (customers_goal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, month)
);

create index if not exists seller_goals_seller_month_idx
  on public.seller_goals (seller_id, month desc);

alter table public.seller_goals enable row level security;

drop policy if exists "seller goals admin all" on public.seller_goals;
create policy "seller goals admin all"
on public.seller_goals for all
to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "seller goals own select" on public.seller_goals;
create policy "seller goals own select"
on public.seller_goals for select
to authenticated
using (seller_id = auth.uid());
