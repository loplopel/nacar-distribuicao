import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { createClient, getCurrentProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  number: number;
  total: number | string;
  status: string;
  created_at: string;
  customer_id: string | null;
  seller_id: string | null;
  customer_name: string | null;
  customers?: { name?: string | null; trade_name?: string | null } | null;
  seller?: { name?: string | null } | null;
};

type CustomerRow = {
  id: string;
  name: string;
  trade_name: string | null;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  seller_id: string | null;
  active: boolean;
};

type ItemRow = {
  quantity: number;
  unit_price: number | string;
  product_id: string;
  orders?: { status?: string; created_at?: string; seller_id?: string | null } | null;
  products?: { name?: string | null; brand?: string | null } | null;
};

const validStatuses = new Set(['novo', 'em_analise', 'aprovado', 'faturado']);
const openStatuses = new Set(['novo', 'em_analise']);

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameOrAfter(value: string, date: Date) {
  return new Date(value).getTime() >= date.getTime();
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export default async function Dashboard() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === 'cliente') redirect('/catalogo');

  const scopedClient = profile.role === 'admin' ? adminClient() : await createClient();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const dayStart = startOfDay(now);
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  let ordersQuery = scopedClient
    .from('orders')
    .select('id,number,total,status,created_at,customer_id,seller_id,customer_name,customers(name,trade_name),seller:profiles!orders_seller_id_fkey(name)')
    .order('created_at', { ascending: false });

  let customersQuery = scopedClient
    .from('customers')
    .select('id,name,trade_name,city,state,whatsapp,seller_id,active')
    .eq('active', true)
    .order('name');

  let itemsQuery = scopedClient
    .from('order_items')
    .select('quantity,unit_price,product_id,products(name,brand),orders!inner(status,created_at,seller_id)')
    .gte('orders.created_at', monthStart.toISOString());

  if (profile.role === 'vendedor') {
    ordersQuery = ordersQuery.eq('seller_id', profile.id);
    customersQuery = customersQuery.eq('seller_id', profile.id);
    itemsQuery = itemsQuery.eq('orders.seller_id', profile.id);
  }

  const [ordersResult, customersResult, itemsResult, profilesResult, productsResult] = await Promise.all([
    ordersQuery,
    customersQuery,
    itemsQuery,
    profile.role === 'admin'
      ? adminClient().from('profiles').select('id,name,role,active').eq('role', 'vendedor').eq('active', true)
      : Promise.resolve({ data: [] as any[], error: null }),
    scopedClient.from('products').select('id,stock,status,active').eq('active', true),
  ]);

  const orders = (ordersResult.data || []) as unknown as OrderRow[];
  const customers = (customersResult.data || []) as CustomerRow[];
  const items = (itemsResult.data || []) as unknown as ItemRow[];
  const sellers = (profilesResult.data || []) as { id: string; name: string }[];
  const products = productsResult.data || [];

  const validOrders = orders.filter((order) => validStatuses.has(order.status));
  const monthOrders = validOrders.filter((order) => sameOrAfter(order.created_at, monthStart));
  const todayOrders = validOrders.filter((order) => sameOrAfter(order.created_at, dayStart));
  const monthRevenue = monthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const ticket = monthOrders.length ? monthRevenue / monthOrders.length : 0;
  const openOrders = orders.filter((order) => openStatuses.has(order.status));
  const activeProducts = products.length;
  const outOfStock = products.filter((product: any) => Number(product.stock) <= 0).length;

  const lastOrderByCustomer = new Map<string, OrderRow>();
  for (const order of validOrders) {
    if (!order.customer_id || lastOrderByCustomer.has(order.customer_id)) continue;
    lastOrderByCustomer.set(order.customer_id, order);
  }

  const inactiveCustomers = customers
    .map((customer) => {
      const lastOrder = lastOrderByCustomer.get(customer.id);
      const days = lastOrder
        ? Math.floor((now.getTime() - new Date(lastOrder.created_at).getTime()) / 86400000)
        : null;
      return { customer, lastOrder, days };
    })
    .filter((entry) => entry.days === null || entry.days > 30)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
    .slice(0, 8);

  const sellerStats = new Map<string, { name: string; total: number; orders: number }>();
  for (const seller of sellers) sellerStats.set(seller.id, { name: seller.name, total: 0, orders: 0 });
  for (const order of monthOrders) {
    if (!order.seller_id) continue;
    const current = sellerStats.get(order.seller_id) || {
      name: order.seller?.name || 'Vendedor',
      total: 0,
      orders: 0,
    };
    current.total += Number(order.total || 0);
    current.orders += 1;
    sellerStats.set(order.seller_id, current);
  }
  const ranking = [...sellerStats.values()].sort((a, b) => b.total - a.total).slice(0, 6);

  const customerStats = new Map<string, { name: string; total: number; orders: number }>();
  for (const order of monthOrders) {
    const key = order.customer_id || order.customer_name || order.id;
    const name = order.customers?.trade_name || order.customers?.name || order.customer_name || 'Cliente';
    const current = customerStats.get(key) || { name, total: 0, orders: 0 };
    current.total += Number(order.total || 0);
    current.orders += 1;
    customerStats.set(key, current);
  }
  const topCustomers = [...customerStats.values()].sort((a, b) => b.total - a.total).slice(0, 6);

  const productStats = new Map<string, { name: string; brand: string; quantity: number; total: number }>();
  for (const item of items) {
    if (!item.orders || !validStatuses.has(item.orders.status || '')) continue;
    const current = productStats.get(item.product_id) || {
      name: item.products?.name || 'Produto',
      brand: item.products?.brand || '-',
      quantity: 0,
      total: 0,
    };
    current.quantity += Number(item.quantity || 0);
    current.total += Number(item.quantity || 0) * Number(item.unit_price || 0);
    productStats.set(item.product_id, current);
  }
  const topProducts = [...productStats.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6);

  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const total = validOrders
      .filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
      })
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      total,
    };
  });
  const maxMonthly = Math.max(...monthly.map((entry) => entry.total), 1);

  return (
    <AppShell>
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">PAINEL COMERCIAL</span>
          <h1>{profile.role === 'admin' ? 'Visão geral da distribuição' : `Olá, ${profile.name}`}</h1>
          <p>
            {profile.role === 'admin'
              ? 'Acompanhe pedidos, carteira de clientes, desempenho dos vendedores e produtos.'
              : 'Veja sua carteira, seus resultados do mês e quais clientes precisam de atenção.'}
          </p>
        </div>
        <div className="dashboard-date">
          <Clock3 size={18} />
          <span>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
        </div>
      </div>

      <section className="dashboard-kpis">
        <div className="dash-kpi accent-orange">
          <div className="dash-kpi-icon"><WalletCards size={22} /></div>
          <span>Vendas no mês</span>
          <strong>{money(monthRevenue)}</strong>
          <small>{monthOrders.length} pedidos válidos</small>
        </div>
        <div className="dash-kpi accent-green">
          <div className="dash-kpi-icon"><TrendingUp size={22} /></div>
          <span>Vendas hoje</span>
          <strong>{money(todayRevenue)}</strong>
          <small>{todayOrders.length} pedidos hoje</small>
        </div>
        <div className="dash-kpi accent-blue">
          <div className="dash-kpi-icon"><ReceiptText size={22} /></div>
          <span>Ticket médio</span>
          <strong>{money(ticket)}</strong>
          <small>média por pedido no mês</small>
        </div>
        <div className="dash-kpi accent-red">
          <div className="dash-kpi-icon"><AlertTriangle size={22} /></div>
          <span>Pedidos aguardando</span>
          <strong>{openOrders.length}</strong>
          <small>novos ou em análise</small>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="card dashboard-chart-card">
          <div className="dashboard-card-head">
            <div><h2>Evolução das vendas</h2><p>Últimos seis meses, sem pedidos cancelados.</p></div>
            <span className="mini-pill"><TrendingUp size={14} /> {money(monthRevenue)}</span>
          </div>
          <div className="bar-chart" aria-label="Vendas dos últimos seis meses">
            {monthly.map((entry) => (
              <div className="bar-column" key={entry.label}>
                <span className="bar-value">{entry.total ? money(entry.total) : 'R$ 0'}</span>
                <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max((entry.total / maxMonthly) * 100, entry.total ? 8 : 2)}%` }} /></div>
                <b>{entry.label}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="card dashboard-status-card">
          <div className="dashboard-card-head"><div><h2>Etapas dos pedidos</h2><p>Volume atual por status.</p></div></div>
          <div className="dashboard-status-list">
            {[
              ['rascunho', 'Rascunhos'],
              ['novo', 'Novos'],
              ['em_analise', 'Em análise'],
              ['aprovado', 'Aprovados'],
              ['faturado', 'Faturados'],
              ['cancelado', 'Cancelados'],
            ].map(([status, label]) => {
              const count = orders.filter((order) => order.status === status).length;
              const percentage = orders.length ? Math.round((count / orders.length) * 100) : 0;
              return <div key={status} className="status-progress-row">
                <div><span className={`status-dot status-dot-${status}`} /><b>{label}</b><small>{percentage}%</small></div>
                <strong>{count}</strong>
              </div>;
            })}
          </div>
          <Link href={profile.role === 'admin' ? '/admin/pedidos' : '/pedidos'} className="dashboard-link">Ver todos os pedidos <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="dashboard-secondary-grid">
        <div className="card dashboard-list-card">
          <div className="dashboard-card-head">
            <div><h2>{profile.role === 'admin' ? 'Ranking de vendedores' : 'Clientes com maior compra'}</h2><p>Resultado acumulado no mês atual.</p></div>
            {profile.role === 'admin' ? <Users size={20} /> : <Building2 size={20} />}
          </div>
          <div className="ranking-list">
            {(profile.role === 'admin' ? ranking : topCustomers).map((entry: any, index) => (
              <div className="ranking-row" key={`${entry.name}-${index}`}>
                <span className={`ranking-position position-${index + 1}`}>{index + 1}</span>
                <div><b>{entry.name}</b><small>{entry.orders} pedido{entry.orders === 1 ? '' : 's'}</small></div>
                <strong>{money(entry.total)}</strong>
              </div>
            ))}
            {!(profile.role === 'admin' ? ranking : topCustomers).length && <div className="dashboard-empty">Ainda não há vendas no mês.</div>}
          </div>
        </div>

        <div className="card dashboard-list-card">
          <div className="dashboard-card-head"><div><h2>Produtos mais pedidos</h2><p>Itens com maior quantidade no mês.</p></div><PackageCheck size={20} /></div>
          <div className="ranking-list compact-ranking">
            {topProducts.map((entry, index) => (
              <div className="ranking-row" key={`${entry.name}-${index}`}>
                <span className="ranking-position">{index + 1}</span>
                <div><b>{entry.name}</b><small>{entry.brand}</small></div>
                <strong>{entry.quantity} un.</strong>
              </div>
            ))}
            {!topProducts.length && <div className="dashboard-empty">Nenhum produto vendido no mês.</div>}
          </div>
        </div>

        <div className="card dashboard-list-card attention-card">
          <div className="dashboard-card-head"><div><h2>Clientes sem comprar</h2><p>Sem pedido há mais de 30 dias.</p></div><AlertTriangle size={20} /></div>
          <div className="attention-list">
            {inactiveCustomers.map(({ customer, days }) => (
              <div className="attention-row" key={customer.id}>
                <div className="customer-avatar">{(customer.trade_name || customer.name).slice(0, 1).toUpperCase()}</div>
                <div><b>{customer.trade_name || customer.name}</b><small>{customer.city ? `${customer.city}${customer.state ? `/${customer.state}` : ''}` : 'Local não informado'}</small></div>
                <span className={days === null || days > 60 ? 'danger-days' : 'warning-days'}>{days === null ? 'Sem compras' : `${days} dias`}</span>
              </div>
            ))}
            {!inactiveCustomers.length && <div className="dashboard-empty"><CheckCircle2 size={20} /> Toda a carteira comprou nos últimos 30 dias.</div>}
          </div>
          <Link href={profile.role === 'admin' ? '/admin/clientes' : '/clientes'} className="dashboard-link">Ver carteira de clientes <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <div className="card recent-orders-card">
          <div className="dashboard-card-head"><div><h2>Pedidos recentes</h2><p>Últimas movimentações comerciais.</p></div><ShoppingCart size={20} /></div>
          <div className="table-wrap">
            <table className="table dashboard-table mobile-data-table recent-orders-mobile-table">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Status</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {orders.slice(0, 7).map((order) => (
                  <tr key={order.id}>
                    <td data-label="Pedido"><b>#{String(order.number).padStart(6, '0')}</b></td>
                    <td data-label="Cliente">{order.customers?.trade_name || order.customers?.name || order.customer_name || '-'}</td>
                    <td data-label="Data">{dateLabel(order.created_at)}</td>
                    <td data-label="Status"><span className={`badge status-${order.status}`}>{statusLabel(order.status)}</span></td>
                    <td data-label="Total"><b>{money(Number(order.total || 0))}</b></td>
                    <td data-label="Ação"><Link className="table-link" href={`/pedidos/${order.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && <div className="dashboard-empty">Nenhum pedido registrado.</div>}
          </div>
        </div>

        <div className="card portfolio-card">
          <div className="dashboard-card-head"><div><h2>Resumo da operação</h2><p>Indicadores rápidos do catálogo e da carteira.</p></div></div>
          <div className="portfolio-metrics">
            <div><span><Building2 size={18} /> Clientes ativos</span><strong>{customers.length}</strong></div>
            <div><span><PackageCheck size={18} /> Produtos ativos</span><strong>{activeProducts}</strong></div>
            <div><span><AlertTriangle size={18} /> Sem estoque</span><strong>{outOfStock}</strong></div>
            <div><span><Users size={18} /> Clientes inativos +30d</span><strong>{inactiveCustomers.length}</strong></div>
          </div>
          <Link href="/catalogo" className="btn btn-primary btn-lg dashboard-primary-action">Montar novo pedido <ArrowRight size={17} /></Link>
        </div>
      </section>
    </AppShell>
  );
}
