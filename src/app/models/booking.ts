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
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  created_at?: string;
  updated_at?: string;
  vehicle?: Partial<Vehicle>;
}
