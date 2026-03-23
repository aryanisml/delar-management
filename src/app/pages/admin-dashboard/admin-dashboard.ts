import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataViewModule } from 'primeng/dataview';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ImageModule } from 'primeng/image';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { SupabaseService } from '../../services/supabase';
import { Vehicle } from '../../models/vehicle';
import { normalizeVehicle, tagSeverityForStatus } from '../../admin-ui.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    ColorPickerModule,
    ConfirmDialogModule,
    DataViewModule,
    DialogModule,
    FileUploadModule,
    FloatLabelModule,
    ImageModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    ProgressBarModule,
    ScrollPanelModule,
    SelectModule,
    SelectButtonModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TextareaModule,
    ToastModule,
    ToolbarModule,
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  providers: [ConfirmationService, MessageService],
})
export class AdminDashboard {
  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  readonly isLoading = signal(true);
  readonly allVehicles = signal<any[]>([]);
  readonly visibleVehicles = signal<any[]>([]);
  readonly totalRecords = signal(0);
  readonly selectedVehicles = signal<any[]>([]);
  readonly dialogVisible = signal(false);
  readonly editMode = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly viewMode = signal<'table' | 'grid'>('table');
  readonly searchTerm = signal('');
  readonly typeFilter = signal<string | null>(null);
  readonly statusFilter = signal<string | null>(null);
  readonly fuelFilter = signal<string | null>(null);
  readonly selectedVehicleId = signal<string | null>(null);
  readonly vehicleForm = signal<any>(this.createEmptyForm());

  readonly vehicleTypes = ['SUV', 'Sedan', 'Truck', 'Van', 'Bus'].map((label) => ({ label, value: label }));
  readonly statusOptions = ['Available', 'Booked', 'Maintenance', 'InService', 'Inactive'].map((label) => ({ label, value: label }));
  readonly fuelTypes = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'].map((label) => ({ label, value: label }));
  readonly viewOptions = [
    { icon: 'pi pi-list', value: 'table' },
    { icon: 'pi pi-th-large', value: 'grid' },
  ];

  readonly filteredVehicles = computed(() =>
    this.allVehicles().filter((vehicle) => {
      const query = this.searchTerm().trim().toLowerCase();
      const matchesSearch =
        !query ||
        `${vehicle.make} ${vehicle.model}`.toLowerCase().includes(query) ||
        vehicle.chassisNumber.toLowerCase().includes(query) ||
        vehicle.registrationNo.toLowerCase().includes(query);
      const matchesType = !this.typeFilter() || vehicle.type === this.typeFilter();
      const matchesStatus = !this.statusFilter() || vehicle.status === this.statusFilter();
      const matchesFuel = !this.fuelFilter() || vehicle.fuel === this.fuelFilter();

      return matchesSearch && matchesType && matchesStatus && matchesFuel;
    })
  );

  async ngOnInit() {
    await this.loadVehicles();
    this.loadVehiclePage({ first: 0, rows: 10 });
  }

  createEmptyForm() {
    return {
      make: '',
      model: '',
      year: 2024,
      registrationNo: '',
      chassisNumber: '',
      type: null,
      fuel: null,
      capacity: 5,
      color: '#1A56DB',
      mileage: 0,
      status: 'Available',
      notes: '',
      imageUrl: '',
      stock: 1,
      dailyRate: 2500,
      location: 'Delhi',
    };
  }

  async loadVehicles() {
    this.isLoading.set(true);
    const { data } = await this.supabase.getVehicles();
    const normalizedVehicles = (data ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
    this.allVehicles.set(normalizedVehicles);
    this.totalRecords.set(normalizedVehicles.length);
    this.isLoading.set(false);
  }

  loadVehiclePage(event: TableLazyLoadEvent) {
    const first = event.first ?? 0;
    const rows = event.rows ?? 10;
    const list = [...this.filteredVehicles()];
    this.totalRecords.set(list.length);
    this.visibleVehicles.set(list.slice(first, first + rows));
  }

  applyFilters() {
    this.loadVehiclePage({ first: 0, rows: this.viewMode() === 'grid' ? 12 : 10 });
  }

  openNew() {
    this.editMode.set(false);
    this.selectedVehicleId.set(null);
    this.vehicleForm.set(this.createEmptyForm());
    this.submitted.set(false);
    this.dialogVisible.set(true);
  }

  openEdit(vehicle: any) {
    this.editMode.set(true);
    this.selectedVehicleId.set(vehicle.id);
    this.vehicleForm.set({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      registrationNo: vehicle.registrationNo,
      chassisNumber: vehicle.chassisNumber,
      type: vehicle.type,
      fuel: vehicle.fuel,
      capacity: vehicle.capacity,
      color: vehicle.color,
      mileage: vehicle.mileage,
      status: vehicle.status,
      notes: vehicle.notes || '',
      imageUrl: vehicle.imageUrl,
      stock: vehicle.stock,
      dailyRate: vehicle.dailyRate,
      location: vehicle.location,
    });
    this.submitted.set(false);
    this.dialogVisible.set(true);
  }

  isInvalid(field: string) {
    const form = this.vehicleForm();
    if (!this.submitted()) {
      return false;
    }

    const value = form[field];
    if (field === 'chassisNumber') {
      return !value || this.hasDuplicateChassis(value);
    }

    return value === null || value === undefined || value === '';
  }

  hasDuplicateChassis(chassis: string) {
    return this.allVehicles().some((vehicle) =>
      vehicle.chassisNumber.toLowerCase() === chassis.toLowerCase() &&
      vehicle.id !== this.selectedVehicleId()
    );
  }

  async saveVehicle() {
    this.submitted.set(true);
    const form = this.vehicleForm();

    if (
      !form.make ||
      !form.model ||
      !form.registrationNo ||
      !form.chassisNumber ||
      !form.type ||
      !form.fuel ||
      !form.status
    ) {
      return;
    }

    if (this.hasDuplicateChassis(form.chassisNumber)) {
      this.messageService.add({ severity: 'warn', summary: 'Notice', detail: 'Chassis number already exists' });
      return;
    }

    this.saving.set(true);

    const payload = {
      brand: form.make,
      make: form.make,
      model: form.model,
      status: form.status === 'Available' ? 'active' : form.status === 'Inactive' ? 'deleted' : 'inactive',
      stock: form.stock,
      daily_rate: form.dailyRate,
      location: form.location,
    };

    let result;
    if (this.editMode() && this.selectedVehicleId()) {
      result = await this.supabase.updateVehicle(this.selectedVehicleId()!, payload);
    } else {
      result = await this.supabase.addVehicle(payload);
    }

    if (result?.error) {
      this.saving.set(false);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: result.error.message || 'Failed to save vehicle',
      });
      return;
    }

    if (this.editMode() && this.selectedVehicleId()) {
      await this.supabase.logAudit(`Vehicle Updated: ${form.make} ${form.model}`);
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Vehicle updated successfully' });
    } else {
      await this.supabase.logAudit(`Vehicle Created: ${form.make} ${form.model}`);
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Vehicle created successfully' });
    }

    this.saving.set(false);
    this.dialogVisible.set(false);
    await this.loadVehicles();
    this.applyFilters();
  }

  confirmDelete(vehicle: any) {
    this.confirmationService.confirm({
      message: `Delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await this.supabase.updateVehicle(vehicle.id, { status: 'deleted' });
        await this.supabase.logAudit(`Vehicle Archived: ${vehicle.make} ${vehicle.model}`);
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Vehicle archived successfully' });
        await this.loadVehicles();
        this.applyFilters();
      },
    });
  }

  confirmBulkDelete() {
    const selected = this.selectedVehicles();
    if (!selected.length) {
      return;
    }

    this.confirmationService.confirm({
      message: `Delete ${selected.length} selected vehicles? This cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        for (const vehicle of selected) {
          await this.supabase.updateVehicle(vehicle.id, { status: 'deleted' });
        }
        this.selectedVehicles.set([]);
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Selected vehicles archived successfully' });
        await this.loadVehicles();
        this.applyFilters();
      },
    });
  }

  copyChassis(value: string) {
    navigator.clipboard.writeText(value);
    this.messageService.add({ severity: 'success', summary: 'Copied', detail: 'Chassis number copied' });
  }

  updateImageUrl(event: any) {
    const file = event.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.vehicleForm.set({ ...this.vehicleForm(), imageUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  fillRateClass(value: number) {
    if (value > 80) {
      return 'fill-rate--high';
    }
    if (value >= 50) {
      return 'fill-rate--medium';
    }
    return 'fill-rate--low';
  }
}
