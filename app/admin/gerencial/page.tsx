import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Award, BarChart3, Building2, CalendarDays, PackageCheck, ReceiptText, Target, TrendingUp, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const validStatuses = new Set(['aprovado', 'separacao', 'faturado', 'enviado', 'finalizado']);
const openStatuses = new Set(['novo', 'orcamento', 'em_analise', 'aprovado', 'separacao']);
const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value: number) => `${Math.max(0, value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function monthBounds(value: string) {
  const [year, month] = value.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function normalize(value?: string | null) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

export default async function GerencialPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');

  const params = await searchParams;
  const now = new Date();
  const monthValue = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { start, end } = monthBounds(monthValue);
  const db = adminClient();

  const [ordersQ, itemsQ, sellersQ, customersQ, goalsQ, productGoalsQ, productsQ, followupsQ] = await Promise.all([
    db.from('orders').select('id,number,total,status,created_at,customer_id,seller_id,customer_name,customers(name,trade_name),seller:profiles!orders_seller_id_fkey(name)').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).order('created_at', { ascending: false }),
    db.from('order_items').select('quantity,unit_price,product_id,products(name,brand,category),orders!inner(status,created_at,seller_id)').gte('orders.created_at', start.toISOString()).lt('orders.created_at', end.toISOString()),
    db.from('profiles').select('id,name,active').eq('role', 'vendedor').order('name'),
    db.from('customers').select('id,name,trade_name,seller_id,active,created_at').eq('active', true),
    db.from('seller_goals').select('*').eq('month', `${monthValue}-01`),
    db.from('seller_product_goals').select('*').eq('month', `${monthValue}-01`).eq('active', true),
    db.from('products').select('id,active,stock,status,brand,category').eq('active', true),
    db.from('crm_followups').select('id,seller_id,status,due_at').lt('due_at', end.toISOString()),
  ]);

  const orders = (ordersQ.data || []) as any[];
  const items = (itemsQ.data || []) as any[];
  const sellers = (sellersQ.data || []) as any[];
  const customers = (customersQ.data || []) as any[];
  const goals = (goalsQ.data || []) as any[];
  const productGoals = (productGoalsQ.data || []) as any[];
  const products = (productsQ.data || []) as any[];
  const followups = (followupsQ.data || []) as any[];

  const validOrders = orders.filter((order) => validStatuses.has(order.status));
  const revenue = validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const ticket = validOrders.length ? revenue / validOrders.length : 0;
  const openOrders = orders.filter((order) => openStatuses.has(order.status));
  const activeCustomers = customers.length;
  const activeSellers = sellers.filter((seller) => seller.active).length;
  const outOfStock = products.filter((product) => Number(product.stock || 0) <= 0).length;
  const overdueFollowups = followups.filter((item) => item.status !== 'concluido' && new Date(item.due_at) < now).length;

  const sellerMap = new Map<string, any>();
  sellers.forEach((seller) => sellerMap.set(seller.id, {
    id: seller.id,
    name: seller.name,
    revenue: 0,
    orders: 0,
    customers: new Set<string>(),
    revenueGoal: 0,
    ordersGoal: 0,
    customersGoal: 0,
  }));
  goals.forEach((goal) => {
    const current = sellerMap.get(goal.seller_id);
    if (!current) return;
    current.revenueGoal = Number(goal.revenue_goal || 0);
    current.ordersGoal = Number(goal.orders_goal || 0);
    current.customersGoal = Number(goal.customers_goal || 0);
  });
  validOrders.forEach((order) => {
    if (!order.seller_id) return;
    const current = sellerMap.get(order.seller_id);
    if (!current) return;
    current.revenue += Number(order.total || 0);
    current.orders += 1;
    if (order.customer_id) current.customers.add(order.customer_id);
  });
  const sellerRanking = [...sellerMap.values()].sort((a, b) => b.revenue - a.revenue);

  const productGoalProgress = productGoals.map((goal) => {
    const quantity = items.reduce((sum, item) => {
      if (!item.orders || item.orders.seller_id !== goal.seller_id || !validStatuses.has(item.orders.status)) return sum;
      const product = item.products || {};
      if (goal.brand && normalize(product.brand) !== normalize(goal.brand)) return sum;
      if (goal.category && normalize(product.category) !== normalize(goal.category)) return sum;
      if (goal.name_starts_with && !normalize(product.name).startsWith(normalize(goal.name_starts_with))) return sum;
      return sum + Number(item.quantity || 0);
    }, 0);
    return { ...goal, quantity, sellerName: sellerMap.get(goal.seller_id)?.name || 'Vendedor' };
  }).sort((a, b) => (b.quantity / Math.max(Number(b.quantity_goal), 1)) - (a.quantity / Math.max(Number(a.quantity_goal), 1)));

  const customerStats = new Map<string, { name: string; total: number; orders: number }>();
  validOrders.forEach((order) => {
    const key = order.customer_id || order.customer_name || order.id;
    const name = order.customers?.trade_name || order.customers?.name || order.customer_name || 'Cliente';
    const current = customerStats.get(key) || { name, total: 0, orders: 0 };
    current.total += Number(order.total || 0);
    current.orders += 1;
    customerStats.set(key, current);
  });
  const topCustomers = [...customerStats.values()].sort((a, b) => b.total - a.total).slice(0, 8);

  const productStats = new Map<string, { name: string; brand: string; quantity: number; total: number }>();
  items.forEach((item) => {
    if (!item.orders || !validStatuses.has(item.orders.status)) return;
    const current = productStats.get(item.product_id) || { name: item.products?.name || 'Produto', brand: item.products?.brand || '-', quantity: 0, total: 0 };
    current.quantity += Number(item.quantity || 0);
    current.total += Number(item.quantity || 0) * Number(item.unit_price || 0);
    productStats.set(item.product_id, current);
  });
  const topProducts = [...productStats.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8);

  const statusCounts = orders.reduce((map, order) => {
    map.set(order.status, (map.get(order.status) || 0) + 1);
    return map;
  }, new Map<string, number>());

  const totalRevenueGoal = goals.reduce((sum, goal) => sum + Number(goal.revenue_goal || 0), 0);
  const totalOrdersGoal = goals.reduce((sum, goal) => sum + Number(goal.orders_goal || 0), 0);
  const goalProgress = totalRevenueGoal ? (revenue / totalRevenueGoal) * 100 : 0;

  return <AppShell>
    <div className="management-hero">
      <div>
        <span className="eyebrow">GESTÃO COMERCIAL</span>
        <h1>Dashboard Gerencial</h1>
        <p>Visão consolidada da operação, metas, vendedores, clientes e produtos.</p>
      </div>
      <form className="management-month">
        <label>Mês de referência<input type="month" name="month" defaultValue={monthValue}/></label>
        <button className="btn" type="submit"><CalendarDays size={17}/> Atualizar</button>
      </form>
    </div>

    <section className="dashboard-kpis management-kpis">
      <div className="dash-kpi accent-orange"><div className="dash-kpi-icon"><TrendingUp size={22}/></div><span>Faturamento</span><strong>{brl(revenue)}</strong><small>{pct(goalProgress)} da meta de {brl(totalRevenueGoal)}</small></div>
      <div className="dash-kpi accent-blue"><div className="dash-kpi-icon"><ReceiptText size={22}/></div><span>Pedidos válidos</span><strong>{validOrders.length}</strong><small>{totalOrdersGoal ? `${pct((validOrders.length / totalOrdersGoal) * 100)} da meta` : 'sem meta geral definida'}</small></div>
      <div className="dash-kpi accent-green"><div className="dash-kpi-icon"><Users size={22}/></div><span>Clientes ativos</span><strong>{activeCustomers}</strong><small>{activeSellers} vendedores ativos</small></div>
      <div className="dash-kpi accent-red"><div className="dash-kpi-icon"><AlertTriangle size={22}/></div><span>Aguardando ação</span><strong>{openOrders.length + overdueFollowups}</strong><small>{openOrders.length} pedidos e {overdueFollowups} follow-ups</small></div>
    </section>

    <section className="management-grid">
      <div className="card management-card span-2">
        <div className="card-head"><div><h2><Award size={19}/> Desempenho dos vendedores</h2><p>Resultado do mês comparado às metas cadastradas.</p></div><Link href="/admin/metas" className="table-link">Gerenciar metas</Link></div>
        <div className="management-seller-list">
          {sellerRanking.map((seller, index) => {
            const revenuePct = seller.revenueGoal ? Math.min(100, seller.revenue / seller.revenueGoal * 100) : 0;
            return <div className="management-seller" key={seller.id}>
              <span className="rank-number">{index + 1}</span>
              <div className="management-seller-main"><b>{seller.name}</b><small>{seller.orders} pedidos · {seller.customers.size} clientes</small><div className="goal-track"><i style={{width:`${revenuePct}%`}}/></div></div>
              <div className="management-seller-value"><strong>{brl(seller.revenue)}</strong><small>{seller.revenueGoal ? `Meta ${brl(seller.revenueGoal)}` : 'Sem meta'}</small></div>
            </div>;
          })}
          {!sellerRanking.length && <p className="empty">Nenhum vendedor cadastrado.</p>}
        </div>
      </div>

      <div className="card management-card">
        <div className="card-head"><div><h2><BarChart3 size={19}/> Pedidos por status</h2><p>Distribuição no período selecionado.</p></div></div>
        <div className="status-summary">
          {[...statusCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([status,count])=><div key={status}><span>{status.replaceAll('_',' ')}</span><strong>{count}</strong></div>)}
          {!statusCounts.size && <p className="empty">Nenhum pedido no período.</p>}
        </div>
      </div>

      <div className="card management-card">
        <div className="card-head"><div><h2><PackageCheck size={19}/> Estoque do catálogo</h2><p>Indicadores dos produtos ativos.</p></div></div>
        <div className="management-stock"><div><span>Produtos ativos</span><strong>{products.length}</strong></div><div><span>Sem estoque</span><strong>{outOfStock}</strong></div><div><span>Com estoque</span><strong>{products.length - outOfStock}</strong></div><div><span>Ticket médio</span><strong>{brl(ticket)}</strong></div></div>
      </div>

      <div className="card management-card span-2">
        <div className="card-head"><div><h2><Target size={19}/> Metas por produto</h2><p>Progresso das linhas estratégicas cadastradas.</p></div></div>
        <div className="product-goal-management">
          {productGoalProgress.map((goal:any) => {
            const progress = Number(goal.quantity_goal) ? Math.min(100, goal.quantity / Number(goal.quantity_goal) * 100) : 0;
            return <div key={goal.id}><div><b>{goal.goal_name}</b><small>{goal.sellerName}</small></div><div className="goal-track"><i style={{width:`${progress}%`}}/></div><strong>{goal.quantity} / {goal.quantity_goal}</strong><span>{pct(progress)}</span></div>;
          })}
          {!productGoalProgress.length && <p className="empty">Nenhuma meta por produto cadastrada.</p>}
        </div>
      </div>

      <div className="card management-card">
        <div className="card-head"><div><h2><Building2 size={19}/> Top clientes</h2><p>Maiores compradores do mês.</p></div></div>
        <div className="management-ranking">{topCustomers.map((customer,index)=><div key={customer.name}><span>{index+1}</span><div><b>{customer.name}</b><small>{customer.orders} pedidos</small></div><strong>{brl(customer.total)}</strong></div>)}{!topCustomers.length&&<p className="empty">Sem vendas no período.</p>}</div>
      </div>

      <div className="card management-card">
        <div className="card-head"><div><h2><PackageCheck size={19}/> Top produtos</h2><p>Itens com maior quantidade vendida.</p></div></div>
        <div className="management-ranking">{topProducts.map((product,index)=><div key={`${product.name}-${index}`}><span>{index+1}</span><div><b>{product.name}</b><small>{product.brand}</small></div><strong>{product.quantity} un.</strong></div>)}{!topProducts.length&&<p className="empty">Sem produtos vendidos no período.</p>}</div>
      </div>
    </section>
  </AppShell>;
}
