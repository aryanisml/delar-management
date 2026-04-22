import { Vehicle } from './vehicle';

export interface Booking {
  id?: string;
  vehicle_id: string;
  user_id?: string;
  pickup_location: string;
  drop_location: string;
  start_date: string;
  end_date: string;
  purpose: string;
  quantity?: number;
  bulk_booking_id?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  dealer_notes?: string;
  status?: 'pending' | 'confirmed' | 'in_service' | 'rejected' | 'cancelled' | 'completed';
  quote_status?: 'draft' | 'sent' | 'confirmed' | 'cancelled' | 'rejected';
  customer_id?: string;
  pickup_time?: string;
  dropoff_time?: string;
  number_of_passengers?: number;
  special_instructions?: string;
  total_price?: number;
  created_at?: string;
  updated_at?: string;
  vehicle?: Partial<Vehicle>;
}
