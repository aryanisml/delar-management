import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { SupabaseService } from '../../../services/supabase';

@Component({
  selector: 'app-inspection-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    MessageModule,
    ProgressSpinnerModule,
    RadioButtonModule,
    TagModule,
    ToastModule,
  ],
  templateUrl: './inspection-placeholder.component.html',
  styleUrl: './inspection-placeholder.component.scss',
  providers: [MessageService],
})
export class InspectionPlaceholderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);

  readonly bookingId = this.route.snapshot.paramMap.get('bookingId') || '';

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly notReady = signal(false);
  readonly booking = signal<any>(null);
  readonly quotation = signal<any>(null);
  readonly customer = signal<any>(null);
  readonly vehicle = signal<any>(null);

  // Section 1 — Driver Verification
  readonly licenseNumber = signal('');
  readonly licenseExpiry = signal('');
  readonly licenseVerified = signal(false);

  // Section 2 — Vehicle Condition
  readonly odometerReading = signal<number | null>(null);
  readonly fuelLevel = signal('Full');
  readonly tyreCondition = signal('Good');
  readonly bodyCondition = signal('Clean');
  readonly interiorCondition = signal('Clean');
  readonly damageNotes = signal('');
  readonly photoPreviews = signal<Record<string, string | null>>({ front: null, back: null, left: null, right: null });

  // Section 3 — Handover
  readonly additionalNotes = signal('');
  readonly customerAcknowledged = signal(false);

  readonly vehicleName = computed(() => {
    const v = this.vehicle();
    return v ? `${v.brand || v.make || ''} ${v.model || ''}`.trim() : 'Vehicle';
  });

  readonly quoteReference = computed(() => this.quotation()?.quote_reference || '-');

  readonly isLicenseExpired = computed(() => {
    const expiry = this.licenseExpiry();
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  });

  readonly fuelLevelOptions = [
    { label: 'Full', value: 'Full' },
    { label: 'Three-Quarter', value: 'Three-Quarter' },
    { label: 'Half', value: 'Half' },
    { label: 'Quarter', value: 'Quarter' },
    { label: 'Empty', value: 'Empty' },
  ];

  async ngOnInit() {
    if (!this.bookingId) {
      await this.router.navigateByUrl('/dealer/my-bookings');
      return;
    }

    this.loading.set(true);

    const { data: booking } = await this.supabase.getBookingById(this.bookingId);

    if (!booking || booking.status !== 'in_service') {
      this.notReady.set(true);
      this.loading.set(false);
      return;
    }

    this.booking.set(booking);

    const [quotationResult, customerResult, vehicleResult] = await Promise.all([
      this.supabase.getQuotationByBooking(this.bookingId),
      this.supabase.getCustomerById(booking.customer_id),
      this.supabase.getVehicleById(booking.vehicle_id),
    ]);

    this.quotation.set(quotationResult.data ?? null);
    this.customer.set(customerResult.data ?? null);
    this.vehicle.set(vehicleResult.data ?? null);

    const c = customerResult.data;
    if (c) {
      this.licenseNumber.set(c.license_no || '');
      this.licenseExpiry.set(c.license_expiry || '');
    }

    this.loading.set(false);
  }

  onPhotoSelected(side: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    this.photoPreviews.update(prev => ({ ...prev, [side]: url }));
  }

  triggerPhotoUpload(side: string) {
    document.getElementById(`photo-${side}`)?.click();
  }

  async submitInspection() {
    if (!this.licenseVerified()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please verify the customer licence.' });
      return;
    }
    if (!this.odometerReading() || this.odometerReading()! <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please enter a valid odometer reading.' });
      return;
    }
    if (!this.customerAcknowledged()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Customer must review and agree before handover.' });
      return;
    }

    const booking = this.booking();
    const currentUser = await this.supabase.getCurrentUser();

    this.submitting.set(true);

    try {
      const { error: inspError } = await this.supabase.createInspection({
        booking_id: booking.id,
        vehicle_id: booking.vehicle_id,
        customer_id: booking.customer_id,
        inspector_id: currentUser?.id ?? null,
        odometer_reading: this.odometerReading(),
        fuel_level: this.fuelLevel(),
        tyre_condition: this.tyreCondition(),
        body_condition: this.bodyCondition(),
        interior_condition: this.interiorCondition(),
        damage_notes: this.damageNotes() || null,
        special_remarks: this.additionalNotes() || null,
        license_verified: this.licenseVerified(),
        customer_acknowledged: this.customerAcknowledged(),
        inspection_type: 'checkout',
        status: 'completed',
      });

      if (inspError) throw new Error((inspError as any).message || 'Failed to save inspection.');

      const { error: vehicleError } = await this.supabase.updateVehicleForTrip(booking.vehicle_id, this.odometerReading()!);
      if (vehicleError) throw new Error((vehicleError as any).message || 'Failed to update vehicle status.');

      this.messageService.add({ severity: 'success', summary: 'Vehicle handed over', detail: 'Trip is now In Service.' });
      await new Promise(r => setTimeout(r, 1400));
      await this.router.navigateByUrl('/dealer/my-bookings');
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Submission failed', detail: err?.message || 'An error occurred. Please try again.' });
      this.submitting.set(false);
    }
  }

  async backToBookings() {
    await this.router.navigateByUrl('/dealer/my-bookings');
  }
}
