import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as statsService from '../services/stats.service';
import { dashboardToCsv, streamDashboardPdf } from '../utils/export';

export const dashboardController = asyncHandler(async (req, res) => {
  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  const range = statsService.getRangeFromDates(from, to);
  sendSuccess(res, await statsService.getDashboard(range));
});

export const exportController = asyncHandler(async (req, res) => {
  // Params depuis le body (POST) ou la query (GET / téléchargement natif).
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
