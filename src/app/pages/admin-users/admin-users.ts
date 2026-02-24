import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    CardModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule
  ],
  templateUrl: './admin-users.html',
  providers: [MessageService, ConfirmationService]
})
export class AdminUsers {

  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  users = signal<any[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    const { data } = await this.supabase.getAllUserRoles();
    this.users.set(data ?? []);
    this.loading.set(false);
  }

  async toggleRole(row: any) {

    this.confirmationService.confirm({
      message: `Change role of this user?`,
      accept: async () => {

        const admins = this.users().filter(u => u.role === 'admin');

        if (row.role === 'admin' && admins.length <= 1) {
          this.messageService.add({
            severity: 'error',
            summary: 'Cannot remove last admin'
          });
          return;
        }

        const newRole = row.role === 'admin' ? 'dealer' : 'admin';

        await this.supabase.updateUserRole(row.user_id, newRole);

        this.messageService.add({
          severity: 'success',
          summary: `Role changed to ${newRole}`
        });

        await this.loadUsers();
      }
    });
  }
}
