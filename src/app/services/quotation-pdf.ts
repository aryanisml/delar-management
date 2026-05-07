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
  vehicleBrand?: string;
  vehicleModel?: string;
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
  documentTitle?: string;
  paymentSummaryTitle?: string;
  paymentSummaryLabel?: string;
  paymentSummaryLines?: string[];
  footerNote?: string;
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

type PdfColor = { fill: string; stroke: string };

@Injectable({ providedIn: 'root' })
export class QuotationPdfService {
  buildPdfBlob(input: QuotationPdfInput) {
    return new Blob([this.buildPdfBytes(input)], { type: 'application/pdf' });
  }

  buildPdfBase64(input: QuotationPdfInput) {
    const bytes = this.buildPdfBytes(input);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  downloadPdf(input: QuotationPdfInput, filename?: string) {
    const blob = this.buildPdfBlob(input);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || this.buildFileName(input.quoteReference);
    link.click();
    URL.revokeObjectURL(url);
  }

  buildFileName(quoteReference: string) {
    const safeReference = String(quoteReference || 'quotation').replace(/[^a-zA-Z0-9-_]/g, '-');
    return `${safeReference}.pdf`;
  }

  private buildPdfBytes(input: QuotationPdfInput) {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const brand = this.hex('#0f766e');
    const brandSoft = this.hex('#ccfbf1');
    const ink = this.hex('#0f172a');
    const slate = this.hex('#475569');
    const border = this.hex('#cbd5e1');
    const success = this.hex('#15803d');
    const warning = this.hex('#b45309');
    const neutral = this.hex('#64748b');
    const white = this.hex('#ffffff');
    const rows = [
      ['Daily Rate', this.money(input.amounts.dailyRate)],
      ['Days', String(Number(input.amounts.days ?? 0))],
      ['Base Cost', this.money(input.amounts.baseCost)],
      ['GST', this.money(input.amounts.gst)],
      ['Discount', input.amounts.discountAmount > 0 ? `- ${this.money(input.amounts.discountAmount)}` : this.money(0)],
      ['Final Amount', this.money(input.amounts.finalAmount)],
      ['Security Deposit', this.money(input.amounts.securityDeposit)],
      ['Advance', this.money(input.amounts.advance)],
    ];
    const paymentLines = (input.paymentSummaryLines?.length ? input.paymentSummaryLines : [
      `Status: ${input.paymentStatusLabel || 'Pending'}`,
      `Advisor: ${input.advisorName || '-'}`,
      `Contact: ${input.advisorEmail || '-'}`,
    ]).map((line) => this.ascii(line));
    const commands: string[] = [];
    const textWidth = (value: string, size: number) => this.ascii(value).length * size * 0.52;
    const rect = (x: number, y: number, width: number, height: number, stroke = border, fill?: PdfColor) => {
      commands.push(fill
        ? `${fill.fill} ${stroke.stroke} 1 w ${x} ${y} ${width} ${height} re B`
        : `${stroke.stroke} 1 w ${x} ${y} ${width} ${height} re S`);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, color = border, width = 1) => {
      commands.push(`${color.stroke} ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const text = (
      value: string,
      x: number,
      y: number,
      opts?: { font?: 'F1' | 'F2'; size?: number; color?: PdfColor; align?: 'left' | 'right' }
    ) => {
      const safe = this.escapePdf(this.ascii(value));
      const font = opts?.font || 'F1';
      const size = opts?.size || 10;
      const color = opts?.color || ink;
      const offsetX = opts?.align === 'right' ? x - textWidth(safe, size) : x;
      commands.push(`BT ${color.fill} /${font} ${size} Tf 1 0 0 1 ${offsetX} ${y} Tm (${safe}) Tj ET`);
    };
    const wrappedText = (
      value: string,
      x: number,
      startY: number,
      maxWidth: number,
      opts?: { font?: 'F1' | 'F2'; size?: number; color?: PdfColor; lineHeight?: number }
    ) => {
      const size = opts?.size || 10;
      const lineHeight = opts?.lineHeight || size + 4;
      const lines = this.wrapText(value, maxWidth, size);
      lines.forEach((item, index) => text(item, x, startY - index * lineHeight, opts));
      return lines.length * lineHeight;
    };
    const badgeColor = /paid/i.test(input.paymentSummaryLabel || input.paymentStatusLabel)
      ? success
      : /pending/i.test(input.paymentSummaryLabel || input.paymentStatusLabel)
        ? warning
        : neutral;

    text(`${input.companyName} ${input.companySubtitle}`.trim(), margin, 804, { font: 'F2', size: 22, color: brand });
    text(input.documentTitle || 'QUOTATION', pageWidth - margin, 804, { font: 'F2', size: 20, color: brand, align: 'right' });
    text(`Quote Reference: ${input.quoteReference}`, margin, 786, { size: 10, color: slate });
    text(`Booking ID: ${input.bookingId}`, pageWidth - margin, 786, { size: 10, color: slate, align: 'right' });
    line(margin, 774, pageWidth - margin, 774, brand, 1.2);

    const metaTop = 726;
    const metaWidth = 122;
    [
      ['Issue Date', input.issueDate],
      ['Valid Until', input.validUntil],
      ['Advisor', input.advisorName],
      ['Advisor Email', input.advisorEmail],
    ].forEach(([label, value], index) => {
      const x = margin + index * 128;
      rect(x, metaTop, metaWidth, 36, border, brandSoft);
      text(label, x + 8, metaTop + 23, { font: 'F2', size: 8, color: slate });
      text(this.truncate(value, 24), x + 8, metaTop + 10, { size: 9, color: ink });
    });

    const sectionHeader = (title: string, x: number, y: number, width: number) => {
      rect(x, y, width, 18, brand, brandSoft);
      text(title, x + 8, y + 5, { font: 'F2', size: 10, color: brand });
    };

    rect(margin, 570, 246, 132, border);
    rect(margin + 265, 570, 246, 132, border);
    sectionHeader('Customer', margin, 684, 246);
    sectionHeader('Vehicle', margin + 265, 684, 246);

    let customerY = 663;
    [
      ['Name', input.customerName],
      ['Mobile', input.customerMobile],
      ['Email', input.customerEmail || '-'],
      ['Licence', input.customerLicenseNo || '-'],
      ['Type', this.titleCase(input.customerType || '-')],
    ].forEach(([label, value]) => {
      text(`${label}:`, margin + 8, customerY, { font: 'F2', size: 9, color: slate });
      wrappedText(this.truncate(value, 32), margin + 66, customerY, 160, { size: 9, color: ink, lineHeight: 11 });
      customerY -= 20;
    });

    let vehicleY = 663;
    [
      ['Brand', input.vehicleBrand || input.vehicleName.split(' ')[0] || '-'],
      ['Model', input.vehicleModel || input.vehicleName.replace(`${input.vehicleBrand || input.vehicleName.split(' ')[0] || ''}`, '').trim() || input.vehicleName || '-'],
      ['Fuel', input.vehicleFuelType || '-'],
      ['Transmission', input.vehicleTransmission || '-'],
      ['Year', input.vehicleYear || '-'],
    ].forEach(([label, value]) => {
      text(`${label}:`, margin + 273, vehicleY, { font: 'F2', size: 9, color: slate });
      wrappedText(this.truncate(value, 28), margin + 346, vehicleY, 150, { size: 9, color: ink, lineHeight: 11 });
      vehicleY -= 20;
    });

    rect(margin, 468, contentWidth, 84, border);
    sectionHeader('Trip', margin, 534, contentWidth);
    wrappedText(`Pickup Location: ${input.pickupLocation}`, margin + 8, 514, 250, { size: 9, color: ink });
    wrappedText(`Drop Location: ${input.dropLocation}`, margin + 8, 494, 250, { size: 9, color: slate });
    wrappedText(`Pickup Date: ${input.pickupDateTime}`, margin + 270, 514, 230, { size: 9, color: ink });
    wrappedText(`Drop Date: ${input.dropDateTime}`, margin + 270, 494, 230, { size: 9, color: slate });
    wrappedText(`Purpose: ${input.purpose}`, margin + 8, 474, 250, { size: 9, color: slate });
    wrappedText(`Duration: ${input.durationLabel} | Passengers: ${input.passengers}`, margin + 270, 474, 230, { size: 9, color: slate });

    const tableTop = 440;
    const tableWidth = contentWidth;
    const labelWidth = 320;
    const amountWidth = tableWidth - labelWidth;
    const rowHeight = 24;
    rect(margin, tableTop - rowHeight * (rows.length + 1), tableWidth, rowHeight * (rows.length + 1), border);
    rect(margin, tableTop - rowHeight, tableWidth, rowHeight, brand, brand);
    line(margin + labelWidth, tableTop, margin + labelWidth, tableTop - rowHeight * (rows.length + 1), border);
    text('Cost Item', margin + 8, tableTop - 16, { font: 'F2', size: 9, color: white });
    text('Amount', margin + tableWidth - 8, tableTop - 16, { font: 'F2', size: 9, color: white, align: 'right' });

    rows.forEach(([label, value], index) => {
      const rowY = tableTop - rowHeight * (index + 1);
      line(margin, rowY, margin + tableWidth, rowY, border);
      text(label, margin + 8, rowY - 16, { font: /Final Amount|Security Deposit|Advance/.test(label) ? 'F2' : 'F1', size: 9, color: ink });
      text(value, margin + tableWidth - 8, rowY - 16, { font: /Final Amount|Security Deposit|Advance/.test(label) ? 'F2' : 'F1', size: 9, color: ink, align: 'right' });
    });

    const paymentBoxY = 124;
    rect(margin, paymentBoxY, contentWidth, 96, border);
    sectionHeader(input.paymentSummaryTitle || 'Payment Summary', margin, paymentBoxY + 78, contentWidth);
    rect(margin + 8, paymentBoxY + 49, 138, 20, badgeColor, badgeColor);
    text(input.paymentSummaryLabel || input.paymentStatusLabel || 'Pending', margin + 16, paymentBoxY + 55, { font: 'F2', size: 9, color: white });
    let paymentY = paymentBoxY + 38;
    paymentLines.slice(0, 3).forEach((item) => {
      wrappedText(item, margin + 8, paymentY, contentWidth - 16, { size: 9, color: slate, lineHeight: 12 });
      paymentY -= 18;
    });

    line(margin, 102, pageWidth - margin, 102, border, 0.8);
    wrappedText(
      input.footerNote || 'System generated by AUTOFLOW Fleet Operations',
      margin,
      86,
      contentWidth,
      { size: 8, color: slate, lineHeight: 10 }
    );
    wrappedText(
      `Fuel Policy: ${input.fuelPolicy || 'Full-to-Full'} | Extra Mileage Rate: ${this.money(input.amounts.extraMileageRate)}/km`,
      margin,
      72,
      contentWidth,
      { size: 8, color: slate, lineHeight: 10 }
    );

    const streamContent = this.encoder().encode(commands.join('\n'));
    const objects = [
      this.encoder().encode('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'),
      this.encoder().encode('2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n'),
      this.encoder().encode('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n'),
      this.encoder().encode(`4 0 obj << /Length ${streamContent.length} >> stream\n${commands.join('\n')}\nendstream endobj\n`),
      this.encoder().encode('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n'),
      this.encoder().encode('6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n'),
    ];

    const header = this.encoder().encode('%PDF-1.4\n');
    const chunks: Uint8Array[] = [header];
    const offsets: number[] = [];
    let cursor = header.length;
    objects.forEach((objectBytes) => {
      offsets.push(cursor);
      chunks.push(objectBytes);
      cursor += objectBytes.length;
    });

    const xref = this.encoder().encode(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join('')}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`
    );
    chunks.push(xref);

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytes = new Uint8Array(totalLength);
    let pointer = 0;
    chunks.forEach((chunk) => {
      bytes.set(chunk, pointer);
      pointer += chunk.length;
    });
    return bytes;
  }

  private wrapText(value: string, maxWidth: number, size: number) {
    const words = this.ascii(value).split(/\s+/).filter(Boolean);
    if (!words.length) {
      return ['-'];
    }

    const lines: string[] = [];
    let current = '';
    const widthOf = (line: string) => line.length * size * 0.52;

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (widthOf(next) <= maxWidth || !current) {
        current = next;
        return;
      }
      lines.push(current);
      current = word;
    });

    if (current) {
      lines.push(current);
    }
    return lines.slice(0, 3).map((line) => this.truncate(line, 72));
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

  private money(value: number) {
    return `Rs ${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
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

  private encoder() {
    return new TextEncoder();
  }
}
