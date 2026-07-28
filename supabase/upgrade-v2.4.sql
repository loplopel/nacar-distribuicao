-- v2.4 — índices para o Dashboard Gerencial
create index if not exists orders_created_status_seller_idx
  on public.orders (created_at desc, status, seller_id);

create index if not exists order_items_order_product_idx
  on public.order_items (order_id, product_id);

create index if not exists customers_active_seller_idx
  on public.customers (active, seller_id);

create index if not exists crm_followups_due_status_idx
  on public.crm_followups (due_at, status, seller_id);

create index if not exists seller_product_goals_month_seller_idx
  on public.seller_product_goals (month, seller_id, active);
