import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, DatePipe, DatePickerModule, InputTextModule, TableModule],
  templateUrl: './admin-audit-logs.html',
})
export class AdminAuditLogs {
  private supabase = inject(SupabaseService);

  readonly logs = signal<any[]>([]);
  readonly loading = signal(true);
  readonly dateRange = signal<Date[] | null>(null);
  readonly userFilter = signal('');
  readonly actionSearch = signal('');

  readonly filteredLogs = computed(() =>
    this.logs().filter((row) => {
      const query = this.actionSearch().trim().toLowerCase();
      const userQuery = this.userFilter().trim().toLowerCase();
      const createdAt = new Date(row.created_at || '');
      const [start, end] = this.dateRange() ?? [];
      const withinRange = !start || !end || (createdAt >= start && createdAt <= end);
      const matchesUser = !userQuery || String(row.user_id || '').toLowerCase().includes(userQuery);
      const matchesAction = !query || String(row.action || '').toLowerCase().includes(query);
      return withinRange && matchesUser && matchesAction;
    })
  );

  async ngOnInit() {
    await this.loadLogs();
  }

  async loadLogs() {
    this.loading.set(true);
    const [{ data: logs }, { data: roles }] = await Promise.all([this.supabase.getAuditLogs(), this.supabase.getAllUserRoles()]);
    const roleMap = new Map((roles ?? []).map((role: any) => [role.user_id, role.role]));
    this.logs.set((logs ?? []).map((row: any) => ({ ...row, role: roleMap.get(row.user_id) || '-' })));
    this.loading.set(false);
  }

  exportLogs() {
    const rows = this.filteredLogs().map((row) => ({
      timestamp: row.created_at,
      user_id: row.user_id,
      role: row.role || '',
      action: row.action,
      entity_id: row.entity_id || '',
    }));
    const headers = Object.keys(rows[0] ?? { timestamp: '', user_id: '', role: '', action: '', entity_id: '' });
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header as keyof typeof row] ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-logs.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
