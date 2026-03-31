import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DataViewModule } from 'primeng/dataview';
import { ImageModule } from 'primeng/image';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { normalizeVehicle, tagSeverityForStatus } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-dealer-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DataViewModule,
    ImageModule,
    InputTextModule,
    SelectButtonModule,
    SelectModule,
    TableModule,
    TagModule,
    ToastModule,
    ToolbarModule,
  ],
  templateUrl: './dealer-inventory.html',
  styleUrl: './dealer-inventory.scss',
  providers: [MessageService],
})
export class DealerInventory {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly vehicles = signal<any[]>([]);
  readonly search = signal('');
  readonly typeFilter = signal<string | null>(null);
  readonly statusFilter = signal<string | null>(null);
  readonly viewMode = signal<'table' | 'grid'>('table');

  readonly typeOptions = ['SUV', 'Sedan', 'Truck', 'Van', 'Bus'].map((label) => ({ label, value: label }));
  readonly statusOptions = ['Available', 'Maintenance', 'Inactive'].map((label) => ({ label, value: label }));
  readonly viewOptions = [
    { icon: 'pi pi-list', value: 'table' },
    { icon: 'pi pi-th-large', value: 'grid' },
  ];

  readonly filteredVehicles = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.vehicles().filter((vehicle) => {
      const matchesSearch =
        !query ||
        `${vehicle.make} ${vehicle.model}`.toLowerCase().includes(query) ||
        String(vehicle.registrationNo || '').toLowerCase().includes(query) ||
        String(vehicle.location || '').toLowerCase().includes(query);
      const matchesType = !this.typeFilter() || vehicle.type === this.typeFilter();
      const matchesStatus = !this.statusFilter() || vehicle.status === this.statusFilter();
      return matchesSearch && matchesType && matchesStatus;
    });
  });

  async ngOnInit() {
    const { data, error } = await this.supabase.getVehicles();
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Inventory unavailable', detail: error.message || 'Could not load inventory.' });
      this.loading.set(false);
      return;
    }

    this.vehicles.set((data ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index)).filter((vehicle) => vehicle.rawStatus !== 'deleted'));
    this.loading.set(false);
  }

  exportCsv() {
    const rows = this.filteredVehicles().map((vehicle) => ({
      vehicle: `${vehicle.make} ${vehicle.model}`,
      type: vehicle.type,
      capacity: vehicle.capacity,
      dailyRate: vehicle.dailyRate,
      location: vehicle.location,
      status: vehicle.status,
      stock: vehicle.stock,
    }));
    const headers = Object.keys(rows[0] ?? { vehicle: '', type: '', capacity: '', dailyRate: '', location: '', status: '', stock: '' });
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header as keyof typeof row] ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dealer-inventory.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  bookVehicle(vehicleId: string) {
    this.router.navigate(['/dealer/bookings'], { queryParams: { vehicleId } });
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }
}
