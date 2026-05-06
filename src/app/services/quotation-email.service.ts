import { Injectable } from '@angular/core';

export type QuotationEmailPayload = {
  to: string;
  customerName: string;
  quoteReference: string;
  advisorName: string;
  advisorEmail: string;
  finalAmount: number;
  pdfBase64: string;
  fileName: string;
};

@Injectable({ providedIn: 'root' })
export class QuotationEmailService {
  private readonly publicKey = 'qt0IWr1biKy6bTLul';
  private readonly serviceId = 'service_5tcvb06';
  private readonly templateId = 'template_3ss7utb';
  private readonly endpoint = 'https://api.emailjs.com/api/v1.0/email/send';

  async sendQuotationEmail(payload: QuotationEmailPayload) {
    if (!payload.to?.trim()) {
      return { data: null, error: new Error('Customer email address is missing') };
    }


    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: this.serviceId,
          template_id: this.templateId,
          user_id: this.publicKey,
          template_params: {
            to_email: payload.to.trim(),
            customer_name: payload.customerName,
            quote_reference: payload.quoteReference,
            advisor_name: payload.advisorName,
            advisor_email: payload.advisorEmail,
            final_amount: payload.finalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
            attachment_name: payload.fileName,
            attachment_content: payload.pdfBase64,
            quotation_pdf: payload.pdfBase64,
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error('[QuotationEmailService] EmailJS request failed:', detail);
        return { data: null, error: new Error(`EmailJS request failed: ${detail}`) };
      }

      const detail = await response.text();
      return { data: detail || 'ok', error: null };
    } catch (error: any) {
      console.error('[QuotationEmailService] Unexpected EmailJS error:', error);
      return { data: null, error: new Error(error?.message || 'Unexpected EmailJS error') };
    }
  }
}
