import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentProfile } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase-admin";
import { Boxes, Database, FileSpreadsheet, PackageCheck, PackageX, RefreshCw, Tags } from "lucide-react";

const brl = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizada";

export default async function Produtos({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/catalogo");
  const params = await searchParams;
  const client = adminClient();

  const [totalQ, activeQ, zeroQ, brandsQ, categoriesQ, recentQ, logsQ] = await Promise.all([
    client.from("products").select("*", { count: "exact", head: true }),
    client.from("products").select("*", { count: "exact", head: true }).eq("active", true),
    client.from("products").select("*", { count: "exact", head: true }).eq("active", true).lte("stock", 0),
    client.from("products").select("brand").eq("active", true).not("brand", "is", null),
    client.from("products").select("category").eq("active", true).not("category", "is", null),
    client.from("products").select("id,plu,name,brand,size,cost_price,stock,status,image_url,updated_at").order("updated_at", { ascending: false }).limit(12),
    client.from("sync_logs").select("*").order("started_at", { ascending: false }).limit(8),
  ]);
  const brands = new Set((brandsQ.data || []).map((x) => x.brand).filter(Boolean)).size;
  const categories = new Set((categoriesQ.data || []).map((x) => x.category).filter(Boolean)).size;
  const latest = logsQ.data?.[0];

  return <AppShell>
    <div className="page-head"><div><span className="eyebrow">CATÁLOGO B2B</span><h1>Produtos</h1><p>Controle da fonte oficial, disponibilidade e histórico de atualização.</p></div><span className="count">{activeQ.count || 0} ativos</span></div>

    {params.ok && <div className="success sync-result"><b>Sincronização concluída.</b><span>{params.count} lidos</span><span>{params.created} novos</span><span>{params.updated} atualizados</span><span>{params.disabled} inativados</span><span>{Math.round(Number(params.duration || 0)/100)/10}s</span></div>}
    {params.error && <div className="error">{params.error === "url" ? "Configure GOOGLE_SHEET_CSV_URL no arquivo .env.local." : params.error}</div>}

    <div className="stats-grid catalog-stats">
      <div className="stat-card"><PackageCheck/><div><span>Produtos ativos</span><strong>{activeQ.count || 0}</strong></div></div>
      <div className="stat-card"><PackageX/><div><span>Sem estoque</span><strong>{zeroQ.count || 0}</strong></div></div>
      <div className="stat-card"><Tags/><div><span>Marcas</span><strong>{brands}</strong></div></div>
      <div className="stat-card"><Boxes/><div><span>Categorias</span><strong>{categories}</strong></div></div>
    </div>

    <div className="grid grid-3 product-admin-actions">
      <div className="card action-card"><div className="action-icon"><FileSpreadsheet size={24}/></div><h2>Google Sheets</h2><p>Atualiza produtos, preços, estoque e imagens usando a planilha publicada.</p><form action="/api/sync-products" method="post"><button className="btn btn-primary"><RefreshCw size={17}/> Sincronizar agora</button></form></div>
      <div className="card action-card"><div className="action-icon"><Database size={24}/></div><h2>Última sincronização</h2><p>{dateTime(latest?.finished_at || latest?.started_at)}</p><span className={`badge ${latest?.status === "error" ? "warn" : ""}`}>{latest?.status === "error" ? "Com erro" : latest ? "Concluída" : "Sem histórico"}</span></div>
      <div className="card action-card"><div className="action-icon"><Boxes size={24}/></div><h2>Base do catálogo</h2><p>{totalQ.count || 0} registros totais, incluindo produtos inativos mantidos no histórico.</p><span className="badge">EAN ou PLU + tamanho</span></div>
    </div>

    <div className="grid grid-2 admin-lists">
      <div className="card"><div className="card-title"><div><h2>Últimos produtos atualizados</h2><p>Prévia dos registros mais recentes.</p></div></div>
        {!recentQ.data?.length ? <div className="empty">O catálogo ainda está vazio.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>Marca</th><th>Tam.</th><th>Estoque</th><th>Custo</th></tr></thead><tbody>{recentQ.data.map((p) => <tr key={p.id}><td><b>{p.name}</b><small>PLU {p.plu}</small></td><td>{p.brand || "—"}</td><td>{p.size || "—"}</td><td>{p.stock}</td><td>{brl(p.cost_price)}</td></tr>)}</tbody></table></div>}
      </div>
      <div className="card"><div className="card-title"><div><h2>Histórico de sincronizações</h2><p>Últimas tentativas processadas.</p></div></div>
        {!logsQ.data?.length ? <div className="empty">Nenhuma sincronização registrada.</div> : <div className="sync-history">{logsQ.data.map((log) => <div className="sync-row" key={log.id}><div><b>{dateTime(log.started_at)}</b><span>{log.status === "success" ? `${log.products_read} produtos • ${Math.round(log.duration_ms/100)/10}s` : log.error_message || "Falha"}</span></div><span className={`badge ${log.status === "error" ? "warn" : ""}`}>{log.status === "success" ? "Sucesso" : log.status === "running" ? "Executando" : "Erro"}</span></div>)}</div>}
      </div>
    </div>
  </AppShell>;
}
