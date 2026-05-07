import { Component, Inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase';
import { Auth } from './services/auth';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  auth = inject(Auth);
  router = inject(Router);
  private supabase = inject(SupabaseService);

  async ngOnInit() {
    (window as any).fixPayments = async () => {
      const result = await this.supabase.fixExistingInitiatedPayments();
      if (result.error) {
        console.error('[fixPayments] Failed to update initiated payments:', result.error);
        return result;
      }

      console.log(`[fixPayments] Updated ${result.data?.updatedCount ?? 0} payment row(s).`);
      return result;
    };

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
        this.router.navigate(['/admin/dashboard']);
      } else {
        this.router.navigate(['/dealer']);
      }
    } catch (error) {
      console.error('App initialization error:', error);
      // On error, let routing default to login
    }
  }
}

