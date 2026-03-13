import { Component, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../services/supabase';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StepperModule } from 'primeng/stepper';

@Component({
  selector: 'app-dealer-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, StepperModule],
  templateUrl: './dealer-dashboard.html',
  styleUrl: './dealer-dashboard.scss'
})
export class DealerDashboard {

  private supabase = inject(SupabaseService);
  private router = inject(Router);
  userEmail = signal<string | null>(null);
  activeStep = signal(1);

  readonly quickActions = [
    {
      label: 'Inventory',
      caption: 'Add or update vehicles',
      icon: 'pi pi-car',
      route: '/dealer/inventory',
      tone: 'dashboard-btn--hero'
    },
    {
      label: 'Bookings',
      caption: 'Track upcoming rentals',
      icon: 'pi pi-calendar',
      route: '/dealer/bookings',
      tone: 'dashboard-btn--soft'
    },
    {
      label: 'Analytics',
      caption: 'Review performance trends',
      icon: 'pi pi-chart-line',
      route: '/dealer/analytics',
      tone: 'dashboard-btn--ghost'
    }
  ] as const;

  readonly userName = computed(() => {
    const email = this.userEmail();
    return email ? email.split('@')[0] : 'Dealer';
  });

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    this.userEmail.set(user?.email ?? null);
  }

  async signOut() {
    await this.supabase.signOut();
    window.location.href = '/login';
  }

  setActiveStep(step?: number) {
    this.activeStep.set(step ?? 1);
  }

  async openRoute(route: string) {
    await this.router.navigateByUrl(route);
  }
}
