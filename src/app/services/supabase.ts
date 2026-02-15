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
  // VEHICLES (EXISTING + SAFE EXTENSION)
  // =============================

  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const tryOrder = await this.supabase
        .from('vechile')
        .select('*')
        .order('created_at', { ascending: false });

      data = tryOrder.data ?? null;
      error = tryOrder.error ?? null;

      if (error) {
        const msg = (error.message || '').toString();
        if (error.code === '42703' || /does not exist/.test(msg)) {
          const fallback = await this.supabase.from('vechile').select('*');
          data = fallback.data ?? null;
          error = fallback.error ?? null;
        }
      }

      const normalized = (data ?? []).map((r: any) => ({
        ...r,
        brand: r.brand ?? r.Brand
      }));

      return { data: normalized as Vehicle[], error };
    } catch (err) {
      console.error('SupabaseService.getVehicles error', err);
      return { data: null, error: err };
    }
  }

  // NEW METHODS (SAFE ADDITIONS)

  async addVehicle(vehicle: any) {
    return await this.supabase.from('vechile').insert([vehicle]);
  }

  async updateVehicle(id: string, vehicle: any) {
    return await this.supabase.from('vechile').update(vehicle).eq('id', id);
  }

  async deleteVehicle(id: string) {
    return await this.supabase.from('vechile').delete().eq('id', id);
  }

  // =============================
  // BOOKINGS
  // =============================

  async getPendingBookings() {
    return await this.supabase
      .from('bookings')
      .select('*, vechile(*)')
      .eq('status', 'pending');
  }

  async updateBookingStatus(id: string, status: string) {
    return await this.supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);
  }
}
