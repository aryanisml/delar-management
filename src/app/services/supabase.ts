import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

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

}
