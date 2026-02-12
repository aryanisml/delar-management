export interface Vehicle {
  id: string;
  brand?: string; // normalized lowercase property
  Brand?: string; // possible uppercase DB column
  make?: string;
  model?: string;
  created_at?: string;
  [key: string]: any;
}
