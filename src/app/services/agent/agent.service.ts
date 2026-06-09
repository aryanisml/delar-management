import { Injectable, computed, inject, signal } from '@angular/core';
import { AgentLlmClient, LlmMessage } from './agent-llm.client';
import { AgentTools, BookingProposal, BOOKING_DRY_RUN } from './agent-tools';

export interface UiMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  kind: 'normal' | 'error' | 'success';
}

const MAX_TOOL_ITERATIONS = 8;
const GREETED_KEY = 'booking-assistant-greeted';

/**
 * Holds the Booking Assistant conversation and drives the agent loop. It is a root
 * singleton, so chat state survives navigation while the authenticated shell stays
 * mounted. Tools execute client-side via SupabaseService, so existing RLS applies.
 */
@Injectable({ providedIn: 'root' })
export class AgentService {
  private client = inject(AgentLlmClient);
  private tools = inject(AgentTools);

  /** Raw OpenAI-format turns (user / assistant / tool), minus the system message. */
  private history: LlmMessage[] = [];
  private counter = 0;

  readonly open = signal(false);
  readonly messages = signal<UiMessage[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingConfirmation = signal<BookingProposal | null>(null);
  readonly greetingVisible = signal(false);

  readonly started = computed(() => this.messages().length > 0);
  readonly dryRun = BOOKING_DRY_RUN;

  constructor() {
    this.greetingVisible.set(!this.hasGreeted());
  }

  // ---- Panel / greeting state ----------------------------------------------

  toggle() {
    this.open.update((value) => !value);
    if (this.open()) {
      this.markGreeted();
    }
  }

  openPanel() {
    this.open.set(true);
    this.markGreeted();
  }

  closePanel() {
    this.open.set(false);
  }

  dismissGreeting() {
    this.markGreeted();
  }

  private markGreeted() {
    this.greetingVisible.set(false);
    try {
      window.localStorage.setItem(GREETED_KEY, '1');
    } catch {
      // Greeting simply re-appears next session if storage is unavailable.
    }
  }

  private hasGreeted(): boolean {
    try {
      return window.localStorage.getItem(GREETED_KEY) === '1';
    } catch {
      return false;
    }
  }

  // ---- Conversation ---------------------------------------------------------

  async sendUserMessage(text: string) {
    const trimmed = (text ?? '').trim();
    if (!trimmed || this.busy()) {
      return;
    }

    this.error.set(null);
    // Typing instead of clicking Confirm cancels any staged booking card.
    this.pendingConfirmation.set(null);
    this.pushUi('user', trimmed);
    this.history.push({ role: 'user', content: trimmed });
    await this.runLoop();
  }

  /** Quick-action chips reuse the normal message path. */
  sendQuickAction(text: string) {
    void this.sendUserMessage(text);
  }

  resetConversation() {
    if (this.busy()) {
      return;
    }
    this.history = [];
    this.messages.set([]);
    this.pendingConfirmation.set(null);
    this.error.set(null);
  }

  private async runLoop() {
    this.busy.set(true);
    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const assistant = await this.client.chat({
          messages: [this.systemMessage(), ...this.history],
          tools: this.tools.schemas,
          tool_choice: 'auto',
        });

        this.history.push(assistant);

        if (assistant.content && assistant.content.trim()) {
          this.pushUi('assistant', assistant.content.trim());
        }

        const toolCalls = assistant.tool_calls ?? [];
        if (!toolCalls.length) {
          return;
        }

        for (const call of toolCalls) {
          const result = await this.tools.execute(call.function.name, call.function.arguments);
          this.history.push({ role: 'tool', tool_call_id: call.id, content: result.content });
          if (result.kind === 'proposal') {
            this.pendingConfirmation.set(result.proposal);
          }
        }
      }

      this.pushUi('assistant', 'Sorry — I got stuck on that. Could you rephrase or try again?', 'error');
    } catch (err: any) {
      const message = err?.message || 'Something went wrong reaching the assistant.';
      this.pushUi('assistant', message, 'error');
      this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }

  // ---- Booking confirmation gate -------------------------------------------

  /** Triggered ONLY by the advisor clicking Confirm. Runs the real two-step write. */
  async confirmPendingBooking() {
    const proposal = this.pendingConfirmation();
    if (!proposal || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.pendingConfirmation.set(null);
    try {
      const result = await this.tools.commitBooking(proposal);

      if (!result.ok) {
        const message = result.partial
          ? `The booking was created${result.quoteReference ? ` (quote ${result.quoteReference})` : ''} but could not be submitted for approval: ${result.error}`
          : `I couldn't create the booking: ${result.error}`;
        this.pushUi('assistant', message, 'error');
        this.history.push({ role: 'assistant', content: message });
        return;
      }

      const idShort = result.bookingId ? String(result.bookingId).slice(0, 8) : '—';
      const dryNote = result.dryRun ? ' (rehearsal — nothing was saved to the database)' : '';
      const total = formatInr(Number(proposal.pricing.final_amount) || 0);
      const message =
        `✅ Booking ${idShort} for ${proposal.vehicleLabel} (${proposal.startDate} → ${proposal.endDate}) ` +
        `is submitted as pending for admin approval${dryNote}. Total ${total}` +
        `${result.quoteReference ? `, quote ${result.quoteReference}` : ''}.`;
      this.pushUi('assistant', message, 'success');
      this.history.push({
        role: 'assistant',
        content: `Booking committed: id=${result.bookingId}, status=${result.status ?? 'pending'}, quote=${result.quoteReference ?? '—'}.${result.dryRun ? ' (DRY RUN)' : ''}`,
      });
    } catch (err: any) {
      const message = err?.message || 'The booking could not be completed.';
      this.pushUi('assistant', message, 'error');
    } finally {
      this.busy.set(false);
    }
  }

  /** Triggered by the Edit button on the confirmation card. */
  cancelPendingBooking() {
    if (!this.pendingConfirmation()) {
      return;
    }
    this.pendingConfirmation.set(null);
    const message = 'No problem — tell me what to change (vehicle, dates, customer, or anything else).';
    this.pushUi('assistant', message);
    this.history.push({ role: 'assistant', content: message });
  }

  // ---- Internals ------------------------------------------------------------

  private pushUi(role: 'user' | 'assistant', text: string, kind: UiMessage['kind'] = 'normal') {
    this.messages.update((list) => [...list, { id: ++this.counter, role, text, kind }]);
  }

  private systemMessage(): LlmMessage {
    return { role: 'system', content: buildSystemPrompt() };
  }
}

function buildSystemPrompt(): string {
  const today = todayDateOnly();
  const dryRunNote = BOOKING_DRY_RUN
    ? '\nREHEARSAL MODE is ON: confirmed bookings are simulated and nothing is written to the database.'
    : '';

  return [
    'You are the Booking Assistant, an in-app helper for rental staff (advisors) who book vehicles on behalf of customers.',
    `Today's date is ${today}. Resolve relative dates ("tomorrow", "next Friday") against it and always use YYYY-MM-DD when calling tools. All money is Indian Rupees (INR).`,
    '',
    'HOW YOU WORK:',
    '- Never invent availability, prices, vehicles, or customers. Always use the tools to get real data.',
    '- Gather only the details that are still missing. Required to book:',
    '  • Customer: full name, mobile, licence number + expiry, and whether individual or business (business needs a business name).',
    '  • Trip: pickup location, drop location, pickup date, drop date, pickup time, drop-off time, purpose, and number of passengers.',
    '  • The vehicle.',
    '- To find a customer use search_customers. If several customers share a name, confirm which one by mobile number before continuing.',
    '- Refuse to proceed with an expired licence — ask for a valid one.',
    '- Use search_vehicles / check_availability / price_quote to recommend a vehicle and quote a real price.',
    '',
    'BOOKING CONFIRMATION:',
    '- When every required detail is known and the advisor wants to proceed, FIRST show a short summary (vehicle, dates, customer, total), THEN call create_booking.',
    '- create_booking does NOT finalise anything — it stages a confirmation card. After calling it, tell the advisor to review the card and click Confirm (or Edit). You cannot confirm on their behalf; the booking is only created when they click Confirm.',
    '- If a tool returns validation issues or an error, explain what is needed and ask the advisor — do not retry blindly.',
    '',
    'STYLE:',
    '- Keep replies short and practical. Be neutral and professional.',
    '- Refer to yourself only as the "Booking Assistant". Do not use personal names or any other branding.',
    '- Refer to vehicles by name and customers by name/mobile rather than internal ids.',
    dryRunNote,
  ].join('\n');
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
