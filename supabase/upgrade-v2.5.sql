-- Nacar Distribuição v2.5 - WhatsApp e follow-up avançado

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  context text not null default 'geral' check (context in ('geral','reativacao','orcamento','pedido','novidade')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('whatsapp','telefone','email','visita','outro')),
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  subject text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_templates_active_context_idx on public.whatsapp_templates(active,context,name);
create index if not exists crm_interactions_customer_created_idx on public.crm_interactions(customer_id,created_at desc);
create index if not exists crm_interactions_seller_created_idx on public.crm_interactions(seller_id,created_at desc);

alter table public.whatsapp_templates enable row level security;
alter table public.crm_interactions enable row level security;

do $$ begin
  create policy "whatsapp templates authenticated select" on public.whatsapp_templates for select
  to authenticated using(active=true or public.my_role()='admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "whatsapp templates admin all" on public.whatsapp_templates for all
  to authenticated using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm interactions admin all" on public.crm_interactions for all
  to authenticated using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm interactions seller select" on public.crm_interactions for select
  to authenticated using(seller_id=auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm interactions seller insert" on public.crm_interactions for insert
  to authenticated with check(seller_id=auth.uid() and created_by=auth.uid());
exception when duplicate_object then null; end $$;

insert into public.whatsapp_templates(name,message,context)
select * from (values
  ('Reativação de cliente','Olá, {cliente}! Tudo bem? Aqui é {vendedor}, da Nacar Distribuição. Faz um tempo que não conversamos. Posso te apresentar as novidades e montar uma sugestão de pedido?','reativacao'),
  ('Retorno de orçamento','Olá, {cliente}! Tudo bem? Estou retornando sobre o orçamento {pedido}. Posso ajustar quantidades ou condições para avançarmos?','orcamento'),
  ('Pedido aguardando retorno','Olá, {cliente}! Seu pedido {pedido} está aguardando seu retorno. Posso ajudar com alguma informação para concluirmos?','pedido'),
  ('Novidades do catálogo','Olá, {cliente}! Chegaram novidades no catálogo da Nacar Distribuição. Posso separar uma seleção de produtos para sua loja?','novidade'),
  ('Contato comercial','Olá, {cliente}! Tudo bem? Aqui é {vendedor}, da Nacar Distribuição. Posso ajudar com um novo pedido?','geral')
) as seed(name,message,context)
where not exists (select 1 from public.whatsapp_templates);
