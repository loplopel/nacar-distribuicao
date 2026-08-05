import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-admin';
import { validateOrderPdfToken } from '@/lib/order-pdf-token';

export const dynamic = 'force-dynamic';

const money = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR');

function wrapText(text: string, maxChars: number) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function pdfEscape(value: string) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\xFF]/g, '?');
}

type PdfLine = { text: string; bold?: boolean; size?: number; gap?: number };

function createSimplePdf(pages: PdfLine[][]) {
  const objects: Buffer[] = [];
  const add = (content: string | Buffer) => {
    objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1'));
    return objects.length;
  };

  const catalogId = add('');
  const pagesId = add('');
  const regularFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const boldFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    let y = 800;
    const commands: string[] = [
      '0.96 0.34 0.12 rg 0 808 595 34 re f',
      '0.06 0.08 0.12 rg 0 0 595 808 re f',
      '1 1 1 rg BT /F2 18 Tf 42 820 Td (NACAR DISTRIBUICAO) Tj ET',
      '0.12 0.15 0.20 rg 0 0 595 808 re f',
    ];
    // White page below the header.
    commands.push('1 1 1 rg 0 0 595 808 re f');
    commands.push('0.96 0.34 0.12 rg 0 808 595 34 re f');
    commands.push('1 1 1 rg BT /F2 18 Tf 42 819 Td (NACAR DISTRIBUICAO) Tj ET');
    y = 782;
    for (const line of pageLines) {
      const size = line.size || 10;
      const font = line.bold ? 'F2' : 'F1';
      const text = pdfEscape(line.text);
      commands.push(`0.12 0.15 0.20 rg BT /${font} ${size} Tf 42 ${y} Td (${text}) Tj ET`);
      y -= line.gap || Math.max(14, size + 4);
    }
    commands.push('0.45 0.47 0.52 rg BT /F1 8 Tf 42 28 Td (Grupo Nacar - Distribuicao B2B) Tj ET');
    const stream = Buffer.from(commands.join('\n'), 'latin1');
    const contentId = add(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
      stream,
      Buffer.from('\nendstream', 'latin1'),
    ]));
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, 'latin1');
  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'latin1');

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = [0];
  let length = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, 'latin1');
    const suffix = Buffer.from('\nendobj\n', 'latin1');
    parts.push(prefix, object, suffix);
    length += prefix.length + object.length + suffix.length;
  });
  const xref = length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  table += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  parts.push(Buffer.from(table, 'latin1'));
  return Buffer.concat(parts);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token');
  if (!validateOrderPdfToken(id, token)) return NextResponse.json({ error: 'Link inválido ou não autorizado.' }, { status: 403 });

  const db = adminClient();
  const { data: order, error } = await db
    .from('orders')
    .select('id,number,status,total,notes,created_at,customer_name,customer_cnpj,customer_city,customer_state,payment_terms,customers(name,trade_name,cnpj,city,state),profiles!orders_seller_id_fkey(name,email,phone,whatsapp),order_items(quantity,unit_price,notes,products(name,ean,size))')
    .eq('id', id)
    .single();
  if (error || !order) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });

  const customer: any = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const seller: any = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const customerName = customer?.trade_name || customer?.name || order.customer_name || '-';
  const cnpj = order.customer_cnpj || customer?.cnpj || '-';
  const cityState = [order.customer_city || customer?.city, order.customer_state || customer?.state].filter(Boolean).join('/') || '-';

  const allLines: PdfLine[] = [
    { text: 'SOLICITACAO DE ORCAMENTO', bold: true, size: 14, gap: 22 },
    { text: `Orcamento No ${String(order.number).padStart(6, '0')}`, bold: true, size: 12 },
    { text: `Solicitado em: ${dateTime(order.created_at)}`, size: 9, gap: 22 },
    { text: 'CLIENTE', bold: true, size: 9 },
    { text: customerName, bold: true, size: 12 },
    { text: `CNPJ: ${cnpj}`, size: 9 },
    { text: `Local: ${cityState}`, size: 9 },
    { text: `Vendedor: ${seller?.name || '-'}`, size: 9, gap: 24 },
    { text: 'ITENS DO ORCAMENTO', bold: true, size: 10, gap: 20 },
  ];

  const items: any[] = order.order_items || [];
  items.forEach((item, index) => {
    const product: any = Array.isArray(item.products) ? item.products[0] : item.products;
    const productName = product?.name || 'Produto';
    const details = [product?.ean ? `EAN ${product.ean}` : '', product?.size ? `Tam. ${product.size}` : ''].filter(Boolean).join(' | ');
    allLines.push({ text: `${index + 1}. ${productName}`, bold: true, size: 9 });
    if (details) allLines.push({ text: details, size: 8 });
    allLines.push({ text: `Quantidade: ${item.quantity} | Unitario: ${money(Number(item.unit_price))} | Total: ${money(Number(item.unit_price) * Number(item.quantity))}`, size: 8 });
    if (item.notes) allLines.push({ text: `Obs.: ${item.notes}`, size: 8 });
    allLines.push({ text: '--------------------------------------------------------------------------', size: 7, gap: 14 });
  });
  allLines.push({ text: `TOTAL ESTIMADO: ${money(Number(order.total))}`, bold: true, size: 15, gap: 24 });
  allLines.push({ text: `Condicao de pagamento: ${order.payment_terms || 'A combinar'}`, bold: true, size: 9, gap: 18 });
  if (order.notes) {
    allLines.push({ text: 'OBSERVACOES', bold: true, size: 9 });
    wrapText(order.notes, 88).forEach((line) => allLines.push({ text: line, size: 9 }));
  }

  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [];
  let estimated = 0;
  for (const line of allLines) {
    const height = line.gap || Math.max(14, (line.size || 10) + 4);
    if (estimated + height > 700 && current.length) {
      pages.push(current);
      current = [{ text: `Orcamento No ${String(order.number).padStart(6, '0')} - continuacao`, bold: true, size: 10, gap: 22 }];
      estimated = 22;
    }
    current.push(line);
    estimated += height;
  }
  if (current.length) pages.push(current);

  const pdf = createSimplePdf(pages);
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orcamento-nacar-${String(order.number).padStart(6, '0')}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
