-- Nacar Distribuição v3.0.1 — Perfil 360°
-- Apenas índices para acelerar a visão consolidada da empresa.
create index if not exists orders_customer_created_v301_idx on public.orders(customer_id, created_at desc);
create index if not exists order_items_order_product_v301_idx on public.order_items(order_id, product_id);
create index if not exists crm_interactions_customer_created_v301_idx on public.crm_interactions(customer_id, created_at desc);
create index if not exists crm_followups_customer_due_v301_idx on public.crm_followups(customer_id, due_at desc);
