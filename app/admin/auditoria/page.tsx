import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const labels: Record<string, string> = {
  profiles: 'Usuários',
  customers: 'Empresas',
  products: 'Produtos',
  orders: 'Pedidos',
  seller_goals: 'Metas',
  seller_product_goals: 'Metas por produto',
  whatsapp_templates: 'WhatsApp',
  app_settings: 'Configurações',
};

export default async function AuditPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');

  const db = adminClient();
  const { data, error } = await db
    .from('audit_logs')
    .select('id,table_name,record_id,action,created_at,actor_email,actor_name,actor_role,actor:profiles(name,email)')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <AppShell>
      <div className="page-head"><div><span className="eyebrow">SISTEMA</span><h1>Auditoria</h1><p>Últimas alterações registradas nas principais áreas do sistema.</p></div></div>
      {error && <div className="notice error">{error.message}</div>}
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Data</th><th>Área</th><th>Ação</th><th>Usuário</th><th>Registro</th></tr></thead>
          <tbody>
            {(data || []).map((item: any) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                <td>{labels[item.table_name] || item.table_name}</td>
                <td><span className={`audit-action ${item.action.toLowerCase()}`}>{item.action}</span></td>
                <td>{item.actor_name || item.actor?.name || item.actor_email || item.actor?.email || 'Sistema'}<small>{item.actor_role || ''}</small></td>
                <td><small>{item.record_id || '-'}</small></td>
              </tr>
            ))}
            {!data?.length && !error && <tr><td colSpan={5}>Nenhuma alteração registrada após a instalação desta versão.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
