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
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  /**
   * Fetch vehicles from `vechile` table.
   * Returns an object { data, error } similar to supabase response so callers can handle.
   */
  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
    try {
      // Try ordering by created_at if the column exists; if not, fall back to no-order.
      let data: any[] | null = null;
      let error: any = null;

      const tryOrder = await this.supabase
        .from('vechile')
        .select('*')
        .order('created_at', { ascending: false });

      data = tryOrder.data ?? null;
      error = tryOrder.error ?? null;

      if (error) {
        // If the error indicates the column doesn't exist, retry without ordering
        const msg = (error.message || '').toString();
        if (error.code === '42703' || /does not exist/.test(msg)) {
          const fallback = await this.supabase.from('vechile').select('*');
          data = fallback.data ?? null;
          error = fallback.error ?? null;
        }
      }

      // Normalize brand casing to `brand` for consistent consumer usage
      const normalized = (data ?? []).map((r: any) => ({ ...r, brand: r.brand ?? r.Brand }));

      return { data: normalized as Vehicle[], error };
    } catch (err) {
      console.error('SupabaseService.getVehicles error', err);
      return { data: null, error: err };
    }
  }

  async signOut() {
    try {
      await this.supabase.auth.signOut();
    } catch (err) {
      console.error('SupabaseService.signOut error', err);
    }
  }

}
