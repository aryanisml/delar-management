import { Component, Input, TemplateRef, Output, EventEmitter, signal, computed } from '@angular/core';
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
  
  // This allows the "Book" button to be passed in from the dashboard
  @Input() actionTemplate?: TemplateRef<any>;
 
  @Output() onCancel = new EventEmitter<string>();

cancel(id: string) {
  this.onCancel.emit(id);
}

  // ADD THE FUNCTION HERE
  getStatusSeverity(status: string) {
    // We use .toLowerCase() to ensure it matches even if the database has capital letters
    switch (status?.toLowerCase()) {
      case 'approved': 
      case 'available': // You can reuse this for vehicle availability too!
        return 'success';
      case 'pending': 
        return 'warn';
      case 'rejected':
      case 'cancelled': 
      case 'out of stock':
        return 'danger';
      default: 
        return 'info';
    }
  }
}