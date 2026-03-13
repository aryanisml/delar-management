import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './services/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabase.getCurrentUser();

  if (!user) {
    return router.parseUrl('/login');
  }

  // If accessing root, redirect by role
  if (state.url === '/' || state.url === '') {
    const role = await supabase.getUserRole(user.id);

    if (role === 'admin') {
      return router.parseUrl('/admin');
    }

    return router.parseUrl('/dealer/dashboard');
  }

  return true;
};
