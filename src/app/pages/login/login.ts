import { Component } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import { SupabaseService } from '../../services/supabase';
@Component({
  selector: 'app-login',
  imports: [ButtonModule, CardModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  constructor(private supabase: SupabaseService) {}

  async googleLogin() {
    await this.supabase.signInWithGoogle();
  }
}
