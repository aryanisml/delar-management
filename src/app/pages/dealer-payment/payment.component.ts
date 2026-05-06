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

  readonly loading = signal(true);
  readonly quotation = signal<any | null>(null);
  readonly existingPayment = signal<any | null>(null);
  readonly pricingSource = signal<'database' | 'local'>('database');
  readonly paymentDialogVisible = signal(false);
  readonly processingPayment = signal(false);

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
    return Number(p.final_amount ?? 0) - Number(p.advance ?? 0);
  });
  readonly vehicleName = computed(() => `${this.vehicle()?.brand || this.vehicle()?.make || ''} ${this.vehicle()?.model || ''}`.trim() || 'Vehicle');
  readonly quoteReference = computed(() => this.quotation()?.quote_reference || `QT-${String(this.booking()?.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`);
  readonly isAlreadyPaid = computed(() =>
    Boolean(this.existingPayment())
    || this.booking()?.status === 'payment_received'
    || this.booking()?.payment_status === 'payment_received'
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
    this.pricingSource.set(quotationResult.data?.final_amount ? 'database' : 'local');
    this.loading.set(false);
  }

  openPaymentDialog() {
    this.paymentDialogVisible.set(true);
  }

  async proceedToGateway() {
    const bookingId = this.booking()?.id;
    const quotationId = this.quotation()?.id;
    const amount = this.amountDueNow();

    if (!bookingId || !amount) {
      this.messageService.add({ severity: 'error', summary: 'Cannot proceed', detail: 'Booking or amount not available.' });
      return;
    }

    this.processingPayment.set(true);
    this.paymentDialogVisible.set(false);

    const { data, error } = await this.supabase.createCashfreeOrder(bookingId, quotationId || '', amount);

    if (error || !data?.payment_session_id) {
      this.processingPayment.set(false);
      const detail = (error as any)?.message || data?.error || 'Could not initiate payment.';
      this.messageService.add({ severity: 'error', summary: 'Payment initiation failed', detail });
      return;
    }

    try {
      const cashfree = window.Cashfree({ mode: environment.cashfreeMode });
      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: '_self',
      });

      const paymentResult = await this.supabase.getPaymentByBooking(bookingId);
      this.existingPayment.set(paymentResult.data ?? null);
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
    const pricing = this.resolvedPricing();
    const lines = [
      `Quotation ${this.quoteReference()}`,
      `Vehicle: ${this.vehicleName()}`,
      `Pickup: ${this.booking()?.pickup_location || '-'} | ${this.formatDate(this.booking()?.start_date)} ${this.booking()?.pickup_time || ''}`.trim(),
      `Drop: ${this.booking()?.drop_location || '-'} | ${this.formatDate(this.booking()?.end_date)} ${this.booking()?.dropoff_time || ''}`.trim(),
      `Daily Rate: ${this.formatCurrency(pricing.rate)}`,
      `Days: ${pricing.days}`,
      `Base Cost: ${this.formatCurrency(pricing.base_cost)}`,
      `GST: ${this.formatCurrency(pricing.gst)}`,
      `Final Amount: ${this.formatCurrency(pricing.final_amount)}`,
      `Security Deposit: ${this.formatCurrency(pricing.security_deposit)}`,
      `Advance Due: ${this.formatCurrency(pricing.advance)}`,
    ];
    this.triggerPdfDownload(lines, `${this.quoteReference() || 'quotation'}.pdf`);
  }

  downloadReceiptPdf() {
    const payment = this.existingPayment();
    const booking = this.booking();
    const lines = [
      `PAYMENT RECEIPT`,
      ``,
      `Quote Reference: ${this.quoteReference()}`,
      `Booking ID: ${booking?.id || '-'}`,
      `Vehicle: ${this.vehicleName()}`,
      `Pickup: ${booking?.pickup_location || '-'} | ${this.formatDate(booking?.start_date)}`,
      `Drop: ${booking?.drop_location || '-'} | ${this.formatDate(booking?.end_date)}`,
      ``,
      `Amount Paid: ${this.formatCurrency(payment?.amount || this.amountDueNow())}`,
      `Payment Type: Balance Payment`,
      `Payment Mode: ${payment?.payment_mode || 'Online'}`,
      `Transaction Ref: ${payment?.cf_payment_id || payment?.cf_order_id || '-'}`,
      `Paid On: ${payment?.created_at ? new Date(payment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`,
      ``,
      `Status: ADVANCE PAYMENT CONFIRMED`,
    ];
    this.triggerPdfDownload(lines, `receipt-${this.quoteReference() || 'payment'}.pdf`);
  }

  private triggerPdfDownload(lines: string[], filename: string) {
    const content = [
      'BT',
      '/F1 12 Tf',
      '40 800 Td',
      ...lines.flatMap((line, i) => [`(${this.escapePdf(line)}) Tj`, i === lines.length - 1 ? '' : 'T*']),
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
    for (const obj of objects) { offsets.push(pdf.length); pdf += `${obj}\n`; }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value ?? 0));
  }

  private formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  }

  private escapePdf(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}
