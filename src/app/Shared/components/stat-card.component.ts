import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <p-card styleClass="kpi-card">
      <div class="stat-content">
        <span class="stat-icon">
          <i [class]="icon" [style.color]="iconColor"></i>
        </span>
        <div>
          <span class="stat-label">{{ label }}</span>
          <span class="stat-value">{{ value }}</span>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    :host ::ng-deep .kpi-card {
      border-radius: 0.75rem;
      box-shadow: var(--shadow-soft);
    }

    .stat-content {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .stat-icon {
      display: inline-flex;
      width: 2.4rem;
      height: 2.4rem;
      align-items: center;
      justify-content: center;
      border-radius: 0.5rem;
      background: var(--brand-soft);
    }

    .stat-icon i {
      font-size: 1.1rem;
    }

    .stat-label {
      display: block;
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .stat-value {
      display: block;
      margin-top: 0.25rem;
      color: var(--text-primary);
      font-size: 1.55rem;
      font-weight: 800;
      line-height: 1;
    }
  `]
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = 0;
  @Input() icon: string = '';
  @Input() iconColor: string = '#3B82F6'; // Default Blue
}
