import { jsPDF } from 'jspdf';
import { COMPANY, SERVICE_TITLE } from '../constants';

interface InvoiceData {
  storeNumber: string;
  woNumber: string;
  invoiceNumber: string;
  price: number;
  serviceDate: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  serviceCompletedDate?: string;
}

const SHORT_DESCRIPTION =
  'Pressure wash sidewalks, patio, drive thru. Sweep debris. Apply degreaser. ' +
  'Concrete surfacer wash. After hours service. Before/after pics required. Clean ' +
  'overspray from windows.';

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const teal = '#00A4C7';
  const gray = '#888888';
  const darkGray = '#333333';
  let y = 50;

  // Header - Rolling Suds brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(teal);
  doc.text('Rolling Suds', margin, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#aaaaaa');
  doc.text('THE POWER WASHING PROFESSIONALS', margin, y);
  y += 18;

  doc.setFontSize(9);
  doc.setTextColor(darkGray);
  doc.text(COMPANY.name, margin, y);
  y += 13;
  doc.text(COMPANY.phone, margin, y);
  y += 13;
  doc.text(COMPANY.email, margin, y);

  // INVOICE title right-aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(darkGray);
  doc.text('INVOICE', pageWidth - margin, 50, { align: 'right' });

  // Meta fields right-aligned
  const metaX = pageWidth - margin;
  let metaY = 78;
  doc.setFontSize(9);

  const formattedDate = formatDateLong(data.serviceCompletedDate || data.serviceDate);

  const metaFields = [
    ['Invoice #', data.invoiceNumber || ''],
    ['Date', formattedDate],
    ['Job Type', 'Commercial'],
  ];

  for (const [label, value] of metaFields) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(gray);
    doc.text(label, metaX - 120, metaY, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray);
    doc.text(value, metaX, metaY, { align: 'right' });
    metaY += 15;
  }

  y = 140;

  // Teal divider
  doc.setDrawColor(teal);
  doc.setLineWidth(2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 25;

  // Bill To / Service Location
  const colWidth = (pageWidth - margin * 2) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkGray);
  doc.text('Bill To:', margin, y);
  doc.text('Service Location:', margin + colWidth, y);
  y += 18;

  const locationLines = [
    `Starbucks #${data.storeNumber} - WO ${data.woNumber}`,
    'Go Super Clean',
    data.address,
    `${data.city}, ${data.state} ${data.zip}`,
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#555555');

  for (const line of locationLines) {
    doc.text(line, margin, y);
    doc.text(line, margin + colWidth, y);
    y += 14;
  }

  y += 20;

  // Description Table
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const tableWidth = tableRight - tableLeft;

  // Header row
  doc.setFillColor(teal);
  doc.rect(tableLeft, y, tableWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');

  const colDesc = tableLeft + 12;
  const colQty = tableLeft + tableWidth * 0.62;
  const colPrice = tableLeft + tableWidth * 0.74;
  const colAmount = tableLeft + tableWidth * 0.88;

  doc.text('Description', colDesc, y + 16);
  doc.text('QTY', colQty, y + 16);
  doc.text('Price', colPrice, y + 16);
  doc.text('Amount', colAmount, y + 16);
  y += 24;

  // Body row with light gray background
  doc.setFillColor('#f7f7f7');
  const bodyHeight = 70;
  doc.rect(tableLeft, y, tableWidth, bodyHeight, 'F');

  // Border around table body
  doc.setDrawColor('#e0e0e0');
  doc.setLineWidth(0.5);
  doc.rect(tableLeft, y, tableWidth, bodyHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkGray);
  doc.text(SERVICE_TITLE, colDesc, y + 18);

  // Condensed description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#666666');
  const descLines = doc.splitTextToSize(SHORT_DESCRIPTION, tableWidth * 0.55);
  doc.text(descLines, colDesc, y + 34);

  // QTY, Price, Amount
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkGray);
  doc.text('1', colQty + 5, y + 18);
  doc.text(`$${data.price.toFixed(2)}`, colPrice, y + 18);
  doc.text(`$${data.price.toFixed(2)}`, colAmount, y + 18);

  y += bodyHeight + 20;

  // Totals - right aligned
  const totalsLabelX = colPrice - 5;
  const totalsValX = pageWidth - margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(gray);
  doc.text('Sub total', totalsLabelX, y, { align: 'right' });
  doc.setTextColor(darkGray);
  doc.text(`$${data.price.toFixed(2)}`, totalsValX, y, { align: 'right' });
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkGray);
  doc.text('Total', totalsLabelX, y, { align: 'right' });
  doc.text(`$${data.price.toFixed(2)}`, totalsValX, y, { align: 'right' });
  y += 20;

  doc.setTextColor(teal);
  doc.setFontSize(10);
  doc.text('Balance Due', totalsLabelX, y, { align: 'right' });
  doc.text(`$${data.price.toFixed(2)}`, totalsValX, y, { align: 'right' });

  // Bottom teal bar
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(teal);
  doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

  return doc;
}

function formatDateLong(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
