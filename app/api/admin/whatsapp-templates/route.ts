import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

const contexts = new Set(['geral','reativacao','orcamento','pedido','novidade']);

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const body = await request.json();
  const id = String(body.id || '').trim() || null;
  const name = String(body.name || '').trim();
  const message = String(body.message || '').trim();
  const context = contexts.has(String(body.context)) ? String(body.context) : 'geral';
  const active = body.active !== false;
  if (!name || !message) return NextResponse.json({ error: 'Nome e mensagem são obrigatórios.' }, { status: 400 });
  const db = adminClient();
  const payload = { name, message, context, active, updated_at: new Date().toISOString() };
  const result = id
    ? await db.from('whatsapp_templates').update(payload).eq('id', id)
    : await db.from('whatsapp_templates').insert(payload);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Modelo não localizado.' }, { status: 400 });
  const { error } = await adminClient().from('whatsapp_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
