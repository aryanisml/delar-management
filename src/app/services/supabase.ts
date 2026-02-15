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

  // =============================
  // AUTH (UNCHANGED)
  // =============================

  async signInWithGoogle() {
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
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async signOut() {
    try {
      await this.supabase.auth.signOut();
    } catch (err) {
      console.error('SupabaseService.signOut error', err);
    }
  }

  // =============================
  // VEHICLES
  // =============================

  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
    try {
      const { data, error } = await this.supabase
        .from('vechile')
        .select('*');

      if (error) {
        console.error('SupabaseService.getVehicles error:', error);
        return { data: null, error };
      }

      // Normalize brand casing safely
      const normalized = (data ?? []).map((r: any) => ({
        ...r,
        brand: r.brand ?? r.Brand
      }));

      return { data: normalized as Vehicle[], error: null };

    } catch (err) {
      console.error('SupabaseService.getVehicles error', err);
      return { data: null, error: err };
    }
  }

  async addVehicle(vehicle: any) {
    const { data, error } = await this.supabase
      .from('vechile')
      .insert([vehicle]);

    if (error) console.error('addVehicle error:', error);
    return { data, error };
  }

  async updateVehicle(id: string, vehicle: any) {
    const { data, error } = await this.supabase
      .from('vechile')
      .update(vehicle)
      .eq('id', id);

    if (error) console.error('updateVehicle error:', error);
    return { data, error };
  }

  async deleteVehicle(id: string) {
    const { data, error } = await this.supabase
      .from('vechile')
      .delete()
      .eq('id', id);

    if (error) console.error('deleteVehicle error:', error);
    return { data, error };
  }

  // =============================
  // BOOKINGS
  // =============================

  async getPendingBookings() {
    const { data, error } = await this.supabase
      .from('bookings')
      .select('*')
      .eq('status', 'pending');

    if (error) console.error('getPendingBookings error:', error);
    return { data, error };
  }

  async updateBookingStatus(id: string, status: string) {
    const { data, error } = await this.supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);

    if (error) console.error('updateBookingStatus error:', error);
    return { data, error };
  }
}
