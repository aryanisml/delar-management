import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-dealer-inventory',
  standalone: true,
  providers: [ConfirmationService, MessageService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    CardModule,
    TagModule,
    InputTextModule,
    ConfirmDialogModule,
    ToastModule
  ],
  templateUrl: './dealer-inventory.html',
  styleUrl: './dealer-inventory.scss'
})
export class DealerInventory implements OnInit {

  vehicles: any[] = [];
  filteredVehicles: any[] = [];

  searchTerm = '';
  activeFilter: string = 'all';

  smartSuggestion: string | null = null;

  displayDialog = false;
  editMode = false;
  selectedVehicle: any = null;
  newVehicle: any = this.resetVehicle();

  constructor(
    private supabase: SupabaseService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadVehicles();
    this.supabase.subscribeToVehicles(() => {
      this.loadVehicles();
    });
  }

  async loadVehicles() {
    const { data } = await this.supabase.getVehicles();
    this.vehicles = data || [];
    this.applyFilters();
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
    this.applyFilters();
  }

  applyFilters() {
    let data = [...this.vehicles];

    if (this.activeFilter === 'available') {
      data = data.filter(v => v.status === 'active');
    }

    if (this.activeFilter === 'inactive') {
      data = data.filter(v => v.status === 'inactive');
    }

    if (this.activeFilter === 'maintenance') {
      data = data.filter(v => v.status === 'maintenance');
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(v =>
        v.Brand?.toLowerCase().includes(term) ||
        v.model?.toLowerCase().includes(term) ||
        v.location?.toLowerCase().includes(term)
      );
      this.detectSmartSuggestion(term);
    } else {
      this.smartSuggestion = null;
    }

    this.filteredVehicles = data;
  }

  detectSmartSuggestion(term: string) {
    if (term.includes('revenue') || term.includes('performance') || term.includes('most booked')) {
      this.smartSuggestion = 'analytics';
    } else if (term.includes('upcoming') || term.includes('rentals')) {
      this.smartSuggestion = 'bookings';
    } else {
      this.smartSuggestion = null;
    }
  }

  navigateToSuggestion() {
    if (this.smartSuggestion) {
      this.router.navigateByUrl(`/dealer/${this.smartSuggestion}`);
    }
  }

  resetVehicle() {
    return {
      Brand: '',
      make: '',
      model: '',
      Stock: 0,
      status: 'active',
      daily_rate: 0,
      location: ''
    };
  }

  openNew() {
    this.editMode = false;
    this.newVehicle = this.resetVehicle();
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
    this.newVehicle = this.resetVehicle();
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

  get totalVehicles(): number {
    return this.vehicles.length;
  }

  get availableNow(): number {
    return this.vehicles.filter(v => v.status === 'active').length;
  }

  get inactiveCount(): number {
    return this.vehicles.filter(v => v.status === 'inactive').length;
  }

  get maintenanceCount(): number {
    return this.vehicles.filter(v => v.status === 'maintenance').length;
  }
}
