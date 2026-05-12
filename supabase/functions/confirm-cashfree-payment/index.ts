import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { booking_id, cf_order_id } = await req.json();
    if (!booking_id || !cf_order_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: booking_id, cf_order_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appId = Deno.env.get('CASHFREE_APP_ID');
    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY');
    if (!appId || !secretKey) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cashfreeBaseUrl = Deno.env.get('CASHFREE_ENV') === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const cfResponse = await fetch(`${cashfreeBaseUrl}/orders/${cf_order_id}`, {
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
      },
    });

    if (!cfResponse.ok) {
      const errBody = await cfResponse.text();
      console.error('Cashfree order fetch failed:', errBody);
      return new Response(JSON.stringify({ error: 'Failed to verify payment order' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cfOrder = await cfResponse.json();
    const orderStatus = String(cfOrder.order_status ?? '').toUpperCase();
    const isPaid = orderStatus === 'PAID';
    const paymentStatus = isPaid ? 'paid' : orderStatus === 'EXPIRED' || orderStatus === 'FAILED' ? 'failed' : 'initiated';
    const cfPaymentId = cfOrder.cf_payment_id
      ?? cfOrder.payment_details?.cf_payment_id
      ?? cfOrder.payments?.[0]?.cf_payment_id
      ?? cfOrder.payments?.[0]?.payment_id
      ?? null;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await serviceClient
      .from('payments')
      .update({
        status: paymentStatus,
        cf_payment_id: cfPaymentId,
        payment_mode: cfOrder.payment_group ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('cf_order_id', cf_order_id);

    if (isPaid) {
      await serviceClient
        .from('bookings')
        .update({
          status: 'payment_received',
          payment_status: 'payment_received',
          updated_at: new Date().toISOString(),
        })
      .eq('id', booking_id);
    }

    return new Response(JSON.stringify({
      order_status: orderStatus,
      is_paid: isPaid,
      payment_status: paymentStatus,
      cf_payment_id: cfPaymentId,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Unexpected error in confirm-cashfree-payment:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
