import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { DealerDashboard } from './pages/dealer-dashboard/dealer-dashboard';
import { AuthCallback } from './pages/auth-callback/auth-callback';
import { authGuard } from './auth-guard';

export const routes: Routes = [

  // Public routes
  {
    path: 'login',
    component: Login
  },
  {
    path: 'auth/callback',
    component: AuthCallback
  },

  // Protected routes
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [authGuard]
  },
  {
    path: 'dealer',
    component: DealerDashboard,
    canActivate: [authGuard]
  },

  // Default redirect
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // Unknown route fallback
  {
    path: '**',
    redirectTo: 'login'
  }
];
