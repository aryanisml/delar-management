import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule, UIChart } from 'primeng/chart';
import { DataViewModule } from 'primeng/dataview';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { TooltipModule } from 'primeng/tooltip';
import { SupabaseService } from '../../services/supabase';
import {
  buildActionItems,
  buildActivityFeed,
  buildBookings,
  normalizeVehicle,
  tagSeverityForPriority,
  tagSeverityForStatus,
} from '../../admin-ui.models';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    ChartModule,
    DataViewModule,
    ProgressBarModule,
    SelectButtonModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TimelineModule,
    TooltipModule,
  ],
  templateUrl: './admin-overview.html',
  styleUrl: './admin-overview.scss',
})
export class AdminOverview implements OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private pollingSub?: Subscription;

  @ViewChild('bookingsTrendChart') bookingsTrendChart?: UIChart;

  readonly periodOptions = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
  ];

  readonly period = signal<'week' | 'month' | 'year'>('year');
  readonly isLoading = signal(true);
  readonly stats = signal({
    total: 0,
    available: 0,
    activeBookings: 0,
    pending: 0,
    maintenance: 0,
    cancelledToday: 0,
  });
  readonly statCards = signal<any[]>([]);
  readonly bookings = signal<any[]>([]);
  readonly todayBookings = signal<any[]>([]);
  readonly activities = signal(buildActivityFeed());
  readonly actionsNeeded = signal(buildActionItems());
  readonly pipeline = signal<any[]>([]);
  readonly trendChartData = signal<any>(null);
  readonly trendChartOptions = signal<any>(null);
  readonly statusChartData = signal<any>(null);
  readonly statusChartOptions = signal<any>(null);
  readonly revenueChartData = signal<any>(null);
  readonly revenueChartOptions = signal<any>(null);
  readonly statusLegend = signal<any[]>([]);

  async ngOnInit() {
    await this.loadDashboard();
    this.pollingSub = interval(30000).subscribe(() => {
      const nextItems = [...this.activities().slice(1), this.activities()[0]];
      this.activities.set(nextItems);
    });
  }

  ngOnDestroy() {
    this.pollingSub?.unsubscribe();
  }

  async loadDashboard() {
    this.isLoading.set(true);

    await this.supabase.releaseExpiredBookings();
    const { data: vehicles } = await this.supabase.getVehicles();
    const { data: bookingRows } = await this.supabase.getBookings();
    const { data: pendingRequests } = await this.supabase.getPendingBookingRequests();
    const normalizedVehicles = (vehicles ?? []).map((vehicle, index) => normalizeVehicle(vehicle, index));
    const bookings = buildBookings(normalizedVehicles, bookingRows ?? []);

    const stats = {
      total: normalizedVehicles.length,
      available: normalizedVehicles.filter((vehicle) => vehicle.status === 'Available').length,
      activeBookings: bookings.filter((booking) => ['Confirmed', 'InProgress'].includes(booking.status)).length,
      pending: pendingRequests?.length ?? bookings.filter((booking) => booking.status === 'Pending').length,
      maintenance: normalizedVehicles.filter((vehicle) => vehicle.status === 'Maintenance').length,
      cancelledToday: bookings.filter((booking) => booking.status === 'Cancelled').length,
    };

    this.stats.set(stats);
    this.bookings.set(bookings);
    this.actionsNeeded.set(
      (pendingRequests ?? []).slice(0, 4).map((row: any) => {
        const quote = row.quotation ?? {};
        const vehicle = row.vehicle ?? {};
        return {
          type: 'danger',
          icon: 'pi pi-clock',
          title: quote.quote_reference || quote.quotation_ref || `Booking ${String(row.id).slice(0, 8)}`,
          detail: `${quote.customer_name || 'Customer'} - ${vehicle.make || vehicle.brand || ''} ${vehicle.model || ''}`,
          route: '/admin/bookings',
        };
      })
    );
    const today = new Date();
    this.todayBookings.set(
      bookings
        .filter((booking) => {
          const start = new Date(booking.startDate);
          return start.toDateString() === today.toDateString();
        })
        .slice(0, 5)
    );
    this.pipeline.set(this.buildPipeline(bookings));
    this.statCards.set([
      {
        title: 'Total Vehicles',
        value: stats.total,
        trend: '+12% vs last month',
        icon: 'pi pi-car',
        borderClass: 'border-l-4 border-blue-500',
        iconShell: 'bg-blue-50 text-blue-600',
        trendClass: 'text-green-600',
      },
      {
        title: 'Available Now',
        value: stats.available,
        trend: 'Live fleet count',
        icon: 'pi pi-check-circle',
        borderClass: 'border-l-4 border-green-500',
        iconShell: 'bg-green-50 text-green-600',
        trendClass: 'text-green-600',
      },
      {
        title: 'Active Bookings',
        value: stats.activeBookings,
        trend: '+4 vs yesterday',
        icon: 'pi pi-calendar',
        borderClass: 'border-l-4 border-indigo-500',
        iconShell: 'bg-indigo-50 text-indigo-600',
        trendClass: 'text-blue-600',
      },
      {
        title: 'Pending Requests',
        value: stats.pending,
        trend: 'Needs admin action',
        icon: 'pi pi-clock',
        borderClass: 'border-l-4 border-amber-500',
        iconShell: 'bg-amber-50 text-amber-600',
        trendClass: 'text-amber-600',
      },
      {
        title: 'In Maintenance',
        value: stats.maintenance,
        dark: true,
        icon: 'pi pi-wrench',
      },
      {
        title: 'Cancelled Today',
        value: stats.cancelledToday,
        dark: true,
        icon: 'pi pi-times-circle',
      },
    ]);

    this.configureCharts(bookings, normalizedVehicles);
    this.isLoading.set(false);
  }

  buildPipeline(bookings: any[]) {
    const total = bookings.length || 1;
    const stages = [
      { label: 'Submitted', count: total, pct: 100, color: '#16A34A' },
      { label: 'Confirmed', count: bookings.filter((item) => item.status === 'Confirmed').length, pct: 70, color: '#22C55E' },
      { label: 'Assigned', count: bookings.filter((item) => item.assignedTo !== 'Unassigned').length, pct: 47, color: '#4ADE80' },
      { label: 'In Progress', count: bookings.filter((item) => item.status === 'InProgress').length, pct: 35, color: '#86EFAC' },
      { label: 'Completed', count: bookings.filter((item) => item.status === 'Completed').length, pct: 25, color: '#BBF7D0' },
    ];

    return stages.map((stage) => ({
      ...stage,
      pct: total ? Math.max(stage.pct, Math.round((stage.count / total) * 100)) : 0,
    }));
  }

  configureCharts(bookings: any[], vehicles: any[]) {
    const monthLabels = [`Apr '25`, `May '25`, `Jun '25`, `Jul '25`, `Aug '25`, `Sep '25`, `Oct '25`, `Nov '25`, `Dec '25`, `Jan '26`, `Feb '26`, `Mar '26`];
    const approvedSeries = [18, 22, 26, 25, 30, 34, 31, 36, 40, 42, 39, 45];
    const completedSeries = [12, 16, 20, 18, 24, 26, 27, 28, 32, 34, 33, 38];
    const revenueSeries = {
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      selfDrive: [120000, 135000, 142000, 150000, 166000, 174000],
      chauffeur: [88000, 94000, 102000, 118000, 121000, 130000],
      corporate: [64000, 72000, 81000, 93000, 99000, 110000],
    };
    const statusCounts = ['Available', 'Booked', 'Maintenance', 'Inactive'].map((label, index) => ({
      label,
      value: vehicles.filter((vehicle) => vehicle.status === label).length,
      color: ['#0E9F6E', '#C27803', '#E02424', '#9CA3AF'][index],
    }));

    this.trendChartData.set({
      labels: monthLabels,
      datasets: [
        {
          label: 'Confirmed Bookings',
          data: approvedSeries,
          borderColor: '#00B4A6',
          backgroundColor: 'rgba(0, 180, 166, 0.16)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Completed',
          data: completedSeries,
          borderColor: '#00A886',
          backgroundColor: 'rgba(0, 168, 134, 0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    });

    this.trendChartOptions.set({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, boxWidth: 8, color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#4B5B66' },
        },
      },
      scales: {
        x: {
          ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#7A8A95' },
          grid: { display: false },
        },
        y: {
          ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#7A8A95' },
          grid: { color: getComputedStyle(document.body).getPropertyValue('--border').trim() || '#E5E7EB', borderDash: [4, 4] },
        },
      },
    });

    this.statusChartData.set({
      labels: statusCounts.map((item) => item.label),
      datasets: [
        {
          data: statusCounts.map((item) => item.value),
          backgroundColor: statusCounts.map((item) => item.color),
          hoverOffset: 12,
          cutout: '65%',
        },
      ],
    });

    this.statusChartOptions.set({
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    });

    this.statusLegend.set(statusCounts.map((item) => ({
      ...item,
      percent: Math.round((item.value / Math.max(1, vehicles.length)) * 100),
    })));

    this.revenueChartData.set({
      labels: revenueSeries.labels,
      datasets: [
        { label: 'Self Drive', data: revenueSeries.selfDrive, backgroundColor: '#1A56DB', borderRadius: 6 },
        { label: 'Chauffeur', data: revenueSeries.chauffeur, backgroundColor: '#0E9F6E', borderRadius: 6 },
        { label: 'Corporate', data: revenueSeries.corporate, backgroundColor: '#7E3AF2', borderRadius: 6 },
      ],
    });

    this.revenueChartOptions.set({
      indexAxis: 'x',
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          ticks: {
            callback: (value: number) => `Rs ${Number(value) / 1000}k`,
          },
        },
      },
    });
  }

  statusSeverity(status: string) {
    return tagSeverityForStatus(status);
  }

  prioritySeverity(priority: string) {
    return tagSeverityForPriority(priority);
  }

  activityMarkerClass(event: { actor: string; action: string }) {
    const text = `${event.actor} ${event.action}`.toLowerCase();
    if (text.includes('system') || text.includes('flagged') || text.includes('overdue')) {
      return 'activity-marker--danger';
    }
    if (text.includes('completed')) {
      return 'activity-marker--success';
    }
    return 'activity-marker--info';
  }

  priorityItemClass(item: { type: string; title: string }) {
    if (item.type === 'danger') {
      return 'priority-item--urgent';
    }
    if (item.title.toLowerCase().includes('due')) {
      return 'priority-item--warning';
    }
    return 'priority-item--low';
  }

  totalTrendMetric() {
    return this.bookings().reduce((sum, booking) => sum + booking.cost, 0);
  }

  downloadChart() {
    const chart = this.bookingsTrendChart?.chart;
    if (!chart) {
      return;
    }

    const link = document.createElement('a');
    link.href = chart.toBase64Image();
    link.download = 'bookings-trend.png';
    link.click();
  }

  goTo(route: string) {
    this.router.navigateByUrl(route);
  }
}
