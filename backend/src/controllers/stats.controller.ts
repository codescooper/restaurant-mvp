import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as statsService from '../services/stats.service';
import { dashboardToCsv, streamDashboardPdf } from '../utils/export';

const PERIODS: statsService.Period[] = ['today', 'week', 'month'];

function parsePeriod(value: unknown): statsService.Period {
  return PERIODS.includes(value as statsService.Period) ? (value as statsService.Period) : 'today';
}

export const dashboardController = asyncHandler(async (req, res) => {
  const period = parsePeriod(req.query.period);
  sendSuccess(res, await statsService.getDashboard(period));
});

export const exportController = asyncHandler(async (req, res) => {
  const period = parsePeriod(req.body.period);
  const format = req.body.format === 'csv' ? 'csv' : 'pdf';
  const data = await statsService.getDashboard(period);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-${period}.csv"`);
    return res.send('﻿' + dashboardToCsv(data, period));
  }
  return streamDashboardPdf(res, data, period);
});
