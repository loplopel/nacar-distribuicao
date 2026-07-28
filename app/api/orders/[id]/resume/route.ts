import { NextResponse } from 'next/server';
import { createClient, getCurrentProfile } from '@/lib/supabase-server';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await params;
  const s = await createClient();
  let query = s.from('orders').select('id,status,customer_id,notes,created_by,seller_id,order_items(quantity,notes,products(*))').eq('id', id).eq('status', 'rascunho');
  if (profile.role === 'cliente') query = query.eq('created_by', profile.id);
  if (profile.role === 'vendedor') query = query.eq('seller_id', profile.id);
  const { data: order } = await query.single();
  if (!order) return NextResponse.json({ error: 'Rascunho não encontrado.' }, { status: 404 });
  const items = (order.order_items || []).map((item: any) => ({ ...item.products, quantity: item.quantity, notes: item.notes || '' }));
  return NextResponse.json({ orderId: order.id, customerId: order.customer_id || '', notes: order.notes || '', items });
}
