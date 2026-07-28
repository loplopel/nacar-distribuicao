'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit, CheckCircle2, ShoppingCart, Sparkles } from 'lucide-react';
import type { Product } from '@/lib/types';

type SuggestedProduct = Product & {
  suggestedQuantity: number;
  confidence: number;
  reason: string;
};

type SelectedState = Record<string, { selected: boolean; quantity: number }>;

const currency = (value: number) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function SmartOrderBuilder({
  customerId,
  customerName,
  products,
  closingProbability,
  summary,
}: {
  customerId: string;
  customerName: string;
  products: SuggestedProduct[];
  closingProbability: number;
  summary: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedState>(() => Object.fromEntries(
    products.map((product) => [product.id, {
      selected: product.stock > 0,
      quantity: Math.min(Math.max(1, product.suggestedQuantity), Math.max(1, product.stock)),
    }]),
  ));

  const selectedProducts = useMemo(() => products.filter((product) => selected[product.id]?.selected), [products, selected]);
  const totalUnits = selectedProducts.reduce((sum, product) => sum + Number(selected[product.id]?.quantity || 0), 0);
  const estimatedTotal = selectedProducts.reduce((sum, product) => sum + Number(product.cost_price || 0) * Number(selected[product.id]?.quantity || 0), 0);

  function updateQuantity(product: SuggestedProduct, value: number) {
    const quantity = Math.min(Math.max(1, Math.trunc(value || 1)), Math.max(1, product.stock));
    setSelected((current) => ({ ...current, [product.id]: { ...(current[product.id] || { selected: true }), quantity } }));
  }

  function toggle(product: SuggestedProduct) {
    setSelected((current) => ({
      ...current,
      [product.id]: {
        selected: !current[product.id]?.selected,
        quantity: current[product.id]?.quantity || Math.min(Math.max(1, product.suggestedQuantity), Math.max(1, product.stock)),
      },
    }));
  }

  function generateOrder() {
    const items = selectedProducts.map((product) => ({
      ...product,
      quantity: selected[product.id].quantity,
      notes: `Sugestão NACS Intelligence · confiança ${product.confidence}%`,
    }));

    if (!items.length) {
      alert('Selecione ao menos um produto para montar o pedido.');
      return;
    }

    localStorage.setItem('nacar-resume-draft', JSON.stringify({
      orderId: '',
      customerId,
      notes: `Pedido sugerido pelo NACS Intelligence para ${customerName}. Revise quantidades, disponibilidade e condições antes de enviar.`,
      items,
    }));
    router.push('/catalogo');
  }

  return <>
    <section className="smart-order-summary card">
      <div className="smart-order-summary-icon"><BrainCircuit size={34}/></div>
      <div><span className="eyebrow">NACS INTELLIGENCE</span><h2>Pedido recomendado para {customerName}</h2><p>{summary}</p></div>
      <div className="smart-order-probability"><span>Probabilidade de fechamento</span><b>{closingProbability}%</b></div>
    </section>

    <section className="smart-order-layout">
      <div className="smart-order-products">
        {products.map((product) => {
          const state = selected[product.id] || { selected: false, quantity: 1 };
          const unavailable = product.stock <= 0;
          return <article className={`card smart-order-item ${state.selected ? 'selected' : ''}`} key={product.id}>
            <button className="smart-order-check" onClick={() => !unavailable && toggle(product)} disabled={unavailable} aria-label="Selecionar produto">
              <CheckCircle2 size={22}/>
            </button>
            <img src={product.image_url || '/produto-sem-imagem.svg'} alt={product.name}/>
            <div className="smart-order-copy">
              <span>{product.brand || 'NACAR'}</span>
              <h3>{product.name}</h3>
              <p>{product.reason}</p>
              <div className="smart-order-meta"><span>Confiança <b>{product.confidence}%</b></span><span>Estoque <b>{product.stock}</b></span>{product.size && <span>Tam. <b>{product.size}</b></span>}</div>
            </div>
            <div className="smart-order-pricing">
              <small>Preço distribuidor</small>
              <b>{currency(product.cost_price)}</b>
              <label>Quantidade<input type="number" min="1" max={Math.max(1, product.stock)} value={state.quantity} disabled={unavailable || !state.selected} onChange={(event) => updateQuantity(product, Number(event.target.value))}/></label>
              {unavailable && <span className="badge warn">Sem estoque</span>}
            </div>
          </article>;
        })}
        {!products.length && <div className="card empty">Ainda não há histórico suficiente para montar um pedido automático.</div>}
      </div>

      <aside className="card smart-order-total">
        <Sparkles size={26}/><h2>Resumo sugerido</h2>
        <dl><div><dt>Produtos</dt><dd>{selectedProducts.length}</dd></div><div><dt>Unidades</dt><dd>{totalUnits}</dd></div><div><dt>Valor estimado</dt><dd>{currency(estimatedTotal)}</dd></div></dl>
        <p>As quantidades são calculadas pelo histórico de recompra. Revise estoque, condições e mix antes do envio.</p>
        <button className="btn btn-primary smart-order-generate" onClick={generateOrder} disabled={!selectedProducts.length}><ShoppingCart size={18}/>Gerar pedido no carrinho</button>
      </aside>
    </section>
  </>;
}
