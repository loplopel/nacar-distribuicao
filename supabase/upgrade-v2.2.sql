-- Nacar Distribuição v2.2 - CRM Inteligente
create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  notes text,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','telefone','email','visita','outro')),
  status text not null default 'pendente' check (status in ('pendente','concluido','cancelado')),
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_followups_seller_due_idx on public.crm_followups(seller_id,status,due_at);
create index if not exists crm_followups_customer_idx on public.crm_followups(customer_id,created_at desc);

alter table public.crm_followups enable row level security;

do $$ begin
  create policy "crm followups admin all" on public.crm_followups for all
  using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm followups seller select" on public.crm_followups for select
  using(seller_id=auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm followups seller insert" on public.crm_followups for insert
  with check(seller_id=auth.uid() and created_by=auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm followups seller update" on public.crm_followups for update
  using(seller_id=auth.uid()) with check(seller_id=auth.uid());
exception when duplicate_object then null; end $$;
