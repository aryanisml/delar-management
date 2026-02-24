import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [CommonModule, TableModule, CardModule],
  templateUrl: './admin-audit-logs.html'
})
export class AdminAuditLogs {

  private supabase = inject(SupabaseService);

  logs = signal<any[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    await this.loadLogs();
  }

  async loadLogs() {
    this.loading.set(true);

    const { data } = await this.supabase.supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    this.logs.set(data ?? []);
    this.loading.set(false);
  }
}
