import { startOfMonth } from 'date-fns';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import * as statsService from '../services/stats.service';
import {
  financialReportToCsv,
  streamFinancialReportPdf,
  productReportToCsv,
  streamProductReportPdf,
} from '../utils/export';

const PERIODS: statsService.Period[] = ['today', 'week', 'month'];

function parsePeriod(value: unknown): statsService.Period {
  return PERIODS.includes(value as statsService.Period) ? (value as statsService.Period) : 'today';
}

// Parse une date YYYY-MM-DD (ou ISO) ; renvoie null si invalide ou absente.
function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const dashboardController = asyncHandler(async (req, res) => {
  const period = parsePeriod(req.query.period);
  sendSuccess(res, await statsService.getDashboard(period));
});

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
