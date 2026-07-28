-- Nacar Distribuição v3.1 — NACS Intelligence
-- Índices para acelerar as análises comerciais em tempo real.
create index if not exists intelligence_orders_customer_status_date_idx
on public.orders (customer_id, status, created_at desc);

create index if not exists intelligence_order_items_order_product_idx
on public.order_items (order_id, product_id);

create index if not exists intelligence_customers_seller_active_idx
on public.customers (seller_id, active);

create index if not exists intelligence_products_brand_category_idx
on public.products (brand, category, active);
