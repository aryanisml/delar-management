import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AvatarModule,
    BadgeModule,
    BreadcrumbModule,
    ButtonModule,
    InputTextModule,
    MenuModule,
    PopoverModule,
    TooltipModule,
  ],
  templateUrl: './admin-topbar.html',
  styleUrl: './admin-topbar.scss',
})
export class AdminTopbar {
  @Input() title = 'Dashboard';
  @Input() homeRoute = '/admin/dashboard';
  @Input() breadcrumbItems: MenuItem[] = [];
  @Input() searchValue = '';
  @Input() notificationCount = 0;
  @Input() notifications: Array<{ title: string; time: string; detail: string }> = [];
  @Input() userInitials = 'A';
  @Input() userName = 'User';
  @Input() roleLabel = 'Workspace';
  @Input() darkMode = false;
  @Input() userMenuItems: MenuItem[] = [];
  @Output() menuToggle = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() markAllRead = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  badgeValue(count: number) {
    return `${count}`;
  }

  homeItem() {
    return { icon: 'pi pi-home', routerLink: this.homeRoute };
  }
}
