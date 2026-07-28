-- Nacar Distribuição v2.9.3.1
-- Compatibilidade da auditoria e correção das configurações.
-- Não apaga produtos, clientes, usuários ou pedidos.

alter table public.audit_logs
  add column if not exists actor_email text,
  add column if not exists actor_name text,
  add column if not exists actor_role text;

create or replace function public.log_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_record jsonb;
  current_actor_id uuid;
  current_actor_email text;
  current_actor_name text;
  current_actor_role text;
begin
  current_actor_id := auth.uid();

  if current_actor_id is not null then
    select p.email, p.name, p.role::text
      into current_actor_email, current_actor_name, current_actor_role
    from public.profiles p
    where p.id = current_actor_id;
  end if;

  if tg_op = 'DELETE' then
    selected_record := to_jsonb(old);
  else
    selected_record := to_jsonb(new);
  end if;

  insert into public.audit_logs (
    table_name,
    record_id,
    action,
    actor_id,
    actor_email,
    actor_name,
    actor_role,
    old_data,
    new_data
  )
  values (
    tg_table_name,
    coalesce(selected_record ->> 'id', ''),
    tg_op,
    current_actor_id,
    current_actor_email,
    current_actor_name,
    current_actor_role,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

-- Remove triggers antigos conhecidos e recria somente um por tabela.
do $$
declare
  table_item text;
  trigger_item record;
begin
  foreach table_item in array array[
    'profiles',
    'customers',
    'orders',
    'seller_goals',
    'seller_product_goals',
    'whatsapp_templates',
    'app_settings'
  ]
  loop
    if to_regclass('public.' || table_item) is not null then
      for trigger_item in
        select t.tgname
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = table_item
          and not t.tgisinternal
          and t.tgname like 'audit_%'
      loop
        execute format('drop trigger if exists %I on public.%I', trigger_item.tgname, table_item);
      end loop;

      execute format(
        'create trigger audit_%I
         after insert or update or delete
         on public.%I
         for each row
         execute function public.log_audit_change()',
        table_item,
        table_item
      );
    end if;
  end loop;
end $$;
