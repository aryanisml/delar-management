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

    const { booking_id, quotation_id, amount } = await req.json();
    if (!booking_id || !quotation_id || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields: booking_id, quotation_id, amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appId = Deno.env.get('CASHFREE_APP_ID');
    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY');
    if (!appId || !secretKey) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY secrets.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: booking, error: bookingError } = await serviceClient
      .from('bookings')
      .select('id, status, customer_id, vehicle_id, advisor_id, customers(full_name, mobile, email)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (booking.status !== 'approved') {
      return new Response(JSON.stringify({ error: `Booking must be approved to initiate payment (current: ${booking.status})` }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency: return existing initiated payment if one exists
    const { data: existingPayment } = await serviceClient
      .from('payments')
      .select('cf_order_id, cf_payment_session_id, status')
      .eq('booking_id', booking_id)
      .eq('status', 'initiated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.cf_payment_session_id) {
      return new Response(JSON.stringify({
        cf_order_id: existingPayment.cf_order_id,
        payment_session_id: existingPayment.cf_payment_session_id,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cfOrderId = `CF-${booking_id.replace(/-/g, '').slice(0, 16).toUpperCase()}-${Date.now()}`;
    const customer = (booking as any).customers;
    const cashfreeBaseUrl = Deno.env.get('CASHFREE_ENV') === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const cfPayload = {
      order_id: cfOrderId,
      order_amount: Number(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: booking.customer_id,
        customer_name: customer?.full_name || 'Customer',
        customer_email: customer?.email || 'noreply@example.com',
        customer_phone: (String(customer?.mobile || '9999999999')).replace(/\D/g, '').slice(-10).padStart(10, '9'),
      },
      order_meta: {
        return_url: `${req.headers.get('origin') || 'https://localhost'}/dealer/booking/${booking_id}/payments?cf_order_id={order_id}`,
      },
    };

    const cfResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
      },
      body: JSON.stringify(cfPayload),
    });

    if (!cfResponse.ok) {
      const errBody = await cfResponse.text();
      console.error('Cashfree order creation failed:', errBody);
      return new Response(JSON.stringify({ error: 'Failed to create payment order', detail: errBody }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cfOrder = await cfResponse.json();

    const { data: dealer } = await serviceClient
      .from('dealers')
      .select('id')
      .eq('user_id', booking.advisor_id)
      .maybeSingle();

    const { error: paymentError } = await serviceClient
      .from('payments')
      .insert({
        booking_id,
        quotation_id,
        customer_id: booking.customer_id,
        vehicle_id: booking.vehicle_id,
        advisor_id: booking.advisor_id,
        dealer_id: dealer?.id ?? null,
        cf_order_id: cfOrderId,
        cf_payment_session_id: cfOrder.payment_session_id,
        amount: Number(amount),
        payment_type: 'advance',
        status: 'initiated',
      });

    if (paymentError) {
      console.error('Failed to insert payment record:', paymentError);
      return new Response(JSON.stringify({ error: 'Failed to record payment initiation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      cf_order_id: cfOrderId,
      payment_session_id: cfOrder.payment_session_id,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Unexpected error in create-cashfree-order:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
