// Vercel serverless function — Cashfree payment verification
const CASHFREE_APP_ID = 'TEST10980941ba3d9feaf9281b9b0e3814908901';
const CASHFREE_SECRET_KEY = 'cfsk_ma_test_1415afd4dc2db21cb233f06db7dcd8e7_4831b5c7';
const CASHFREE_BASE_URL = 'https://sandbox.cashfree.com/pg';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { cf_order_id } = req.query;
  if (!cf_order_id) return res.status(400).json({ error: 'Missing cf_order_id' });

  try {
    const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders/${cf_order_id}`, {
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
      },
    });

    if (!cfResponse.ok) {
      const errText = await cfResponse.text();
      console.error('[confirm-cashfree-payment] Cashfree API error:', errText);
      return res.status(502).json({ error: 'Failed to fetch order status' });
    }

    const cfOrder = await cfResponse.json();
    const orderStatus = String(cfOrder.order_status || '').toUpperCase();
    const isPaid = orderStatus === 'PAID';
    const paymentStatus = isPaid
      ? 'success'
      : orderStatus === 'EXPIRED' || orderStatus === 'FAILED'
        ? 'failed'
        : 'initiated';
    const cfPaymentId =
      cfOrder.cf_payment_id
      || cfOrder.payment_details?.cf_payment_id
      || cfOrder.payments?.[0]?.cf_payment_id
      || cfOrder.payments?.[0]?.payment_id
      || null;

    return res.status(200).json({
      is_paid: isPaid,
      order_status: orderStatus,
      payment_status: paymentStatus,
      cf_order_id: cfOrder.cf_order_id,
      cf_payment_id: cfPaymentId,
      payment_group: cfOrder.payment_group || null,
    });
  } catch (err) {
    console.error('[confirm-cashfree-payment] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
