import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-dealer-bookings',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './dealer-bookings.html',
  styleUrl: './dealer-bookings.scss'
})
export class DealerBookings {}
