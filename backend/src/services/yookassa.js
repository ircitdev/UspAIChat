import { v4 as uuid } from 'uuid';

const API_BASE = 'https://api.yookassa.ru/v3';

function getAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error('YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY required');
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

async function apiRequest(method, path, body = null) {
  const headers = {
    'Authorization': getAuth(),
    'Content-Type': 'application/json',
  };
  if (method === 'POST') {
    headers['Idempotence-Key'] = uuid();
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.description || data?.message || JSON.stringify(data);
    throw new Error(`YooKassa ${res.status}: ${errMsg}`);
  }
  return data;
}

/**
 * Create a payment
 * @returns {{ id, status, confirmation: { confirmation_url } }}
 */
export async function createPayment({ amount, description, returnUrl, metadata = {} }) {
  return apiRequest('POST', '/payments', {
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    confirmation: {
      type: 'redirect',
      return_url: returnUrl || process.env.YOOKASSA_RETURN_URL || 'https://app.aifuturenow.ru/payment-success',
    },
    capture: true,
    description,
    metadata,
  });
}

/**
 * Get payment status
 */
export async function getPayment(paymentId) {
  return apiRequest('GET', `/payments/${paymentId}`);
}

/**
 * Create a refund
 */
export async function createRefund({ paymentId, amount, description }) {
  return apiRequest('POST', '/refunds', {
    payment_id: paymentId,
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    description,
  });
}

// Allowed YooKassa webhook IPs
const YOOKASSA_IPS = [
  '185.71.76.', '185.71.77.', // 185.71.76.0/27, 185.71.77.0/27
  '77.75.153.', '77.75.154.', // additional ranges
  '2a02:5180:',               // IPv6
  '127.0.0.1', '::1',        // localhost for testing
];

export function isYookassaIP(ip) {
  if (!ip) return false;
  const cleanIp = ip.replace('::ffff:', '');
  return YOOKASSA_IPS.some(prefix => cleanIp.startsWith(prefix));
}
