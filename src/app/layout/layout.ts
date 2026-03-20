import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';

type MenuItem = { label: string; icon?: string; route?: string };

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MenubarModule, ButtonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private auth = inject(Auth);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  // --- Identity Signals ---
  role = signal<string | null>(null);
  userInfo = signal<{ email: string }>({ email: 'Loading...' });
  
  // --- Derived Identity ---
  userName = computed(() => {
    const email = this.userInfo().email;
    return email === 'Loading...' ? 'User' : email.split('@')[0];
  });
  
  userLetter = computed(() => this.userName()[0]?.toUpperCase() || 'U');

  menuOpen = signal<boolean>(false);
  menuItems = signal<MenuItem[]>([]);
  currentYear = new Date().getFullYear();

  async ngOnInit() {
    // 1. Fetch Role and User Data
    const [r, user] = await Promise.all([
      this.auth.getUserRole(),
      this.supabase.getCurrentUser()
    ]);

    this.role.set(r);
    if (user) {
      this.userInfo.set({ email: user.email || '' });
    }

    // 2. Define Menus
    const adminMenu: MenuItem[] = [
      { label: 'Overview', icon: 'pi pi-home', route: '/admin' },
      { label: 'Vehicles', icon: 'pi pi-car', route: '/admin' },
      { label: 'Dealers', icon: 'pi pi-briefcase', route: '/admin' },
      { label: 'Users', icon: 'pi pi-users', route: '/admin' },
      { label: 'Settings', icon: 'pi pi-cog', route: '/admin' }
    ];

    const userMenu: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dealer' },
      { label: 'Vehicles', icon: 'pi pi-car', route: '/dealer' },
      { label: 'My Bookings', icon: 'pi pi-calendar', route: '/my-bookings' },
      { label: 'Profile', icon: 'pi pi-user', route: '/profile' }
    ];

    this.menuItems.set(r === 'admin' ? adminMenu : userMenu);
  }

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  async navigate(item: MenuItem) {
    this.menuOpen.set(false);
    if (item.route) await this.router.navigateByUrl(item.route);
  }

  async signOut() {
  try {
    // If your service has the internal client public:
    await this.supabase.supabase.auth.signOut(); 
    this.router.navigate(['/login']);
  } catch (error) {
    window.location.href = '/login';
  }
}
}