import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import SmartOrderBuilder from '@/components/SmartOrderBuilder';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';
import { buildCustomerIntelligence, type PurchaseLine } from '@/lib/intelligence/customer-intelligence';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';
const validStatuses = ['aprovado', 'separacao', 'faturado', 'enviado', 'finalizado'];

export default async function SmartOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === 'cliente') redirect('/catalogo');
  const { id } = await params;
  const db = adminClient();

  let customerQuery = db.from('customers').select('id,name,trade_name,seller_id,active').eq('id', id).eq('active', true);
  if (profile.role === 'vendedor') customerQuery = customerQuery.eq('seller_id', profile.id);
  const { data: customer } = await customerQuery.maybeSingle();
  if (!customer) notFound();

  const { data: orders } = await db.from('orders').select('id,total,created_at,status').eq('customer_id', id).in('status', validStatuses).order('created_at');
  const orderIds = (orders || []).map((order) => order.id);
  const { data: items } = orderIds.length
    ? await db.from('order_items').select('order_id,quantity,product_id,products(name,brand,category)').in('order_id', orderIds)
    : { data: [] as any[] };

  const orderMap = new Map((orders || []).map((order) => [order.id, order]));
  const lines: PurchaseLine[] = (items || []).map((item: any) => {
    const order: any = orderMap.get(item.order_id);
    const product: any = item.products;
    return order ? {
      orderId: order.id,
      orderedAt: order.created_at,
      total: Number(order.total || 0),
      quantity: Number(item.quantity || 0),
      productId: item.product_id,
      productName: product?.name || 'Produto',
      brand: product?.brand || 'Sem marca',
      category: product?.category || 'Sem categoria',
    } : null;
  }).filter(Boolean) as PurchaseLine[];

  const intelligence = buildCustomerIntelligence(lines);
  const recommendationIds = intelligence.recommendations.map((item) => item.productId).filter(Boolean);
  const { data: productRows } = recommendationIds.length
    ? await db.from('products').select('*').in('id', recommendationIds).eq('active', true)
    : { data: [] as Product[] };
  const recommendationMap = new Map(intelligence.recommendations.map((item) => [item.productId, item]));
  const products = ((productRows || []) as Product[]).map((product) => ({
    ...product,
    suggestedQuantity: recommendationMap.get(product.id)?.suggestedQuantity || 1,
    confidence: recommendationMap.get(product.id)?.confidence || 0,
    reason: recommendationMap.get(product.id)?.reason || 'Produto recorrente no histórico do cliente.',
  })).sort((a, b) => b.confidence - a.confidence);

  return <AppShell>
    <Link className="back-link" href={`/empresas/${customer.id}`}>← Voltar para o Perfil 360°</Link>
    <div className="page-head"><div><span className="eyebrow">PEDIDO INTELIGENTE</span><h1>Recomendação automática</h1><p>Selecione, ajuste e envie para o carrinho os itens sugeridos pelo histórico de compra.</p></div></div>
    <SmartOrderBuilder
      customerId={customer.id}
      customerName={customer.trade_name || customer.name}
      products={products}
      closingProbability={intelligence.closingProbability}
      summary={intelligence.summary}
    />
  </AppShell>;
}
