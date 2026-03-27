import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Vehicle } from '../models/vehicle';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly vehiclesTable = 'vehicle';

  supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  async signInWithGoogle() {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });
  }

  async recoverSession() {
    const { data } = await this.supabase.auth.refreshSession();
    return data.session;
  }

  async getCurrentUser() {
    const { data, error } = await this.supabase.auth.getUser();
    if (error || !data) {
      console.error('Auth error:', error?.message);
      return null;
    }
    return data.user;
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }

  async getUserRole(userId: string) {
    const { data, error } = await this.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }

    return data?.role ?? null;
  }

  async getAllUserRoles() {
    const { data, error } = await this.supabase
      .from('user_roles')
      .select('*');

    return { data, error };
  }

  async updateUserRole(userId: string, role: string) {
    return await this.supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId);
  }

  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const orderedResult = await this.supabase
        .from(this.vehiclesTable)
        .select('*')
        .order('created_at', { ascending: false });

      data = orderedResult.data ?? null;
      error = orderedResult.error ?? null;

      if (error) {
        const message = String(error.message || '');
        if (error.code === '42703' || /does not exist/i.test(message)) {
          const fallbackResult = await this.supabase
            .from(this.vehiclesTable)
            .select('*');
          data = fallbackResult.data ?? null;
          error = fallbackResult.error ?? null;
        }
      }

      const normalized = (data ?? []).map((row: any) => ({
        ...row,
        brand: row.brand ?? row.Brand,
        booked: Boolean(row.booked)
      }));

      return { data: normalized as Vehicle[], error };
    } catch (error) {
      console.error('SupabaseService.getVehicles error', error);
      return { data: null, error };
    }
  }

  async getBookings() {
    const { data, error } = await this.supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    return { data, error };
  }

  async addVehicle(vehicle: any) {
    return await this.supabase.from(this.vehiclesTable).insert([vehicle]);
  }

  async updateVehicle(id: string, vehicle: any) {
    return await this.supabase
      .from(this.vehiclesTable)
      .update(vehicle)
      .eq('id', id);
  }

  async deleteVehicle(id: string) {
    return await this.supabase
      .from(this.vehiclesTable)
      .delete()
      .eq('id', id);
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
        vehicle_id,
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

  async logAudit(action: string) {
    const user = await this.getCurrentUser();
    if (!user) return;

    await this.supabase.from('audit_logs').insert([
      {
        action,
        user_id: user.id,
        created_at: new Date()
      }
    ]);
  }
}
