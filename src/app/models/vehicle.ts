export interface Vehicle {
  id: string
  vin: string
  brand: string
  Brand?: string
  make: string
  model: string
  stock: number
  status: string
  daily_rate: number
  location: string
  created_at?: string
  available?: number
  booked?: boolean
}
