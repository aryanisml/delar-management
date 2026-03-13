import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

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
  imports: [CommonModule, TableModule, ButtonModule, TagModule],
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.scss'
})
export class ReusableTableComponent {
  @Input() data: any[] = [];
  @Input() cols: TableColumn[] = [];
  
  // This allows the "Book" button to be passed in from the dashboard
  @Input() actionTemplate?: TemplateRef<any>;
}