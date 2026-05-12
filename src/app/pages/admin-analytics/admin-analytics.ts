import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { buildBookings, normalizeVehicle } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, ProgressBarModule],
  templateUrl: './admin-analytics.html',
  styleUrl: './admin-analytics.scss',
})
export class AdminAnalytics {
  private supabase = inject(SupabaseService);

  readonly topMetrics = signal<any[]>([]);
  readonly bookingVolumeChart = signal<any>(null);
  readonly revenueByTypeChart = signal<any>(null);
  readonly bookingsByStatusChart = signal<any>(null);
  readonly topVehicleRows = signal<any[]>([]);

  readonly topVehicleMax = computed(() => Math.max(1, ...this.topVehicleRows().map((item) => item.count)));

  async ngOnInit() {
    const { data: vehiclesRaw } = await this.supabase.getVehicles();
    const { data: bookingRows } = await this.supabase.getBookings();
    const vehicles = (vehiclesRaw ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
    const bookings = buildBookings(vehicles, bookingRows ?? []);

    const revenue = bookings
      .filter((booking) => booking.status === 'Approved' || booking.status === 'Completed' || booking.status === 'InProgress')
      .reduce((sum, booking) => sum + booking.cost, 0);
    const avgDuration =
      bookings.reduce((sum, booking) => sum + Math.max(1, Math.ceil((new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / 86400000)), 0) /
      Math.max(1, bookings.length);
    const totalStock = vehicles.reduce((sum, vehicle) => sum + Number(vehicle.stock ?? 0), 0);
    const bookedUnits = bookings.filter((booking) => ['Approved', 'InProgress', 'Pending'].includes(booking.status)).length;
    const utilisation = Math.round((bookedUnits / Math.max(1, totalStock)) * 100);
    const topVehicle = [...vehicles]
      .sort(
        (a, b) =>
          bookings.filter((booking) => booking.vehicleId === b.id).length - bookings.filter((booking) => booking.vehicleId === a.id).length
      )
      .at(0);

    this.topMetrics.set([
      { label: 'Total Revenue', value: `Rs ${Math.round(revenue).toLocaleString('en-IN')}` },
      { label: 'Avg Booking Duration', value: `${avgDuration.toFixed(1)} days` },
      { label: 'Fleet Utilisation', value: `${utilisation}%` },
      { label: 'Top Vehicle', value: topVehicle ? `${topVehicle.make} ${topVehicle.model}` : 'N/A' },
    ]);

    const monthLabels = Array.from({ length: 12 }, (_, index) => {
      const date = new Date();
      date.setMonth(index);
      return date.toLocaleString('en-US', { month: 'short' });
    });

    this.bookingVolumeChart.set({
      labels: monthLabels,
      datasets: [
        {
          label: 'Bookings',
          data: monthLabels.map((label) =>
            bookings.filter((booking) => new Date(booking.startDate).toLocaleString('en-US', { month: 'short' }) === label).length
          ),
          backgroundColor: '#1A56DB',
          borderRadius: 8,
        },
      ],
    });

    const typeLabels = [...new Set(vehicles.map((vehicle) => vehicle.type || 'Other'))];
    this.revenueByTypeChart.set({
      labels: typeLabels,
      datasets: [
        {
          data: typeLabels.map((label) =>
            bookings
              .filter((booking) => booking.vehicleType === label)
              .reduce((sum, booking) => sum + booking.cost, 0)
          ),
          backgroundColor: ['#1A56DB', '#0E9F6E', '#C27803', '#7E3AF2', '#0694A2'],
        },
      ],
    });

    const statuses = ['Pending', 'Approved', 'InProgress', 'Completed', 'Cancelled'];
    this.bookingsByStatusChart.set({
      labels: statuses,
      datasets: [
        {
          label: 'Bookings',
          data: statuses.map((status) => bookings.filter((booking) => booking.status === status).length),
          backgroundColor: ['#C27803', '#0E9F6E', '#1A56DB', '#374151', '#E02424'],
          borderRadius: 8,
        },
      ],
    });

    this.topVehicleRows.set(
      vehicles
        .map((vehicle) => ({
          label: `${vehicle.make} ${vehicle.model}`,
          count: bookings.filter((booking) => booking.vehicleId === vehicle.id).length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );
  }
}
