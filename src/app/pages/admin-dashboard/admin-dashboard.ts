import { Component, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../services/supabase';
import { Vehicle } from '../../models/vehicle';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';

type MenuItem = { label: string; icon?: string; route?: string };

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, ToolbarModule, InputTextModule, TableModule, ButtonModule, CardModule, ProgressSpinnerModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  private supabase = inject(SupabaseService);

  // Signals
  vehicles = signal<Vehicle[]>([]);
  loading = signal<boolean>(true);
  filter = signal<string>('');

  // computed filtered list
  filteredVehicles = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.vehicles();
    return this.vehicles().filter(v => {
      return (
        (v.brand || '').toString().toLowerCase().includes(q) ||
        (v.make || '').toString().toLowerCase().includes(q) ||
        (v.model || '').toString().toLowerCase().includes(q)
      );
    });
  });

  async ngOnInit() {
    await this.loadVehicles();
  }

  async loadVehicles() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.getVehicles();

      if (error) {
        console.error('Error loading vehicles:', error);
        this.vehicles.set([]);
      } else {
        // data already normalized by the service; ensure non-null
        this.vehicles.set(data ?? []);
      }
    } catch (err) {
      console.error('Unexpected error fetching vehicles', err);
      this.vehicles.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(value: string) {
    this.filter.set(value || '');
  }

  // menu is provided by shared Layout; navigation handled there

  // simple logout helper
  async signOut() {
    await this.supabase.signOut();
    window.location.href = '/login';
  }

}
