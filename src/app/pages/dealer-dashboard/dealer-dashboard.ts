import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SupabaseService } from '../../services/supabase';
import { Vehicle } from '../../models/vehicle';
import { Booking } from '../../models/booking';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { ChartModule} from 'primeng/chart';
import { BookingDialogComponent } from '../booking/booking-dialog.component';
import { ReusableTableComponent, TableColumn } from '../../models/dynamic-table.component';
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
    ReusableTableComponent
  ],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss'
})
export class DealerDashboard {

  private supabase = inject(SupabaseService);

  vehicles = signal<Vehicle[]>([]);
  myBookings = signal<Booking[]>([]);
  loading = signal<boolean>(true);
  filter = signal<string>('');

  bookingDialogVisible = signal(false);
  selectedVehicle = signal<Vehicle | null>(null);

  // 2. Define the Chart Data Signal
  chartData = computed(() => {
    const total = this.vehicles().length;
    const available = this.availableVehicles().reduce((sum, v) => sum + v.available, 0);
    const booked = Math.max(total - available, 0);

    return {
      labels: ['Available', 'Booked/Occupied'],
      datasets: [
        {
          data: [available, booked],
          backgroundColor: ['#4ade80', '#60a5fa'], // Green and Blue
          hoverBackgroundColor: ['#22c55e', '#3b82f6']
        }
      ]
    };
  });

  // 3. Define Chart Options (Visual styling)
  chartOptions = {
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    cutout: '60%' // This makes it a doughnut instead of a pie
  };

  /* ---------------- Table Columns ---------------- */
  tableColumns: TableColumn[] = [
  { field: 'vin', header: 'VIN', sortable: true },
  { field: 'brand', header: 'Brand', sortable: true },
  { field: 'model', header: 'Model', sortable: true },
  { field: 'location', header: 'Location', sortable: true },
  { field: 'daily_rate', header: 'Price/Day', sortable: true },
  { field: 'available', header: 'Status', sortable: false }
];
  /* ---------------- FILTER ---------------- */

  filteredVehicles = computed(() => {
  const q = this.filter().trim().toLowerCase();
  const allVehicles = this.vehicles(); // Get the raw data from Supabase

  // If search is empty, return everything immediately
  if (!q) return allVehicles;

  return allVehicles.filter(v => {
    // We use (?? '') to ensure that if a database field is null, 
    // it becomes an empty string instead of crashing the search.
    const brand = (v.brand ?? '').toLowerCase();
    const model = (v.model ?? '').toLowerCase();
    const vin = (v.vin ?? '').toLowerCase();
    const make = (v.make ?? '').toLowerCase();

    return brand.includes(q) || 
           model.includes(q) || 
           vin.includes(q) || 
           make.includes(q);
  });
});

  /* ---------------- AVAILABILITY ---------------- */

  availableVehicles = computed(() => {
   // 1. Get the ALREADY FILTERED list
    const vehicles = this.filteredVehicles();
    const bookings = this.myBookings();

    return vehicles.map(v => {

      const activeBookings = bookings.filter(b =>
        b.vehicle_id === v.id &&
        b.status !== 'cancelled'
      ).length;

      return {
        ...v,
        available: Math.max((v.stock ?? 0) - activeBookings, 0)
      };

    });

  });

  /* ---------------- INIT ---------------- */

  async ngOnInit() {
    await this.loadVehicles();
    await this.loadMyBookings();
  }

  /* ---------------- LOAD VEHICLES ---------------- */

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

  /* ---------------- LOAD BOOKINGS ---------------- */

  async loadMyBookings() {

  const user = await this.supabase.getCurrentUser();
  if (!user) return;

  const { data, error } = await this.supabase.getMyBookings(user.id);

  if (error) {
    console.error(error);
    return;
  }

  const normalizedBookings = (data ?? []).map((b: any) => ({
    ...b,
    vehicle_id: b.vehicle_id ?? b.vehicle?.id
  }));

  this.myBookings.set(normalizedBookings);

}

  /* ---------------- FILTER ---------------- */

  setFilter(value: string) {
    this.filter.set(value ?? '');
  }

  /* ---------------- BOOKING MODAL ---------------- */

  openBooking(vehicle: Vehicle) {
    this.selectedVehicle.set(vehicle);
    this.bookingDialogVisible.set(true);
  }

  closeBooking() {
    this.bookingDialogVisible.set(false);
  }

  /* ---------------- SUBMIT BOOKING ---------------- */

  async submitBooking(data: any) {
  const user = await this.supabase.getCurrentUser();
  if (!user) return;

  // Convert dates to ISO strings for Supabase compatibility
  const formattedData = {
    ...data,
    user_id: user.id,
    start_date: data.start_date.toISOString(),
    end_date: data.end_date.toISOString()
  };

  // Perform the same overlap check you had
  const { data: bookings } = await this.supabase.getBookingsByVehicle(data.vehicle_id);
  
  const isOverlapping = (bookings ?? []).some((b: Booking) => {
    return new Date(b.start_date) <= new Date(formattedData.end_date) && 
           new Date(b.end_date) >= new Date(formattedData.start_date) &&
           b.status !== 'cancelled' && b.status !== 'rejected';
  });

  // If you have a 'stock' count > 1, you'd check overlapping.length >= stock
  // For single vehicle management:
  if (isOverlapping) {
    alert('This vehicle is already booked for these dates.');
    return;
  }

  const { error } = await this.supabase.createBooking(formattedData);
  if (!error) {
    alert('Booking successful!');
    this.loadMyBookings(); // Refresh the list
    this.closeBooking();
  }
}

  /* ---------------- SIGN OUT ---------------- */

  async signOut() {
    await this.supabase.signOut();
    window.location.href = '/login';
  }

}