import { jsPDF } from 'jspdf';
// Signature inlined server-side to prevent client bundle pollution
const GAILAN_SIG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAARoAAABUCAYAAABdlvgSAAAQAElEQVR4AeydCbxUVR3H/8dsM02zTYoUKpUSU8PCQBTUMqQCKjFKebghKiqKSuUSYaYhoIIarkAYouS+FFoChkuaCZmJaGq2W1aWReVy+n3P591xZu7MvFnfmxkOH8679579/s85v/927pmNLP6LFIgUiBRoMAUi0DSYwLH6SIFIAbMINHEWRApECjScAhFoGk7i2ECjKRDrb34KRKBp/jGKPYwUaHkKRKBp+SGMLxAp0PwUiEDT/GMUexgp0PIUiEDTxRDG5EiBSIHaKRCBpnYaxhoiBSIFuqBABJouCBSTIwUiBWqnQASa2mkYa4gUaG4KNEHvItA0wSDELkQKtDsFItC0+wjH94sUaAIKRKBpgkGIXYgUaHcKRKBp9xFu9PvF+iMFyqBABJoyiBSzRApECtRGgQg0tdEvlo4UiBQogwIRaMogUswSKRApUBsFmhtoanu3WDpSIFKgSSgQgaZJBiJ2I1KgnSkQgaadRze+W6RAk1AgAk2TDETsRrtSIL4XFIhAAxViiBSIFGgoBSLQNJS8sfJIgUgBKBCBBirEUBEF1q1b53/605/6igrFzBs0BSLQtPTw90znx44dayeccELPNB5bbUkKRKDRsN19993+wgsv9Fo8/qCDDvJHH320v+qqqyLHFm0K/f/Xv/5lb3jDGwolxbhIgYIU2GCBZtmyZX7IkCF+k0028YMHDzaBi82ePduuvvpqmzdvnn3xi1+0jTbayB9wwAERcLKmzuOPP+7/85//2Fve8pZM7GOPPeYXLVrkp0yZ4g899FA/btw4P2nSJD9z5kx/5513RvplKLXh3mxwQDNr1iy/2Wab+X333dfe+MY32tlnn22/+MUvmAFOf9z//vc/9/LLL7vzzjvP3vrWtwbg6dOnj3/iiSfighGBtt12W/fKK6/YHXfcYb169YImfqeddrKOjg4TbU2AY4sXL7YLLrjApk6danvttZfpn99888399OnTya/H+H9Do0AJoGkvUlx++eV+q6228hdffLGdf/75vJy7/fbb3bHHHuv69+8PyBCXCccdd5z785//7IYNG2a/+93vok1ClDnxxBP9lltu6Z955hn761//an/4wx/sHe94h+26664mScZmzJhhCxYssG9/+9uBXqNGjbK+ffuq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';

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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ HEADER LEFT: Company info Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ HEADER RIGHT: WO # and store info Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ SERVICE DATE / WORKTASK / IVR TABLE Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ SERVICE LINE Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Pressure Wash Patio/Sidewalk/Drive Thru', margin, y);
  doc.text('COMPLETE_____X_____', rightEdge - 140, y);
  y += 16;

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ INSTRUCTIONS PARAGRAPH Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ PHOTO WARNING Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DIVIDER Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 14;

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ TECHNICIAN COMPLETION CHECKLIST Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ COMPLETION FIELDS Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ TECH SIGNATURE Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  doc.text('Tech Signature:', fieldLabelX, y);
  doc.line(fieldLineX, y + 1, fieldLineX + fieldLineWidth, y + 1);

  // Render Gailan Robertson's signature — sized to fit on the line
  const sigW = 110;
  const sigH = 24;
  // Position so baseline of sig sits on the signature line
  doc.addImage(GAILAN_SIG_BASE64, 'PNG', fieldLineX + 2, y - sigH + 2, sigW, sigH);

  y += 30;

  // Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ FOOTER Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
