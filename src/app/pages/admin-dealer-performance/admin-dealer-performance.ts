import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { labelForStatus, tagSeverityForStatus } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

type LedgerTab = 'all' | 'pending' | 'approved' | 'payment_received' | 'in_service' | 'completed' | 'rejected' | 'cancelled';

@Component({
  selector: 'app-admin-dealer-performance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ConfirmDialogModule,
    CurrencyPipe,
    DatePipe,
    DialogModule,
    InputTextModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
  ],
  templateUrl: './admin-dealer-performance.html',
  styleUrl: './admin-dealer-performance.scss',
  providers: [ConfirmationService, MessageService],
})
export class AdminDealerPerformance implements OnInit, OnDestroy {
  @ViewChild('detailDialogContent') detailDialogContent?: ElementRef<HTMLElement>;

  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  private bookingChannel: any = null;

  readonly loading = signal(false);
  readonly activeTab = signal<LedgerTab>('pending');
  readonly search = signal('');
  readonly allBookings = signal<any[]>([]);
  readonly detailVisible = signal(false);
  readonly selectedDetail = signal<any | null>(null);
  readonly selectedPayment = signal<any | null>(null);
  readonly rejectDialogVisible = signal(false);
  readonly rejectDialogBooking = signal<any | null>(null);
  readonly rejectReason = signal('');

  readonly tabs: { key: LedgerTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'payment_received', label: 'Payment Received' },
    { key: 'in_service', label: 'In Service' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  readonly tabCounts = computed(() => {
    const b = this.allBookings();
    return {
      all: b.length,
      pending: b.filter((r) => r.status === 'pending').length,
      approved: b.filter((r) => r.status === 'approved').length,
      payment_received: b.filter((r) => r.status === 'payment_received').length,
      in_service: b.filter((r) => r.status === 'in_service').length,
      completed: b.filter((r) => r.status === 'completed').length,
      rejected: b.filter((r) => r.status === 'rejected').length,
      cancelled: b.filter((r) => r.status === 'cancelled').length,
    };
  });

  readonly filteredBookings = computed(() => {
    const tab = this.activeTab();
    const query = this.search().trim().toLowerCase();
    let rows = tab === 'all' ? this.allBookings() : this.allBookings().filter((r) => r.status === tab);
    if (query) {
      rows = rows.filter((r) =>
        [r.id, r.customer_name, r.mobile, r.vehicle_name, r.quote_reference]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }
    return rows;
  });

  async ngOnInit() {
    this.bookingChannel = this.supabase.subscribeToAllBookingChanges(() => this.loadLedger());
    await this.loadLedger();
  }

  ngOnDestroy() {
    this.bookingChannel?.unsubscribe();
  }

  async loadLedger() {
    this.loading.set(true);
    const { data, error } = await this.supabase.getAdminBookingLedger();
    this.loading.set(false);

    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Bookings unavailable', detail: (error as any)?.message || 'Could not load bookings.' });
      return;
    }

    this.allBookings.set(
      (data ?? []).map((row: any) => {
        // quotations is a has-many join → returns array; take the first
        const q = Array.isArray(row.quotations) ? row.quotations[0] : null;
        return {
          id: row.id,
          status: row.status,
          payment_status: row.payment_status || null,
          latest_payment: row.latest_payment ?? null,
          customer_name: row.customers?.full_name || '-',
          mobile: row.customers?.mobile || '-',
          customer_type: row.customers?.customer_type || '-',
          vehicle_name: `${row.vehicle?.brand || ''} ${row.vehicle?.model || ''}`.trim() || '-',
          start_date: row.start_date,
          end_date: row.end_date,
          pickup_location: row.pickup_location,
          final_amount: Number(q?.final_amount ?? row.total_price ?? 0),
          quote_reference: q?.quote_reference || '-',
          created_at: row.created_at,
        };
      })
    );
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

  async viewDetails(row: any) {
    const [detailResult, paymentResult] = await Promise.all([
      this.supabase.getAdminBookingDetails(row.id),
      this.supabase.getPaymentByBooking(row.id),
    ]);
    if (detailResult.error || !detailResult.data) {
      this.messageService.add({ severity: 'error', summary: 'Details unavailable', detail: (detailResult.error as any)?.message || 'Could not load booking details.' });
      return;
    }
    this.selectedDetail.set(detailResult.data);
    this.selectedPayment.set(paymentResult.data ?? null);
    this.detailVisible.set(true);
  }

  markInService(row: any) {
    this.confirmationService.confirm({
      header: 'Mark as In Service',
      message: `Confirm vehicle handover for booking ${row.id}? This will move it to In Service status.`,
      icon: 'pi pi-car',
      acceptButtonStyleClass: 'p-button-info',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        const { error } = await this.supabase.markBookingInService(row.id);
        if (error) {
          this.messageService.add({ severity: 'error', summary: 'Failed', detail: (error as any)?.message || 'Could not update booking.' });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'In Service', detail: `Booking ${row.id} is now in service.` });
        this.detailVisible.set(false);
        await this.loadLedger();
      },
    });
  }

  onDetailDialogShow() {
    setTimeout(() => {
      const content = this.detailDialogContent?.nativeElement;
      content?.scrollTo({ top: 0 });
      content?.closest('.p-dialog-content')?.scrollTo({ top: 0 });
    });
  }

  idProofLabel(value: string | null | undefined) {
    if (!value) return '-';
    if (value.startsWith('data:')) return 'Uploaded (inline)';
    if (value.startsWith('https://')) {
      const path = value.split('?')[0];
      return decodeURIComponent(path.split('/').filter(Boolean).pop() || '-');
    }
    return value;
  }

  approveBooking(row: any) {
    this.confirmationService.confirm({
      header: 'Approve Booking',
      message: `Approve booking ${row.id}?`,
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        const { error } = await this.supabase.approveBookingRequest(row.id);
        if (error) {
          this.messageService.add({ severity: 'error', summary: 'Approval failed', detail: (error as any)?.message || 'Could not approve the booking.' });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Booking approved', detail: `Booking ${row.id} is now approved.` });
        this.detailVisible.set(false);
        await this.loadLedger();
      },
    });
  }

  openRejectDialog(row: any) {
    this.rejectDialogBooking.set(row);
    this.rejectReason.set('');
    this.rejectDialogVisible.set(true);
  }

  async rejectBooking() {
    const row = this.rejectDialogBooking();
    const reason = this.rejectReason().trim();
    if (!row?.id || !reason) {
      this.messageService.add({ severity: 'warn', summary: 'Reason required', detail: 'Enter a rejection reason before continuing.' });
      return;
    }
    const { error } = await this.supabase.rejectBookingRequest(row.id, reason);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Rejection failed', detail: (error as any)?.message || 'Could not reject the booking.' });
      return;
    }
    this.rejectDialogVisible.set(false);
    this.detailVisible.set(false);
    this.messageService.add({ severity: 'info', summary: 'Booking rejected', detail: `Booking ${row.id} has been rejected.` });
    await this.loadLedger();
  }

  paymentDetailLines(payment: any) {
    return this.paymentPresentation(payment).detailLines;
  }

  private paymentPresentation(payment: any): { label: string; severity: 'success' | 'warn' | 'secondary'; detailLines: string[] } {
    if (!payment) {
      return {
        label: 'Not Initiated',
        severity: 'secondary',
        detailLines: ['No payment transaction has been initiated for this booking yet.'],
      };
    }

    const status = String(payment.status ?? '').toLowerCase();
    const mode = String(payment.payment_mode ?? '').toLowerCase();
    const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(payment.amount ?? 0));

    if (status === 'paid') {
      if (mode === 'cash') {
        return {
          label: 'Advance Paid - Offline',
          severity: 'success',
          detailLines: [
            `Collected by advisor on ${this.formatDateTime(payment.created_at)}`,
            `Amount: ${amount}`,
          ],
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
      };
    }

    return {
      label: 'Payment Pending',
      severity: 'warn',
      detailLines: [`Latest status: ${String(payment.status || 'initiated').replace(/_/g, ' ')}`],
    };
  }

  private formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
  }
}
