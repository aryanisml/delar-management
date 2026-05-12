import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Booking } from '../models/booking';
import { Vehicle } from '../models/vehicle';

type BulkBookingInput = {
  id: string;
  dealer_id: string;
  total_vehicles: number;
  notes?: string;
  status?: string;
};

type QuoteSubmissionInput = {
  booking: any;
  vehicle: any;
  customer: any;
  pricing: any;
  advisorName: string;
};

type WalkInVehicleFilters = {
  type?: string | null;
  capacity?: number | null;
  transmission?: string | null;
  fuel?: string | null;
  pickup_date?: string | null;
  end_date?: string | null;
  vehicleId?: string | null;
};

type WalkInTripInput = {
  pickup_date: string;
  pickup_time: string;
  pickup_location: string;
  drop_location: string;
  end_date: string;
  dropoff_time: string;
  purpose: string;
  number_of_passengers: number;
  special_instructions?: string | null;
};

type WalkInCustomerInput = {
  full_name: string;
  mobile: string;
  email?: string | null;
  license_no: string;
  license_expiry: string | null;
  customer_type: 'individual' | 'business';
  business_name?: string | null;
  gst_number?: string | null;
  id_proof_url?: string | null;
};

type WalkInQuotationInput = {
  vehicle_id: string;
  trip: WalkInTripInput;
  customer: WalkInCustomerInput;
  existing_customer_id?: string | null;
  existing_customer_choice?: 'existing' | 'update' | 'new';
};

type CreateQuotationInput = {
  bookingId: string;
  advisorId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  customer: any;
};

type NotificationInput = {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  booking_id?: string;
  is_read?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly vehiclesTable = 'vehicle';
  readonly gstRate = 0.18;
  readonly advanceRate = 0.3;
  readonly blockingBookingStatuses = ['pending', 'approved', 'confirmed', 'in_service'];

  supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

  async signInWithGoogle() {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
  }

  async recoverSession() {
    const { data } = await this.supabase.auth.refreshSession();
    return data.session;
  }

  async getCurrentUser() {
    const { data, error } = await this.supabase.auth.getUser();
    if (error || !data) {
      console.error('Auth error:', error?.message);
      return null;
    }
    return data.user;
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }

  async updateUserMetadata(data: Record<string, any>) {
    return await this.supabase.auth.updateUser({ data });
  }

  async resetPasswordForEmail(email: string) {
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
  }

  async getUserRole(userId: string) {
    const { data, error } = await this.supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();

    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }

    return data?.role ?? null;
  }

  async ensureUserRoleAndDealer(user: any) {
    if (!user?.id) {
      return null;
    }

    const existingRole = await this.getUserRole(user.id);
    if (existingRole) {
      return existingRole;
    }

    const email = user.email || '';
    const prefix = email.split('@')[0] || 'dealer';
    const companyName = `${prefix}'s company`;

    const { error: roleError } = await this.supabase
      .from('user_roles')
      .insert([{ user_id: user.id, role: 'dealer' }]);

    if (roleError) {
      console.error('Error creating default dealer role:', roleError);
      return null;
    }

    const { error: dealerError } = await this.upsertDealerProfile({
      user_id: user.id,
      company_name: companyName,
    });

    if (dealerError) {
      console.error('Error creating dealer profile:', dealerError);
    }

    return 'dealer';
  }

  async getAllUserRoles() {
    return await this.supabase.from('user_roles').select('*');
  }

  async getAllUsers() {
    return await this.supabase.from('user_roles').select('*');
  }

  async updateUserRole(userId: string, role: string) {
    return await this.supabase.from('user_roles').update({ role }).eq('user_id', userId);
  }

  async getVehicles(): Promise<{ data: Vehicle[] | null; error: any | null }> {
    try {
      let data: any[] | null = null;
      let error: any = null;

      const orderedResult = await this.supabase.from(this.vehiclesTable).select('*').order('created_at', { ascending: false });

      data = orderedResult.data ?? null;
      error = orderedResult.error ?? null;

      if (error) {
        const message = String(error.message || '');
        if (error.code === '42703' || /does not exist/i.test(message)) {
          const fallbackResult = await this.supabase.from(this.vehiclesTable).select('*');
          data = fallbackResult.data ?? null;
          error = fallbackResult.error ?? null;
        }
      }

      const bookingWindows = await this.getActiveVehicleBookingWindows();
      if (bookingWindows.error) {
        return { data: null, error: bookingWindows.error };
      }

      const normalized = (data ?? []).map((row: any) => ({
        ...row,
        brand: row.brand ?? row.Brand ?? row.make ?? '',
        make: row.make ?? row.brand ?? row.Brand ?? '',
        model: row.model ?? '',
        stock: Number(row.stock ?? 0),
        daily_rate: Number(row.daily_rate ?? row.dailyRate ?? 0),
        type: row.type ?? null,
        fuel: row.fuel ?? null,
        capacity: row.capacity ? Number(row.capacity) : null,
        mileage: Number(row.mileage ?? 0),
        year: row.year ? Number(row.year) : null,
        chassis_no: row.chassis_no ?? row.chassisNumber ?? null,
        registration_no: row.registration_no ?? row.registrationNo ?? null,
        image_url: row.image_url ?? row.imageUrl ?? null,
        booked: Boolean(row.booked),
        vehicle_status: this.resolveVehicleStatus(row, bookingWindows.data),
        next_available_date: this.resolveVehicleNextAvailableDate(row, bookingWindows.data),
        tier_id: row.tier_id ?? null,
      }));

      return { data: normalized as Vehicle[], error };
    } catch (error) {
      console.error('SupabaseService.getVehicles error', error);
      return { data: null, error };
    }
  }

  async getBookings() {
    return await this.supabase.from('bookings').select('*').order('created_at', { ascending: false });
  }

  async getPendingBookingRequests() {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          vehicle_id,
          customer_id,
          pickup_location,
          drop_location,
          start_date,
          end_date,
          pickup_time,
          dropoff_time,
          purpose,
          number_of_passengers,
          special_instructions,
          status,
          created_at,
          approved_by,
          approved_at,
          rejection_reason,
          total_price,
          customers (
            full_name,
            mobile,
            customer_type
          ),
          vehicle (
            brand,
            model
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      return { data: data ?? [], error };
    } catch (error) {
      return { data: [], error };
    }
  }

  async getBookingWithVehicle(bookingId: string) {
    const result = await this.supabase
      .from('bookings')
      .select(`
        *,
        vehicle (
          *,
          vehicle_tiers (
            daily_rate,
            security_deposit,
            extra_mileage_rate,
            included_km_per_day
          )
        )
      `)
      .eq('id', bookingId)
      .single();

    return result;
  }

  async addVehicle(vehicle: any) {
    return await this.supabase.from(this.vehiclesTable).insert([vehicle]);
  }

  async updateVehicle(id: string, vehicle: any) {
    return await this.supabase.from(this.vehiclesTable).update(vehicle).eq('id', id);
  }

  async deleteVehicle(id: string) {
    return await this.supabase.from(this.vehiclesTable).delete().eq('id', id);
  }

  async createBooking(booking: Partial<Booking>) {
    return await this.supabase.from('bookings').insert([booking]);
  }

  async getMyBookings(userId: string) {
    const customerResult = await this.supabase.from('customers').select('id').eq('created_by', userId);
    if (customerResult.error) {
      return { data: [], error: customerResult.error };
    }

    const customerIds = (customerResult.data ?? []).map((customer: any) => customer.id).filter(Boolean);
    const filters = [`user_id.eq.${userId}`];
    if (customerIds.length) {
      filters.push(`customer_id.in.(${customerIds.join(',')})`);
    }

    const result = await this.supabase
      .from('bookings')
      .select(`
        *,
        vehicle:vehicle_id (
          id, brand, model, image_url, location, vehicle_status
        ),
        customer:customer_id (
          id, full_name, mobile, email
        ),
        quotation:quotations!quotations_booking_id_fkey (
          id, quote_reference, final_amount, rate, days, status, base_cost, gst, advance, security_deposit
        )
      `)
      .or(filters.join(','))
      .order('created_at', { ascending: false });

    if (result.error) {
      return { data: [], error: result.error };
    }

    const latestPayments = await this.getLatestPaymentsForBookings((result.data ?? []).map((booking: any) => booking.id));
    if (latestPayments.error) {
      return { data: [], error: latestPayments.error };
    }

    return {
      data: (result.data ?? []).map((booking: any) => {
        const quotation = Array.isArray(booking.quotation) ? booking.quotation[0] ?? null : booking.quotation ?? null;
        return {
          ...booking,
          quotation,
          quote_status: quotation?.status ?? null,
          quote_reference: quotation?.quote_reference ?? null,
          total_price: quotation?.final_amount ?? booking.total_price ?? null,
          latest_payment: latestPayments.data.get(booking.id) ?? null,
        };
      }),
      error: null,
    };
  }

  async getQuotationByBooking(bookingId: string) {
    try {
      return await this.supabase.from('quotations').select('*').eq('booking_id', bookingId).maybeSingle();
    } catch (error) {
      return { data: null, error };
    }
  }

  async searchCustomers(query: string) {
    const term = query.trim();
    if (term.length < 3) {
      return { data: [], error: null };
    }

    try {
      return await this.supabase
        .from('customers')
        .select('*')
        .or(`mobile.ilike.%${term}%,email.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(6);
    } catch (error) {
      return { data: [], error };
    }
  }

  async searchCustomersByField(field: 'mobile' | 'email', query: string) {
    const term = query.trim();
    const minLength = field === 'mobile' ? 5 : 3;
    if (term.length < minLength || (field === 'email' && !term.includes('@'))) {
      return { data: [], error: null };
    }

    try {
      return await this.supabase.from('customers').select('*').ilike(field, `%${term}%`).limit(5);
    } catch (error) {
      return { data: [], error };
    }
  }

  async findCustomerByMobile(mobile: string) {
    const normalized = mobile.trim();
    if (!normalized) {
      return { data: null, error: null };
    }

    return await this.supabase.from('customers').select('*').eq('mobile', normalized).maybeSingle();
  }

  private isDuplicateMobileError(error: any) {
    const message = String(error?.message ?? '');
    return error?.code === '23505' || /customers_mobile_unique|duplicate key/i.test(message);
  }

  async uploadCustomerIdProof(file: File, reference: string) {
    const normalizedReference = reference.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'customer';
    const path = `walk-in/${normalizedReference}-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    try {
      const bucketCandidates = ['customer-documents', 'documents', 'uploads'];
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucket = bucketCandidates.find((candidate) => (buckets ?? []).some((item: any) => item.name === candidate))
        ?? buckets?.[0]?.name;

      if (!bucket) {
        return { data: { publicUrl: null, fallbackDataUrl: await this.fileToDataUrl(file) }, error: null };
      }

      const upload = await this.supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (upload.error) {
        return { data: { publicUrl: null, fallbackDataUrl: await this.fileToDataUrl(file) }, error: upload.error };
      }

      const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
      return { data: { publicUrl: data.publicUrl, fallbackDataUrl: null }, error: null };
    } catch (error) {
      return { data: { publicUrl: null, fallbackDataUrl: await this.fileToDataUrl(file) }, error };
    }
  }

  async upsertCustomerByMobile(customer: any) {
    const mobile = String(customer.mobile ?? '').trim();
    if (!mobile) {
      return { data: null, error: new Error('Customer mobile is required') };
    }

    const payload = {
      full_name: customer.fullName ?? customer.full_name ?? customer.name ?? '',
      mobile,
      email: customer.email ?? '',
      license_no: customer.licenceNumber ?? customer.license_no ?? customer.license ?? customer.licence_number ?? '',
      license_expiry: customer.licenceExpiry ? new Date(customer.licenceExpiry).toISOString().slice(0, 10) : null,
      customer_type: customer.customerType ?? customer.customer_type ?? 'individual',
      business_name: customer.businessName ?? customer.business_name ?? null,
      gst_number: customer.gstNumber ?? customer.gst_number ?? null,
      id_proof_url: customer.idProofPreview || customer.id_proof_url || null,
      created_by: customer.created_by ?? null,
    };

    try {
      const existing = await this.supabase.from('customers').select('id').eq('mobile', mobile).maybeSingle();
      if (existing.error) {
        return { data: null, error: existing.error };
      }

      if (existing.data?.id) {
        return await this.supabase.from('customers').update(payload).eq('id', existing.data.id).select().single();
      }

      return await this.supabase.from('customers').insert([payload]).select().single();
    } catch (error) {
      return { data: null, error };
    }
  }

  async generateQuoteReference() {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `QT-${day}-`;
    const { data, error } = await this.supabase
      .from('quotations')
      .select('quote_reference')
      .ilike('quote_reference', `${prefix}%`);

    if (error) {
      return `${prefix}0001`;
    }

    const max = (data ?? []).reduce((current: number, row: any) => {
      const value = Number(String(row.quote_reference ?? '').split('-').pop());
      return Number.isFinite(value) ? Math.max(current, value) : current;
    }, 0);

    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  async submitQuotationRequest(input: QuoteSubmissionInput) {
    const user = await this.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Session expired') };
    }

    try {
      const customerResult = await this.upsertCustomerByMobile(input.customer);
      if (customerResult.error || !customerResult.data?.id) {
        return { data: null, error: customerResult.error ?? new Error('Customer could not be saved') };
      }

      const quoteReference = await this.generateQuoteReference();
      const bookingPayload = {
        customer_id: customerResult.data.id,
        user_id: user.id,
        status: 'pending',
        total_price: input.pricing.final_amount,
        special_instructions: input.booking?.special_instructions ?? input.booking?.dealer_notes ?? null,
      };

      const bookingResult = await this.supabase
        .from('bookings')
        .update(bookingPayload)
        .eq('id', input.booking.id)
        .select()
        .single();

      if (bookingResult.error) {
        return { data: null, error: bookingResult.error };
      }

      const quotationPayload = {
        booking_id: input.booking.id,
        quote_reference: quoteReference,
        advisor_id: user.id,
        sent_at: new Date().toISOString(),
        status: 'submitted',
        customer_name: input.customer.fullName,
        mobile: input.customer.mobile,
        email: input.customer.email,
        license: input.customer.licenceNumber,
        license_expiry: input.customer.licenceExpiry ? new Date(input.customer.licenceExpiry).toISOString().slice(0, 10) : null,
        customer_type: input.customer.customerType,
        business_name: input.customer.businessName || null,
        gst_number: input.customer.gstNumber || null,
        id_proof_url: input.customer.idProofPreview || null,
        rate: input.pricing.rate,
        days: input.pricing.days,
        base_cost: input.pricing.base_cost,
        gst: input.pricing.gst,
        advance: input.pricing.advance,
        security_deposit: input.pricing.security_deposit,
        extra_mileage_rate: input.pricing.extra_mileage_rate,
        extra_mileage_charge: input.pricing.extra_mileage_charge ?? 0,
        discount_amount: input.pricing.discount_amount,
        promo_code: input.pricing.promo_code,
        fuel_policy: input.pricing.fuel_policy,
        final_amount: input.pricing.final_amount,
      };

      const quotationResult = await this.supabase
        .from('quotations')
        .upsert(quotationPayload, { onConflict: 'booking_id' })
        .select()
        .single();

      if (quotationResult.error) {
        return { data: null, error: quotationResult.error };
      }

      await this.notifyAdminsOfBookingRequest(bookingResult.data, quotationResult.data, input.vehicle, input.advisorName);
      await this.logAudit('quotation_submitted', input.booking.id);

      return {
        data: { booking: bookingResult.data, quotation: quotationResult.data, customer: customerResult.data },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getWalkInVehicles(filters: WalkInVehicleFilters = {}) {
    try {
      let query = this.supabase
        .from('vehicle')
        .select(`
          id,
          brand,
          model,
          year,
          fuel,
          transmission,
          capacity,
          type,
          location,
          registration_no,
          image_url,
          insurance_expiry,
          last_serviced_date,
          vehicle_status,
          next_available_date,
          tier_id,
          vehicle_tiers (
            daily_rate,
            security_deposit,
            extra_mileage_rate,
            included_km_per_day
          ),
          vehicle_images (
            url,
            is_primary
          )
        `)
        .order('created_at', { ascending: false });

      if (filters.vehicleId) {
        query = query.eq('id', filters.vehicleId);
      }

      const { data, error } = await query;

      if (error) {
        return { data: [], error };
      }

      const bookingWindows = await this.getActiveVehicleBookingWindows();
      if (bookingWindows.error) {
        return { data: [], error: bookingWindows.error };
      }

      let conflictVehicleIds = new Set<string>();
      let selectedRangeNextAvailable = new Map<string, string>();
      if (filters.pickup_date && filters.end_date) {
        const conflicts = await this.supabase
          .from('bookings')
          .select('vehicle_id, end_date')
          .lte('start_date', filters.end_date)
          .gte('end_date', filters.pickup_date)
          .in('status', this.blockingBookingStatuses);

        if (conflicts.error) {
          return { data: [], error: conflicts.error };
        }

        conflictVehicleIds = new Set((conflicts.data ?? []).map((row: any) => row.vehicle_id).filter(Boolean));
        selectedRangeNextAvailable = (conflicts.data ?? []).reduce((map: Map<string, string>, row: any) => {
          const vehicleId = String(row.vehicle_id ?? '');
          const endDate = String(row.end_date ?? '');
          if (!vehicleId || !endDate) {
            return map;
          }
          const current = map.get(vehicleId);
          if (!current || new Date(endDate).getTime() > new Date(current).getTime()) {
            map.set(vehicleId, endDate);
          }
          return map;
        }, new Map<string, string>());
      }

      const filtered = (data ?? [])
        .filter((row: any) => String(row.vehicle_status ?? '').toLowerCase() !== 'deleted')
        .filter((row: any) => !filters.type || row.type === filters.type)
        .filter((row: any) => !filters.capacity || Number(row.capacity ?? 0) >= Number(filters.capacity))
        .filter((row: any) => !filters.transmission || row.transmission === filters.transmission)
        .filter((row: any) => !filters.fuel || row.fuel === filters.fuel)
        .map((row: any) => {
          const primaryImage = (row.vehicle_images ?? []).find((image: any) => image.is_primary) ?? null;
          const imageUrl = typeof row.image_url === 'string' && row.image_url.trim() ? row.image_url.trim() : null;
          const effectiveStatus = this.resolveVehicleStatus(row, bookingWindows.data);
          const effectiveNextAvailableDate = this.resolveVehicleNextAvailableDate(row, bookingWindows.data);
          const blockedForSelectedDates = conflictVehicleIds.has(row.id);
          const selectedRangeAvailableFrom = selectedRangeNextAvailable.get(String(row.id)) ?? effectiveNextAvailableDate;
          return {
            ...row,
            vehicle_status: effectiveStatus,
            next_available_date: effectiveNextAvailableDate,
            thumbnail_url: primaryImage?.url ?? imageUrl ?? '/assets/car-placeholder.svg',
            tier: row.vehicle_tiers ?? null,
            is_available_for_selected_dates: !blockedForSelectedDates,
            availability_status: blockedForSelectedDates ? 'booked' : effectiveStatus,
            availability_detail: blockedForSelectedDates
              ? selectedRangeAvailableFrom
                ? `Available from ${selectedRangeAvailableFrom}`
                : 'Date TBD'
              : effectiveStatus === 'available'
                ? 'Available now'
                : effectiveNextAvailableDate
                  ? `Available from ${effectiveNextAvailableDate}`
                  : 'Date TBD',
            availability_date: blockedForSelectedDates ? selectedRangeAvailableFrom ?? null : effectiveNextAvailableDate,
          };
        });

      return { data: filtered, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  async isVehicleAvailable(vehicleId: string, pickupDate: string, endDate: string, excludeBookingId?: string) {
    let query = this.supabase
      .from('bookings')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .lte('start_date', endDate)
      .gte('end_date', pickupDate)
      .in('status', this.blockingBookingStatuses);

    if (excludeBookingId) {
      query = query.neq('id', excludeBookingId);
    }

    const { data, error } = await query.limit(1);
    return { data: !(data?.length), error };
  }

  async createOrFetchQuotation(input: CreateQuotationInput) {
    const existing = await this.supabase.from('quotations').select('*').eq('booking_id', input.bookingId).maybeSingle();
    if (existing.error) {
      return { data: null, error: existing.error };
    }

    if (this.hasResolvedPricing(existing.data)) {
      return { data: existing.data, error: null };
    }

    const vehicleResult = await this.supabase
      .from('vehicle')
      .select(`
        daily_rate,
        tier_id,
        vehicle_tiers (
          daily_rate,
          security_deposit,
          extra_mileage_rate,
          included_km_per_day
        )
      `)
      .eq('id', input.vehicleId)
      .single();

    if (vehicleResult.error) {
      return { data: null, error: vehicleResult.error };
    }

    const pricing = this.buildQuotationPricingPreview(vehicleResult.data, input.startDate, input.endDate);
    const quoteReference = existing.data?.quote_reference || await this.generateQuoteReference();
    const quotationPayload = {
      booking_id: input.bookingId,
      advisor_id: input.advisorId,
      status: existing.data?.status ?? 'draft',
      quote_reference: quoteReference,
      customer_name: input.customer.full_name,
      mobile: input.customer.mobile,
      email: input.customer.email,
      license: input.customer.license_no,
      license_expiry: input.customer.license_expiry,
      customer_type: input.customer.customer_type,
      business_name: input.customer.business_name ?? null,
      gst_number: input.customer.gst_number ?? null,
      id_proof_url: input.customer.id_proof_url ?? null,
      rate: pricing.rate,
      days: pricing.days,
      base_cost: pricing.base_cost,
      gst: pricing.gst,
      advance: pricing.advance,
      security_deposit: pricing.security_deposit,
      final_amount: pricing.final_amount,
      fuel_policy: pricing.fuel_policy,
      extra_mileage_rate: pricing.extra_mileage_rate,
      extra_mileage_charge: 0,
      discount_amount: 0,
    };

    return await this.supabase
      .from('quotations')
      .upsert(quotationPayload, { onConflict: 'booking_id' })
      .select()
      .single();
  }

  private hasResolvedPricing(quotation: any) {
    return Boolean(quotation && Number(quotation.final_amount ?? 0) > 0);
  }

  private calculateBookingDays(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, diff || 1);
  }

  buildQuotationPricingPreview(
    vehicle: any,
    startDate: string,
    endDate: string,
    options?: {
      discountAmount?: number;
      extraMileageCharge?: number;
      fuelPolicy?: string | null;
    }
  ) {
    const tier = Array.isArray(vehicle?.vehicle_tiers)
      ? vehicle.vehicle_tiers[0] ?? null
      : vehicle?.vehicle_tiers ?? vehicle?.tier ?? null;
    const rate = Number(tier?.daily_rate ?? vehicle?.daily_rate ?? vehicle?.dailyRate ?? 0);
    const days = this.calculateBookingDays(startDate, endDate);
    const baseCost = rate * days;
    const discountAmount = Math.min(baseCost, Math.max(0, Number(options?.discountAmount ?? 0)));
    const taxableAmount = Math.max(0, baseCost - discountAmount);
    const gst = taxableAmount * this.gstRate;
    const extraMileageCharge = Math.max(0, Number(options?.extraMileageCharge ?? 0));
    const finalAmount = taxableAmount + gst + extraMileageCharge;
    const securityDeposit = Number(tier?.security_deposit ?? vehicle?.security_deposit ?? vehicle?.securityDeposit ?? 0);
    const extraMileageRate = Number(tier?.extra_mileage_rate ?? vehicle?.extra_mileage_rate ?? vehicle?.extraMileageRate ?? 0);

    return {
      rate,
      days,
      base_cost: baseCost,
      gst,
      advance: taxableAmount * this.advanceRate,
      security_deposit: securityDeposit,
      final_amount: finalAmount,
      extra_mileage_rate: extraMileageRate,
      extra_mileage_charge: extraMileageCharge,
      discount_amount: discountAmount,
      fuel_policy: options?.fuelPolicy ?? vehicle?.fuel_policy ?? vehicle?.fuelPolicy ?? 'Full-to-Full',
    };
  }

  private async getActiveVehicleBookingWindows() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.supabase
      .from('bookings')
      .select('vehicle_id, end_date')
      .in('status', this.blockingBookingStatuses)
      .gte('end_date', today);

    if (error) {
      return { data: null, error };
    }

    const latestByVehicle = new Map<string, string>();
    for (const row of data ?? []) {
      const vehicleId = String(row.vehicle_id ?? '');
      const endDate = String(row.end_date ?? '');
      if (!vehicleId || !endDate) {
        continue;
      }

      const current = latestByVehicle.get(vehicleId);
      if (!current || new Date(endDate).getTime() > new Date(current).getTime()) {
        latestByVehicle.set(vehicleId, endDate);
      }
    }

    return { data: latestByVehicle, error: null };
  }

  private resolveVehicleStatus(row: any, bookingWindows: Map<string, string> | null) {
    const rawStatus = String(row?.vehicle_status ?? row?.status ?? 'available').toLowerCase();
    if (rawStatus === 'deleted') {
      return 'deleted';
    }
    if (rawStatus === 'maintenance' || rawStatus === 'in_service' || rawStatus === 'dirty' || rawStatus === 'inactive') {
      return rawStatus === 'dirty' ? 'maintenance' : rawStatus;
    }

    const bookingEndDate = bookingWindows?.get(String(row?.id ?? ''));
    return bookingEndDate ? 'booked' : 'available';
  }

  private resolveVehicleNextAvailableDate(row: any, bookingWindows: Map<string, string> | null) {
    const bookingEndDate = bookingWindows?.get(String(row?.id ?? '')) ?? null;
    const rowDate = row?.next_available_date ?? null;
    if (!bookingEndDate) {
      return rowDate;
    }
    if (!rowDate) {
      return bookingEndDate;
    }
    return new Date(bookingEndDate).getTime() > new Date(rowDate).getTime() ? bookingEndDate : rowDate;
  }

  async createWalkInQuotation(input: WalkInQuotationInput) {
    const user = await this.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Session expired') };
    }

    const availability = await this.isVehicleAvailable(input.vehicle_id, input.trip.pickup_date, input.trip.end_date);
    if (availability.error) {
      return { data: null, error: availability.error };
    }
    if (!availability.data) {
      return { data: null, error: new Error('Vehicle is no longer available for the selected dates.') };
    }

    const customerPayload = {
      full_name: input.customer.full_name,
      mobile: input.customer.mobile,
      email: input.customer.email || null,
      license_no: input.customer.license_no,
      license_expiry: input.customer.license_expiry,
      customer_type: input.customer.customer_type,
      business_name: input.customer.customer_type === 'business' ? input.customer.business_name || null : null,
      gst_number: input.customer.customer_type === 'business' ? input.customer.gst_number || null : null,
      id_proof_url: input.customer.id_proof_url || null,
      created_by: user.id,
    };

    let customerRecord: any = null;
    let duplicateMobile = false;
    const existingByMobile = await this.findCustomerByMobile(input.customer.mobile);
    if (existingByMobile.error) {
      return { data: null, error: existingByMobile.error };
    }

    if (input.existing_customer_id && input.existing_customer_choice !== 'new') {
      if (input.existing_customer_choice === 'update') {
        const updateResult = await this.supabase
          .from('customers')
          .update(customerPayload)
          .eq('id', input.existing_customer_id)
          .select()
          .single();
        if (updateResult.error) {
          return { data: null, error: updateResult.error };
        }
        customerRecord = updateResult.data;
      } else {
        const existingResult = await this.supabase
          .from('customers')
          .select('*')
          .eq('id', input.existing_customer_id)
          .single();
        if (existingResult.error) {
          return { data: null, error: existingResult.error };
        }
        customerRecord = existingResult.data;
      }
    } else if (existingByMobile.data?.id) {
      customerRecord = existingByMobile.data;
      duplicateMobile = true;
    } else {
      const createResult = await this.supabase.from('customers').insert([customerPayload]).select().single();
      if (createResult.error) {
        if (this.isDuplicateMobileError(createResult.error)) {
          const existing = await this.findCustomerByMobile(input.customer.mobile);
          if (existing.data?.id) {
            customerRecord = existing.data;
            duplicateMobile = true;
          } else {
            return { data: null, error: createResult.error };
          }
        } else {
          return { data: null, error: createResult.error };
        }
      } else {
        customerRecord = createResult.data;
      }
    }

    const bookingResult = await this.supabase
      .from('bookings')
      .insert([
        {
          vehicle_id: input.vehicle_id,
          user_id: user.id,
          customer_id: customerRecord.id,
          pickup_location: input.trip.pickup_location,
          drop_location: input.trip.drop_location,
          start_date: input.trip.pickup_date,
          end_date: input.trip.end_date,
          purpose: input.trip.purpose,
          status: 'pending',
          pickup_time: input.trip.pickup_time,
          dropoff_time: input.trip.dropoff_time,
          number_of_passengers: input.trip.number_of_passengers,
          special_instructions: input.trip.special_instructions || null,
        },
      ])
      .select()
      .single();

    if (bookingResult.error) {
      return { data: null, error: bookingResult.error };
    }

    const quotationResult = await this.createOrFetchQuotation({
      bookingId: bookingResult.data.id,
      advisorId: user.id,
      vehicleId: input.vehicle_id,
      startDate: input.trip.pickup_date,
      endDate: input.trip.end_date,
      customer: customerRecord,
    });

    if (quotationResult.error) {
      await this.supabase.from('quotations').delete().eq('booking_id', bookingResult.data.id);
      await this.supabase.from('bookings').delete().eq('id', bookingResult.data.id);
      return { data: null, error: quotationResult.error };
    }

    const vehicleUpdate = await this.supabase
      .from('vehicle')
      .update({ vehicle_status: 'booked', next_available_date: input.trip.end_date })
      .eq('id', input.vehicle_id);
    if (vehicleUpdate.error) {
      await this.supabase.from('quotations').delete().eq('booking_id', bookingResult.data.id);
      await this.supabase.from('bookings').delete().eq('id', bookingResult.data.id);
      return { data: null, error: vehicleUpdate.error };
    }

    await this.logAudit('walk_in_quotation_generated', bookingResult.data.id);
    return {
      data: {
        booking: bookingResult.data,
        quotation: quotationResult.data,
        customer: customerRecord,
        duplicateMobile,
      },
      error: null,
    };
  }

  async confirmWalkInBooking(bookingId: string, advanceMode: 'online' | 'offline' = 'online', customerChannel?: 'email' | 'sms' | 'whatsapp' | null) {
      const request = await this.getAdminBookingDetails(bookingId);
    if (request.error || !request.data) {
      return { data: null, error: request.error ?? new Error('Booking not found') };
    }

    const quotationUpdate = await this.supabase
      .from('quotations')
      .update({ status: 'submitted', sent_at: new Date().toISOString(), advance_mode: advanceMode })
      .eq('booking_id', bookingId)
      .select()
      .single();

    if (quotationUpdate.error) {
      return { data: null, error: quotationUpdate.error };
    }

    const bookingUpdate = await this.supabase
      .from('bookings')
      .update({ status: 'pending', total_price: quotationUpdate.data.final_amount })
      .eq('id', bookingId)
      .select()
      .single();

    if (bookingUpdate.error) {
      return { data: null, error: bookingUpdate.error };
    }

    await this.notifyAdminsOfBookingRequest(bookingUpdate.data, quotationUpdate.data, request.data.vehicle, request.data.advisor_name);
    await this.logAudit(`walk_in_booking_submitted:${customerChannel || 'manual'}`, bookingId);

    return {
      data: {
        booking: bookingUpdate.data,
        quotation: quotationUpdate.data,
      },
      error: null,
    };
  }

  async markQuotationSent(bookingId: string) {
    return await this.supabase
      .from('quotations')
      .update({ sent_at: new Date().toISOString() })
      .eq('booking_id', bookingId);
  }

  async saveQuotationDraft(payload: Record<string, any>) {
    return await this.supabase.from('quotations').upsert([this.sanitizeQuotationPayload(payload)], { onConflict: 'booking_id' });
  }

  async updateBookingQuoteStatus(bookingId: string, quoteStatus: string, status?: string) {
    if (!status) {
      return await this.supabase.from('quotations').update({ status: quoteStatus }).eq('booking_id', bookingId);
    }

    const payload: Record<string, any> = {};
    if (status) {
      payload['status'] = status;
    }
    return await this.supabase.from('bookings').update(payload).eq('id', bookingId);
  }

  async validatePromotion(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return { data: null, error: null };
    }

    try {
      return await this.supabase
        .from('promotions')
        .select('*')
        .eq('code', normalized)
        .eq('active', true)
        .maybeSingle();
    } catch (error) {
      return { data: null, error };
    }
  }

  async getBookingsByVehicle(vehicleId: string) {
    return await this.supabase.from('bookings').select('*').eq('vehicle_id', vehicleId);
  }

  async getMyBulkBookings(userId: string) {
    const bulkResult = await this.supabase
      .from('bulk_bookings')
      .select('*')
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false });

    if (bulkResult.error || !bulkResult.data?.length) {
      return { data: bulkResult.data ?? [], error: bulkResult.error };
    }

    const bulkIds = bulkResult.data.map((bulk: any) => bulk.id);
    const bookingsResult = await this.supabase
      .from('bookings')
      .select(`
          id,
          vehicle_id,
          user_id,
          pickup_location,
          drop_location,
          start_date,
          end_date,
          purpose,
          quantity,
          status,
          rejection_reason,
          created_at,
          bulk_booking_id,
          vehicle (
            id,
            brand,
            model,
            location,
            daily_rate,
            image_url
          )
      `)
      .in('bulk_booking_id', bulkIds)
      .order('created_at', { ascending: false });

    if (bookingsResult.error) {
      return { data: bulkResult.data, error: bookingsResult.error };
    }

    const bookingsByBulkId = new Map<string, any[]>();
    for (const booking of bookingsResult.data ?? []) {
      const key = booking.bulk_booking_id;
      bookingsByBulkId.set(key, [...(bookingsByBulkId.get(key) ?? []), booking]);
    }

    return {
      data: bulkResult.data.map((bulk: any) => ({
        ...bulk,
        bookings: bookingsByBulkId.get(bulk.id) ?? [],
      })),
      error: null,
    };
  }

  async updateBookingStatus(bookingId: string, newStatus: string) {
    return await this.supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
  }

  async approveBookingRequest(bookingId: string) {
    const user = await this.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Session expired') };
    }

    try {
      const request = await this.getBookingRequestDetails(bookingId);
      if (request.error || !request.data) {
        return { data: null, error: request.error ?? new Error('Booking not found') };
      }

      const booking = request.data;
      const quotation = booking.quotation;
      const bookingUpdate = await this.supabase
        .from('bookings')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (bookingUpdate.error) {
        return { data: null, error: bookingUpdate.error };
      }

      const quotationUpdate = await this.supabase.from('quotations').update({ status: 'approved' }).eq('booking_id', bookingId);
      if (quotationUpdate.error) {
        return { data: null, error: quotationUpdate.error };
      }

      if (quotation?.advance_mode === 'offline') {
        const payment = await this.getPaymentByBooking(bookingId);
        if (payment.data?.status === 'paid') {
          await this.supabase
            .from('bookings')
            .update({ status: 'in_service', updated_at: new Date().toISOString() })
            .eq('id', bookingId);
        }
      }

      const vehicleUpdate = await this.supabase
        .from('vehicle')
        .update({ next_available_date: booking.end_date })
        .eq('id', booking.vehicle_id);
      if (vehicleUpdate.error) {
        return { data: null, error: vehicleUpdate.error };
      }

      await this.insertNotificationPayload({
        user_id: quotation?.advisor_id ?? booking.user_id,
        title: 'Booking Approved',
        message: 'Your booking request has been approved.',
        type: 'success',
        is_read: false,
        booking_id: bookingId,
      });

      await this.sendCustomerConfirmationEmail(booking);
      await this.logAudit('booking_approved', bookingId);

      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async rejectBookingRequest(bookingId: string, reason: string) {
    const user = await this.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Session expired') };
    }

    try {
      if (!reason.trim()) {
        return { data: null, error: new Error('Rejection reason is required') };
      }

      const request = await this.getBookingRequestDetails(bookingId);
      if (request.error || !request.data) {
        return { data: null, error: request.error ?? new Error('Booking not found') };
      }

      const booking = request.data;

      const bookingUpdate = await this.supabase
        .from('bookings')
        .update({ status: 'rejected', rejection_reason: reason, approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (bookingUpdate.error) {
        return { data: null, error: bookingUpdate.error };
      }

      const quotationUpdate = await this.supabase.from('quotations').update({ status: 'rejected' }).eq('booking_id', bookingId);
      if (quotationUpdate.error) {
        return { data: null, error: quotationUpdate.error };
      }

      const activeBookings = await this.supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('vehicle_id', booking.vehicle_id)
        .in('status', this.blockingBookingStatuses)
        .neq('id', bookingId);

      if (activeBookings.error) {
        return { data: null, error: activeBookings.error };
      }

      if ((activeBookings.count ?? 0) === 0) {
        const vehicleUpdate = await this.supabase
          .from('vehicle')
          .update({ vehicle_status: 'available', next_available_date: null })
          .eq('id', booking.vehicle_id);
        if (vehicleUpdate.error) {
          return { data: null, error: vehicleUpdate.error };
        }
      }

      await this.insertNotificationPayload({
        user_id: booking.quotation?.advisor_id ?? booking.user_id,
        title: 'Booking Rejected',
        message: reason,
        type: 'error',
        is_read: false,
        booking_id: bookingId,
      });

      await this.logAudit('booking_rejected', bookingId);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getBookingRequestDetails(bookingId: string) {
    const { data, error } = await this.supabase
      .from('bookings')
      .select(`*, vehicle (*)`)
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !data) {
      return { data: null, error };
    }

    const quotation = await this.getQuotationByBooking(bookingId);
    if (quotation.error) {
      return { data: null, error: quotation.error };
    }

    return {
      data: {
        ...data,
        quotation: quotation.data,
      },
      error: null,
    };
  }

  async getAdminBookingDetails(bookingId: string) {
    const { data, error } = await this.supabase
      .from('bookings')
      .select(`
        id,
        vehicle_id,
        customer_id,
        pickup_location,
        drop_location,
        start_date,
        end_date,
        pickup_time,
        dropoff_time,
        purpose,
        number_of_passengers,
        special_instructions,
        status,
        payment_status,
        created_at,
        approved_by,
        approved_at,
        rejection_reason,
        user_id,
        total_price,
        customers (
          full_name,
          mobile,
          email,
          license_no,
          license_expiry,
          customer_type,
          business_name,
          gst_number,
          id_proof_url
        ),
        vehicle (
          brand,
          model,
          registration_no,
          fuel,
          transmission,
          capacity,
          year,
          daily_rate,
          tier_id
        )
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !data) {
      return { data: null, error };
    }

    const quotation = await this.getQuotationByBooking(bookingId);
    if (quotation.error) {
      return { data: null, error: quotation.error };
    }

    const advisorName = await this.resolveAdvisorDisplayName(quotation.data?.advisor_id);

    return {
      data: {
        ...data,
        quotation: quotation.data,
        advisor_name: advisorName,
      },
      error: null,
    };
  }

  async approveBooking(bookingId: string) {
    const user = await this.getCurrentUser();
    return await this.supabase
      .from('bookings')
      .update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq('id', bookingId);
  }

  async rejectBooking(bookingId: string, reason: string) {
    return await this.supabase
      .from('bookings')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', bookingId);
  }

  async insertBulkBooking(data: BulkBookingInput) {
    return await this.supabase.from('bulk_bookings').insert([{ ...data, status: data.status ?? 'pending' }]);
  }

  async getBulkBookings() {
    return await this.supabase.from('bulk_bookings').select('*').order('created_at', { ascending: false });
  }

  async insertNotification(userId: string, title: string, message: string, bookingId?: string, type?: string) {
    return await this.insertNotificationPayload({ user_id: userId, title, message, booking_id: bookingId, type });
  }

  async insertNotificationPayload(payload: NotificationInput) {
    return await this.supabase.from('notifications').insert([payload]);
  }

  async notifyAdminsOfBookingRequest(booking: any, quotation: any, vehicle: any, advisorName: string) {
    const { data: roles, error } = await this.supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'superadmin']);

    if (error) {
      return { data: null, error };
    }

    const quoteRef = quotation.quote_reference;
    const vehicleName = `${vehicle?.make || vehicle?.brand || ''} ${vehicle?.model || ''}`.trim();
    const message = `Advisor ${advisorName} submitted quotation ${quoteRef} for ${quotation.customer_name} - ${vehicleName} from ${this.formatDate(booking.start_date)} to ${this.formatDate(booking.end_date)}`;
    const payloads = (roles ?? []).map((role: any) => ({
      user_id: role.user_id,
      title: 'New Booking Request',
      message,
      type: 'booking_request',
      booking_id: booking.id,
    }));

    if (!payloads.length) {
      return { data: [], error: null };
    }

    return await this.supabase.from('notifications').insert(payloads);
  }

  async getMyNotifications() {
    const user = await this.getCurrentUser();
    if (!user) {
      return { data: [], error: null };
    }

    return await this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);
  }

  async markNotificationsRead(userId: string) {
    return await this.supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  }

  async markNotificationRead(notificationId: string) {
    return await this.supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  }

  subscribeToNotifications(userId: string, callback: () => void) {
    return this.supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        callback
      )
      .subscribe();
  }

  subscribeToAllBookingChanges(callback: () => void) {
    return this.supabase
      .channel('admin-bookings-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, callback)
      .subscribe();
  }

  subscribeToMyBookingChanges(userId: string, callback: () => void) {
    return this.supabase
      .channel(`dealer-bookings-rt-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${userId}` }, callback)
      .subscribe();
  }

  async releaseExpiredBookings() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.supabase
      .from('bookings')
      .select('id, vehicle_id, end_date')
      .in('status', ['approved', 'in_service'])
      .lt('end_date', today);

    if (error) {
      return { data: null, error };
    }

    for (const booking of data ?? []) {
      const update = await this.supabase
        .from('vehicle')
        .update({ vehicle_status: 'dirty', next_available_date: null })
        .eq('id', booking.vehicle_id);
      if (update.error) {
        return { data: null, error: update.error };
      }
    }

    return { data, error: null };
  }

  async sendCustomerConfirmationEmail(booking: any) {
    const quotation = booking.quotation;
    if (!quotation?.email) {
      await this.logAudit('confirmation_email_skipped_missing_address', booking.id);
      return { data: null, error: null };
    }

    const { data: dealer } = await this.getDealerProfile(booking.user_id);
    return await this.supabase.functions.invoke('send-booking-confirmation', {
      body: {
        to: quotation.email,
        quoteReference: quotation.quote_reference,
        customerName: quotation.customer_name,
        vehicle: booking.vehicle,
        booking,
        quotation,
        dealer,
      },
    });
  }

  async sendQuotationEmail(payload: {
    to: string;
    customerName: string;
    quoteReference: string;
    booking: any;
    quotation: any;
    vehicle: any;
    pdfBase64: string;
    fileName: string;
  }) {
    if (!payload.to?.trim()) {
      return { data: null, error: new Error('Customer email address is missing') };
    }

    const user = await this.getCurrentUser();
    const { data: dealer } = user?.id ? await this.getDealerProfile(user.id) : { data: null };

    return await this.supabase.functions.invoke('send-booking-confirmation', {
      body: {
        mode: 'quotation',
        to: payload.to.trim(),
        quoteReference: payload.quoteReference,
        customerName: payload.customerName,
        vehicle: payload.vehicle,
        booking: payload.booking,
        quotation: payload.quotation,
        dealer,
        attachments: [
          {
            filename: payload.fileName,
            content: payload.pdfBase64,
            type: 'application/pdf',
          },
        ],
      },
    });
  }

  async getAuditLogs() {
    return await this.supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  }

  async getDealerProfile(userId: string) {
    return await this.supabase.from('dealers').select('*').eq('user_id', userId).maybeSingle();
  }

  async upsertDealerProfile(payload: Record<string, any>) {
    const existing = await this.getDealerProfile(payload['user_id']);
    if (existing.data?.id) {
      return await this.supabase.from('dealers').update(payload).eq('id', existing.data.id);
    }

    return await this.supabase.from('dealers').insert([payload]);
  }

  async logAudit(action: string, entityId?: string) {
    const user = await this.getCurrentUser();
    if (!user) {
      return;
    }

    await this.supabase.from('audit_logs').insert([
      {
        action: entityId ? `${action}:${entityId}` : action,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  private sanitizeQuotationPayload(payload: Record<string, any>) {
    const allowed = [
      'id',
      'booking_id',
      'customer_name',
      'mobile',
      'email',
      'license',
      'license_expiry',
      'customer_type',
      'business_name',
      'gst_number',
      'rate',
      'days',
      'base_cost',
      'gst',
      'advance',
      'security_deposit',
      'final_amount',
      'status',
      'created_at',
      'updated_at',
      'quote_reference',
      'advisor_id',
      'fuel_policy',
      'extra_mileage_rate',
      'extra_mileage_charge',
      'promo_code',
      'discount_amount',
      'id_proof_url',
      'sent_at',
      'advance_mode',
    ];

    return Object.fromEntries(allowed.filter((key) => key in payload).map((key) => [key, payload[key]]));
  }

  private formatDate(value: string) {
    return value ? new Date(value).toLocaleDateString() : '-';
  }

  private async resolveAdvisorDisplayName(advisorId?: string | null) {
    if (!advisorId) {
      return 'Advisor';
    }

    const dealerProfile = await this.supabase
      .from('dealers')
      .select('contact_name, company_name')
      .eq('user_id', advisorId)
      .maybeSingle();

    if (dealerProfile.data?.contact_name) {
      return dealerProfile.data.contact_name;
    }

    if (dealerProfile.data?.company_name) {
      return dealerProfile.data.company_name;
    }

    return `Advisor ${advisorId.slice(0, 8)}`;
  }

  async createCashfreeOrder(bookingId: string, quotationId: string, amount: number) {
    switch (environment.cashfreeApiStyle) {
      case 'vercel': return await this.createViaVercelApi(bookingId, quotationId, amount);
      case 'edge': {
        const { data, error } = await this.supabase.functions.invoke('create-cashfree-order', {
          body: { booking_id: bookingId, quotation_id: quotationId, amount },
        });
        return { data, error };
      }
      default: return await this.createCashfreeOrderLocal(bookingId, quotationId, amount);
    }
  }

  async markBookingInService(bookingId: string) {
    return await this.supabase
      .from('bookings')
      .update({ status: 'in_service', updated_at: new Date().toISOString() })
      .eq('id', bookingId);
  }

  async verifyAndActivatePayment(bookingId: string, currentBookingStatus: string): Promise<{ activated: boolean; error: any }> {
    if (!['approved', 'confirmed'].includes(currentBookingStatus)) {
      return { activated: false, error: null };
    }

    const paymentResult = await this.getPaymentByBooking(bookingId);
    if (paymentResult.data?.status !== 'paid') {
      return { activated: false, error: null };
    }

    const { error } = await this.supabase
      .from('bookings')
      .update({ status: 'in_service', updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    return { activated: !error, error };
  }

  async getPaymentByBooking(bookingId: string) {
    const result = await this.supabase
      .from('payments')
      .select('id, cf_order_id, cf_payment_id, amount, payment_type, status, payment_mode, notes, created_at, updated_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ...result,
      data: this.normalizePaymentState(result.data),
    };
  }

  async recordOfflineAdvancePayment(bookingId: string, amount: number) {
    const result = await this.supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount: Number(amount ?? 0),
        payment_type: 'advance',
        payment_mode: 'cash',
        status: 'paid',
        notes: 'Advance collected offline by advisor',
      })
      .select('id, booking_id, cf_order_id, cf_payment_id, amount, payment_type, status, payment_mode, notes, created_at, updated_at')
      .single();

    return {
      ...result,
      data: this.normalizePaymentState(result.data),
    };
  }

  async getAdminBookingLedger() {
    const result = await this.supabase
      .from('bookings')
      .select(`
        id, status, start_date, end_date, pickup_location, drop_location, created_at, user_id, total_price,
        customers(full_name, mobile, customer_type),
        vehicle(brand, model),
        quotations!quotations_booking_id_fkey(quote_reference, final_amount)
      `)
      .order('created_at', { ascending: false });

    if (result.error) {
      return result;
    }

    const latestPayments = await this.getLatestPaymentsForBookings((result.data ?? []).map((row: any) => row.id));
    if (latestPayments.error) {
      return { data: [], error: latestPayments.error };
    }

    return {
      ...result,
      data: (result.data ?? []).map((row: any) => ({
        ...row,
        latest_payment: latestPayments.data.get(row.id) ?? null,
      })),
    };
  }

  private async createViaVercelApi(bookingId: string, quotationId: string, amount: number) {
    const freshCutoff = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const { data: existing } = await this.supabase
      .from('payments')
      .select('cf_order_id, cf_payment_session_id')
      .eq('booking_id', bookingId)
      .eq('status', 'initiated')
      .gte('created_at', freshCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.cf_payment_session_id) {
      return { data: { cf_order_id: existing.cf_order_id, payment_session_id: existing.cf_payment_session_id }, error: null };
    }

    const { data: booking } = await this.supabase
      .from('bookings')
      .select('id, status, customer_id, vehicle_id, user_id, customers(full_name, mobile, email)')
      .eq('id', bookingId)
      .single();

    if (!booking) return { data: null, error: new Error('Booking not found') };
    if ((booking as any).status !== 'approved') {
      return { data: null, error: new Error(`Booking must be approved (current: ${(booking as any).status})`) };
    }

    const cfOrderId = `CF-${bookingId.replace(/-/g, '').slice(0, 16).toUpperCase()}-${Date.now()}`;
    const customer = (booking as any).customers;
    const returnUrl = `${window.location.origin}/dealer/booking/${bookingId}/payments?cf_order_id=${cfOrderId}`;

    let paymentSessionId: string;
    try {
      const response = await fetch('/api/create-cashfree-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: cfOrderId,
          order_amount: Number(amount),
          customer_id: String((booking as any).customer_id),
          customer_name: customer?.full_name || 'Customer',
          customer_email: customer?.email || 'noreply@example.com',
          customer_phone: String(customer?.mobile || '9999999999').replace(/\D/g, '').slice(-10).padStart(10, '9'),
          return_url: returnUrl,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { data: null, error: new Error(`Cashfree error: ${errText}`) };
      }
      const result = await response.json();
      paymentSessionId = result.payment_session_id;
    } catch (fetchErr: any) {
      return { data: null, error: new Error(`Network error: ${fetchErr?.message}`) };
    }

    const { error: insertError } = await this.supabase.rpc('insert_payment_record', {
      p_booking_id: bookingId,
      p_quotation_id: quotationId || null,
      p_customer_id: (booking as any).customer_id,
      p_vehicle_id: (booking as any).vehicle_id,
      p_advisor_id: (booking as any).user_id,
      p_cf_order_id: cfOrderId,
      p_cf_payment_session_id: paymentSessionId,
      p_amount: Number(amount),
      p_payment_type: 'balance',
    });

    if (insertError) {
      return { data: null, error: new Error(`Payment record creation failed: ${insertError.message}`) };
    }

    return { data: { cf_order_id: cfOrderId, payment_session_id: paymentSessionId }, error: null };
  }

  private async createCashfreeOrderLocal(bookingId: string, quotationId: string, amount: number) {
    const freshCutoff = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const { data: existing } = await this.supabase
      .from('payments')
      .select('cf_order_id, cf_payment_session_id')
      .eq('booking_id', bookingId)
      .eq('status', 'initiated')
      .gte('created_at', freshCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.cf_payment_session_id) {
      return { data: { cf_order_id: existing.cf_order_id, payment_session_id: existing.cf_payment_session_id }, error: null };
    }

    const { data: booking } = await this.supabase
      .from('bookings')
      .select('id, status, customer_id, vehicle_id, user_id, customers(full_name, mobile, email)')
      .eq('id', bookingId)
      .single();

    if (!booking) return { data: null, error: new Error('Booking not found') };
    if (booking.status !== 'approved') {
      return { data: null, error: new Error(`Booking must be approved to initiate payment (current: ${(booking as any).status})`) };
    }

    const cfOrderId = `CF-${bookingId.replace(/-/g, '').slice(0, 16).toUpperCase()}-${Date.now()}`;
    const customer = (booking as any).customers;

    const cfPayload = {
      order_id: cfOrderId,
      order_amount: Number(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: String((booking as any).customer_id),
        customer_name: customer?.full_name || 'Customer',
        customer_email: customer?.email || 'noreply@example.com',
        customer_phone: String(customer?.mobile || '9999999999').replace(/\D/g, '').slice(-10).padStart(10, '9'),
      },
      order_meta: {
        return_url: `${window.location.origin}/dealer/booking/${bookingId}/payments?cf_order_id={order_id}`,
      },
    };

    let cfOrder: any;
    try {
      const cfResponse = await fetch('/cashfree-proxy/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': environment.cashfreeAppId,
          'x-client-secret': environment.cashfreeSecretKey,
        },
        body: JSON.stringify(cfPayload),
      });

      if (!cfResponse.ok) {
        const errText = await cfResponse.text();
        return { data: null, error: new Error(`Cashfree error: ${errText}`) };
      }
      cfOrder = await cfResponse.json();
    } catch (fetchErr: any) {
      return { data: null, error: new Error(`Network error calling Cashfree: ${fetchErr?.message}`) };
    }

    const { error: insertError } = await this.supabase.rpc('insert_payment_record', {
      p_booking_id: bookingId,
      p_quotation_id: quotationId || null,
      p_customer_id: (booking as any).customer_id,
      p_vehicle_id: (booking as any).vehicle_id,
      p_advisor_id: (booking as any).user_id,
      p_cf_order_id: cfOrderId,
      p_cf_payment_session_id: cfOrder.payment_session_id,
      p_amount: Number(amount),
      p_payment_type: 'balance',
    });

    if (insertError) {
      return { data: null, error: new Error(`Payment record creation failed: ${insertError.message}`) };
    }

    return { data: { cf_order_id: cfOrderId, payment_session_id: cfOrder.payment_session_id }, error: null };
  }

  private fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async getLatestPaymentsForBookings(bookingIds: string[]) {
    const uniqueIds = [...new Set((bookingIds ?? []).filter(Boolean))];
    if (!uniqueIds.length) {
      return { data: new Map<string, any>(), error: null };
    }

    const result = await this.supabase
      .from('payments')
      .select('booking_id, status, payment_type, amount, cf_payment_id, cf_order_id, payment_mode, notes, created_at, updated_at')
      .in('booking_id', uniqueIds)
      .order('created_at', { ascending: false });

    if (result.error) {
      return { data: new Map<string, any>(), error: result.error };
    }

    const latestByBooking = new Map<string, any>();
    for (const payment of result.data ?? []) {
      const bookingId = String(payment['booking_id'] ?? '');
      if (!bookingId || latestByBooking.has(bookingId)) {
        continue;
      }
      latestByBooking.set(bookingId, this.normalizePaymentState(payment));
    }

    return { data: latestByBooking, error: null };
  }

  private normalizePaymentState<T extends Record<string, any> | null>(payment: T): T {
    if (!payment) {
      return payment;
    }

    if (String(payment['status'] ?? '').toLowerCase() !== 'success') {
      return payment;
    }

    return {
      ...payment,
      status: 'paid',
    } as T;
  }
}
