import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
  readonly trendChart = signal<any>(null);
  readonly statusChart = signal<any>(null);
  readonly purposeBreakdown = signal<any[]>([]);

  async ngOnInit() {
    const { data: vehiclesRaw } = await this.supabase.getVehicles();
    const { data: bookingRows } = await this.supabase.getBookings();
    const vehicles = (vehiclesRaw ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
    const bookings = buildBookings(vehicles, bookingRows ?? []);

    this.topMetrics.set([
      { label: 'Live Fleet', value: vehicles.filter((item) => item.status === 'Available').length },
      { label: 'Bookings This Week', value: bookings.length },
      { label: 'Average Revenue / Booking', value: `Rs ${Math.round(bookings.reduce((sum, item) => sum + item.cost, 0) / Math.max(1, bookings.length)).toLocaleString('en-IN')}` },
    ]);

    this.trendChart.set({
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        { label: 'Searches', data: [54, 62, 58, 74, 88, 82, 95], borderColor: '#1A56DB', backgroundColor: 'rgba(26, 86, 219, 0.12)', fill: true, tension: 0.4 },
        { label: 'Conversions', data: [18, 24, 22, 30, 33, 31, 38], borderColor: '#0E9F6E', backgroundColor: 'rgba(14, 159, 110, 0.1)', fill: true, tension: 0.4 },
      ],
    });

    this.statusChart.set({
      labels: ['Available', 'Maintenance', 'Inactive'],
      datasets: [{
        data: [
          vehicles.filter((item) => item.status === 'Available').length,
          vehicles.filter((item) => item.status === 'Maintenance').length || 0,
          vehicles.filter((item) => item.status === 'Inactive').length || 0,
        ],
        backgroundColor: ['#0E9F6E', '#E02424', '#9CA3AF'],
      }],
    });

    this.purposeBreakdown.set(
      ['Corporate', 'Personal', 'Transfer', 'Event'].map((label) => ({
        label,
        pct: Math.round((bookings.filter((item) => item.purpose === label).length / Math.max(1, bookings.length)) * 100),
      }))
    );
  }
}
