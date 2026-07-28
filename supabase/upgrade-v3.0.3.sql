create sequence if not exists public.proposal_number_seq start 1;
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  number bigint not null default nextval('public.proposal_number_seq'),
  customer_id uuid not null references public.customers(id),
  seller_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  status text not null default 'rascunho',
  valid_until date,
  payment_terms text,
  delivery_terms text,
  notes text,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  converted_order_id uuid references public.orders(id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  product_ean text,
  product_size text,
  quantity integer not null check(quantity > 0),
  unit_price numeric(14,2) not null,
  discount_percent numeric(6,2) not null default 0,
  total numeric(14,2) not null
);
create index if not exists proposals_customer_idx on public.proposals(customer_id, created_at desc);
create index if not exists proposals_seller_idx on public.proposals(seller_id, created_at desc);
create index if not exists proposal_items_proposal_idx on public.proposal_items(proposal_id);
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
drop policy if exists "proposals scoped select" on public.proposals;
create policy "proposals scoped select" on public.proposals for select to authenticated using (
  public.my_role()='admin' or seller_id=auth.uid() or customer_id=(select customer_id from public.profiles where id=auth.uid())
);
drop policy if exists "proposal items scoped select" on public.proposal_items;
create policy "proposal items scoped select" on public.proposal_items for select to authenticated using (
  exists(select 1 from public.proposals p where p.id=proposal_id and (public.my_role()='admin' or p.seller_id=auth.uid() or p.customer_id=(select customer_id from public.profiles where id=auth.uid())))
);
