import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, BadgeDollarSign, BrainCircuit, CalendarClock, MessageCircle, PackageCheck, ShoppingBag, Star, TrendingDown, TrendingUp, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import VisitManager from "@/components/VisitManager";
import { adminClient } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/supabase-server";
import { buildCustomerIntelligence, type PurchaseLine } from "@/lib/intelligence/customer-intelligence";

export const dynamic = "force-dynamic";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const validStatuses = new Set(["aprovado", "separacao", "faturado", "enviado", "finalizado"]);

type TimelineItem = { id: string; at: string; title: string; detail: string; kind: "pedido" | "contato" | "followup" | "visita" };

function daysSince(value?: string | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function scoreCustomer(params: { days: number | null; orders: number; total: number; recentTotal: number; previousTotal: number; openFollowups: number }) {
  let score = 50;
  const reasons: string[] = [];
  if (params.days === null) { score -= 30; reasons.push("Ainda não realizou compra"); }
  else if (params.days <= 30) { score += 20; reasons.push("Compra recente"); }
  else if (params.days <= 60) { score += 5; reasons.push("Atenção: mais de 30 dias sem comprar"); }
  else { score -= Math.min(35, Math.floor(params.days / 4)); reasons.push(`${params.days} dias sem comprar`); }
  if (params.orders >= 5) { score += 10; reasons.push("Boa recorrência de pedidos"); }
  if (params.total >= 50000) { score += 10; reasons.push("Conta de alto valor"); }
  if (params.recentTotal > params.previousTotal && params.previousTotal > 0) { score += 10; reasons.push("Compras em crescimento"); }
  if (params.recentTotal < params.previousTotal * .7 && params.previousTotal > 0) { score -= 12; reasons.push("Queda relevante nas compras"); }
  if (params.openFollowups > 0) { score -= 5; reasons.push("Possui follow-up pendente"); }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export default async function Company360({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "cliente") redirect("/catalogo");
  const { id } = await params;
  const db = adminClient();

  let customerQuery = db.from("customers").select("*,seller:profiles!customers_seller_id_fkey(id,name,email,phone,whatsapp)").eq("id", id);
  if (profile.role === "vendedor") customerQuery = customerQuery.eq("seller_id", profile.id);

  const [{ data: customer }, { data: users }, { data: orders }, { data: interactions }, { data: followups }, { data: visits }, { data: photoRows }] = await Promise.all([
    customerQuery.maybeSingle(),
    db.from("profiles").select("id,name,email,job_title,phone,whatsapp,active").eq("customer_id", id).order("name"),
    db.from("orders").select("id,number,status,total,created_at,customer_name").eq("customer_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("crm_interactions").select("id,channel,message,created_at,seller_id").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("crm_followups").select("id,title,notes,channel,status,due_at,completed_at,created_at").eq("customer_id", id).order("due_at", { ascending: false }).limit(100),
    db.from("customer_visits").select("id,status,started_at,finished_at,outcome,notes,next_action,next_contact_at,start_latitude,start_longitude,outcome_code,order_id,proposal_id").eq("customer_id", id).order("started_at", { ascending: false }).limit(100),
    db.from("customer_photos").select("id,caption,created_at,storage_path,file_name").eq("customer_id", id).order("created_at", { ascending: false }).limit(60),
  ]);
  if (!customer) notFound();

  const photos = await Promise.all((photoRows || []).map(async (photo) => {
    const { data } = await db.storage.from("customer-photos").createSignedUrl(photo.storage_path, 3600);
    return { id: photo.id, caption: photo.caption, created_at: photo.created_at, file_name: photo.file_name, signed_url: data?.signedUrl || null };
  }));

  const validOrders = (orders || []).filter((o) => validStatuses.has(o.status));
  const total = validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const avgTicket = validOrders.length ? total / validOrders.length : 0;
  const lastOrder = validOrders[0] || null;
  const days = daysSince(lastOrder?.created_at);
  const now = new Date();
  const recentStart = new Date(now); recentStart.setDate(recentStart.getDate() - 90);
  const previousStart = new Date(recentStart); previousStart.setDate(previousStart.getDate() - 90);
  const recentTotal = validOrders.filter(o => new Date(o.created_at) >= recentStart).reduce((s,o)=>s+Number(o.total||0),0);
  const previousTotal = validOrders.filter(o => new Date(o.created_at) >= previousStart && new Date(o.created_at) < recentStart).reduce((s,o)=>s+Number(o.total||0),0);
  const pendingFollowups = (followups || []).filter(f => f.status === "pendente");
  const score = scoreCustomer({ days, orders: validOrders.length, total, recentTotal, previousTotal, openFollowups: pendingFollowups.length });

  const orderIds = validOrders.map(o => o.id);
  const { data: orderItems } = orderIds.length
    ? await db.from("order_items").select("order_id,quantity,unit_price,product_id,products(name,brand,category)").in("order_id", orderIds)
    : { data: [] as any[] };
  const brandMap = new Map<string, number>();
  const productMap = new Map<string, number>();
  for (const item of orderItems || []) {
    const product: any = item.products;
    const qty = Number(item.quantity || 0);
    const brand = product?.brand || "Sem marca";
    const name = product?.name || "Produto";
    brandMap.set(brand, (brandMap.get(brand) || 0) + qty);
    productMap.set(name, (productMap.get(name) || 0) + qty);
  }
  const topBrands = [...brandMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topProducts = [...productMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);

  const timeline: TimelineItem[] = [
    ...(orders || []).map(o => ({ id:`o-${o.id}`, at:o.created_at, title:`Pedido nº ${String(o.number).padStart(6,"0")}`, detail:`${String(o.status).replaceAll("_"," ")} · ${money.format(Number(o.total||0))}`, kind:"pedido" as const })),
    ...(interactions || []).map(i => ({ id:`i-${i.id}`, at:i.created_at, title:`Contato por ${i.channel}`, detail:i.message || "Contato comercial registrado", kind:"contato" as const })),
    ...(followups || []).map(f => ({ id:`f-${f.id}`, at:f.completed_at || f.due_at || f.created_at, title:f.status === "concluido" ? `Follow-up concluído: ${f.title}` : `Follow-up: ${f.title}`, detail:`${f.channel}${f.notes ? ` · ${f.notes}` : ""}`, kind:"followup" as const })),
    ...(visits || []).map(v => ({ id:`v-${v.id}`, at:v.finished_at || v.started_at, title:v.status === "em_andamento" ? "Visita em andamento" : v.status === "cancelada" ? "Visita cancelada" : "Visita comercial", detail:v.outcome || v.notes || "Registro de visita", kind:"visita" as const })),
  ].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,40);

  const trend = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : recentTotal > 0 ? 100 : 0;
  const orderById = new Map(validOrders.map((order) => [order.id, order]));
  const intelligenceLines: PurchaseLine[] = (orderItems || []).map((item: any) => {
    const order: any = orderById.get(item.order_id);
    const product: any = item.products;
    return order ? { orderId: order.id, orderedAt: order.created_at, total: Number(order.total || 0), quantity: Number(item.quantity || 0), productId: item.product_id, productName: product?.name || "Produto", brand: product?.brand || "Sem marca", category: product?.category || "Sem categoria" } : null;
  }).filter(Boolean) as PurchaseLine[];
  const intelligence = buildCustomerIntelligence(intelligenceLines);

  const opportunities = [
    days === null ? "Realizar o primeiro contato comercial e montar pedido inicial." : days > 45 ? `Reativar a conta: está há ${days} dias sem comprar.` : null,
    pendingFollowups.length ? `Concluir ${pendingFollowups.length} follow-up(s) pendente(s).` : null,
    trend < -20 ? `Compras caíram ${Math.abs(trend).toFixed(0)}% no comparativo de 90 dias.` : null,
    topBrands[0] ? `Priorizar novidades e reposição da marca ${topBrands[0][0]}.` : "Apresentar o catálogo e identificar marcas de interesse.",
  ].filter(Boolean) as string[];

  return <AppShell>
    <Link className="back-link" href={profile.role === "admin" ? "/admin/clientes" : "/clientes"}>← Voltar para empresas</Link>
    <section className="company360-hero">
      <div><span className="eyebrow">PERFIL 360° DA EMPRESA</span><h1>{customer.trade_name || customer.name}</h1><p>{customer.legal_name || "Empresa cliente"} · {customer.cnpj || "CNPJ não informado"}</p></div>
      <div className="company360-actions"><a className="btn" href={customer.whatsapp ? `https://wa.me/55${String(customer.whatsapp).replace(/\D/g,"")}` : "#"} target="_blank"><MessageCircle size={17}/>WhatsApp</a><Link className="btn" href={`/pedido-inteligente/${customer.id}`}><BrainCircuit size={17}/>Pedido inteligente</Link><Link className="btn btn-primary" href={`/propostas/nova?customer=${customer.id}`}><ShoppingBag size={17}/>Nova proposta</Link><Link className="btn btn-primary" href={`/catalogo?customer=${customer.id}`}><ShoppingBag size={17}/>Montar pedido</Link></div>
    </section>

    <section className="company360-kpis">
      <div className="card company360-score"><span>Score comercial</span><strong>{score.score}</strong><small>/ 100</small><div className="score-bar"><i style={{width:`${score.score}%`}}/></div><p>{score.reasons[0] || "Conta em acompanhamento"}</p></div>
      <div className="card kpi"><BadgeDollarSign/><span>Faturamento acumulado</span><b>{money.format(total)}</b><small>{validOrders.length} pedidos válidos</small></div>
      <div className="card kpi"><PackageCheck/><span>Ticket médio</span><b>{money.format(avgTicket)}</b><small>por pedido válido</small></div>
      <div className="card kpi"><CalendarClock/><span>Última compra</span><b>{days === null ? "Nunca" : `${days} dias`}</b><small>{lastOrder ? new Date(lastOrder.created_at).toLocaleDateString("pt-BR") : "Sem histórico"}</small></div>
      <div className="card kpi">{trend >= 0 ? <TrendingUp/> : <TrendingDown/>}<span>Tendência 90 dias</span><b>{trend >= 0 ? "+" : ""}{trend.toFixed(0)}%</b><small>{money.format(recentTotal)} no período atual</small></div>
    </section>

    <section className="ai-assistant-card">
      <div className="ai-assistant-head"><div><span className="eyebrow">NACS INTELLIGENCE</span><h2>Assistente Comercial</h2></div><span className="ai-pill">{intelligence.health === "crescendo" ? "CLIENTE CRESCENDO" : intelligence.health === "em_risco" ? "ATENÇÃO COMERCIAL" : intelligence.health === "novo" ? "CONTA NOVA" : "CLIENTE ESTÁVEL"}</span></div>
      <p className="ai-summary">{intelligence.summary}</p>
      <div className="ai-grid"><div className="ai-metric"><span>Índice de potencial</span><b>{intelligence.potential}/100</b></div><div className="ai-metric"><span>Probabilidade de fechamento</span><b>{intelligence.closingProbability}%</b></div><div className="ai-metric"><span>Frequência média</span><b>{intelligence.averageIntervalDays ? `${intelligence.averageIntervalDays} dias` : "Sem base"}</b></div><div className="ai-metric"><span>Próxima compra estimada</span><b>{intelligence.nextPurchaseInDays === null ? "Sem base" : intelligence.nextPurchaseInDays === 0 ? "Agora" : `${intelligence.nextPurchaseInDays} dias`}</b></div></div>
      <div className="ai-columns"><div className="ai-column"><h3>Reposição recomendada</h3>{intelligence.recommendations.slice(0,4).map((item)=><div className="ai-recommendation" key={item.productId}><div><b>{item.productName}</b><small>{item.suggestedQuantity} un. · {item.reason}</small></div><span className="ai-confidence">{item.confidence}%</span></div>)}{!intelligence.recommendations.length&&<p>Sem histórico suficiente para sugerir produtos.</p>}</div><div className="ai-column"><h3>Alertas automáticos</h3><ul>{intelligence.alerts.map((item)=><li key={item}>{item}</li>)}</ul></div><div className="ai-column"><h3>Próximas ações</h3><ul>{intelligence.opportunities.map((item)=><li key={item}>{item}</li>)}</ul></div></div>
      <div className="ai-assistant-action"><Link className="btn btn-primary" href={`/pedido-inteligente/${customer.id}`}><BrainCircuit size={18}/>Gerar pedido inteligente</Link></div>
    </section>

    <div className="company360-grid">
      <section className="card company360-opportunities"><div className="card-title"><div><h2>Oportunidades recomendadas</h2><p>Prioridades calculadas pelo histórico comercial atual.</p></div><AlertTriangle/></div><div className="opportunity-list">{opportunities.map((item,index)=><div key={item}><span>{index+1}</span><p>{item}</p></div>)}</div></section>
      <section className="card"><div className="card-title"><div><h2>Dados comerciais</h2><p>Informações centrais da conta.</p></div></div><dl className="detail-list company360-details"><div><dt>Vendedor</dt><dd>{customer.seller?.name || "Não vinculado"}</dd></div><div><dt>Condição</dt><dd>{customer.payment_terms || "-"}</dd></div><div><dt>Limite</dt><dd>{money.format(Number(customer.credit_limit || 0))}</dd></div><div><dt>Contato</dt><dd>{customer.whatsapp || customer.phone || "-"}</dd></div><div><dt>E-mail</dt><dd>{customer.email || "-"}</dd></div><div><dt>Local</dt><dd>{[customer.city,customer.state].filter(Boolean).join(" / ") || "-"}</dd></div></dl></section>
    </div>

    <div className="company360-grid two">
      <section className="card"><div className="card-title"><div><h2>Marcas favoritas</h2><p>Por unidades compradas.</p></div><Star/></div><div className="rank-bars">{topBrands.map(([name,qty],i)=><div key={name}><span>{i+1}</span><b>{name}</b><i><em style={{width:`${Math.max(8,(qty/(topBrands[0]?.[1]||1))*100)}%`}}/></i><strong>{qty}</strong></div>)}{!topBrands.length&&<div className="empty">Sem dados suficientes.</div>}</div></section>
      <section className="card"><div className="card-title"><div><h2>Produtos mais comprados</h2><p>Ranking histórico por quantidade.</p></div></div><div className="simple-ranking">{topProducts.map(([name,qty],i)=><div key={name}><span>{i+1}</span><p>{name}</p><b>{qty} un.</b></div>)}{!topProducts.length&&<div className="empty">Sem dados suficientes.</div>}</div></section>
    </div>

    <VisitManager customerId={customer.id} visits={(visits || []) as any} photos={photos} />

    <section className="card company360-timeline"><div className="card-title"><div><h2>Timeline comercial</h2><p>Pedidos, contatos e follow-ups em ordem cronológica.</p></div></div><div className="timeline-list">{timeline.map(item=><article key={item.id} className={`timeline-row ${item.kind}`}><div className="timeline-dot"/><div><b>{item.title}</b><p>{item.detail}</p><small>{dateTime.format(new Date(item.at))}</small></div></article>)}{!timeline.length&&<div className="empty">Nenhuma atividade registrada.</div>}</div></section>

    <section className="card table-wrap"><div className="card-title"><div><h2>Compradores vinculados</h2><p>{users?.length || 0} usuário(s) associado(s) à empresa.</p></div>{profile.role === "admin"&&<Link className="btn" href="/admin/usuarios">Gerenciar usuários</Link>}</div>{!users?.length?<div className="empty">Nenhum comprador vinculado.</div>:<table className="table"><thead><tr><th>Nome</th><th>Cargo</th><th>Contato</th><th>Situação</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><b>{user.name}</b><small>{user.email}</small></td><td>{user.job_title||"-"}</td><td>{user.whatsapp||user.phone||"-"}</td><td><span className={user.active?"badge":"badge warn"}>{user.active?"Ativo":"Inativo"}</span></td></tr>)}</tbody></table>}</section>
  </AppShell>;
}
