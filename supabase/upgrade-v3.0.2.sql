-- Nacar Distribuição v3.0.2
-- Visitas, geolocalização, observações e fotos das lojas

create extension if not exists pgcrypto;

create table if not exists public.customer_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  start_latitude numeric(10,7),
  start_longitude numeric(10,7),
  end_latitude numeric(10,7),
  end_longitude numeric(10,7),
  accuracy_meters numeric(10,2),
  outcome text,
  notes text,
  next_action text,
  next_contact_at timestamptz,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida','cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_photos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  visit_id uuid references public.customer_visits(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists customer_visits_customer_started_idx
on public.customer_visits(customer_id, started_at desc);

create index if not exists customer_visits_seller_status_idx
on public.customer_visits(seller_id, status, started_at desc);

create index if not exists customer_photos_customer_created_idx
on public.customer_photos(customer_id, created_at desc);

alter table public.customer_visits enable row level security;
alter table public.customer_photos enable row level security;

drop policy if exists "visits admin all" on public.customer_visits;
create policy "visits admin all"
on public.customer_visits for all to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

drop policy if exists "visits seller own" on public.customer_visits;
create policy "visits seller own"
on public.customer_visits for all to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid() and created_by = auth.uid());

drop policy if exists "photos admin all" on public.customer_photos;
create policy "photos admin all"
on public.customer_photos for all to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

drop policy if exists "photos seller own" on public.customer_photos;
create policy "photos seller own"
on public.customer_photos for all to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_id and c.seller_id = auth.uid()
  )
)
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.customers c
    where c.id = customer_id and c.seller_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-photos',
  'customer-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Auditoria das novas estruturas, quando a função já existir.
do $$
begin
  if to_regprocedure('public.log_audit_change()') is not null then
    drop trigger if exists audit_customer_visits on public.customer_visits;
    create trigger audit_customer_visits
      after insert or update or delete on public.customer_visits
      for each row execute function public.log_audit_change();

    drop trigger if exists audit_customer_photos on public.customer_photos;
    create trigger audit_customer_photos
      after insert or update or delete on public.customer_photos
      for each row execute function public.log_audit_change();
  end if;
end $$;
