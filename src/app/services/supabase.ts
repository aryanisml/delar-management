import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Vehicle } from '../models/vehicle';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  async signInWithGoogle() {
    // Always use the current origin for the redirect URL
    const redirectUrl = `${window.location.origin}/auth/callback`;
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
  }

  async recoverSession() {
    const { data } = await this.supabase.auth.refreshSession();
    return data.session;
  }

  async getCurrentUser() {
  const { data, error } = await this.supabase.auth.getUser();
  if (error || !data) {
    console.error("Auth error:", error?.message);
    return null; 
  }
  return data.user;
}

  /**
   * Fetch vehicles from `vehicle` table.
   * Returns an object { data, error } similar to supabase response so callers can handle.
   */
  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
  try {
    let data: any[] | null = null;
    let error: any = null;

    // Try ordering by created_at
    const tryOrder = await this.supabase
      .from('vehicle')
      .select('*')
      .order('created_at', { ascending: false });

    data = tryOrder.data ?? null;
    error = tryOrder.error ?? null;

    // Fallback if created_at column doesn't exist
    if (error) {
      const msg = (error.message || '').toString();

      if (error.code === '42703' || /does not exist/.test(msg)) {
        const fallback = await this.supabase
          .from('vehicle')
          .select('*');

        data = fallback.data ?? null;
        error = fallback.error ?? null;
      }
    }

    // Normalize fields
    const normalized = (data ?? []).map((r: any) => ({
      ...r,

      // ensure brand always exists
      brand: r.brand ?? r.Brand,

      // ensure booked always boolean
      booked: Boolean(r.booked)
    }));

    return { data: normalized as Vehicle[], error };

  } catch (err) {
    console.error('SupabaseService.getVehicles error', err);
    return { data: null, error: err };
  }
}
  async createBooking(booking: any) {

const { data, error } = await this.supabase
.from('bookings')
.insert([booking]);

return { data, error };

}

async getMyBookings(userId: string) {
  return await this.supabase
    .from('bookings')
    .select(`
      id,
      pickup_location,
      drop_location,
      start_date,
      end_date,
      purpose,
      status,
      created_at,
      vehicle (
        id,
        brand,
        make,
        model,
        location,
        daily_rate
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

async getBookingsByVehicle(vehicleId: string) {
  return await this.supabase
    .from('bookings')
    .select('*')
    .eq('vehicle_id', vehicleId);
}

async updateBookingStatus(bookingId: string, newStatus: string) {
  return await this.supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId);
}
  async signOut() {
    try {
      await this.supabase.auth.signOut();
    } catch (err) {
      console.error('SupabaseService.signOut error', err);
    }
  }

}
