-- Nacar Distribuição v1.2
-- Permite variações com o mesmo PLU e adiciona os campos exatos da planilha Google.

alter table public.products
  add column if not exists source_key text,
  add column if not exists minimum_price numeric(12,2) not null default 0;

-- O mesmo PLU pode aparecer em vários tamanhos/EANs.
alter table public.products drop constraint if exists products_plu_key;

-- Cria uma chave estável por variação.
update public.products
set source_key = coalesce(nullif(ean, ''), plu || '-' || coalesce(size, ''))
where source_key is null;

create unique index if not exists products_source_key_unique
  on public.products(source_key);

create index if not exists products_plu_idx on public.products(plu);
create index if not exists products_ean_idx on public.products(ean);
