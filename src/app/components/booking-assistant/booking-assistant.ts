import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent/agent.service';
import { BookingProposal } from '../../services/agent/agent-tools';

/**
 * Floating Booking Assistant: a circular avatar bottom-right that toggles a compact
 * popover chat card. Stateless itself — all conversation state lives in AgentService
 * (a root singleton), so the chat persists as the advisor navigates the app.
 */
@Component({
  selector: 'app-booking-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-assistant.html',
  styleUrl: './booking-assistant.scss',
})
export class BookingAssistant implements AfterViewInit {
  protected agent = inject(AgentService);

  @ViewChild('scrollArea') private scrollArea?: ElementRef<HTMLElement>;
  @ViewChild('chatInput') private chatInput?: ElementRef<HTMLTextAreaElement>;

  protected draft = '';

  protected readonly quickActions = [
    { label: 'Book a vehicle', icon: 'pi pi-calendar-plus', text: 'I want to book a vehicle for a customer.' },
    { label: 'Check availability', icon: 'pi pi-search', text: 'Check vehicle availability for some dates.' },
    { label: 'Find a customer', icon: 'pi pi-user', text: 'Find a customer.' },
  ];

  /** Two-way bound model for the inline trip-details form. */
  protected form = {
    pickup_location: '',
    drop_location: '',
    pickup_date: '',
    end_date: '',
    pickup_time: '',
    dropoff_time: '',
    purpose: '',
    number_of_passengers: 1,
  };

  protected readonly locationSuggestions = [
    'Hyderabad City Centre',
    'Hyderabad Airport (RGIA)',
    'Secunderabad Railway Station',
    'Gachibowli',
    'HITEC City',
    'Madhapur',
    'Banjara Hills',
    'Jubilee Hills',
    'Kondapur',
    'Begumpet',
  ];

  protected readonly purposeOptions = [
    'Leisure',
    'Business',
    'Airport Transfer',
    'Outstation Trip',
    'Wedding',
    'Local Errands',
    'Personal',
  ];

  constructor() {
    // Keep the transcript pinned to the latest message / typing indicator / card.
    effect(() => {
      this.agent.messages();
      this.agent.busy();
      this.agent.pendingConfirmation();
      queueMicrotask(() => this.scrollToBottom());
    });

    // Focus the composer whenever the panel opens.
    effect(() => {
      if (this.agent.open()) {
        queueMicrotask(() => this.chatInput?.nativeElement?.focus());
      }
    });

    // Pre-fill the inline form whenever the agent opens one.
    effect(() => {
      const spec = this.agent.pendingForm();
      if (spec) {
        this.form = {
          pickup_location: spec.prefill.pickup_location,
          drop_location: spec.prefill.drop_location,
          pickup_date: spec.prefill.pickup_date,
          end_date: spec.prefill.end_date,
          pickup_time: spec.prefill.pickup_time || '09:00',
          dropoff_time: spec.prefill.dropoff_time || '18:00',
          purpose: spec.prefill.purpose,
          number_of_passengers: spec.prefill.number_of_passengers || 1,
        };
      }
    });
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  protected send() {
    const text = this.draft;
    this.draft = '';
    void this.agent.sendUserMessage(text);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected runQuickAction(text: string) {
    this.agent.sendQuickAction(text);
  }

  protected submitForm() {
    void this.agent.submitBookingForm({
      ...this.form,
      number_of_passengers: Number(this.form.number_of_passengers) || 1,
    });
  }

  /** Disables Continue until the required (non-optional) fields are present. */
  protected formInvalid(): boolean {
    const f = this.form;
    return (
      !f.pickup_location?.trim() ||
      !f.drop_location?.trim() ||
      !f.pickup_date ||
      !f.end_date ||
      !f.pickup_time ||
      !f.dropoff_time
    );
  }

  /** Masks 10-digit Indian mobile numbers for display (e.g. 98••••4321). */
  protected mask(text: string): string {
    return String(text ?? '').replace(/(\+?91[\s-]?)?(\d{10})(?!\d)/g, (_match, _prefix, digits: string) => {
      return `${digits.slice(0, 2)}••••${digits.slice(6)}`;
    });
  }

  protected proposalTotal(proposal: BookingProposal): string {
    return this.formatInr(Number(proposal.pricing.final_amount) || 0);
  }

  protected proposalAdvance(proposal: BookingProposal): string {
    return this.formatInr(Number(proposal.pricing.advance) || 0);
  }

  protected formatInr(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private scrollToBottom() {
    const element = this.scrollArea?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }
}
