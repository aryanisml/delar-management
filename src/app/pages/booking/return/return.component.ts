import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { QuotationPdfService } from '../../../services/quotation-pdf';
import { SupabaseService } from '../../../services/supabase';

@Component({
  selector: 'app-return',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    RadioButtonModule,
    SelectModule,
    TagModule,
    TextareaModule,
    ToastModule,
    ToggleSwitchModule,
  ],
  templateUrl: './return.component.html',
  styleUrl: './return.component.scss',
  providers: [MessageService],
})
export class ReturnComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private quotationPdf = inject(QuotationPdfService);

  readonly bookingId = this.route.snapshot.paramMap.get('bookingId') || '';

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly notReady = signal(false);
  readonly notReadyReason = signal('');

  readonly booking = signal<any>(null);
  readonly quotation = signal<any>(null);
  readonly customer = signal<any>(null);
  readonly vehicle = signal<any>(null);
  readonly checkoutInspection = signal<any>(null);
  readonly advancePayment = signal<any>(null);

  // Section 2 — Return condition
  readonly returnOdometer = signal<number | null>(null);
  readonly returnFuelLevel = signal('');
  readonly returnBodyCondition = signal('');
  readonly returnInteriorCondition = signal('');
  readonly returnDamageNotes = signal('');
  readonly photoPreviews = signal<Record<string, string | null>>({ front: null, back: null, left: null, right: null });

  // Section 3 — Charges
  readonly fuelChargeOverride = signal<number | null>(null);
  readonly cleaningEnabled = signal(false);
  readonly cleaningAmount = signal<number>(500);
  readonly damageEnabled = signal(false);
  readonly damageAmount = signal<number>(0);
  readonly damageDescription = signal('');

  // Section 4 — Payment
  readonly balancePaymentMode = signal('cash');
  readonly depositSettled = signal(false);
  readonly balanceCollected = signal(false);

  readonly fuelLevelOptions = [
    { label: 'Full', value: 'Full' },
    { label: 'Three-Quarter', value: 'Three-Quarter' },
    { label: 'Half', value: 'Half' },
    { label: 'Quarter', value: 'Quarter' },
    { label: 'Empty', value: 'Empty' },
  ];

  readonly paymentModeOptions = [
    { label: 'Cash', value: 'cash' },
    { label: 'UPI', value: 'upi' },
    { label: 'Card', value: 'card' },
  ];

  readonly bodyConditionOptions = ['Clean', 'Minor Scratches', 'Visible Damage'];
  readonly interiorConditionOptions = ['Clean', 'Stained', 'Damaged'];

  private readonly fuelLitres: Record<string, number> = {
    'Full': 40, 'Three-Quarter': 30, 'Half': 20, 'Quarter': 10, 'Empty': 0,
  };

  readonly fuelGapLitres = computed(() => {
    const checkoutLevel = this.checkoutInspection()?.fuel_level || '';
    const checkinLevel = this.returnFuelLevel();
    const out = this.fuelLitres[checkoutLevel] ?? 0;
    const in_ = this.fuelLitres[checkinLevel] ?? 0;
    return Math.max(0, out - in_);
  });

  readonly autoFuelCharge = computed(() => this.fuelGapLitres() * 100);

  readonly effectiveFuelCharge = computed(() => {
    const ov = this.fuelChargeOverride();
    return ov !== null ? ov : this.autoFuelCharge();
  });

  readonly totalDeductions = computed(() =>
    this.effectiveFuelCharge() +
    (this.cleaningEnabled() ? this.cleaningAmount() : 0) +
    (this.damageEnabled() ? this.damageAmount() : 0)
  );

  readonly remainingBalance = computed(() => {
    const q = this.quotation();
    if (!q) return 0;
    return Math.max(0, Number(q.final_amount ?? 0) - Number(q.advance ?? 0));
  });

  readonly securityDepositRefund = computed(() => {
    const q = this.quotation();
    if (!q) return 0;
    return Number(q.security_deposit ?? 0) - this.totalDeductions();
  });

  async ngOnInit() {
    if (!this.bookingId) {
      await this.router.navigateByUrl('/dealer/my-bookings');
      return;
    }

    this.loading.set(true);

    const { data: booking } = await this.supabase.getBookingById(this.bookingId);

    if (!booking || booking.status !== 'in_service') {
      this.notReady.set(true);
      this.notReadyReason.set('This booking is not currently in service or was not found.');
      this.loading.set(false);
      return;
    }

    const hasCheckout = await this.supabase.checkHasCheckoutInspection(this.bookingId);
    if (!hasCheckout) {
      this.notReady.set(true);
      this.notReadyReason.set('No checkout inspection found for this booking. Complete the checkout inspection before processing the return.');
      this.loading.set(false);
      return;
    }

    this.booking.set(booking);

    const [quotationResult, customerResult, vehicleResult, checkoutResult, paymentResult] = await Promise.all([
      this.supabase.getQuotationByBooking(this.bookingId),
      this.supabase.getCustomerById(booking.customer_id),
      this.supabase.getVehicleById(booking.vehicle_id),
      this.supabase.getCheckoutInspection(this.bookingId),
      this.supabase.getPaymentByBooking(this.bookingId),
    ]);

    this.quotation.set(quotationResult.data ?? null);
    this.customer.set(customerResult.data ?? null);
    this.vehicle.set(vehicleResult.data ?? null);
    this.checkoutInspection.set(checkoutResult.data ?? null);
    this.advancePayment.set(paymentResult.data ?? null);

    this.loading.set(false);
  }

  onPhotoSelected(side: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    this.photoPreviews.update(prev => ({ ...prev, [side]: url }));
  }

  triggerPhotoUpload(side: string) {
    document.getElementById(`return-photo-${side}`)?.click();
  }

  vehicleName(): string {
    const v = this.vehicle();
    return v ? `${v.brand || v.make || ''} ${v.model || ''}`.trim() : 'Vehicle';
  }

  async submit() {
    const odometer = this.returnOdometer();
    const checkoutOdometer = Number(this.checkoutInspection()?.odometer_reading ?? 0);

    if (!odometer || odometer <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Enter return odometer reading.' });
      return;
    }
    if (odometer < checkoutOdometer) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: `Return odometer (${odometer}) cannot be less than checkout odometer (${checkoutOdometer}).` });
      return;
    }
    if (!this.returnFuelLevel()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Select fuel level at return.' });
      return;
    }
    if (!this.returnBodyCondition()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Select body condition.' });
      return;
    }
    if (!this.returnInteriorCondition()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Select interior condition.' });
      return;
    }
    if (this.damageEnabled() && (!this.damageAmount() || !this.damageDescription().trim())) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Enter damage amount and description when damage is reported.' });
      return;
    }
    if (!this.balanceCollected()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Confirm remaining balance has been collected.' });
      return;
    }
    if (!this.depositSettled()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Confirm security deposit has been settled.' });
      return;
    }

    this.submitting.set(true);

    try {
      const booking = this.booking();
      const currentUser = await this.supabase.getCurrentUser();

      const { error: inspError } = await this.supabase.createInspection({
        booking_id: booking.id,
        vehicle_id: booking.vehicle_id,
        customer_id: booking.customer_id,
        inspector_id: currentUser?.id ?? null,
        odometer_reading: odometer,
        fuel_level: this.returnFuelLevel(),
        tyre_condition: this.checkoutInspection()?.tyre_condition ?? 'Not Assessed',
        body_condition: this.returnBodyCondition(),
        interior_condition: this.returnInteriorCondition(),
        damage_notes: this.returnDamageNotes() || null,
        special_remarks: null,
        inspection_type: 'checkin',
        status: 'completed',
      });
      if (inspError) throw new Error((inspError as any).message || 'Failed to save return inspection.');

      const { error: payError } = await this.supabase.insertBalancePayment(
        booking.id,
        this.remainingBalance(),
        this.balancePaymentMode()
      );
      if (payError) throw new Error((payError as any).message || 'Failed to record balance payment.');

      const { error: bookingError } = await this.supabase.completeBooking(booking.id);
      if (bookingError) throw new Error((bookingError as any).message || 'Failed to complete booking.');

      const { error: vehicleError } = await this.supabase.updateVehicleAfterReturn(booking.vehicle_id, odometer);
      if (vehicleError) throw new Error((vehicleError as any).message || 'Failed to update vehicle status.');

      this.messageService.add({ severity: 'success', summary: 'Vehicle returned successfully', detail: 'Booking has been closed.' });
      await new Promise(r => setTimeout(r, 1500));
      await this.router.navigateByUrl('/dealer/my-bookings');
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Submission failed', detail: err?.message || 'An error occurred. Please try again.' });
      this.submitting.set(false);
    }
  }

  downloadFinalInvoice() {
    const booking = this.booking();
    const quotation = this.quotation();
    if (!booking || !quotation) return;

    const customer = this.customer();
    const vehicle = this.vehicle();

    const additionalCharges = [
      ...(this.effectiveFuelCharge() > 0 ? [{ label: `Fuel shortfall (${this.fuelGapLitres()} L × ₹100)`, amount: this.effectiveFuelCharge() }] : []),
      ...(this.cleaningEnabled() ? [{ label: 'Cleaning fee', amount: this.cleaningAmount() }] : []),
      ...(this.damageEnabled() && this.damageAmount() > 0 ? [{ label: 'Damage charges', amount: this.damageAmount() }] : []),
    ];

    const input = {
      companyName: 'AUTOFLOW',
      companySubtitle: 'Fleet Operations',
      quoteReference: quotation.quote_reference || `#${booking.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      issueDate: this.formatDate(new Date().toISOString()),
      validUntil: this.formatDate(new Date().toISOString()),
      advisorName: 'AUTOFLOW Fleet Operations',
      advisorEmail: customer?.email || quotation.email || '-',
      customerName: customer?.full_name || quotation.customer_name || '-',
      customerMobile: customer?.mobile || quotation.mobile || '-',
      customerEmail: customer?.email || quotation.email || '-',
      customerLicenseNo: customer?.license_no || quotation.license || '-',
      customerType: customer?.customer_type || quotation.customer_type || 'individual',
      vehicleName: this.vehicleName(),
      vehicleFuelType: vehicle?.fuel || '-',
      vehicleTransmission: vehicle?.transmission || '-',
      vehicleYear: String(vehicle?.year || '-'),
      pickupLocation: booking.pickup_location || '-',
      dropLocation: booking.drop_location || '-',
      pickupDateTime: `${this.formatDate(booking.start_date)} ${booking.pickup_time || ''}`.trim(),
      dropDateTime: `${this.formatDate(booking.end_date)} ${booking.dropoff_time || ''}`.trim(),
      durationLabel: `${quotation.days || 1} day(s)`,
      purpose: booking.purpose || '-',
      passengers: String(booking.number_of_passengers || '-'),
      paymentStatusLabel: 'Final Invoice',
      fuelPolicy: quotation.fuel_policy || 'Full-to-Full',
      amounts: {
        dailyRate: Number(quotation.rate ?? 0),
        days: Number(quotation.days ?? 1),
        baseCost: Number(quotation.base_cost ?? 0),
        gst: Number(quotation.gst ?? 0),
        discountAmount: Number(quotation.discount_amount ?? 0),
        advance: Number(quotation.advance ?? 0),
        securityDeposit: Number(quotation.security_deposit ?? 0),
        finalAmount: Number(quotation.final_amount ?? 0),
        extraMileageRate: Number(quotation.extra_mileage_rate ?? 0),
      },
      additionalCharges,
      remainingBalance: this.remainingBalance(),
      securityDepositRefund: this.securityDepositRefund(),
    };

    const blob = this.quotationPdf.buildPdfBlob(input);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FINAL-INVOICE-${quotation.quote_reference || booking.id.slice(0, 8).toUpperCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async goBack() {
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  private formatDate(value?: string | Date | null): string {
    return value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  }
}
