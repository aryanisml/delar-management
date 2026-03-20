import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges  } from '@angular/core';
import { Vehicle } from '../../../models/vehicle';

import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-booking-dialog',
  standalone: true,
  imports: [
    DialogModule,
    InputTextModule,
    DatePickerModule,
    ButtonModule,
    FormsModule

  ],
  templateUrl: './booking-dialog.component.html',
  styleUrl: './booking-dialog.component.scss'
})
export class BookingDialogComponent {

  @Input() vehicle!: Vehicle;
  @Input() visible: boolean = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitBooking = new EventEmitter<any>();

  pickupLocation = '';
  dropLocation = '';
  startDate: Date | null = null;
  endDate: Date | null = null;
  purpose = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      this.resetFields();
    }
  }

  resetFields() {
    this.pickupLocation = '';
    this.dropLocation = '';
    this.startDate = null;
    this.endDate = null;
    this.purpose = '';
  }
  
  submit() {

    const bookingData = {
  vehicle_id: this.vehicle.id,
  pickup_location: this.pickupLocation,
  drop_location: this.dropLocation,
  start_date: this.startDate,
  end_date: this.endDate,
  purpose: this.purpose,
  status: 'pending'
};

    this.submitBooking.emit(bookingData);
  }

  closeDialog() {
    this.close.emit();
  }

}