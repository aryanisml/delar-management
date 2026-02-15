import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SupabaseService } from '../../services/supabase';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-dealer-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    CardModule,
    TabsModule,
    TagModule,
    InputTextModule
  ],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss',
})
export class DealerDashboard implements OnInit {

  vehicles: any[] = [];
  bookings: any[] = [];

  displayDialog = false;
  activeTabIndex = 0;

  newVehicle: any = {
    Brand: '',
    model: '',
    Stock: 0,
    status: 'active',
    daily_rate: 0
  };

  constructor(private supabase: SupabaseService) {}

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

  async saveVehicle() {
    await this.supabase.addVehicle(this.newVehicle);
    this.displayDialog = false;

    this.newVehicle = {
      Brand: '',
      model: '',
      Stock: 0,
      status: 'active',
      daily_rate: 0
    };

    await this.loadVehicles();
  }

  async approveBooking(id: string) {
    await this.supabase.updateBookingStatus(id, 'approved');
    await this.loadBookings();
  }

  async rejectBooking(id: string) {
    await this.supabase.updateBookingStatus(id, 'rejected');
    await this.loadBookings();
  }

  get activeVehicleCount(): number {
    return this.vehicles?.filter(v => v.status === 'active').length || 0;
  }

  get approvedBookings(): number {
    return this.bookings?.filter(b => b.status === 'approved').length || 0;
  }
}
