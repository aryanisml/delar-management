-- fix_existing_payments.sql
-- PURPOSE: Back-fill payment/booking status for the already completed payment rows
--          supplied in payments_rows.csv where the callback never fired.
--
-- WARNING: Run this ONLY after verifying in the Cashfree dashboard that the
--          six listed orders are actually PAID. This script is intentionally targeted.
--
-- Safe to run multiple times (idempotent due to WHERE filters).

BEGIN;

-- Step 1: Mark only the confirmed historical payment rows as paid.
UPDATE payments
SET
  status     = 'paid',
  updated_at = NOW()
WHERE cf_order_id IN (
  'CF-BB2207D332CE4D84-1777556069254',
  'CF-71343F8D2EF24AC7-1777546545858',
  'CF-2CBDFE1F797D4448-1777575110049',
  'CF-A322464086CA474F-1777556371236',
  'CF-5A3EE8776D054135-1777547824252',
  'CF-39EF572A72D74047-1777573953043'
)
  AND status <> 'failed';

-- Step 2: Update the corresponding bookings.
--         Only advances booking status from 'approved' to 'payment_received'.
--         Leaves any other booking status (in_service, completed, etc.) untouched.
UPDATE bookings b
SET
  payment_status = 'payment_received',
  status         = CASE WHEN b.status = 'approved' THEN 'payment_received' ELSE b.status END,
  updated_at     = NOW()
FROM payments p
WHERE p.booking_id = b.id
  AND p.cf_order_id IN (
    'CF-BB2207D332CE4D84-1777556069254',
    'CF-71343F8D2EF24AC7-1777546545858',
    'CF-2CBDFE1F797D4448-1777575110049',
    'CF-A322464086CA474F-1777556371236',
    'CF-5A3EE8776D054135-1777547824252',
    'CF-39EF572A72D74047-1777573953043'
  )
  AND p.status = 'paid'
  AND (b.payment_status IS DISTINCT FROM 'payment_received');

COMMIT;
