import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

const channels = new Set(['whatsapp','telefone','email','visita','outro']);
const statuses = new Set(['pendente','concluido','cancelado']);

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === 'cliente') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const body = await request.json();
  const customerId = String(body.customer_id || '');
  const title = String(body.title || '').trim();
  const notes = String(body.notes || '').trim() || null;
  const channel = channels.has(body.channel) ? body.channel : 'whatsapp';
  const dueAt = String(body.due_at || '');
  if (!customerId || !title || !dueAt) return NextResponse.json({ error: 'Cliente, assunto e data são obrigatórios.' }, { status: 400 });

  const db = adminClient();
  const { data: customer } = await db.from('customers').select('id,seller_id').eq('id', customerId).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
  if (profile.role === 'vendedor' && customer.seller_id !== profile.id) return NextResponse.json({ error: 'Cliente fora da sua carteira.' }, { status: 403 });
  const sellerId = profile.role === 'vendedor' ? profile.id : (String(body.seller_id || customer.seller_id || ''));
  if (!sellerId) return NextResponse.json({ error: 'O cliente precisa ter um vendedor responsável.' }, { status: 400 });

  const { data, error } = await db.from('crm_followups').insert({
    customer_id: customerId, seller_id: sellerId, created_by: profile.id,
    title, notes, channel, due_at: new Date(dueAt).toISOString()
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === 'cliente') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const body = await request.json();
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!id || !statuses.has(status)) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const db = adminClient();
  const { data: row } = await db.from('crm_followups').select('seller_id').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Follow-up não encontrado.' }, { status: 404 });
  if (profile.role === 'vendedor' && row.seller_id !== profile.id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const { error } = await db.from('crm_followups').update({
    status,
    completed_at: status === 'concluido' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
