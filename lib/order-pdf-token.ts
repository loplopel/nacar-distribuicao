import { createHmac, timingSafeEqual } from 'node:crypto';

function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  return value;
}

export function createOrderPdfToken(orderId: string) {
  return createHmac('sha256', secret()).update(`order-pdf:${orderId}`).digest('hex');
}

export function validateOrderPdfToken(orderId: string, token: string | null) {
  if (!token) return false;
  const expected = createOrderPdfToken(orderId);
  const received = Buffer.from(token);
  const valid = Buffer.from(expected);
  return received.length === valid.length && timingSafeEqual(received, valid);
}
