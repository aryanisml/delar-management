import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = Deno.env.get('BOOKING_EMAIL_FROM') || 'Bookings <onboarding@resend.dev>';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();
    const to = String(body.to || '').trim();

    if (!to) {
      return json({ skipped: true, reason: 'missing_email' });
    }

    if (!resendApiKey) {
      return json({ error: 'RESEND_API_KEY is not configured' }, 500);
    }

    const quotation = body.quotation || {};
    const booking = body.booking || {};
    const vehicle = body.vehicle || {};
    const dealer = body.dealer || {};
    const mode = body.mode || 'booking';
    const quoteReference = body.quoteReference || quotation.quote_reference || quotation.quotation_ref || booking.id;
    const vehicleName = `${vehicle.make || vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim();

    const subject = mode === 'quotation'
      ? `Your Quotation - ${quoteReference}`
      : `Your Rental Booking has been Initiated - ${quoteReference}`;

    const text = mode === 'quotation'
      ? [
          `Hello ${body.customerName || quotation.customer_name || 'Customer'},`,
          '',
          `Please find attached your quotation ${quoteReference}.`,
          '',
          `Vehicle: ${vehicleName || 'Selected vehicle'}`,
          `Pickup: ${booking.pickup_location || '-'}`,
          `Drop: ${booking.drop_location || '-'}`,
          `Trip dates: ${formatDate(booking.start_date)} to ${formatDate(booking.end_date)}`,
          `Final quoted amount: Rs ${Number(quotation.final_amount || booking.total_price || 0).toLocaleString('en-IN')}`,
          '',
          'Please review the attached PDF for the full cost breakdown and booking details.',
          '',
          'Dealer contact:',
          `${dealer.company_name || 'Dealer team'}`,
          `${dealer.phone || dealer.mobile || 'Phone not available'}`,
          '',
          `Quote reference: ${quoteReference}`,
        ].join('\n')
      : [
          `Hello ${body.customerName || quotation.customer_name || 'Customer'},`,
          '',
          `Your rental booking has been initiated for quotation ${quoteReference}.`,
          '',
          `Vehicle: ${vehicleName || 'Selected vehicle'}`,
          `Pickup: ${formatDate(booking.start_date)} at ${booking.pickup_location || '-'}`,
          `Drop: ${formatDate(booking.end_date)} at ${booking.drop_location || '-'}`,
          `Total quoted amount: Rs ${Number(quotation.final_amount || booking.total_price || 0).toLocaleString('en-IN')}`,
          '',
          'Your rental process has been initiated. Our dealer will contact you shortly to complete the next steps.',
          '',
          'Dealer contact:',
          `${dealer.company_name || 'Dealer team'}`,
          `${dealer.phone || dealer.mobile || 'Phone not available'}`,
          '',
          `Quote reference: ${quoteReference}`,
        ].join('\n');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        text,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return json(result, response.status);
    }

    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    },
  });
}

function formatDate(value: string) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
