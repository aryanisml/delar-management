import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { DealerDashboard } from './pages/dealer-dashboard/dealer-dashboard';
import { AuthCallback } from './pages/auth-callback/auth-callback';
import { authGuard } from './auth-guard';
import { Layout } from './layout/layout';

import { AdminOverview } from './pages/admin-overview/admin-overview';
import { AdminDealers } from './pages/admin-dealers/admin-dealers';
import { AdminUsers } from './pages/admin-users/admin-users';
import { AdminAnalytics } from './pages/admin-analytics/admin-analytics';

// 🔥 NEW IMPORTS (THIS WAS MISSING)
import { AdminAuditLogs } from './pages/admin-audit-logs/admin-audit-logs';
import { AdminRevenue } from './pages/admin-revenue/admin-revenue';
import { AdminDealerPerformance } from './pages/admin-dealer-performance/admin-dealer-performance';

export const routes: Routes = [

  { path: 'login', component: Login },
  { path: 'auth/callback', component: AuthCallback },

  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [

      {
        path: 'admin',
        children: [
          { path: '', component: AdminOverview },
          { path: 'vehicles', component: AdminDashboard },
          { path: 'dealers', component: AdminDealers },
          { path: 'users', component: AdminUsers },
          { path: 'analytics', component: AdminAnalytics },

          // 🔥 NEW ROUTES
          { path: 'audit-logs', component: AdminAuditLogs },
          { path: 'revenue', component: AdminRevenue },
          { path: 'dealer-performance', component: AdminDealerPerformance }
        ]
      },

      { path: 'dealer/dashboard', component: DealerDashboard },

      { path: '', redirectTo: 'admin', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
