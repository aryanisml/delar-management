import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-dealer-inventory',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './dealer-inventory.html',
  styleUrl: './dealer-inventory.scss'
})
export class DealerInventory {}
