import { jsPDF } from 'jspdf';
import { GAILAN_SIG_BASE64 } from '../signature';

interface WorkOrderData {
  storeNumber: string;
  woNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  storePhone: string;
  serviceDate: string;
  technician: string;
  startTime: string;
  stopTime: string;
  serviceCompletedDate?: string;
}

export function generateWorkOrderPDF(data: WorkOrderData): jsPDF {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const rightEdge = pageWidth - margin;
  const black = '#000000';
  const lineColor = '#000000';
  let y = 36;

  // âââ HEADER LEFT: Company info âââ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(black);
  doc.text('SUPERCLEAN SERVICE COMPANY, INC', margin, y);
  y += 12;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Super Service, Super Reliable, Super Clean', margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('PO Box 551802', margin, y);
  y += 10;
  doc.text('Dallas, TX 75355', margin, y);
  y += 10;
  doc.text('P: 888-337-8737', margin, y);
  y += 10;
  doc.text('Fax: 972-926-9733', margin, y);

  // âââ HEADER RIGHT: WO # and store info âââ
  const rightCol = pageWidth * 0.48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`WO # ${data.woNumber}`, rightEdge, 38, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let rY = 56;
  doc.text('SERVICE: Pressure Wash Patio/Sidewalk/Drive Thru', rightCol, rY);
  rY += 13;
  doc.text(`Starbucks # ${data.storeNumber}`, rightCol, rY);
  rY += 11;
  doc.setFont('helvetica', 'normal');
  doc.text(data.address, rightCol, rY);
  rY += 11;
  doc.text(`${data.city}, ${data.state} ${data.zip}`, rightCol, rY);
  rY += 11;
  if (data.storePhone) {
    doc.text(data.storePhone, rightCol, rY);
  }

  y += 20;

  // âââ SERVICE DATE / WORKTASK / IVR TABLE âââ
  const tableTop = y;
  const tableHeight = 32;
  const col1W = (pageWidth - margin * 2) * 0.35;
  const col2W = (pageWidth - margin * 2) * 0.38;
  const col3W = (pageWidth - margin * 2) * 0.27;

  // Draw table borders
  doc.setDrawColor(lineColor);
  doc.setLineWidth(0.75);

  // Header row (dark fill)
  doc.setFillColor('#333333');
  doc.rect(margin, tableTop, col1W, 14, 'FD');
  doc.rect(margin + col1W, tableTop, col2W, 14, 'FD');
  doc.rect(margin + col1W + col2W, tableTop, col3W, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor('#FFFFFF');
  doc.text('SERVICE DATE', margin + 4, tableTop + 10);
  doc.text('AUTHORIZED STARBUCKS WORKTASK#', margin + col1W + 4, tableTop + 10);
  doc.text('IVR INSTRUCTIONS', margin + col1W + col2W + 4, tableTop + 10);

  // Data row
  doc.setTextColor(black);
  const dataRowY = tableTop + 14;
  doc.rect(margin, dataRowY, col1W, tableHeight - 14, 'S');
  doc.rect(margin + col1W, dataRowY, col2W, tableHeight - 14, 'S');
  doc.rect(margin + col1W + col2W, dataRowY, col3W, tableHeight - 14, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const formattedServiceDate = formatDateFull(data.serviceDate);
  doc.text(formattedServiceDate, margin + 4, dataRowY + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(data.woNumber, margin + col1W + 4, dataRowY + 12);
  doc.text('No IVR needed', margin + col1W + col2W + 4, dataRowY + 12);

  y = tableTop + tableHeight + 12;

  // âââ SERVICE LINE âââ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Pressure Wash Patio/Sidewalk/Drive Thru', margin, y);
  doc.text('COMPLETE_____X_____', rightEdge - 140, y);
  y += 16;

  // âââ INSTRUCTIONS PARAGRAPH âââ
  doc.setDrawColor(lineColor);
  doc.setLineWidth(0.5);
  const instrBoxTop = y;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(black);

  const instrText =
    'Crew to perform pressure wash of patio, sidewalks around all sides and rear of building, back door pad, and drive-thru for Starbucks\'s restaurants. ' +
    'Service window starts 1 hour after closing, finishes 2 hours before opening. Most stores are open 5AM-9PM on weekdays and close at 10PM/11PM on weekends. Store may not ' +
    'have an operational outside water spigot. Crew must be prepared to provide water via a water tank.  Crews must ensure compliance with all jurisdictional ' +
    'requirements. Chemicals used must be "Green" and not harmful. All personnel must wear appropriate PPE, including gloves, safety goggles, ear protection, and ' +
    'non-slip footwear.  Drive thru cleaned 30\' before drive to 10\' after the service window. Pictures are required for payment with a 5 photo minimum, 2 before & ' +
    'after pictures, 1 picture of the front door area with address on it. Report back to Account Manager if there are any safety/security issues noted during services.';

  const instrLines = doc.splitTextToSize(instrText, pageWidth - margin * 2 - 8);
  doc.text(instrLines, margin + 4, y + 10);

  const instrBoxHeight = instrLines.length * 8 + 16;
  doc.rect(margin, instrBoxTop - 4, pageWidth - margin * 2, instrBoxHeight, 'S');

  y = instrBoxTop + instrBoxHeight + 16;

  // âââ PHOTO WARNING âââ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(black);

  // Two columns for photo warning
  const photoCol1 = margin;
  const photoCol2 = pageWidth / 2 + 10;

  doc.text('IMPORTANT! 5 PHOTOS ARE REQUIRED FOR PAYMENT', photoCol1, y);
  doc.text('OF SERVICES ! TWO AREAS  OF PHOTOS', photoCol2, y);
  y += 12;
  doc.text('THAT HAVE BEFORE AND AFTER  TAKEN AND 1 PHOTO', photoCol1, y);
  doc.text('TAKEN OF FRONT DOOR WITH ADDRESS', photoCol2, y);
  y += 18;

  // âââ DIVIDER âââ
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 14;

  // âââ TECHNICIAN COMPLETION CHECKLIST âââ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Technician Completion Checklist', margin, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Complete all applicable items below.', margin, y);
  y += 16;

  const checklistItems = [
    'Remember, respectful conduct is a MUST!',
    'Bring WO and Photo ID to service.',
    'Pre treat all heavy stains using "Green" chemicals',
    'Remove tables and chairs & replace after service',
    'Sidewalks, patio, and backdoor pad power washed',
    'Take before and after photos (5 minimum required)',
    'Make sure  wastewater properly disposed of',
    'Wipe down windows of any over spray',
    'Photos sent to   Starbucks@gosuperclean.com',
  ];

  for (const item of checklistItems) {
    doc.text('_X_', margin, y);
    doc.text(item, margin + 22, y);
    y += 12;
  }

  y += 12;

  // âââ COMPLETION FIELDS âââ
  const fieldLineWidth = 200;
  const fieldLabelX = margin;
  const fieldLineX = margin + 95;

  const completedDate = data.serviceCompletedDate ? formatDateShort(data.serviceCompletedDate) : formatDateShort(data.serviceDate);
  const techName = data.technician || 'Rolling Suds of Westchester-Stamford';
  const startFormatted = formatTime(data.startTime);
  const stopFormatted = formatTime(data.stopTime);
  const totalHrs = calculateHours(data.startTime, data.stopTime);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Date Completed
  doc.text('Date Completed:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);
  if (completedDate) doc.text(completedDate, fieldLineX + 4, y);
  y += 14;

  // Technician
  doc.text('Technician:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);
  doc.text(techName, fieldLineX + 4, y);
  y += 14;

  // Start Time
  doc.text('Start Time:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);
  if (startFormatted) doc.text(startFormatted, fieldLineX + 4, y);
  y += 14;

  // Stop Time
  doc.text('Stop Time:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);
  if (stopFormatted) doc.text(stopFormatted, fieldLineX + 4, y);
  y += 14;

  // Total Hours
  doc.text('Total Hours:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);
  if (totalHrs) doc.text(totalHrs, fieldLineX + 4, y);
  y += 22;

  // âââ TECH SIGNATURE âââ
  doc.text('Tech Signature:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);

  // Render vector signature on the line
  const sigTargetWidth = 140;
  const sigTargetHeight = (SIG_NH / SIG_NW) * sigTargetWidth;
  const sigX = fieldLineX + 8;
  const sigY = y - sigTargetHeight + 2; // position so signature sits ON the line
  const scaleX = sigTargetWidth / SIG_NW;
  const scaleY = sigTargetHeight / SIG_NH;

  doc.setFillColor('#1a1a2e');
  for (const [sx, sy, sw] of SIG_SEGS) {
    doc.rect(
      sigX + sx * scaleX,
      sigY + sy * scaleY,
      sw * scaleX,
      scaleY,
      'F'
    );
  }

  y += 30;

  // âââ FOOTER âââ
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Technician:', margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Fax this signed work order to Superclean no more than 24 hours after service completion to avoid penalty', margin, y);
  y += 10;
  doc.text('Work orders received more than 30 days after service will not be considered valid', margin, y);

  return doc;
}

function formatDateFull(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const year = d.getFullYear();
    return `${day} ${month}/${date}/${year} 12:00 AM`;
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function calculateHours(start: string, stop: string): string {
  if (!start || !stop) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = stop.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin < startMin) endMin += 24 * 60; // overnight
  const diff = endMin - startMin;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hours}h ${mins}m`;
}
