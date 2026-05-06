-- create_payment_functions.sql
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run — CREATE OR REPLACE is idempotent.

-- ============================================================
-- FUNCTION 1: insert_payment_record
-- Inserts a new payment row bypassing RLS.
-- Called when a Cashfree order is created.
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_payment_record(
  p_booking_id            uuid,
  p_quotation_id          uuid,
  p_customer_id           uuid,
  p_vehicle_id            uuid,
  p_advisor_id            uuid,
  p_cf_order_id           text,
  p_cf_payment_session_id text,
  p_amount                numeric,
  p_payment_type          text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payments (
    booking_id, quotation_id, customer_id, vehicle_id, advisor_id,
    cf_order_id, cf_payment_session_id, amount, payment_type, status,
    created_at, updated_at
  ) VALUES (
    p_booking_id, p_quotation_id, p_customer_id, p_vehicle_id, p_advisor_id,
    p_cf_order_id, p_cf_payment_session_id, p_amount, p_payment_type, 'initiated',
    NOW(), NOW()
  )
  ON CONFLICT (cf_order_id) DO NOTHING;
END;
$$;

-- ============================================================
-- FUNCTION 2: confirm_booking_payment
-- Called after Cashfree redirects back.
-- Updates payment status to 'paid' and booking to 'payment_received'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_id     uuid,
  p_cf_order_id    text,
  p_payment_status text,
  p_payment_mode   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payments
  SET
    status       = CASE WHEN p_payment_status = 'success' THEN 'paid' ELSE p_payment_status END,
    payment_mode = COALESCE(p_payment_mode, payment_mode),
    updated_at   = NOW()
  WHERE cf_order_id = p_cf_order_id;

  IF p_payment_status = 'success' THEN
    UPDATE bookings
    SET
      payment_status = 'payment_received',
      status         = CASE WHEN status = 'approved' THEN 'payment_received' ELSE status END,
      updated_at     = NOW()
    WHERE id = p_booking_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_payment_record TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment TO authenticated;
