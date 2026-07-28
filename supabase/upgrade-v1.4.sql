-- Nacar Distribuição v1.4 - Carrinho e pedidos completos
alter table public.order_items add column if not exists notes text;
alter table public.orders add column if not exists submitted_at timestamptz;
alter table public.orders add column if not exists payment_terms text;
alter table public.orders add column if not exists customer_cnpj text;
alter table public.orders add column if not exists customer_city text;
alter table public.orders add column if not exists customer_state text;

create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists orders_status_idx on public.orders(status);

-- Cliente e vendedor podem atualizar somente os próprios rascunhos.
do $$ begin
  create policy "owner updates draft orders" on public.orders for update
  using(created_by=auth.uid() and status='rascunho')
  with check(created_by=auth.uid() and status in ('rascunho','novo'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "owner updates draft items" on public.order_items for update
  using(exists(select 1 from public.orders o where o.id=order_id and o.created_by=auth.uid() and o.status='rascunho'))
  with check(exists(select 1 from public.orders o where o.id=order_id and o.created_by=auth.uid() and o.status='rascunho'));
exception when duplicate_object then null; end $$;
