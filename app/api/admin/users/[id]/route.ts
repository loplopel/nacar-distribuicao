import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'vendedor', 'cliente']).optional(),
  job_title: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  seller_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentProfile();
  if (current?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Revise os dados informados.' }, { status: 400 });
  if (id === current.id && parsed.data.active === false) return NextResponse.json({ error: 'Você não pode inativar o próprio acesso.' }, { status: 400 });

  const supabase = adminClient();
  const { email, ...profileFields } = parsed.data;
  if (email || profileFields.name || profileFields.role) {
    const authPayload: { email?: string; user_metadata?: Record<string, string> } = {};
    if (email) authPayload.email = email;
    if (profileFields.name || profileFields.role) authPayload.user_metadata = {
      ...(profileFields.name ? { name: profileFields.name } : {}),
      ...(profileFields.role ? { role: profileFields.role } : {}),
    };
    const { error: authError } = await supabase.auth.admin.updateUserById(id, authPayload);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const payload = { ...profileFields, ...(email ? { email } : {}), updated_at: new Date().toISOString() };
  const { error } = await supabase.from('profiles').update(payload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentProfile();
  if (current?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const password = String(body.password || '');
  if (password.length < 6) return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
  const { error } = await adminClient().auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentProfile();
  if (current?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { id } = await params;
  if (id === current.id) return NextResponse.json({ error: 'Você não pode excluir o próprio acesso.' }, { status: 400 });

  const supabase = adminClient();
  const { data: target } = await supabase.from('profiles').select('role,email').eq('id', id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  if (target.role === 'admin') return NextResponse.json({ error: 'Por segurança, administradores devem ser apenas inativados.' }, { status: 400 });

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
