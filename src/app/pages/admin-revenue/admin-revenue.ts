import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-revenue',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './admin-revenue.html'
})
export class AdminRevenue {

  private supabase = inject(SupabaseService);

  totalRevenue = signal<number>(0);
  activeRevenue = signal<number>(0);
  inactiveLoss = signal<number>(0);
  revenueChart = signal<any>(null);

  async ngOnInit() {
    await this.loadRevenue();
  }

  async loadRevenue() {
    const { data } = await this.supabase.getVehicles();
    const vehicles = data ?? [];

    const total = vehicles.reduce((sum, v) => sum + Number(v.daily_rate ?? 0), 0);
    const active = vehicles
      .filter(v => v.status === 'active')
      .reduce((sum, v) => sum + Number(v.daily_rate ?? 0), 0);

    this.totalRevenue.set(total);
    this.activeRevenue.set(active);
    this.inactiveLoss.set(total - active);

    this.revenueChart.set({
      labels: ['Active Revenue', 'Inactive Loss'],
      datasets: [{
        data: [active, total - active],
        backgroundColor: ['#16a34a', '#ef4444']
      }]
    });
  }
}
