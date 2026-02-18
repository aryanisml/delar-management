import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';

type MenuItem = { label: string; icon?: string; route?: string };

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterModule, MenubarModule, ButtonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private auth = inject(Auth);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  role = signal<string | null>(null);
  menuOpen = signal<boolean>(false);
  menuItems = signal<MenuItem[]>([]);
  currentYear = new Date().getFullYear();

  async ngOnInit() {
    const r = await this.auth.getUserRole();
    this.role.set(r);

    const adminMenu: MenuItem[] = [
      { label: 'Overview', icon: 'pi pi-home', route: '/admin' },
      { label: 'Vehicles', icon: 'pi pi-car', route: '/admin' },
      { label: 'Dealers', icon: 'pi pi-briefcase', route: '/admin' },
      { label: 'Users', icon: 'pi pi-users', route: '/admin' },
      { label: 'Settings', icon: 'pi pi-cog', route: '/admin' }
    ];

    const dealerMenu: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dealer' },
      { label: 'Inventory', icon: 'pi pi-car', route: '/dealer' },
      { label: 'Analytics', icon: 'pi pi-chart-line', route: '/dealer/analytics' },
      { label: 'Bookings', icon: 'pi pi-calendar', route: '/dealer/bookings' }
    ];

    this.menuItems.set(r === 'admin' ? adminMenu : dealerMenu);
  }

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  async navigate(item: MenuItem) {
    this.menuOpen.set(false);
    if (item.route) await this.router.navigateByUrl(item.route);
  }

  async signOut() {
    await this.supabase.supabase.auth.signOut();
    window.location.href = '/login';
  }
}
