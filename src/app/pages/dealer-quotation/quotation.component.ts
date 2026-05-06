import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { BookingFlowService } from '../../services/booking-flow';
import { QuotationEmailService } from '../../services/quotation-email.service';
import { QuotationPdfService } from '../../services/quotation-pdf';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-quotation',
  standalone: true,
  templateUrl: './quotation.component.html',
  styleUrl: './quotation.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DialogModule,
    InputTextModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
})
export class QuotationComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  private sanitizer = inject(DomSanitizer);
  private quotationPdf = inject(QuotationPdfService);
  private quotationEmail = inject(QuotationEmailService);
  readonly flow = inject(BookingFlowService);

  readonly loading = signal(false);
  readonly promoCode = signal('');
  readonly promoMessage = signal('');
  readonly discount = signal(0);
  readonly previewVisible = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewResource = signal<SafeResourceUrl | null>(null);
  readonly termsOpen = signal(false);
  readonly advisor = signal<{ name: string; id: string; email: string }>({ name: 'Rental Advisor', id: 'advisor', email: 'advisor@autoflow.in' });

  readonly booking = this.flow.booking;
  readonly vehicle = this.flow.vehicle;
  readonly customer = this.flow.customer;
  readonly duration = this.flow.duration;
  readonly durationLabel = this.flow.durationLabel;

  readonly referenceNumber = computed(() => {
    const id = this.booking()?.id || this.route.snapshot.paramMap.get('bookingId') || 'DRAFT';
    return `QT-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  });

  readonly pricing = computed(() => this.supabase.buildQuotationPricingPreview(
    this.vehicle(),
    this.booking()?.start_date || '',
    this.booking()?.end_date || '',
    {
      discountAmount: this.discount(),
      fuelPolicy: this.vehicle()?.fuel_policy ?? this.vehicle()?.fuelPolicy ?? 'Full-to-Full',
    }
  ));
  readonly rate = computed(() => this.pricing().rate);
  readonly billableDays = computed(() => this.pricing().days);
  readonly baseCost = computed(() => this.pricing().base_cost);
  readonly securityDeposit = computed(() => this.pricing().security_deposit);
  readonly advance = computed(() => this.pricing().advance);
  readonly gst = computed(() => this.pricing().gst);
  readonly extraMileageRate = computed(() => this.pricing().extra_mileage_rate);
  readonly fuelPolicy = computed(() => this.pricing().fuel_policy);
  readonly isOutstation = computed(() => String(this.booking()?.purpose ?? '').toLowerCase().includes('outstation'));
  readonly grandTotal = computed(() => this.pricing().final_amount);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('bookingId');
    if (!id) {
      await this.router.navigate(['/dealer/my-bookings']);
      return;
    }

    this.loading.set(true);
    const [booking, user] = await Promise.all([this.flow.loadBooking(id), this.supabase.getCurrentUser()]);
    this.loading.set(false);

    if (!booking) {
      this.messageService.add({ severity: 'error', summary: 'Booking unavailable', detail: 'Could not load this quotation.' });
      await this.router.navigate(['/dealer/my-bookings']);
      return;
    }

    this.advisor.set({
      name: (user?.user_metadata as Record<string, string> | undefined)?.['full_name'] || user?.email?.split('@')[0] || 'Rental Advisor',
      id: user?.id || 'advisor',
      email: user?.email || 'advisor@autoflow.in',
    });
  }

  baseFormula() {
    return `${this.rate().toLocaleString('en-IN')}/day x ${this.billableDays()} = ${this.baseCost().toLocaleString('en-IN')}`;
  }

  async applyPromo() {
    const code = this.promoCode().trim().toUpperCase();
    this.promoMessage.set('');
    this.discount.set(0);

    if (!code) {
      return;
    }

    const { data, error } = await this.supabase.validatePromotion(code);
    if (error || !data) {
      this.promoMessage.set('Promo code is not active or could not be validated.');
      return;
    }

    const percent = Number(data.discount_percent ?? data.percent ?? 0);
    const amount = Number(data.discount_amount ?? data.amount ?? 0);
    const nextDiscount = percent > 0 ? (this.baseCost() * percent) / 100 : amount;
    this.discount.set(Math.min(this.baseCost(), Math.max(0, nextDiscount)));
    this.flow.patchQuotation({ promoCode: code, discount: this.discount() });
    this.promoMessage.set('Promo code applied.');
  }

  async saveQuotation(status: 'draft' | 'sent' | 'accepted') {
    if (!this.booking()) {
      return false;
    }

    const customer = this.customer();
    const payload = {
      booking_id: this.booking().id,
      quotation_ref: this.referenceNumber(),
      advisor_name: this.advisor().name,
      advisor_id: this.advisor().id,
      customer_name: customer.fullName,
      country_code: customer.countryCode,
      mobile: customer.mobile,
      email: customer.email,
      license: customer.licenceNumber,
      license_expiry: customer.licenceExpiry ? new Date(customer.licenceExpiry).toISOString() : null,
      customer_type: customer.customerType,
      business_name: customer.businessName,
      gst_number: customer.gstNumber,
      id_proof_type: customer.idProofType,
      id_proof_file_name: customer.idProofFileName,
      id_proof_preview: customer.idProofPreview,
      rate: this.rate(),
      days: this.billableDays(),
      duration_label: this.durationLabel(),
      base_cost: this.baseCost(),
      gst: this.gst(),
      advance: this.advance(),
      security_deposit: this.securityDeposit(),
      fuel_policy: this.fuelPolicy(),
      extra_mileage_rate: this.isOutstation() ? this.extraMileageRate() : null,
      promo_code: this.promoCode().trim().toUpperCase() || null,
      discount: this.discount(),
      discount_amount: this.discount(),
      final_amount: this.grandTotal(),
      status,
    };

    const { error } = await this.supabase.saveQuotationDraft(payload);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Save failed', detail: 'Failed to save quotation.' });
      return false;
    }

    return true;
  }

  async saveDraft() {
    if (!(await this.saveQuotation('draft'))) {
      return;
    }

    await this.supabase.updateBookingQuoteStatus(this.booking().id, 'draft');
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Quotation saved as draft.' });
  }

  async sendQuote(channel: 'Email' | 'SMS' | 'WhatsApp') {
    if (!(await this.saveQuotation('sent'))) {
      return;
    }

    if (channel === 'Email') {
      if (!this.customer().email?.trim()) {
        this.messageService.add({ severity: 'warn', summary: 'Email missing', detail: 'Customer email is required before sending the quotation.' });
        return;
      }

      const pdfInput = this.buildPdfInput();
      const { error } = await this.quotationEmail.sendQuotationEmail({
        to: this.customer().email,
        customerName: this.customer().fullName,
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

      await this.supabase.markQuotationSent(this.booking().id);
      await this.supabase.updateBookingQuoteStatus(this.booking().id, 'sent');
      this.messageService.add({ severity: 'success', summary: 'Quotation sent', detail: `Quotation sent to ${this.customer().email}.` });
      return;
    } else {
      const message = encodeURIComponent(this.buildCustomerShareMessage());
      const mobile = this.normalizedMobileWithCountryCode();
      if (channel === 'SMS') {
        window.open(`sms:${mobile}?body=${message}`, '_blank');
      } else {
        window.open(`https://wa.me/${mobile}?text=${message}`, '_blank');
      }
    }

    this.messageService.add({ severity: 'success', summary: 'Quotation sent', detail: `Prepared ${channel} handoff.` });
  }

  async confirmBooking() {
    if (!this.booking()) {
      return;
    }

    this.loading.set(true);
    const { data, error } = await this.supabase.submitQuotationRequest({
      booking: this.booking(),
      vehicle: this.vehicle(),
      customer: this.customer(),
      advisorName: this.advisor().name,
      pricing: {
        rate: this.rate(),
        days: this.billableDays(),
        duration_label: this.durationLabel(),
        base_cost: this.baseCost(),
        gst: this.gst(),
        advance: this.advance(),
        security_deposit: this.securityDeposit(),
        fuel_policy: this.fuelPolicy(),
        extra_mileage_rate: this.isOutstation() ? this.extraMileageRate() : null,
        extra_mileage_charge: 0,
        promo_code: this.promoCode().trim().toUpperCase() || null,
        discount_amount: this.discount(),
        final_amount: this.grandTotal(),
      },
    });
    this.loading.set(false);

    if (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Submission failed',
        detail: (error as any).message || 'Could not submit quotation for admin review.',
      });
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Submitted',
      detail: `Quotation ${data?.quotation?.quote_reference || ''} was submitted for admin approval.`,
    });
    await this.router.navigate(['/dealer/my-bookings']);
  }

  openPreview() {
    const previousUrl = this.previewUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    const blob = this.quotationPdf.buildPdfBlob(this.buildPdfInput());
    const url = URL.createObjectURL(blob);
    this.previewUrl.set(url);
    this.previewResource.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.previewVisible.set(true);
  }

  printPreview() {
    const url = this.previewUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  async backToCustomer() {
    await this.router.navigate(['/dealer/booking', this.booking().id, 'customer-details']);
  }

  private buildPdfInput() {
    return {
      companyName: 'AUTOFLOW',
      companySubtitle: 'Fleet Operations',
      quoteReference: this.referenceNumber(),
      bookingId: this.booking()?.id || '-',
      issueDate: this.formatDocumentDate(this.booking()?.created_at || new Date().toISOString()),
      validUntil: this.formatDocumentDate(this.addDays(this.booking()?.created_at || new Date().toISOString(), 7)),
      advisorName: this.advisor().name,
      advisorEmail: this.advisor().email,
      customerName: this.customer().fullName || '-',
      customerMobile: this.normalizeMobile(this.customer().mobile) || '-',
      customerEmail: this.customer().email || '-',
      customerLicenseNo: this.customer().licenceNumber || '-',
      customerType: this.customer().customerType || '-',
      vehicleName: `${this.vehicle()?.make || this.vehicle()?.brand || ''} ${this.vehicle()?.model || ''}`.trim() || 'Vehicle',
      vehicleFuelType: this.vehicle()?.fuel || this.vehicle()?.fuel_type || '-',
      vehicleTransmission: this.vehicle()?.transmission || '-',
      vehicleYear: String(this.vehicle()?.year || '-'),
      pickupLocation: this.booking()?.pickup_location || '-',
      dropLocation: this.booking()?.drop_location || '-',
      pickupDateTime: `${this.formatDocumentDate(this.booking()?.start_date)} ${this.booking()?.pickup_time || ''}`.trim(),
      dropDateTime: `${this.formatDocumentDate(this.booking()?.end_date)} ${this.booking()?.dropoff_time || ''}`.trim(),
      durationLabel: this.durationLabel(),
      purpose: this.booking()?.purpose || '-',
      passengers: String(this.booking()?.number_of_passengers || '-'),
      paymentStatusLabel: this.booking()?.payment_status || 'pending',
      fuelPolicy: this.fuelPolicy(),
      amounts: {
        dailyRate: this.rate(),
        days: this.billableDays(),
        baseCost: this.baseCost(),
        gst: this.gst(),
        discountAmount: this.discount(),
        advance: this.advance(),
        securityDeposit: this.securityDeposit(),
        finalAmount: this.grandTotal(),
        extraMileageRate: this.extraMileageRate(),
      },
    };
  }

  private buildCustomerShareMessage() {
    return `Hi ${this.customer().fullName}, here is your quotation ${this.referenceNumber()} from AUTOFLOW Fleet Operations. Amount: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(this.grandTotal())}. Please contact us to confirm your booking.`;
  }

  private normalizedMobileWithCountryCode() {
    const mobile = this.normalizeMobile(this.customer().mobile);
    return mobile.startsWith('91') && mobile.length > 10 ? mobile : `91${mobile}`;
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
}
