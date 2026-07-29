import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import OrderActions from '@/components/OrderActions';
import { createClient, getCurrentProfile } from '@/lib/supabase-server';

const currency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusLabel = (value: string) => String(value).replaceAll('_', ' ');

export default async function PedidoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const s = await createClient();
  let query = s.from('orders').select('*,customers(name,trade_name,cnpj,city,state,payment_terms),profiles!orders_seller_id_fkey(name),order_items(id,quantity,unit_price,notes,products(name,ean,size,image_url)),order_events(id,status,description,created_at,profiles(name))').eq('id', id);
  if (profile?.role === 'cliente') query = query.eq('created_by', profile.id);
  if (profile?.role === 'vendedor') query = query.eq('seller_id', profile.id);
  const { data: order } = await query.single();
  if (!order) notFound();

  const events = [...(order.order_events || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return <AppShell>
    <div className="print-header"><strong>NACAR DISTRIBUIÇÃO</strong><span>Pedido Nº {String(order.number).padStart(6, '0')}</span></div>
    <div className="page-head order-page-head">
      <div><Link href="/pedidos" className="back-link no-print">← Voltar aos pedidos</Link><h1>Pedido #{String(order.number).padStart(6, '0')}</h1><p>Criado em {new Date(order.created_at).toLocaleString('pt-BR')}</p></div>
      <div className="order-head-right"><div className="order-badges"><span className={`badge status-${order.status}`}>{statusLabel(order.status)}</span>{order.is_historical&&<span className="badge historical-badge">Pedido histórico</span>}</div>{!order.is_historical&&<OrderActions id={order.id} status={order.status}/>}</div>
    </div>

    <div className="order-detail-grid">
      <section className="card order-summary">
        <h2>Dados do pedido</h2>
        <dl>
          <div><dt>Cliente</dt><dd>{order.customers?.trade_name || order.customers?.name || order.customer_name || '-'}</dd></div>
          <div><dt>CNPJ</dt><dd>{order.customer_cnpj || order.customers?.cnpj || '-'}</dd></div>
          <div><dt>Cidade/UF</dt><dd>{[order.customer_city || order.customers?.city, order.customer_state || order.customers?.state].filter(Boolean).join('/') || '-'}</dd></div>
          <div><dt>Vendedor</dt><dd>{order.profiles?.name || '-'}</dd></div>
          <div><dt>Condição de pagamento</dt><dd>{order.payment_terms || order.customers?.payment_terms || '-'}</dd></div>
          <div><dt>Tipo</dt><dd>{order.is_historical ? 'Pedido histórico importado' : order.status === 'orcamento' ? 'Solicitação de orçamento' : order.duplicated_from ? 'Pedido duplicado' : 'Pedido'}</dd></div>{order.import_source&&<div><dt>Origem</dt><dd>{order.import_source}</dd></div>}
        </dl>
        {order.notes && <div className="order-notes"><b>Observações</b><p>{order.notes}</p></div>}
      </section>
      <section className="card order-total-card"><span>Total do pedido</span><strong>{currency(order.total)}</strong><small>{order.order_items?.length || 0} item(ns)</small></section>
    </div>

    <section className="card order-items-card">
      <h2>Itens</h2>
      {(order.order_items || []).map((item: any) => <article className="order-line" key={item.id}>
        <img src={item.products?.image_url || '/produto-sem-imagem.svg'} alt=""/>
        <div className="order-line-info"><b>{item.products?.name}</b><span>EAN {item.products?.ean || '-'} {item.products?.size ? `• Tam. ${item.products.size}` : ''}</span>{item.notes && <small>Obs.: {item.notes}</small>}</div>
        <div className="order-line-qty">{item.quantity} un.</div>
        <div className="order-line-price"><span>{currency(item.unit_price)} cada</span><b>{currency(Number(item.unit_price) * item.quantity)}</b></div>
      </article>)}
    </section>

    <section className="card order-timeline-card">
      <h2>Histórico do pedido</h2>
      <div className="order-timeline">
        {events.length ? events.map((event: any, index: number) => <div className="timeline-event" key={event.id}>
          <div className="timeline-marker"><span></span>{index < events.length - 1 && <i/>}</div>
          <div><b>{statusLabel(event.status)}</b><p>{event.description || 'Atualização do pedido.'}</p><small>{new Date(event.created_at).toLocaleString('pt-BR')}{event.profiles?.name ? ` • ${event.profiles.name}` : ''}</small></div>
        </div>) : <div className="empty">Nenhum evento registrado para este pedido.</div>}
      </div>
    </section>
  </AppShell>;
}
