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
