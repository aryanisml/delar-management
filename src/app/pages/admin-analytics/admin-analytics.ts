import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './admin-analytics.html',
  styleUrl: './admin-analytics.scss'
})
export class AdminAnalytics {

  private supabase = inject(SupabaseService);

  vehicles = signal<any[]>([]);

  chartData = signal<any>(null);
  chartOptions = signal<any>(null);

  stockChart = signal<any>(null);
  stockOptions = signal<any>(null);

  totalVehicles = signal<number>(0);
  activeCount = signal<number>(0);
  inactiveCount = signal<number>(0);
  archivedCount = signal<number>(0);

  estimatedRevenue = signal<number>(0);
  monthlyRevenue = signal<number>(0);
  lowStockCount = signal<number>(0);
  activePercentage = signal<number>(0);

  async ngOnInit() {
    await this.loadAnalytics();
  }

  async loadAnalytics() {

    const { data } = await this.supabase.getVehicles();
    const vehicles = data ?? [];
    this.vehicles.set(vehicles);

    const active = vehicles.filter(v => (v as any)['status'] === 'active').length;
    const inactive = vehicles.filter(v => (v as any)['status'] === 'inactive').length;
    const deleted = vehicles.filter(v => (v as any)['status'] === 'deleted').length;

    this.totalVehicles.set(vehicles.length);
    this.activeCount.set(active);
    this.inactiveCount.set(inactive);
    this.archivedCount.set(deleted);

    this.activePercentage.set(
      vehicles.length ? Math.round((active / vehicles.length) * 100) : 0
    );

    // Doughnut Chart (Smaller + Styled)
    this.chartData.set({
      labels: ['Active', 'Inactive', 'Archived'],
      datasets: [{
        data: [active, inactive, deleted],
        backgroundColor: ['#22c55e', '#f59e0b', '#9ca3af'],
        borderWidth: 2
      }]
    });

    this.chartOptions.set({
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      cutout: '65%'
    });

    // Stock Bar Chart
    this.stockChart.set({
      labels: vehicles.map(v => (v as any)['model']),
      datasets: [{
        label: 'Stock',
        data: vehicles.map(v => (v as any)['stock']),
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }]
    });

    this.stockOptions.set({
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    });

    const revenue = vehicles
      .filter(v => (v as any)['status'] === 'active')
      .reduce((sum, v) => sum + Number((v as any)['daily_rate'] ?? 0), 0);

    this.estimatedRevenue.set(revenue);
    this.monthlyRevenue.set(revenue * 30);

    this.lowStockCount.set(
      vehicles.filter(v =>
        (v as any)['status'] === 'active' &&
        (v as any)['stock'] < 3
      ).length
    );
  }
}
