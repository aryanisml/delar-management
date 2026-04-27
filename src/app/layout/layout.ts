import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { MessageService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { Auth } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { ThemeService } from '../services/theme';
import { buildBookings, normalizeVehicle } from '../admin-ui.models';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

type DealerMenuItem = { section: string; label: string; icon: string; route: string };

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
  readonly theme = inject(ThemeService);

  initialized = signal(false);
  role = signal<string | null>(null);
  userInfo = signal<{ email: string; id: string }>({ email: '', id: '' });
  userName = signal('User');
  userLetter = computed(() => this.userName().charAt(0).toUpperCase() || 'U');
  isAdmin = computed(() => this.role() === 'admin' || this.role() === 'superadmin');
  portalLabel = computed(() => {
    const role = String(this.role() || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin') {
      return 'Admin Portal';
    }
    if (role === 'dealer' || role === 'rental_advisor') {
      return 'Dealer Portal';
    }
    return 'Rental Organizer';
  });
  topbarRoleLabel = computed(() => {
    const role = String(this.role() || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin') {
      return 'Fleet Manager';
    }
    if (role === 'dealer' || role === 'rental_advisor') {
      return 'Rental Advisor';
    }
    return 'Operations Workspace';
  });
  sidebarBrandSubtitle = computed(() => {
    const role = String(this.role() || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin') {
      return 'Command Center';
    }
    if (role === 'rental_advisor') {
      return 'Booking Console';
    }
    if (role === 'dealer') {
      return 'Fleet Operations';
    }
    return 'Your Vehicles Dashboard';
  });
  mobileSidebarOpen = signal(false);
  desktopSidebarCollapsed = signal(false);
  menuOpen = signal(false);
  pageTitle = signal('Dashboard');
  pageSearch = signal('');
  notificationCount = signal(5);
  vehiclesCount = signal(0);
  pendingBookingsCount = signal(0);
  breadcrumbItems = signal<MenuItem[]>([]);
  homeRoute = computed(() => (this.isAdmin() ? '/admin/dashboard' : '/dealer/dashboard'));
  dealerMenuItems = signal<DealerMenuItem[]>([]);
  currentYear = new Date().getFullYear();
  notifications = signal<any[]>([]);
  private notificationChannel: any = null;

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
        { section: 'DASHBOARD', label: 'Dashboard', icon: 'pi pi-th-large', route: '/dealer/dashboard' },
        { section: 'DASHBOARD', label: 'Book Vehicles', icon: 'pi pi-calendar-plus', route: '/dealer/bookings' },
        { section: 'DASHBOARD', label: 'My Bookings', icon: 'pi pi-calendar', route: '/dealer/my-bookings' },
        { section: 'DASHBOARD', label: 'Fleet Inventory', icon: 'pi pi-car', route: '/dealer/inventory' },
        { section: 'DASHBOARD', label: 'Analytics', icon: 'pi pi-chart-line', route: '/dealer/analytics' },
        { section: 'OTHERS', label: 'Profile', icon: 'pi pi-user', route: '/profile' },
      ]);

      const { data: vehicles } = await this.supabase.getVehicles();
      const { data: bookings } = await this.supabase.getBookings();
      const normalizedVehicles = (vehicles ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
      this.vehiclesCount.set(normalizedVehicles.length);
      this.pendingBookingsCount.set(
        buildBookings(normalizedVehicles, bookings ?? []).filter((booking) => booking.status === 'Pending').length
      );

      await this.loadNotifications();
      if (user?.id) {
        this.notificationChannel = this.supabase.subscribeToNotifications(user.id, () => {
          void this.loadNotifications();
        });
      }

      this.syncRouteMeta();
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => this.syncRouteMeta());
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
    if (window.innerWidth >= 1024) {
      this.desktopSidebarCollapsed.set(!this.desktopSidebarCollapsed());
      return;
    }

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
    if (this.userInfo().id) {
      void this.supabase.markNotificationsRead(this.userInfo().id).then(() => this.loadNotifications());
    }
    this.messageService.add({
      severity: 'success',
      summary: 'Notifications cleared',
      detail: 'All recent notifications were marked as read.',
    });
  }

  async openNotification(notification: any) {
    if (notification.id) {
      await this.supabase.markNotificationRead(notification.id);
    }
    await this.loadNotifications();
    if (notification.booking_id) {
      await this.router.navigateByUrl(this.isAdmin() ? '/admin/bookings' : '/dealer/my-bookings');
    }
  }

  async loadNotifications() {
    const { data: notifications, error } = await this.supabase.getMyNotifications();
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Notifications unavailable', detail: error.message || 'Could not load notifications.' });
      return;
    }

    this.notifications.set(
      (notifications ?? []).map((item: any) => ({
        id: item.id,
        title: item.title,
        detail: item.message,
        type: item.type,
        booking_id: item.booking_id,
        time: this.relativeTime(item.created_at),
      }))
    );
    this.notificationCount.set((notifications ?? []).length);
  }

  ngOnDestroy() {
    if (this.notificationChannel) {
      this.supabase.supabase.removeChannel(this.notificationChannel);
    }
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
      '/dealer': 'Dashboard',
      '/dealer/dashboard': 'Dashboard',
      '/dealer/bookings': 'Book Vehicles',
      '/dealer/my-bookings': 'My Bookings',
      '/dealer/inventory': 'Fleet Inventory',
      '/dealer/analytics': 'Analytics',
      '/dealer/booking': 'Booking Flow',
      '/profile': 'Profile',
    };

    const currentPath = this.router.url.split('?')[0];
    this.pageTitle.set(titleMap[currentPath] || (currentPath.includes('/quotation') ? 'Quotation' : currentPath.includes('/payments') ? 'Payments' : 'Dashboard'));

    const pathParts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = pathParts.slice(1).map((part, index) => ({
      label: part.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase()),
      routerLink: `/${pathParts.slice(0, index + 2).join('/')}`,
    }));

    this.breadcrumbItems.set(breadcrumbs);
  }

  private relativeTime(value: string) {
    if (!value) {
      return 'Just now';
    }
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hr ago`;
    }
    return `${Math.floor(hours / 24)} days ago`;
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
