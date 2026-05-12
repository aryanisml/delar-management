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

    return await this.supabase.ensureUserRoleAndDealer(user);
  }
}
