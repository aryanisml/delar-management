import { Routes } from '@angular/router';
import { AuthCallback } from './pages/auth-callback/auth-callback';
import { AdminAnalytics } from './pages/admin-analytics/admin-analytics';
import { AdminAuditLogs } from './pages/admin-audit-logs/admin-audit-logs';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { AdminDealerPerformance } from './pages/admin-dealer-performance/admin-dealer-performance';
import { AdminOverview } from './pages/admin-overview/admin-overview';
import { AdminRevenue } from './pages/admin-revenue/admin-revenue';
import { AdminUsers } from './pages/admin-users/admin-users';
import { authGuard } from './auth-guard';
import { Layout } from './layout/layout';
import { MyBookingsComponent } from './pages/booking/my-bookings/my-bookings.component';
import { CustomerDetailsComponent } from './pages/booking/customer-details/customer-details.component';
import { InspectionPlaceholderComponent } from './pages/booking/inspection/inspection-placeholder.component';
import { DealerAnalytics } from './pages/dealer-analytics/dealer-analytics';
import { DealerBookings } from './pages/dealer-bookings/dealer-bookings';
import { DealerDashboard } from './pages/dealer-dashboard/dealer-dashboard';
import { DealerInventory } from './pages/dealer-inventory/dealer-inventory';
import { PaymentComponent } from './pages/dealer-payment/payment.component';
import { Login } from './pages/login/login';
import { ProfileComponent } from './pages/profile/profile';
import { QuotationComponent } from './pages/dealer-quotation/quotation.component';

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
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: AdminOverview, data: { title: 'Dashboard' } },
          { path: 'vehicles', component: AdminDashboard, data: { title: 'Vehicles' } },
          { path: 'bookings', component: AdminDealerPerformance, data: { title: 'Bookings' } },
          { path: 'users', component: AdminUsers, data: { title: 'Users' } },
          { path: 'reports', component: AdminRevenue, data: { title: 'Reports' } },
          { path: 'analytics', component: AdminAnalytics, data: { title: 'Analytics' } },
          { path: 'audit', component: AdminAuditLogs, data: { title: 'Audit Log' } },
        ],
      },
      {
  path: 'dealer',
  children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DealerDashboard },
    { path: 'my-bookings', component: MyBookingsComponent },
    { path: 'inventory', component: DealerInventory },
    { path: 'analytics', component: DealerAnalytics },
	    { path: 'bookings', component: DealerBookings },
	    { path: 'booking/:bookingId/customer-details', component: CustomerDetailsComponent },
	    { path: 'inspection/:bookingId', component: InspectionPlaceholderComponent },
	    { path: 'booking/:bookingId/quotation', component: QuotationComponent },
	    { path: 'booking/:bookingId/payments', component: PaymentComponent },
	  ],
	},
      { path: 'profile', component: ProfileComponent, data: { title: 'Profile' } },
      { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
