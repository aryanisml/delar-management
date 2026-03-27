import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../services/supabase';
import { CardModule } from 'primeng/card';
import { ReusableTableComponent, TableColumn } from '../../../Shared/components/dynamic-table.component';
import { Booking } from '../../../models/booking';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule, CardModule, ReusableTableComponent], 
  templateUrl: './my-bookings.component.html'
})
export class MyBookingsComponent implements OnInit {
  private supabase = inject(SupabaseService);

  bookings = signal<Booking[]>([]);
  
  // Define the columns for the bookings table
  bookingCols: TableColumn[] = [
    { field: 'vehicle_display', header: 'Vehicle', sortable: true },
    { field: 'pickup_location', header: 'Pickup' },
    { field: 'drop_location', header: 'Drop' },
    { field: 'start_date', header: 'Start Date', sortable: true },
    { field: 'end_date', header: 'End Date', sortable: true },
    { field: 'status', header: 'Status' }
  ];

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    if (!user) return;

    const { data, error } = await this.supabase.getMyBookings(user.id);

    if (!error && data) {
  const rawBookings = data as any[];

  const transformedData = rawBookings.map(b => {
    // Check if vehicle is an array or a single object
    const v = Array.isArray(b.vehicle) ? b.vehicle[0] : b.vehicle;
    
    return {
      ...b,
      vehicle_display: `${v?.brand || ''} ${v?.model || ''}`.trim() || 'Unknown Vehicle'
    };
  });

  this.bookings.set(transformedData);
}
  }
}