import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Booking } from '../../../models/booking';
import { labelForStatus, tagSeverityForStatus } from '../../../admin-ui.models';
import { SupabaseService } from '../../../services/supabase';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, ConfirmDialogModule, CurrencyPipe, DatePipe, DialogModule, TableModule, TagModule, ToastModule],
  templateUrl: './my-bookings.component.html',
  providers: [ConfirmationService, MessageService],
})
export class MyBookingsComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  private bookingChannel: any = null;

  readonly bookings = signal<any[]>([]);
  readonly bulkBookings = signal<any[]>([]);
  readonly activeTab = signal<'single' | 'bulk'>('single');
  readonly detailVisible = signal(false);
  readonly selectedBooking = signal<any | null>(null);
  readonly selectedPayment = signal<any | null>(null);

  readonly groupedBulkRows = computed(() =>
    this.bulkBookings().map((bulk) => ({
      ...bulk,
      itemCount: (bulk.bookings ?? []).reduce((sum: number, booking: Booking) => sum + Number(booking.quantity ?? 1), 0),
      summary: (bulk.bookings ?? [])
        .map((booking: any) => `${booking.vehicle?.brand || booking.vehicle?.make || ''} ${booking.vehicle?.model || ''}`.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(', '),
    }))
  );

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    if (user) {
      this.bookingChannel = this.supabase.subscribeToMyBookingChanges(user.id, () => this.loadData());
    }
    await this.loadData();
  }

  ngOnDestroy() {
    this.bookingChannel?.unsubscribe();
  }

  async loadData() {
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

    const [{ data: bookings }, { data: bulkBookings }] = await Promise.all([
      this.supabase.getMyBookings(user.id),
      this.supabase.getMyBulkBookings(user.id),
    ]);

    this.bookings.set(
      (bookings ?? []).map((booking: any) => ({
        ...booking,
        vehicle_display: `${booking.vehicle?.brand || booking.vehicle?.make || ''} ${booking.vehicle?.model || ''}`.trim() || 'Unknown Vehicle',
      }))
    );
    this.bulkBookings.set(bulkBookings ?? []);
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  statusLabel(status: string) {
    return labelForStatus(status);
  }

  paymentBadgeLabel(payment: any) {
    if (payment) return 'Advance Paid';
    return 'Not Initiated';
  }

  paymentBadgeSeverity(payment: any): 'success' | 'secondary' {
    if (payment) return 'success';
    return 'secondary';
  }

  hasPaidPayment(payment: any) {
    return Boolean(payment);
  }

  quoteReference(row: any) {
    return row.quote_reference || `#${String(row.id || '').slice(0, 8).toUpperCase()}`;
  }

  hasPricing(row: any) {
    return Number(row.quotation?.final_amount ?? row.total_price ?? 0) > 0;
  }

  finalAmount(row: any) {
    return Number(row.quotation?.final_amount ?? row.total_price ?? 0);
  }

  daysRemaining(booking: any): number {
    if (!booking?.end_date) return 0;
    const end = new Date(`${booking.end_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / 86400000);
  }

  timerClasses(booking: any): Record<string, boolean> {
    const days = this.daysRemaining(booking);
    return {
      'border-gray-200 bg-gray-50 text-gray-500': days < 0,
      'border-red-200 bg-red-50 text-red-700': days >= 0 && days < 3,
      'border-amber-200 bg-amber-50 text-amber-700': days >= 3 && days <= 7,
      'border-green-200 bg-green-50 text-green-700': days > 7,
    };
  }

  timerLabel(booking: any): string {
    const days = this.daysRemaining(booking);
    if (days < 0) return 'Trip ended';
    if (days === 0) return 'Drop today';
    return 'days until drop';
  }

  async openDetail(row: any) {
    this.selectedBooking.set(row);
    this.selectedPayment.set(null);
    this.detailVisible.set(true);
    const { data } = await this.supabase.getPaymentByBooking(row.id);
    this.selectedPayment.set(data ?? row.latest_payment ?? null);
  }

  async openPayment(row: any) {
    await this.router.navigate(['/dealer/booking', row.id, 'payments']);
  }

  cancelBooking(row: any) {
    this.confirmationService.confirm({
      message: `Cancel booking ${row.id}?`,
      header: 'Confirm Cancellation',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonStyleClass: 'p-button-text',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        const { error } = await this.supabase.updateBookingStatus(row.id, 'cancelled');
        if (error) {
          this.messageService.add({ severity: 'error', summary: 'Cancellation failed', detail: error.message || 'Could not cancel booking.' });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Booking cancelled', detail: `Booking ${row.id} has been cancelled.` });
        await this.loadData();
      },
    });
  }

  downloadPaymentConfirmation(booking: any) {
    const payment = this.selectedPayment();
    const amount = payment?.amount ?? booking.quotation?.advance ?? 0;
    const lines = [
      'PAYMENT RECEIPT',
      '',
      `Quote Reference: ${this.quoteReference(booking)}`,
      `Booking ID: ${booking.id || '-'}`,
      `Vehicle: ${booking.vehicle_display || '-'}`,
      `Pickup: ${booking.pickup_location || '-'} | ${this.formatDate(booking.start_date)}`,
      `Drop: ${booking.drop_location || '-'} | ${this.formatDate(booking.end_date)}`,
      '',
      `Amount Paid: ${this.formatCurrency(Number(amount))}`,
      `Payment Type: Advance`,
      `Payment Mode: ${payment?.payment_mode || 'Online'}`,
      `Transaction Ref: ${payment?.cf_payment_id || payment?.cf_order_id || '-'}`,
      '',
      'Status: ADVANCE PAYMENT CONFIRMED',
    ];
    this.triggerPdfDownload(lines, `receipt-${this.quoteReference(booking)}.pdf`);
  }

  private triggerPdfDownload(lines: string[], filename: string) {
    const content = [
      'BT',
      '/F1 12 Tf',
      '40 800 Td',
      ...lines.flatMap((line, i) => [`(${this.escapePdf(line)}) Tj`, i === lines.length - 1 ? '' : 'T*']),
      'ET',
    ].filter(Boolean).join('\n');

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

  private escapePdf(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  }

  private formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  }
}
