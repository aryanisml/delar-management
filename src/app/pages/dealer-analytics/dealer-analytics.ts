import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-dealer-analytics',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './dealer-analytics.html',
  styleUrl: './dealer-analytics.scss'
})
export class DealerAnalytics {}
