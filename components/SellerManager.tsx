'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Seller = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  job_title?: string | null;
  region?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  customers_count: number;
  active_customers_count: number;
  orders_month: number;
  revenue_month: number;
  pending_followups: number;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SellerManager({ sellers }: { sellers: Seller[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');
  const [region, setRegion] = useState('todas');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState<Seller | null>(null);

  const regions = useMemo(() => Array.from(new Set(sellers.map((seller) => seller.region).filter(Boolean) as string[])).sort(), [sellers]);
  const filtered = useMemo(() => sellers.filter((seller) => {
    const text = `${seller.name} ${seller.email} ${seller.job_title || ''} ${seller.region || ''}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (status === 'ativos' && !seller.active) return false;
    if (status === 'inativos' && seller.active) return false;
    if (region !== 'todas' && seller.region !== region) return false;
    return true;
  }), [sellers, query, status, region]);

  async function patch(id: string, body: object, reload = true) {
    setBusy(id); setMessage('');
    const response = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    setMessage(response.ok ? 'Vendedor atualizado com sucesso.' : result.error || 'Erro ao atualizar vendedor.');
    setBusy('');
    if (response.ok && reload) setTimeout(() => location.reload(), 450);
    return response.ok;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const ok = await patch(draft.id, {
      name: draft.name,
      email: draft.email,
      job_title: draft.job_title || null,
      region: draft.region || null,
      phone: draft.phone || null,
      whatsapp: draft.whatsapp || null,
      active: draft.active,
    }, false);
    if (ok) { setDraft(null); setTimeout(() => location.reload(), 450); }
  }

  async function resetPassword(seller: Seller) {
    const password = prompt(`Nova senha para ${seller.name} (mínimo 6 caracteres):`);
    if (!password) return;
    setBusy(seller.id);
    const response = await fetch(`/api/admin/users/${seller.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const result = await response.json();
    setMessage(response.ok ? 'Senha redefinida com sucesso.' : result.error || 'Erro ao redefinir senha.');
    setBusy('');
  }

  return <>
    <div className="card admin-filter-bar">
      <label className="admin-search">Buscar<input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, e-mail, cargo ou região" /></label>
      <label>Situação<select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
      <label>Região<select className="input" value={region} onChange={(event) => setRegion(event.target.value)}><option value="todas">Todas</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="filter-result"><b>{filtered.length}</b><span>resultados</span></div>
    </div>

    <div className="admin-summary-grid">
      <div className="mini-stat"><span>Vendedores ativos</span><b>{sellers.filter((seller) => seller.active).length}</b></div>
      <div className="mini-stat"><span>Clientes vinculados</span><b>{sellers.reduce((sum, seller) => sum + seller.customers_count, 0)}</b></div>
      <div className="mini-stat"><span>Pedidos no mês</span><b>{sellers.reduce((sum, seller) => sum + seller.orders_month, 0)}</b></div>
      <div className="mini-stat"><span>Faturamento no mês</span><b>{money.format(sellers.reduce((sum, seller) => sum + seller.revenue_month, 0))}</b></div>
    </div>

    <div className="card table-wrap">
      {message && <div className={message.includes('sucesso') ? 'success' : 'error'}>{message}</div>}
      {filtered.length === 0 ? <div className="empty">Nenhum vendedor encontrado.</div> : <table className="table seller-table">
        <thead><tr><th>Vendedor</th><th>Carteira</th><th>Mês atual</th><th>Follow-ups</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>{filtered.map((seller) => <tr key={seller.id}>
          <td><b>{seller.name}</b><small>{seller.email}{seller.job_title ? ` • ${seller.job_title}` : ''}</small><small>{seller.region || 'Região não informada'}</small></td>
          <td><b>{seller.active_customers_count}</b><small>{seller.customers_count} clientes no total</small></td>
          <td><b>{money.format(seller.revenue_month)}</b><small>{seller.orders_month} pedidos válidos</small></td>
          <td><b>{seller.pending_followups}</b><small>pendentes</small></td>
          <td><span className={seller.active ? 'badge' : 'badge warn'}>{seller.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><div className="row-actions">
            <Link className="btn btn-light btn-sm" href={`/crm?seller=${seller.id}`}>Abrir carteira</Link>
            <button className="btn btn-light btn-sm" onClick={() => setDraft({ ...seller })}>Editar</button>
            <button className="btn btn-light btn-sm" disabled={busy === seller.id} onClick={() => patch(seller.id, { active: !seller.active })}>{seller.active ? 'Inativar' : 'Ativar'}</button>
            <button className="btn btn-light btn-sm" disabled={busy === seller.id} onClick={() => resetPassword(seller)}>Redefinir senha</button>
          </div></td>
        </tr>)}</tbody>
      </table>}
    </div>

    {draft && <div className="modal-overlay" onMouseDown={() => setDraft(null)}><form className="modal-card" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><h2>Editar vendedor</h2><p>Atualize os dados da equipe comercial.</p></div><button type="button" className="modal-close" onClick={() => setDraft(null)}>×</button></div>
      <div className="form-grid">
        <label>Nome<input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
        <label>E-mail<input className="input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required /></label>
        <label>Cargo<input className="input" value={draft.job_title || ''} onChange={(event) => setDraft({ ...draft, job_title: event.target.value })} /></label>
        <label>Região<input className="input" value={draft.region || ''} onChange={(event) => setDraft({ ...draft, region: event.target.value })} /></label>
        <label>Telefone<input className="input" value={draft.phone || ''} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
        <label>WhatsApp<input className="input" value={draft.whatsapp || ''} onChange={(event) => setDraft({ ...draft, whatsapp: event.target.value })} /></label>
        <label className="check-edit"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Vendedor ativo</label>
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setDraft(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy === draft.id}>{busy === draft.id ? 'Salvando...' : 'Salvar alterações'}</button></div>
    </form></div>}
  </>;
}
