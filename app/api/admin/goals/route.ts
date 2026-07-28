import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

function monthStart(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Mês inválido.');
  return `${value}-01`;
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const form = await request.formData();
    const sellerId = String(form.get('seller_id') || '');
    const month = monthStart(String(form.get('month') || ''));
    const revenueGoal = Number(form.get('revenue_goal') || 0);
    const ordersGoal = Math.max(0, Math.trunc(Number(form.get('orders_goal') || 0)));
    const customersGoal = Math.max(0, Math.trunc(Number(form.get('customers_goal') || 0)));
    if (!sellerId || !Number.isFinite(revenueGoal) || revenueGoal < 0) throw new Error('Preencha os dados da meta corretamente.');

    const { error } = await adminClient().from('seller_goals').upsert({
      seller_id: sellerId,
      month,
      revenue_goal: revenueGoal,
      orders_goal: ordersGoal,
      customers_goal: customersGoal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'seller_id,month' });
    if (error) throw error;

    const url = new URL('/admin/metas', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    url.searchParams.set('ok', '1');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL('/admin/metas', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    url.searchParams.set('error', error instanceof Error ? error.message : 'Não foi possível salvar a meta.');
    return NextResponse.redirect(url, 303);
  }
}
