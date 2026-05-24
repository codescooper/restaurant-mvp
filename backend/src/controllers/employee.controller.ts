import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as employeeService from '../services/employee.service';

export const listEmployeesController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await employeeService.listEmployees());
});

export const getEmployeeController = asyncHandler(async (req, res) => {
  sendSuccess(res, await employeeService.getEmployee(Number(req.params.id)));
});

export const createEmployeeController = asyncHandler(async (req, res) => {
  sendSuccess(res, await employeeService.createEmployee(req.body, req.user?.id), 201);
});

export const updateEmployeeController = asyncHandler(async (req, res) => {
  sendSuccess(res, await employeeService.updateEmployee(Number(req.params.id), req.body, req.user?.id));
});

export const deleteEmployeeController = asyncHandler(async (req, res) => {
  sendSuccess(res, await employeeService.deleteEmployee(Number(req.params.id), req.user?.id));
});
