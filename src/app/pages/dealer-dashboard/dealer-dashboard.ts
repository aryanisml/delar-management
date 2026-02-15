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
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-dealer-dashboard',
  standalone: true,
  providers: [ConfirmationService, MessageService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    CardModule,
    TabsModule,
    TagModule,
    InputTextModule,
    ConfirmDialogModule,
    ToastModule
  ],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss',
})
export class DealerDashboard implements OnInit {

  vehicles: any[] = [];
  bookings: any[] = [];

  displayDialog = false;
  editMode = false;
  selectedVehicle: any = null;

  newVehicle: any = {
    Brand: '',
    model: '',
    Stock: 0,
    status: 'active',
    daily_rate: 0
  };

  constructor(
    private supabase: SupabaseService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

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

  openNew() {
    this.editMode = false;
    this.newVehicle = {
      Brand: '',
      model: '',
      Stock: 0,
      status: 'active',
      daily_rate: 0
    };
    this.displayDialog = true;
  }

  editVehicle(vehicle: any) {
    this.editMode = true;
    this.selectedVehicle = vehicle;
    this.newVehicle = { ...vehicle };
    this.displayDialog = true;
  }

  async saveVehicle() {
    if (this.editMode) {
      await this.supabase.updateVehicle(this.selectedVehicle.id, this.newVehicle);
      this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Vehicle updated successfully' });
    } else {
      await this.supabase.addVehicle(this.newVehicle);
      this.messageService.add({ severity: 'success', summary: 'Created', detail: 'Vehicle added successfully' });
    }

    this.displayDialog = false;
    await this.loadVehicles();
  }

  deleteVehicle(vehicle: any) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this vehicle?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        await this.supabase.deleteVehicle(vehicle.id);
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Vehicle deleted successfully' });
        await this.loadVehicles();
      }
    });
  }

  async approveBooking(id: string) {
    await this.supabase.updateBookingStatus(id, 'approved');
    this.messageService.add({ severity: 'success', summary: 'Approved', detail: 'Booking approved' });
    await this.loadBookings();
  }

  async rejectBooking(id: string) {
    await this.supabase.updateBookingStatus(id, 'rejected');
    this.messageService.add({ severity: 'warn', summary: 'Rejected', detail: 'Booking rejected' });
    await this.loadBookings();
  }

  get activeVehicleCount(): number {
    return this.vehicles?.filter(v => v.status === 'active').length || 0;
  }
}
