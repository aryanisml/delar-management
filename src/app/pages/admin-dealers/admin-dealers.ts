import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-dealers',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    CardModule,
    TagModule,
    ToastModule
  ],
  templateUrl: './admin-dealers.html',
  providers: [MessageService]
})
export class AdminDealers {

  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);

  users = signal<any[]>([]);
  loading = signal<boolean>(true);

  dealers = computed(() =>
    this.users().filter(u => u.role === 'dealer')
  );

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    const { data } = await this.supabase.getAllUserRoles();
    this.users.set(data ?? []);
    this.loading.set(false);
  }

  async promote(userId: string) {
    await this.supabase.updateUserRole(userId, 'admin');
    this.messageService.add({ severity: 'success', summary: 'Promoted to Admin' });
    await this.loadUsers();
  }
}
