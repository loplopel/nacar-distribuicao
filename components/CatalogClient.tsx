'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CartItem, Product } from '@/lib/types';
import { ChevronDown, Search, ShoppingCart, SlidersHorizontal, Trash2, X } from 'lucide-react';

const currency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');

type CustomerOption = { id: string; name: string };
type SaveAction = 'draft' | 'submit' | 'quote';
type DraftPayload = { orderId: string; customerId: string; notes: string; items: CartItem[] };

export default function CatalogClient({ products, customers = [] }: { products: Product[]; customers?: CustomerOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [status, setStatus] = useState('');
  const [stockOnly, setStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customer, setCustomer] = useState('');
  const [notes, setNotes] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState<SaveAction | null>(null);
  const [productQty, setProductQty] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const resumeRaw = localStorage.getItem('nacar-resume-draft');
      if (resumeRaw) {
        const resume = JSON.parse(resumeRaw) as DraftPayload;
        setCart(resume.items || []);
        setCustomer(resume.customerId || '');
        setNotes(resume.notes || '');
        setDraftId(resume.orderId);
        setOpen(true);
        localStorage.removeItem('nacar-resume-draft');
        return;
      }
      const saved = localStorage.getItem('nacar-cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => { localStorage.setItem('nacar-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => setPage(1), [q, brand, category, size, status, stockOnly]);

  const unique = (key: 'brand' | 'category' | 'size' | 'status') => [...new Set(products.map((p) => p[key]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const shown = useMemo(() => {
    const terms = norm(q).split(' ').filter(Boolean);
    return products.filter((p) => {
      const hay = norm(`${p.name} ${p.ean || ''} ${p.brand || ''} ${p.category || ''} ${p.size || ''}`);
      return (!terms.length || terms.every((term) => hay.includes(term))) && (!brand || p.brand === brand) && (!category || p.category === category) && (!size || p.size === size) && (!status || p.status === status) && (!stockOnly || p.stock > 0);
    });
  }, [products, q, brand, category, size, status, stockOnly]);

  const perPage = 48;
  const totalPages = Math.max(1, Math.ceil(shown.length / perPage));
  const visible = shown.slice((page - 1) * perPage, page * perPage);

  function add(product: Product, requested?: number) {
    const amount = Math.min(Math.max(1, Math.trunc(requested ?? productQty[product.id] ?? 1)), Math.max(1, product.stock));
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + amount, Math.max(1, product.stock)) } : item)
        : [...current, { ...product, quantity: amount, notes: '' }];
    });
    setProductQty((current) => ({ ...current, [product.id]: 1 }));
    setOpen(true);
  }

  function updateItem(id: string, patch: Partial<CartItem>) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function save(action: SaveAction) {
    if (customers.length && !customer) { alert('Selecione o cliente.'); return; }
    setLoading(action);
    const response = await fetch('/api/orders', {
      method: draftId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: draftId,
        customer_id: customer || null,
        notes,
        action,
        items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity, notes: item.notes || null })),
      }),
    });
    const result = await response.json();
    setLoading(null);
    if (!response.ok) { alert(result.error || 'Não foi possível salvar o pedido.'); return; }

    const labels: Record<SaveAction, string> = { draft: 'Rascunho salvo', submit: 'Pedido enviado', quote: 'Orçamento solicitado' };
    alert(`${labels[action]} com sucesso. Nº ${String(result.number).padStart(6, '0')}.`);
    setCart([]);
    setNotes('');
    setCustomer('');
    setDraftId(null);
    setOpen(false);
    localStorage.removeItem('nacar-cart');
    router.refresh();
  }

  const total = cart.reduce((sum, item) => sum + Number(item.cost_price) * item.quantity, 0);
  const clear = () => { setBrand(''); setCategory(''); setSize(''); setStatus(''); setStockOnly(false); };

  return <>
    <div className="catalog-toolbar">
      <label className="search"><Search size={19}/><input placeholder="Buscar por produto, EAN, marca ou categoria" value={q} onChange={(e) => setQ(e.target.value)}/></label>
      <button className="btn btn-outline filter-toggle" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={17}/> Filtros <ChevronDown size={16}/></button>
    </div>

    <div className={`catalog-layout ${filtersOpen ? 'filters-open' : ''}`}>
      <aside className="catalog-filters card">
        <div className="filter-head"><b>Filtros</b><button onClick={clear}>Limpar</button></div>
        <label>Marca<select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">Todas</option>{unique('brand').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Categoria<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{unique('category').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Tamanho<select className="input" value={size} onChange={(e) => setSize(e.target.value)}><option value="">Todos</option>{unique('size').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Status<select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{unique('status').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)}/> Somente com estoque</label>
      </aside>

      <section className="catalog-content">
        <div className="catalog-meta"><span><b>{shown.length}</b> itens encontrados</span><span>Página {page} de {totalPages}</span></div>
        <div className="grid grid-products">
          {visible.map((product) => {
            const available = product.stock > 0 && norm(product.status) !== 'indisponivel';
            const badgeClass = available ? 'available' : norm(product.status).includes('consultar') ? 'consult' : 'unavailable';
            return <article className="card product" key={product.id}>
              <div className="image-wrap">
                <img src={product.image_url || '/produto-sem-imagem.svg'} alt={product.name}/>
                <span className={`stock-badge ${badgeClass}`}>{available ? `${product.stock} em estoque` : product.status || 'Indisponível'}</span>
                {product.size && <span className="size-badge">Tam. {product.size}</span>}
              </div>
              <div className="product-body">
                <div className="product-brand">{product.brand || 'NACAR'}</div>
                <h3>{product.name}</h3>
                {product.ean && <p className="product-codes">EAN {product.ean}</p>}
                <div className="price-lines price-lines-three">
                  <div className="price-main"><small>Preço distribuidor</small><b>{currency(product.cost_price)}</b></div>
                  <div><small>Preço sugerido</small><span>{currency(product.suggested_price)}</span></div>
                  <div><small>Preço mínimo</small><span>{currency(product.minimum_price)}</span></div>
                </div>
                <div className="quick-add">
                  <label className="product-quantity"><span>Quantidade</span><input type="number" min="1" max={Math.max(1, product.stock)} value={productQty[product.id] ?? 1} disabled={!available} onChange={(e) => setProductQty((current) => ({ ...current, [product.id]: Math.max(1, Math.trunc(Number(e.target.value) || 1)) }))}/></label>
                  <button className="btn btn-primary" disabled={!available} onClick={() => add(product)}>Adicionar</button>
                </div>
              </div>
            </article>;
          })}
        </div>
        {totalPages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Próxima</button></div>}
      </section>
    </div>

    <button className="btn btn-dark cart" onClick={() => setOpen(true)}><ShoppingCart size={20}/> Carrinho <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></button>

    {open && <>
      <div className="drawer-overlay" onClick={() => setOpen(false)}/>
      <aside className="cart-panel cart-panel-wide">
        <div className="drawer-head"><div><h2>{draftId ? 'Continuar rascunho' : 'Montar pedido'}</h2><p>{cart.length} produto(s) selecionado(s)</p></div><button onClick={() => setOpen(false)}><X/></button></div>
        <div className="drawer-body">
          {customers.length > 0 && <label>Cliente<select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}><option value="">Selecione o cliente</option>{customers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
          {cart.length === 0 ? <div className="empty">Seu carrinho está vazio.</div> : cart.map((item) => <div className="cart-item cart-item-complete" key={item.id}>
            <img src={item.image_url || '/produto-sem-imagem.svg'} alt=""/>
            <div className="cart-item-main">
              <b>{item.name}</b><span>EAN {item.ean || '-'} {item.size ? `• Tam. ${item.size}` : ''}</span>
              <div className="cart-edit-row">
                <label>Quantidade<div className="quantity-box"><span>[</span><input type="number" min="1" max={Math.max(1, item.stock)} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.min(Math.max(1, Number(e.target.value) || 1), Math.max(1, item.stock)) })}/><span>]</span></div></label>
                <label className="cart-note">Observação do item<input className="input" value={item.notes || ''} maxLength={500} onChange={(e) => updateItem(item.id, { notes: e.target.value })} placeholder="Ex.: separar na cor azul"/></label>
              </div>
            </div>
            <div className="cart-item-total"><span>{currency(item.cost_price)} cada</span><b>{currency(Number(item.cost_price) * item.quantity)}</b><button className="trash" onClick={() => setCart((current) => current.filter((product) => product.id !== item.id))}><Trash2 size={18}/></button></div>
          </div>)}
          {cart.length > 0 && <label>Observações gerais<textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condição especial, instruções de entrega ou informações adicionais"/></label>}
        </div>
        <div className="drawer-footer drawer-footer-actions">
          <div><span>Total do pedido</span><b>{currency(total)}</b></div>
          <div className="order-actions three-actions">
            <button className="btn btn-outline" disabled={!cart.length || !!loading} onClick={() => save('draft')}>{loading === 'draft' ? 'Salvando...' : 'Salvar rascunho'}</button>
            <button className="btn btn-light" disabled={!cart.length || !!loading} onClick={() => save('quote')}>{loading === 'quote' ? 'Solicitando...' : 'Solicitar orçamento'}</button>
            <button className="btn btn-primary" disabled={!cart.length || !!loading} onClick={() => save('submit')}>{loading === 'submit' ? 'Enviando...' : 'Enviar pedido'}</button>
          </div>
        </div>
      </aside>
    </>}
  </>;
}
