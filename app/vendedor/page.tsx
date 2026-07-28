import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Phone, ShoppingCart, Target, TrendingUp, Users, WalletCards } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
const salesStatuses = new Set(['aprovado','separacao','faturado','enviado','finalizado']);
const openStatuses = new Set(['novo','orcamento','em_analise']);
function money(value:number){return value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function daysSince(value?:string|null){if(!value)return null;return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000))}
function percent(value:number,goal:number){return goal>0?Math.min(100,Math.round((value/goal)*100)):0}
function whatsapp(value?:string|null){return (value||'').replace(/\D/g,'')}

export default async function SellerArea(){
  const profile=await getCurrentProfile();
  if(!profile)redirect('/login');
  if(profile.role==='cliente')redirect('/catalogo');
  if(profile.role==='admin')redirect('/dashboard');
  const db=adminClient();const now=new Date();const monthStart=new Date(now.getFullYear(),now.getMonth(),1);const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const [{data:orders},{data:customers},{data:followups},{data:goalRows},{data:productGoalRows},{data:soldItems}]=await Promise.all([
    db.from('orders').select('id,number,total,status,created_at,customer_id,customer_name,customers(name,trade_name)').eq('seller_id',profile.id).order('created_at',{ascending:false}),
    db.from('customers').select('id,name,trade_name,city,state,phone,whatsapp,email,active').eq('seller_id',profile.id).eq('active',true).order('name'),
    db.from('crm_followups').select('id,title,channel,due_at,status,customer_id,customers(name,trade_name,whatsapp,phone)').eq('seller_id',profile.id).eq('status','pendente').order('due_at'),
    db.from('seller_goals').select('*').eq('seller_id',profile.id).eq('month',monthKey).limit(1),
    db.from('seller_product_goals').select('*').eq('seller_id',profile.id).eq('month',monthKey).eq('active',true).order('created_at'),
    db.from('order_items').select('quantity,products(name,brand,category),orders!inner(seller_id,status,created_at)').eq('orders.seller_id',profile.id).gte('orders.created_at',monthStart.toISOString()),
  ]);
  const os:any[]=orders||[],cs:any[]=customers||[],fs:any[]=followups||[];const goal:any=goalRows?.[0]||{};const productGoals:any[]=productGoalRows||[];const monthItems:any[]=(soldItems||[]).filter((item:any)=>salesStatuses.has(item.orders?.status));
  const monthSales=os.filter(o=>salesStatuses.has(o.status)&&new Date(o.created_at)>=monthStart);const revenue=monthSales.reduce((s,o)=>s+Number(o.total||0),0);const ticket=monthSales.length?revenue/monthSales.length:0;const open=os.filter(o=>openStatuses.has(o.status));
  const lastByCustomer=new Map<string,any>();for(const o of os){if(o.customer_id&&salesStatuses.has(o.status)&&!lastByCustomer.has(o.customer_id))lastByCustomer.set(o.customer_id,o)}
  const portfolio=cs.map(c=>{const last=lastByCustomer.get(c.id);return{...c,last,days:daysSince(last?.created_at)}});
  const d30=portfolio.filter(c=>c.days!==null&&c.days>=30&&c.days<60);const d60=portfolio.filter(c=>c.days!==null&&c.days>=60&&c.days<90);const d90=portfolio.filter(c=>c.days===null||c.days>=90);
  const activeCustomerIds=new Set(monthSales.map(o=>o.customer_id).filter(Boolean));
  const customerStats=new Map<string,{name:string,total:number,orders:number}>();for(const o of monthSales){const key=o.customer_id||o.id;const name=o.customers?.trade_name||o.customers?.name||o.customer_name||'Cliente';const cur=customerStats.get(key)||{name,total:0,orders:0};cur.total+=Number(o.total||0);cur.orders++;customerStats.set(key,cur)}
  const top=[...customerStats.values()].sort((a,b)=>b.total-a.total).slice(0,5);const overdue=fs.filter(f=>new Date(f.due_at)<now);
  const revenuePct=percent(revenue,Number(goal.revenue_goal||0));const ordersPct=percent(monthSales.length,Number(goal.orders_goal||0));const customersPct=percent(activeCustomerIds.size,Number(goal.customers_goal||0));
  const productProgress=productGoals.map((g:any)=>{const sold=monthItems.reduce((sum:number,item:any)=>{const p=item.products||{};const brandOk=!g.brand||String(p.brand||'').toUpperCase()===String(g.brand).toUpperCase();const categoryOk=!g.category||String(p.category||'').toUpperCase()===String(g.category).toUpperCase();const prefixOk=!g.name_starts_with||String(p.name||'').trim().toUpperCase().startsWith(String(g.name_starts_with).trim().toUpperCase());return brandOk&&categoryOk&&prefixOk?sum+Number(item.quantity||0):sum},0);return{...g,sold,pct:percent(sold,Number(g.quantity_goal||0)),remaining:Math.max(0,Number(g.quantity_goal||0)-sold)}});
  return <AppShell>
    <div className="seller-hero"><div><span className="eyebrow">MINHA ÁREA COMERCIAL</span><h1>Bom dia, {profile.name.split(' ')[0]}</h1><p>Sua rotina, resultados, metas e próximos contatos em um só lugar.</p></div><div className="seller-hero-actions"><Link className="btn" href="/crm"><CalendarClock size={17}/>Abrir CRM</Link><Link className="btn btn-primary" href="/catalogo"><ShoppingCart size={17}/>Novo pedido</Link></div></div>
    <section className="dashboard-kpis"><div className="dash-kpi accent-orange"><div className="dash-kpi-icon"><WalletCards size={22}/></div><span>Faturamento no mês</span><strong>{money(revenue)}</strong><small>{monthSales.length} pedidos aprovados</small></div><div className="dash-kpi accent-green"><div className="dash-kpi-icon"><TrendingUp size={22}/></div><span>Ticket médio</span><strong>{money(ticket)}</strong><small>por pedido aprovado</small></div><div className="dash-kpi accent-blue"><div className="dash-kpi-icon"><Users size={22}/></div><span>Clientes atendidos</span><strong>{activeCustomerIds.size}</strong><small>de {cs.length} na carteira</small></div><div className="dash-kpi accent-red"><div className="dash-kpi-icon"><AlertTriangle size={22}/></div><span>Aguardando ação</span><strong>{open.length+overdue.length}</strong><small>{open.length} pedidos · {overdue.length} contatos</small></div></section>
    <section className="seller-grid"><div className="card seller-goals"><div className="dashboard-card-head"><div><h2>Metas do mês</h2><p>Acompanhamento em tempo real.</p></div><Target size={21}/></div>
      <div className="goal-row"><div><b>Faturamento</b><span>{money(revenue)} de {money(Number(goal.revenue_goal||0))}</span></div><strong>{revenuePct}%</strong><div className="goal-track"><i style={{width:`${revenuePct}%`}}/></div></div>
      <div className="goal-row"><div><b>Pedidos</b><span>{monthSales.length} de {Number(goal.orders_goal||0)}</span></div><strong>{ordersPct}%</strong><div className="goal-track"><i style={{width:`${ordersPct}%`}}/></div></div>
      <div className="goal-row"><div><b>Clientes atendidos</b><span>{activeCustomerIds.size} de {Number(goal.customers_goal||0)}</span></div><strong>{customersPct}%</strong><div className="goal-track"><i style={{width:`${customersPct}%`}}/></div></div>
      {!goal.id&&<div className="dashboard-empty"><Target size={18}/>O administrador ainda não definiu suas metas deste mês.</div>}
      {!!productProgress.length&&<div className="product-goals-progress"><div className="product-goals-progress-head"><h3>Metas por produto</h3><span>Quantidade vendida no mês</span></div>{productProgress.map((g:any)=><div className="goal-row product-goal-progress-row" key={g.id}><div><b>{g.goal_name}</b><span>{g.sold} de {g.quantity_goal} unidades · faltam {g.remaining}</span></div><strong>{g.pct}%</strong><div className="goal-track"><i style={{width:`${g.pct}%`}}/></div></div>)}</div>}
    </div>
    <div className="card seller-agenda"><div className="dashboard-card-head"><div><h2>Agenda de hoje</h2><p>Contatos que merecem prioridade.</p></div><Link href="/crm">Ver CRM</Link></div><div className="seller-agenda-list">{fs.slice(0,6).map((f:any)=>{const phone=whatsapp(f.customers?.whatsapp||f.customers?.phone);const late=new Date(f.due_at)<now;return <div className={late?'seller-agenda-item late':'seller-agenda-item'} key={f.id}><div><b>{f.customers?.trade_name||f.customers?.name||'Cliente'}</b><small>{f.title}</small><span>{new Date(f.due_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · {f.channel}</span></div>{phone&&<a target="_blank" rel="noreferrer" href={`https://wa.me/55${phone}`}><Phone size={17}/></a>}</div>})}{!fs.length&&<div className="dashboard-empty"><CheckCircle2 size={18}/>Nenhum contato pendente.</div>}</div></div></section>
    <section className="seller-grid seller-lower"><div className="card"><div className="dashboard-card-head"><div><h2>Saúde da carteira</h2><p>Clientes por tempo sem compra.</p></div><Users size={20}/></div><div className="portfolio-buckets"><Link href="/crm" className="bucket warning"><strong>{d30.length}</strong><span>30 a 59 dias</span></Link><Link href="/crm" className="bucket orange"><strong>{d60.length}</strong><span>60 a 89 dias</span></Link><Link href="/crm" className="bucket danger"><strong>{d90.length}</strong><span>90+ dias ou nunca</span></Link></div></div>
    <div className="card"><div className="dashboard-card-head"><div><h2>Melhores clientes do mês</h2><p>Ranking por faturamento aprovado.</p></div></div><div className="seller-ranking">{top.map((c,i)=><div key={c.name}><span>{i+1}</span><div><b>{c.name}</b><small>{c.orders} pedidos</small></div><strong>{money(c.total)}</strong></div>)}{!top.length&&<div className="dashboard-empty">Nenhuma venda aprovada no mês.</div>}</div></div></section>
    <section className="card"><div className="dashboard-card-head"><div><h2>Pedidos recentes</h2><p>Acompanhe rapidamente o andamento.</p></div><Link href="/pedidos">Ver todos</Link></div><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Status</th><th>Valor</th><th></th></tr></thead><tbody>{os.slice(0,8).map(o=><tr key={o.id}><td>#{String(o.number).padStart(6,'0')}</td><td>{o.customers?.trade_name||o.customers?.name||o.customer_name||'-'}</td><td>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td><td><span className={`status ${o.status}`}>{o.status.replaceAll('_',' ')}</span></td><td>{money(Number(o.total||0))}</td><td><Link href={`/pedidos/${o.id}`}>Abrir</Link></td></tr>)}</tbody></table></div></section>
  </AppShell>
}
