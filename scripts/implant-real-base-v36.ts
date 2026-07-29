import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const preserveAdminEmail = (process.env.PRESERVE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'rodrigo.franco@nacar.com.br').trim().toLowerCase();
const execute = process.argv.includes('--execute');
const inputArg = process.argv.find((arg) => arg.startsWith('--file='));
const inputFile = inputArg ? inputArg.slice('--file='.length) : 'data/clientes-reais-v3.6.csv';

if (!url || !serviceKey) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.');

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-');
const outputDir = path.resolve('output', `implantacao-v3.6-${stamp}`);

const sellerDisplayNames: Record<string, string> = {
  'thiago vieira': 'Thiago Vieira',
  'marcos - m3': 'Marcos - M3',
  'tatiane de alvarenga timoteo monteiro': 'Tatiane de Alvarenga Timoteo Monteiro',
  'michele': 'Michele',
  'eraldo tome': 'Eraldo Tome',
  'rodrigo martins': 'Rodrigo Martins',
  'vander dominguez': 'Vander Dominguez',
  'francos promocoes': 'Francos Promoções',
  'josé carlos': 'José Carlos',
  'jose carlos': 'José Carlos',
  'willian rego': 'Willian Rego',
  'caio rafael': 'Caio Rafael',
  'nestor lucio': 'Nestor Lucio',
  'fabiana barbosa': 'Fabiana Barbosa',
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function displaySeller(value: string): string {
  const n = normalize(value);
  return sellerDisplayNames[n] || value.trim().replace(/\s+/g, ' ');
}
function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 50);
}
function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
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
function temporaryPassword(): string {
  return `Nc@${randomBytes(8).toString('base64url')}9!`;
}
async function allAuthUsers() {
  const users: any[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}
async function selectAll(table: string) {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`Backup ${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}
async function deleteAll(table: string) {
  const { error } = await db.from(table).delete().not('id', 'is', null);
  if (error) throw new Error(`Limpeza ${table}: ${error.message}`);
}
async function cleanStorageFolder(client: SupabaseClient, bucket: string, prefix = ''): Promise<number> {
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return 0; // bucket pode não existir em instalações antigas
  let count = 0;
  const files: string[] = [];
  for (const item of data || []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) files.push(full);
    else count += await cleanStorageFolder(client, bucket, full);
  }
  if (files.length) {
    const { error: removeError } = await client.storage.from(bucket).remove(files);
    if (removeError) throw removeError;
    count += files.length;
  }
  return count;
}

async function main(): Promise<void> {
  const raw = await readFile(inputFile, 'utf8');
  const rows = parseDelimited(raw);
  if (!rows.length) throw new Error('O arquivo de clientes está vazio.');
  const required = ['erp_code', 'name', 'source_seller_name'];
  for (const column of required) if (!(column in rows[0])) throw new Error(`Coluna obrigatória ausente: ${column}`);

  const duplicateErp = rows.map((r) => r.erp_code).filter(Boolean).filter((v, i, a) => a.indexOf(v) !== i);
  if (duplicateErp.length) throw new Error(`Existem códigos ERP duplicados: ${[...new Set(duplicateErp)].join(', ')}`);

  const authUsers = await allAuthUsers();
  const adminAuth = authUsers.find((u) => u.email?.toLowerCase() === preserveAdminEmail);
  if (!adminAuth) throw new Error(`ABORTADO: Admin preservado não encontrado no Auth: ${preserveAdminEmail}`);
  const { data: adminProfile, error: adminProfileError } = await db.from('profiles').select('*').eq('id', adminAuth.id).maybeSingle();
  if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') throw new Error(`ABORTADO: ${preserveAdminEmail} não possui perfil admin válido.`);

  const sellerSourceNames = [...new Set(rows.map((r) => r.source_seller_name.trim()).filter(Boolean))];
  const sellers = sellerSourceNames.map((source) => ({ source, name: displaySeller(source), email: `vendedor.${slug(displaySeller(source))}@nacar.com.br` }));
  const unassigned = rows.filter((r) => !r.source_seller_name.trim()).length;

  const plan = {
    mode: execute ? 'EXECUÇÃO REAL' : 'SIMULAÇÃO',
    adminPreserved: { id: adminAuth.id, email: preserveAdminEmail, name: adminProfile.name },
    authUsersToDelete: authUsers.filter((u) => u.id !== adminAuth.id).map((u) => ({ id: u.id, email: u.email })),
    sellersToCreate: sellers,
    customersToImport: rows.length,
    customersWithoutSeller: unassigned,
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!execute) {
    console.log('\nSIMULAÇÃO concluída. Nenhum dado foi alterado. Para executar: npm run implant:real -- --execute');
    process.exit(0);
  }

  await mkdir(outputDir, { recursive: true });
  const backupTables = ['profiles','customers','orders','order_items','order_events','proposals','proposal_items','crm_followups','crm_interactions','customer_visits','customer_photos','visit_routes','visit_route_stops','seller_goals','seller_product_goals','audit_logs','sync_logs'];
  const backup: Record<string, unknown> = { generatedAt: now.toISOString(), adminPreserved: preserveAdminEmail, authUsers: authUsers.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, user_metadata: u.user_metadata })) };
  for (const table of backupTables) backup[table] = await selectAll(table);
  await writeFile(path.join(outputDir, 'backup-antes-da-implantacao.json'), JSON.stringify(backup, null, 2), 'utf8');

  // Dados operacionais: filhos antes dos pais. Produtos/configurações/modelos são preservados.
  for (const table of ['visit_route_stops','visit_routes','customer_photos','customer_visits','crm_followups','crm_interactions','proposal_items','proposals','order_events','order_items','orders','seller_product_goals','seller_goals','audit_logs','sync_logs']) await deleteAll(table);

  // Rompe vínculos entre clientes e perfis antes de excluir qualquer registro pai.
  // Isso torna a execução segura mesmo após uma tentativa parcial anterior.
  const { error: customersSellerError } = await db.from('customers').update({ seller_id: null }).not('id', 'is', null);
  if (customersSellerError) throw new Error(`Desvinculação de vendedores dos clientes: ${customersSellerError.message}`);

  const { error: profilesLinkError } = await db.from('profiles').update({ seller_id: null, customer_id: null }).not('id', 'is', null);
  if (profilesLinkError) throw new Error(`Desvinculação de perfis: ${profilesLinkError.message}`);

  // Remove perfis e contas de teste; Rodrigo permanece.
  const { error: profileDeleteError } = await db.from('profiles').delete().neq('id', adminAuth.id);
  if (profileDeleteError) throw new Error(`Remoção de perfis: ${profileDeleteError.message}`);
  for (const user of authUsers.filter((u) => u.id !== adminAuth.id)) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Remoção Auth ${user.email}: ${error.message}`);
  }

  // Agora não existem mais referências em profiles para customers.
  await deleteAll('customers');
  await cleanStorageFolder(db, 'customer-photos');

  const credentials: Array<{name:string;email:string;password:string;source_name:string}> = [];
  const sellerIds = new Map<string, string>();
  for (const seller of sellers) {
    const password = temporaryPassword();
    const { data, error } = await db.auth.admin.createUser({
      email: seller.email,
      password,
      email_confirm: true,
      user_metadata: { name: seller.name, role: 'vendedor', source_name: seller.source },
    });
    if (error || !data.user) throw new Error(`Criação do vendedor ${seller.name}: ${error?.message || 'usuário não retornado'}`);
    const { error: profileError } = await db.from('profiles').upsert({ id: data.user.id, name: seller.name, email: seller.email, role: 'vendedor', active: true, job_title: 'Vendedor' }, { onConflict: 'id' });
    if (profileError) throw new Error(`Perfil do vendedor ${seller.name}: ${profileError.message}`);
    sellerIds.set(normalize(seller.source), data.user.id);
    credentials.push({ name: seller.name, email: seller.email, password, source_name: seller.source });
  }

  const customerPayload = rows.map((r) => ({
    erp_code: r.erp_code || null,
    erp_custom_code: r.erp_custom_code || null,
    name: r.name,
    legal_name: r.legal_name || null,
    trade_name: r.name || null,
    email: r.email || null,
    phone: r.phone || null,
    whatsapp: r.whatsapp || null,
    source_seller_name: r.source_seller_name || null,
    seller_id: r.source_seller_name ? sellerIds.get(normalize(r.source_seller_name)) || null : null,
    last_purchase_at: r.last_purchase_at || null,
    last_purchase_value: r.last_purchase_value ? Number(r.last_purchase_value) : null,
    active: r.active.toLowerCase() !== 'false',
    notes: r.notes || null,
    data_quality: r.data_quality || null,
  }));
  for (let i = 0; i < customerPayload.length; i += 100) {
    const chunk = customerPayload.slice(i, i + 100);
    const { error } = await db.from('customers').insert(chunk);
    if (error) throw new Error(`Importação de clientes ${i + 1}-${i + chunk.length}: ${error.message}`);
  }

  const credentialsCsv = [
    ['Vendedor','E-mail de acesso','Senha temporária','Nome na origem'].map(csvEscape).join(';'),
    ...credentials.map((r) => [r.name,r.email,r.password,r.source_name].map(csvEscape).join(';')),
  ].join('\r\n');
  await writeFile(path.join(outputDir, 'credenciais-vendedores.csv'), '\uFEFF' + credentialsCsv, 'utf8');

  const report = {
    completedAt: new Date().toISOString(),
    adminPreserved: preserveAdminEmail,
    deletedAuthUsers: authUsers.length - 1,
    createdSellers: credentials.length,
    importedCustomers: customerPayload.length,
    customersWithoutSeller: customerPayload.filter((c) => !c.seller_id).length,
    backupFile: path.join(outputDir, 'backup-antes-da-implantacao.json'),
    credentialsFile: path.join(outputDir, 'credenciais-vendedores.csv'),
    checksumInput: createHash('sha256').update(raw).digest('hex'),
  };
  await writeFile(path.join(outputDir, 'relatorio-final.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\nIMPLANTAÇÃO CONCLUÍDA\n', JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('\nERRO NA IMPLANTAÇÃO v3.6\n', message);
  process.exitCode = 1;
});