import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';
import { Vehicle } from '../../models/vehicle';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { StepperModule } from 'primeng/stepper';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    ToolbarModule,
    InputTextModule,
    DialogModule,
    InputNumberModule,
    SelectModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    StepperModule
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  providers: [ConfirmationService, MessageService]
})
export class AdminDashboard {

  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  vehicles = signal<Vehicle[]>([]);
  loading = signal<boolean>(true);

  filter = signal<string>('');
  statusFilter = signal<'all' | 'active' | 'inactive' | 'deleted'>('all');

  dialogVisible = signal<boolean>(false);
  editMode = signal<boolean>(false);

  selectedVehicleId = signal<string | null>(null);
  workflowStep = signal(1);

  newVehicle: any = this.resetVehicle();

  readonly statusFilterOptions = [
    { label: 'All Fleet', value: 'all', icon: 'pi pi-th-large' },
    { label: 'Ready', value: 'active', icon: 'pi pi-check-circle' },
    { label: 'Paused', value: 'inactive', icon: 'pi pi-pause-circle' },
    { label: 'Archived', value: 'deleted', icon: 'pi pi-inbox' }
  ] as const;

  setWorkflowStep(step?: number) {
    this.workflowStep.set(step ?? 1);
  }

  statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ];

  // ===============================
  // FILTER LOGIC
  // ===============================

  filteredVehicles = computed(() => {
    let list = this.vehicles();

    const status = this.statusFilter();
    if (status !== 'all') {
      list = list.filter(v => (v as any)['status'] === status);
    }

    const q = this.filter().toLowerCase();
    if (q) {
      list = list.filter(v =>
        (v.brand ?? '').toLowerCase().includes(q) ||
        (v.model ?? '').toLowerCase().includes(q)
      );
    }

    return list;
  });

  async ngOnInit() {
    await this.loadVehicles();
  }

  async loadVehicles() {
    this.loading.set(true);
    const { data } = await this.supabase.getVehicles();
    this.vehicles.set(data ?? []);
    this.loading.set(false);
  }

  // ===============================
  // VEHICLE FORM HANDLING
  // ===============================

  resetVehicle() {
    return {
      brand: '',
      make: '',
      model: '',
      stock: 0,
      daily_rate: 0,
      location: '',
      status: 'active'
    };
  }

  openNew() {
    this.editMode.set(false);
    this.newVehicle = this.resetVehicle();
    this.dialogVisible.set(true);
  }

  openEdit(vehicle: Vehicle) {
    this.editMode.set(true);
    this.selectedVehicleId.set(vehicle.id);
    this.newVehicle = { ...vehicle };
    this.dialogVisible.set(true);
  }

  async saveVehicle() {

    if (!this.newVehicle.brand) return;

    if (this.editMode()) {
      await this.supabase.updateVehicle(
        this.selectedVehicleId()!,
        this.newVehicle
      );

      await this.supabase.logAudit('Vehicle Updated');

      this.messageService.add({
        severity: 'success',
        summary: 'Vehicle Updated'
      });

    } else {

      await this.supabase.addVehicle(this.newVehicle);

      await this.supabase.logAudit('Vehicle Created');

      this.messageService.add({
        severity: 'success',
        summary: 'Vehicle Added'
      });
    }

    this.dialogVisible.set(false);
    await this.loadVehicles();
  }

  confirmDelete(vehicle: Vehicle) {
    this.confirmationService.confirm({
      message: 'Archive this vehicle?',
      accept: async () => {

        await this.supabase.updateVehicle(vehicle.id, { status: 'deleted' });
        await this.supabase.logAudit('Vehicle Archived');

        this.messageService.add({
          severity: 'warn',
          summary: 'Vehicle Archived'
        });

        await this.loadVehicles();
      }
    });
  }

  async restoreVehicle(vehicle: Vehicle) {
    await this.supabase.updateVehicle(vehicle.id, { status: 'active' });
    await this.supabase.logAudit('Vehicle Restored');

    this.messageService.add({
      severity: 'success',
      summary: 'Vehicle Restored'
    });

    await this.loadVehicles();
  }

  async deactivateVehicle(vehicle: Vehicle) {
    await this.supabase.updateVehicle(vehicle.id, { status: 'inactive' });
    await this.supabase.logAudit('Vehicle Deactivated');

    this.messageService.add({
      severity: 'warn',
      summary: 'Vehicle Deactivated'
    });

    await this.loadVehicles();
  }

  async activateVehicle(vehicle: Vehicle) {
    await this.supabase.updateVehicle(vehicle.id, { status: 'active' });
    await this.supabase.logAudit('Vehicle Activated');

    this.messageService.add({
      severity: 'success',
      summary: 'Vehicle Activated'
    });

    await this.loadVehicles();
  }
}
