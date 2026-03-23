import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { MessageService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { Auth } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { buildBookings, normalizeVehicle } from '../admin-ui.models';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

type DealerMenuItem = { label: string; icon: string; route: string };

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, DrawerModule, ButtonModule, AdminSidebar, AdminTopbar],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private auth = inject(Auth);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  initialized = signal(false);
  role = signal<string | null>(null);
  userInfo = signal<{ email: string; id: string }>({ email: '', id: '' });
  userName = signal('User');
  userLetter = computed(() => this.userName().charAt(0).toUpperCase() || 'U');
  isAdmin = computed(() => this.role() === 'admin');
  mobileSidebarOpen = signal(false);
  menuOpen = signal(false);
  pageTitle = signal('Dashboard');
  pageSearch = signal('');
  notificationCount = signal(5);
  vehiclesCount = signal(0);
  pendingBookingsCount = signal(0);
  breadcrumbItems = signal<MenuItem[]>([]);
  dealerMenuItems = signal<DealerMenuItem[]>([]);
  currentYear = new Date().getFullYear();
  notifications = signal([
    { title: 'Urgent booking pending', detail: 'Booking VMS-0004 is still unassigned.', time: '2 min ago' },
    { title: 'Service due', detail: 'Two vehicles need service approval today.', time: '9 min ago' },
    { title: 'Revenue export ready', detail: 'March revenue export completed successfully.', time: '28 min ago' },
    { title: 'New user registered', detail: 'A corporate account was created from the portal.', time: '41 min ago' },
    { title: 'Maintenance alert', detail: 'Scorpio service window starts in 6 hours.', time: '1 hr ago' },
  ]);

  readonly userMenuItems = computed<MenuItem[]>(() => [
    { label: 'Profile', icon: 'pi pi-user' },
    { label: 'Settings', icon: 'pi pi-cog' },
    { separator: true },
    { label: 'Logout', icon: 'pi pi-sign-out', command: () => this.signOut() },
  ]);

  async ngOnInit() {
    try {
      const [role, user] = await Promise.all([this.auth.getUserRole(), this.auth.getCurrentUser()]);

      this.role.set(role);
      this.userInfo.set({
        email: user?.email || '',
        id: user?.id || '',
      });
      this.userName.set(
        ((user?.user_metadata as Record<string, string> | undefined)?.['full_name']) ||
          user?.email?.split('@')[0] ||
          (role === 'admin' ? 'Admin User' : 'User')
      );

      this.dealerMenuItems.set([
        { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dealer' },
        { label: 'My Bookings', icon: 'pi pi-calendar', route: '/my-bookings' },
        { label: 'Profile', icon: 'pi pi-user', route: '/profile' },
      ]);

      if (role === 'admin') {
        const { data: vehicles } = await this.supabase.getVehicles();
        const { data: bookings } = await this.supabase.getBookings();
        const normalizedVehicles = (vehicles ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
        this.vehiclesCount.set(normalizedVehicles.length);
        this.pendingBookingsCount.set(
          buildBookings(normalizedVehicles, bookings ?? []).filter((booking) => booking.status === 'Pending').length
        );

        this.syncRouteMeta();
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => this.syncRouteMeta());
      }
    } finally {
      this.initialized.set(true);
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 1024) {
      this.mobileSidebarOpen.set(false);
    }
    if (window.innerWidth >= 768) {
      this.menuOpen.set(false);
    }
  }

  toggleSidebar() {
    this.mobileSidebarOpen.set(!this.mobileSidebarOpen());
  }

  closeMobileSidebar() {
    if (window.innerWidth < 1024) {
      this.mobileSidebarOpen.set(false);
    }
  }

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  async navigate(item: DealerMenuItem) {
    this.menuOpen.set(false);
    await this.router.navigateByUrl(item.route);
  }

  onSearchChange(value: string) {
    this.pageSearch.set(value);
  }

  markNotificationsRead() {
    this.notificationCount.set(0);
    this.messageService.add({
      severity: 'success',
      summary: 'Notifications cleared',
      detail: 'All recent notifications were marked as read.',
    });
  }

  private syncRouteMeta() {
    const titleMap: Record<string, string> = {
      '/admin/dashboard': 'Dashboard',
      '/admin/vehicles': 'Vehicles',
      '/admin/bookings': 'Bookings',
      '/admin/users': 'Users',
      '/admin/reports': 'Reports',
      '/admin/analytics': 'Analytics',
      '/admin/audit': 'Audit Log',
    };

    const currentPath = this.router.url.split('?')[0];
    this.pageTitle.set(titleMap[currentPath] || 'Dashboard');

    const pathParts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = pathParts.slice(1).map((part, index) => ({
      label: part.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase()),
      routerLink: `/${pathParts.slice(0, index + 2).join('/')}`,
    }));

    this.breadcrumbItems.set(breadcrumbs);
  }

  async signOut() {
    try {
      await this.supabase.signOut();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      window.location.href = '/login';
    }
  }
}
