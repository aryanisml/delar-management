import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { DealerBookings } from './dealer-bookings';
import { QuotationEmailService } from '../../services/quotation-email.service';
import { QuotationPdfService } from '../../services/quotation-pdf';
import { SupabaseService } from '../../services/supabase';

describe('DealerBookings', () => {
  let component: DealerBookings;
  let fixture: ComponentFixture<DealerBookings>;
  let supabase: any;
  let messageService: any;
  let router: any;
  let sanitizer: any;
  let quotationPdf: any;
  let quotationEmail: any;

  const tomorrow = new Date('2099-01-10T00:00:00.000Z');
  const dayAfterTomorrow = new Date('2099-01-12T00:00:00.000Z');
  const futureLicenseDate = new Date('2099-12-31T00:00:00.000Z');

  beforeEach(async () => {
    supabase = {
      getCurrentUser: vi.fn(),
      getWalkInVehicles: vi.fn(),
      findCustomerByMobile: vi.fn(),
      uploadCustomerIdProof: vi.fn(),
      createWalkInQuotation: vi.fn(),
      createOrFetchQuotation: vi.fn(),
      markQuotationSent: vi.fn(),
      confirmWalkInBooking: vi.fn(),
      recordOfflineAdvancePayment: vi.fn(),
    };
    messageService = { add: vi.fn() };
    router = { navigateByUrl: vi.fn() };
    sanitizer = { bypassSecurityTrustResourceUrl: vi.fn() };
    quotationPdf = {
      buildPdfBlob: vi.fn(),
      buildPdfBase64: vi.fn(),
      buildFileName: vi.fn(),
    };
    quotationEmail = { sendQuotationEmail: vi.fn() };

    supabase.getCurrentUser.mockResolvedValue({
      id: 'advisor-1',
      email: 'dealer@example.com',
      user_metadata: { full_name: 'Dealer User' },
    } as any);
    supabase.getWalkInVehicles.mockResolvedValue({ data: [], error: null });
    supabase.findCustomerByMobile.mockResolvedValue({ data: null, error: null });
    supabase.uploadCustomerIdProof.mockResolvedValue({ data: null, error: null });
    supabase.createWalkInQuotation.mockResolvedValue({ data: null, error: null });
    supabase.createOrFetchQuotation.mockResolvedValue({ data: null, error: null });
    supabase.markQuotationSent.mockResolvedValue({ data: true, error: null } as any);
    supabase.confirmWalkInBooking.mockResolvedValue({ error: null } as any);
    supabase.recordOfflineAdvancePayment.mockResolvedValue({ data: { id: 'payment-1' }, error: null } as any);

    router.navigateByUrl.mockResolvedValue(true);
    sanitizer.bypassSecurityTrustResourceUrl.mockImplementation((value: string) => value as any);
    quotationPdf.buildPdfBlob.mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' }));
    quotationPdf.buildPdfBase64.mockReturnValue('pdf-base64');
    quotationPdf.buildFileName.mockReturnValue('quote.pdf');
    quotationEmail.sendQuotationEmail.mockResolvedValue({ data: 'ok', error: null });

    TestBed.overrideComponent(DealerBookings, {
      set: {
        providers: [{ provide: MessageService, useValue: messageService }],
      },
    });

    await TestBed.configureTestingModule({
      imports: [DealerBookings],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabase },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: DomSanitizer, useValue: sanitizer },
        { provide: QuotationPdfService, useValue: quotationPdf },
        { provide: QuotationEmailService, useValue: quotationEmail },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DealerBookings);
    component = fixture.componentInstance;
  });

  function selectBookableVehicle() {
    const vehicle = {
      id: 'vehicle-1',
      brand: 'Toyota',
      model: 'Innova',
      tier_id: 'tier-1',
      availability_status: 'available',
      is_available_for_selected_dates: true,
      fuel: 'Diesel',
      transmission: 'Automatic',
      year: 2024,
    };
    component.selectVehicle(vehicle);
    return vehicle;
  }

  function fillValidTrip() {
    component.trip.set({
      pickup_date: tomorrow,
      pickup_time: '10:00',
      pickup_location: 'Hyderabad Airport (RGIA)',
      drop_location: 'Gachibowli',
      end_date: dayAfterTomorrow,
      dropoff_time: '18:00',
      purpose: 'Corporate',
      number_of_passengers: 4,
      special_instructions: '',
    });
  }

  function fillValidCustomer() {
    component.customer.set({
      full_name: 'Akhil Kumar',
      mobile: '9876543210',
      email: 'akhil@example.com',
      license_no: 'TS123456',
      license_expiry: futureLicenseDate,
      customer_type: 'individual',
      business_name: '',
      gst_number: '',
      id_proof_url: 'https://files.test/id-proof.png',
      id_proof_name: 'id-proof.png',
    });
  }

  function seedQuotationState() {
    fillValidCustomer();
    fillValidTrip();
    selectBookableVehicle();
    component.generatedBooking.set({ id: 'booking-1', created_at: '2099-01-01T00:00:00.000Z', payment_status: 'pending' });
    component.generatedQuotation.set({
      id: 'quote-1',
      quote_reference: 'Q-1001',
      created_at: '2099-01-01T00:00:00.000Z',
      days: 2,
      rate: 2500,
      base_cost: 5000,
      gst: 900,
      discount_amount: 0,
      advance: 1500,
      security_deposit: 3000,
      final_amount: 5900,
      extra_mileage_rate: 12,
      fuel_policy: 'Full-to-Full',
    });
  }

  it('should create and load initial vehicle data on init', async () => {
    await component.ngOnInit();

    expect(component).toBeTruthy();
    expect(supabase.getCurrentUser).toHaveBeenCalled();
    expect(supabase.getWalkInVehicles).toHaveBeenCalled();
    expect(component.advisorContact()).toEqual({
      name: 'Dealer User',
      email: 'dealer@example.com',
    });
  });

  it('should move to trip step when selecting a bookable vehicle', () => {
    const vehicle = selectBookableVehicle();

    expect(component.selectedVehicle()).toEqual(vehicle);
    expect(component.step()).toBe(2);
    expect(component.offlinePaymentRecorded()).toBe(false);
  });

  it('should reject unavailable vehicles when selecting', () => {
    component.selectVehicle({
      id: 'vehicle-2',
      availability_status: 'booked',
      is_available_for_selected_dates: false,
      tier_id: 'tier-1',
    });

    expect(component.selectedVehicle()).toBeNull();
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        summary: 'Vehicle unavailable',
      })
    );
  });

  it('should identify an invalid trip and warn instead of continuing', () => {
    selectBookableVehicle();
    component.trip.set({
      pickup_date: null,
      pickup_time: '',
      pickup_location: '',
      drop_location: '',
      end_date: null,
      dropoff_time: '',
      purpose: '',
      number_of_passengers: null,
      special_instructions: '',
    });

    component.continueToCustomer();

    expect(component.tripInvalid()).toBe(true);
    expect(component.step()).toBe(2);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Trip details incomplete',
      })
    );
  });

  it('should continue to the customer step when trip details are valid', () => {
    selectBookableVehicle();
    fillValidTrip();

    component.continueToCustomer();

    expect(component.tripInvalid()).toBe(false);
    expect(component.step()).toBe(3);
  });

  it('should prefill the customer when lookup finds an existing record', async () => {
    supabase.findCustomerByMobile.mockResolvedValue({
      data: {
        id: 'customer-1',
        full_name: 'Existing Customer',
        mobile: '9876543210',
        email: 'existing@example.com',
        license_no: 'DL123456',
        license_expiry: '2099-11-01',
        customer_type: 'business',
        business_name: 'Existing Corp',
        gst_number: '36ABCDE1234F1Z5',
        id_proof_url: 'https://files.test/existing-id.png',
      },
      error: null,
    });
    component.updateCustomer('mobile', '9876543210');

    const found = await component.lookupCustomer();

    expect(found).toBe(true);
    expect(component.existingCustomer()?.id).toBe('customer-1');
    expect(component.customerChoice()).toBe('existing');
    expect(component.customer().full_name).toBe('Existing Customer');
    expect(component.customer().customer_type).toBe('business');
  });

  it('should report validation errors for an invalid customer payload', () => {
    component.customer.set({
      full_name: '',
      mobile: '0123',
      email: '',
      license_no: '123',
      license_expiry: new Date('2000-01-01T00:00:00.000Z'),
      customer_type: 'business',
      business_name: '',
      gst_number: '',
      id_proof_url: '',
      id_proof_name: '',
    });

    const errors = component.validateCustomer(true);

    expect(errors.full_name).toContain('required');
    expect(errors.mobile).toContain('should not start with 0');
    expect(errors.license_no).toContain('valid');
    expect(errors.license_expiry).toContain('expired');
    expect(errors.business_name).toContain('Business name is required');
    expect(errors.id_proof_url).toContain('ID proof');
    expect(component.customerInvalid()).toBe(true);
  });

  it('should generate a quotation and store booking data', async () => {
    const vehicle = selectBookableVehicle();
    fillValidTrip();
    fillValidCustomer();
    supabase.createWalkInQuotation.mockResolvedValue({
      data: {
        booking: { id: 'booking-1' },
        quotation: { id: 'quote-1', quote_reference: 'Q-1001', final_amount: 5900 },
      },
      error: null,
    });

    const success = await component.generateQuotation();

    expect(success).toBe(true);
    expect(supabase.createWalkInQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle_id: vehicle.id,
        existing_customer_choice: 'new',
      })
    );
    expect(component.generatedBooking()).toEqual({ id: 'booking-1' });
    expect(component.generatedQuotation()).toEqual(expect.objectContaining({ id: 'quote-1' }));
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Quotation ready',
      })
    );
  });

  it('should send the quotation by email and mark it as sent', async () => {
    seedQuotationState();

    await component.sendQuote('email');

    expect(quotationEmail.sendQuotationEmail).toHaveBeenCalled();
    expect(supabase.markQuotationSent).toHaveBeenCalledWith('booking-1');
    expect(component.sendState().email).toBe(true);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Quotation sent',
      })
    );
  });

  it('should open a WhatsApp handoff for the generated quotation', async () => {
    seedQuotationState();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await component.sendQuote('whatsapp');

    expect(windowOpenSpy).toHaveBeenCalled();
    expect(component.sendState().whatsapp).toBe(true);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Quotation shared',
      })
    );
    windowOpenSpy.mockRestore();
  });

  it('should record offline collection once for a generated booking', async () => {
    seedQuotationState();

    await component.confirmOfflineCollection();

    expect(supabase.recordOfflineAdvancePayment).toHaveBeenCalledWith('booking-1', 1500);
    expect(component.offlinePaymentRecorded()).toBe(true);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Payment recorded',
      })
    );
  });

  it('should confirm the booking and navigate to my bookings', async () => {
    seedQuotationState();
    component.sendState.set({ email: true, sms: false, whatsapp: false });

    await component.confirmBooking();

    expect(supabase.confirmWalkInBooking).toHaveBeenCalledWith('booking-1', 'online', 'email');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dealer/my-bookings');
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Booking submitted',
      })
    );
  });
});
