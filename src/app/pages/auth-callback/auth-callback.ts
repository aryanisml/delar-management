import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-auth-callback',
  template: '<div>Processing authentication...</div>',
  standalone: true,
})
export class AuthCallback {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  async ngOnInit() {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const user = await this.supabase.getCurrentUser();
      if (!user) {
        await this.router.navigate(['/login']);
        return;
      }

      const role = await this.supabase.ensureUserRoleAndDealer(user);
      if (role === 'admin' || role === 'superadmin') {
        await this.router.navigate(['/admin/dashboard']);
        return;
      }

      await this.router.navigate(['/dealer/dashboard']);
    } catch (error) {
      console.error('Auth callback error:', error);
      await this.router.navigate(['/login']);
    }
  }
}
