import { startOfMonth } from 'date-fns';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import * as statsService from '../services/stats.service';
import {
  dashboardToCsv,
  streamDashboardPdf,
  financialReportToCsv,
  streamFinancialReportPdf,
  productReportToCsv,
  streamProductReportPdf,
} from '../utils/export';

export const dashboardController = asyncHandler(async (req, res) => {
  // Les schemas Zod (dashboardRangeSchema / exportRangeSchema) appliques en amont
  // valident le format et les bornes. Comme isoDate n'utilise pas .transform(),
  // req.query contient des chaines deja validees ; on les re-parse en Date ici.
  // Si un .transform() est ajoute aux schemas, basculer sur req.validated.
  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  const range = statsService.getRangeFromDates(from, to);
  sendSuccess(res, await statsService.getDashboard(range));
});

export const exportController = asyncHandler(async (req, res) => {
  // Params depuis le body (POST) ou la query (GET / téléchargement natif).
  // Rappel : les schemas Zod valident en amont ; voir commentaire dans dashboardController.
  const fromRaw = req.body?.from ?? req.query.from;
  const toRaw = req.body?.to ?? req.query.to;
  const formatRaw = req.body?.format ?? req.query.format;
  const from = new Date(String(fromRaw));
  const to = new Date(String(toRaw));
  const format = formatRaw === 'csv' ? 'csv' : 'pdf';
  const range = statsService.getRangeFromDates(from, to);
  const data = await statsService.getDashboard(range);
  const label = `${String(fromRaw)}_${String(toRaw)}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-${label}.csv"`);
    return res.send('﻿' + dashboardToCsv(data, label));
  }
  return streamDashboardPdf(res, data, label);
});

// Parse une date YYYY-MM-DD (ou ISO) ; renvoie null si invalide ou absente.
function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Lit la plage de dates (start/end) et le format depuis le body (POST) ou la query
// (GET / téléchargement natif du navigateur). Plage par défaut : du 1er du mois à aujourd'hui.
function parseRange(req: { query: Record<string, unknown>; body?: Record<string, unknown> }) {
  const src = { ...req.query, ...(req.body ?? {}) } as Record<string, unknown>;
  const start = parseDate(src.start) ?? startOfMonth(new Date());
  const end = parseDate(src.end) ?? new Date();
  if (start > end) throw new AppError(400, 'VALIDATION_001', 'La date de début doit précéder la date de fin');
  const format = src.format === 'csv' ? 'csv' : 'pdf';
  return { start, end, format };
}

export const reportController = asyncHandler(async (req, res) => {
  const { start, end, format } = parseRange(req);
  const report = await statsService.getFinancialReport(start, end);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-financier.csv"');
    return res.send('﻿' + financialReportToCsv(report));
  }
  return streamFinancialReportPdf(res, report);
});

export const productReportController = asyncHandler(async (req, res) => {
  const { start, end, format } = parseRange(req);
  const report = await statsService.getProductReport(start, end);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-produits.csv"');
    return res.send('﻿' + productReportToCsv(report));
  }
  return streamProductReportPdf(res, report);
});
