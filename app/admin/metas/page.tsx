import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function money(value: number | string) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function MetasPage({ searchParams }: { searchParams: Promise<{ ok?: string; product_ok?: string; error?: string; month?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');
  const params = await searchParams;
  const now = new Date();
  const monthValue = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthDate = `${monthValue}-01`;
  const db = adminClient();
  const [{ data: sellers }, { data: goals }, { data: productGoals }, { data: products }] = await Promise.all([
    db.from('profiles').select('id,name,email,active').eq('role', 'vendedor').order('name'),
    db.from('seller_goals').select('*').eq('month', monthDate),
    db.from('seller_product_goals').select('*').eq('month', monthDate).order('created_at'),
    db.from('products').select('brand,category').eq('active', true),
  ]);
  const goalMap = new Map((goals || []).map((goal) => [goal.seller_id, goal]));
  const sellerMap = new Map((sellers || []).map((seller) => [seller.id, seller]));
  const brands = [...new Set((products || []).map((p: any) => String(p.brand || '').trim()).filter(Boolean))].sort();
  const categories = [...new Set((products || []).map((p: any) => String(p.category || '').trim()).filter(Boolean))].sort();

  return <AppShell>
    <div className="page-head"><div><span className="eyebrow">GESTÃO COMERCIAL</span><h1>Metas dos vendedores</h1><p>Defina metas mensais de faturamento, pedidos, clientes e quantidades por linha de produto.</p></div></div>
    {params.ok && <div className="success">Meta mensal salva com sucesso.</div>}
    {params.product_ok && <div className="success">Meta por produto {params.product_ok === 'deleted' ? 'excluída' : 'salva'} com sucesso.</div>}
    {params.error && <div className="error">{params.error}</div>}
    <form className="card goal-month-filter" method="get"><label>Mês de referência<input type="month" name="month" defaultValue={monthValue}/></label><button className="btn" type="submit">Carregar mês</button></form>

    <div className="section-title"><div><span className="eyebrow">RESULTADO GERAL</span><h2>Metas mensais</h2><p>Faturamento, pedidos e clientes atendidos.</p></div></div>
    <div className="goal-admin-grid">
      {(sellers || []).map((seller) => {
        const goal: any = goalMap.get(seller.id);
        return <form className="card goal-admin-card" action="/api/admin/goals" method="post" key={seller.id}>
          <input type="hidden" name="seller_id" value={seller.id}/><input type="hidden" name="month" value={monthValue}/>
          <div><h2>{seller.name}</h2><p>{seller.email}</p>{!seller.active && <span className="status cancelado">Inativo</span>}</div>
          <label>Meta de faturamento<input name="revenue_goal" type="number" min="0" step="0.01" defaultValue={Number(goal?.revenue_goal || 0)}/><small>Atual: {money(goal?.revenue_goal || 0)}</small></label>
          <label>Meta de pedidos<input name="orders_goal" type="number" min="0" step="1" defaultValue={Number(goal?.orders_goal || 0)}/></label>
          <label>Clientes atendidos<input name="customers_goal" type="number" min="0" step="1" defaultValue={Number(goal?.customers_goal || 0)}/></label>
          <button className="btn btn-primary" type="submit">Salvar meta</button>
        </form>;
      })}
    </div>

    <div className="section-title product-goal-title"><div><span className="eyebrow">VOLUME POR LINHA</span><h2>Metas por produto</h2><p>A contagem soma a quantidade dos itens em pedidos aprovados, em separação, faturados, enviados ou finalizados.</p></div></div>
    <form className="card product-goal-form" action="/api/admin/product-goals" method="post">
      <input type="hidden" name="month" value={monthValue}/><input type="hidden" name="return_month" value={monthValue}/>
      <label>Vendedor<select name="seller_id" required defaultValue=""><option value="" disabled>Selecione</option>{(sellers || []).filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Nome da meta<input name="goal_name" required placeholder="Ex.: Capacete Shoei"/></label>
      <label>Quantidade<input name="quantity_goal" type="number" min="1" step="1" required placeholder="200"/></label>
      <label>Marca<select name="brand" defaultValue=""><option value="">Qualquer marca</option>{brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}</select></label>
      <label>Categoria<select name="category" defaultValue=""><option value="">Qualquer categoria</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
      <label>Nome começa com<input name="name_starts_with" placeholder="Ex.: CAPACETE SHOEI"/><small>Use este campo para não contar acessórios da mesma marca.</small></label>
      <button className="btn btn-primary" type="submit">Adicionar meta de produto</button>
    </form>

    <div className="card product-goal-help"><b>Exemplos de regras seguras</b><span><strong>Capacete Shoei:</strong> Marca SHOEI + Categoria Capacete + Nome começa com CAPACETE SHOEI.</span><span><strong>Intercomunicador Cardo:</strong> Marca CARDO + Categoria Intercomunicador.</span></div>

    <div className="product-goal-list">
      {(productGoals || []).map((item: any) => {
        const seller: any = sellerMap.get(item.seller_id);
        return <div className="card product-goal-item" key={item.id}>
          <div><span className="eyebrow">{seller?.name || 'Vendedor'}</span><h3>{item.goal_name}</h3><p>Meta: <strong>{item.quantity_goal} unidades</strong></p></div>
          <div className="product-goal-rules">
            {item.brand && <span>Marca: {item.brand}</span>}
            {item.category && <span>Categoria: {item.category}</span>}
            {item.name_starts_with && <span>Começa com: {item.name_starts_with}</span>}
          </div>
          <form action="/api/admin/product-goals" method="post"><input type="hidden" name="action" value="delete"/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="return_month" value={monthValue}/><button className="btn btn-danger" type="submit">Excluir</button></form>
        </div>;
      })}
      {!productGoals?.length && <div className="card dashboard-empty">Nenhuma meta por produto cadastrada para este mês.</div>}
    </div>
  </AppShell>;
}
