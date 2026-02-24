import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { ButtonModule } from 'primeng/button';

type MenuItem = { label: string; icon?: string; route?: string };

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {

  private auth = inject(Auth);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  role = signal<string | null>(null);
  sidebarCollapsed = signal<boolean>(false);
  menuItems = signal<MenuItem[]>([]);
  currentYear = new Date().getFullYear();

  async ngOnInit() {
    const r = await this.auth.getUserRole();
    this.role.set(r);

    // ===============================
    // ADMIN MENU (UPDATED)
    // ===============================
    const adminMenu: MenuItem[] = [
      { label: 'Overview', icon: 'pi pi-home', route: '/admin' },
      { label: 'Vehicles', icon: 'pi pi-car', route: '/admin/vehicles' },
      { label: 'Dealers', icon: 'pi pi-briefcase', route: '/admin/dealers' },
      { label: 'Users', icon: 'pi pi-users', route: '/admin/users' },
      { label: 'Analytics', icon: 'pi pi-chart-bar', route: '/admin/analytics' },
      { label: 'Revenue', icon: 'pi pi-wallet', route: '/admin/revenue' },
      { label: 'Dealer Performance', icon: 'pi pi-chart-line', route: '/admin/dealer-performance' },
      { label: 'Audit Logs', icon: 'pi pi-file', route: '/admin/audit-logs' }
    ];

    // ===============================
    // DEALER MENU (UNCHANGED)
    // ===============================
    const dealerMenu: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-home', route: '/dealer/dashboard' },
      { label: 'Inventory', icon: 'pi pi-car', route: '/dealer/inventory' },
      { label: 'Analytics', icon: 'pi pi-chart-line', route: '/dealer/analytics' },
      { label: 'Bookings', icon: 'pi pi-calendar', route: '/dealer/bookings' }
    ];

    this.menuItems.set(r === 'admin' ? adminMenu : dealerMenu);
  }

  // ===============================
  // SIDEBAR BEHAVIOR
  // ===============================

  toggleSidebar() {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  isActive(route?: string): boolean {
    if (!route) return false;
    return this.router.url.startsWith(route);
  }

  async navigate(item: MenuItem) {
    if (item.route) {
      await this.router.navigateByUrl(item.route);
    }
  }

  async signOut() {
    await this.supabase.supabase.auth.signOut();
    window.location.href = '/login';
  }
}
