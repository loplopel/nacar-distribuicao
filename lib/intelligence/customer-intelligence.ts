export type PurchaseLine = {
  orderId: string;
  orderedAt: string;
  total: number;
  quantity: number;
  productId: string;
  productName: string;
  brand: string;
  category: string;
};

export type ProductRecommendation = {
  productId: string;
  productName: string;
  brand: string;
  suggestedQuantity: number;
  confidence: number;
  reason: string;
};

export type CustomerIntelligence = {
  score: number;
  potential: number;
  health: 'crescendo' | 'estavel' | 'em_risco' | 'novo';
  averageIntervalDays: number | null;
  daysSinceLastOrder: number | null;
  nextPurchaseInDays: number | null;
  closingProbability: number;
  trendPercent: number;
  averageOrderValue: number;
  favoriteBrands: Array<{ name: string; quantity: number }>;
  forgottenBrands: Array<{ name: string; days: number }>;
  recommendations: ProductRecommendation[];
  alerts: string[];
  opportunities: string[];
  summary: string;
};

const DAY = 86_400_000;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const daysBetween = (a: string | Date, b: string | Date) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY));

export function buildCustomerIntelligence(lines: PurchaseLine[], now = new Date()): CustomerIntelligence {
  if (!lines.length) {
    return {
      score: 20,
      potential: 45,
      health: 'novo',
      averageIntervalDays: null,
      daysSinceLastOrder: null,
      nextPurchaseInDays: null,
      closingProbability: 35,
      trendPercent: 0,
      averageOrderValue: 0,
      favoriteBrands: [],
      forgottenBrands: [],
      recommendations: [],
      alerts: ['Cliente ainda não possui compras válidas no sistema.'],
      opportunities: ['Realizar diagnóstico comercial e montar o primeiro pedido sugerido.'],
      summary: 'Conta nova ou sem histórico suficiente. Priorize o primeiro contato e identifique as marcas de interesse.',
    };
  }

  const uniqueOrders = new Map<string, { at: string; total: number }>();
  const brandQty = new Map<string, number>();
  const brandLastDate = new Map<string, string>();
  const productStats = new Map<string, { productId: string; productName: string; brand: string; quantity: number; dates: string[] }>();

  for (const line of lines) {
    if (!uniqueOrders.has(line.orderId)) uniqueOrders.set(line.orderId, { at: line.orderedAt, total: line.total });
    const brand = (line.brand || 'Sem marca').trim().toUpperCase();
    brandQty.set(brand, (brandQty.get(brand) || 0) + Number(line.quantity || 0));
    if (!brandLastDate.has(brand) || new Date(line.orderedAt) > new Date(brandLastDate.get(brand)!)) brandLastDate.set(brand, line.orderedAt);
    const key = line.productId || line.productName;
    const current = productStats.get(key) || { productId: line.productId, productName: line.productName, brand, quantity: 0, dates: [] };
    current.quantity += Number(line.quantity || 0);
    current.dates.push(line.orderedAt);
    productStats.set(key, current);
  }

  const orders = [...uniqueOrders.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const intervals = orders.slice(1).map((order, index) => daysBetween(orders[index].at, order.at));
  const averageIntervalDays = intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : null;
  const lastOrder = orders[orders.length - 1];
  const daysSinceLastOrder = daysBetween(lastOrder.at, now);
  const nextPurchaseInDays = averageIntervalDays === null ? null : Math.max(0, averageIntervalDays - daysSinceLastOrder);
  const averageOrderValue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0) / Math.max(1, orders.length);

  const recentStart = new Date(now.getTime() - 90 * DAY);
  const previousStart = new Date(now.getTime() - 180 * DAY);
  const recentTotal = orders.filter((order) => new Date(order.at) >= recentStart).reduce((sum, order) => sum + order.total, 0);
  const previousTotal = orders.filter((order) => new Date(order.at) >= previousStart && new Date(order.at) < recentStart).reduce((sum, order) => sum + order.total, 0);
  const trendPercent = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : recentTotal > 0 ? 100 : 0;

  let health: CustomerIntelligence['health'] = 'estavel';
  if (trendPercent >= 20) health = 'crescendo';
  if ((averageIntervalDays !== null && daysSinceLastOrder > averageIntervalDays * 1.6) || daysSinceLastOrder > 75 || trendPercent <= -30) health = 'em_risco';

  const favoriteBrands = [...brandQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity }));
  const forgottenBrands = [...brandLastDate.entries()].map(([name, date]) => ({ name, days: daysBetween(date, now) })).filter((item) => item.days > Math.max(60, (averageIntervalDays || 30) * 1.7)).sort((a, b) => b.days - a.days).slice(0, 4);

  const recommendations = [...productStats.values()].map((product) => {
    const dates = product.dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const productIntervals = dates.slice(1).map((date, index) => daysBetween(dates[index], date));
    const productInterval = productIntervals.length ? productIntervals.reduce((sum, value) => sum + value, 0) / productIntervals.length : averageIntervalDays || 45;
    const productDays = daysBetween(dates[dates.length - 1], now);
    const averageQty = Math.max(1, Math.round(product.quantity / Math.max(1, new Set(dates.map((date) => date.slice(0, 10))).size)));
    const dueRatio = productDays / Math.max(1, productInterval);
    const confidence = clamp(Math.round(45 + dueRatio * 35 + Math.min(15, product.quantity)));
    return {
      productId: product.productId,
      productName: product.productName,
      brand: product.brand,
      suggestedQuantity: averageQty,
      confidence,
      reason: productDays >= productInterval ? `Reposição provável: última compra há ${productDays} dias.` : `Item recorrente da marca ${product.brand}.`,
    };
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 6);

  let score = 45;
  score += orders.length >= 5 ? 12 : orders.length * 2;
  score += averageOrderValue >= 10_000 ? 10 : averageOrderValue >= 3_000 ? 5 : 0;
  score += trendPercent >= 20 ? 12 : trendPercent < -30 ? -15 : 0;
  score += averageIntervalDays !== null && daysSinceLastOrder <= averageIntervalDays * 1.15 ? 12 : daysSinceLastOrder > 90 ? -25 : 0;
  score = clamp(Math.round(score));

  let potential = 40;
  potential += Math.min(20, favoriteBrands.length * 4);
  potential += Math.min(20, orders.length * 2);
  potential += averageOrderValue >= 10_000 ? 15 : averageOrderValue >= 5_000 ? 8 : 0;
  potential += trendPercent > 0 ? 10 : 0;
  potential = clamp(Math.round(potential));

  let closingProbability = 45;
  if (averageIntervalDays !== null) closingProbability += clamp(Math.round((daysSinceLastOrder / Math.max(1, averageIntervalDays)) * 30), 0, 35);
  closingProbability += recommendations.length ? 10 : 0;
  closingProbability += health === 'crescendo' ? 8 : health === 'em_risco' ? -5 : 0;
  closingProbability = clamp(Math.round(closingProbability), 10, 96);

  const alerts: string[] = [];
  if (trendPercent <= -20) alerts.push(`Compras caíram ${Math.abs(trendPercent).toFixed(0)}% nos últimos 90 dias.`);
  if (daysSinceLastOrder > 60) alerts.push(`Cliente está há ${daysSinceLastOrder} dias sem comprar.`);
  if (forgottenBrands[0]) alerts.push(`Marca ${forgottenBrands[0].name} não é comprada há ${forgottenBrands[0].days} dias.`);
  if (!alerts.length) alerts.push('Nenhum alerta crítico identificado no momento.');

  const opportunities: string[] = [];
  if (recommendations[0]) opportunities.push(`Oferecer reposição de ${recommendations[0].productName} (${recommendations[0].suggestedQuantity} un.).`);
  if (favoriteBrands[0]) opportunities.push(`Priorizar lançamentos e campanhas da marca ${favoriteBrands[0].name}.`);
  if (health === 'em_risco') opportunities.push('Agendar contato de reativação comercial ainda nesta semana.');
  if (health === 'crescendo') opportunities.push('Aumentar mix e ticket com produtos complementares.');

  const summary = health === 'crescendo'
    ? `Cliente em crescimento, com tendência positiva de ${trendPercent.toFixed(0)}% e boa oportunidade de ampliar o mix.`
    : health === 'em_risco'
      ? `Cliente em risco comercial. Está há ${daysSinceLastOrder} dias sem comprar e exige ação de reativação.`
      : `Cliente estável. A próxima compra é estimada ${nextPurchaseInDays === null ? 'quando houver novo contato' : nextPurchaseInDays === 0 ? 'para agora' : `em aproximadamente ${nextPurchaseInDays} dias`}.`;

  return { score, potential, health, averageIntervalDays, daysSinceLastOrder, nextPurchaseInDays, closingProbability, trendPercent, averageOrderValue, favoriteBrands, forgottenBrands, recommendations, alerts, opportunities, summary };
}
