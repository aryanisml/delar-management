import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-dealer-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule
  ],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss',
})
export class DealerDashboard implements OnInit {

  private supabase = inject(SupabaseService);
  private router = inject(Router);

  vehicles: any[] = [];
  bookings: any[] = [];

  async ngOnInit() {
    await this.loadVehicles();
    await this.loadBookings();
  }

  async loadVehicles() {
    const { data } = await this.supabase.getVehicles();
    this.vehicles = data || [];
  }

  async loadBookings() {
    const { data } = await this.supabase.getPendingBookings();
    this.bookings = data || [];
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(`/dealer/${path}`);
  }

  get activeVehicleCount(): number {
    return this.vehicles?.filter(v => v.status === 'active').length || 0;
  }

  get totalRevenue(): number {
    return this.vehicles?.reduce((sum, v) => sum + (v.daily_rate || 0), 0) || 0;
  }
}
