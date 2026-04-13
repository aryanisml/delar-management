import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { ImageModule } from 'primeng/image';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { normalizeVehicle } from '../../admin-ui.models';
import { Vehicle } from '../../models/vehicle';
import { SupabaseService } from '../../services/supabase';

type BookingDraft = {
  pickup_location: string;
  drop_location: string;
  start_date: Date | null;
  end_date: Date | null;
  purpose: string | null;
  notes: string;
};

@Component({
  selector: 'app-dealer-bookings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    CurrencyPipe,
    DatePickerModule,
    DialogModule,
    ImageModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TextareaModule,
    ToastModule,
    ToolbarModule,
  ],
  templateUrl: './dealer-bookings.html',
  styleUrl: './dealer-bookings.scss',
  providers: [MessageService],
})
export class DealerBookings {
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly dialogVisible = signal(false);
  readonly vehicles = signal<any[]>([]);
  readonly selection = signal<Record<string, number>>({});
  readonly bookingForm = signal<BookingDraft>({
    pickup_location: '',
    drop_location: '',
    start_date: null,
    end_date: null,
    purpose: null,
    notes: '',
  });

  readonly purposeOptions = ['Corporate', 'Event', 'Personal', 'Transfer'].map((label) => ({ label, value: label }));

  readonly selectedVehicles = computed(() =>
    this.vehicles()
      .filter((vehicle) => (this.selection()[vehicle.id] ?? 0) > 0)
      .map((vehicle) => ({ ...vehicle, requestedQty: this.selection()[vehicle.id] }))
  );

  readonly selectedCount = computed(() =>
    this.selectedVehicles().reduce((sum, vehicle) => sum + (vehicle.requestedQty ?? 0), 0)
  );

  readonly estimatedDays = computed(() => {
    const form = this.bookingForm();
    if (!form.start_date || !form.end_date) {
      return 1;
    }

    const diff = new Date(form.end_date).getTime() - new Date(form.start_date).getTime();
    return Math.max(1, Math.ceil(diff / 86400000));
  });

  readonly estimatedCost = computed(() =>
    this.selectedVehicles().reduce(
      (sum, vehicle) => sum + Number(vehicle.daily_rate ?? 0) * (vehicle.requestedQty ?? 0) * this.estimatedDays(),
      0
    )
  );

  async ngOnInit() {
    await this.loadVehicles();
    this.route.queryParamMap.subscribe((params) => {
      const vehicleId = params.get('vehicleId');
      if (vehicleId && this.vehicles().some((vehicle) => vehicle.id === vehicleId)) {
        this.selection.update((current) => ({ ...current, [vehicleId]: Math.max(1, current[vehicleId] ?? 1) }));
      }
    });
  }

  async loadVehicles() {
    this.loading.set(true);
    const { data, error } = await this.supabase.getVehicles();
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Inventory unavailable', detail: error.message || 'Could not load vehicles.' });
      this.vehicles.set([]);
      this.loading.set(false);
      return;
    }

    const vehicles = (data ?? [])
      .map((vehicle, index) => normalizeVehicle(vehicle, index))
      .filter((vehicle) => vehicle.rawStatus !== 'deleted' && vehicle.status === 'Available' && Number(vehicle.stock ?? 0) > 0);

    this.vehicles.set(vehicles);
    this.loading.set(false);
  }

  updateSelection(vehicle: Vehicle, checked: boolean) {
    this.selection.update((current) => {
      const next = { ...current };
      if (checked) {
        next[vehicle.id] = Math.max(1, next[vehicle.id] ?? 1);
      } else {
        delete next[vehicle.id];
      }
      return next;
    });
  }

  updateQuantity(vehicle: Vehicle, quantity: number | null | undefined) {
    const max = Math.max(1, Number(vehicle.stock ?? 1));
    const nextQuantity = Math.min(max, Math.max(0, Number(quantity ?? 0)));
    this.selection.update((current) => {
      const next = { ...current };
      if (nextQuantity <= 0) {
        delete next[vehicle.id];
      } else {
        next[vehicle.id] = nextQuantity;
      }
      return next;
    });
  }

  isSelected(vehicleId: string) {
    return (this.selection()[vehicleId] ?? 0) > 0;
  }

  openSingleBooking() {
    if (!this.selectedVehicles().length && this.vehicles().length) {
      const firstVehicle = this.vehicles()[0];
      this.selection.set({ [firstVehicle.id]: 1 });
    }
    this.dialogVisible.set(true);
  }

  openBulkBooking() {
    this.dialogVisible.set(true);
  }

  bookingInvalid() {
    const form = this.bookingForm();
    return (
      !this.selectedVehicles().length ||
      !form.pickup_location ||
      !form.drop_location ||
      !form.start_date ||
      !form.end_date ||
      !form.purpose ||
      new Date(form.end_date) <= new Date(form.start_date)
    );
  }

  async submitBookingRequest() {
    if (this.bookingInvalid()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete request',
        detail: 'Select at least one vehicle and complete all required booking fields.',
      });
      return;
    }

    const user = await this.supabase.getCurrentUser();
    if (!user) {
      this.messageService.add({ severity: 'warn', summary: 'Session expired', detail: 'Please sign in again.' });
      return;
    }

    this.saving.set(true);
    const form = this.bookingForm();
    const bulkId = crypto.randomUUID();

    for (const vehicle of this.selectedVehicles()) {
      const { error } = await this.supabase.createBooking({
        vehicle_id: vehicle.id,
        user_id: user.id,
        bulk_booking_id: bulkId,
        quantity: vehicle.requestedQty,
        pickup_location: form.pickup_location,
        drop_location: form.drop_location,
        start_date: form.start_date?.toISOString(),
        end_date: form.end_date?.toISOString(),
        purpose: form.purpose ?? '',
        dealer_notes: form.notes,
        status: 'pending',
      });

      if (error) {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Request failed', detail: error.message || 'Could not create booking.' });
        return;
      }
    }

    const { error: bulkError } = await this.supabase.insertBulkBooking({
      id: bulkId,
      dealer_id: user.id,
      total_vehicles: this.selectedCount(),
      notes: form.notes,
    });

    this.saving.set(false);

    if (bulkError) {
      this.messageService.add({ severity: 'error', summary: 'Bulk request failed', detail: bulkError.message || 'Could not save bulk booking.' });
      return;
    }

    await this.supabase.logAudit(`Bulk Booking Created: ${bulkId}`, bulkId);
    this.messageService.add({
      severity: 'success',
      summary: 'Request submitted',
      detail: `${this.selectedCount()} vehicle slots were submitted for approval.`,
    });
    this.selection.set({});
    this.bookingForm.set({
      pickup_location: '',
      drop_location: '',
      start_date: null,
      end_date: null,
      purpose: null,
      notes: '',
    });
    this.dialogVisible.set(false);
    await this.router.navigateByUrl('/dealer/my-bookings');
  }
}
