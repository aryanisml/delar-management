import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-dealer-bookings',
  standalone: true,
  imports: [CommonModule, TableModule, CardModule, TagModule],
  templateUrl: './dealer-bookings.html',
  styleUrl: './dealer-bookings.scss'
})
export class DealerBookings implements OnInit {

  private supabase = inject(SupabaseService);

  bookings: any[] = [];

  async ngOnInit() {
    await this.loadBookings();
  }

  async loadBookings() {
    const { data } = await this.supabase.getPendingBookings();
    this.bookings = data || [];
  }
}
