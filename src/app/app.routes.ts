import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { DealerDashboard } from './pages/dealer-dashboard/dealer-dashboard';
import { AuthCallback } from './pages/auth-callback/auth-callback';
import { authGuard } from './auth-guard';
import { Layout } from './layout/layout';
import { MyBookingsComponent } from './pages/booking/my-bookings.component';

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

  // Protected (layout) routes
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: 'admin', component: AdminDashboard },
      { path: 'dealer', component: DealerDashboard },
      { path: 'my-bookings', component: MyBookingsComponent },
      { path: '', redirectTo: 'admin', pathMatch: 'full' }
    ]
  },

  // Unknown route fallback
  {
    path: '**',
    redirectTo: 'login'
  },


];
