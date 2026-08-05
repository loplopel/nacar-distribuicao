import { NextResponse } from 'next/server';
import { createClient, getCurrentProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { createOrderPdfToken } from '@/lib/order-pdf-token';

const schema = z.object({
  order_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional().nullable(),
  })).min(1),
  notes: z.string().max(1500).optional(),
  action: z.enum(['draft', 'submit', 'quote']).default('submit'),
});

type Parsed = z.infer<typeof schema>;

function normalizeWhatsApp(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

async function quoteWhatsAppData(s: Awaited<ReturnType<typeof createClient>>, order: any, origin: string) {
  if (order.status !== 'orcamento' || !order.seller_id) return {};
  const { data: seller } = await s.from('profiles').select('name,phone,whatsapp').eq('id', order.seller_id).maybeSingle();
  const phone = normalizeWhatsApp(seller?.whatsapp || seller?.phone);
  if (!phone) return { whatsapp_warning: 'O orçamento foi salvo, mas o vendedor vinculado não possui WhatsApp cadastrado.' };
  const token = createOrderPdfToken(order.id);
  const pdfUrl = `${origin}/api/orders/${order.id}/pdf?token=${token}`;
  const customer = order.customer_name || 'cliente';
  const total = Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message = [
    `Olá, ${seller?.name || 'vendedor'}.`,
    `Foi gerada uma solicitação de orçamento para ${customer}.`,
    `Orçamento nº ${String(order.number).padStart(6, '0')} · Total estimado: ${total}.`,
    `PDF do orçamento: ${pdfUrl}`,
  ].join('\n\n');
  return { pdf_url: pdfUrl, whatsapp_url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` };
}


async function prepareOrder(data: Parsed, profile: any, s: Awaited<ReturnType<typeof createClient>>) {
  const ids = data.items.map((item) => item.product_id);
  const { data: products, error: productError } = await s.from('products').select('id,cost_price,active,stock,status').in('id', ids).eq('active', true);
  if (productError || !products || products.length !== new Set(ids).size) throw new Error('Produto inválido ou indisponível.');

  const productMap = new Map(products.map((product) => [product.id, product]));
  for (const requested of data.items) {
    const product = productMap.get(requested.product_id);
    if (!product || Number(product.stock) < requested.quantity || String(product.status).toLowerCase() === 'indisponível') throw new Error('Há produto sem estoque suficiente no pedido.');
  }

  const items = data.items.map((item) => ({ ...item, notes: item.notes?.trim() || null, unit_price: Number(productMap.get(item.product_id)!.cost_price) }));
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  let customerId = profile.customer_id;
  let sellerId = profile.seller_id;
  let customerName: string | null = null;
  let customerCnpj: string | null = null;
  let customerCity: string | null = null;
  let customerState: string | null = null;
  let paymentTerms: string | null = null;

  if (profile.role === 'vendedor') {
    customerId = data.customer_id || null;
    sellerId = profile.id;
    if (!customerId) throw new Error('Selecione o cliente.');
  }
  if (profile.role === 'admin' && data.customer_id) customerId = data.customer_id;

  if (customerId) {
    let customerQuery = s.from('customers').select('name,cnpj,city,state,payment_terms,seller_id').eq('id', customerId);
    if (profile.role === 'vendedor') customerQuery = customerQuery.eq('seller_id', profile.id);
    const { data: customer } = await customerQuery.single();
    if (!customer) throw new Error('Cliente inválido ou fora da sua carteira.');
    customerName = customer.name;
    customerCnpj = customer.cnpj;
    customerCity = customer.city;
    customerState = customer.state;
    paymentTerms = customer.payment_terms;
    sellerId = sellerId || customer.seller_id;
  }

  const status = data.action === 'draft' ? 'rascunho' : data.action === 'quote' ? 'orcamento' : 'novo';
  const now = new Date().toISOString();
  return {
    items,
    status,
    total,
    now,
    orderData: {
      customer_id: customerId,
      seller_id: sellerId,
      status,
      total,
      notes: data.notes?.trim() || null,
      customer_name: customerName,
      customer_cnpj: customerCnpj,
      customer_city: customerCity,
      customer_state: customerState,
      payment_terms: paymentTerms,
      submitted_at: status === 'novo' ? now : null,
      quote_requested_at: status === 'orcamento' ? now : null,
      updated_at: now,
    },
  };
}

async function writeEvent(s: Awaited<ReturnType<typeof createClient>>, orderId: string, profileId: string, status: string, description: string) {
  await s.from('order_events').insert({ order_id: orderId, created_by: profileId, status, description });
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  try {
    const s = await createClient();
    const prepared = await prepareOrder(parsed.data, profile, s);
    const { data: order, error } = await s.from('orders').insert({ created_by: profile.id, ...prepared.orderData }).select().single();
    if (error) throw error;
    const { error: itemError } = await s.from('order_items').insert(prepared.items.map((item) => ({ ...item, order_id: order.id })));
    if (itemError) { await s.from('orders').delete().eq('id', order.id); throw itemError; }
    const descriptions: Record<string, string> = { rascunho: 'Rascunho criado.', novo: 'Pedido enviado.', orcamento: 'Solicitação de orçamento enviada.' };
    await writeEvent(s, order.id, profile.id, prepared.status, descriptions[prepared.status]);
    const extra = await quoteWhatsAppData(s, order, new URL(req.url).origin);
    return NextResponse.json({ ...order, ...extra });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar o pedido.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success || !parsed.data.order_id) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  try {
    const s = await createClient();
    const { data: existing } = await s.from('orders').select('id,number,status,created_by,seller_id').eq('id', parsed.data.order_id).single();
    if (!existing || existing.status !== 'rascunho') throw new Error('Este rascunho não pode mais ser alterado.');
    if (profile.role === 'cliente' && existing.created_by !== profile.id) throw new Error('Acesso negado.');
    if (profile.role === 'vendedor' && existing.seller_id !== profile.id) throw new Error('Acesso negado.');

    const prepared = await prepareOrder(parsed.data, profile, s);
    const { error } = await s.from('orders').update(prepared.orderData).eq('id', existing.id);
    if (error) throw error;
    await s.from('order_items').delete().eq('order_id', existing.id);
    const { error: itemError } = await s.from('order_items').insert(prepared.items.map((item) => ({ ...item, order_id: existing.id })));
    if (itemError) throw itemError;
    const descriptions: Record<string, string> = { rascunho: 'Rascunho atualizado.', novo: 'Rascunho enviado como pedido.', orcamento: 'Rascunho enviado para orçamento.' };
    await writeEvent(s, existing.id, profile.id, prepared.status, descriptions[prepared.status]);
    const updatedOrder = { ...existing, ...prepared.orderData, status: prepared.status };
    const extra = await quoteWhatsAppData(s, updatedOrder, new URL(req.url).origin);
    return NextResponse.json({ ...updatedOrder, ...extra });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o rascunho.' }, { status: 400 });
  }
}
