import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');
  const { id } = await params;
  const supabase = adminClient();

  const [{ data: customer }, { data: users }, { data: orders }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('profiles').select('id,name,email,job_title,phone,whatsapp,active').eq('customer_id', id).order('name'),
    supabase.from('orders').select('id,number,status,total,created_at,customer_name').eq('customer_id', id).order('created_at', { ascending: false }).limit(100),
  ]);

  if (!customer) notFound();
  const totalOrders = (orders || []).reduce((sum, order) => sum + Number(order.total || 0), 0);

  return (
    <AppShell>
      <Link className="back-link" href="/admin/clientes">← Voltar para clientes</Link>
      <div className="page-head company-head">
        <div><h1>{customer.name}</h1><p>{customer.legal_name || 'Empresa cliente'} · {customer.cnpj || 'CNPJ não informado'}</p></div>
        <span className={customer.active ? 'badge' : 'badge warn'}>{customer.active ? 'Ativo' : 'Inativo'}</span>
      </div>

      <div className="grid grid-4 company-kpis">
        <div className="card kpi"><span>Compradores vinculados</span><b>{users?.length || 0}</b><small>Usuários da empresa</small></div>
        <div className="card kpi"><span>Pedidos</span><b>{orders?.length || 0}</b><small>Últimos 100 pedidos</small></div>
        <div className="card kpi"><span>Total em pedidos</span><b>{money.format(totalOrders)}</b><small>Histórico carregado</small></div>
        <div className="card kpi"><span>Condição</span><b className="kpi-text">{customer.payment_terms || '-'}</b><small>{customer.city || '-'} / {customer.state || '-'}</small></div>
      </div>

      <div className="card company-info">
        <div className="card-title"><div><h2>Dados da empresa</h2><p>Cadastro comercial central da conta.</p></div></div>
        <dl className="detail-list">
          <div><dt>Razão social</dt><dd>{customer.legal_name || '-'}</dd></div>
          <div><dt>CNPJ</dt><dd>{customer.cnpj || '-'}</dd></div>
          <div><dt>E-mail</dt><dd>{customer.email || '-'}</dd></div>
          <div><dt>Telefone / WhatsApp</dt><dd>{customer.phone || '-'} · {customer.whatsapp || '-'}</dd></div>
          <div><dt>Região</dt><dd>{customer.region || '-'}</dd></div>
          <div><dt>Limite de crédito</dt><dd>{money.format(Number(customer.credit_limit || 0))}</dd></div>
        </dl>
      </div>

      <div className="card table-wrap">
        <div className="card-title"><div><h2>Compradores vinculados</h2><p>Uma empresa pode possuir vários usuários compradores.</p></div><Link className="btn btn-primary" href="/admin/usuarios">Gerenciar usuários</Link></div>
        {!users?.length ? <div className="empty">Nenhum comprador vinculado a esta empresa.</div> : <table className="table">
          <thead><tr><th>Usuário</th><th>Cargo</th><th>Contato</th><th>Situação</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}><td><b>{user.name}</b><small>{user.email}</small></td><td>{user.job_title || '-'}</td><td>{user.whatsapp || user.phone || '-'}</td><td><span className={user.active ? 'badge' : 'badge warn'}>{user.active ? 'Ativo' : 'Inativo'}</span></td></tr>)}</tbody>
        </table>}
      </div>

      <div className="card table-wrap">
        <div className="card-title"><div><h2>Histórico de pedidos</h2><p>Pedidos realizados por qualquer comprador vinculado à empresa.</p></div></div>
        {!orders?.length ? <div className="empty">Nenhum pedido registrado para esta empresa.</div> : <table className="table">
          <thead><tr><th>Pedido</th><th>Data</th><th>Status</th><th>Total</th><th></th></tr></thead>
          <tbody>{orders.map((order) => <tr key={order.id}><td><b>Pedido nº {String(order.number).padStart(6, '0')}</b></td><td>{date.format(new Date(order.created_at))}</td><td><span className={`badge status-${order.status}`}>{String(order.status).replace('_', ' ')}</span></td><td><b>{money.format(Number(order.total || 0))}</b></td><td><Link className="table-link" href={`/pedidos/${order.id}`}>Ver pedido</Link></td></tr>)}</tbody>
        </table>}
      </div>
    </AppShell>
  );
}
