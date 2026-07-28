'use client';

import { useMemo, useState } from 'react';

type Option = { id: string; name: string };
type CustomerOption = Option & { active?: boolean };
type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendedor' | 'cliente';
  active: boolean;
  job_title?: string | null;
  region?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  customer_id?: string | null;
  seller_id?: string | null;
  customer_name?: string | null;
  seller_name?: string | null;
};

type Props={
  users:User[];
  sellers:Option[];
  customers:CustomerOption[];
  initialRoleFilter?:'todos'|'admin'|'vendedor'|'cliente';
  lockRoleFilter?:boolean;
};

export default function UserManager({ users, sellers, customers, initialRoleFilter='todos', lockRoleFilter=false }: Props) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<User | null>(null);
  const [search,setSearch]=useState('');
  const [roleFilter,setRoleFilter]=useState(initialRoleFilter);
  const [statusFilter,setStatusFilter]=useState<'todos'|'ativos'|'inativos'>('todos');
  const [sort,setSort]=useState<'nome'|'email'|'regiao'>('nome');

  const visibleUsers=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return users.filter(user=>{
      const matchesSearch=!q||[user.name,user.email,user.job_title,user.region,user.customer_name,user.seller_name,user.phone,user.whatsapp].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
      const matchesRole=roleFilter==='todos'||user.role===roleFilter;
      const matchesStatus=statusFilter==='todos'||(statusFilter==='ativos'?user.active:!user.active);
      return matchesSearch&&matchesRole&&matchesStatus;
    }).sort((a,b)=>{
      const av=sort==='email'?a.email:sort==='regiao'?(a.region||''):a.name;
      const bv=sort==='email'?b.email:sort==='regiao'?(b.region||''):b.name;
      return av.localeCompare(bv,'pt-BR',{sensitivity:'base'});
    });
  },[users,search,roleFilter,statusFilter,sort]);

  async function patch(id: string, body: object, reload = true) {
    setBusy(id); setMessage('');
    const response = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    setMessage(response.ok ? 'Alteração salva com sucesso.' : result.error || 'Erro ao alterar usuário.');
    setBusy('');
    if (response.ok && reload) setTimeout(() => location.reload(), 450);
    return response.ok;
  }

  function openEdit(user: User) { setEditing(user); setDraft({ ...user }); setMessage(''); }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return;
    const payload = { name:draft.name,email:draft.email,role:draft.role,job_title:draft.job_title||null,phone:draft.phone||null,whatsapp:draft.whatsapp||null,region:draft.region||null,customer_id:draft.role==='cliente'?draft.customer_id||null:null,seller_id:draft.role==='cliente'?draft.seller_id||null:null,active:draft.active };
    const ok = await patch(draft.id, payload, false);
    if (ok) { setEditing(null); setDraft(null); setTimeout(() => location.reload(), 450); }
  }

  async function removeUser(user: User) {
    const confirmed = confirm(`Excluir definitivamente o usuário ${user.name}?\n\nO acesso será removido do Supabase Auth.`);
    if (!confirmed) return;
    setBusy(user.id);setMessage('');
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    const result = await response.json();
    setMessage(response.ok ? 'Usuário excluído com sucesso.' : result.error || 'Erro ao excluir usuário.');
    setBusy(''); if (response.ok) setTimeout(() => location.reload(), 450);
  }

  async function resetPassword(id: string, name: string) {
    const password = prompt(`Nova senha para ${name} (mínimo 6 caracteres):`); if (!password) return;
    setBusy(id);
    const response = await fetch(`/api/admin/users/${id}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    const result=await response.json();
    setMessage(response.ok?'Senha redefinida com sucesso.':result.error||'Erro ao redefinir senha.'); setBusy('');
  }

  return <>
    <div className="card admin-filter-card">
      <div className="admin-filter-grid">
        <label className="admin-filter-search">Buscar<input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, e-mail, empresa, região ou telefone"/></label>
        {!lockRoleFilter&&<label>Perfil<select className="input" value={roleFilter} onChange={e=>setRoleFilter(e.target.value as typeof roleFilter)}><option value="todos">Todos</option><option value="admin">Admin</option><option value="vendedor">Vendedor</option><option value="cliente">Cliente</option></select></label>}
        <label>Situação<select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}><option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
        <label>Ordenar<select className="input" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="nome">Nome</option><option value="email">E-mail</option><option value="regiao">Região</option></select></label>
        <div className="filter-result"><strong>{visibleUsers.length}</strong><span>registros exibidos</span></div>
      </div>
    </div>

    <div className="card table-wrap">
      {message&&<div className={message.includes('sucesso')?'success':'error'}>{message}</div>}
      {visibleUsers.length===0?<div className="empty">Nenhum usuário encontrado com os filtros atuais.</div>:<table className="table">
        <thead><tr><th>Usuário</th><th>Perfil</th><th>Vínculo</th><th>Contato</th><th>Região</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>{visibleUsers.map(user=><tr key={user.id}>
          <td><b>{user.name}</b><small>{user.email}{user.job_title?` • ${user.job_title}`:''}</small></td>
          <td><span className="role">{user.role}</span></td>
          <td>{user.role==='cliente'?user.customer_name||'Sem empresa':user.role==='vendedor'?'Carteira de clientes':'Acesso completo'}<small>{user.seller_name?`Vendedor: ${user.seller_name}`:''}</small></td>
          <td>{user.whatsapp||user.phone||'-'}<small>{user.whatsapp&&user.phone?`Tel.: ${user.phone}`:''}</small></td>
          <td>{user.region||'-'}</td>
          <td><span className={user.active?'badge':'badge warn'}>{user.active?'Ativo':'Inativo'}</span></td>
          <td><div className="row-actions">
            <button className="btn btn-light btn-sm" onClick={()=>openEdit(user)}>Editar</button>
            <button className="btn btn-light btn-sm" disabled={busy===user.id} onClick={()=>patch(user.id,{active:!user.active})}>{user.active?'Inativar':'Ativar'}</button>
            <button className="btn btn-light btn-sm" disabled={busy===user.id} onClick={()=>resetPassword(user.id,user.name)}>Redefinir senha</button>
            <button className="btn btn-danger btn-sm" disabled={busy===user.id||user.role==='admin'} onClick={()=>removeUser(user)}>Excluir</button>
          </div></td>
        </tr>)}</tbody>
      </table>}
    </div>

    {editing&&draft&&<div className="modal-overlay" onMouseDown={()=>setEditing(null)}>
      <form className="modal-card" onSubmit={saveEdit} onMouseDown={event=>event.stopPropagation()}>
        <div className="modal-head"><div><h2>Editar usuário</h2><p>Atualize dados, perfil e vínculos.</p></div><button type="button" className="modal-close" onClick={()=>setEditing(null)}>×</button></div>
        <div className="form-grid">
          <label>Nome<input className="input" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></label>
          <label>E-mail<input className="input" type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} required/></label>
          <label>Perfil<select className="input" value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value as User['role']})}><option value="admin">Admin</option><option value="vendedor">Vendedor</option><option value="cliente">Cliente</option></select></label>
          <label>Cargo<input className="input" value={draft.job_title||''} onChange={e=>setDraft({...draft,job_title:e.target.value})}/></label>
          <label>Região<input className="input" value={draft.region||''} onChange={e=>setDraft({...draft,region:e.target.value})}/></label>
          <label>Telefone<input className="input" value={draft.phone||''} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label>
          <label>WhatsApp<input className="input" value={draft.whatsapp||''} onChange={e=>setDraft({...draft,whatsapp:e.target.value})}/></label>
          {draft.role==='cliente'&&<label>Empresa vinculada<select className="input" value={draft.customer_id||''} onChange={e=>setDraft({...draft,customer_id:e.target.value||null})}><option value="">Sem empresa</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}{customer.active===false?' (inativo)':''}</option>)}</select></label>}
          {draft.role==='cliente'&&<label>Vendedor responsável<select className="input" value={draft.seller_id||''} onChange={e=>setDraft({...draft,seller_id:e.target.value||null})}><option value="">Sem vendedor</option>{sellers.map(seller=><option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>}
          <label className="check-edit"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Usuário ativo</label>
        </div>
        <div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>setEditing(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy===draft.id}>{busy===draft.id?'Salvando...':'Salvar alterações'}</button></div>
      </form>
    </div>}
  </>
}
