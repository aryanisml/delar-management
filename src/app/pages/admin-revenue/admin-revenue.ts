import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { buildBookings, normalizeVehicle } from '../../admin-ui.models';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-revenue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ChartModule,
    DatePickerModule,
    SelectButtonModule,
    SelectModule,
    TableModule,
    ToastModule,
    CurrencyPipe,
  ],
  templateUrl: './admin-revenue.html',
  providers: [MessageService],
})
export class AdminRevenue {
  private supabase = inject(SupabaseService);
  readonly dateRange = signal<Date[] | null>(null);
  readonly groupBy = signal('Monthly');
  readonly timelineMode = signal('Monthly');
  readonly groupOptions = ['Daily', 'Weekly', 'Monthly'].map((label) => ({ label, value: label }));
  readonly timelineOptions = ['Daily', 'Weekly', 'Monthly'].map((label) => ({ label, value: label }));
  readonly kpis = signal<any[]>([]);
  readonly timelineData = signal<any>(null);
  readonly timelineOptionsChart = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top', align: 'end' } },
  };
  readonly utilisationData = signal<any>(null);
  readonly purposeData = signal<any>(null);
  readonly revenueRows = signal<any[]>([]);

  constructor(private messageService: MessageService) {}

  async ngOnInit() {
    const { data: vehiclesRaw } = await this.supabase.getVehicles();
    const { data: bookingRows } = await this.supabase.getBookings();
    const vehicles = (vehiclesRaw ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
    const bookings = buildBookings(vehicles, bookingRows ?? []);

    const completed = bookings.filter((item) => item.status === 'Completed');
    const totalRevenue = completed.reduce((sum, item) => sum + item.cost, 0);
    const avgDuration =
      bookings.reduce(
        (sum, item) => sum + Math.max(1, (new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 86400000),
        0
      ) / Math.max(1, bookings.length);

    this.kpis.set([
      { label: 'Total Bookings in Period', value: `${bookings.length}` },
      { label: 'Completion Rate', value: `${Math.round((completed.length / Math.max(1, bookings.length)) * 100)}%` },
      { label: 'Average Booking Duration', value: `${avgDuration.toFixed(1)} days` },
      { label: 'Revenue in Period', value: `Rs ${Math.round(totalRevenue).toLocaleString('en-IN')}` },
    ]);

    const monthlyBuckets = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((month, index) => ({
      month,
      slice: bookings.filter((_, bookingIndex) => bookingIndex % 6 === index),
    }));

    this.timelineData.set({
      labels: monthlyBuckets.map((item) => item.month),
      datasets: [
        { label: 'New Bookings', data: monthlyBuckets.map((item) => item.slice.length), borderColor: '#1A56DB', backgroundColor: 'rgba(26, 86, 219, 0.16)', fill: true, tension: 0.4 },
        { label: 'Completed', data: monthlyBuckets.map((item) => item.slice.filter((booking) => booking.status === 'Completed').length), borderColor: '#0E9F6E', backgroundColor: 'transparent', fill: false, tension: 0.4 },
        { label: 'Cancelled', data: monthlyBuckets.map((item) => item.slice.filter((booking) => booking.status === 'Cancelled').length), borderColor: '#E02424', backgroundColor: 'transparent', fill: false, tension: 0.4 },
      ],
    });

    const vehicleUtilization = vehicles.slice(0, 5).map((vehicle, index) => ({
      label: `${vehicle.make} ${vehicle.model}`,
      pct: Math.min(95, 40 + index * 11),
    }));

    this.utilisationData.set({
      labels: vehicleUtilization.map((item) => item.label),
      datasets: [
        {
          label: 'Utilisation %',
          data: vehicleUtilization.map((item) => item.pct),
          backgroundColor: vehicleUtilization.map((item) => item.pct > 75 ? '#0E9F6E' : item.pct >= 50 ? '#C27803' : '#E02424'),
        },
      ],
    });

    const purposeCounts = ['Corporate', 'Personal', 'Event', 'Transfer', 'Other'].map((purpose) =>
      bookings.filter((item) => item.purpose === purpose).length
    );

    this.purposeData.set({
      labels: ['Corporate', 'Personal', 'Event', 'Transfer', 'Other'],
      datasets: [{ data: purposeCounts, backgroundColor: ['#1A56DB', '#0E9F6E', '#7E3AF2', '#0694A2', '#9CA3AF'] }],
    });

    this.revenueRows.set(monthlyBuckets.map((bucket, index) => {
      const bucketCompleted = bucket.slice.filter((item) => item.status === 'Completed');
      const bucketCancelled = bucket.slice.filter((item) => item.status === 'Cancelled');
      const revenue = bucketCompleted.reduce((sum, item) => sum + item.cost, 0);
      const prevRevenue = index > 0
        ? monthlyBuckets[index - 1].slice.filter((item) => item.status === 'Completed').reduce((sum, item) => sum + item.cost, 0)
        : revenue;

      return {
        month: `${bucket.month} 2026`,
        totalBookings: bucket.slice.length,
        completed: bucketCompleted.length,
        cancelled: bucketCancelled.length,
        revenue,
        avg: revenue / Math.max(1, bucketCompleted.length),
        growth: prevRevenue ? Number((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1)) : 0,
      };
    }));
  }

  export(format: string) {
    this.messageService.add({
      severity: 'success',
      summary: 'Export started',
      detail: `${format} export has been prepared.`,
    });
  }
}
