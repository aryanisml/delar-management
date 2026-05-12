import { Injectable } from '@angular/core';

export type QuotationPdfInput = {
  companyName: string;
  companySubtitle: string;
  quoteReference: string;
  bookingId: string;
  issueDate: string;
  validUntil: string;
  advisorName: string;
  advisorEmail: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string | null;
  customerLicenseNo: string;
  customerType: string;
  vehicleName: string;
  vehicleFuelType: string;
  vehicleTransmission: string;
  vehicleYear: string;
  pickupLocation: string;
  dropLocation: string;
  pickupDateTime: string;
  dropDateTime: string;
  durationLabel: string;
  purpose: string;
  passengers: string;
  paymentStatusLabel: string;
  fuelPolicy: string;
  amounts: {
    dailyRate: number;
    days: number;
    baseCost: number;
    gst: number;
    discountAmount: number;
    advance: number;
    securityDeposit: number;
    finalAmount: number;
    extraMileageRate: number;
  };
};

@Injectable({ providedIn: 'root' })
export class QuotationPdfService {
  buildPdfBlob(input: QuotationPdfInput) {
    const pdf = this.buildPdfString(input);
    return new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' });
  }

  buildPdfBase64(input: QuotationPdfInput) {
    const pdf = this.buildPdfString(input);
    const bytes = new TextEncoder().encode(pdf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  buildFileName(quoteReference: string) {
    const safeReference = String(quoteReference || 'quotation').replace(/[^a-zA-Z0-9-_]/g, '-');
    return `${safeReference}.pdf`;
  }

  private buildPdfString(input: QuotationPdfInput) {
    const commands: string[] = [];
    const brand = this.hex('#0d9488');
    const brandSoft = this.hex('#ccfbf1');
    const ink = this.hex('#0f172a');
    const slate = this.hex('#475569');
    const border = this.hex('#cbd5e1');
    const success = this.hex('#16a34a');
    const pending = this.hex('#64748b');
    const white = this.hex('#ffffff');

    const textWidth = (text: string, size: number) => this.ascii(text).length * size * 0.52;
    const line = (x1: number, y1: number, x2: number, y2: number, color = border, width = 1) => {
      commands.push(`${color.stroke} ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const rect = (x: number, y: number, width: number, height: number, stroke = border, fill?: { fill: string; stroke?: string }) => {
      if (fill) {
        commands.push(`${fill.fill} ${stroke.stroke} 1 w ${x} ${y} ${width} ${height} re B`);
        return;
      }
      commands.push(`${stroke.stroke} 1 w ${x} ${y} ${width} ${height} re S`);
    };
    const text = (value: string, x: number, y: number, opts?: { font?: 'F1' | 'F2'; size?: number; color?: { fill: string }; align?: 'left' | 'right' }) => {
      const safeValue = this.escapePdf(this.ascii(value));
      const font = opts?.font || 'F1';
      const size = opts?.size || 10;
      const color = opts?.color || ink;
      const offsetX = opts?.align === 'right' ? x - textWidth(safeValue, size) : x;
      commands.push(`BT ${color.fill} /${font} ${size} Tf 1 0 0 1 ${offsetX} ${y} Tm (${safeValue}) Tj ET`);
    };
    const money = (value: number) => `Rs ${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const pill = (label: string, x: number, y: number, fillColor: { fill: string; stroke: string }, width: number) => {
      rect(x, y - 6, width, 18, fillColor, fillColor);
      text(label, x + 8, y, { font: 'F2', size: 9, color: white });
    };

    const metaBoxes = [
      { label: 'Quote Ref', value: input.quoteReference },
      { label: 'Date Generated', value: input.issueDate },
      { label: 'Valid Until', value: input.validUntil },
      { label: 'Advisor Name', value: input.advisorName },
    ];

    const billTo = [
      input.customerName,
      input.customerMobile,
      input.customerEmail || '-',
      input.customerLicenseNo || '-',
      this.titleCase(input.customerType || '-'),
    ];

    const vehicleLines = [
      input.vehicleName,
      input.vehicleFuelType || '-',
      input.vehicleTransmission || '-',
      input.vehicleYear || '-',
    ];

    const tripLines = [
      `${input.pickupLocation} -> ${input.dropLocation}`,
      `Pickup: ${input.pickupDateTime}`,
      `Drop: ${input.dropDateTime}`,
      `Duration: ${input.durationLabel}`,
      `Purpose: ${input.purpose}`,
      `Passengers: ${input.passengers}`,
    ];

    const rows = [
      ['Daily Rate', `${money(input.amounts.dailyRate)}/day x ${input.amounts.days} day(s)`, money(input.amounts.baseCost)],
      ['GST (18%)', '', money(input.amounts.gst)],
      ...(input.amounts.discountAmount > 0 ? [['Discount', '', `- ${money(input.amounts.discountAmount)}`]] : []),
      ['Total Rental Cost', '', money(input.amounts.finalAmount)],
      ['Security Deposit (refundable)', '', money(input.amounts.securityDeposit)],
      ['Advance Payable Now', '', money(input.amounts.advance)],
    ];

    text(input.companyName, 42, 806, { font: 'F2', size: 24, color: brand });
    text(input.companySubtitle, 42, 789, { size: 10, color: slate });
    text('QUOTATION', 553, 806, { font: 'F2', size: 22, color: brand, align: 'right' });
    text(`Booking ${input.bookingId}`, 553, 789, { size: 10, color: slate, align: 'right' });
    line(42, 776, 553, 776, brand, 1.2);

    const metaY = 731;
    const metaWidth = 122;
    for (let i = 0; i < metaBoxes.length; i += 1) {
      const box = metaBoxes[i];
      const x = 42 + i * 128;
      rect(x, metaY, metaWidth, 34, border, brandSoft);
      text(box.label, x + 8, metaY + 22, { font: 'F2', size: 8, color: slate });
      text(this.truncate(box.value, 19), x + 8, metaY + 10, { size: 9, color: ink });
    }

    rect(42, 582, 248, 132, border);
    rect(305, 582, 248, 132, border);
    rect(42, 697, 248, 17, brand, brandSoft);
    rect(305, 697, 248, 17, brand, brandSoft);
    text('Bill To', 50, 702, { font: 'F2', size: 10, color: brand });
    text('Vehicle Details', 313, 702, { font: 'F2', size: 10, color: brand });

    let y = 680;
    const billLabels = ['Name', 'Mobile', 'Email', 'Licence', 'Customer Type'];
    for (let i = 0; i < billLabels.length; i += 1) {
      text(`${billLabels[i]}:`, 50, y, { font: 'F2', size: 9, color: slate });
      text(this.truncate(billTo[i], 28), 116, y, { size: 9, color: ink });
      y -= 20;
    }

    y = 680;
    const vehicleLabels = ['Vehicle', 'Fuel Type', 'Transmission', 'Year'];
    for (let i = 0; i < vehicleLabels.length; i += 1) {
      text(`${vehicleLabels[i]}:`, 313, y, { font: 'F2', size: 9, color: slate });
      text(this.truncate(vehicleLines[i], 28), 392, y, { size: 9, color: ink });
      y -= 20;
    }

    rect(42, 484, 511, 82, border);
    rect(42, 549, 511, 17, brand, brandSoft);
    text('Trip Details', 50, 554, { font: 'F2', size: 10, color: brand });
    text(this.truncate(tripLines[0], 64), 50, 531, { font: 'F2', size: 9, color: ink });
    text(this.truncate(tripLines[1], 64), 50, 514, { size: 9, color: slate });
    text(this.truncate(tripLines[2], 64), 50, 497, { size: 9, color: slate });
    text(this.truncate(tripLines[3], 28), 322, 531, { size: 9, color: slate });
    text(this.truncate(tripLines[4], 28), 322, 514, { size: 9, color: slate });
    text(this.truncate(tripLines[5], 28), 322, 497, { size: 9, color: slate });

    const tableTop = 455;
    const tableLeft = 42;
    const col1 = 190;
    const col2 = 215;
    const col3 = 106;
    const rowHeight = 24;
    rect(tableLeft, tableTop - (rows.length + 1) * rowHeight, col1 + col2 + col3, (rows.length + 1) * rowHeight, border);
    rect(tableLeft, tableTop - rowHeight, col1 + col2 + col3, rowHeight, brand, brand);
    line(tableLeft + col1, tableTop, tableLeft + col1, tableTop - (rows.length + 1) * rowHeight, border);
    line(tableLeft + col1 + col2, tableTop, tableLeft + col1 + col2, tableTop - (rows.length + 1) * rowHeight, border);
    text('Description', tableLeft + 8, tableTop - 16, { font: 'F2', size: 9, color: white });
    text('Details', tableLeft + col1 + 8, tableTop - 16, { font: 'F2', size: 9, color: white });
    text('Amount', tableLeft + col1 + col2 + col3 - 8, tableTop - 16, { font: 'F2', size: 9, color: white, align: 'right' });

    for (let i = 0; i < rows.length; i += 1) {
      const rowY = tableTop - (i + 1) * rowHeight;
      line(tableLeft, rowY, tableLeft + col1 + col2 + col3, rowY, border);
      text(this.truncate(rows[i][0], 30), tableLeft + 8, rowY - 16, { font: i >= rows.length - 3 ? 'F2' : 'F1', size: 9, color: ink });
      text(this.truncate(rows[i][1], 34), tableLeft + col1 + 8, rowY - 16, { size: 9, color: slate });
      text(rows[i][2], tableLeft + col1 + col2 + col3 - 8, rowY - 16, { font: i >= rows.length - 3 ? 'F2' : 'F1', size: 9, color: ink, align: 'right' });
    }

    const paymentY = 252;
    text('Payment Status', 42, paymentY, { font: 'F2', size: 10, color: slate });
    const paymentLabel = this.truncate(this.titleCase((input.paymentStatusLabel || 'pending').replace(/_/g, ' ')), 22);
    pill(paymentLabel, 132, paymentY + 2, /paid|received/i.test(paymentLabel) ? success : pending, 110);

    text(
      `This is a system-generated quotation by AUTOFLOW Fleet Operations. Valid for 7 days from date of issue. For queries contact ${input.advisorEmail || '-'}.`,
      42,
      222,
      { size: 8, color: slate }
    );

    line(42, 208, 553, 208, border, 0.8);
    text('Terms & Conditions', 42, 194, { font: 'F2', size: 9, color: ink });
    text('1. Security deposit is fully refundable upon vehicle return in original condition.', 42, 180, { size: 8, color: slate });
    text(`2. Fuel policy: ${this.truncate(input.fuelPolicy || 'Full-to-Full', 54)}.`, 42, 167, { size: 8, color: slate });
    text(`3. Extra mileage charged at ${money(input.amounts.extraMileageRate)}/km beyond included km.`, 42, 154, { size: 8, color: slate });
    text('4. Cancellation policy applies.', 42, 141, { size: 8, color: slate });

    const content = commands.join('\n');
    const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj',
      `4 0 obj ${stream} endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (const obj of objects) {
      offsets.push(pdf.length);
      pdf += `${obj}\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }

  private truncate(value: string, max: number) {
    const ascii = this.ascii(value);
    return ascii.length > max ? `${ascii.slice(0, max - 3)}...` : ascii;
  }

  private titleCase(value: string) {
    return String(value ?? '')
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private hex(value: string) {
    const normalized = value.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    const rgb = `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
    return { fill: `${rgb} rg`, stroke: `${rgb} RG` };
  }

  private ascii(value: string) {
    return String(value ?? '')
      .replace(/\u20B9/g, 'Rs ')
      .replace(/[\u2022\u00B7]/g, '-')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^\x20-\x7E]/g, ' ');
  }

  private escapePdf(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}
