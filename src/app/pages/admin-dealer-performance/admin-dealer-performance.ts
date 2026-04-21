import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InplaceModule } from 'primeng/inplace';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TimelineModule } from 'primeng/timeline';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { buildBookings, normalizeVehicle, tagSeverityForPriority, tagSeverityForStatus } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-dealer-performance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    ConfirmDialogModule,
    DatePickerModule,
    DialogModule,
    FloatLabelModule,
    InplaceModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    TimelineModule,
    ToastModule,
    TooltipModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './admin-dealer-performance.html',
  styleUrl: './admin-dealer-performance.scss',
  providers: [ConfirmationService, MessageService],
})
export class AdminDealerPerformance {
  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  readonly activeTab = signal(0);
  readonly bookings = signal<any[]>([]);
  readonly filteredBookings = signal<any[]>([]);
  readonly dateRange = signal<Date[] | null>(null);
  readonly selectedVehicle = signal<string | null>(null);
  readonly selectedPriority = signal<string | null>(null);
  readonly search = signal('');
  readonly expandedRows = signal<Record<string, boolean>>({});
  readonly rejectDialogVisible = signal(false);
  readonly rejectDialogBooking = signal<any | null>(null);
  readonly rejectReason = signal('');

  readonly tabItems = [
    { label: 'All', status: null, badge: 'secondary' },
    { label: 'Pending', status: 'Pending', badge: 'warn' },
    { label: 'Confirmed', status: 'Confirmed', badge: 'success' },
    { label: 'In Progress', status: 'InProgress', badge: 'info' },
    { label: 'Completed', status: 'Completed', badge: 'secondary' },
    { label: 'Cancelled', status: 'Cancelled', badge: 'danger' },
  ] as const;

  readonly priorities = ['Low', 'Normal', 'High', 'Urgent'].map((label) => ({ label, value: label }));
  readonly notes: Record<string, string> = {};

  async ngOnInit() {
    const { data: vehiclesRaw } = await this.supabase.getVehicles();
    const { data: bookingRows } = await this.supabase.getBookings();
    const vehicles = (vehiclesRaw ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));

    const bookings = buildBookings(vehicles, bookingRows ?? []).map((booking, index) => ({
      ...booking,
      days: Math.max(1, Math.ceil((new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / 86400000)),
      history: [
        { status: 'Created', time: 'Today | 09:30 AM', actor: 'System' },
        { status: booking.status === 'Pending' ? 'Pending' : 'Confirmed', time: 'Today | 11:00 AM', actor: 'Operations Team' },
        { status: booking.assignedTo === 'Unassigned' ? 'Awaiting Assignment' : 'Assigned', time: 'Today | 01:00 PM', actor: booking.assignedTo || 'Queue' },
      ],
      breakdown: [
        { label: 'Rental', value: booking.cost * 0.72 },
        { label: 'Insurance', value: booking.cost * 0.18 },
        { label: 'Taxes', value: booking.cost * 0.1 },
      ],
      notes: 'Customer requested doorstep delivery and quick confirmation on assigned driver.',
    }));

    bookings.forEach((booking) => {
      this.notes[booking.id] = booking.notes;
    });

    this.bookings.set(bookings);
    this.applyFilters();
  }

  vehicleOptions() {
    const names = [...new Set(this.bookings().map((booking) => booking.vehicle))];
    return names.map((name) => ({ label: name, value: name }));
  }

  setTab(index: number) {
    this.activeTab.set(index);
    this.applyFilters();
  }

  clearFilters() {
    this.dateRange.set(null);
    this.selectedVehicle.set(null);
    this.selectedPriority.set(null);
    this.search.set('');
    this.activeTab.set(0);
    this.applyFilters();
  }

  applyFilters() {
    const tab = this.tabItems[this.activeTab()];
    const filtered = this.bookings().filter((booking) => {
      const matchesTab = !tab.status || booking.status === tab.status;
      const matchesVehicle = !this.selectedVehicle() || booking.vehicle === this.selectedVehicle();
      const matchesPriority = !this.selectedPriority() || booking.priority === this.selectedPriority();
      const query = this.search().trim().toLowerCase();
      const matchesSearch = !query || booking.id.toLowerCase().includes(query) || booking.userName.toLowerCase().includes(query);

      return matchesTab && matchesVehicle && matchesPriority && matchesSearch;
    });

    this.filteredBookings.set(filtered);
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  prioritySeverity(priority: string) {
    return tagSeverityForPriority(priority);
  }

  priorityDotClass(priority: string) {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'priority-dot--urgent';
      case 'high':
        return 'priority-dot--high';
      case 'normal':
        return 'priority-dot--normal';
      default:
        return 'priority-dot--low';
    }
  }

  tabCount(status: string | null) {
    return `${this.bookings().filter((booking) => !status || booking.status === status).length}`;
  }

  isExpanded(bookingId: string) {
    return Boolean(this.expandedRows()[bookingId]);
  }

  toggleExpandedRow(bookingId: string) {
    this.expandedRows.update((current) => {
      if (current[bookingId]) {
        return {};
      }

      return { [bookingId]: true };
    });
  }

  canApproveOrReject(status: string) {
    return status === 'Pending';
  }

  openMapLink(location: string) {
    const query = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  }

  async approveBooking(booking: any) {
    if (!booking.rawId || !booking.userId) {
      return;
    }

    this.confirmationService.confirm({
      message: `Approve booking ${booking.id} for ${booking.vehicle}?`,
      header: 'Approve Booking',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        const { error } = await this.supabase.updateBookingStatus(booking.rawId, 'approved');
        if (error) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to approve booking' });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Approved', detail: `Booking ${booking.id} approved` });
          await this.supabase.logAudit(`Booking Approved: ${booking.id}`);
        }
        await this.ngOnInit();
      },
    });
  }

  async rejectBooking(booking: any) {
    this.rejectDialogBooking.set(booking);
    this.rejectDialogVisible.set(true);
  }

  async confirmReject() {
    const booking = this.rejectDialogBooking();
    const reason = this.rejectReason();
    if (!booking?.rawId) {
      return;
    }

    if (!reason.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Required', detail: 'Please enter a rejection reason' });
      return;
    }

    const { error } = await this.supabase.updateBookingStatus(booking.rawId, 'rejected');
    if (!error) {
      this.messageService.add({ severity: 'info', summary: 'Rejected', detail: `Booking ${booking.id} rejected` });
      await this.supabase.logAudit(`Booking Rejected: ${booking.id} — ${reason}`);
      this.rejectDialogVisible.set(false);
      this.rejectReason.set('');
      this.rejectDialogBooking.set(null);
      await this.ngOnInit();
    }
  }
}
