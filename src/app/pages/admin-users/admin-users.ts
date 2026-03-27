import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DrawerModule } from 'primeng/drawer';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { buildBookings, normalizeVehicle, tagSeverityForStatus } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    ConfirmDialogModule,
    TableModule,
    TagModule,
    ToastModule,
    ToggleSwitchModule,
    DrawerModule,
    DatePipe,
  ],
  templateUrl: './admin-users.html',
  providers: [MessageService, ConfirmationService],
})
export class AdminUsers {
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  readonly users = signal<any[]>([]);
  readonly filteredUsers = signal<any[]>([]);
  readonly loading = signal(true);
  readonly activeTab = signal(0);
  readonly profileVisible = signal(false);
  readonly selectedUser = signal<any | null>(null);
  readonly profileTab = signal<'details' | 'history' | 'activity'>('details');

  readonly tabs = [
    { label: 'All', role: null },
    { label: 'Admins', role: 'admin' },
    { label: 'Call Center', role: 'callcenter' },
    { label: 'Normal Users', role: 'user' },
  ];

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    const { data: roleRows } = await this.supabase.getAllUserRoles();
    const { data: vehiclesRaw } = await this.supabase.getVehicles();
    const { data: bookingRows } = await this.supabase.getBookings();
    const bookings = buildBookings(
      (vehiclesRaw ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index)),
      bookingRows ?? []
    );

    const users = (roleRows ?? []).map((user, index) => {
      const normalizedRole =
        user.role === 'dealer'
          ? 'user'
          : user.role === 'admin'
            ? 'admin'
            : user.role || (index % 3 === 0 ? 'callcenter' : 'user');

      const userBookings = bookings.filter((booking) => booking.userId === user.user_id);

      return {
        ...user,
        name: user.full_name || `User ${index + 1}`,
        email: user.email || `user${index + 1}@vehicleadmin.io`,
        phone: user.phone || `+91 98${String(76543210 + index).slice(0, 8)}`,
        department: normalizedRole === 'callcenter' ? 'Call Center' : normalizedRole === 'admin' ? 'Operations' : 'Customer',
        joined: new Date(2025, index % 12, 4 + index).toISOString(),
        active: true,
        role: normalizedRole,
        bookingCount: userBookings.length,
        completedCount: userBookings.filter((booking) => booking.status === 'Completed').length,
        cancelledCount: userBookings.filter((booking) => booking.status === 'Cancelled').length,
        pendingCount: userBookings.filter((booking) => booking.status === 'Pending').length,
        recentBookings: userBookings.slice(0, 10),
        activity: [
          { text: 'Updated profile permissions', time: '2 days ago' },
          { text: 'Handled booking escalation', time: '5 days ago' },
          { text: 'Signed in from web dashboard', time: '1 week ago' },
        ],
      };
    });

    this.users.set(users);
    this.loading.set(false);
    this.applyTabFilter();
  }

  countForTab(role: string | null) {
    return this.users().filter((user) => !role || user.role === role).length;
  }

  setTab(index: number) {
    this.activeTab.set(index);
    this.applyTabFilter();
  }

  applyTabFilter() {
    const role = this.tabs[this.activeTab()].role;
    this.filteredUsers.set(this.users().filter((user) => !role || user.role === role));
  }

  roleSeverity(role: string) {
    if (role === 'admin') {
      return 'danger';
    }
    if (role === 'callcenter') {
      return 'warn';
    }
    return 'info';
  }

  bookingStatusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  async toggleRole(row: any) {
    const nextRole = row.role === 'admin' ? 'user' : 'admin';
    await this.supabase.updateUserRole(row.user_id, nextRole === 'user' ? 'dealer' : nextRole);
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: `Role changed to ${nextRole}` });
    await this.loadUsers();
  }

  async toggleActive(user: any, active: boolean) {
    user.active = active;
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: `User ${active ? 'activated' : 'deactivated'} successfully`,
    });
  }

  openProfile(user: any) {
    this.selectedUser.set(user);
    this.profileTab.set('details');
    this.profileVisible.set(true);
  }

  confirmDeactivate(user: any) {
    this.confirmationService.confirm({
      message: `Deactivate ${user.name}?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.toggleActive(user, false),
    });
  }
}
