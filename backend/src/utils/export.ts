import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DashboardData, FinancialReport, ProductReport } from '../services/stats.service';
import { PayslipResult, PayslipLine, DisaRow } from '../services/payroll.service';

const GOLD = '#B8902A'; // or assombri : meilleur contraste à l'impression que #D4AF37
const GREY = '#666666';
const LINE = '#dddddd';

// Montant FCFA façon « 3 500 FCFA » / « -84 000 FCFA » (espace comme séparateur de milliers).
function fcfa(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  return `${sign}${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

const shortDate = (d: Date) => format(d, 'dd/MM/yyyy', { locale: fr });
const longDate = (d: Date) => format(d, 'd MMMM yyyy', { locale: fr });
const periodLabel = (r: { start: Date; end: Date }) => `du ${longDate(r.start)} au ${longDate(r.end)}`;

const CAT_LABELS: Record<string, string> = {
  approvisionnement: 'Achats cuisine / stock',
  électricité: 'Électricité',
  eau: 'Eau',
  loyer: 'Loyer',
  internet: 'Internet',
  abonnement: 'Abonnement',
  salaire: 'Salaires',
  prime: 'Primes',
  charges_sociales: 'Charges sociales',
  équipement: 'Équipement',
  entretien: 'Entretien',
  transport: 'Transport',
  nettoyage: 'Nettoyage',
  marketing: 'Marketing',
  taxes: 'Taxes',
  frais_bancaires: 'Frais bancaires',
  autre: 'Autre',
};
const catLabel = (c: string) => CAT_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

// ─────────────────────────────────────────────────────────────────────────────
// CSV (ouverture Excel / tableur) — mêmes sections que le PDF.
// ─────────────────────────────────────────────────────────────────────────────
function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard (rapport résumé sur plage de dates libres) — CSV + PDF.
// ─────────────────────────────────────────────────────────────────────────────

export function dashboardToCsv(data: DashboardData, label: string): string {
  const lines: string[] = [];
  lines.push(`Rapport,${label}`);
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
  return lines.join('\n');
}

export function streamDashboardPdf(res: Response, data: DashboardData, label: string): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const fileLabel = label.replace(/[^a-zA-Z0-9_\-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-${fileLabel}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text('Dashboard', { align: 'center' });
  doc.fontSize(12).fillColor('#666').text(`Rapport - ${label}`, { align: 'center' });
  doc.fillColor('#000').moveDown();
  doc.text(`Genere le ${new Date().toLocaleString('fr-FR')}`);
  doc.moveDown();

  doc.fontSize(14).text('Indicateurs clés');
  doc.fontSize(11);
  doc.text(`Ventes totales : ${data.totalSales} FCFA`);
  doc.text(`Nombre de commandes : ${data.totalOrders}`);
  doc.text(`Ticket moyen : ${data.averageTicket} FCFA`);
  doc.text(`Heure de pointe : ${data.peakHour}`);
  doc.moveDown();

  if (data.topDishes.length) {
    doc.fontSize(14).text('Top plats');
    doc.fontSize(11);
    data.topDishes.forEach((d, i) => {
      doc.text(`${i + 1}. ${d.name} — ${d.revenue} FCFA (${d.quantity} cmd, ${d.percentage}%)`);
    });
  }

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF helpers — layout
// ─────────────────────────────────────────────────────────────────────────────

interface Cell {
  text: string;
  x: number;
  width: number;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
}

function drawRow(doc: PDFKit.PDFDocument, cells: Cell[], header = false): void {
  const pad = 6;
  let h = 0;
  for (const c of cells) {
    doc.font(c.bold || header ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    h = Math.max(h, doc.heightOfString(c.text, { width: c.width, align: c.align ?? 'left' }));
  }
  if (doc.y + h + pad > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const top = doc.y;
  for (const c of cells) {
    doc.font(c.bold || header ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(header ? GREY : '#000');
    doc.text(c.text, c.x, top, { width: c.width, align: c.align ?? 'left' });
  }
  doc.y = top + h + pad;
  doc
    .moveTo(doc.page.margins.left, doc.y - pad / 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y - pad / 2)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  if (doc.y + 30 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text(text);
  doc.moveDown(0.3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport financier sur une plage de dates — CSV.
// ─────────────────────────────────────────────────────────────────────────────

export function financialReportToCsv(r: FinancialReport): string {
  const L: string[] = [];
  L.push(`Rapport financier,${escapeCsv(r.restaurantName)}`);
  L.push(`Période,${escapeCsv(periodLabel(r))}`);
  L.push('');

  L.push('1. Dépenses enregistrées');
  L.push('Date,Désignation,Catégorie,Montant (FCFA)');
  r.expenses.forEach((e) =>
    L.push(`${shortDate(e.date)},${escapeCsv(e.label)},${escapeCsv(catLabel(e.category))},${Math.round(e.amount)}`)
  );
  L.push(`,,Total dépenses,${Math.round(r.totalExpenses)}`);
  L.push('');

  L.push('2. Recettes enregistrées');
  L.push('Date,Chiffre d\'affaires (FCFA),Commandes');
  r.revenues.forEach((v) => L.push(`${shortDate(v.date)},${Math.round(v.amount)},${v.orders}`));
  L.push(`,Total recettes,${Math.round(r.totalRevenue)}`);
  L.push('');

  L.push('3. Résultat financier');
  L.push('Élément,Montant (FCFA)');
  L.push(`Total des recettes,${Math.round(r.totalRevenue)}`);
  L.push(`Total des dépenses,${-Math.round(r.totalExpenses)}`);
  L.push(`Bénéfice provisoire (caisse),${Math.round(r.simpleProfit)}`);
  L.push(`Bénéfice net (coût matière + pertes + charges),${Math.round(r.netProfit)}`);
  L.push(`  dont coût matière,${Math.round(r.cogs)}`);
  L.push(`  dont pertes valorisées,${Math.round(r.lossValue)}`);
  L.push(`  dont charges (hors achats),${Math.round(r.charges)}`);
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport financier — PDF (sections 1 à 4 + conclusion).
// ─────────────────────────────────────────────────────────────────────────────

export function streamFinancialReportPdf(res: Response, r: FinancialReport): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="rapport-financier.pdf"');
  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const fullWidth = right - left;

  // En-tête
  doc.font('Helvetica-Bold').fontSize(22).fillColor(GOLD).text('RAPPORT FINANCIER', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#000').text(r.restaurantName, { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor(GREY).text(`Période : ${periodLabel(r)}`, { align: 'center' });
  doc.fontSize(8).fillColor(GREY).text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, {
    align: 'center',
  });
  doc.moveDown(0.5);

  // 1. Dépenses
  sectionTitle(doc, '1. Dépenses enregistrées');
  const cDate = { x: left, width: 70 };
  const cLabel = { x: left + 75, width: 355 };
  const cAmount = { x: right - 90, width: 90, align: 'right' as const };
  if (r.expenses.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(GREY).text('Aucune dépense sur la période.');
  } else {
    drawRow(
      doc,
      [
        { text: 'Date', ...cDate },
        { text: 'Désignation', ...cLabel },
        { text: 'Montant', ...cAmount },
      ],
      true
    );
    for (const e of r.expenses) {
      drawRow(doc, [
        { text: shortDate(e.date), ...cDate },
        { text: e.label, ...cLabel },
        { text: fcfa(e.amount), ...cAmount },
      ]);
    }
  }
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`Total Dépenses : ${fcfa(r.totalExpenses)}`, left, doc.y, {
    width: fullWidth,
    align: 'right',
  });

  // 2. Recettes
  sectionTitle(doc, '2. Recettes enregistrées');
  const rDate = { x: left, width: 200 };
  const rAmount = { x: right - 200, width: 200, align: 'right' as const };
  if (r.revenues.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(GREY).text('Aucune recette sur la période.');
  } else {
    drawRow(
      doc,
      [
        { text: 'Date', ...rDate },
        { text: "Chiffre d'affaires", ...rAmount },
      ],
      true
    );
    for (const v of r.revenues) {
      drawRow(doc, [
        { text: shortDate(v.date), ...rDate },
        { text: fcfa(v.amount), ...rAmount },
      ]);
    }
  }
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`Total Recettes : ${fcfa(r.totalRevenue)}`, left, doc.y, {
    width: fullWidth,
    align: 'right',
  });

  // 3. Résultat
  sectionTitle(doc, '3. Résultat financier');
  const resLine = (label: string, value: string, bold = false) => {
    const top = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor('#000');
    doc.text(label, left, top, { width: fullWidth - 150 });
    doc.text(value, right - 150, top, { width: 150, align: 'right' });
    doc.y = top + 16;
  };
  resLine('Total des recettes', fcfa(r.totalRevenue));
  resLine('Total des dépenses', fcfa(-r.totalExpenses));
  doc.moveDown(0.2);
  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.3);
  const profitColor = r.simpleProfit >= 0 ? '#137333' : '#b00020';
  const topP = doc.y;
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text('BÉNÉFICE PROVISOIRE (caisse)', left, topP, {
    width: fullWidth - 160,
  });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(profitColor).text(fcfa(r.simpleProfit), right - 160, topP, {
    width: 160,
    align: 'right',
  });
  doc.y = topP + 20;
  doc.font('Helvetica').fontSize(9).fillColor(GREY).text('Recettes moins total des dépenses (achats cuisine inclus).', left);
  doc.moveDown(0.4);
  resLine('Bénéfice net (coût matière + pertes + charges)', fcfa(r.netProfit), true);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(GREY)
    .text(
      `Détail net : coût matière ${fcfa(r.cogs)} · pertes ${fcfa(r.lossValue)} · charges ${fcfa(r.charges)} · achats stock ${fcfa(
        r.stockPurchases
      )}.`,
      left,
      doc.y,
      { width: fullWidth }
    );

  // 4. Observations
  sectionTitle(doc, '4. Observations');
  doc.font('Helvetica').fontSize(10).fillColor('#000');
  const bullets: string[] = [];
  if (r.bestDays.length) {
    bullets.push(
      'Meilleures journées : ' + r.bestDays.map((d) => `${shortDate(d.date)} (${fcfa(d.amount)})`).join(', ') + '.'
    );
  }
  if (r.topDishes.length) {
    bullets.push('Ventes principalement portées par : ' + r.topDishes.map((d) => d.name).join(', ') + '.');
  }
  if (r.topExpenseCategories.length) {
    bullets.push(
      'Charges principales : ' +
        r.topExpenseCategories.slice(0, 4).map((c) => `${catLabel(c.category)} (${fcfa(c.amount)})`).join(', ') +
        '.'
    );
  }
  if (bullets.length === 0) bullets.push('Pas assez de données sur la période pour dégager des tendances.');
  for (const b of bullets) {
    doc.text('•  ' + b, left, doc.y, { width: fullWidth });
    doc.moveDown(0.3);
  }

  // Conclusion
  sectionTitle(doc, 'Conclusion');
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#000')
    .text(
      `Sur la période ${periodLabel(r)}, ${r.restaurantName} a réalisé un chiffre d'affaires total de ` +
        `${fcfa(r.totalRevenue)} pour des dépenses enregistrées de ${fcfa(r.totalExpenses)}, ` +
        `soit un bénéfice provisoire estimé à ${fcfa(r.simpleProfit)}.`,
      left,
      doc.y,
      { width: fullWidth, align: 'justify' }
    );

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport des ventes par produit — CSV.
// ─────────────────────────────────────────────────────────────────────────────
export function productReportToCsv(r: ProductReport): string {
  const L: string[] = [];
  L.push(`Rapport ventes par produit,${escapeCsv(r.restaurantName)}`);
  L.push(`Période,${escapeCsv(periodLabel(r))}`);
  L.push('');

  L.push('Catégorie,Produit,Quantité,Chiffre généré (FCFA)');
  for (const c of r.categories) {
    for (const p of c.products) {
      L.push(`${escapeCsv(catLabel(c.category))},${escapeCsv(p.name)},${p.quantity},${Math.round(p.revenue)}`);
    }
    L.push(`${escapeCsv(catLabel(c.category))},Sous-total,${c.quantity},${Math.round(c.revenue)}`);
  }
  L.push('');

  L.push('Analyse par catégorie');
  L.push('Catégorie,Quantité,Chiffre généré (FCFA)');
  for (const c of r.categories) {
    L.push(`${escapeCsv(catLabel(c.category))},${c.quantity},${Math.round(c.revenue)}`);
  }
  L.push(`Total,${r.totalQuantity},${Math.round(r.totalRevenue)}`);
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport des ventes par produit — PDF.
// ─────────────────────────────────────────────────────────────────────────────
export function streamProductReportPdf(res: Response, r: ProductReport): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="rapport-produits.pdf"');
  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const fullWidth = right - left;

  // En-tête
  doc.font('Helvetica-Bold').fontSize(20).fillColor(GOLD).text('RAPPORT DES VENTES PAR PRODUIT', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#000').text(r.restaurantName, { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor(GREY).text(`Période : ${periodLabel(r)}`, { align: 'center' });
  doc.fontSize(8).fillColor(GREY).text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, {
    align: 'center',
  });
  doc.moveDown(0.5);

  // Colonnes des tableaux produits.
  const pName = { x: left, width: 300 };
  const pQty = { x: left + 305, width: 90, align: 'right' as const };
  const pRev = { x: right - 110, width: 110, align: 'right' as const };

  if (r.categories.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(GREY).text('Aucune vente sur la période.');
    doc.end();
    return;
  }

  // Une section par catégorie (triée par revenu décroissant).
  r.categories.forEach((c, i) => {
    sectionTitle(doc, `${i + 1}. ${catLabel(c.category)}`);
    drawRow(
      doc,
      [
        { text: 'Produit', ...pName },
        { text: 'Quantité', ...pQty },
        { text: 'Chiffre généré', ...pRev },
      ],
      true
    );
    for (const p of c.products) {
      drawRow(doc, [
        { text: p.name, ...pName },
        { text: String(p.quantity), ...pQty },
        { text: fcfa(p.revenue), ...pRev },
      ]);
    }
    doc.moveDown(0.2);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#000')
      .text(`Sous-total ${catLabel(c.category)} : ${fcfa(c.revenue)} (${c.quantity})`, left, doc.y, {
        width: fullWidth,
        align: 'right',
      });
  });

  // Analyse par catégorie.
  sectionTitle(doc, 'Analyse par catégorie');
  const aCat = { x: left, width: 300 };
  const aQty = { x: left + 305, width: 90, align: 'right' as const };
  const aRev = { x: right - 110, width: 110, align: 'right' as const };
  drawRow(
    doc,
    [
      { text: 'Catégorie', ...aCat },
      { text: 'Quantité', ...aQty },
      { text: 'Chiffre généré', ...aRev },
    ],
    true
  );
  for (const c of r.categories) {
    drawRow(doc, [
      { text: catLabel(c.category), ...aCat },
      { text: String(c.quantity), ...aQty },
      { text: fcfa(c.revenue), ...aRev },
    ]);
  }
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`Total : ${fcfa(r.totalRevenue)} (${r.totalQuantity})`, left, doc.y, {
    width: fullWidth,
    align: 'right',
  });

  // Observations (data uniquement).
  sectionTitle(doc, 'Observations');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('Produits les plus rentables (chiffre généré) :', left);
  doc.font('Helvetica').fontSize(10).fillColor('#000');
  for (const p of r.topByRevenue) {
    doc.text(`•  ${p.name} — ${fcfa(p.revenue)} (${p.quantity})`, left, doc.y, { width: fullWidth });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('Produits à forte rotation (quantité vendue) :', left);
  doc.font('Helvetica').fontSize(10).fillColor('#000');
  for (const p of r.topByQuantity) {
    doc.text(`•  ${p.name} — ${p.quantity} vendu(s) (${fcfa(p.revenue)})`, left, doc.y, { width: fullWidth });
    doc.moveDown(0.2);
  }

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// DISA — Déclaration Individuelle des Salaires Annuels (CNPS) — CSV.
// Format reprenant les champs du fichier d'entrée e-DISA (état civil / affectation /
// salaire). À vérifier/charger dans le modèle e-DISA officiel de la CNPS.
// ─────────────────────────────────────────────────────────────────────────────
export interface DisaExport {
  employerCnpsNumber: string;
  restaurantName: string;
  year: number;
  rows: DisaRow[];
}

export function disaToCsv(data: DisaExport): string {
  const L: string[] = [];
  L.push('Déclaration Individuelle des Salaires Annuels (DISA)');
  L.push(`Employeur,${escapeCsv(data.restaurantName)}`);
  L.push(`N° employeur CNPS,${escapeCsv(data.employerCnpsNumber || '')}`);
  L.push(`Année,${data.year}`);
  L.push('');
  L.push(
    "N° immatriculation CNPS,Nom,Prénoms,Date de naissance,Date d'embauche,Date de départ,Périodicité,Nombre de mois,Salaire brut annuel (FCFA)"
  );
  for (const r of data.rows) {
    L.push(
      [
        escapeCsv(r.cnpsNumber),
        escapeCsv(r.lastName),
        escapeCsv(r.firstName),
        r.birthDate ? shortDate(r.birthDate) : '',
        r.hireDate ? shortDate(r.hireDate) : '',
        r.endDate ? shortDate(r.endDate) : '',
        escapeCsv(r.salaryPeriod ?? ''),
        r.monthsWorked,
        Math.round(r.annualGross),
      ].join(',')
    );
  }
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulletin de paie — PDF.
// ─────────────────────────────────────────────────────────────────────────────
export interface PayslipPdfData {
  restaurantName: string;
  employeeName: string;
  position: string | null;
  cnpsNumber: string | null;
  contractType: string | null;
  paymentMethod: string | null;
  periodLabel: string; // ex. « Mai 2026 »
  payslip: PayslipResult;
}

export function streamPayslipPdf(res: Response, data: PayslipPdfData): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const fileLabel = `${data.employeeName}-${data.periodLabel}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="bulletin-${fileLabel}.pdf"`);
  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const fullWidth = right - left;
  const p = data.payslip;

  // En-tête
  doc.font('Helvetica-Bold').fontSize(20).fillColor(GOLD).text('BULLETIN DE PAIE', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000').text(data.restaurantName, { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor(GREY).text(`Période : ${data.periodLabel}`, { align: 'center' });
  doc.fontSize(8).fillColor(GREY).text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, {
    align: 'center',
  });
  doc.moveDown(0.6);

  // Bloc salarié
  sectionTitle(doc, 'Salarié');
  const infoLine = (label: string, value: string) => {
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(label, left, top, { width: 150 });
    doc.font('Helvetica').fontSize(10).fillColor('#000').text(value, left + 150, top, { width: fullWidth - 150 });
    doc.y = top + 15;
  };
  infoLine('Nom & prénom', data.employeeName);
  if (data.position) infoLine('Poste', data.position);
  if (data.contractType) infoLine('Type de contrat', data.contractType);
  infoLine('N° CNPS', data.cnpsNumber || '— (non renseigné)');

  // Colonnes des tableaux de cotisations.
  const cLabel = { x: left, width: 215 };
  const cBase = { x: left + 215, width: 95, align: 'right' as const };
  const cRate = { x: left + 315, width: 70, align: 'right' as const };
  const cAmount = { x: right - 110, width: 110, align: 'right' as const };
  const dash = '—';
  const rateTxt = (l: PayslipLine) => (l.rate > 0 ? `${l.rate} %` : dash);
  const baseTxt = (l: PayslipLine) => (l.base > 0 ? fcfa(l.base) : dash);

  // Gains
  sectionTitle(doc, '1. Rémunération brute');
  drawRow(doc, [{ text: 'Salaire brut', ...cLabel }, { text: '', ...cBase }, { text: '', ...cRate }, { text: fcfa(p.grossSalary), ...cAmount }]);

  // Retenues salariales
  sectionTitle(doc, '2. Retenues salariales');
  drawRow(
    doc,
    [
      { text: 'Cotisation / impôt', ...cLabel },
      { text: 'Base', ...cBase },
      { text: 'Taux', ...cRate },
      { text: 'Montant', ...cAmount },
    ],
    true
  );
  for (const l of p.employeeLines) {
    drawRow(doc, [
      { text: l.label, ...cLabel },
      { text: baseTxt(l), ...cBase },
      { text: rateTxt(l), ...cRate },
      { text: fcfa(l.amount), ...cAmount },
    ]);
  }
  if (p.its > 0) {
    drawRow(doc, [
      { text: 'Impôt sur salaire (ITS)', ...cLabel },
      { text: fcfa(p.grossSalary), ...cBase },
      { text: 'barème', ...cRate },
      { text: fcfa(p.its), ...cAmount },
    ]);
  }
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`Total retenues : ${fcfa(p.totalEmployee)}`, left, doc.y, {
    width: fullWidth,
    align: 'right',
  });

  // Net à payer (mis en avant)
  doc.moveDown(0.4);
  const topNet = doc.y;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000').text('NET À PAYER', left, topNet, { width: fullWidth - 160 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#137333').text(fcfa(p.netSalary), right - 160, topNet, {
    width: 160,
    align: 'right',
  });
  doc.y = topNet + 22;
  if (data.paymentMethod) {
    doc.font('Helvetica').fontSize(9).fillColor(GREY).text(`Mode de paiement : ${data.paymentMethod}`, left);
  }

  // Charges patronales
  sectionTitle(doc, '3. Charges patronales (employeur)');
  drawRow(
    doc,
    [
      { text: 'Cotisation', ...cLabel },
      { text: 'Base', ...cBase },
      { text: 'Taux', ...cRate },
      { text: 'Montant', ...cAmount },
    ],
    true
  );
  for (const l of p.employerLines) {
    drawRow(doc, [
      { text: l.label, ...cLabel },
      { text: baseTxt(l), ...cBase },
      { text: rateTxt(l), ...cRate },
      { text: fcfa(l.amount), ...cAmount },
    ]);
  }
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`Total charges patronales : ${fcfa(p.totalEmployer)}`, left, doc.y, {
    width: fullWidth,
    align: 'right',
  });
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`Coût total employeur : ${fcfa(p.employerCost)}`, left, doc.y, {
    width: fullWidth,
    align: 'right',
  });

  // Mention
  doc.moveDown(0.8);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(GREY)
    .text(
      'Document indicatif généré par Restoflow. Les taux et plafonds de cotisation sont paramétrables et doivent être ' +
        'vérifiés au regard de la réglementation CNPS / DGI en vigueur.',
      left,
      doc.y,
      { width: fullWidth, align: 'justify' }
    );

  doc.end();
}
