import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-inspection-placeholder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inspection-placeholder.component.html',
  styleUrl: './inspection-placeholder.component.scss',
})
export class InspectionPlaceholderComponent {
  private route = inject(ActivatedRoute);

  readonly bookingId = this.route.snapshot.paramMap.get('bookingId') || '-';
}
