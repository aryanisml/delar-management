import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { Booking } from '../../models/booking';
import { Vehicle } from '../../models/vehicle';
import { normalizeVehicle, tagSeverityForStatus } from '../../admin-ui.models';
import { ReusableTableComponent, TableColumn } from '../../Shared/components/dynamic-table.component';
import { StatCardComponent } from '../../Shared/components/stat-card.component';
import { SupabaseService } from '../../services/supabase';
import { BookingDialogComponent } from '../booking/booking-dialog.component/booking-dialog.component';

@Component({
  selector: 'app-dealer-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarModule,
    InputTextModule,
    TableModule,
    ButtonModule,
    CardModule,
    ProgressSpinnerModule,
    TagModule,
    FormsModule,
    BookingDialogComponent,
    ChartModule,
    ReusableTableComponent,
    StatCardComponent,
    ConfirmDialogModule,
    ToastModule,
  ],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss',
  providers: [ConfirmationService, MessageService],
})
export class DealerDashboard {
  private supabase = inject(SupabaseService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  private vehicleChannel: any = null;
  private bookingChannel: any = null;

  userInfo = signal<{ email: string; id: string }>({
    email: 'Loading...',
    id: 'Fetching...',
  });
  vehicles = signal<Array<Vehicle & { available?: number; rawStatus?: string; dailyRate?: number; vehicleStatus?: string; nextAvailableDate?: string | null }>>([]);
  myBookings = signal<Booking[]>([]);
  loading = signal(true);
  submittingBooking = signal(false);
  refreshingBookings = signal(false);
  filter = signal('');
  bookingDialogVisible = signal(false);
  selectedVehicle = signal<Vehicle | null>(null);

  activeBookingsCount = computed(() =>
    this.myBookings().filter(
      (booking) => booking.status !== 'cancelled' && booking.status !== 'rejected' && booking.status !== 'completed'
    ).length
  );
  fleetSize = computed(() => this.vehicles().reduce((sum, vehicle) => sum + (vehicle.stock || 0), 0));
  availableNow = computed(() => this.availableVehicles().reduce((sum, vehicle) => sum + vehicle.available, 0));

  userName = computed(() => {
    const email = this.userInfo().email;
    if (!email || email === 'Loading...') {
      return 'User';
    }
    return email.split('@')[0];
  });

  userLetter = computed(() => this.userName().charAt(0).toUpperCase() || 'U');

  chartData = computed(() => {
    const totalUnits = this.vehicles().reduce((sum, vehicle) => sum + (vehicle.stock || 0), 0);
    const availableUnits = this.availableVehicles().reduce((sum, vehicle) => sum + vehicle.available, 0);
    const bookedUnits = Math.max(totalUnits - availableUnits, 0);

    return {
      labels: ['Available', 'Booked'],
      datasets: [
        {
          data: [availableUnits, bookedUnits],
          backgroundColor: ['#1A56DB', '#C27803'],
          hoverBackgroundColor: ['#1E429F', '#92400E'],
          borderWidth: 0,
        },
      ],
    };
  });

  chartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: '#4b5563',
        },
      },
    },
    cutout: '60%',
  };
  
  openQuotation(booking: any) {
  this.router.navigate(['/dealer/booking', booking.id, 'customer-details']);
}

  tableColumns: TableColumn[] = [
    { field: 'vin', header: 'VIN', sortable: true },
    { field: 'brand', header: 'Brand', sortable: true },
    { field: 'make', header: 'Make', sortable: true },
    { field: 'model', header: 'Model', sortable: true },
    { field: 'stock', header: 'Stock', sortable: true },
    { field: 'location', header: 'Location', sortable: true },
    { field: 'daily_rate', header: 'Price/Day', sortable: true },
    { field: 'available', header: 'Status', sortable: false },
  ];

  filteredVehicles = computed(() => {
    const query = this.filter().trim().toLowerCase();
    const allVehicles = this.vehicles();

    if (!query) {
      return allVehicles;
    }

    return allVehicles.filter((vehicle) => {
      const brand = (vehicle.brand ?? '').toLowerCase();
      const model = (vehicle.model ?? '').toLowerCase();
      const vin = (vehicle.vin ?? '').toLowerCase();
      const make = (vehicle.make ?? '').toLowerCase();

      const location = (vehicle.location ?? '').toLowerCase();

      return brand.includes(query) || model.includes(query) || vin.includes(query) || make.includes(query) || location.includes(query);
    });
  });

  availableVehicles = computed(() => {
    const vehicles = this.filteredVehicles();
    const bookings = this.myBookings();
    const today = new Date().toISOString().slice(0, 10);

    return vehicles.map((vehicle) => {
      const activeBookings = bookings.filter(
        (booking) =>
          booking.vehicle_id === vehicle.id &&
          booking.status !== 'cancelled' &&
          booking.status !== 'rejected' &&
          booking.status !== 'completed'
      ).length;

      return {
        ...vehicle,
        available:
          vehicle.vehicleStatus === 'available' && (!vehicle.nextAvailableDate || vehicle.nextAvailableDate <= today)
            ? Math.max((vehicle.stock ?? 0) - activeBookings, 0)
            : 0,
      };
    });
  });

  bookingTableColumns: TableColumn[] = [
    { field: 'start_date', header: 'Start Date', sortable: true },
    { field: 'end_date', header: 'End Date', sortable: true },
    { field: 'pickup_location', header: 'Pickup', sortable: true },
    { field: 'status', header: 'Status', sortable: false },
  ];

  async ngOnInit() {
    await this.loadUserInfo();
    await Promise.all([this.loadVehicles(), this.loadMyBookings()]);
    this.setupRealtimeSubscriptions();
  }

  ngOnDestroy() {
    if (this.vehicleChannel) {
      this.supabase.supabase.removeChannel(this.vehicleChannel);
      this.vehicleChannel = null;
    }

    if (this.bookingChannel) {
      this.supabase.supabase.removeChannel(this.bookingChannel);
      this.bookingChannel = null;
    }
  }

  async loadUserInfo() {
    const user = await this.supabase.getCurrentUser();

    if (user) {
      this.userInfo.set({
        email: user.email || '',
        id: user.id,
      });
    }
  }

  async loadVehicles() {
    this.loading.set(true);

    const { data, error } = await this.supabase.getVehicles();

    if (error) {
      console.error('Vehicle load error:', error);
      this.vehicles.set([]);
      this.messageService.add({
        severity: 'error',
        summary: 'Inventory unavailable',
        detail: 'We could not load the latest vehicle inventory.',
      });
    } else {
      const normalizedVehicles = (data ?? [])
        .map((vehicle, index) => normalizeVehicle(vehicle, index))
        .filter((vehicle) => vehicle.rawStatus !== 'deleted');
      this.vehicles.set(normalizedVehicles);
    }

    this.loading.set(false);
  }

  async loadMyBookings() {
    this.refreshingBookings.set(true);
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      this.refreshingBookings.set(false);
      return;
    }

    const { data, error } = await this.supabase.getMyBookings(user.id);

    if (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Bookings unavailable',
        detail: 'We could not load your booking history.',
      });
      this.refreshingBookings.set(false);
      return;
    }

    const normalizedBookings = (data ?? []).map((booking: any) => ({
      ...booking,
      vehicle_id: booking.vehicle_id ?? booking.vehicle?.id,
    }));

    this.myBookings.set(normalizedBookings);
    this.refreshingBookings.set(false);
  }

  setFilter(value: string) {
    this.filter.set(value ?? '');
  }

  openBooking(vehicle: Vehicle) {
    this.router.navigate(['/dealer/bookings'], { queryParams: { vehicleId: vehicle.id } });
  }

  closeBooking() {
    this.bookingDialogVisible.set(false);
    this.selectedVehicle.set(null);
  }

  async submitBooking(data: any) {
    if (!data?.vehicle_id || !data?.pickup_location || !data?.drop_location || !data?.start_date || !data?.end_date) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Missing details',
        detail: 'Please complete every booking field before submitting.',
      });
      return;
    }

    const user = await this.supabase.getCurrentUser();
    if (!user) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Session expired',
        detail: 'Please sign in again to continue with your booking.',
      });
      return;
    }

    this.submittingBooking.set(true);

    const formattedData = {
      ...data,
      user_id: user.id,
      start_date: data.start_date.toISOString(),
      end_date: data.end_date.toISOString(),
    };

    const { data: bookings } = await this.supabase.getBookingsByVehicle(data.vehicle_id);

    const isOverlapping = (bookings ?? []).some((booking: Booking) => {
      return (
        new Date(booking.start_date) <= new Date(formattedData.end_date) &&
        new Date(booking.end_date) >= new Date(formattedData.start_date) &&
        booking.status !== 'cancelled' &&
        booking.status !== 'rejected' &&
        booking.status !== 'completed'
      );
    });

    if (isOverlapping) {
      this.submittingBooking.set(false);
      this.messageService.add({
        severity: 'warn',
        summary: 'Vehicle unavailable',
        detail: 'This vehicle is already booked for the selected dates.',
      });
      return;
    }

    if (new Date(formattedData.start_date) > new Date(formattedData.end_date)) {
      this.submittingBooking.set(false);
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid dates',
        detail: 'The end date must be after the start date.',
      });
      return;
    }

    const { error } = await this.supabase.createBooking(formattedData);
    this.submittingBooking.set(false);

    if (!error) {
      await Promise.all([this.loadVehicles(), this.loadMyBookings()]);
      this.messageService.add({
        severity: 'success',
        summary: 'Booking submitted',
        detail: 'Your booking request has been created successfully.',
      });
      this.closeBooking();
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Booking failed',
        detail: error.message || 'We could not submit your booking request.',
      });
    }
  }

  async cancelBooking(id: string) {
    this.confirmationService.confirm({
      message: 'Cancel this booking request?',
      header: 'Confirm Cancellation',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonStyleClass: 'p-button-text',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        const { error } = await this.supabase.updateBookingStatus(id, 'cancelled');

        if (error) {
          console.error('Supabase error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Cancellation failed',
            detail: error.message || 'We could not cancel this booking.',
          });
        } else {
          await Promise.all([this.loadVehicles(), this.loadMyBookings()]);
          this.messageService.add({
            severity: 'success',
            summary: 'Booking cancelled',
            detail: 'The booking has been cancelled successfully.',
          });
        }
      },
    });
  }

  async signOut() {
    await this.supabase.signOut();
    window.location.href = '/login';
  }

  navigateToInventory() {
    this.router.navigateByUrl('/dealer/inventory');
  }

  navigateToBookings() {
    this.router.navigateByUrl('/dealer/my-bookings');
  }

  getVehicleStatusLabel(vehicle: { available?: number }) {
    return (vehicle.available ?? 0) > 0 ? 'Available' : 'Out of Stock';
  }

  getVehicleStatusSeverity(vehicle: { available?: number }) {
    return tagSeverityForStatus((vehicle.available ?? 0) > 0 ? 'available' : 'cancelled');
  }

  private setupRealtimeSubscriptions() {
    const client = this.supabase.supabase;

    this.vehicleChannel = client
      .channel('dealer-dashboard-vehicles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle' },
        async () => {
          await this.loadVehicles();
        }
      )
      .subscribe();

    this.bookingChannel = client
      .channel('dealer-dashboard-bookings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        async () => {
          await Promise.all([this.loadVehicles(), this.loadMyBookings()]);
        }
      )
      .subscribe();
  }
}
