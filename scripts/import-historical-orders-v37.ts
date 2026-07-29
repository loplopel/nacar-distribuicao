import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.PRESERVE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'rodrigo.franco@nacar.com.br').trim().toLowerCase();
const execute = process.argv.includes('--execute');
const inputArg = process.argv.find((arg) => arg.startsWith('--file='));
const inputFile = inputArg ? inputArg.slice('--file='.length) : 'data/pedidos-historicos-v3.7.csv';

if (!url || !serviceKey) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type SourceRow = {
  import_key: string;
  erp_code: string;
  customer_name_source: string;
  seller_name_source: string;
  purchase_date: string;
  order_total: string;
  plu: string;
  product_name_source: string;
  unit_price: string;
  quantity: string;
  item_total: string;
};

type SourceOrder = {
  importKey: string;
  erpCode: string;
  customerName: string;
  sellerName: string;
  purchaseDate: string;
  total: number;
  items: Array<{ plu: string; name: string; unitPrice: number; quantity: number; itemTotal: number }>;
};

function parseDelimited(text: string, delimiter = ';'): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() || []).map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function number(value: string): number {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function groupOrders(rows: SourceRow[]): SourceOrder[] {
  const grouped = new Map<string, SourceOrder>();
  for (const r of rows) {
    let order = grouped.get(r.import_key);
    if (!order) {
      order = { importKey: r.import_key, erpCode: r.erp_code, customerName: r.customer_name_source, sellerName: r.seller_name_source, purchaseDate: r.purchase_date, total: number(r.order_total), items: [] };
      grouped.set(r.import_key, order);
    }
    order.items.push({ plu: r.plu, name: r.product_name_source, unitPrice: number(r.unit_price), quantity: Math.max(1, Math.round(number(r.quantity))), itemTotal: number(r.item_total) });
  }
  return [...grouped.values()];
}
async function selectAll(table: string, columns = '*') {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (error) { last = error; if (i < attempts) await new Promise((r) => setTimeout(r, i * 1200)); }
  }
  throw new Error(`${label}: ${last instanceof Error ? last.message : String(last)}`);
}

async function main(): Promise<void> {
  const raw = await readFile(inputFile, 'utf8');
  const rows = parseDelimited(raw) as SourceRow[];
  if (!rows.length) throw new Error('Arquivo de pedidos históricos vazio.');
  const orders = groupOrders(rows);

  const [customers, profiles, products, existingOrders] = await Promise.all([
    withRetry('Leitura de clientes', () => selectAll('customers', 'id,erp_code,name,cnpj,city,state,seller_id')),
    withRetry('Leitura de perfis', () => selectAll('profiles', 'id,name,email,role')),
    withRetry('Leitura de produtos', () => selectAll('products', 'id,plu,name,source_key,active')),
    withRetry('Leitura de pedidos existentes', () => selectAll('orders', 'id,import_key')),
  ]);

  const admin = profiles.find((p) => String(p.email || '').toLowerCase() === adminEmail && p.role === 'admin');
  if (!admin) throw new Error(`Admin não encontrado: ${adminEmail}`);

  const customerByErp = new Map(customers.filter((c) => c.erp_code).map((c) => [String(c.erp_code).trim(), c]));
  const sellerByName = new Map(profiles.filter((p) => p.role === 'vendedor').map((p) => [normalize(p.name || ''), p]));
  const productsByPlu = new Map<string, any[]>();
  for (const p of products) {
    const key = String(p.plu || '').trim();
    if (!productsByPlu.has(key)) productsByPlu.set(key, []);
    productsByPlu.get(key)!.push(p);
  }
  const existingKeys = new Set(existingOrders.map((o) => o.import_key).filter(Boolean));

  let matchedProducts = 0, missingProducts = 0, missingCustomers = 0, missingSellers = 0, duplicates = 0, valueDivergences = 0;
  const missingPlu = new Map<string, string>();
  const planOrders: Array<SourceOrder & { customer: any; seller: any | null }> = [];

  for (const order of orders) {
    if (existingKeys.has(order.importKey)) { duplicates++; continue; }
    const customer = customerByErp.get(order.erpCode);
    if (!customer) { missingCustomers++; continue; }
    const seller = sellerByName.get(normalize(order.sellerName)) || profiles.find((p) => p.id === customer.seller_id) || null;
    if (!seller) missingSellers++;
    const calculated = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (Math.abs(calculated - order.total) > 0.02) valueDivergences++;
    for (const item of order.items) {
      if (productsByPlu.get(item.plu)?.length) matchedProducts++;
      else { missingProducts++; missingPlu.set(item.plu, item.name); }
    }
    planOrders.push({ ...order, customer, seller });
  }

  const summary = {
    mode: execute ? 'EXECUÇÃO REAL' : 'SIMULAÇÃO',
    sourceOrders: orders.length,
    sourceItems: rows.length,
    ordersToCreate: planOrders.length,
    duplicateOrdersIgnored: duplicates,
    missingCustomers,
    ordersWithoutSeller: missingSellers,
    matchedProductItems: matchedProducts,
    historicalProductItemsToCreate: missingProducts,
    uniqueHistoricalProductsToCreate: missingPlu.size,
    valueDivergencesAboveTwoCents: valueDivergences,
    stockWillBeChanged: false,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!execute) {
    console.log('\nSIMULAÇÃO concluída. Nenhum dado foi alterado. Para executar: npm run import:history -- --execute');
    return;
  }
  if (missingCustomers > 0) throw new Error(`Execução abortada: ${missingCustomers} cliente(s) não foram encontrados pelo código ERP.`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve('output', `importacao-v3.7-${stamp}`);
  await mkdir(outputDir, { recursive: true });

  // Cria produtos históricos inativos apenas quando o PLU não existe no catálogo.
  for (const [plu, name] of missingPlu) {
    const payload = {
      plu,
      source_key: `historico-v3.7-${plu}`,
      name,
      brand: null,
      size: null,
      status: 'Item histórico não disponível',
      suggested_price: 0,
      cost_price: 0,
      stock: 0,
      image_url: null,
      active: false,
    };
    const { data, error } = await db.from('products').insert(payload).select('id,plu,name,source_key,active').single();
    if (error) throw new Error(`Produto histórico ${plu}: ${error.message}`);
    productsByPlu.set(plu, [data]);
  }

  const created: any[] = [];
  for (let index = 0; index < planOrders.length; index++) {
    const source = planOrders[index];
    const createdAt = `${source.purchaseDate}T12:00:00.000Z`;
    const sellerId = source.seller?.id || source.customer.seller_id || null;
    const orderPayload = {
      created_by: admin.id,
      customer_id: source.customer.id,
      seller_id: sellerId,
      status: 'finalizado',
      total: source.total,
      notes: 'Pedido histórico importado da última compra registrada no Celta. Não movimenta estoque.',
      created_at: createdAt,
      updated_at: createdAt,
      submitted_at: createdAt,
      customer_name: source.customer.name,
      customer_cnpj: source.customer.cnpj || null,
      customer_city: source.customer.city || null,
      customer_state: source.customer.state || null,
      is_historical: true,
      import_source: 'Celta Business Solutions — relatório de última compra',
      import_key: source.importKey,
    };
    const { data: order, error: orderError } = await db.from('orders').insert(orderPayload).select('id,number').single();
    if (orderError) throw new Error(`Pedido ${source.importKey}: ${orderError.message}`);

    const itemPayload = source.items.map((item) => {
      const candidates = productsByPlu.get(item.plu) || [];
      const exactName = candidates.find((p) => normalize(p.name || '') === normalize(item.name));
      const product = exactName || candidates[0];
      return {
        order_id: order.id,
        product_id: product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        notes: product.active === false ? 'Item histórico sem vínculo com produto ativo do catálogo.' : null,
        source_plu: item.plu,
        source_product_name: item.name,
      };
    });
    const { error: itemsError } = await db.from('order_items').insert(itemPayload);
    if (itemsError) throw new Error(`Itens ${source.importKey}: ${itemsError.message}`);
    const { error: eventError } = await db.from('order_events').insert({
      order_id: order.id,
      status: 'finalizado',
      description: 'Pedido histórico importado da última compra registrada no sistema de origem.',
      created_by: admin.id,
      created_at: createdAt,
    });
    if (eventError) throw new Error(`Evento ${source.importKey}: ${eventError.message}`);
    created.push({ import_key: source.importKey, order_id: order.id, number: order.number, erp_code: source.erpCode, customer: source.customer.name, total: source.total, purchase_date: source.purchaseDate });
    if ((index + 1) % 25 === 0 || index + 1 === planOrders.length) console.log(`Importados ${index + 1} de ${planOrders.length} pedidos históricos.`);
  }

  const report = { completedAt: new Date().toISOString(), ...summary, createdOrders: created.length, outputDir };
  await writeFile(path.join(outputDir, 'relatorio-final.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(path.join(outputDir, 'pedidos-criados.json'), JSON.stringify(created, null, 2), 'utf8');
  console.log('\nIMPORTAÇÃO HISTÓRICA CONCLUÍDA');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('\nERRO NA IMPORTAÇÃO v3.7');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
