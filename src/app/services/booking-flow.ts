import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export type CustomerType = 'individual' | 'business';

export interface BookingCustomerDetails {
  fullName: string;
  countryCode: string;
  mobile: string;
  email: string;
  licenceNumber: string;
  licenceExpiry: Date | null;
  customerType: CustomerType;
  businessName: string;
  gstNumber: string;
  idProofType: 'Aadhaar' | 'Passport' | 'PAN';
  idProofFileName: string;
  idProofPreview: string;
}

export interface QuotationDraft {
  promoCode: string;
  discount: number;
}

@Injectable({ providedIn: 'root' })
export class BookingFlowService {
  private supabase = inject(SupabaseService);

  readonly bookingId = signal<string | null>(null);
  readonly booking = signal<any | null>(null);
  readonly vehicle = signal<any | null>(null);
  readonly customer = signal<BookingCustomerDetails>(this.emptyCustomer());
  readonly quotation = signal<QuotationDraft>({ promoCode: '', discount: 0 });
  readonly loading = signal(false);

  readonly duration = computed(() => this.calculateDuration(this.booking()));
  readonly durationLabel = computed(() => {
    const duration = this.duration();
    return `${duration.days} days ${duration.hours} hours`;
  });

  async loadBooking(bookingId: string, forceRefresh = false) {
    if (!forceRefresh && this.bookingId() === bookingId && this.booking()) {
      return this.booking();
    }

    this.loading.set(true);
    this.bookingId.set(bookingId);

    const { data, error } = await this.supabase.getBookingWithVehicle(bookingId);
    this.loading.set(false);

    if (error || !data) {
      this.booking.set(null);
      this.vehicle.set(null);
      return null;
    }

    this.booking.set(data);
    this.vehicle.set(data.vehicle ?? null);

    const quotation = await this.supabase.getQuotationByBooking(bookingId);
    if (quotation.data) {
      this.customer.set(this.customerFromQuotation(quotation.data));
    }

    return data;
  }

  setCustomer(details: BookingCustomerDetails) {
    this.customer.set({ ...details });
  }

  patchQuotation(draft: Partial<QuotationDraft>) {
    this.quotation.update((current) => ({ ...current, ...draft }));
  }

  emptyCustomer(): BookingCustomerDetails {
    return {
      fullName: '',
      countryCode: '+91',
      mobile: '',
      email: '',
      licenceNumber: '',
      licenceExpiry: null,
      customerType: 'individual',
      businessName: '',
      gstNumber: '',
      idProofType: 'Aadhaar',
      idProofFileName: '',
      idProofPreview: '',
    };
  }

  private calculateDuration(booking: any) {
    if (!booking?.start_date || !booking?.end_date) {
      return { days: 1, hours: 0, totalDays: 1 };
    }

    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalHours = Math.max(1, Math.ceil(diffMs / 3600000));
    const days = Math.max(1, Math.floor(totalHours / 24));
    const hours = totalHours % 24;

    return { days, hours, totalDays: Math.max(1, Math.ceil(totalHours / 24)) };
  }

  private customerFromQuotation(row: any): BookingCustomerDetails {
    return {
      ...this.emptyCustomer(),
      fullName: row.customer_name ?? '',
      countryCode: row.country_code ?? '+91',
      mobile: row.mobile ?? '',
      email: row.email ?? '',
      licenceNumber: row.license ?? row.licence_number ?? '',
      licenceExpiry: row.license_expiry ? new Date(row.license_expiry) : null,
      customerType: row.customer_type === 'business' ? 'business' : 'individual',
      businessName: row.business_name ?? '',
      gstNumber: row.gst_number ?? '',
      idProofType: row.id_proof_type ?? 'Aadhaar',
      idProofFileName: row.id_proof_file_name ?? '',
      idProofPreview: row.id_proof_preview ?? '',
    };
  }
}
