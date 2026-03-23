import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { Booking } from '../../models/booking';
import { Vehicle } from '../../models/vehicle';
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
  ],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss',
})
export class DealerDashboard {
  private supabase = inject(SupabaseService);

  userInfo = signal<{ email: string; id: string }>({
    email: 'Loading...',
    id: 'Fetching...',
  });
  vehicles = signal<Vehicle[]>([]);
  myBookings = signal<Booking[]>([]);
  loading = signal(true);
  filter = signal('');
  bookingDialogVisible = signal(false);
  selectedVehicle = signal<Vehicle | null>(null);

  activeBookingsCount = computed(() =>
    this.myBookings().filter((booking) => booking.status !== 'cancelled' && booking.status !== 'rejected').length
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
          backgroundColor: ['#4ade80', '#60a5fa'],
        },
      ],
    };
  });

  chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    cutout: '60%',
  };

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

      return brand.includes(query) || model.includes(query) || vin.includes(query) || make.includes(query);
    });
  });

  availableVehicles = computed(() => {
    const vehicles = this.filteredVehicles();
    const bookings = this.myBookings();

    return vehicles.map((vehicle) => {
      const activeBookings = bookings.filter(
        (booking) =>
          booking.vehicle_id === vehicle.id &&
          booking.status !== 'cancelled' &&
          booking.status !== 'rejected'
      ).length;

      return {
        ...vehicle,
        available: Math.max((vehicle.stock ?? 0) - activeBookings, 0),
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
    await this.loadVehicles();
    await this.loadMyBookings();
    await this.loadUserInfo();
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
    } else {
      this.vehicles.set(data ?? []);
    }

    this.loading.set(false);
  }

  async loadMyBookings() {
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

    const { data, error } = await this.supabase.getMyBookings(user.id);

    if (error) {
      console.error(error);
      return;
    }

    const normalizedBookings = (data ?? []).map((booking: any) => ({
      ...booking,
      vehicle_id: booking.vehicle_id ?? booking.vehicle?.id,
    }));

    this.myBookings.set(normalizedBookings);
  }

  setFilter(value: string) {
    this.filter.set(value ?? '');
  }

  openBooking(vehicle: Vehicle) {
    this.selectedVehicle.set(null);
    this.selectedVehicle.set(vehicle);
    this.bookingDialogVisible.set(true);
  }

  closeBooking() {
    this.bookingDialogVisible.set(false);
  }

  async submitBooking(data: any) {
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

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
        booking.status !== 'rejected'
      );
    });

    if (isOverlapping) {
      alert('This vehicle is already booked for these dates.');
      return;
    }

    const { error } = await this.supabase.createBooking(formattedData);
    if (!error) {
      alert('Booking successful!');
      this.loadMyBookings();
      this.closeBooking();
    }
  }

  async cancelBooking(id: string) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    const { error } = await this.supabase.updateBookingStatus(id, 'cancelled');

    if (error) {
      console.error('Supabase error:', error);
      alert('Failed to cancel booking.');
    } else {
      await Promise.all([this.loadVehicles(), this.loadMyBookings()]);
      alert('Booking cancelled successfully.');
    }
  }

  async signOut() {
    await this.supabase.signOut();
    window.location.href = '/login';
  }
}
