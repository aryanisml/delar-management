import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-dealer-performance',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './admin-dealer-performance.html'
})
export class AdminDealerPerformance {

  private supabase = inject(SupabaseService);

  dealerCount = signal<number>(0);
  adminCount = signal<number>(0);

  async ngOnInit() {
    await this.load();
  }

  async load() {
    const { data } = await this.supabase.getAllUserRoles();
    const users = data ?? [];

    this.dealerCount.set(users.filter(u => u.role === 'dealer').length);
    this.adminCount.set(users.filter(u => u.role === 'admin').length);
  }
}
