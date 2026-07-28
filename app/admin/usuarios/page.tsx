import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';
import UserCreateForm from '@/components/UserCreateForm';
import UserManager from '@/components/UserManager';

export default async function Usuarios() {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');

  const supabase = adminClient();
  const [{ data: users, error: usersError }, { data: sellers }, { data: customers }] = await Promise.all([
    supabase.from('profiles').select('*').order('name'),
    supabase.from('profiles').select('id,name').eq('role', 'vendedor').order('name'),
    supabase.from('customers').select('id,name,active').order('name'),
  ]);

  const sellerMap = new Map((sellers || []).map((seller) => [seller.id, seller.name]));
  const customerMap = new Map((customers || []).map((customer) => [customer.id, customer.name]));
  const hydratedUsers = (users || []).map((user) => ({
    ...user,
    seller_name: user.seller_id ? sellerMap.get(user.seller_id) || null : null,
    customer_name: user.customer_id ? customerMap.get(user.customer_id) || null : null,
  }));

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <p>Acessos, vínculos, situação, edição e redefinição de senha.</p>
        </div>
        <span className="count">{hydratedUsers.length} usuários</span>
      </div>
      {usersError && <div className="error">Erro ao carregar usuários: {usersError.message}</div>}
      <UserCreateForm sellers={sellers || []} customers={(customers || []).filter((customer) => customer.active)} />
      <UserManager users={hydratedUsers as any} sellers={sellers || []} customers={customers || []} />
    </AppShell>
  );
}
