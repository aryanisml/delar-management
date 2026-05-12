interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  returnUrl?: string;
  redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
}

interface CashfreeInstance {
  checkout(options: CashfreeCheckoutOptions): Promise<{ error?: { message: string } }>;
}

interface CashfreeInitOptions {
  mode: 'sandbox' | 'production';
}

declare function Cashfree(options: CashfreeInitOptions): CashfreeInstance;

declare global {
  interface Window {
    Cashfree: typeof Cashfree;
  }
}

export {};
