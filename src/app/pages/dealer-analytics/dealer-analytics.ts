import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'app-dealer-analytics',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './dealer-analytics.html',
  styleUrl: './dealer-analytics.scss'
})
export class DealerAnalytics implements OnInit {

  private supabase = inject(SupabaseService);

  vehicles: any[] = [];

  revenueChartData: any;
  statusChartData: any;
  locationChartData: any;

  async ngOnInit() {
    await this.loadVehicles();

    this.supabase.subscribeToVehicles(() => {
      this.loadVehicles();
    });
  }

  async loadVehicles() {
    const { data } = await this.supabase.getVehicles();
    this.vehicles = data || [];
    this.prepareCharts();
  }

  // ========================
  // KPIs
  // ========================

  get totalVehicles(): number {
    return this.vehicles.length;
  }

  get activeCount(): number {
    return this.vehicles.filter(v => v.status === 'active').length;
  }

  get maintenanceCount(): number {
    return this.vehicles.filter(v => v.status === 'maintenance').length;
  }

  get avgDailyRate(): number {
    if (!this.vehicles.length) return 0;
    const total = this.vehicles.reduce((sum, v) => sum + (v.daily_rate || 0), 0);
    return Math.round(total / this.vehicles.length);
  }

  get estimatedMonthlyRevenue(): number {
    return this.vehicles.reduce((sum, v) => {
      if (v.status === 'active') {
        return sum + ((v.daily_rate || 0) * 30 * (v.Stock || 0));
      }
      return sum;
    }, 0);
  }

  get topVehicle(): any {
    if (!this.vehicles.length) return null;

    return [...this.vehicles].sort((a, b) =>
      ((b.daily_rate || 0) * (b.Stock || 0)) -
      ((a.daily_rate || 0) * (a.Stock || 0))
    )[0];
  }

  // ========================
  // Charts
  // ========================

  prepareCharts() {

    this.revenueChartData = {
      labels: this.vehicles.map(v => v.model),
      datasets: [
        {
          label: 'Estimated Monthly Revenue',
          data: this.vehicles.map(v =>
            v.status === 'active'
              ? (v.daily_rate || 0) * 30 * (v.Stock || 0)
              : 0
          )
        }
      ]
    };

    const active = this.vehicles.filter(v => v.status === 'active').length;
    const inactive = this.vehicles.filter(v => v.status === 'inactive').length;
    const maintenance = this.vehicles.filter(v => v.status === 'maintenance').length;

    this.statusChartData = {
      labels: ['Active', 'Inactive', 'Maintenance'],
      datasets: [
        {
          data: [active, inactive, maintenance]
        }
      ]
    };

    const locationMap: any = {};
    this.vehicles.forEach(v => {
      const loc = v.location || 'Unknown';
      locationMap[loc] = (locationMap[loc] || 0) + 1;
    });

    this.locationChartData = {
      labels: Object.keys(locationMap),
      datasets: [
        {
          label: 'Vehicles by Location',
          data: Object.values(locationMap)
        }
      ]
    };
  }
}
