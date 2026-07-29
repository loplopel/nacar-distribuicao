-- Nacar Distribuição v3.6 — Implantação da Base Comercial Real
-- Execute uma única vez antes do script de implantação.
-- Não remove dados. Apenas prepara campos de integração/importação.

alter table public.customers
  add column if not exists erp_code text,
  add column if not exists erp_custom_code text,
  add column if not exists source_seller_name text,
  add column if not exists last_purchase_at date,
  add column if not exists last_purchase_value numeric(14,2),
  add column if not exists data_quality text;

create unique index if not exists customers_erp_code_unique_idx
  on public.customers(erp_code)
  where erp_code is not null and btrim(erp_code) <> '';

create index if not exists customers_last_purchase_idx
  on public.customers(last_purchase_at desc);

create index if not exists customers_source_seller_idx
  on public.customers(source_seller_name);
