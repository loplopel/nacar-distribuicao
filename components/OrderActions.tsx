'use client';

import { useRouter } from 'next/navigation';
import { Copy, FileText, PencilLine } from 'lucide-react';
import { useState } from 'react';

export default function OrderActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'duplicate' | 'resume' | null>(null);

  async function duplicate() {
    setLoading('duplicate');
    const response = await fetch(`/api/orders/${id}/duplicate`, { method: 'POST' });
    const result = await response.json();
    setLoading(null);
    if (!response.ok) return alert(result.error || 'Não foi possível duplicar o pedido.');
    router.push(`/pedidos/${result.id}`);
    router.refresh();
  }

  async function resume() {
    setLoading('resume');
    const response = await fetch(`/api/orders/${id}/resume`);
    const result = await response.json();
    setLoading(null);
    if (!response.ok) return alert(result.error || 'Não foi possível continuar o rascunho.');
    localStorage.setItem('nacar-resume-draft', JSON.stringify(result));
    router.push('/catalogo');
  }

  return <div className="order-detail-actions no-print">
    {status === 'rascunho' && <button className="btn btn-primary" onClick={resume} disabled={!!loading}><PencilLine size={17}/>{loading === 'resume' ? 'Abrindo...' : 'Continuar pedido'}</button>}
    <button className="btn btn-outline" onClick={duplicate} disabled={!!loading}><Copy size={17}/>{loading === 'duplicate' ? 'Duplicando...' : 'Duplicar pedido'}</button>
    <button className="btn btn-light" onClick={() => window.print()}><FileText size={17}/> Imprimir / PDF</button>
  </div>;
}
