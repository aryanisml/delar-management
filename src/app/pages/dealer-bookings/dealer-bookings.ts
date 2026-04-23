import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SupabaseService } from '../../services/supabase';

type VehicleFilters = {
  type: string | null;
  capacity: number | null;
  transmission: string | null;
  fuel: string | null;
  pickup_date: Date | null;
  end_date: Date | null;
};

type TripForm = {
  pickup_date: Date | null;
  pickup_time: string;
  pickup_location: string;
  drop_location: string;
  end_date: Date | null;
  dropoff_time: string;
  purpose: string;
  number_of_passengers: number | null;
  special_instructions: string;
};

type CustomerChoice = 'existing' | 'update' | 'new';

type CustomerForm = {
  full_name: string;
  mobile: string;
  email: string;
  license_no: string;
  license_expiry: Date | null;
  customer_type: 'individual' | 'business';
  business_name: string;
  gst_number: string;
  id_proof_url: string;
  id_proof_name: string;
};

type CustomerErrors = Partial<Record<keyof CustomerForm, string>>;

type PricingSummary = {
  rate: number;
  days: number;
  base_cost: number;
  gst: number;
  advance: number;
  security_deposit: number;
  final_amount: number;
  extra_mileage_rate: number;
  included_km_per_day: number;
  discount_amount: number;
  promo_code: string | null;
  fuel_policy: string;
};

@Component({
  selector: 'app-dealer-bookings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DatePipe,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TagModule,
    TextareaModule,
    ToastModule,
  ],
  templateUrl: './dealer-bookings.html',
  styleUrl: './dealer-bookings.scss',
  providers: [MessageService],
})
export class DealerBookings {
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  readonly step = signal(1);
  readonly loadingVehicles = signal(false);
  readonly generatingQuotation = signal(false);
  readonly confirmingBooking = signal(false);
  readonly previewVisible = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewResource = signal<SafeResourceUrl | null>(null);
  readonly filters = signal<VehicleFilters>({
    type: null,
    capacity: null,
    transmission: null,
    fuel: null,
    pickup_date: null,
    end_date: null,
  });
  readonly vehicles = signal<any[]>([]);
  readonly selectedVehicle = signal<any | null>(null);
  readonly trip = signal<TripForm>({
    pickup_date: null,
    pickup_time: '',
    pickup_location: '',
    drop_location: '',
    end_date: null,
    dropoff_time: '',
    purpose: '',
    number_of_passengers: null,
    special_instructions: '',
  });
  readonly customer = signal<CustomerForm>({
    full_name: '',
    mobile: '',
    email: '',
    license_no: '',
    license_expiry: null,
    customer_type: 'individual',
    business_name: '',
    gst_number: '',
    id_proof_url: '',
    id_proof_name: '',
  });
  readonly customerErrors = signal<CustomerErrors>({});
  readonly existingCustomer = signal<any | null>(null);
  readonly customerChoice = signal<CustomerChoice>('existing');
  readonly uploadedIdFallback = signal<string | null>(null);
  readonly pricing = signal<PricingSummary | null>(null);
  readonly generatedBooking = signal<any | null>(null);
  readonly generatedQuotation = signal<any | null>(null);
  readonly sendState = signal<{ email: boolean; sms: boolean; whatsapp: boolean }>({
    email: false,
    sms: false,
    whatsapp: false,
  });
  readonly paymentMode = signal<'UPI' | 'Card' | 'Cash' | null>(null);

  readonly purposeOptions = ['Corporate', 'Airport Transfer', 'Personal', 'Business Visit', 'Event']
    .map((value) => ({ label: value, value }));
  readonly customerTypeOptions = [
    { label: 'Individual', value: 'individual' },
    { label: 'Business', value: 'business' },
  ];
  readonly paymentOptions = ['UPI', 'Card', 'Cash'].map((value) => ({ label: value, value }));

  readonly totalDays = computed(() => this.calculateDays(this.trip().pickup_date, this.trip().end_date));
  readonly insuranceStatus = computed(() => {
    const value = this.selectedVehicle()?.insurance_expiry;
    if (!value) {
      return null;
    }

    const days = Math.ceil((new Date(value).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 30) {
      return { label: 'Insurance expiring soon', severity: 'danger' as const };
    }
    return null;
  });
  readonly licenseStatus = computed(() => {
    const expiry = this.customer().license_expiry;
    if (!expiry) {
      return null;
    }

    const diff = Math.ceil((expiry.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (diff < 0) {
      return { label: 'Licence expired', severity: 'danger' as const };
    }
    if (diff <= 30) {
      return { label: `Licence expires in ${diff} day(s)`, severity: 'warn' as const };
    }
    return { label: 'Licence valid', severity: 'success' as const };
  });
  readonly customerDiffs = computed(() => {
    const existing = this.existingCustomer();
    const current = this.customer();
    if (!existing) {
      return [];
    }

    const comparisons = [
      { label: 'Name', existing: existing.full_name ?? '', current: current.full_name ?? '' },
      { label: 'Email', existing: existing.email ?? '', current: current.email ?? '' },
      { label: 'Licence No', existing: existing.license_no ?? '', current: current.license_no ?? '' },
      {
        label: 'Licence Expiry',
        existing: existing.license_expiry ?? '',
        current: current.license_expiry ? this.toDateOnly(current.license_expiry) : '',
      },
      { label: 'Customer Type', existing: existing.customer_type ?? '', current: current.customer_type ?? '' },
      { label: 'Business Name', existing: existing.business_name ?? '', current: current.business_name ?? '' },
      { label: 'GST', existing: existing.gst_number ?? '', current: current.gst_number ?? '' },
    ];

    return comparisons.filter((item) => item.current && item.existing !== item.current);
  });

  async ngOnInit() {
    await this.loadVehicles();
    const vehicleId = this.route.snapshot.queryParamMap.get('vehicleId');
    if (vehicleId) {
      await this.preselectVehicle(vehicleId);
    }
  }

  async loadVehicles() {
    this.loadingVehicles.set(true);
    const filters = this.filters();
    const { data, error } = await this.supabase.getWalkInVehicles({
      type: filters.type,
      capacity: filters.capacity,
      transmission: filters.transmission,
      fuel: filters.fuel,
      pickup_date: filters.pickup_date ? this.toDateOnly(filters.pickup_date) : null,
      end_date: filters.end_date ? this.toDateOnly(filters.end_date) : null,
    });
    this.loadingVehicles.set(false);

    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Vehicles unavailable', detail: (error as any)?.message || 'Could not load available vehicles.' });
      return;
    }

    this.vehicles.set(data ?? []);
    if (this.selectedVehicle()) {
      const refreshed = (data ?? []).find((vehicle: any) => vehicle.id === this.selectedVehicle()?.id) ?? null;
      this.selectedVehicle.set(refreshed);
    }
  }

  updateFilters(patch: Partial<VehicleFilters>) {
    this.filters.update((current) => ({ ...current, ...patch }));
  }

  updateTrip<K extends keyof TripForm>(key: K, value: TripForm[K]) {
    this.trip.update((current) => ({ ...current, [key]: value }));
  }

  updateCustomer<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    this.customer.update((current) => ({ ...current, [key]: value }));
    if (Object.keys(this.customerErrors()).length) {
      this.validateCustomer(true);
    }
  }

  selectVehicle(vehicle: any) {
    this.selectedVehicle.set(vehicle);
    this.step.set(2);
    this.recalculatePricing();
  }

  async applyAvailabilityFilters() {
    await this.loadVehicles();
  }

  tripInvalid() {
    const form = this.trip();
    const pickupDate = form.pickup_date;
    const endDate = form.end_date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!pickupDate || !endDate || !form.pickup_time || !form.dropoff_time || !form.pickup_location || !form.drop_location || !form.purpose) {
      return true;
    }

    if (pickupDate < today) {
      return true;
    }

    return endDate < pickupDate;
  }

  continueToCustomer() {
    if (this.tripInvalid()) {
      this.messageService.add({ severity: 'warn', summary: 'Trip details incomplete', detail: 'Enter all trip details with valid dates and times.' });
      return;
    }

    this.recalculatePricing();
    this.step.set(3);
  }

  async lookupCustomer() {
    const mobile = this.customer().mobile.trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return;
    }

    const { data, error } = await this.supabase.findCustomerByMobile(mobile);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Customer lookup failed', detail: error.message || 'Could not look up the customer.' });
      return;
    }

    this.existingCustomer.set(data);
    if (!data) {
      this.customerChoice.set('new');
      return;
    }

    this.customer.update((current) => ({
      ...current,
      full_name: current.full_name || data.full_name || '',
      email: current.email || data.email || '',
      license_no: current.license_no || data.license_no || '',
      license_expiry: current.license_expiry || (data.license_expiry ? new Date(data.license_expiry) : null),
      customer_type: data.customer_type === 'business' ? 'business' : current.customer_type,
      business_name: current.business_name || data.business_name || '',
      gst_number: current.gst_number || data.gst_number || '',
      id_proof_url: current.id_proof_url || data.id_proof_url || '',
      id_proof_name: current.id_proof_name || (data.id_proof_url ? 'Existing proof on file' : ''),
    }));
    this.customerChoice.set('existing');
  }

  customerInvalid() {
    return Object.keys(this.validateCustomer(false)).length > 0;
  }

  continueToQuotation() {
    if (Object.keys(this.validateCustomer(true)).length) {
      return;
    }

    this.recalculatePricing();
    this.step.set(4);
  }

  async onIdProofSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reference = this.customer().mobile || this.customer().full_name || 'customer';
    const { data, error } = await this.supabase.uploadCustomerIdProof(file, reference);
    if (error && !data?.publicUrl && !data?.fallbackDataUrl) {
      this.messageService.add({ severity: 'error', summary: 'Upload failed', detail: 'Could not upload ID proof.' });
      return;
    }

    this.customer.update((current) => ({
      ...current,
      id_proof_url: data?.publicUrl || data?.fallbackDataUrl || '',
      id_proof_name: file.name,
    }));
    this.uploadedIdFallback.set(data?.publicUrl ? null : data?.fallbackDataUrl || null);
    if (Object.keys(this.customerErrors()).length) {
      this.validateCustomer(true);
    }
  }

  async generateQuotation() {
    if (!this.selectedVehicle() || !this.pricing()) {
      return;
    }

    this.generatingQuotation.set(true);
    const result = await this.supabase.createWalkInQuotation({
      vehicle_id: this.selectedVehicle().id,
      trip: {
        pickup_date: this.toDateOnly(this.trip().pickup_date),
        pickup_time: this.trip().pickup_time,
        pickup_location: this.trip().pickup_location,
        drop_location: this.trip().drop_location,
        end_date: this.toDateOnly(this.trip().end_date),
        dropoff_time: this.trip().dropoff_time,
        purpose: this.trip().purpose,
        number_of_passengers: Number(this.trip().number_of_passengers ?? 0),
        special_instructions: this.trip().special_instructions || null,
      },
      customer: {
        full_name: this.customer().full_name,
        mobile: this.customer().mobile,
        email: this.customer().email || null,
        license_no: this.customer().license_no,
        license_expiry: this.customer().license_expiry ? this.toDateOnly(this.customer().license_expiry) : null,
        customer_type: this.customer().customer_type,
        business_name: this.customer().business_name || null,
        gst_number: this.customer().gst_number || null,
        id_proof_url: this.customer().id_proof_url || null,
      },
      pricing: this.pricing()!,
      existing_customer_id: this.existingCustomer()?.id ?? null,
      existing_customer_choice: this.existingCustomer() ? this.customerChoice() : 'new',
    });
    this.generatingQuotation.set(false);

    if (result.error) {
      const detail = result.error.message || 'Could not generate the quotation.';
      this.messageService.add({ severity: 'error', summary: 'Quotation failed', detail });
      if (/no longer available/i.test(detail)) {
        this.step.set(1);
        await this.loadVehicles();
      }
      return;
    }

    this.generatedBooking.set(result.data?.booking ?? null);
    this.generatedQuotation.set(result.data?.quotation ?? null);
    this.step.set(5);
    this.messageService.add({
      severity: 'success',
      summary: 'Quotation generated',
      detail: `Quotation ${result.data?.quotation?.quote_reference || ''} is ready for preview and confirmation.`,
    });
  }

  async previewPdf() {
    const blob = this.buildPdfBlob();
    if (!blob) {
      return;
    }

    const previousUrl = this.previewUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    const url = URL.createObjectURL(blob);
    this.previewUrl.set(url);
    this.previewResource.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.previewVisible.set(true);
  }

  async sendQuote(channel: 'email' | 'sms' | 'whatsapp') {
    if (!this.generatedBooking() || !this.generatedQuotation()) {
      this.messageService.add({ severity: 'warn', summary: 'Generate quotation first', detail: 'Create the quotation before sending it.' });
      return;
    }

    const blob = this.buildPdfBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const quoteRef = this.generatedQuotation()?.quote_reference || 'Quotation';
      const message = encodeURIComponent(
        `Quotation ${quoteRef} for ${this.customer().full_name}. Pickup ${this.trip().pickup_location}, drop ${this.trip().drop_location}, total ${this.formatCurrency(this.pricing()?.final_amount || 0)}.`
      );

      if (channel === 'email') {
        window.open(`mailto:${this.customer().email || ''}?subject=${encodeURIComponent(quoteRef)}&body=${message}`, '_blank');
      } else if (channel === 'sms') {
        window.open(`sms:${this.customer().mobile}?body=${message}`, '_blank');
      } else {
        window.open(`https://wa.me/91${this.customer().mobile}?text=${message}`, '_blank');
      }

      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    await this.supabase.markQuotationSent(this.generatedBooking().id);
    this.sendState.update((current) => ({ ...current, [channel]: true }));
    this.messageService.add({ severity: 'success', summary: 'Quotation shared', detail: `Prepared ${channel.toUpperCase()} handoff for the quotation.` });
  }

  async confirmBooking() {
    if (!this.generatedBooking() || !this.generatedQuotation()) {
      return;
    }

    this.confirmingBooking.set(true);
    const preferredChannel = this.sendState().email
      ? 'email'
      : this.sendState().whatsapp
        ? 'whatsapp'
        : this.sendState().sms
          ? 'sms'
          : null;
    const { error } = await this.supabase.confirmWalkInBooking(this.generatedBooking().id, preferredChannel);
    this.confirmingBooking.set(false);

    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Confirmation failed', detail: error.message || 'Could not confirm this booking.' });
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Booking confirmed',
      detail: `Advance payment recorded in workflow${this.paymentMode() ? ` via ${this.paymentMode()}` : ''}. Admin has been notified for approval.`,
    });
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  recalculatePricing() {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      this.pricing.set(null);
      return;
    }

    const tier = vehicle.tier ?? vehicle.vehicle_tiers ?? {};
    const rate = Number(tier.daily_rate ?? 0);
    const days = this.totalDays();
    const base_cost = rate * days;
    const discount_amount = 0;
    const gst = base_cost * this.supabase.gstRate;
    const final_amount = base_cost + gst - discount_amount;

    this.pricing.set({
      rate,
      days,
      base_cost,
      gst,
      advance: base_cost * 0.5,
      security_deposit: Number(tier.security_deposit ?? 0),
      final_amount,
      extra_mileage_rate: Number(tier.extra_mileage_rate ?? 0),
      included_km_per_day: Number(tier.included_km_per_day ?? 0),
      discount_amount,
      promo_code: null,
      fuel_policy: 'Full-to-Full',
    });
  }

  stepDone(target: number) {
    return this.step() > target;
  }

  goToStep(target: number) {
    if (target < this.step()) {
      this.step.set(target);
    }
  }

  private buildPdfBlob() {
    const pricing = this.pricing();
    const quotation = this.generatedQuotation();
    if (!pricing) {
      return null;
    }

    const lines = [
      `Quotation ${quotation?.quote_reference || 'DRAFT'}`,
      `Customer: ${this.customer().full_name}`,
      `Mobile: ${this.customer().mobile}`,
      `Vehicle: ${this.selectedVehicle()?.brand || ''} ${this.selectedVehicle()?.model || ''}`.trim(),
      `Pickup: ${this.trip().pickup_location} on ${this.toDateOnly(this.trip().pickup_date)}`,
      `Drop: ${this.trip().drop_location} on ${this.toDateOnly(this.trip().end_date)}`,
      `Rate per day: ${this.formatCurrency(pricing.rate)}`,
      `Days: ${pricing.days}`,
      `Base cost: ${this.formatCurrency(pricing.base_cost)}`,
      `GST: ${this.formatCurrency(pricing.gst)}`,
      `Advance: ${this.formatCurrency(pricing.advance)}`,
      `Security deposit: ${this.formatCurrency(pricing.security_deposit)}`,
      `Final amount: ${this.formatCurrency(pricing.final_amount)}`,
      `Extra mileage rate: ${this.formatCurrency(pricing.extra_mileage_rate)} per km`,
    ];

    const content = [
      'BT',
      '/F1 12 Tf',
      '40 800 Td',
      ...lines.flatMap((line, index) => [`(${this.escapePdf(line)}) Tj`, index === lines.length - 1 ? '' : 'T*']),
      'ET',
    ]
      .filter(Boolean)
      .join('\n');

    const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj ${stream} endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  }

  private escapePdf(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private calculateDays(start: Date | null, end: Date | null) {
    if (!start || !end) {
      return 1;
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    return Math.max(1, diff || 1);
  }

  private toDateOnly(value: Date | null) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private async preselectVehicle(vehicleId: string) {
    const { data, error } = await this.supabase.getWalkInVehicles({ vehicleId });
    if (error || !data?.length) {
      this.messageService.add({ severity: 'warn', summary: 'Vehicle unavailable', detail: 'The selected vehicle could not be loaded for booking.' });
      return;
    }

    const vehicle = data[0];
    this.vehicles.update((current) => current.some((item) => item.id === vehicle.id) ? current : [vehicle, ...current]);
    this.selectedVehicle.set(vehicle);
    this.step.set(2);
    this.recalculatePricing();
  }

  displayValue(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    return String(value);
  }

  dailyRateLabel(vehicle: any) {
    const rate = vehicle?.tier?.daily_rate ?? vehicle?.vehicle_tiers?.daily_rate;
    if (rate === null || rate === undefined || rate === '') {
      return '—';
    }

    return this.formatCurrency(Number(rate));
  }

  validateCustomer(updateErrors: boolean) {
    const customer = this.customer();
    const errors: CustomerErrors = {};
    const mobile = this.normalizeMobile(customer.mobile);
    const license = customer.license_no.trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!customer.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!mobile) {
      errors.mobile = 'Mobile number is required';
    } else if (mobile.startsWith('0')) {
      errors.mobile = 'Mobile number should not start with 0';
    } else if (!/^\d{10}$/.test(mobile)) {
      errors.mobile = 'Enter a valid 10-digit mobile number';
    }

    if (!/^[a-zA-Z0-9]{6,}$/.test(license)) {
      errors.license_no = 'Enter a valid licence number (min 6 characters)';
    }

    if (!customer.license_expiry) {
      errors.license_expiry = 'Licence expiry date is required';
    } else {
      const expiry = new Date(customer.license_expiry);
      expiry.setHours(0, 0, 0, 0);
      if (expiry < today) {
        errors.license_expiry = 'Licence has expired and cannot be accepted';
      }
    }

    if (!customer.customer_type) {
      errors.customer_type = 'Please select a customer type';
    }

    if (customer.customer_type === 'business' && !customer.business_name.trim()) {
      errors.business_name = 'Business name is required for business customers';
    }

    if (!customer.id_proof_url) {
      errors.id_proof_url = 'ID proof document is required';
    }

    if (updateErrors) {
      this.customerErrors.set(errors);
    }

    return errors;
  }

  private normalizeMobile(value: string) {
    let normalized = String(value ?? '').replace(/[\s-]/g, '');
    if (normalized.startsWith('+91')) {
      normalized = normalized.slice(3);
    } else if (normalized.startsWith('91') && normalized.length > 10) {
      normalized = normalized.slice(2);
    }
    return normalized;
  }
}
