import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

function monthStart(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Mês inválido.');
  return `${value}-01`;
}

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value || '').trim();
  return text || null;
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const form = await request.formData();
    const action = String(form.get('action') || 'save');
    const returnMonth = String(form.get('return_month') || form.get('month') || '');

    if (action === 'delete') {
      const id = String(form.get('id') || '');
      if (!id) throw new Error('Meta não localizada.');
      const { error } = await adminClient().from('seller_product_goals').delete().eq('id', id);
      if (error) throw error;
      const url = new URL('/admin/metas', appUrl);
      url.searchParams.set('month', returnMonth);
      url.searchParams.set('product_ok', 'deleted');
      return NextResponse.redirect(url, 303);
    }

    const id = cleanOptional(form.get('id'));
    const sellerId = String(form.get('seller_id') || '');
    const month = monthStart(String(form.get('month') || ''));
    const goalName = String(form.get('goal_name') || '').trim();
    const brand = cleanOptional(form.get('brand'))?.toUpperCase() || null;
    const category = cleanOptional(form.get('category'));
    const nameStartsWith = cleanOptional(form.get('name_starts_with'))?.toUpperCase() || null;
    const quantityGoal = Math.max(0, Math.trunc(Number(form.get('quantity_goal') || 0)));

    if (!sellerId || !goalName || quantityGoal <= 0) throw new Error('Informe vendedor, nome da meta e quantidade maior que zero.');
    if (!brand && !category && !nameStartsWith) throw new Error('Defina ao menos uma regra: marca, categoria ou início do nome.');

    const payload = {
      seller_id: sellerId,
      month,
      goal_name: goalName,
      brand,
      category,
      name_starts_with: nameStartsWith,
      quantity_goal: quantityGoal,
      active: true,
      updated_at: new Date().toISOString(),
    };

    const query = id
      ? adminClient().from('seller_product_goals').update(payload).eq('id', id)
      : adminClient().from('seller_product_goals').insert(payload);
    const { error } = await query;
    if (error) throw error;

    const url = new URL('/admin/metas', appUrl);
    url.searchParams.set('month', String(form.get('month') || ''));
    url.searchParams.set('product_ok', id ? 'updated' : 'created');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const url = new URL('/admin/metas', appUrl);
    url.searchParams.set('error', error instanceof Error ? error.message : 'Não foi possível salvar a meta por produto.');
    return NextResponse.redirect(url, 303);
  }
}
