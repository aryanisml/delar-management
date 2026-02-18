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
  vehicleStatusChartData: any;

  async ngOnInit() {
    await this.loadVehicles();
  }

  async loadVehicles() {
    const { data } = await this.supabase.getVehicles();
    this.vehicles = data || [];
    this.prepareCharts();
  }

  prepareCharts() {
    this.revenueChartData = {
      labels: this.vehicles.map(v => v.model),
      datasets: [
        {
          label: 'Daily Rate',
          backgroundColor: '#42A5F5',
          data: this.vehicles.map(v => v.daily_rate || 0)
        }
      ]
    };

    const active = this.vehicles.filter(v => v.status === 'active').length;
    const inactive = this.vehicles.length - active;

    this.vehicleStatusChartData = {
      labels: ['Active', 'Inactive'],
      datasets: [
        {
          data: [active, inactive],
          backgroundColor: ['#4CAF50', '#FF9800']
        }
      ]
    };
  }
}
