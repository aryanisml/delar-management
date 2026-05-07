import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SupabaseService } from '../../../services/supabase';

type PhotoKey = 'frontView' | 'backView' | 'leftSide' | 'rightSide';

type InspectionFormState = {
  licenceNumber: string;
  licenceExpiry: string;
  licenceVerified: boolean;
  odometerReading: number | null;
  fuelLevel: string | null;
  tyreCondition: string | null;
  bodyCondition: string | null;
  interiorCondition: string | null;
  damageNotes: string;
  additionalNotes: string;
  customerAcknowledged: boolean;
};

@Component({
  selector: 'app-inspection-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    SelectModule,
    TextareaModule,
    ToastModule,
  ],
  templateUrl: './inspection-placeholder.component.html',
  styleUrl: './inspection-placeholder.component.scss',
  providers: [MessageService],
})
export class InspectionPlaceholderComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);

  readonly bookingId = this.route.snapshot.paramMap.get('bookingId') || '';
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly bookingReady = signal(false);
  readonly booking = signal<any | null>(null);
  readonly quotation = signal<any | null>(null);
  readonly customer = signal<any | null>(null);
  readonly vehicle = signal<any | null>(null);
  readonly payment = signal<any | null>(null);
  readonly notReadyMessage = signal('This booking is not ready for inspection. Please ensure it is approved and payment is complete.');
  readonly photoPreviews = signal<Record<PhotoKey, string | null>>({
    frontView: null,
    backView: null,
    leftSide: null,
    rightSide: null,
  });
  readonly photoFileNames = signal<Record<PhotoKey, string>>({
    frontView: '',
    backView: '',
    leftSide: '',
    rightSide: '',
  });
  readonly form = signal<InspectionFormState>({
    licenceNumber: '',
    licenceExpiry: '',
    licenceVerified: false,
    odometerReading: null,
    fuelLevel: null,
    tyreCondition: null,
    bodyCondition: null,
    interiorCondition: null,
    damageNotes: '',
    additionalNotes: '',
    customerAcknowledged: false,
  });

  readonly fuelOptions = [
    { label: 'Full', value: 'Full' },
    { label: 'Three-Quarter', value: 'Three-Quarter' },
    { label: 'Half', value: 'Half' },
    { label: 'Quarter', value: 'Quarter' },
    { label: 'Empty', value: 'Empty' },
  ];
  readonly tyreOptions = ['Good', 'Fair', 'Needs Attention'];
  readonly bodyOptions = ['Clean', 'Minor Scratches', 'Visible Damage'];
  readonly interiorOptions = ['Clean', 'Stained', 'Damaged'];
  readonly photoSlots: Array<{ key: PhotoKey; label: string }> = [
    { key: 'frontView', label: 'Front View' },
    { key: 'backView', label: 'Back View' },
    { key: 'leftSide', label: 'Left Side' },
    { key: 'rightSide', label: 'Right Side' },
  ];

  readonly licenceExpired = computed(() => {
    const expiry = this.form().licenceExpiry;
    if (!expiry) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(`${expiry}T00:00:00`);
    expiryDate.setHours(0, 0, 0, 0);
    return expiryDate.getTime() <= today.getTime();
  });

  readonly handoverSummary = computed(() => ({
    fuelLevel: this.form().fuelLevel || '-',
    odometerReading: this.form().odometerReading ? `${this.form().odometerReading} km` : '-',
    bodyCondition: this.form().bodyCondition || '-',
  }));

  async ngOnInit() {
    if (!this.bookingId) {
      this.loading.set(false);
      this.bookingReady.set(false);
      return;
    }

    await this.loadInspectionContext();
  }

  ngOnDestroy() {
    for (const url of Object.values(this.photoPreviews())) {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }

  async backToBookings() {
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  updateForm<K extends keyof InspectionFormState>(field: K, value: InspectionFormState[K]) {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  onPhotoSelected(slot: PhotoKey, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const currentPreview = this.photoPreviews()[slot];
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    this.photoPreviews.update((current) => ({ ...current, [slot]: previewUrl }));
    this.photoFileNames.update((current) => ({ ...current, [slot]: file.name }));
  }

  invalid(field: keyof InspectionFormState) {
    return this.submitted() && Boolean(this.fieldError(field));
  }

  fieldError(field: keyof InspectionFormState) {
    const form = this.form();

    switch (field) {
      case 'licenceVerified':
        return form.licenceVerified ? '' : 'Licence verification is required before handover.';
      case 'odometerReading':
        return Number(form.odometerReading ?? 0) > 0 ? '' : 'Enter an odometer reading greater than 0.';
      case 'fuelLevel':
        return form.fuelLevel ? '' : 'Select the current fuel level.';
      case 'tyreCondition':
        return form.tyreCondition ? '' : 'Select the tyre condition.';
      case 'bodyCondition':
        return form.bodyCondition ? '' : 'Select the body condition.';
      case 'interiorCondition':
        return form.interiorCondition ? '' : 'Select the interior condition.';
      case 'customerAcknowledged':
        return form.customerAcknowledged ? '' : 'Customer acknowledgement is required before handover.';
      default:
        return '';
    }
  }

  async submitInspection() {
    this.submitted.set(true);

    const requiredFields: Array<keyof InspectionFormState> = [
      'licenceVerified',
      'odometerReading',
      'fuelLevel',
      'tyreCondition',
      'bodyCondition',
      'interiorCondition',
      'customerAcknowledged',
    ];

    if (requiredFields.some((field) => Boolean(this.fieldError(field)))) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Check inspection form',
        detail: 'Please resolve the highlighted fields before completing handover.',
      });
      return;
    }

    const currentUser = await this.supabase.getCurrentUser();
    if (!currentUser?.id) {
      this.messageService.add({
        severity: 'error',
        summary: 'Session expired',
        detail: 'Please sign in again before submitting the inspection.',
      });
      return;
    }

    const booking = this.booking();
    if (!booking?.id || !booking?.vehicle_id || !booking?.customer_id) {
      this.messageService.add({
        severity: 'error',
        summary: 'Booking unavailable',
        detail: 'Booking, customer, or vehicle details are missing for this inspection.',
      });
      return;
    }

    this.submitting.set(true);
    const form = this.form();
    const result = await this.supabase.completeCheckoutInspection({
      bookingId: booking.id,
      vehicleId: booking.vehicle_id,
      customerId: booking.customer_id,
      inspectorId: currentUser.id,
      odometerReading: Number(form.odometerReading ?? 0),
      fuelLevel: form.fuelLevel || '',
      tyreCondition: form.tyreCondition || '',
      bodyCondition: form.bodyCondition || '',
      interiorCondition: form.interiorCondition || '',
      damageNotes: form.damageNotes.trim() || null,
      specialRemarks: form.additionalNotes.trim() || null,
      licenceVerified: form.licenceVerified,
      customerAcknowledged: form.customerAcknowledged,
    });
    this.submitting.set(false);

    if (result.error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Inspection failed',
        detail: (result.error as any)?.message || 'Could not complete the handover.',
      });
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Handover complete',
      detail: 'Vehicle handed over. Trip is now In Service.',
    });
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  private async loadInspectionContext() {
    this.loading.set(true);
    const { data, error } = await this.supabase.getInspectionBookingContext(this.bookingId);
    this.loading.set(false);

    if (error || !data?.booking) {
      this.bookingReady.set(false);
      this.notReadyMessage.set('This booking is not ready for inspection. Please ensure it is approved and payment is complete.');
      return;
    }

    this.booking.set(data.booking);
    this.quotation.set(data.quotation);
    this.customer.set(data.customer);
    this.vehicle.set(data.vehicle);
    this.payment.set(data.payment);

    const bookingStatus = String(data.booking.status ?? '').toLowerCase();
    const paymentMode = String(data.payment?.payment_mode ?? '').toLowerCase();
    const paymentStatus = String(data.payment?.status ?? '').toLowerCase();
    const hasAnyPayment = Boolean(data.payment?.id);
    const hasResolvedPendingFull = paymentMode !== 'pending_full' || paymentStatus === 'paid';
    const isReady = bookingStatus === 'approved' && hasAnyPayment && hasResolvedPendingFull;

    console.log('[Inspection Guard]', {
      bookingId: this.bookingId,
      bookingStatus,
      payment: data.payment,
      isReady,
    });

    this.bookingReady.set(isReady);

    if (!isReady) {
      this.notReadyMessage.set('This booking is not ready for inspection. Please ensure it is approved and payment is complete.');
      return;
    }

    this.form.set({
      licenceNumber: data.customer?.license_no || '',
      licenceExpiry: data.customer?.license_expiry || '',
      licenceVerified: false,
      odometerReading: null,
      fuelLevel: null,
      tyreCondition: null,
      bodyCondition: null,
      interiorCondition: null,
      damageNotes: '',
      additionalNotes: '',
      customerAcknowledged: false,
    });
  }
}
