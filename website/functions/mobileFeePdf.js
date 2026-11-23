const PDFDocument = require('pdfkit');
const path = require('node:path');
const money = n => `INR ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function renderFeeDocument({ school, student, invoice, receipt, logo }) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  doc.registerFont('Regular', path.join(__dirname, 'assets/PlusJakartaSans-Regular.ttf'));
  doc.registerFont('Malayalam', path.join(__dirname, 'assets/Manjari-Regular.ttf'));
  const font = value => /[\u0d00-\u0d7f]/.test(String(value)) ? 'Malayalam' : 'Regular';
  doc.font('Regular');
  const chunks = [], done = new Promise((resolve, reject) => { doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  if (logo) doc.image(logo, 48, 45, { fit: [54, 54] });
  doc.font(font(school.name)).fillColor('#0755cf').fontSize(23).text(school.name || 'School', logo ? 118 : 48, 48, { width: logo ? 425 : 490 });
  doc.font(font(school.address)).fillColor('#555e70').fontSize(10).text([school.address, school.phone, school.email].filter(Boolean).join(' | '));
  doc.font('Regular');
  doc.x = 48; doc.y = Math.max(doc.y, 105);
  doc.moveDown(1.5).fillColor('#15243c').fontSize(21).text(receipt ? 'Payment receipt' : 'Fee invoice');
  doc.fontSize(10).fillColor('#555e70').text(`${receipt?.receiptNo || invoice.no || invoice.id}    |    ${receipt?.date || invoice.issued || ''}`);
  doc.moveDown().font(font(student.name)).fillColor('#15243c').fontSize(12).text(student.name || invoice.student || 'Student');
  doc.font('Regular').fontSize(10).text([student.grn, `Grade ${student.grade || ''}${student.section ? ' - ' + student.section : ''}`, invoice.academicYear, invoice.term].filter(Boolean).join(' | '));
  if (!receipt) doc.text(`Due date: ${invoice.due || '-'}`);
  doc.moveDown(2);
  const lines = receipt ? [{ label: `Payment against ${invoice.no || invoice.id}`, amount: receipt.amount }] : invoice.lines || [];
  function header() { const y = doc.y; doc.rect(48, y - 7, 499, 27).fill('#edf3ff'); doc.fillColor('#0755cf').fontSize(10).text('DESCRIPTION', 60, y, { width: 330 }); doc.text('AMOUNT', 400, y, { width: 130, align: 'right' }); doc.y = y + 32; }
  header();
  for (const line of lines) {
    if (doc.y > 650) { doc.addPage(); header(); }
    const y = doc.y, label = String(line.label || 'School fee');
    doc.font(font(label)).fontSize(11);
    const height = Math.max(30, doc.heightOfString(label, { width: 320 }) + 14);
    doc.fillColor('#15243c').text(label, 60, y, { width: 320 });
    doc.font('Regular').text(money(line.amount), 390, y, { width: 140, align: 'right' });
    doc.moveTo(48, y + height - 7).lineTo(547, y + height - 7).strokeColor('#e5e9f0').stroke(); doc.y = y + height;
  }
  if (doc.y > 610) doc.addPage();
  doc.x = 48; doc.moveDown();
  if (!receipt) {
    const gross = lines.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    doc.fillColor('#555e70').fontSize(11).text(`Fee items: ${money(gross)}`, { align: 'right' });
    if (gross > invoice.amount) doc.text(`Concession: ${money(gross - invoice.amount)}`, { align: 'right' });
    doc.text(`Invoice total: ${money(invoice.amount)}`, { align: 'right' }).text(`Paid: ${money(invoice.paid)}`, { align: 'right' });
  }
  doc.moveDown().fontSize(16).fillColor('#0755cf').text(`${receipt ? 'Collected' : 'Balance due'}: ${money(receipt ? receipt.amount : Math.max(0, invoice.amount - (invoice.paid || 0)))}`, { align: 'right' });
  if (receipt) doc.moveDown().fontSize(10).fillColor('#555e70').text(`Payment method: ${receipt.mode || 'School collection'}`);
  doc.moveDown(2).fontSize(9).fillColor('#555e70').text('Generated from school records. Contact the school office for corrections.');
  doc.end(); return done;
}
module.exports = { renderFeeDocument };
