-- Nacar Distribuição v2.1 - Carrinho profissional e histórico de pedidos
alter table public.orders add column if not exists quote_requested_at timestamptz;
alter table public.orders add column if not exists duplicated_from uuid references public.orders(id) on delete set null;

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at);
create index if not exists orders_duplicated_from_idx on public.orders(duplicated_from);

alter table public.order_events enable row level security;

do $$ begin
  create policy "order events visible with order" on public.order_events for select
  using(exists(
    select 1 from public.orders o
    where o.id=order_id and (
      public.my_role()='admin' or
      o.created_by=auth.uid() or
      o.seller_id=auth.uid()
    )
  ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated creates order events" on public.order_events for insert
  with check(auth.uid() is not null);
exception when duplicate_object then null; end $$;


-- Permite editar e substituir itens de rascunhos.
do $$ begin
  create policy "owner deletes draft items" on public.order_items for delete
  using(exists(select 1 from public.orders o where o.id=order_id and o.created_by=auth.uid() and o.status='rascunho'));
exception when duplicate_object then null; end $$;

-- Permite que um rascunho seja salvo, enviado ou transformado em orçamento.
do $$ begin
  create policy "owner submits draft orders v21" on public.orders for update
  using(created_by=auth.uid() and status='rascunho')
  with check(created_by=auth.uid() and status in ('rascunho','novo','orcamento'));
exception when duplicate_object then null; end $$;
