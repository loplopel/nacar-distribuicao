import { NextResponse } from 'next/server';
import { createClient, getCurrentProfile } from '@/lib/supabase-server';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await params;
  const s = await createClient();

  let query = s.from('orders').select('*,order_items(product_id,quantity,unit_price,notes)').eq('id', id);
  if (profile.role === 'cliente') query = query.eq('created_by', profile.id);
  if (profile.role === 'vendedor') query = query.eq('seller_id', profile.id);
  const { data: source } = await query.single();
  if (!source) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  const { data: order, error } = await s.from('orders').insert({
    created_by: profile.id,
    customer_id: source.customer_id,
    seller_id: source.seller_id,
    status: 'rascunho',
    total: source.total,
    notes: source.notes,
    customer_name: source.customer_name,
    customer_cnpj: source.customer_cnpj,
    customer_city: source.customer_city,
    customer_state: source.customer_state,
    payment_terms: source.payment_terms,
    duplicated_from: source.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: itemError } = await s.from('order_items').insert((source.order_items || []).map((item: any) => ({ ...item, order_id: order.id })));
  if (itemError) { await s.from('orders').delete().eq('id', order.id); return NextResponse.json({ error: itemError.message }, { status: 400 }); }
  await s.from('order_events').insert({ order_id: order.id, created_by: profile.id, status: 'rascunho', description: `Pedido duplicado do nº ${String(source.number).padStart(6, '0')}.` });
  return NextResponse.json(order);
}
