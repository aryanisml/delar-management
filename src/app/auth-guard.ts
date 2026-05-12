import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './services/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabase.getCurrentUser();

  if (!user) {
    return state.url === '/login' ? true : router.parseUrl('/login');
  }

  const role = await supabase.ensureUserRoleAndDealer(user);
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (state.url === '/') {
    return isAdmin ? router.parseUrl('/admin/dashboard') : router.parseUrl('/dealer/dashboard');
  }

  if (state.url.startsWith('/admin') && !isAdmin) {
    return router.parseUrl('/dealer/dashboard');
  }

  if (state.url.startsWith('/dealer') && isAdmin) {
    return router.parseUrl('/admin/dashboard');
  }

  return true;
};
