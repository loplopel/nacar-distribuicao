-- Nacar Distribuição v1.6 — empresas, múltiplos usuários e histórico
create index if not exists orders_customer_id_created_at_idx
  on public.orders(customer_id, created_at desc);

create index if not exists orders_seller_id_created_at_idx
  on public.orders(seller_id, created_at desc);

create index if not exists profiles_customer_active_idx
  on public.profiles(customer_id, active);
