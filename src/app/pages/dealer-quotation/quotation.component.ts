import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-quotation',
  standalone: true,
  templateUrl: './quotation.component.html',
  styleUrl: './quotation.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    CardModule,
    DatePickerModule,
    SelectModule,
    ToastModule
  ],
  providers: [MessageService]
})
export class QuotationComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);
  loading = false;

  booking: any;
  vehicle: any;

  // Customer Form
  customer = {
    name: '',
    mobile: '',
    email: '',
    license: '',
    licenseExpiry: '',
    type: 'individual',
    businessName: '',
    gst: ''
  };

  // Pricing
  rate = 0;
  days = 0;
  baseCost = 0;
  gst = 0;
  advance = 0;
  securityDeposit = 0;
  finalAmount = 0;

  async ngOnInit() {
    if (this.loading) return;
  this.loading = true;
  const id = this.route.snapshot.paramMap.get('bookingId');

  // 🚨 STOP if no ID (prevents infinite loop)
  if (!id) {
    this.router.navigate(['/dealer/my-bookings']);
    return;
  }

  const { data, error } = await this.supabase.supabase
    .from('bookings')
    .select(`*, vehicle(*)`)
    .eq('id', id)
    .single();

  // ✅ Handle refresh / invalid URL
  if (error || !data) {
    this.router.navigate(['/dealer/my-bookings']);
    return;
  }

  this.booking = data;
  this.vehicle = data.vehicle;

  this.calculatePricing();
}

  calculatePricing() {
  if (!this.vehicle || !this.booking) return;

  this.rate = this.vehicle.daily_rate || 0;

  const start = new Date(this.booking.start_date);
  const end = new Date(this.booking.end_date);

  this.days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );

  this.baseCost = this.rate * this.days;
  this.securityDeposit = this.baseCost * 0.2;
  this.advance = this.baseCost * 0.5;
  this.gst = this.baseCost * 0.18;

  this.finalAmount = this.baseCost + this.gst;
}

  validateForm(): boolean {
    if (!this.customer.name || !this.customer.mobile || !this.customer.license) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Missing Fields',
        detail: 'Please fill all required fields'
      });
      return false;
    }

    if (this.customer.mobile.length < 10) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Mobile',
        detail: 'Enter valid mobile number'
      });
      return false;
    }

    return true;
  }
  
  async saveQuotation(status: 'draft' | 'sent' | 'accepted') {
  const payload = {
    booking_id: this.booking.id,

    customer_name: this.customer.name,
    mobile: this.customer.mobile,
    email: this.customer.email,
    license: this.customer.license,
    license_expiry: this.customer.licenseExpiry,
    customer_type: this.customer.type,
    business_name: this.customer.businessName,
    gst_number: this.customer.gst,

    rate: this.rate,
    days: this.days,
    base_cost: this.baseCost,
    gst: this.gst,
    advance: this.advance,
    security_deposit: this.securityDeposit,
    final_amount: this.finalAmount,

    status
  };

  // 🔁 UPSERT (insert or update)
  const { error } = await this.supabase.supabase
    .from('quotations')
    .upsert(payload, { onConflict: 'booking_id' });

  if (error) {
    console.error(error);
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to save quotation'
    });
    return false;
  }

  return true;
}

async saveDraft() {
  if (!this.validateForm()) return;

  const success = await this.saveQuotation('draft');
  if (!success) return;

  await this.supabase.supabase
    .from('bookings')
    .update({ quote_status: 'draft' })
    .eq('id', this.booking.id);

  this.messageService.add({
    severity: 'success',
    summary: 'Saved',
    detail: 'Quotation saved as draft'
  });
}
  async sendQuote() {
  if (!this.validateForm()) return;

  const success = await this.saveQuotation('sent');
  if (!success) return;

  await this.supabase.supabase
    .from('bookings')
    .update({ quote_status: 'sent' })
    .eq('id', this.booking.id);

  this.messageService.add({
    severity: 'success',
    summary: 'Sent',
    detail: 'Quotation sent'
  });
}

  async confirmBooking() {
  const success = await this.saveQuotation('accepted');
  if (!success) return;

  await this.supabase.supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      quote_status: 'accepted'
    })
    .eq('id', this.booking.id);

  this.messageService.add({
    severity: 'success',
    summary: 'Confirmed',
    detail: 'Booking confirmed'
  });

  this.router.navigate(['/dealer/my-bookings']);
}
}