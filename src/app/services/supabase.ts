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
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google'
    });
  }

  async getCurrentUser() {
  const { data } = await this.supabase.auth.getUser();
  return data.user;
}

}
