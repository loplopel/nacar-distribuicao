-- Nacar Distribuição v3.3
-- Gestão de visitas e geolocalização

alter table public.customer_visits
  add column if not exists outcome_code text,
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

create index if not exists customer_visits_started_status_idx
on public.customer_visits(started_at desc, status);

create index if not exists customer_visits_outcome_idx
on public.customer_visits(outcome_code, started_at desc);

create index if not exists customer_visits_order_idx
on public.customer_visits(order_id) where order_id is not null;

create index if not exists customer_visits_proposal_idx
on public.customer_visits(proposal_id) where proposal_id is not null;
