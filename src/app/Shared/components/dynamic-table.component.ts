import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';

// Define the structure for our columns
export interface TableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  isCurrency?: boolean;
}

@Component({
  selector: 'app-reusable-table',
  standalone: true,
  // We import everything the table needs to render itself here
  imports: [CommonModule, TableModule, ButtonModule, TagModule, InputTextModule],
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.scss'
})
export class ReusableTableComponent {
  @Input() data: any[] = [];
  @Input() cols: TableColumn[] = [];

  @Input() actionTemplate?: TemplateRef<any>;

  @Output() onCancel = new EventEmitter<string>();

  cancel(id: string) {
    this.onCancel.emit(id);
  }

  getStatusSeverity(status: string) {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'available':
        return 'success';
      case 'pending':
        return 'warn';
      case 'completed':
        return 'secondary';
      case 'rejected':
      case 'cancelled':
      case 'out of stock':
        return 'danger';
      default:
        return 'info';
    }
  }
}
