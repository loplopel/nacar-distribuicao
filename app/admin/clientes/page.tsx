import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import CustomerForm from '@/components/CustomerForm';
import CustomerManager from '@/components/CustomerManager';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

export default async function Clientes() {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');

  const supabase = adminClient();
  const [{ data: customers, error: customersError }, { data: sellers }, { data: users }, { data: orders }] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('profiles').select('id,name').eq('role', 'vendedor').order('name'),
    supabase.from('profiles').select('id,customer_id').eq('role', 'cliente'),
    supabase.from('orders').select('id,customer_id'),
  ]);
  const sellerMap = new Map((sellers || []).map((seller) => [seller.id, seller.name]));
  const userCounts = new Map<string, number>();
  const orderCounts = new Map<string, number>();
  for (const user of users || []) if (user.customer_id) userCounts.set(user.customer_id, (userCounts.get(user.customer_id) || 0) + 1);
  for (const order of orders || []) if (order.customer_id) orderCounts.set(order.customer_id, (orderCounts.get(order.customer_id) || 0) + 1);
  const hydratedCustomers = (customers || []).map((customer) => ({
    ...customer,
    seller_name: customer.seller_id ? sellerMap.get(customer.seller_id) || null : null,
    users_count: userCounts.get(customer.id) || 0,
    orders_count: orderCounts.get(customer.id) || 0,
  }));

  return (
    <AppShell>
      <div className="page-head"><div><h1>Clientes</h1><p>Empresas, compradores vinculados, carteira e histórico comercial.</p></div><span className="count">{hydratedCustomers.length} empresas</span></div>
      {customersError && <div className="error">Erro ao carregar clientes: {customersError.message}</div>}
      <CustomerForm sellers={sellers || []} />
      <CustomerManager customers={hydratedCustomers as any} sellers={sellers || []} />
    </AppShell>
  );
}
