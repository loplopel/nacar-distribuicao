-- Nacar Distribuição v1.0 - complemento seguro para o schema já executado
alter table public.customers add column if not exists trade_name text;
alter table public.customers add column if not exists whatsapp text;
alter table public.customers add column if not exists payment_terms text;
alter table public.customers add column if not exists credit_limit numeric(12,2) not null default 0;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.products add column if not exists category text;
alter table public.orders add column if not exists customer_name text;

create index if not exists products_brand_idx on public.products(brand);
create index if not exists products_name_idx on public.products(name);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_seller_idx on public.orders(seller_id);
create index if not exists orders_customer_idx on public.orders(customer_id);

-- Admin pode gerenciar dados. Policies duplicadas são ignoradas pelo bloco DO.
do $$ begin
  create policy "admin manages profiles" on public.profiles for all using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manages customers" on public.customers for all using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin manages products" on public.products for all using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin updates orders" on public.orders for update using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;

-- Vendedor pode consultar clientes vinculados e criar pedidos para eles.
do $$ begin
  create policy "seller creates orders" on public.orders for insert with check(public.my_role()='vendedor' and seller_id=auth.uid() and created_by=auth.uid());
exception when duplicate_object then null; end $$;
