import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Booking } from '../models/booking';
import { Vehicle } from '../models/vehicle';

type BulkBookingInput = {
  id: string;
  dealer_id: string;
  total_vehicles: number;
  notes?: string;
  status?: string;
};

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly vehiclesTable = 'vehicle';

  supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

  async signInWithGoogle() {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
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

  async updateUserMetadata(data: Record<string, any>) {
    return await this.supabase.auth.updateUser({ data });
  }

  async resetPasswordForEmail(email: string) {
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
  }

  async getUserRole(userId: string) {
    const { data, error } = await this.supabase.from('user_roles').select('role').eq('user_id', userId).single();

    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }

    return data?.role ?? null;
  }

  async getAllUserRoles() {
    return await this.supabase.from('user_roles').select('*');
  }

  async getAllUsers() {
    return await this.supabase.from('user_roles').select('*').order('created_at', { ascending: false });
  }

  async updateUserRole(userId: string, role: string) {
    return await this.supabase.from('user_roles').update({ role }).eq('user_id', userId);
  }

  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const orderedResult = await this.supabase.from(this.vehiclesTable).select('*').order('created_at', { ascending: false });

      data = orderedResult.data ?? null;
      error = orderedResult.error ?? null;

      if (error) {
        const message = String(error.message || '');
        if (error.code === '42703' || /does not exist/i.test(message)) {
          const fallbackResult = await this.supabase.from(this.vehiclesTable).select('*');
          data = fallbackResult.data ?? null;
          error = fallbackResult.error ?? null;
        }
      }

      const normalized = (data ?? []).map((row: any) => ({
        ...row,
        brand: row.brand ?? row.Brand ?? row.make ?? '',
        make: row.make ?? row.brand ?? row.Brand ?? '',
        model: row.model ?? '',
        stock: Number(row.stock ?? 0),
        daily_rate: Number(row.daily_rate ?? row.dailyRate ?? 0),
        type: row.type ?? null,
        fuel: row.fuel ?? null,
        capacity: row.capacity ? Number(row.capacity) : null,
        mileage: Number(row.mileage ?? 0),
        year: row.year ? Number(row.year) : null,
        chassis_no: row.chassis_no ?? row.chassisNumber ?? null,
        registration_no: row.registration_no ?? row.registrationNo ?? null,
        image_url: row.image_url ?? row.imageUrl ?? null,
        booked: Boolean(row.booked),
      }));

      return { data: normalized as Vehicle[], error };
    } catch (error) {
      console.error('SupabaseService.getVehicles error', error);
      return { data: null, error };
    }
  }

  async getBookings() {
    return await this.supabase.from('bookings').select('*').order('created_at', { ascending: false });
  }

  async getBookingWithVehicle(bookingId: string) {
    return await this.supabase
      .from('bookings')
      .select(`*, vehicle (*)`)
      .eq('id', bookingId)
      .single();
  }

  async addVehicle(vehicle: any) {
    return await this.supabase.from(this.vehiclesTable).insert([vehicle]);
  }

  async updateVehicle(id: string, vehicle: any) {
    return await this.supabase.from(this.vehiclesTable).update(vehicle).eq('id', id);
  }

  async deleteVehicle(id: string) {
    return await this.supabase.from(this.vehiclesTable).delete().eq('id', id);
  }

  async createBooking(booking: Partial<Booking>) {
    return await this.supabase.from('bookings').insert([booking]);
  }

  async getMyBookings(userId: string) {
    return await this.supabase
      .from('bookings')
      .select(`
        id,
        vehicle_id,
        user_id,
        pickup_location,
        drop_location,
        start_date,
        end_date,
        purpose,
        quantity,
        bulk_booking_id,
        approved_by,
        approved_at,
        rejection_reason,
        dealer_notes,
        status,
        created_at,
        updated_at,
        vehicle (
          id,
          brand,
          make,
          model,
          location,
          daily_rate,
          image_url,
          type,
          status
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }

  async getQuotationByBooking(bookingId: string) {
    try {
      return await this.supabase.from('quotations').select('*').eq('booking_id', bookingId).maybeSingle();
    } catch (error) {
      return { data: null, error };
    }
  }

  async searchCustomers(query: string) {
    const term = query.trim();
    if (term.length < 3) {
      return { data: [], error: null };
    }

    try {
      return await this.supabase
        .from('customers')
        .select('*')
        .or(`mobile.ilike.%${term}%,email.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(6);
    } catch (error) {
      return { data: [], error };
    }
  }

  async validatePromotion(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return { data: null, error: null };
    }

    try {
      return await this.supabase
        .from('promotions')
        .select('*')
        .eq('code', normalized)
        .eq('active', true)
        .maybeSingle();
    } catch (error) {
      return { data: null, error };
    }
  }

  async getBookingsByVehicle(vehicleId: string) {
    return await this.supabase.from('bookings').select('*').eq('vehicle_id', vehicleId);
  }

  async getMyBulkBookings(userId: string) {
    return await this.supabase
      .from('bulk_bookings')
      .select(`
        *,
        bookings (
          id,
          vehicle_id,
          user_id,
          pickup_location,
          drop_location,
          start_date,
          end_date,
          purpose,
          quantity,
          status,
          rejection_reason,
          created_at,
          vehicle (
            id,
            brand,
            make,
            model,
            location,
            daily_rate,
            image_url
          )
        )
      `)
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false });
  }

  async updateBookingStatus(bookingId: string, newStatus: string) {
    return await this.supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
  }

  async approveBooking(bookingId: string) {
    const user = await this.getCurrentUser();
    return await this.supabase
      .from('bookings')
      .update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq('id', bookingId);
  }

  async rejectBooking(bookingId: string, reason: string) {
    return await this.supabase
      .from('bookings')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', bookingId);
  }

  async insertBulkBooking(data: BulkBookingInput) {
    return await this.supabase.from('bulk_bookings').insert([{ ...data, status: data.status ?? 'pending' }]);
  }

  async getBulkBookings() {
    return await this.supabase.from('bulk_bookings').select('*, bookings(*)').order('created_at', { ascending: false });
  }

  async insertNotification(userId: string, title: string, message: string, bookingId?: string) {
    return await this.supabase.from('notifications').insert([
      {
        user_id: userId,
        title,
        message,
        booking_id: bookingId,
      },
    ]);
  }

  async getMyNotifications() {
    const user = await this.getCurrentUser();
    if (!user) {
      return { data: [], error: null };
    }

    return await this.supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  }

  async markNotificationsRead(userId: string) {
    return await this.supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  }

  async getAuditLogs() {
    return await this.supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  }

  async getDealerProfile(userId: string) {
    return await this.supabase.from('dealers').select('*').eq('user_id', userId).maybeSingle();
  }

  async upsertDealerProfile(payload: Record<string, any>) {
    const existing = await this.getDealerProfile(payload['user_id']);
    if (existing.data?.id) {
      return await this.supabase.from('dealers').update(payload).eq('id', existing.data.id);
    }

    return await this.supabase.from('dealers').insert([payload]);
  }

  async logAudit(action: string, entityId?: string) {
    const user = await this.getCurrentUser();
    if (!user) {
      return;
    }

    await this.supabase.from('audit_logs').insert([
      {
        action,
        user_id: user.id,
        entity_id: entityId ?? null,
        created_at: new Date().toISOString(),
      },
    ]);
  }
}
