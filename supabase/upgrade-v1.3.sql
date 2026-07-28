create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer not null default 0,
  products_read integer not null default 0,
  products_created integer not null default 0,
  products_updated integer not null default 0,
  products_disabled integer not null default 0,
  status text not null default 'running' check (status in ('running','success','error')),
  error_message text,
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  banner_url text,
  description text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sync_logs enable row level security;
alter table public.brands enable row level security;

drop policy if exists "sync logs admin" on public.sync_logs;
create policy "sync logs admin" on public.sync_logs for select using (public.my_role()='admin');

drop policy if exists "brands authenticated" on public.brands;
create policy "brands authenticated" on public.brands for select to authenticated using (active=true or public.my_role()='admin');

create index if not exists products_brand_idx on public.products(brand);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_stock_idx on public.products(stock);
create index if not exists products_active_idx on public.products(active);
create index if not exists products_name_lower_idx on public.products(lower(name));
create index if not exists sync_logs_started_at_idx on public.sync_logs(started_at desc);

insert into public.brands(name,slug)
select distinct trim(brand), lower(regexp_replace(trim(brand), '[^a-zA-Z0-9]+', '-', 'g'))
from public.products
where brand is not null and trim(brand) <> ''
on conflict (name) do nothing;
