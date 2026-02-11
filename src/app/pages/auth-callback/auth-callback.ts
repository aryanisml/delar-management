import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-auth-callback',
  template: '<div>Processing authentication...</div>',
  standalone: true
})
export class AuthCallback {
  private router = inject(Router);
  private auth = inject(Auth);

  async ngOnInit() {
    try {
      // Wait a moment for Supabase to process the hash
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the current user and their role
      const user = await this.auth.getCurrentUser();
      
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      const role = await this.auth.getUserRole();
      
      if (role === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/dealer']);
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      this.router.navigate(['/login']);
    }
  }
}
