-- Nacar Distribuição v2.0 — índices para o Dashboard Inteligente
create index if not exists orders_created_at_status_idx
  on public.orders(created_at desc, status);

create index if not exists orders_seller_status_created_idx
  on public.orders(seller_id, status, created_at desc);

create index if not exists customers_seller_active_idx
  on public.customers(seller_id, active);

create index if not exists order_items_product_order_idx
  on public.order_items(product_id, order_id);
