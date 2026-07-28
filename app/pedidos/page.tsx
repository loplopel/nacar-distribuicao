import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {createClient,getCurrentProfile} from '@/lib/supabase-server';

export default async function Pedidos(){
  const p=await getCurrentProfile();const s=await createClient();
  let q=s.from('orders').select('id,number,status,total,created_at,customer_name,customers(name),profiles!orders_created_by_fkey(name)').order('created_at',{ascending:false});
  if(p?.role==='cliente')q=q.eq('created_by',p.id);if(p?.role==='vendedor')q=q.eq('seller_id',p.id);
  const{data}=await q;
  return <AppShell><div className="page-head"><div><h1>Pedidos</h1><p>Acompanhe rascunhos, pedidos enviados e faturados.</p></div><span className="count">{data?.length||0} pedidos</span></div><div className="card table-wrap"><table className="table"><thead><tr><th>Número</th><th>Data</th><th>Cliente</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>{(data||[]).map((o:any)=><tr key={o.id}><td><b>#{String(o.number).padStart(6,'0')}</b></td><td>{new Date(o.created_at).toLocaleString('pt-BR')}</td><td>{o.customers?.name||o.customer_name||o.profiles?.name||'-'}</td><td><span className={`badge status-${o.status}`}>{String(o.status).replaceAll('_',' ')}</span></td><td><b>{Number(o.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></td><td><Link className="table-link" href={`/pedidos/${o.id}`}>Ver pedido</Link></td></tr>)}</tbody></table>{!data?.length&&<div className="empty">Nenhum pedido encontrado.</div>}</div></AppShell>
}
