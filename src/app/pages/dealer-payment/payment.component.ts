import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { environment } from '../../../environments/environment';
import { BookingFlowService } from '../../services/booking-flow';
import { QuotationPdfService } from '../../services/quotation-pdf';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-payment-page',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    ButtonModule,
    CardModule,
    DialogModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    ToastModule,
  ],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
  providers: [MessageService],
})
export class PaymentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private flow = inject(BookingFlowService);
  private messageService = inject(MessageService);
  private quotationPdf = inject(QuotationPdfService);

  readonly loading = signal(true);
  readonly quotation = signal<any | null>(null);
  readonly existingPayment = signal<any | null>(null);
  readonly pricingSource = signal<'database' | 'local'>('database');
  readonly paymentDialogVisible = signal(false);
  readonly processingPayment = signal(false);
  readonly justReturnedFromCashfree = signal(false);

  readonly booking = this.flow.booking;
  readonly vehicle = this.flow.vehicle;
  readonly duration = this.flow.duration;

  readonly resolvedPricing = computed(() => {
    const quotation = this.quotation();
    if (quotation?.final_amount) {
      return {
        rate: Number(quotation.rate ?? 0),
        days: Number(quotation.days ?? this.duration().totalDays),
        base_cost: Number(quotation.base_cost ?? 0),
        gst: Number(quotation.gst ?? 0),
        final_amount: Number(quotation.final_amount ?? 0),
        security_deposit: Number(quotation.security_deposit ?? 0),
        advance: Number(quotation.advance ?? 0),
        extra_mileage_rate: Number(quotation.extra_mileage_rate ?? 0),
        discount_amount: Number(quotation.discount_amount ?? 0),
        fuel_policy: quotation.fuel_policy ?? 'Full-to-Full',
      };
    }
    return this.supabase.buildQuotationPricingPreview(
      this.vehicle(),
      this.booking()?.start_date || '',
      this.booking()?.end_date || ''
    );
  });

  readonly amountDueNow = computed(() => {
    const p = this.resolvedPricing();
    const payment = this.existingPayment();
    if (String(payment?.payment_mode ?? '').toLowerCase() === 'pending_full' && String(payment?.status ?? '').toLowerCase() === 'initiated') {
      return Number(payment?.amount ?? p.final_amount ?? 0);
    }
    return Number(p.final_amount ?? 0) - Number(p.advance ?? 0);
  });
  readonly vehicleName = computed(() => `${this.vehicle()?.brand || this.vehicle()?.make || ''} ${this.vehicle()?.model || ''}`.trim() || 'Vehicle');
  readonly quoteReference = computed(() => this.quotation()?.quote_reference || `QT-${String(this.booking()?.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`);
  readonly isAlreadyPaid = computed(() => String(this.existingPayment()?.status ?? '').toLowerCase() === 'paid');
  readonly isPendingFullAwaitingApproval = computed(() =>
    String(this.existingPayment()?.payment_mode ?? '').toLowerCase() === 'pending_full'
    && String(this.existingPayment()?.status ?? '').toLowerCase() === 'initiated'
    && String(this.booking()?.status ?? '').toLowerCase() !== 'approved'
  );
  readonly canCollectFullPaymentNow = computed(() =>
    String(this.existingPayment()?.payment_mode ?? '').toLowerCase() === 'pending_full'
    && String(this.existingPayment()?.status ?? '').toLowerCase() === 'initiated'
    && String(this.booking()?.status ?? '').toLowerCase() === 'approved'
  );

  async ngOnInit() {
    const bookingId = this.route.snapshot.paramMap.get('bookingId');
    if (!bookingId) {
      await this.router.navigateByUrl('/dealer/my-bookings');
      return;
    }

    this.loading.set(true);
    const booking = await this.flow.loadBooking(bookingId);
    if (!booking) {
      this.loading.set(false);
      this.messageService.add({ severity: 'error', summary: 'Booking unavailable', detail: 'Could not load payment details.' });
      await this.router.navigateByUrl('/dealer/my-bookings');
      return;
    }

    const [quotationResult, paymentResult] = await Promise.all([
      this.supabase.getQuotationByBooking(bookingId),
      this.supabase.getPaymentByBooking(bookingId),
    ]);

    this.quotation.set(quotationResult.data ?? null);
    this.existingPayment.set(paymentResult.data ?? null);
    const cfOrderId = this.route.snapshot.queryParamMap.get('cf_order_id');
    if (cfOrderId) {
      this.justReturnedFromCashfree.set(true);
    }
    if (cfOrderId && String(paymentResult.data?.status ?? '').toLowerCase() === 'initiated') {
      const paymentMode = String(paymentResult.data?.payment_mode ?? '').toLowerCase();
      const isPendingFull = paymentMode === 'pending_full';
      const paymentType = String(paymentResult.data?.payment_type ?? '').toLowerCase();
      const updateResult = await this.supabase.markPaymentPaidAfterCashfree({
        bookingId,
        cfOrderId,
        paymentMode: 'online',
        notes: isPendingFull
          ? 'Full rental amount collected via online payment.'
          : (paymentResult.data?.notes || 'Advance collected via online payment. Remaining balance due after vehicle drop.'),
      });

      if (updateResult.data) {
        this.existingPayment.set(updateResult.data);
        this.messageService.add({
          severity: 'success',
          summary: isPendingFull ? 'Payment collected' : 'Payment complete',
          detail: isPendingFull
            ? `Full payment of ${this.formatCurrency(this.resolvedPricing().final_amount)} collected. Booking ready for inspection.`
            : paymentType === 'advance'
              ? `Required advance paid successfully. Remaining ${this.formatCurrency(Math.max(0, this.resolvedPricing().final_amount - this.resolvedPricing().advance))} due after vehicle drop.`
              : `Payment of ${this.formatCurrency(Number(paymentResult.data?.amount ?? this.amountDueNow()))} collected successfully.`,
        });
      } else if (paymentMode === 'online') {
        this.messageService.add({
          severity: 'warn',
          summary: 'Payment pending',
          detail: 'Advance payment was initiated, but confirmation has not completed yet.',
        });
      }
    }
    this.pricingSource.set(quotationResult.data?.final_amount ? 'database' : 'local');
    this.loading.set(false);
  }

  openPaymentDialog() {
    this.paymentDialogVisible.set(true);
  }

  async proceedToGateway() {
    const bookingId = this.booking()?.id;
    const amount = this.amountDueNow();

    if (!bookingId || !amount) {
      this.messageService.add({ severity: 'error', summary: 'Cannot proceed', detail: 'Booking or amount not available.' });
      return;
    }

    this.processingPayment.set(true);
    this.paymentDialogVisible.set(false);

    const isPendingFull = this.canCollectFullPaymentNow();
    const paymentType = String(this.existingPayment()?.payment_type ?? '').toLowerCase();
    const { data, error } = isPendingFull
      ? await this.supabase.createCashfreeOrderForPendingFullPayment(bookingId, amount)
      : await this.supabase.createCashfreeOrder(bookingId, this.quotation()?.id || '', amount);

    const orderData = data as any;
    if (error || !orderData?.payment_session_id) {
      this.processingPayment.set(false);
      const detail = (error as any)?.message || orderData?.error || 'Could not initiate payment.';
      this.messageService.add({ severity: 'error', summary: 'Payment initiation failed', detail });
      return;
    }

    try {
      const cashfree = window.Cashfree({ mode: environment.cashfreeMode });
      const result = await cashfree.checkout({
        paymentSessionId: orderData.payment_session_id,
        redirectTarget: '_self',
      });

      if (result?.error) {
        this.processingPayment.set(false);
        this.messageService.add({ severity: 'error', summary: 'Payment error', detail: result.error.message || 'Cashfree SDK error.' });
        return;
      }

      const updateResult = await this.supabase.markPaymentPaidAfterCashfree({
        bookingId,
        cfOrderId: orderData.cf_order_id,
        cfPaymentId: (result as any)?.cf_payment_id || (result as any)?.payment_id || null,
        paymentMode: 'online',
        notes: isPendingFull
          ? 'Full rental amount collected via online payment.'
          : (this.existingPayment()?.notes || 'Balance collected via online payment.'),
      });

      if (updateResult.error || !updateResult.data) {
        this.processingPayment.set(false);
        if (this.justReturnedFromCashfree() && String(this.existingPayment()?.payment_mode ?? '').toLowerCase() === 'online' && String(this.existingPayment()?.status ?? '').toLowerCase() === 'initiated') {
          this.messageService.add({
            severity: 'warn',
            summary: 'Payment pending',
            detail: 'Advance payment was initiated, but confirmation has not completed yet.',
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Payment update failed',
            detail: (updateResult.error as any)?.message || 'Cashfree returned, but the payment status could not be updated.',
          });
        }
        return;
      }

      this.existingPayment.set(updateResult.data);
      this.messageService.add({
        severity: 'success',
        summary: isPendingFull ? 'Payment collected' : 'Payment complete',
        detail: isPendingFull
          ? `Full payment of ${this.formatCurrency(amount)} collected. Booking ready for inspection.`
          : paymentType === 'advance'
            ? `Required advance paid successfully. Remaining ${this.formatCurrency(Math.max(0, this.resolvedPricing().final_amount - this.resolvedPricing().advance))} due after vehicle drop.`
            : `Payment of ${this.formatCurrency(amount)} collected successfully.`,
      });
      this.processingPayment.set(false);
    } catch (sdkErr: any) {
      this.processingPayment.set(false);
      this.messageService.add({ severity: 'error', summary: 'Payment error', detail: sdkErr?.message || 'Cashfree SDK error.' });
    }
  }

  async backToBookings() {
    await this.router.navigateByUrl('/dealer/my-bookings');
  }

  downloadQuotationPdf() {
    this.quotationPdf.downloadPdf(this.buildPdfInput(), `${this.quoteReference() || 'quotation'}.pdf`);
  }

  downloadReceiptPdf() {
    const payment = this.existingPayment();
    this.quotationPdf.downloadPdf({
      ...this.buildPdfInput(),
      documentTitle: 'PAYMENT RECEIPT',
      paymentSummaryTitle: 'Receipt Summary',
      paymentSummaryLabel: String(payment?.status ?? '').toLowerCase() === 'paid' ? 'Advance Paid - Online' : 'Payment Pending',
      paymentSummaryLines: [
        `Transaction Ref: ${payment?.cf_payment_id || payment?.cf_order_id || '-'}`,
        `Paid At: ${payment?.created_at ? new Date(payment.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'}`,
        `Amount: ${this.formatCurrency(payment?.amount || this.amountDueNow())}`,
      ],
    }, `receipt-${this.quoteReference() || 'payment'}.pdf`);
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value ?? 0));
  }

  private formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  }

  private buildPdfInput() {
    const pricing = this.resolvedPricing();
    return {
      companyName: 'AUTOFLOW',
      companySubtitle: 'Fleet Operations',
      quoteReference: this.quoteReference(),
      bookingId: this.booking()?.id || '-',
      issueDate: this.formatDate(this.quotation()?.created_at || this.booking()?.created_at || new Date().toISOString()),
      validUntil: this.formatDate(this.booking()?.created_at || new Date().toISOString()),
      advisorName: 'Rental Advisor',
      advisorEmail: 'advisor@autoflow.in',
      customerName: this.booking()?.customer?.full_name || this.quotation()?.customer_name || '-',
      customerMobile: this.booking()?.customer?.mobile || this.quotation()?.mobile || '-',
      customerEmail: this.booking()?.customer?.email || this.quotation()?.email || '-',
      customerLicenseNo: this.quotation()?.license || this.quotation()?.licence_number || '-',
      customerType: this.quotation()?.customer_type || 'individual',
      vehicleName: this.vehicleName(),
      vehicleBrand: this.vehicle()?.brand || this.vehicle()?.make || '-',
      vehicleModel: this.vehicle()?.model || '-',
      vehicleFuelType: this.vehicle()?.fuel || this.vehicle()?.fuel_type || '-',
      vehicleTransmission: this.vehicle()?.transmission || '-',
      vehicleYear: String(this.vehicle()?.year || '-'),
      pickupLocation: this.booking()?.pickup_location || '-',
      dropLocation: this.booking()?.drop_location || '-',
      pickupDateTime: `${this.formatDate(this.booking()?.start_date)} ${this.booking()?.pickup_time || ''}`.trim(),
      dropDateTime: `${this.formatDate(this.booking()?.end_date)} ${this.booking()?.dropoff_time || ''}`.trim(),
      durationLabel: `${pricing.days} day(s)`,
      purpose: this.booking()?.purpose || '-',
      passengers: String(this.booking()?.number_of_passengers || '-'),
      paymentStatusLabel: this.existingPayment()?.status || 'pending',
      paymentSummaryLabel: this.isAlreadyPaid()
        ? 'Advance Paid - Online'
        : this.canCollectFullPaymentNow()
          ? 'Full Payment Due Now'
          : this.isPendingFullAwaitingApproval()
            ? 'Awaiting Approval'
            : 'Payment Pending',
      paymentSummaryLines: this.existingPayment()
        ? [
            `Transaction Ref: ${this.existingPayment()?.cf_payment_id || this.existingPayment()?.cf_order_id || '-'}`,
            `Paid At: ${this.existingPayment()?.created_at ? new Date(this.existingPayment().created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'}`,
            `Amount: ${this.formatCurrency(this.existingPayment()?.amount || this.amountDueNow())}`,
          ]
        : [`Amount Due: ${this.formatCurrency(this.amountDueNow())}`],
      fuelPolicy: pricing.fuel_policy || 'Full-to-Full',
      footerNote: 'System generated by AUTOFLOW Fleet Operations',
      amounts: {
        dailyRate: Number(pricing.rate ?? 0),
        days: Number(pricing.days ?? 0),
        baseCost: Number(pricing.base_cost ?? 0),
        gst: Number(pricing.gst ?? 0),
        discountAmount: Number(pricing.discount_amount ?? 0),
        advance: Number(pricing.advance ?? 0),
        securityDeposit: Number(pricing.security_deposit ?? 0),
        finalAmount: Number(pricing.final_amount ?? 0),
        extraMileageRate: Number(pricing.extra_mileage_rate ?? 0),
      },
    };
  }
}
