import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './admin-overview.html',
  styleUrl: './admin-overview.scss'
})
export class AdminOverview {

  private supabase = inject(SupabaseService);

  vehicles = signal<any[]>([]);
  users = signal<any[]>([]);
  loading = signal<boolean>(true);

  totalVehicles = computed(() => this.vehicles().length);
  activeVehicles = computed(() =>
    this.vehicles().filter(v => v.status === 'active').length
  );
  inactiveVehicles = computed(() =>
    this.vehicles().filter(v => v.status === 'inactive').length
  );
  archivedVehicles = computed(() =>
    this.vehicles().filter(v => v.status === 'deleted').length
  );

  totalDealers = computed(() =>
    this.users().filter(u => u.role === 'dealer').length
  );

  totalAdmins = computed(() =>
    this.users().filter(u => u.role === 'admin').length
  );

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);

    const vehicleRes = await this.supabase.getVehicles();
    const userRes = await this.supabase.getAllUserRoles();

    this.vehicles.set(vehicleRes.data ?? []);
    this.users.set(userRes.data ?? []);

    this.loading.set(false);
  }
}
