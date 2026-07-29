-- Nacar Distribuição v3.7 — Importação de Pedidos Históricos
-- Não altera estoque e não modifica pedidos já existentes.

alter table public.orders
  add column if not exists is_historical boolean not null default false,
  add column if not exists import_source text,
  add column if not exists import_key text;

create unique index if not exists orders_import_key_unique_idx
  on public.orders(import_key)
  where import_key is not null and btrim(import_key) <> '';

create index if not exists orders_historical_idx
  on public.orders(is_historical, created_at desc);

alter table public.order_items
  add column if not exists source_plu text,
  add column if not exists source_product_name text;
