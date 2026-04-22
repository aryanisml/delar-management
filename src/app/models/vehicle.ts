export interface Vehicle {
  id: string;
  brand: string;
  Brand?: string;
  make: string;
  model: string;
  stock: number;
  status: string;
  daily_rate: number;
  location: string;
  vin?: string;
  type?: string;
  fuel?: string;
  capacity?: number;
  color?: string;
  mileage?: number;
  year?: number;
  chassis_no?: string;
  registration_no?: string;
  image_url?: string;
  notes?: string;
  created_at?: string;
  available?: number;
  booked?: boolean;
  vehicle_status?: string;
  next_available_date?: string | null;
  tier_id?: string | null;
}
