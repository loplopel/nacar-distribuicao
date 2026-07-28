import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

const allowed = ['rascunho', 'orcamento', 'novo', 'em_analise', 'aprovado', 'separacao', 'faturado', 'enviado', 'finalizado', 'cancelado'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { id } = await params;
  const { status } = await req.json();
  if (!allowed.includes(status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  const client = adminClient();
  const now = new Date().toISOString();
  const { error } = await client.from('orders').update({ status, updated_at: now }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const descriptions: Record<string, string> = {
    rascunho: 'Pedido voltou para rascunho.', orcamento: 'Pedido marcado como orçamento.', novo: 'Pedido recebido.', em_analise: 'Pedido em análise comercial.', aprovado: 'Pedido aprovado.', separacao: 'Pedido em separação.', faturado: 'Pedido faturado.', enviado: 'Pedido enviado.', finalizado: 'Pedido finalizado.', cancelado: 'Pedido cancelado.',
  };
  await client.from('order_events').insert({ order_id: id, created_by: profile.id, status, description: descriptions[status] });
  return NextResponse.json({ ok: true });
}
