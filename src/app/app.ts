import { Component, Inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase';
import { Auth } from './services/auth';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  auth = inject(Auth);
  router = inject(Router);
  private supabase = inject(SupabaseService);

  async ngOnInit() {
    try {
      // Get the current user if authenticated
      const user = await this.auth.getCurrentUser();

      if (!user) {
        // No user, let routing handle it
        return;
      }

      // User is authenticated, get their role and navigate
      const role = await this.auth.getUserRole();

      if (role === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/dealer/dashboard']);
      }
    } catch (error) {
      console.error('App initialization error:', error);
      // On error, let routing default to login
    }
  }
}

