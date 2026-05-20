import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { DashboardData, Period } from '../services/stats.service';

const PERIOD_LABEL: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
};

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function dashboardToCsv(data: DashboardData, period: Period): string {
  const lines: string[] = [];
  lines.push(`Rapport,${PERIOD_LABEL[period]}`);
  lines.push('');
  lines.push('Indicateur,Valeur');
  lines.push(`Ventes totales (FCFA),${data.totalSales}`);
  lines.push(`Nombre de commandes,${data.totalOrders}`);
  lines.push(`Ticket moyen (FCFA),${data.averageTicket}`);
  lines.push(`Heure de pointe,${data.peakHour}`);
  lines.push('');
  lines.push('Top plats,Quantite,Revenu (FCFA),Part (%)');
  data.topDishes.forEach((d) =>
    lines.push(`${escapeCsv(d.name)},${d.quantity},${d.revenue},${d.percentage}`)
  );
  lines.push('');
  lines.push('Mode de paiement,Transactions,Montant (FCFA),Part (%)');
  data.paymentMethods.forEach((p) =>
    lines.push(`${escapeCsv(p.method)},${p.count},${p.amount},${p.percentage}`)
  );
  lines.push('');
  lines.push('Heure,Montant (FCFA),Commandes');
  data.salesByHour.forEach((s) => lines.push(`${s.hour},${s.amount},${s.orders}`));
  return lines.join('\n');
}

export function streamDashboardPdf(res: Response, data: DashboardData, period: Period): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-${period}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text('Restaurant Pilote', { align: 'center' });
  doc.fontSize(12).fillColor('#666').text(`Rapport - ${PERIOD_LABEL[period]}`, { align: 'center' });
  doc.fillColor('#000').moveDown();
  doc.text(`Genere le ${new Date().toLocaleString('fr-FR')}`);
  doc.moveDown();

  doc.fontSize(14).text('Indicateurs cles', { underline: true });
  doc.fontSize(11);
  doc.text(`Ventes totales : ${data.totalSales} FCFA`);
  doc.text(`Nombre de commandes : ${data.totalOrders}`);
  doc.text(`Ticket moyen : ${data.averageTicket} FCFA`);
  doc.text(`Heure de pointe : ${data.peakHour} (${data.peakHourSales} FCFA)`);
  doc.moveDown();

  doc.fontSize(14).text('Top plats', { underline: true });
  doc.fontSize(11);
  data.topDishes.forEach((d, i) =>
    doc.text(`${i + 1}. ${d.name} - ${d.quantity} vendus - ${d.revenue} FCFA (${d.percentage}%)`)
  );
  doc.moveDown();

  doc.fontSize(14).text('Modes de paiement', { underline: true });
  doc.fontSize(11);
  data.paymentMethods.forEach((p) =>
    doc.text(`${p.method} : ${p.count} transactions - ${p.amount} FCFA (${p.percentage}%)`)
  );

  doc.end();
}
