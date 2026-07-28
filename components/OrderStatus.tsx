'use client';
import { useState } from 'react';

export default function OrderStatus({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);
  async function change(next: string) {
    setLoading(true);
    const response = await fetch(`/api/admin/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    if (response.ok) setValue(next);
    else alert((await response.json()).error || 'Não foi possível alterar o status.');
    setLoading(false);
  }
  return <select className="input status-select" value={value} disabled={loading} onChange={(e) => change(e.target.value)}>
    <option value="rascunho">Rascunho</option>
    <option value="orcamento">Orçamento</option>
    <option value="novo">Novo</option>
    <option value="em_analise">Em análise</option>
    <option value="aprovado">Aprovado</option>
    <option value="separacao">Separação</option>
    <option value="faturado">Faturado</option>
    <option value="enviado">Enviado</option>
    <option value="finalizado">Finalizado</option>
    <option value="cancelado">Cancelado</option>
  </select>;
}
