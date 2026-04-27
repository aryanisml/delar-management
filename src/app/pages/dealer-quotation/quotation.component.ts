import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { BookingFlowService } from '../../services/booking-flow';
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
  readonly flow = inject(BookingFlowService);

  readonly loading = signal(false);
  readonly promoCode = signal('');
  readonly promoMessage = signal('');
  readonly discount = signal(0);
  readonly previewVisible = signal(false);
  readonly termsOpen = signal(false);
  readonly advisor = signal<{ name: string; id: string }>({ name: 'Rental Advisor', id: 'advisor' });

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

    await this.supabase.updateBookingQuoteStatus(this.booking().id, 'sent');
    this.messageService.add({ severity: 'success', summary: 'Quotation sent', detail: `Sent via ${channel}.` });
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
    this.previewVisible.set(true);
  }

  printPreview() {
    window.print();
  }

  async backToCustomer() {
    await this.router.navigate(['/dealer/booking', this.booking().id, 'customer-details']);
  }
}
