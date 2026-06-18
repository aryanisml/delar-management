import { Injectable, computed, inject, signal } from '@angular/core';
import { AgentLlmClient, LlmMessage } from './agent-llm.client';
import { AgentTools, BookingProposal, BookingFormSpec, BOOKING_DRY_RUN } from './agent-tools';

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
  /** Tool names called this conversation — gates when create_booking is advertised. */
  private calledTools = new Set<string>();
  /** tool_call_id -> tool name, used to compact superseded search results in history. */
  private toolCallNames = new Map<string, string>();

  readonly open = signal(false);
  readonly messages = signal<UiMessage[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingConfirmation = signal<BookingProposal | null>(null);
  readonly pendingForm = signal<BookingFormSpec | null>(null);
  readonly greetingVisible = signal(false);

  readonly started = computed(() => this.messages().length > 0);
  readonly dryRun = BOOKING_DRY_RUN;

  // Re-entry guard so a double / retried Confirm cannot create duplicate bookings.
  private committing = false;

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
    // Typing instead of using a card/form cancels any staged booking card or open form.
    this.pendingConfirmation.set(null);
    this.pendingForm.set(null);
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
    this.calledTools.clear();
    this.toolCallNames.clear();
    this.messages.set([]);
    this.pendingConfirmation.set(null);
    this.pendingForm.set(null);
    this.error.set(null);
  }

  private async runLoop() {
    this.busy.set(true);
    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const assistant = await this.client.chat({
          messages: [this.systemMessage(), ...this.history],
          tools: this.tools.schemasFor({
            includeCreateBooking: this.bookingToolReady(),
            includeTripForm: this.tripFormReady(),
          }),
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

        let formOpened = false;
        for (const call of toolCalls) {
          const result = await this.tools.execute(call.function.name, call.function.arguments);
          this.calledTools.add(call.function.name);
          this.toolCallNames.set(call.id, call.function.name);
          this.history.push({ role: 'tool', tool_call_id: call.id, content: result.content });
          if (result.kind === 'proposal') {
            this.pendingConfirmation.set(result.proposal);
          } else if (result.kind === 'form') {
            this.pendingConfirmation.set(null);
            this.pendingForm.set(result.form);
            formOpened = true;
          }
        }

        this.compactHistory();

        // A form is now on screen — stop here and let the advisor fill it (no extra model call).
        if (formOpened) {
          const note = 'I’ve opened a quick form below — fill in the trip details and I’ll prepare the booking to confirm.';
          this.pushUi('assistant', note);
          this.history.push({ role: 'assistant', content: note });
          return;
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

  /** create_booking is advertised only once we're past discovery (priced/checked, or editing a proposal). */
  private bookingToolReady(): boolean {
    return (
      this.calledTools.has('price_quote') ||
      this.calledTools.has('check_availability') ||
      this.pendingConfirmation() !== null
    );
  }

  /** The trip-details form can open as soon as a vehicle has been looked up (one is choosable). */
  private tripFormReady(): boolean {
    return this.calledTools.has('search_vehicles') || this.bookingToolReady();
  }

  /**
   * Replace superseded search_vehicles / search_customers results in history with a tiny stub,
   * keeping only the latest of each. The chosen entity's id lives on in later tool-call args, so
   * the bulky earlier lists are no longer needed and shouldn't keep riding along on every request.
   */
  private compactHistory() {
    const compactable = new Set(['search_vehicles', 'search_customers']);
    const latestIndex = new Map<string, number>();
    this.history.forEach((msg, index) => {
      if (msg.role === 'tool' && msg.tool_call_id) {
        const name = this.toolCallNames.get(msg.tool_call_id);
        if (name && compactable.has(name)) {
          latestIndex.set(name, index);
        }
      }
    });
    this.history.forEach((msg, index) => {
      if (msg.role !== 'tool' || !msg.tool_call_id) {
        return;
      }
      const name = this.toolCallNames.get(msg.tool_call_id);
      if (!name || !compactable.has(name) || latestIndex.get(name) === index) {
        return;
      }
      if (msg.content && !msg.content.startsWith('{"note"')) {
        msg.content = `{"note":"earlier ${name} results omitted to save space"}`;
      }
    });
  }

  // ---- Booking confirmation gate -------------------------------------------

  /** Triggered ONLY by the advisor clicking Confirm. Runs the real two-step write. */
  async confirmPendingBooking() {
    const proposal = this.pendingConfirmation();
    if (!proposal || this.busy() || this.committing) {
      return;
    }

    this.committing = true;
    this.busy.set(true);
    // Clear the proposal up front so the card can't be re-submitted while this runs.
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
      this.committing = false;
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

  // ---- Trip-details form ----------------------------------------------------

  /** Triggered when the advisor submits the inline trip-details form. Stages the booking. */
  async submitBookingForm(values: {
    pickup_location: string;
    drop_location: string;
    pickup_date: string;
    end_date: string;
    pickup_time: string;
    dropoff_time: string;
    purpose: string;
    number_of_passengers: number;
  }) {
    const form = this.pendingForm();
    if (!form || this.busy() || this.committing) {
      return;
    }

    this.busy.set(true);
    try {
      const args = {
        vehicle_id: form.context.vehicle_id,
        customer: form.context.customer ?? {},
        existing_customer_id: form.context.existing_customer_id,
        existing_customer_choice: form.context.existing_customer_id ? 'existing' : 'new',
        trip: {
          pickup_location: values.pickup_location,
          drop_location: values.drop_location,
          pickup_date: values.pickup_date,
          end_date: values.end_date,
          pickup_time: values.pickup_time,
          dropoff_time: values.dropoff_time,
          purpose: values.purpose,
          number_of_passengers: values.number_of_passengers,
        },
      };

      const result = await this.tools.execute('create_booking', JSON.stringify(args));

      if (result.kind === 'proposal') {
        this.pendingForm.set(null);
        this.pendingConfirmation.set(result.proposal);
        const summary =
          `${values.pickup_location} → ${values.drop_location}, ${values.pickup_date} ${values.pickup_time} – ` +
          `${values.end_date} ${values.dropoff_time}, ${values.number_of_passengers} passenger(s), purpose ${values.purpose}.`;
        this.history.push({ role: 'user', content: `Trip details submitted: ${summary}` });
        this.history.push({ role: 'assistant', content: 'Booking prepared — showing the confirmation card to review.' });
      } else {
        // Validation / availability problem — keep the form open and explain what to fix.
        let detail = 'Please review the details and try again.';
        try {
          const parsed = JSON.parse(result.content);
          detail = Array.isArray(parsed.issues) ? parsed.issues.join(' ') : parsed.detail || detail;
        } catch {
          // keep the default message
        }
        this.pushUi('assistant', detail, 'error');
      }
    } catch (err: any) {
      this.pushUi('assistant', err?.message || 'The booking could not be prepared.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  /** Triggered by the Cancel button on the trip form. */
  cancelBookingForm() {
    if (!this.pendingForm()) {
      return;
    }
    this.pendingForm.set(null);
    const message = 'No problem — tell me what you’d like to do instead.';
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
    'You are the Booking Assistant, an in-app helper for rental staff who book vehicles for customers.',
    `Today is ${today}. Resolve relative dates against it; always pass dates to tools as YYYY-MM-DD. Money is INR.`,
    'Rules:',
    '- Never invent vehicles, customers, availability, or prices — always use the tools for real data.',
    '- Ask only for missing details. To book you need: customer full name, mobile, licence no + expiry, individual/business (business needs a business name); trip pickup & drop location, pickup & drop dates, pickup & drop times, purpose, passengers; and the vehicle.',
    '- Use search_customers to find a customer; if several match a name, confirm by mobile. Block expired licences.',
    '- Use search_vehicles / check_availability / price_quote for real options and prices.',
    '- Seat capacity is a SOFT guide, not a hard limit: accept up to 3 passengers over a vehicle’s listed capacity without objection; only push back if it exceeds capacity + 3.',
    '- Once a customer and a vehicle are chosen, if ANY trip detail is missing (pickup/drop time, pickup/drop location, purpose, or passengers), call request_trip_form to show the advisor a quick form instead of asking one-by-one in chat. Pass everything you already know so it pre-fills. Purpose is optional.',
    '- To book: show a short summary (vehicle, dates, customer, total), then call create_booking. It does NOT finalise — it stages a card the advisor must Confirm (or Edit). Never say the booking is done; it is created only when they click Confirm.',
    '- On a tool error or validation issue, explain what is needed and ask — do not retry blindly.',
    'Keep replies short and neutral. Call yourself only the "Booking Assistant"; refer to vehicles by name and customers by name/mobile, not ids.',
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
