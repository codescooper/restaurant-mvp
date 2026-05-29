import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import * as payrollService from '../services/payroll.service';
import * as employeeService from '../services/employee.service';
import { getRestaurantName } from '../services/settings.service';
import { streamPayslipPdf } from '../utils/export';

export const getPayrollConfigController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await payrollService.getPayrollConfig());
});

export const setPayrollConfigController = asyncHandler(async (req, res) => {
  sendSuccess(res, await payrollService.setPayrollConfig(req.body));
});

// Aperçu live (JSON) du calcul pour un brut donné, avec la config enregistrée.
export const payslipPreviewController = asyncHandler(async (req, res) => {
  const { grossSalary } = req.body as { grossSalary: number };
  const config = await payrollService.getPayrollConfig();
  sendSuccess(res, payrollService.computePayslip(grossSalary, config));
});

// « Mai 2026 » (1re lettre en capitale).
function periodLabel(year: number, month: number): string {
  const label = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const payslipController = asyncHandler(async (req, res) => {
  const { employeeId, year, month, grossSalary } = req.body as {
    employeeId: number;
    year: number;
    month: number;
    grossSalary?: number;
  };
  // getEmployee est tenant-scopé : un employé d'un autre restaurant renvoie 404.
  const employee = await employeeService.getEmployee(employeeId);
  const gross = grossSalary != null ? grossSalary : employee.salary ?? 0;
  if (!gross || gross <= 0) {
    throw new AppError(400, 'VALIDATION_001', 'Renseignez un salaire brut pour générer le bulletin');
  }
  const config = await payrollService.getPayrollConfig();
  const payslip = payrollService.computePayslip(gross, config);
  const restaurantName = await getRestaurantName();
  streamPayslipPdf(res, {
    restaurantName,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    position: employee.position ?? null,
    cnpsNumber: employee.cnpsNumber ?? null,
    contractType: employee.contractType ?? null,
    paymentMethod: employee.paymentMethod ?? null,
    periodLabel: periodLabel(year, month),
    payslip,
  });
});
