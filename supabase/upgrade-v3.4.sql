-- Nacar Distribuição v3.4 — Mapa Comercial e Roteiro de Visitas

alter table public.customers
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists visit_radius_meters integer not null default 300,
  add column if not exists location_validated_at timestamptz;

create table if not exists public.visit_routes (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  route_date date not null,
  status text not null default 'planejada' check (status in ('planejada','em_andamento','concluida','cancelada')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(seller_id, route_date)
);

create table if not exists public.visit_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.visit_routes(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  position integer not null default 1,
  priority_score integer not null default 0,
  priority_reason text,
  status text not null default 'pendente' check (status in ('pendente','em_visita','concluida','pulada')),
  visit_id uuid references public.customer_visits(id) on delete set null,
  planned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(route_id, customer_id)
);

create index if not exists customers_coordinates_idx on public.customers(latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists visit_routes_seller_date_idx on public.visit_routes(seller_id, route_date desc);
create index if not exists visit_route_stops_route_position_idx on public.visit_route_stops(route_id, position);

alter table public.visit_routes enable row level security;
alter table public.visit_route_stops enable row level security;

drop policy if exists "routes admin all" on public.visit_routes;
create policy "routes admin all" on public.visit_routes for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "routes seller own" on public.visit_routes;
create policy "routes seller own" on public.visit_routes for all to authenticated
using (seller_id=auth.uid()) with check (seller_id=auth.uid());

drop policy if exists "route stops admin all" on public.visit_route_stops;
create policy "route stops admin all" on public.visit_route_stops for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "route stops seller own" on public.visit_route_stops;
create policy "route stops seller own" on public.visit_route_stops for all to authenticated
using (exists(select 1 from public.visit_routes r where r.id=route_id and r.seller_id=auth.uid()))
with check (exists(select 1 from public.visit_routes r where r.id=route_id and r.seller_id=auth.uid()));
