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

  // =============================
  // AUTH
  // =============================

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
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }

  // =============================
  // ROLE
  // =============================

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

  // =============================
  // VEHICLES
  // =============================

  async getVehicles() {
    const { data, error } = await this.supabase
      .from(this.vehiclesTable)
      .select('*');

    return { data, error };
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

  // =============================
// AUDIT LOGGING
// =============================

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
