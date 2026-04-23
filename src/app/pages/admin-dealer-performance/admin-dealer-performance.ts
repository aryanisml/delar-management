import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { tagSeverityForStatus } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

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
    TableModule,
    TagModule,
    TextareaModule,
    ToastModule,
  ],
  templateUrl: './admin-dealer-performance.html',
  styleUrl: './admin-dealer-performance.scss',
  providers: [ConfirmationService, MessageService],
})
export class AdminDealerPerformance {
  @ViewChild('detailDialogContent') detailDialogContent?: ElementRef<HTMLElement>;

  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly search = signal('');
  readonly bookings = signal<any[]>([]);
  readonly detailVisible = signal(false);
  readonly selectedDetail = signal<any | null>(null);
  readonly rejectDialogVisible = signal(false);
  readonly rejectDialogBooking = signal<any | null>(null);
  readonly rejectReason = signal('');

  readonly filteredBookings = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.bookings().filter((row) => {
      if (!query) {
        return true;
      }

      return [
        row.id,
        row.customer_name,
        row.mobile,
        row.vehicle_name,
        row.quote_reference,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  async ngOnInit() {
    await this.loadRequests();
  }

  async loadRequests() {
    this.loading.set(true);
    const { data, error } = await this.supabase.getPendingBookingRequests();
    this.loading.set(false);

    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Bookings unavailable', detail: (error as any)?.message || 'Could not load pending bookings.' });
      return;
    }

    this.bookings.set(
      (data ?? []).map((row: any) => ({
        id: row.id,
        customer_name: row.customers?.full_name || '-',
        mobile: row.customers?.mobile || '-',
        customer_type: row.customers?.customer_type || '-',
        vehicle_name: `${row.vehicle?.brand || ''} ${row.vehicle?.model || ''}`.trim() || '-',
        pickup_date: row.start_date,
        total_price: Number(row.total_price ?? 0),
        created_at: row.created_at,
        status: row.status,
      }))
    );
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  async viewDetails(row: any) {
    const { data, error } = await this.supabase.getAdminBookingDetails(row.id);
    if (error || !data) {
      this.messageService.add({ severity: 'error', summary: 'Details unavailable', detail: error?.message || 'Could not load booking details.' });
      return;
    }

    this.selectedDetail.set(data);
    this.detailVisible.set(true);
  }

  onDetailDialogShow() {
    setTimeout(() => {
      const content = this.detailDialogContent?.nativeElement;
      content?.scrollTo({ top: 0 });
      content?.closest('.p-dialog-content')?.scrollTo({ top: 0 });
    });
  }

  idProofLabel(value: string | null | undefined) {
    if (!value) {
      return '-';
    }

    if (value.startsWith('data:')) {
      return 'Uploaded (inline)';
    }

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

        this.messageService.add({ severity: 'success', summary: 'Booking approved', detail: `Booking ${row.id} is now confirmed.` });
        this.detailVisible.set(false);
        await this.loadRequests();
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
    await this.loadRequests();
  }
}
