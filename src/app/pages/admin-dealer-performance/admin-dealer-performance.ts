import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InplaceModule } from 'primeng/inplace';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SplitButtonModule } from 'primeng/splitbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TimelineModule } from 'primeng/timeline';
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
    DatePickerModule,
    FloatLabelModule,
    InplaceModule,
    InputTextModule,
    SelectModule,
    SplitButtonModule,
    TableModule,
    TagModule,
    TextareaModule,
    TimelineModule,
    TooltipModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './admin-dealer-performance.html',
})
export class AdminDealerPerformance {
  private supabase = inject(SupabaseService);

  readonly activeTab = signal(0);
  readonly bookings = signal<any[]>([]);
  readonly filteredBookings = signal<any[]>([]);
  readonly dateRange = signal<Date[] | null>(null);
  readonly selectedVehicle = signal<string | null>(null);
  readonly selectedPriority = signal<string | null>(null);
  readonly search = signal('');
  readonly expandedRows = signal<Record<string, boolean>>({});

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
      phone: `+91 98${String(76543210 + index).slice(0, 8)}`,
      days: Math.max(1, Math.ceil((new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / 86400000)),
      history: [
        { status: 'Created', time: 'Today | 09:30 AM', actor: 'System' },
        { status: booking.status === 'Pending' ? 'Pending' : 'Confirmed', time: 'Today | 11:00 AM', actor: 'Operations Team' },
        { status: booking.assignedTo === 'Unassigned' ? 'Awaiting Assignment' : 'Assigned', time: 'Today | 01:00 PM', actor: booking.assignedTo || 'Queue' },
      ],
      splitActions: [
        { label: 'Assign', icon: 'pi pi-send' },
        { label: 'Cancel', icon: 'pi pi-times' },
        { label: 'Export Receipt', icon: 'pi pi-download' },
      ] as MenuItem[],
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

  tabCount(status: string | null) {
    return `${this.bookings().filter((booking) => !status || booking.status === status).length}`;
  }
}
