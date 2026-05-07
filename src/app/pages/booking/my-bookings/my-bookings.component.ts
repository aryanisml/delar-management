import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { QuotationPdfInput, QuotationPdfService } from '../../../services/quotation-pdf';
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
  private route = inject(ActivatedRoute);
  private quotationPdf = inject(QuotationPdfService);

  private bookingChannel: any = null;
  private routeSubscription: any = null;
  private pendingBookingIdToOpen: string | null = null;

  readonly bookings = signal<any[]>([]);
  readonly bulkBookings = signal<any[]>([]);
  readonly activeTab = signal<'single' | 'bulk'>('single');
  readonly detailVisible = signal(false);
  readonly selectedBooking = signal<any | null>(null);
  readonly selectedPayment = signal<any | null>(null);
  readonly advisorContact = signal<{ name: string; email: string }>({ name: 'Rental Advisor', email: 'advisor@autoflow.in' });

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
      this.advisorContact.set({
        name: (user.user_metadata as Record<string, string> | undefined)?.['full_name'] || user.email?.split('@')[0] || 'Rental Advisor',
        email: user.email || 'advisor@autoflow.in',
      });
      this.bookingChannel = this.supabase.subscribeToMyBookingChanges(user.id, () => this.loadData());
    }
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.pendingBookingIdToOpen = params.get('bookingId');
      void this.tryAutoOpenBooking();
    });
    await this.loadData();
  }

  ngOnDestroy() {
    this.bookingChannel?.unsubscribe();
    this.routeSubscription?.unsubscribe?.();
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
    await this.tryAutoOpenBooking();
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  statusLabel(status: string) {
    return labelForStatus(status);
  }

  paymentBadgeLabel(payment: any) {
    return this.paymentPresentation(payment).label;
  }

  paymentBadgeSeverity(payment: any): 'success' | 'warn' | 'secondary' {
    return this.paymentPresentation(payment).severity;
  }

  hasPaidPayment(payment: any) {
    return this.paymentPresentation(payment).isPaid;
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

  async openInspection(row: any) {
    await this.router.navigate(['/dealer/inspection', row.id]);
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

  async downloadPaymentConfirmation(booking: any) {
    const { data: quotation, error } = await this.supabase.getQuotationByBooking(booking.id);
    if (error || !quotation) {
      this.messageService.add({ severity: 'error', summary: 'Quotation unavailable', detail: 'No quotation found.' });
      return;
    }

    const input = this.buildQuotationPdfInput(booking, quotation);
    if (!input) {
      this.messageService.add({ severity: 'error', summary: 'Quotation unavailable', detail: 'No quotation found.' });
      return;
    }

    const blob = this.quotationPdf.buildPdfBlob(input);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.quotationPdf.buildFileName(input.quoteReference);
    link.click();
    URL.revokeObjectURL(url);
  }

  paymentDetailLines(payment: any) {
    return this.paymentPresentation(payment).detailLines;
  }

  paymentPanelClasses(payment: any) {
    const severity = this.paymentPresentation(payment).severity;
    return {
      'border-green-200 bg-green-50': severity === 'success',
      'border-amber-200 bg-amber-50': severity === 'warn',
      'border-gray-200 bg-gray-50': severity === 'secondary',
    };
  }

  paymentIconClasses(payment: any) {
    const severity = this.paymentPresentation(payment).severity;
    return {
      'pi-check-circle text-green-600': severity === 'success',
      'pi-clock text-amber-600': severity === 'warn',
      'pi-minus-circle text-gray-500': severity === 'secondary',
    };
  }

  paymentHeadingClasses(payment: any) {
    const severity = this.paymentPresentation(payment).severity;
    return {
      'text-green-700': severity === 'success',
      'text-amber-700': severity === 'warn',
      'text-gray-700': severity === 'secondary',
    };
  }

  hasAnyPayment(payment: any) {
    return Boolean(payment);
  }

  private paymentPresentation(payment: any): { label: string; severity: 'success' | 'warn' | 'secondary'; detailLines: string[]; isPaid: boolean } {
    if (!payment) {
      return {
        label: 'Not Initiated',
        severity: 'secondary',
        detailLines: ['No payment transaction has been initiated for this booking yet.'],
        isPaid: false,
      };
    }

    const status = String(payment.status ?? '').toLowerCase();
    const mode = String(payment.payment_mode ?? '').toLowerCase();
    const amount = this.formatCurrency(Number(payment.amount ?? 0));

    if (status === 'paid') {
      if (mode === 'cash') {
        return {
          label: 'Advance Paid - Offline',
          severity: 'success',
          detailLines: [
            `Collected by advisor on ${this.formatDateTime(payment.created_at)}`,
            `Amount: ${amount}`,
          ],
          isPaid: true,
        };
      }

      return {
        label: 'Advance Paid - Online',
        severity: 'success',
        detailLines: [
          `Transaction Ref: ${payment.cf_payment_id || payment.cf_order_id || '-'}`,
          `Paid At: ${this.formatDateTime(payment.updated_at || payment.created_at)}`,
          `Amount: ${amount}`,
        ],
        isPaid: true,
      };
    }

    return {
      label: 'Payment Pending',
      severity: 'warn',
      detailLines: [`Latest status: ${String(payment.status || 'initiated').replace(/_/g, ' ')}`],
      isPaid: false,
    };
  }

  private async tryAutoOpenBooking() {
    if (!this.pendingBookingIdToOpen) {
      return;
    }

    const row = this.bookings().find((booking) => booking.id === this.pendingBookingIdToOpen);
    if (!row) {
      return;
    }

    this.pendingBookingIdToOpen = null;
    await this.openDetail(row);
  }

  private buildQuotationPdfInput(booking: any, quotation: any): QuotationPdfInput | null {
    const vehicleName = booking.vehicle_display || `${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim() || 'Vehicle';
    if (!booking?.id || !quotation) {
      return null;
    }

    return {
      companyName: 'AUTOFLOW',
      companySubtitle: 'Fleet Operations',
      quoteReference: quotation.quote_reference || this.quoteReference(booking),
      bookingId: booking.id || '-',
      issueDate: this.formatDate(quotation.created_at || booking.created_at),
      validUntil: this.formatDate(this.addDays(quotation.created_at || booking.created_at || new Date().toISOString(), 7)),
      advisorName: this.advisorContact().name,
      advisorEmail: this.advisorContact().email,
      customerName: booking.customer?.full_name || quotation.customer_name || '-',
      customerMobile: booking.customer?.mobile || quotation.mobile || '-',
      customerEmail: booking.customer?.email || quotation.email || '-',
      customerLicenseNo: quotation.license || quotation.licence_number || '-',
      customerType: quotation.customer_type || 'individual',
      vehicleName,
      vehicleFuelType: booking.vehicle?.fuel || '-',
      vehicleTransmission: booking.vehicle?.transmission || '-',
      vehicleYear: String(booking.vehicle?.year || '-'),
      pickupLocation: booking.pickup_location || '-',
      dropLocation: booking.drop_location || '-',
      pickupDateTime: `${this.formatDate(booking.start_date)} ${booking.pickup_time || ''}`.trim(),
      dropDateTime: `${this.formatDate(booking.end_date)} ${booking.dropoff_time || ''}`.trim(),
      durationLabel: `${quotation.days || 1} day(s)`,
      purpose: booking.purpose || '-',
      passengers: String(booking.number_of_passengers || '-'),
      paymentStatusLabel: this.paymentBadgeLabel(this.selectedPayment() || booking.latest_payment),
      fuelPolicy: quotation.fuel_policy || 'Full-to-Full',
      amounts: {
        dailyRate: Number(quotation.rate ?? 0),
        days: Number(quotation.days ?? 1),
        baseCost: Number(quotation.base_cost ?? 0),
        gst: Number(quotation.gst ?? 0),
        discountAmount: Number(quotation.discount_amount ?? 0),
        advance: Number(quotation.advance ?? 0),
        securityDeposit: Number(quotation.security_deposit ?? 0),
        finalAmount: Number(quotation.final_amount ?? booking.total_price ?? 0),
        extraMileageRate: Number(quotation.extra_mileage_rate ?? 0),
      },
    };
  }

  private addDays(value: string | Date, days: number) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  }

  private formatDate(value?: string | Date | null) {
    return value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  }

  private formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
  }
}
