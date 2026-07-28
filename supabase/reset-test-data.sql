-- LIMPEZA DE TESTE — preserva o administrador e o catálogo.
-- Execute apenas quando desejar reiniciar vendedores, clientes e pedidos.
begin;

delete from public.order_items;
delete from public.orders;

delete from public.profiles
where lower(email) <> lower('rodrigo.franco@nacar.com.br');

delete from public.customers;

delete from auth.users
where lower(email) <> lower('rodrigo.franco@nacar.com.br');

commit;
