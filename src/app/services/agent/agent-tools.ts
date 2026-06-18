import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase';
import { LlmToolSchema } from './agent-llm.client';

/**
 * Booking Assistant tools. Every executor wraps an EXISTING SupabaseService method
 * and runs client-side as the logged-in user, so the app's RLS applies unchanged.
 * Nothing here edits or re-implements the booking functions — it only calls them.
 *
 * Rehearsal switch: when BOOKING_DRY_RUN is true the write path is simulated and the
 * database is never touched, so the flow can be exercised end-to-end safely. Read
 * tools always run for real (they are side-effect free).
 */
export const BOOKING_DRY_RUN = false;

// Kept small: these lists are appended to the conversation and re-sent on every later
// model request, so trimming rows/fields directly cuts repeated token cost.
const MAX_CUSTOMER_RESULTS = 3;
const MAX_VEHICLE_RESULTS = 4;
// Seat capacity is a soft limit: allow up to this many extra passengers before refusing.
const PASSENGER_OVERAGE = 3;

export interface CreateBookingCustomer {
  full_name: string;
  mobile: string;
  email?: string | null;
  license_no: string;
  license_expiry: string;
  customer_type: 'individual' | 'business';
  business_name?: string | null;
  gst_number?: string | null;
}

export interface CreateBookingTrip {
  pickup_location: string;
  drop_location: string;
  pickup_date: string;
  end_date: string;
  pickup_time: string;
  dropoff_time: string;
  purpose: string;
  number_of_passengers: number;
  special_instructions?: string | null;
}

export interface CreateBookingArgs {
  vehicle_id: string;
  customer: CreateBookingCustomer;
  trip: CreateBookingTrip;
  existing_customer_id?: string | null;
  existing_customer_choice?: 'existing' | 'update' | 'new';
}

export interface PricingPreview {
  rate: number;
  days: number;
  base_cost: number;
  gst: number;
  advance: number;
  security_deposit: number;
  final_amount: number;
  [key: string]: unknown;
}

export interface BookingProposal {
  args: CreateBookingArgs;
  vehicleLabel: string;
  customerName: string;
  customerMobile: string;
  customerType: 'individual' | 'business';
  pickupLocation: string;
  dropLocation: string;
  startDate: string;
  endDate: string;
  days: number;
  pricing: PricingPreview;
  dryRun: boolean;
}

export interface BookingFormSpec {
  vehicleLabel: string;
  customerName: string;
  customerMobile: string;
  capacity: number;
  maxPassengers: number;
  context: { vehicle_id: string; existing_customer_id: string | null; customer: any };
  prefill: {
    pickup_location: string;
    drop_location: string;
    pickup_date: string;
    end_date: string;
    pickup_time: string;
    dropoff_time: string;
    purpose: string;
    number_of_passengers: number;
  };
}

export type ToolResult =
  | { kind: 'data'; content: string }
  | { kind: 'proposal'; content: string; proposal: BookingProposal }
  | { kind: 'form'; content: string; form: BookingFormSpec };

export interface CommitResult {
  ok: boolean;
  bookingId?: string;
  quoteReference?: string | null;
  status?: string;
  dryRun: boolean;
  partial?: boolean;
  error?: string;
}


@Injectable({ providedIn: 'root' })
export class AgentTools {
  private supabase = inject(SupabaseService);

  /** OpenAI-format tool schemas advertised to the model (descriptions kept terse to save tokens). */
  readonly schemas: LlmToolSchema[] = [
    {
      type: 'function',
      function: {
        name: 'search_customers',
        description: 'Find an existing customer by name, mobile, or email. If several share a name, confirm by mobile.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Name, 10-digit mobile, or email.' } },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_vehicles',
        description: 'List fleet vehicles (optionally filtered). Pass start_date/end_date (YYYY-MM-DD) for availability + daily rate.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Body type, e.g. SUV, Sedan.' },
            capacity: { type: 'integer', description: 'Min seats.' },
            transmission: { type: 'string', description: 'Automatic or Manual.' },
            fuel: { type: 'string', description: 'e.g. Petrol, Diesel, Electric.' },
            start_date: { type: 'string', description: 'YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'YYYY-MM-DD.' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: 'Check if one vehicle is free for a date range. Returns { available }.',
        parameters: {
          type: 'object',
          properties: {
            vehicle_id: { type: 'string' },
            start_date: { type: 'string', description: 'YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'YYYY-MM-DD.' },
          },
          required: ['vehicle_id', 'start_date', 'end_date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'price_quote',
        description: 'Exact rental price (INR) for a vehicle + date range. Returns rate, days, GST, advance, deposit, total.',
        parameters: {
          type: 'object',
          properties: {
            vehicle_id: { type: 'string' },
            start_date: { type: 'string', description: 'YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'YYYY-MM-DD.' },
            discount_amount: { type: 'number', description: 'Optional flat discount, INR.' },
          },
          required: ['vehicle_id', 'start_date', 'end_date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_booking',
        description:
          'Stage the booking for advisor confirmation once ALL details are gathered. Does NOT save — it shows a Confirm card. Call only after a summary; licence must not be expired.',
        parameters: {
          type: 'object',
          properties: {
            vehicle_id: { type: 'string' },
            customer: {
              type: 'object',
              properties: {
                full_name: { type: 'string' },
                mobile: { type: 'string', description: '10-digit mobile.' },
                email: { type: 'string' },
                license_no: { type: 'string' },
                license_expiry: { type: 'string', description: 'YYYY-MM-DD, must be future.' },
                customer_type: { type: 'string', enum: ['individual', 'business'] },
                business_name: { type: 'string', description: 'Required if business.' },
                gst_number: { type: 'string' },
              },
              required: ['full_name', 'mobile', 'license_no', 'license_expiry', 'customer_type'],
            },
            trip: {
              type: 'object',
              properties: {
                pickup_location: { type: 'string' },
                drop_location: { type: 'string' },
                pickup_date: { type: 'string', description: 'YYYY-MM-DD.' },
                end_date: { type: 'string', description: 'YYYY-MM-DD.' },
                pickup_time: { type: 'string', description: 'HH:MM 24h.' },
                dropoff_time: { type: 'string', description: 'HH:MM 24h.' },
                purpose: { type: 'string' },
                number_of_passengers: { type: 'integer' },
                special_instructions: { type: 'string' },
              },
              required: ['pickup_location', 'drop_location', 'pickup_date', 'end_date', 'pickup_time', 'dropoff_time', 'purpose', 'number_of_passengers'],
            },
            existing_customer_id: { type: 'string', description: 'From search_customers, for a returning customer.' },
            existing_customer_choice: { type: 'string', enum: ['existing', 'update', 'new'] },
          },
          required: ['vehicle_id', 'customer', 'trip'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_booking_status',
        description: 'Get a booking status by id.',
        parameters: {
          type: 'object',
          properties: { booking_id: { type: 'string' } },
          required: ['booking_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_trip_form',
        description:
          'PREFER THIS once a customer and a vehicle are chosen but ANY trip detail is missing (pickup/drop time, pickup/drop location, purpose, or passengers). It shows the advisor a quick fill-in form instead of asking in chat. Pass everything you already know so it pre-fills. After calling it, do NOT ask for these details in text — wait for the advisor to submit.',
        parameters: {
          type: 'object',
          properties: {
            vehicle_id: { type: 'string' },
            existing_customer_id: { type: 'string', description: 'For a returning customer, the id from search_customers.' },
            customer: {
              type: 'object',
              description: 'For a NEW customer, the gathered details.',
              properties: {
                full_name: { type: 'string' },
                mobile: { type: 'string' },
                email: { type: 'string' },
                license_no: { type: 'string' },
                license_expiry: { type: 'string', description: 'YYYY-MM-DD.' },
                customer_type: { type: 'string', enum: ['individual', 'business'] },
                business_name: { type: 'string' },
                gst_number: { type: 'string' },
              },
            },
            pickup_location: { type: 'string' },
            drop_location: { type: 'string' },
            pickup_date: { type: 'string', description: 'YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'YYYY-MM-DD.' },
            pickup_time: { type: 'string', description: 'HH:MM.' },
            dropoff_time: { type: 'string', description: 'HH:MM.' },
            purpose: { type: 'string' },
            number_of_passengers: { type: 'integer' },
          },
          required: ['vehicle_id'],
        },
      },
    },
  ];

  /**
   * Tools to advertise this turn. create_booking is the largest schema, so it is withheld
   * during discovery and only included once details are gathered (saves tokens per request).
   */
  schemasFor(opts: { includeCreateBooking: boolean; includeTripForm: boolean }): LlmToolSchema[] {
    return this.schemas.filter((schema) => {
      if (schema.function.name === 'create_booking') return opts.includeCreateBooking;
      if (schema.function.name === 'request_trip_form') return opts.includeTripForm;
      return true;
    });
  }

  /** Dispatches a tool call by name. Read tools return data; create_booking stages a proposal. */
  async execute(name: string, rawArgs: string): Promise<ToolResult> {
    let args: any = {};
    if (rawArgs && rawArgs.trim()) {
      try {
        args = JSON.parse(rawArgs);
      } catch {
        return this.data({ error: 'invalid_arguments', detail: 'Tool arguments were not valid JSON.' });
      }
    }

    try {
      switch (name) {
        case 'search_customers':
          return this.data(await this.searchCustomers(args.query));
        case 'search_vehicles':
          return this.data(await this.searchVehicles(args));
        case 'check_availability':
          return this.data(await this.checkAvailability(args));
        case 'price_quote':
          return this.data(await this.priceQuote(args));
        case 'create_booking':
          return await this.stageBooking(args);
        case 'request_trip_form':
          return await this.requestTripForm(args);
        case 'get_booking_status':
          return this.data(await this.getBookingStatus(args.booking_id));
        default:
          return this.data({ error: 'unknown_tool', detail: `No tool named ${name}.` });
      }
    } catch (err: any) {
      return this.data({ error: 'tool_failed', detail: err?.message || 'Tool execution failed.' });
    }
  }

  // ---- Read tools -----------------------------------------------------------

  private async searchCustomers(rawQuery: unknown) {
    const term = String(rawQuery ?? '').trim();
    if (!term) {
      return { error: 'missing_query', detail: 'Provide a name, mobile, or email to search.' };
    }

    const digits = term.replace(/\D/g, '');
    let rows: any[] = [];

    if (digits.length >= 5) {
      const byMobile = await this.supabase.searchCustomersByField('mobile', digits);
      if (byMobile.error) throw byMobile.error;
      rows = byMobile.data ?? [];
      if (!rows.length) {
        const exact = await this.supabase.findCustomerByMobile(digits);
        if (exact.error) throw exact.error;
        if (exact.data) rows = [exact.data];
      }
    }

    if (!rows.length && term.length >= 3) {
      const broad = await this.supabase.searchCustomers(term);
      if (broad.error) throw broad.error;
      rows = broad.data ?? [];
    }

    return {
      count: rows.length,
      customers: rows.slice(0, MAX_CUSTOMER_RESULTS).map((row) => this.toCustomerSummary(row)),
    };
  }

  private async searchVehicles(filters: any) {
    const startDate = parseDateOnly(filters?.start_date);
    const endDate = parseDateOnly(filters?.end_date);
    const { data, error } = await this.supabase.getWalkInVehicles({
      type: filters?.type ?? null,
      capacity: filters?.capacity != null ? Number(filters.capacity) : null,
      transmission: filters?.transmission ?? null,
      fuel: filters?.fuel ?? null,
      pickup_date: startDate,
      end_date: endDate,
    });
    if (error) throw error;

    const rows = data ?? [];
    return {
      count: rows.length,
      note: startDate && endDate ? 'Availability reflects the requested dates.' : 'No dates applied; availability is approximate.',
      vehicles: rows.slice(0, MAX_VEHICLE_RESULTS).map((row) => this.toVehicleSummary(row)),
    };
  }

  private async checkAvailability(args: any) {
    const vehicleId = String(args?.vehicle_id ?? '').trim();
    const startDate = parseDateOnly(args?.start_date);
    const endDate = parseDateOnly(args?.end_date);
    if (!vehicleId || !startDate || !endDate) {
      return { error: 'missing_fields', detail: 'vehicle_id, start_date and end_date (YYYY-MM-DD) are required.' };
    }
    if (endDate < startDate) {
      return { error: 'invalid_dates', detail: 'end_date must be on or after start_date.' };
    }

    const { data, error } = await this.supabase.isVehicleAvailable(vehicleId, startDate, endDate);
    if (error) throw error;
    return { vehicle_id: vehicleId, start_date: startDate, end_date: endDate, available: Boolean(data) };
  }

  private async priceQuote(args: any) {
    const vehicleId = String(args?.vehicle_id ?? '').trim();
    const startDate = parseDateOnly(args?.start_date);
    const endDate = parseDateOnly(args?.end_date);
    if (!vehicleId || !startDate || !endDate) {
      return { error: 'missing_fields', detail: 'vehicle_id, start_date and end_date (YYYY-MM-DD) are required.' };
    }
    if (endDate < startDate) {
      return { error: 'invalid_dates', detail: 'end_date must be on or after start_date.' };
    }

    const vehicle = await this.fetchVehicleRow(vehicleId);
    if (!vehicle) {
      return { error: 'vehicle_not_found', detail: `No vehicle found for id ${vehicleId}.` };
    }

    const options =
      args?.discount_amount != null ? { discountAmount: Math.max(0, Number(args.discount_amount) || 0) } : undefined;
    const pricing = this.supabase.buildQuotationPricingPreview(vehicle, startDate, endDate, options);
    return {
      currency: 'INR',
      vehicle: this.vehicleLabel(vehicle),
      start_date: startDate,
      end_date: endDate,
      ...pricing,
    };
  }

  private async getBookingStatus(rawId: unknown) {
    const bookingId = String(rawId ?? '').trim();
    if (!bookingId) {
      return { error: 'missing_fields', detail: 'booking_id is required.' };
    }
    const { data, error } = await this.supabase.getBookingById(bookingId);
    if (error) throw error;
    if (!data) {
      return { error: 'not_found', detail: `No booking found for id ${bookingId}.` };
    }
    return {
      booking_id: data.id,
      status: data.status,
      start_date: data.start_date,
      end_date: data.end_date,
      total_price: data.total_price ?? null,
    };
  }

  // ---- Trip-details form (model pops a UI form instead of asking in chat) ----

  /**
   * Opens the inline trip-details form. The model calls this once a customer + vehicle are
   * chosen but trip logistics are missing; the advisor fills the form instead of chatting.
   * Carries the resolved customer/vehicle so the form can stage the booking deterministically.
   */
  private async requestTripForm(args: any): Promise<ToolResult> {
    const vehicleId = String(args?.vehicle_id ?? '').trim();
    if (!vehicleId) {
      return this.data({ error: 'missing_fields', detail: 'A vehicle must be chosen before the form can open.' });
    }
    const vehicle = await this.fetchVehicleRow(vehicleId);
    if (!vehicle) {
      return this.data({ error: 'vehicle_not_found', detail: `No vehicle found for id ${vehicleId}.` });
    }

    const existingId = args?.existing_customer_id ? String(args.existing_customer_id) : null;
    let customer: any = args?.customer ?? {};
    if (existingId && (!customer.full_name || !customer.license_no)) {
      const fetched = await this.supabase.getCustomerById(existingId);
      if (fetched.data) {
        customer = { ...fetched.data, ...customer };
      }
    }

    const capacity = Number(vehicle.capacity ?? 0);
    const form: BookingFormSpec = {
      vehicleLabel: this.vehicleLabel(vehicle),
      customerName: customer.full_name || 'Customer',
      customerMobile: normalizeMobile(customer.mobile),
      capacity,
      maxPassengers: capacity > 0 ? capacity + PASSENGER_OVERAGE : 0,
      context: { vehicle_id: vehicleId, existing_customer_id: existingId, customer },
      prefill: {
        pickup_location: String(args?.pickup_location ?? '').trim(),
        drop_location: String(args?.drop_location ?? '').trim(),
        pickup_date: parseDateOnly(args?.pickup_date) ?? '',
        end_date: parseDateOnly(args?.end_date) ?? '',
        pickup_time: String(args?.pickup_time ?? '').trim(),
        dropoff_time: String(args?.dropoff_time ?? '').trim(),
        purpose: String(args?.purpose ?? '').trim(),
        number_of_passengers: Math.max(1, Math.round(Number(args?.number_of_passengers) || 1)),
      },
    };

    const content = JSON.stringify({
      status: 'awaiting_trip_form',
      message:
        'A trip-details form is now shown to the advisor to fill in. Wait for them to submit it; do NOT ask for pickup/drop times, locations, purpose, or passengers in text.',
    });
    return { kind: 'form', content, form };
  }

  /** Fills missing fields of a returning customer (existing_customer_id) from the database. */
  private async backfillExistingCustomer(normalized: CreateBookingArgs): Promise<void> {
    const id = normalized.existing_customer_id;
    if (!id) return;
    const c = normalized.customer;
    if (c.full_name && /^[6-9]\d{9}$/.test(c.mobile) && c.license_no && c.license_expiry) return;
    const fetched = await this.supabase.getCustomerById(id);
    const row: any = fetched.data;
    if (!row) return;
    c.full_name = c.full_name || row.full_name || '';
    if (!/^[6-9]\d{9}$/.test(c.mobile)) c.mobile = normalizeMobile(row.mobile);
    c.license_no = c.license_no || row.license_no || '';
    c.license_expiry = c.license_expiry || (parseDateOnly(row.license_expiry) ?? '');
    c.customer_type = row.customer_type === 'business' ? 'business' : c.customer_type || 'individual';
    c.email = c.email || row.email || null;
    c.business_name = c.business_name || row.business_name || null;
    c.gst_number = c.gst_number || row.gst_number || null;
  }

  // ---- Write path (staged, then committed only on explicit confirm) ----------

  private async stageBooking(args: any): Promise<ToolResult> {
    const normalized = this.normalizeBookingArgs(args);
    await this.backfillExistingCustomer(normalized);
    const issues = this.validateBookingArgs(normalized);
    if (issues.length) {
      return this.data({ error: 'validation_failed', issues });
    }

    const vehicle = await this.fetchVehicleRow(normalized.vehicle_id);
    if (!vehicle) {
      return this.data({ error: 'vehicle_not_found', detail: `No vehicle found for id ${normalized.vehicle_id}.` });
    }
    if (!vehicle.tier_id) {
      return this.data({
        error: 'no_pricing',
        detail: 'This vehicle has no pricing tier configured and cannot be booked. Ask an admin to set pricing.',
      });
    }

    // Seat capacity is a soft limit — allow up to PASSENGER_OVERAGE extra; only refuse beyond.
    const capacity = Number(vehicle.capacity ?? 0);
    if (capacity > 0 && normalized.trip.number_of_passengers > capacity + PASSENGER_OVERAGE) {
      return this.data({
        error: 'too_many_passengers',
        detail: `${this.vehicleLabel(vehicle)} seats ${capacity}; up to ${capacity + PASSENGER_OVERAGE} can be accommodated. Reduce passengers or choose a larger vehicle.`,
      });
    }

    const availability = await this.supabase.isVehicleAvailable(
      normalized.vehicle_id,
      normalized.trip.pickup_date,
      normalized.trip.end_date
    );
    if (availability.error) throw availability.error;
    if (!availability.data) {
      return this.data({
        error: 'vehicle_unavailable',
        detail: 'That vehicle is not available for the selected dates. Offer another vehicle or different dates.',
      });
    }

    const pricing = this.supabase.buildQuotationPricingPreview(
      vehicle,
      normalized.trip.pickup_date,
      normalized.trip.end_date
    ) as PricingPreview;

    const proposal: BookingProposal = {
      args: normalized,
      vehicleLabel: this.vehicleLabel(vehicle),
      customerName: normalized.customer.full_name,
      customerMobile: normalized.customer.mobile,
      customerType: normalized.customer.customer_type,
      pickupLocation: normalized.trip.pickup_location,
      dropLocation: normalized.trip.drop_location,
      startDate: normalized.trip.pickup_date,
      endDate: normalized.trip.end_date,
      days: Number(pricing.days) || 1,
      pricing,
      dryRun: BOOKING_DRY_RUN,
    };

    const content = JSON.stringify({
      status: 'awaiting_user_confirmation',
      message:
        'A confirmation card is now shown to the advisor. Tell them to review it and click Confirm to book, or Edit to change something. Do NOT claim the booking is done yet.',
      summary: {
        vehicle: proposal.vehicleLabel,
        customer: proposal.customerName,
        dates: `${proposal.startDate} to ${proposal.endDate}`,
        days: proposal.days,
        final_amount_inr: Math.round(Number(pricing.final_amount) || 0),
        dry_run: BOOKING_DRY_RUN,
      },
    });

    return { kind: 'proposal', content, proposal };
  }

  /**
   * Performs the actual booking write — the two-step the wizard uses:
   * createWalkInQuotation (pending booking + draft quotation) then
   * confirmWalkInBooking (quotation submitted, admins notified). Only invoked from
   * the UI Confirm button. Honors BOOKING_DRY_RUN.
   */
  async commitBooking(proposal: BookingProposal): Promise<CommitResult> {
    if (BOOKING_DRY_RUN) {
      return {
        ok: true,
        bookingId: 'DRY-RUN-BOOKING',
        quoteReference: 'QT-DRYRUN',
        status: 'pending (simulated)',
        dryRun: true,
      };
    }

    const args = proposal.args;
    const created = await this.supabase.createWalkInQuotation({
      vehicle_id: args.vehicle_id,
      trip: {
        pickup_date: args.trip.pickup_date,
        pickup_time: args.trip.pickup_time,
        pickup_location: args.trip.pickup_location,
        drop_location: args.trip.drop_location,
        end_date: args.trip.end_date,
        dropoff_time: args.trip.dropoff_time,
        purpose: args.trip.purpose,
        number_of_passengers: Number(args.trip.number_of_passengers) || 1,
        special_instructions: args.trip.special_instructions || null,
      },
      customer: {
        full_name: args.customer.full_name,
        mobile: args.customer.mobile,
        email: args.customer.email || null,
        license_no: args.customer.license_no,
        license_expiry: args.customer.license_expiry,
        customer_type: args.customer.customer_type,
        business_name: args.customer.customer_type === 'business' ? args.customer.business_name || null : null,
        gst_number: args.customer.customer_type === 'business' ? args.customer.gst_number || null : null,
        // The chat front door cannot capture an ID-proof upload; the booking still
        // enters the normal 'pending' queue and the admin collects proof at approval.
        id_proof_url: null,
      },
      existing_customer_id: args.existing_customer_id ?? null,
      existing_customer_choice: args.existing_customer_id ? args.existing_customer_choice ?? 'existing' : 'new',
    });

    if (created.error || !created.data) {
      return { ok: false, dryRun: false, error: this.errorText(created.error) || 'Could not create the booking.' };
    }

    const bookingId = created.data.booking?.id as string;
    const quoteReference = created.data.quotation?.quote_reference ?? null;

    const submitted = await this.supabase.confirmWalkInBooking(bookingId, 'online', null);
    if (submitted.error) {
      // Booking exists as 'pending' but the submit/notify step failed.
      return {
        ok: false,
        partial: true,
        dryRun: false,
        bookingId,
        quoteReference,
        error: this.errorText(submitted.error) || 'Booking was created but could not be submitted for approval.',
      };
    }

    return { ok: true, dryRun: false, bookingId, quoteReference, status: 'pending' };
  }

  // ---- Helpers --------------------------------------------------------------

  private data(payload: unknown): ToolResult {
    return { kind: 'data', content: JSON.stringify(payload) };
  }

  private async fetchVehicleRow(vehicleId: string): Promise<any | null> {
    const { data, error } = await this.supabase.getWalkInVehicles({ vehicleId });
    if (error) throw error;
    return (data ?? [])[0] ?? null;
  }

  private vehicleLabel(vehicle: any): string {
    const label = `${vehicle?.brand ?? ''} ${vehicle?.model ?? ''}`.trim();
    const year = vehicle?.year ? ` (${vehicle.year})` : '';
    return `${label || 'Vehicle'}${year}`;
  }

  private toCustomerSummary(row: any) {
    return {
      id: row.id,
      full_name: row.full_name,
      mobile: row.mobile,
      email: row.email ?? null,
      license_no: row.license_no ?? null,
      license_expiry: row.license_expiry ?? null,
      customer_type: row.customer_type ?? 'individual',
      business_name: row.business_name ?? null,
      gst_number: row.gst_number ?? null,
    };
  }

  private toVehicleSummary(row: any) {
    // Only the fields the model reasons over. `name` already carries brand/model/year;
    // create_booking re-validates pricing/availability, so the rest is omitted to save tokens.
    const dailyRate = row?.tier?.daily_rate ?? row?.vehicle_tiers?.daily_rate ?? row?.daily_rate ?? null;
    return {
      vehicle_id: row.id,
      name: this.vehicleLabel(row),
      type: row.type ?? null,
      capacity: row.capacity ?? null,
      daily_rate_inr: dailyRate != null ? Number(dailyRate) : null,
      available_for_requested_dates: row.is_available_for_selected_dates ?? null,
      availability_detail: row.availability_detail ?? null,
    };
  }

  private errorText(error: any): string {
    if (!error) return '';
    return error.message || String(error);
  }

  /** Coerces and cleans loosely-typed model arguments into a CreateBookingArgs. */
  private normalizeBookingArgs(args: any): CreateBookingArgs {
    const customer = args?.customer ?? {};
    const trip = args?.trip ?? {};
    const customerType = customer.customer_type === 'business' ? 'business' : 'individual';

    return {
      vehicle_id: String(args?.vehicle_id ?? '').trim(),
      customer: {
        full_name: String(customer.full_name ?? '').trim(),
        mobile: normalizeMobile(customer.mobile),
        email: customer.email ? String(customer.email).trim() : null,
        license_no: String(customer.license_no ?? '').trim(),
        license_expiry: parseDateOnly(customer.license_expiry) ?? '',
        customer_type: customerType,
        business_name: customer.business_name ? String(customer.business_name).trim() : null,
        gst_number: customer.gst_number ? String(customer.gst_number).trim() : null,
      },
      trip: {
        pickup_location: String(trip.pickup_location ?? '').trim(),
        drop_location: String(trip.drop_location ?? '').trim(),
        pickup_date: parseDateOnly(trip.pickup_date) ?? '',
        end_date: parseDateOnly(trip.end_date) ?? '',
        pickup_time: String(trip.pickup_time ?? '').trim(),
        dropoff_time: String(trip.dropoff_time ?? '').trim(),
        purpose: String(trip.purpose ?? '').trim() || 'Personal',
        number_of_passengers: Math.max(1, Math.round(Number(trip.number_of_passengers) || 0)),
        special_instructions: trip.special_instructions ? String(trip.special_instructions).trim() : null,
      },
      existing_customer_id: args?.existing_customer_id ? String(args.existing_customer_id) : null,
      existing_customer_choice: args?.existing_customer_choice ?? null,
    };
  }

  /** Mirrors the wizard's required-field and licence-expiry rules. Returns human-readable issues. */
  private validateBookingArgs(args: CreateBookingArgs): string[] {
    const issues: string[] = [];
    const today = todayDateOnly();

    if (!args.vehicle_id) issues.push('A vehicle must be selected (vehicle_id missing).');

    const c = args.customer;
    if (!c.full_name) issues.push('Customer full name is required.');
    if (!/^[6-9]\d{9}$/.test(c.mobile)) issues.push('A valid 10-digit Indian mobile number is required.');
    if (!/^[a-zA-Z0-9]{6,}$/.test(c.license_no)) issues.push('A valid licence number (min 6 characters) is required.');
    if (!c.license_expiry) {
      issues.push('Licence expiry date is required (YYYY-MM-DD).');
    } else if (c.license_expiry < today) {
      issues.push('The licence has expired and cannot be accepted.');
    }
    if (c.customer_type === 'business' && !c.business_name) {
      issues.push('Business name is required for a business customer.');
    }

    const t = args.trip;
    if (!t.pickup_location) issues.push('Pickup location is required.');
    if (!t.drop_location) issues.push('Drop location is required.');
    if (!t.pickup_time) issues.push('Pickup time is required (HH:MM).');
    if (!t.dropoff_time) issues.push('Drop-off time is required (HH:MM).');
    if (!t.pickup_date) {
      issues.push('Pickup date is required (YYYY-MM-DD).');
    } else if (t.pickup_date < today) {
      issues.push('Pickup date cannot be in the past.');
    }
    if (!t.end_date) {
      issues.push('Drop date is required (YYYY-MM-DD).');
    } else if (t.pickup_date && t.end_date < t.pickup_date) {
      issues.push('Drop date must be on or after the pickup date.');
    }
    if (!t.number_of_passengers || t.number_of_passengers < 1) {
      issues.push('Number of passengers is required.');
    }

    return issues;
  }
}

/** Normalizes Indian mobile input to bare 10 digits (strips +91 / 91 / spaces). */
function normalizeMobile(value: unknown): string {
  let normalized = String(value ?? '').replace(/[\s-]/g, '');
  if (normalized.startsWith('+91')) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith('91') && normalized.length > 10) {
    normalized = normalized.slice(2);
  }
  return normalized.replace(/\D/g, '');
}

/** Accepts 'YYYY-MM-DD' or any parseable date and returns a local 'YYYY-MM-DD' (or null). */
function parseDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
