import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class Auth {

  constructor(private supabase: SupabaseService) {}

  async getCurrentUser() {
    const { data: { user } } =
      await this.supabase.supabase.auth.getUser();
    return user;
  }

  async getUserRole(): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error(error);
      return null;
    }

    return data.role;
  }
}
