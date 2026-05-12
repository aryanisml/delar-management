// Vercel serverless function — Cashfree order creation
// Keys are hardcoded for sprint. Replace with env vars before production.
const CASHFREE_APP_ID = 'TEST10980941ba3d9feaf9281b9b0e3814908901';
const CASHFREE_SECRET_KEY = 'cfsk_ma_test_1415afd4dc2db21cb233f06db7dcd8e7_4831b5c7';
const CASHFREE_BASE_URL = 'https://sandbox.cashfree.com/pg';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { order_id, order_amount, customer_id, customer_name, customer_email, customer_phone, booking_id } = req.body;

  if (!order_id || !order_amount || !customer_id || !booking_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const return_url = `https://delar-management.vercel.app/dealer/booking/${booking_id}/payments?cf_order_id={order_id}`;

  try {
    const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify({
        order_id,
        order_amount: Number(order_amount),
        order_currency: 'INR',
        customer_details: {
          customer_id: String(customer_id),
          customer_name: customer_name || 'Customer',
          customer_email: customer_email || 'noreply@example.com',
          customer_phone: String(customer_phone || '9999999999').replace(/\D/g, '').slice(-10).padStart(10, '9'),
        },
        order_meta: { return_url },
      }),
    });

    if (!cfResponse.ok) {
      const errText = await cfResponse.text();
      console.error('[create-cashfree-order] Cashfree API error:', errText);
      return res.status(502).json({ error: 'Cashfree order creation failed', detail: errText });
    }

    const cfOrder = await cfResponse.json();
    return res.status(200).json({ payment_session_id: cfOrder.payment_session_id });
  } catch (err) {
    console.error('[create-cashfree-order] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
