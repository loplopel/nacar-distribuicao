import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrainCircuit, Building2, CircleAlert, Sparkles, TrendingUp } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';
import { buildCustomerIntelligence, type PurchaseLine } from '@/lib/intelligence/customer-intelligence';

export const dynamic = 'force-dynamic';
const validStatuses = ['aprovado', 'separacao', 'faturado', 'enviado', 'finalizado'];

export default async function IntelligencePage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === 'cliente') redirect('/catalogo');
  const db = adminClient();

  let customersQuery = db.from('customers').select('id,name,trade_name,city,state,seller_id,active').eq('active', true);
  if (profile.role === 'vendedor') customersQuery = customersQuery.eq('seller_id', profile.id);
  const { data: customers } = await customersQuery.order('name').limit(500);
  const customerIds = (customers || []).map((customer) => customer.id);
  const { data: orders } = customerIds.length ? await db.from('orders').select('id,customer_id,total,created_at,status').in('customer_id', customerIds).in('status', validStatuses).order('created_at') : { data: [] as any[] };
  const orderIds = (orders || []).map((order) => order.id);
  const { data: items } = orderIds.length ? await db.from('order_items').select('order_id,quantity,product_id,products(name,brand,category)').in('order_id', orderIds) : { data: [] as any[] };

  const orderMap = new Map((orders || []).map((order) => [order.id, order]));
  const linesByCustomer = new Map<string, PurchaseLine[]>();
  for (const item of items || []) {
    const order: any = orderMap.get(item.order_id);
    if (!order) continue;
    const product: any = item.products;
    const list = linesByCustomer.get(order.customer_id) || [];
    list.push({ orderId: order.id, orderedAt: order.created_at, total: Number(order.total || 0), quantity: Number(item.quantity || 0), productId: item.product_id, productName: product?.name || 'Produto', brand: product?.brand || 'Sem marca', category: product?.category || 'Sem categoria' });
    linesByCustomer.set(order.customer_id, list);
  }

  const analyses = (customers || []).map((customer) => ({ customer, intelligence: buildCustomerIntelligence(linesByCustomer.get(customer.id) || []) })).sort((a, b) => {
    const priorityA = (a.intelligence.health === 'em_risco' ? 100 : 0) + a.intelligence.closingProbability;
    const priorityB = (b.intelligence.health === 'em_risco' ? 100 : 0) + b.intelligence.closingProbability;
    return priorityB - priorityA;
  });
  const risk = analyses.filter((item) => item.intelligence.health === 'em_risco');
  const growing = analyses.filter((item) => item.intelligence.health === 'crescendo');
  const opportunities = analyses.filter((item) => item.intelligence.closingProbability >= 70);

  return <AppShell>
    <div className="page-head intelligence-head"><div><span className="eyebrow">NACS INTELLIGENCE</span><h1>Assistente Comercial Inteligente</h1><p>Prioridades, previsão de compra e recomendações calculadas com os dados reais da operação.</p></div><BrainCircuit size={42}/></div>
    <section className="intelligence-kpis">
      <div className="card kpi"><Sparkles/><span>Oportunidades quentes</span><b>{opportunities.length}</b><small>probabilidade acima de 70%</small></div>
      <div className="card kpi"><CircleAlert/><span>Clientes em risco</span><b>{risk.length}</b><small>queda ou atraso de recompra</small></div>
      <div className="card kpi"><TrendingUp/><span>Clientes crescendo</span><b>{growing.length}</b><small>tendência positiva nos últimos 90 dias</small></div>
      <div className="card kpi"><Building2/><span>Carteira analisada</span><b>{analyses.length}</b><small>empresas ativas</small></div>
    </section>
    <section className="card intelligence-list-card"><div className="card-title"><div><h2>Prioridades comerciais</h2><p>Ordenadas por risco e probabilidade de fechamento.</p></div></div>
      <div className="intelligence-list">{analyses.slice(0, 80).map(({ customer, intelligence }) => <article key={customer.id} className={`intelligence-row ${intelligence.health}`}>
        <div className="intelligence-company"><span className="intelligence-score">{intelligence.score}</span><div><b>{customer.trade_name || customer.name}</b><small>{[customer.city, customer.state].filter(Boolean).join(' / ') || 'Local não informado'}</small></div></div>
        <div><small>Diagnóstico</small><p>{intelligence.summary}</p></div>
        <div><small>Probabilidade</small><b>{intelligence.closingProbability}%</b></div>
        <div><small>Próxima compra</small><b>{intelligence.nextPurchaseInDays === null ? 'Sem base' : intelligence.nextPurchaseInDays === 0 ? 'Agora' : `${intelligence.nextPurchaseInDays} dias`}</b></div>
        <Link className="btn" href={`/empresas/${customer.id}`}>Abrir cliente</Link>
      </article>)}{!analyses.length && <div className="empty">Nenhuma empresa disponível para análise.</div>}</div>
    </section>
  </AppShell>;
}
