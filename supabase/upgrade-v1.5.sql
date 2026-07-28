-- Nacar Distribuição v1.5 — usuários, vendedores e clientes
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists whatsapp text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.customers add column if not exists region text;
alter table public.customers add column if not exists notes text;

create index if not exists profiles_role_active_idx on public.profiles(role, active);
create index if not exists profiles_seller_id_idx on public.profiles(seller_id);
create index if not exists profiles_customer_id_idx on public.profiles(customer_id);
create index if not exists customers_seller_active_idx on public.customers(seller_id, active);

-- Vendedores podem consultar os próprios dados e a própria carteira.
do $$ begin
  create policy "seller reads own customers" on public.customers for select
  using(public.my_role()='vendedor' and seller_id=auth.uid());
exception when duplicate_object then null; end $$;

-- O cliente pode consultar o cadastro empresarial vinculado ao seu usuário.
do $$ begin
  create policy "client reads own customer" on public.customers for select
  using(id=(select customer_id from public.profiles where id=auth.uid()));
exception when duplicate_object then null; end $$;
