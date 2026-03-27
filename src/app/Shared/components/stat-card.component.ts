import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <p-card class="kpi-card">
      <div class="stat-content flex align-items-center gap-3">
        <i [class]="icon" [style.color]="iconColor" style="font-size: 2.5rem"></i>
        <div>
          <span class="block text-gray-500 font-medium">{{ label }}</span>
          <span class="text-3xl font-bold">{{ value }}</span>
        </div>
      </div>
    </p-card>
  `
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = 0;
  @Input() icon: string = '';
  @Input() iconColor: string = '#3B82F6'; // Default Blue
}