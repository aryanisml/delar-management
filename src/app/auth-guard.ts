import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './services/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabase.getCurrentUser();

  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
