-- Nacar Distribuição v2.9.3 - Relatórios, configurações e auditoria

create table if not exists public.app_settings (
  id text primary key default 'main',
  company_name text not null default 'Grupo Nacar',
  system_name text not null default 'Nacar Distribuição B2B',
  company_email text,
  company_whatsapp text,
  company_cnpj text,
  sheet_url text,
  primary_color text not null default '#f15a24',
  secondary_color text not null default '#353638',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.app_settings(id)
values ('main')
on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id bigserial primary key,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid references public.profiles(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_table_idx on public.audit_logs(table_name,created_at desc);

create or replace function public.log_audit_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.audit_logs(table_name,record_id,action,actor_id,old_data,new_data)
  values (
    tg_table_name,
    coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','customers','orders','seller_goals','seller_product_goals','whatsapp_templates']
  loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.log_audit_change()', t, t);
  end loop;
end $$;

alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

do $$ begin
  create policy "settings admin all" on public.app_settings for all to authenticated
  using(public.my_role()='admin') with check(public.my_role()='admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "audit admin select" on public.audit_logs for select to authenticated
  using(public.my_role()='admin');
exception when duplicate_object then null; end $$;
