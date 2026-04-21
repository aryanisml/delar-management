import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './services/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabase.getCurrentUser();

  // 🔒 Not logged in
  if (!user) {
    if (state.url !== '/login') {
      return router.parseUrl('/login');
    }
    return true;
  }

  // ✅ Get role ONCE
  const role = await supabase.getUserRole(user.id);

  // 🧠 Handle root redirect ONLY once
  if (state.url === '/') {
    return role === 'admin'
      ? router.parseUrl('/admin/dashboard')
      : router.parseUrl('/dealer/dashboard');
  }

  // 🚫 Dealer cannot access admin
  if (state.url.startsWith('/admin') && role !== 'admin') {
    return router.parseUrl('/dealer/dashboard');
  }

  // 🚫 Admin cannot access dealer
  if (state.url.startsWith('/dealer') && role !== 'dealer') {
    return router.parseUrl('/admin/dashboard');
  }

  return true;
};