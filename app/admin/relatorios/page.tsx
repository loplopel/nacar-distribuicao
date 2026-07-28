import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Building2, Download, Package, ReceiptText, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
const brl=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default async function ReportsPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
  const profile=await getCurrentProfile();
  if(profile?.role!=='admin') redirect('/catalogo');
  const params=await searchParams;
  const now=new Date();
  const first=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
  const from=params.from||first;
  const to=params.to||now.toISOString().slice(0,10);
  const end=new Date(`${to}T23:59:59.999`).toISOString();
  const db=adminClient();
  const [ordersQ, customersQ, productsQ, sellersQ]=await Promise.all([
    db.from('orders').select('id,total,status,created_at').gte('created_at',`${from}T00:00:00.000Z`).lte('created_at',end),
    db.from('customers').select('id,active'),
    db.from('products').select('id,active,stock'),
    db.from('profiles').select('id,active').eq('role','vendedor'),
  ]);
  const orders=(ordersQ.data||[]) as any[];
  const valid=new Set(['aprovado','separacao','faturado','enviado','finalizado']);
  const revenue=orders.filter(o=>valid.has(o.status)).reduce((s,o)=>s+Number(o.total||0),0);
  const links=[
    {type:'pedidos',title:'Pedidos',desc:'Pedidos, clientes, vendedores, status e valores.',icon:<ReceiptText size={24}/>},
    {type:'clientes',title:'Empresas',desc:'Cadastro comercial, contatos, região e situação.',icon:<Building2 size={24}/>},
    {type:'produtos',title:'Produtos',desc:'Catálogo, EAN, marca, estoque e preços.',icon:<Package size={24}/>},
    {type:'vendedores',title:'Vendedores',desc:'Equipe comercial, carteira e dados de contato.',icon:<Users size={24}/>},
  ];
  return <AppShell>
    <div className="page-head"><div><span className="eyebrow">SISTEMA</span><h1>Relatórios e exportações</h1><p>Exporte dados da operação em CSV compatível com Excel e use a impressão do navegador para PDF.</p></div></div>
    <form className="card report-filter" method="get"><label>Data inicial<input type="date" name="from" defaultValue={from}/></label><label>Data final<input type="date" name="to" defaultValue={to}/></label><button className="btn btn-primary" type="submit"><BarChart3 size={17}/> Atualizar período</button></form>
    <section className="report-kpis">
      <div className="card"><span>Pedidos no período</span><strong>{orders.length}</strong></div>
      <div className="card"><span>Faturamento válido</span><strong>{brl(revenue)}</strong></div>
      <div className="card"><span>Empresas ativas</span><strong>{(customersQ.data||[]).filter((x:any)=>x.active).length}</strong></div>
      <div className="card"><span>Produtos ativos</span><strong>{(productsQ.data||[]).filter((x:any)=>x.active).length}</strong></div>
      <div className="card"><span>Vendedores ativos</span><strong>{(sellersQ.data||[]).filter((x:any)=>x.active).length}</strong></div>
    </section>
    <section className="report-grid">{links.map(item=><div className="card report-card" key={item.type}><div className="report-icon">{item.icon}</div><h2>{item.title}</h2><p>{item.desc}</p><div className="report-actions"><Link className="btn btn-primary" href={`/api/admin/export/${item.type}?from=${from}&to=${to}`}><Download size={16}/> Exportar CSV</Link></div></div>)}</section>
    <section className="card print-help"><h2>Salvar em PDF</h2><p>Abra qualquer relatório ou tela detalhada e use <b>Ctrl + P</b> → <b>Salvar como PDF</b>. O layout de impressão já remove o menu lateral.</p></section>
  </AppShell>
}
