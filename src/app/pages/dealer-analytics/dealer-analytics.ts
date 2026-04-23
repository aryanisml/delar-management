import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { Booking } from '../../models/booking';
import { SupabaseService } from '../../services/supabase';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-dealer-analytics',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, ChartModule, ProgressBarModule, ToastModule],
  templateUrl: './dealer-analytics.html',
  styleUrl: './dealer-analytics.scss',
  providers: [MessageService],
})
export class DealerAnalytics {
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);

  readonly bookings = signal<Booking[]>([]);
  readonly stats = signal<any[]>([]);
  readonly monthlyChart = signal<any>(null);
  readonly statusChart = signal<any>(null);

  readonly topVehicles = computed(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const booking of this.bookings()) {
      const vehicle = booking.vehicle;
      const label = `${vehicle?.brand || vehicle?.make || 'Vehicle'} ${vehicle?.model || ''}`.trim();
      const current = counts.get(label) ?? { label, count: 0 };
      current.count += booking.quantity ?? 1;
      counts.set(label, current);
    }
    const max = Math.max(1, ...[...counts.values()].map((item) => item.count));
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5).map((item) => ({ ...item, pct: Math.round((item.count / max) * 100) }));
  });

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

    const { data, error } = await this.supabase.getMyBookings(user.id);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Analytics unavailable', detail: error.message || 'Could not load analytics.' });
      return;
    }

    const bookings = (data ?? []) as Booking[];
    this.bookings.set(bookings);

    const totalSpend = bookings
      .filter((booking) => booking.status === 'confirmed' || booking.status === 'completed')
      .reduce((sum, booking) => {
        const dailyRate = Number(booking.vehicle?.daily_rate ?? 0);
        const days = Math.max(1, Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 86400000));
        return sum + dailyRate * days * Number(booking.quantity ?? 1);
      }, 0);

    const avgDuration =
      bookings.reduce((sum, booking) => sum + Math.max(1, Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 86400000)), 0) /
      Math.max(1, bookings.length);

    this.stats.set([
      { label: 'Total Bookings', value: bookings.length },
      { label: 'Active Now', value: bookings.filter((booking) => booking.status === 'pending' || booking.status === 'confirmed').length },
      { label: 'Total Spend', value: `Rs ${Math.round(totalSpend).toLocaleString('en-IN')}` },
      { label: 'Avg Booking Duration', value: `${avgDuration.toFixed(1)} days` },
    ]);

    const monthlyLabels = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return date.toLocaleString('en-US', { month: 'short' });
    });

    this.monthlyChart.set({
      labels: monthlyLabels,
      datasets: [
        {
          label: 'Bookings',
          data: monthlyLabels.map((label) =>
            bookings.filter((booking) => new Date(booking.created_at || booking.start_date).toLocaleString('en-US', { month: 'short' }) === label).length
          ),
          backgroundColor: '#1A56DB',
          borderRadius: 8,
        },
      ],
    });

    const statusLabels = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'];
    this.statusChart.set({
      labels: statusLabels.map((status) => status.toUpperCase()),
      datasets: [
        {
          data: statusLabels.map((status) => bookings.filter((booking) => booking.status === status).length),
          backgroundColor: ['#C27803', '#0E9F6E', '#E02424', '#6B7280', '#1A56DB'],
        },
      ],
    });
  }

  downloadReport() {
    const rows = this.bookings().map((booking) => ({
      id: booking.id,
      vehicle: `${booking.vehicle?.brand || booking.vehicle?.make || ''} ${booking.vehicle?.model || ''}`.trim(),
      status: booking.status,
      start_date: booking.start_date,
      end_date: booking.end_date,
      quantity: booking.quantity ?? 1,
      purpose: booking.purpose,
    }));
    const headers = Object.keys(rows[0] ?? { id: '', vehicle: '', status: '', start_date: '', end_date: '', quantity: '', purpose: '' });
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header as keyof typeof row] ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dealer-booking-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
