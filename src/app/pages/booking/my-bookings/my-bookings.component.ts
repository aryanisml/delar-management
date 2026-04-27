import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
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
import { tagSeverityForStatus } from '../../../admin-ui.models';
import { SupabaseService } from '../../../services/supabase';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, ConfirmDialogModule, DatePipe, DialogModule, TableModule, TagModule, ToastModule],
  templateUrl: './my-bookings.component.html',
  providers: [ConfirmationService, MessageService],
})
export class MyBookingsComponent {
  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  readonly bookings = signal<any[]>([]);
  readonly bulkBookings = signal<any[]>([]);
  readonly activeTab = signal<'single' | 'bulk'>('single');
  readonly detailVisible = signal(false);
  readonly selectedBooking = signal<any | null>(null);

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
    await this.loadData();
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

  quoteReference(row: any) {
    return row.quote_reference || `#${String(row.id || '').slice(0, 8).toUpperCase()}`;
  }

  hasPricing(row: any) {
    return Number(row.quotation?.final_amount ?? row.total_price ?? 0) > 0;
  }

  finalAmount(row: any) {
    return Number(row.quotation?.final_amount ?? row.total_price ?? 0);
  }

  openDetail(row: any) {
    this.selectedBooking.set(row);
    this.detailVisible.set(true);
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
}
