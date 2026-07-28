-- Nacar Distribuição v3.3.1
-- Validação de GPS mobile, exceções justificadas e precisão final

alter table public.customer_visits
  add column if not exists start_gps_error_code text,
  add column if not exists start_without_gps_reason text,
  add column if not exists start_without_gps_details text,
  add column if not exists end_accuracy_meters numeric,
  add column if not exists end_gps_error_code text,
  add column if not exists end_without_gps_reason text,
  add column if not exists end_without_gps_details text;

create index if not exists customer_visits_start_without_gps_idx
  on public.customer_visits (start_without_gps_reason, started_at desc)
  where start_latitude is null;

create index if not exists customer_visits_end_without_gps_idx
  on public.customer_visits (end_without_gps_reason, finished_at desc)
  where finished_at is not null and end_latitude is null;
