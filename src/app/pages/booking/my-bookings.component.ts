import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';


@Component({
selector: 'app-my-bookings',
imports: [CommonModule, TableModule, TagModule, CardModule],
standalone: true,
templateUrl: './my-bookings.component.html'
})
export class MyBookingsComponent {

private supabase = inject(SupabaseService);

  bookings = signal<any[]>([]);
  loading = signal(true);

  async ngOnInit() {

    const user = await this.supabase.getCurrentUser();

    if (!user) return;

    const { data, error } = await this.supabase.getMyBookings(user.id);

    if (!error && data) {
      this.bookings.set(data);
    }

    this.loading.set(false);
  }
}