-- Nacar Distribuição v2.3.1 - Metas mensais por produto/categoria
create table if not exists public.seller_product_goals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  goal_name text not null,
  brand text,
  category text,
  name_starts_with text,
  quantity_goal integer not null default 0 check (quantity_goal >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_product_goals_seller_month_idx
  on public.seller_product_goals (seller_id, month desc);

create index if not exists seller_product_goals_active_idx
  on public.seller_product_goals (active);

alter table public.seller_product_goals enable row level security;

drop policy if exists "seller product goals admin all" on public.seller_product_goals;
create policy "seller product goals admin all"
on public.seller_product_goals for all
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

drop policy if exists "seller product goals own select" on public.seller_product_goals;
create policy "seller product goals own select"
on public.seller_product_goals for select
to authenticated
using (seller_id = auth.uid() or public.my_role() = 'admin');
