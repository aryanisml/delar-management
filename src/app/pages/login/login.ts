import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import { SupabaseService } from '../../services/supabase';
import { Auth } from '../../services/auth';
@Component({
  selector: 'app-login',
  imports: [ButtonModule, CardModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  constructor( private auth: Auth,
  private router: Router,
  private supabase: SupabaseService) {}

  async googleLogin() {
    await this.supabase.signInWithGoogle();
  }
}
