import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { DealerDashboard } from './pages/dealer-dashboard/dealer-dashboard';
import { AuthCallback } from './pages/auth-callback/auth-callback';
import { authGuard } from './auth-guard';
import { Layout } from './layout/layout';
import { DealerAnalytics } from './pages/dealer-analytics/dealer-analytics';
import { DealerBookings } from './pages/dealer-bookings/dealer-bookings';
import { DealerInventory } from './pages/dealer-inventory/dealer-inventory';

export const routes: Routes = [

  // Public
  { path: 'login', component: Login },
  { path: 'auth/callback', component: AuthCallback },

  // Protected
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [

      { path: 'admin', component: AdminDashboard },

      {
        path: 'dealer',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DealerDashboard },
          { path: 'inventory', component: DealerInventory },
          { path: 'analytics', component: DealerAnalytics },
          { path: 'bookings', component: DealerBookings }
        ]
      },

      { path: '', redirectTo: 'admin', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
