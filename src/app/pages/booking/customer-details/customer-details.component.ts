import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { BookingCustomerDetails, BookingFlowService } from '../../../services/booking-flow';
import { SupabaseService } from '../../../services/supabase';

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DatePipe,
    DatePickerModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TagModule,
    ToastModule,
  ],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.scss',
  providers: [MessageService],
})
export class CustomerDetailsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private flow = inject(BookingFlowService);
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private suggestionTimer: ReturnType<typeof setTimeout> | null = null;

  readonly submitted = signal(false);
  readonly suggestions = signal<any[]>([]);
  readonly suggestionField = signal<'mobile' | 'email' | null>(null);
  readonly searching = signal(false);
  readonly returningCustomer = signal(false);
  readonly booking = this.flow.booking;
  readonly vehicle = this.flow.vehicle;
  readonly durationLabel = this.flow.durationLabel;
  readonly customer = signal<BookingCustomerDetails>(this.flow.customer());

  readonly steps = ['Vehicle', 'Trip Details', 'Customer Info', 'Quotation', 'Confirm'];
  readonly customerTypes = [
    { label: 'Individual', value: 'individual' },
    { label: 'Business', value: 'business' },
  ];
  readonly countryCodes = ['+91', '+1', '+44', '+971', '+61'].map((code) => ({ label: code, value: code }));
  readonly idProofTypes = ['Aadhaar', 'Passport', 'PAN'].map((value) => ({ label: value, value }));

  readonly licenceStatus = computed(() => {
    const expiry = this.customer().licenceExpiry;
    if (!expiry) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(expiry);
    expiryDate.setHours(0, 0, 0, 0);
    const days = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
      return { severity: 'danger' as const, label: 'Licence expired' };
    }
    if (days <= 30) {
      return { severity: 'warn' as const, label: `Expires in ${days} day(s)` };
    }
    return { severity: 'success' as const, label: 'Licence valid' };
  });

  async ngOnInit() {
    const bookingId = this.route.snapshot.paramMap.get('bookingId');
    if (!bookingId) {
      await this.router.navigateByUrl('/dealer/my-bookings');
      return;
    }

    const booking = await this.flow.loadBooking(bookingId);
    if (!booking) {
      this.messageService.add({ severity: 'error', summary: 'Booking unavailable', detail: 'Could not load booking details.' });
      await this.router.navigateByUrl('/dealer/my-bookings');
      return;
    }

    this.customer.set(this.flow.customer());
  }

  update(field: keyof BookingCustomerDetails, value: any) {
    this.customer.update((current) => ({ ...current, [field]: value }));

    if (field === 'mobile' || field === 'email') {
      this.queueCustomerSearch(field);
    }
  }

  async queueCustomerSearch(fieldHint?: 'mobile' | 'email') {
    if (this.suggestionTimer) {
      clearTimeout(this.suggestionTimer);
    }

    this.suggestionTimer = setTimeout(async () => {
      const mobile = this.customer().mobile?.trim() ?? '';
      const email = this.customer().email?.trim() ?? '';
      const field =
        fieldHint === 'mobile' && mobile.length >= 5
          ? 'mobile'
          : fieldHint === 'email' && email.length >= 3 && email.includes('@')
            ? 'email'
            : mobile.length >= 5
              ? 'mobile'
              : email.length >= 3 && email.includes('@')
                ? 'email'
                : null;
      const query = field === 'mobile' ? mobile : email;
      if (!field) {
        this.suggestions.set([]);
        this.suggestionField.set(null);
        return;
      }

      this.searching.set(true);
      const { data, error } = await this.supabase.searchCustomersByField(field, query);
      this.searching.set(false);
      if (error) {
        this.messageService.add({ severity: 'error', summary: 'Search failed', detail: 'Could not search returning customers.' });
        return;
      }
      this.suggestions.set(data ?? []);
      this.suggestionField.set(field);
    }, 260);
  }

  selectSuggestion(row: any) {
    this.customer.set({
      ...this.customer(),
      fullName: row.full_name ?? row.name ?? '',
      countryCode: row.country_code ?? this.customer().countryCode,
      mobile: row.mobile ?? '',
      email: row.email ?? '',
      licenceNumber: row.license ?? row.licence_number ?? row.driving_licence_number ?? '',
      licenceExpiry: row.license_expiry ? new Date(row.license_expiry) : this.customer().licenceExpiry,
      customerType: row.customer_type === 'business' ? 'business' : 'individual',
      businessName: row.business_name ?? '',
      gstNumber: row.gst_number ?? '',
    });
    this.returningCustomer.set(true);
    this.suggestions.set([]);
    this.suggestionField.set(null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.customer.update((current) => ({
        ...current,
        idProofFileName: file.name,
        idProofPreview: String(reader.result ?? ''),
      }));
    };
    reader.readAsDataURL(file);
  }

  invalid(field: keyof BookingCustomerDetails) {
    if (!this.submitted()) {
      return false;
    }
    return Boolean(this.fieldError(field));
  }

  fieldError(field: keyof BookingCustomerDetails) {
    const value = this.customer()[field];
    switch (field) {
      case 'fullName':
        return value ? '' : 'Customer full name is required.';
      case 'mobile':
        return /^[6-9]\d{9}$/.test(String(value)) ? '' : 'Enter a valid 10-digit mobile number.';
      case 'email':
        return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? '' : 'Enter a valid email address.';
      case 'licenceNumber':
        return /^[a-zA-Z0-9-]{6,20}$/.test(String(value)) ? '' : 'Driving licence number is required.';
      case 'licenceExpiry':
        return value ? '' : 'Driving licence expiry date is required.';
      case 'businessName':
        return this.customer().customerType !== 'business' || value ? '' : 'Business name is required.';
      case 'gstNumber':
        return this.customer().customerType !== 'business' || /^[0-9A-Z]{15}$/.test(String(value).toUpperCase())
          ? ''
          : 'Enter a valid 15-character GST number.';
      default:
        return '';
    }
  }

  formInvalid() {
    const required: Array<keyof BookingCustomerDetails> = ['fullName', 'mobile', 'email', 'licenceNumber', 'licenceExpiry'];
    const business: Array<keyof BookingCustomerDetails> = this.customer().customerType === 'business' ? ['businessName', 'gstNumber'] : [];
    return [...required, ...business].some((field) => Boolean(this.fieldError(field)));
  }

  async back() {
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  async continueToQuotation() {
    this.submitted.set(true);
    if (this.formInvalid()) {
      this.messageService.add({ severity: 'warn', summary: 'Check customer details', detail: 'Please resolve the highlighted fields.' });
      return;
    }

    this.flow.setCustomer(this.customer());
    const bookingId = this.route.snapshot.paramMap.get('bookingId');
    await this.router.navigate(['/dealer/booking', bookingId, 'quotation']);
  }
}
