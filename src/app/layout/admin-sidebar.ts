import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';

interface SidebarItem {
  label: string;
  icon: string;
  route?: string;
  badge?: string;
  section: string;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, AvatarModule, BadgeModule, ButtonModule],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.scss',
})
export class AdminSidebar {
  @Input() roleLabel = 'Administrator';
  @Input() userName = 'Admin User';
  @Input() pendingBookingsCount = 0;
  @Input() vehicleCount = 0;
  @Input() items: SidebarItem[] | null = null;
  @Output() linkClick = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  readonly nav: SidebarItem[] = [
    { section: 'MAIN MENU', label: 'Dashboard', icon: 'pi pi-home', route: '/admin/dashboard' },
    { section: 'MANAGEMENT', label: 'Vehicles', icon: 'pi pi-car', route: '/admin/vehicles' },
    { section: 'MANAGEMENT', label: 'Bookings', icon: 'pi pi-calendar', route: '/admin/bookings' },
    { section: 'MANAGEMENT', label: 'Users', icon: 'pi pi-users', route: '/admin/users' },
    { section: 'MANAGEMENT', label: 'Schedule', icon: 'pi pi-calendar-plus' },
    { section: 'CALL CENTER', label: 'Assignments', icon: 'pi pi-send' },
    { section: 'CALL CENTER', label: 'Availability', icon: 'pi pi-check-square' },
    { section: 'ANALYTICS', label: 'Reports', icon: 'pi pi-chart-bar', route: '/admin/reports' },
    { section: 'ANALYTICS', label: 'Analytics', icon: 'pi pi-chart-line', route: '/admin/analytics' },
    { section: 'SYSTEM', label: 'Settings', icon: 'pi pi-cog' },
    { section: 'SYSTEM', label: 'Audit Log', icon: 'pi pi-list', route: '/admin/audit' },
  ];

  sidebarItems() {
    return this.items?.length ? this.items : this.nav;
  }

  sections() {
    return [...new Set(this.sidebarItems().map((item) => item.section))];
  }

  getBadge(item: SidebarItem) {
    if (item.label === 'Vehicles') {
      return String(this.vehicleCount);
    }

    if (item.label === 'Bookings') {
      return String(this.pendingBookingsCount);
    }

    return item.badge;
  }

  onLinkClick() {
    this.linkClick.emit();
  }
}
