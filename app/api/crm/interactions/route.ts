import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === 'cliente') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const body = await request.json();
  const customerId = String(body.customer_id || '').trim();
  const channel = String(body.channel || 'whatsapp');
  const message = String(body.message || '').trim() || null;
  const subject = String(body.subject || '').trim() || null;
  const templateId = String(body.template_id || '').trim() || null;
  if (!customerId) return NextResponse.json({ error: 'Cliente obrigatório.' }, { status: 400 });
  const db = adminClient();
  const { data: customer } = await db.from('customers').select('id,seller_id').eq('id', customerId).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
  if (profile.role === 'vendedor' && customer.seller_id !== profile.id) return NextResponse.json({ error: 'Cliente fora da sua carteira.' }, { status: 403 });
  const sellerId = profile.role === 'vendedor' ? profile.id : customer.seller_id;
  const { error } = await db.from('crm_interactions').insert({
    customer_id: customerId,
    seller_id: sellerId,
    created_by: profile.id,
    channel,
    template_id: templateId,
    subject,
    message
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
