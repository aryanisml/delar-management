import { Component, inject, signal } from '@angular/core';
import { SupabaseService } from '../../services/supabase';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dealer-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss'
})
export class DealerDashboard {

  private supabase = inject(SupabaseService);
  userEmail = signal<string | null>(null);

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    this.userEmail.set(user?.email ?? null);
  }

  async signOut() {
    await this.supabase.signOut();
    window.location.href = '/login';
  }
}
