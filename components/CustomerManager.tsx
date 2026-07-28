'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Seller = { id: string; name: string };
type Customer = {
  id: string; name: string; legal_name?: string | null; cnpj?: string | null; city?: string | null; state?: string | null;
  phone?: string | null; whatsapp?: string | null; email?: string | null; seller_id?: string | null; seller_name?: string | null;
  payment_terms?: string | null; credit_limit?: number | null; region?: string | null; notes?: string | null; active: boolean;
  users_count?: number; orders_count?: number;
};

export default function CustomerManager({ customers, sellers }: { customers: Customer[]; sellers: Seller[] }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState<Customer | null>(null);
  const [search,setSearch]=useState('');
  const [sellerFilter,setSellerFilter]=useState('todos');
  const [statusFilter,setStatusFilter]=useState<'todos'|'ativos'|'inativos'>('todos');
  const [stateFilter,setStateFilter]=useState('todos');
  const [sort,setSort]=useState<'nome'|'pedidos'|'compradores'|'limite'>('nome');

  const states=useMemo(()=>Array.from(new Set(customers.map(c=>c.state).filter(Boolean) as string[])).sort(),[customers]);
  const visibleCustomers=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return customers.filter(customer=>{
      const matchesSearch=!q||[customer.name,customer.legal_name,customer.cnpj,customer.email,customer.city,customer.state,customer.region,customer.seller_name,customer.phone,customer.whatsapp].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
      const matchesSeller=sellerFilter==='todos'||(sellerFilter==='sem-vendedor'?!customer.seller_id:customer.seller_id===sellerFilter);
      const matchesStatus=statusFilter==='todos'||(statusFilter==='ativos'?customer.active:!customer.active);
      const matchesState=stateFilter==='todos'||customer.state===stateFilter;
      return matchesSearch&&matchesSeller&&matchesStatus&&matchesState;
    }).sort((a,b)=>{
      if(sort==='pedidos') return (b.orders_count||0)-(a.orders_count||0);
      if(sort==='compradores') return (b.users_count||0)-(a.users_count||0);
      if(sort==='limite') return Number(b.credit_limit||0)-Number(a.credit_limit||0);
      return a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'});
    });
  },[customers,search,sellerFilter,statusFilter,stateFilter,sort]);

  async function patch(id: string, body: object, reload = true) {
    setBusy(id); setMessage('');
    const response = await fetch(`/api/admin/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    setMessage(response.ok ? 'Cliente atualizado com sucesso.' : result.error || 'Erro ao atualizar cliente.');
    setBusy(''); if (response.ok && reload) setTimeout(() => location.reload(), 450);
    return response.ok;
  }

  async function remove(customer: Customer) {
    const confirmed = confirm(`Excluir definitivamente a empresa ${customer.name}?\n\nA exclusão só será permitida se ela não possuir compradores nem pedidos vinculados.`);
    if (!confirmed) return;
    setBusy(customer.id); setMessage('');
    const response = await fetch(`/api/admin/customers/${customer.id}`, { method: 'DELETE' });
    const result = await response.json();
    setMessage(response.ok ? 'Empresa excluída com sucesso.' : result.error || 'Erro ao excluir empresa.');
    setBusy(''); if (response.ok) setTimeout(() => location.reload(), 450);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return;
    const ok = await patch(draft.id, {name:draft.name,legal_name:draft.legal_name||null,cnpj:draft.cnpj||null,city:draft.city||null,state:draft.state||null,phone:draft.phone||null,whatsapp:draft.whatsapp||null,email:draft.email||null,seller_id:draft.seller_id||null,payment_terms:draft.payment_terms||null,credit_limit:Number(draft.credit_limit||0),region:draft.region||null,notes:draft.notes||null,active:draft.active}, false);
    if (ok) { setDraft(null); setTimeout(() => location.reload(), 450); }
  }

  return <>
    <div className="card admin-filter-card">
      <div className="admin-filter-grid customer-filter-grid">
        <label className="admin-filter-search">Buscar<input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Empresa, CNPJ, cidade, vendedor ou contato"/></label>
        <label>Vendedor<select className="input" value={sellerFilter} onChange={e=>setSellerFilter(e.target.value)}><option value="todos">Todos</option><option value="sem-vendedor">Sem vendedor</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>UF<select className="input" value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="todos">Todas</option>{states.map(state=><option key={state} value={state}>{state}</option>)}</select></label>
        <label>Situação<select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}><option value="todos">Todas</option><option value="ativos">Ativas</option><option value="inativos">Inativas</option></select></label>
        <label>Ordenar<select className="input" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="nome">Nome</option><option value="pedidos">Mais pedidos</option><option value="compradores">Mais compradores</option><option value="limite">Maior limite</option></select></label>
        <div className="filter-result"><strong>{visibleCustomers.length}</strong><span>empresas exibidas</span></div>
      </div>
    </div>

    <div className="card table-wrap">
      {message&&<div className={message.includes('sucesso')?'success':'error'}>{message}</div>}
      {visibleCustomers.length===0?<div className="empty">Nenhuma empresa encontrada com os filtros atuais.</div>:<table className="table">
        <thead><tr><th>Empresa</th><th>CNPJ</th><th>Vendedor</th><th>Contato</th><th>Compradores</th><th>Pedidos</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>{visibleCustomers.map(customer=><tr key={customer.id}>
          <td><b>{customer.name}</b><small>{customer.legal_name||customer.email||''}</small></td>
          <td>{customer.cnpj||'-'}<small>{[customer.city,customer.state].filter(Boolean).join(' / ')||''}</small></td>
          <td>{customer.seller_name||'Não vinculado'}<small>{customer.region||''}</small></td>
          <td>{customer.whatsapp||customer.phone||'-'}<small>{customer.email||''}</small></td>
          <td><b>{customer.users_count||0}</b><small>usuários vinculados</small></td>
          <td><b>{customer.orders_count||0}</b><small>pedidos registrados</small></td>
          <td><span className={customer.active?'badge':'badge warn'}>{customer.active?'Ativa':'Inativa'}</span></td>
          <td><div className="row-actions">
            <Link className="btn btn-light btn-sm" href={`/admin/clientes/${customer.id}`}>Ver empresa</Link>
            <button className="btn btn-light btn-sm" onClick={()=>setDraft({...customer})}>Editar</button>
            <button className="btn btn-light btn-sm" disabled={busy===customer.id} onClick={()=>patch(customer.id,{active:!customer.active})}>{customer.active?'Inativar':'Ativar'}</button>
            <button className="btn btn-danger btn-sm" disabled={busy===customer.id} onClick={()=>remove(customer)}>Excluir</button>
          </div></td>
        </tr>)}</tbody>
      </table>}
    </div>

    {draft&&<div className="modal-overlay" onMouseDown={()=>setDraft(null)}>
      <form className="modal-card modal-large" onSubmit={save} onMouseDown={event=>event.stopPropagation()}>
        <div className="modal-head"><div><h2>Editar empresa</h2><p>Atualize dados empresariais e comerciais.</p></div><button type="button" className="modal-close" onClick={()=>setDraft(null)}>×</button></div>
        <div className="form-grid">
          <label>Nome fantasia<input className="input" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></label>
          <label>Razão social<input className="input" value={draft.legal_name||''} onChange={e=>setDraft({...draft,legal_name:e.target.value})}/></label>
          <label>CNPJ<input className="input" value={draft.cnpj||''} onChange={e=>setDraft({...draft,cnpj:e.target.value})}/></label>
          <label>E-mail<input className="input" type="email" value={draft.email||''} onChange={e=>setDraft({...draft,email:e.target.value})}/></label>
          <label>Telefone<input className="input" value={draft.phone||''} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label>
          <label>WhatsApp<input className="input" value={draft.whatsapp||''} onChange={e=>setDraft({...draft,whatsapp:e.target.value})}/></label>
          <label>Cidade<input className="input" value={draft.city||''} onChange={e=>setDraft({...draft,city:e.target.value})}/></label>
          <label>Estado<input className="input" maxLength={2} value={draft.state||''} onChange={e=>setDraft({...draft,state:e.target.value.toUpperCase()})}/></label>
          <label>Região<input className="input" value={draft.region||''} onChange={e=>setDraft({...draft,region:e.target.value})}/></label>
          <label>Vendedor<select className="input" value={draft.seller_id||''} onChange={e=>setDraft({...draft,seller_id:e.target.value||null})}><option value="">Não vinculado</option>{sellers.map(seller=><option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
          <label>Condição de pagamento<input className="input" value={draft.payment_terms||''} onChange={e=>setDraft({...draft,payment_terms:e.target.value})}/></label>
          <label>Limite de crédito<input className="input" type="number" min="0" step="0.01" value={draft.credit_limit||0} onChange={e=>setDraft({...draft,credit_limit:Number(e.target.value)})}/></label>
          <label className="form-span-3">Observações<textarea className="input" rows={3} value={draft.notes||''} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
          <label className="check-edit"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Empresa ativa</label>
        </div>
        <div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>setDraft(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy===draft.id}>{busy===draft.id?'Salvando...':'Salvar alterações'}</button></div>
      </form>
    </div>}
  </>
}
