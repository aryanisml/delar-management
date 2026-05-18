import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { QuotationComponent } from './quotation.component';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { MessageService } from 'primeng/api';


describe.only('QuotationComponent', () => {
  let component: QuotationComponent;
  let fixture: ComponentFixture<QuotationComponent>;

  // Create mock objects using Vitest
  let mockRouter = { navigate: vi.fn() };
  let mockSupabase = {
    getCurrentUser: vi.fn(),
    validatePromotion: vi.fn(),
    buildQuotationPricingPreview: vi.fn(),
    getBookingWithVehicle: vi.fn(),
    getQuotationByBooking: vi.fn()
  };
  let mockRoute = { snapshot: { paramMap: { get: () => '123' } } }; // Simulate a URL with an ID

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotationComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: SupabaseService, useValue: mockSupabase },
        MessageService // PrimeNG service can usually be provided directly
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuotationComponent);
    component = fixture.componentInstance;
    
    // Default mock returns to prevent errors during ngOnInit
    mockSupabase.getCurrentUser.mockResolvedValue({ id: '1', email: 'test@test.com' });
    mockSupabase.buildQuotationPricingPreview.mockReturnValue({ 
        rate: 1000, days: 5, base_cost: 5000, final_amount: 5500
    });
    mockSupabase.getBookingWithVehicle.mockResolvedValue({
      data: {
        id: '123',
        start_date: '2026-05-17',
        end_date: '2026-05-22',
        vehicle: { fuel_policy: 'Full-to-Full' }
      },
      error: null
    });
    mockSupabase.getQuotationByBooking.mockResolvedValue({ data: null, error: null });

    fixture.detectChanges();
  });

  // --- TEST CASE 1: Component Creation ---
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- TEST CASE 2: Loading State (False) ---
  it('should initialize loading as false',() => {
    expect(component.loading()).toBeFalsy();
  });
  
  // --- TEST CASE 3: Testing Advisor Details ---
  it('should set the advisor details from the logged-in user', async () => {
  // We already set the fake user as { email: 'test@test.com' } in the beforeEach
  
  // We wait for ngOnInit to finish its async work
  await fixture.whenStable();
  fixture.detectChanges();

  // Now check if the "Advisor" signal was updated correctly
  // Your code logic sets the name to the part before the '@' if full_name is missing
  expect(component.advisor().email).toBe('test@test.com');
  expect(component.advisor().name).toBe('test'); 
});

  // --- TEST CASE 4: Testing Signals (Initial State) ---
  it('should have default promoCode as empty string', () => {
    // We use () because promoCode is a Signal
    expect(component.promoCode()).toBe('');
  });

  // --- TEST CASE 5: Testing Logic (Calculations) ---
  it('should calculate the base formula string correctly', () => {
    // Act: The values come from our mockSupabase setup above
    const result = component.baseFormula();

    // Assert: Check if the string matches the math (1,000 * 5 = 5,000)
    expect(result).toContain('1,000');
    expect(result).toContain('5,000');
  });

  // --- TEST CASE 6: Testing Async Actions (Promo Code) ---
  it('should update discount when a valid promo is applied', async () => {
    // 1. Setup the fake response for this specific test
    mockSupabase.validatePromotion.mockResolvedValue({
      data: { discount_percent: 10 },
      error: null
    });

    // 2. Set the signal value
    component.promoCode.set('SAVE10');

    // 3. Call the async function
    await component.applyPromo();

    // 4. Verify the result
    // (10% of 5000 base cost is 500)
    expect(component.discount()).toBe(500);
    expect(component.promoMessage()).toBe('Promo code applied.');
  });
});
