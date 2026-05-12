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
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { normalizeVehicle, tagSeverityForStatus } from '../../admin-ui.models';
import { QuotationEmailService } from '../../services/quotation-email.service';
import { QuotationPdfService } from '../../services/quotation-pdf';
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
    ProgressBarModule,
    ProgressSpinnerModule,
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
  private quotationPdf = inject(QuotationPdfService);
  private quotationEmail = inject(QuotationEmailService);

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
  readonly idProofFileSize = signal<string>('');
  readonly duplicateMobileMessage = signal('');
  readonly quotationError = signal('');
  readonly generatedBooking = signal<any | null>(null);
  readonly generatedQuotation = signal<any | null>(null);
  readonly sendState = signal<{ email: boolean; sms: boolean; whatsapp: boolean }>({
    email: false,
    sms: false,
    whatsapp: false,
  });
  readonly advanceCollectionMode = signal<'online' | 'offline'>('online');
  readonly recordingOfflinePayment = signal(false);
  readonly offlinePaymentRecorded = signal(false);
  readonly advisorContact = signal<{ name: string; email: string }>({ name: 'Rental Advisor', email: 'advisor@autoflow.in' });

  readonly onlinePaymentInfoText = computed(() => {
    const amount = this.formatCurrency(this.quotationAmount('final_amount'));
    return `Customer pays ${amount} in full online via Cashfree — no cash collection needed. Booking activates automatically on payment confirmation.`;
  });

  readonly offlineConfirmedText = computed(() => {
    const advance = this.quotationAmount('advance');
    const balance = this.quotationAmount('final_amount') - advance;
    return `Advance of ${this.formatCurrency(advance)} recorded as collected. Remaining balance of ${this.formatCurrency(balance)} will be collected at vehicle return.`;
  });

  readonly purposeOptions = ['Corporate', 'Airport Transfer', 'Personal', 'Business Visit', 'Event']
    .map((value) => ({ label: value, value }));
  readonly locationOptions = [
    'Hyderabad Airport (RGIA)', 'Hyderabad City Centre', 'Gachibowli', 'Hitech City', 'Madhapur',
    'Secunderabad', 'Banjara Hills', 'Jubilee Hills', 'Ameerpet', 'Kukatpally',
    'Begumpet', 'Kondapur', 'Manikonda', 'Miyapur', 'LB Nagar', 'Dilsukhnagar',
    'Warangal', 'Vijayawada', 'Visakhapatnam', 'Bangalore', 'Mumbai', 'Delhi',
  ].map((value) => ({ label: value, value }));

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
  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    this.advisorContact.set({
      name: (user?.user_metadata as Record<string, string> | undefined)?.['full_name'] || user?.email?.split('@')[0] || 'Rental Advisor',
      email: user?.email || 'advisor@autoflow.in',
    });
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
    if (key === 'mobile') {
      this.duplicateMobileMessage.set('');
    }
    if (Object.keys(this.customerErrors()).length) {
      this.validateCustomer(true);
    }
  }

  selectVehicle(vehicle: any) {
    if (!this.canBookVehicle(vehicle)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vehicle unavailable',
        detail: this.vehicleAvailabilityCaption(vehicle),
      });
      return;
    }
    this.selectedVehicle.set(vehicle);
    this.step.set(2);
    this.generatedBooking.set(null);
    this.generatedQuotation.set(null);
    this.offlinePaymentRecorded.set(false);
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

    if (!this.selectedVehicle() || !this.canBookVehicle(this.selectedVehicle())) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vehicle unavailable',
        detail: this.selectedVehicle() ? this.vehicleAvailabilityCaption(this.selectedVehicle()) : 'Please choose an available vehicle.',
      });
      this.step.set(1);
      return;
    }

    this.generatedBooking.set(null);
    this.generatedQuotation.set(null);
    this.offlinePaymentRecorded.set(false);
    this.step.set(3);
  }

  async lookupCustomer() {
    return await this.lookupCustomerByMobile(true);
  }

  async lookupCustomerOnBlur() {
    await this.lookupCustomerByMobile(false);
  }

  private async lookupCustomerByMobile(showLookupMiss: boolean) {
    const mobile = this.normalizeMobile(this.customer().mobile);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return false;
    }

    const { data, error } = await this.supabase.findCustomerByMobile(mobile);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Customer lookup failed', detail: error.message || 'Could not look up the customer.' });
      return false;
    }

    this.existingCustomer.set(data);
    if (!data) {
      this.customerChoice.set('new');
      if (showLookupMiss) {
        this.duplicateMobileMessage.set('');
      }
      return false;
    }

    this.prefillCustomer(data);
    this.customerChoice.set('existing');
    return true;
  }

  customerInvalid() {
    return Object.keys(this.validateCustomer(false)).length > 0;
  }

  async continueToQuotation() {
    if (Object.keys(this.validateCustomer(true)).length) {
      return;
    }

    await this.ensureExistingCustomerForMobile();
    this.step.set(4);
    if (await this.generateQuotation()) {
      return;
    }
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
    this.idProofFileSize.set(this.formatFileSize(file.size));
    this.uploadedIdFallback.set(data?.publicUrl ? null : data?.fallbackDataUrl || null);
    if (Object.keys(this.customerErrors()).length) {
      this.validateCustomer(true);
    }
  }

  removeIdProof() {
    this.customer.update((current) => ({ ...current, id_proof_url: '', id_proof_name: '' }));
    this.idProofFileSize.set('');
    this.uploadedIdFallback.set(null);
  }

  async generateQuotation() {
    if (!this.selectedVehicle()) {
      return false;
    }

    if (this.generatedBooking()?.id) {
      this.generatingQuotation.set(true);
      const user = await this.supabase.getCurrentUser();
      const quotation = await this.supabase.createOrFetchQuotation({
        bookingId: this.generatedBooking().id,
        advisorId: user?.id ?? '',
        vehicleId: this.selectedVehicle().id,
        startDate: this.toDateOnly(this.trip().pickup_date),
        endDate: this.toDateOnly(this.trip().end_date),
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
      });
      this.generatingQuotation.set(false);
      if (quotation.error) {
        this.quotationError.set(quotation.error.message || 'Could not load the database quotation.');
        return false;
      }
      this.generatedQuotation.set(quotation.data ?? null);
      return Boolean(quotation.data);
    }

    this.generatingQuotation.set(true);
    this.quotationError.set('');
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
      existing_customer_id: this.existingCustomer()?.id ?? null,
      existing_customer_choice: this.existingCustomer() ? this.customerChoice() : 'new',
    });
    this.generatingQuotation.set(false);

    if (result.error) {
      const detail = result.error.message || 'Could not generate the quotation.';
      this.quotationError.set(detail);
      if (/no longer available/i.test(detail)) {
        this.step.set(1);
        await this.loadVehicles();
      }
      return false;
    }

    this.generatedBooking.set(result.data?.booking ?? null);
    this.generatedQuotation.set(result.data?.quotation ?? null);
    this.offlinePaymentRecorded.set(false);
    if (result.data?.duplicateMobile && result.data?.customer) {
      this.existingCustomer.set(result.data.customer);
      this.prefillCustomer(result.data.customer);
      this.customerChoice.set('existing');
      this.duplicateMobileMessage.set('This mobile number is already registered. Use the Lookup button to load their details.');
    }
    this.messageService.add({
      severity: 'success',
      summary: 'Quotation ready',
      detail: `Quotation ${result.data?.quotation?.quote_reference || ''} was calculated by the database.`,
    });
    return Boolean(result.data?.quotation);
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

    const pdfInput = this.buildPdfInput();
    if (!pdfInput) {
      this.messageService.add({ severity: 'warn', summary: 'Quotation unavailable', detail: 'Could not build the quotation PDF.' });
      return;
    }

    if (channel === 'email') {
      if (!this.customer().email?.trim()) {
        this.messageService.add({ severity: 'warn', summary: 'Email missing', detail: 'Customer email is required before sending the quotation.' });
        return;
      }

      const { error } = await this.quotationEmail.sendQuotationEmail({
        to: this.customer().email,
        customerName: this.customer().full_name,
        quoteReference: pdfInput.quoteReference,
        advisorName: pdfInput.advisorName,
        advisorEmail: pdfInput.advisorEmail,
        finalAmount: pdfInput.amounts.finalAmount,
        pdfBase64: this.quotationPdf.buildPdfBase64(pdfInput),
        fileName: this.quotationPdf.buildFileName(pdfInput.quoteReference),
      });

      if (error) {
        this.messageService.add({ severity: 'error', summary: 'Email failed', detail: (error as any).message || 'Could not send quotation email.' });
        return;
      }

      await this.supabase.markQuotationSent(this.generatedBooking().id);
      this.sendState.update((current) => ({ ...current, [channel]: true }));
      this.messageService.add({ severity: 'success', summary: 'Quotation sent', detail: `Quotation sent to ${this.customer().email}.` });
      return;
    } else {
      const message = encodeURIComponent(this.buildCustomerShareMessage());
      const mobile = this.normalizedMobileWithCountryCode();

      if (channel === 'sms') {
        window.open(`sms:${mobile}?body=${message}`, '_blank');
      } else {
        window.open(`https://wa.me/${mobile}?text=${message}`, '_blank');
      }
    }

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
    const { error } = await this.supabase.confirmWalkInBooking(this.generatedBooking().id, this.advanceCollectionMode(), preferredChannel);
    this.confirmingBooking.set(false);

    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Confirmation failed', detail: (error as any).message || 'Could not confirm this booking.' });
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Booking submitted',
      detail: 'Admin has been notified for approval.',
    });
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  async confirmOfflineCollection() {
    if (!this.generatedBooking()?.id || !this.generatedQuotation()) {
      return;
    }

    if (this.offlinePaymentRecorded()) {
      this.messageService.add({ severity: 'info', summary: 'Already recorded', detail: 'Offline advance payment has already been recorded for this booking.' });
      return;
    }

    this.recordingOfflinePayment.set(true);
    const { data, error } = await this.supabase.recordOfflineAdvancePayment(
      this.generatedBooking().id,
      Number(this.generatedQuotation()?.advance ?? 0)
    );
    this.recordingOfflinePayment.set(false);

    if (error || !data) {
      this.messageService.add({
        severity: 'error',
        summary: 'Recording failed',
        detail: (error as any)?.message || 'Could not record the offline advance payment.',
      });
      return;
    }

    this.offlinePaymentRecorded.set(true);
    this.messageService.add({ severity: 'success', summary: 'Payment recorded', detail: 'Offline advance payment recorded' });
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
    const input = this.buildPdfInput();
    if (!input) {
      return null;
    }

    return this.quotationPdf.buildPdfBlob(input);
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

  protected formatCurrency(value: number) {
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
  }

  quotationAmount(field: string) {
    return Number(this.generatedQuotation()?.[field] ?? 0);
  }

  private buildPdfInput() {
    const quotation = this.generatedQuotation();
    const booking = this.generatedBooking();
    const vehicle = this.selectedVehicle();
    if (!quotation || !booking || !vehicle) {
      return null;
    }

    return {
      companyName: 'AUTOFLOW',
      companySubtitle: 'Fleet Operations',
      quoteReference: quotation.quote_reference || 'DRAFT',
      bookingId: booking.id || '-',
      issueDate: this.formatDocumentDate(quotation.created_at || booking.created_at || new Date().toISOString()),
      validUntil: this.formatDocumentDate(this.addDays(quotation.created_at || booking.created_at || new Date().toISOString(), 7)),
      advisorName: this.advisorContact().name,
      advisorEmail: this.advisorContact().email,
      customerName: this.customer().full_name || '-',
      customerMobile: this.normalizeMobile(this.customer().mobile) || '-',
      customerEmail: this.customer().email || '-',
      customerLicenseNo: this.customer().license_no || '-',
      customerType: this.customer().customer_type || '-',
      vehicleName: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Vehicle',
      vehicleFuelType: vehicle.fuel || vehicle.fuel_type || '-',
      vehicleTransmission: vehicle.transmission || '-',
      vehicleYear: String(vehicle.year || '-'),
      pickupLocation: this.trip().pickup_location || '-',
      dropLocation: this.trip().drop_location || '-',
      pickupDateTime: `${this.formatDocumentDate(this.trip().pickup_date)} ${this.trip().pickup_time || ''}`.trim(),
      dropDateTime: `${this.formatDocumentDate(this.trip().end_date)} ${this.trip().dropoff_time || ''}`.trim(),
      durationLabel: `${quotation.days || this.totalDays()} day(s)`,
      purpose: this.trip().purpose || '-',
      passengers: String(this.trip().number_of_passengers || '-'),
      paymentStatusLabel: booking.payment_status || 'pending',
      fuelPolicy: quotation.fuel_policy || 'Full-to-Full',
      amounts: {
        dailyRate: this.quotationAmount('rate'),
        days: Number(quotation.days || this.totalDays()),
        baseCost: this.quotationAmount('base_cost'),
        gst: this.quotationAmount('gst'),
        discountAmount: this.quotationAmount('discount_amount'),
        advance: this.quotationAmount('advance'),
        securityDeposit: this.quotationAmount('security_deposit'),
        finalAmount: this.quotationAmount('final_amount'),
        extraMileageRate: this.quotationAmount('extra_mileage_rate'),
      },
    };
  }

  private buildCustomerShareMessage() {
    return `Hi ${this.customer().full_name}, here is your quotation ${this.generatedQuotation()?.quote_reference || 'Quotation'} from AUTOFLOW Fleet Operations. Amount: ${this.formatCurrency(this.quotationAmount('final_amount'))}. Please contact us to confirm your booking.`;
  }

  private normalizedMobileWithCountryCode() {
    const mobile = this.normalizeMobile(this.customer().mobile);
    return mobile.startsWith('91') && mobile.length > 10 ? mobile : `91${mobile}`;
  }

  private formatDocumentDate(value: string | Date | null | undefined) {
    if (!value) {
      return '-';
    }
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private addDays(value: string | Date, days: number) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  pricingResolved() {
    return this.quotationAmount('final_amount') > 0;
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

  adminVehicleCard(vehicle: any, index: number) {
    const tier = vehicle?.tier ?? vehicle?.vehicle_tiers ?? {};
    return normalizeVehicle(
      {
        ...vehicle,
        daily_rate: tier.daily_rate ?? vehicle?.daily_rate,
      },
      index
    );
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

  isVehicleUnavailable(vehicle: any) {
    return !this.canBookVehicle(vehicle);
  }

  canBookVehicle(vehicle: any) {
    const status = String(vehicle?.availability_status ?? vehicle?.vehicle_status ?? vehicle?.vehicleStatus ?? '').toLowerCase();
    return status === 'available' && vehicle?.is_available_for_selected_dates !== false;
  }

  vehicleStatusLabel(vehicle: any, fallbackStatus?: string) {
    const status = String(vehicle?.availability_status ?? vehicle?.vehicle_status ?? vehicle?.vehicleStatus ?? '').toLowerCase();
    switch (status) {
      case 'booked':
        return 'Booked';
      case 'in_service':
        return 'In Service';
      case 'maintenance':
      case 'dirty':
        return 'In Maintenance';
      case 'deleted':
      case 'inactive':
        return 'Inactive';
      default:
        return fallbackStatus || 'Available';
    }
  }

  vehicleStatusTone(vehicle: any) {
    const status = String(vehicle?.availability_status ?? vehicle?.vehicle_status ?? vehicle?.vehicleStatus ?? '').toLowerCase();
    if (status === 'booked') {
      return 'booked';
    }
    if (status === 'in_service') {
      return 'in-service';
    }
    if (status === 'maintenance' || status === 'dirty' || status === 'inactive' || status === 'deleted') {
      return 'maintenance';
    }
    return 'available';
  }

  vehicleAvailabilityCaption(vehicle: any) {
    if (!vehicle) {
      return 'Availability information is unavailable.';
    }

    if (vehicle?.is_available_for_selected_dates === false) {
      return vehicle?.availability_date
        ? `Available from ${new Date(vehicle.availability_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} for the selected dates.`
        : 'This vehicle is booked for the selected dates.';
    }

    const status = String(vehicle?.availability_status ?? vehicle?.vehicle_status ?? vehicle?.vehicleStatus ?? '').toLowerCase();
    if (status === 'available') {
      return 'Available now';
    }

    const nextDate = vehicle?.availability_date ?? vehicle?.next_available_date ?? null;
    if (nextDate) {
      return `Available from ${new Date(nextDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    return status === 'in_service' ? 'Currently in service' : status === 'maintenance' ? 'Currently in maintenance' : 'Date TBD';
  }

  private async ensureExistingCustomerForMobile() {
    const mobile = this.normalizeMobile(this.customer().mobile);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return false;
    }

    const { data } = await this.supabase.findCustomerByMobile(mobile);
    if (!data?.id) {
      this.duplicateMobileMessage.set('');
      return false;
    }

    this.existingCustomer.set(data);
    this.prefillCustomer(data);
    this.customerChoice.set('existing');
    this.duplicateMobileMessage.set('This mobile number is already registered. Use the Lookup button to load their details.');
    return true;
  }

  private prefillCustomer(data: any) {
    this.customer.update((current) => ({
      ...current,
      full_name: data.full_name || '',
      mobile: data.mobile || current.mobile,
      email: data.email || '',
      license_no: data.license_no || '',
      license_expiry: data.license_expiry ? new Date(data.license_expiry) : null,
      customer_type: data.customer_type === 'business' ? 'business' : 'individual',
      business_name: data.business_name || '',
      gst_number: data.gst_number || '',
      id_proof_url: data.id_proof_url || '',
      id_proof_name: data.id_proof_url ? 'Existing proof on file' : '',
    }));
    this.idProofFileSize.set('');
  }

  private formatFileSize(size: number) {
    if (!size) {
      return '';
    }

    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
