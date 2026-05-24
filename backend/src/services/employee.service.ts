import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';
import { ContractType, SalaryPeriod, SalaryPaymentMethod } from '../constants';

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  position?: string;
  contractType?: ContractType;
  hireDate?: string;
  endDate?: string;
  salary?: number;
  salaryPeriod?: SalaryPeriod;
  paymentMethod?: SalaryPaymentMethod;
  emergencyContact?: string;
  emergencyPhone?: string;
  idNumber?: string;
  notes?: string;
  isActive?: boolean;
  userId?: number | null;
}

const userSelect = { select: { id: true, username: true, role: true } } as const;

// '' -> null (permet d'effacer un champ optionnel), sinon valeur trimée.
function nz(v?: string): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function toDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function listEmployees() {
  return prisma.employee.findMany({
    orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    include: { user: userSelect },
  });
}

export async function getEmployee(id: number) {
  const employee = await prisma.employee.findUnique({ where: { id }, include: { user: userSelect } });
  if (!employee) throw new AppError(404, 'VALIDATION_001', 'Employé introuvable');
  return employee;
}

// Vérifie qu'un compte de connexion existe et n'est pas déjà rattaché à un autre employé.
async function assertUserLinkable(userId: number, exceptEmployeeId?: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
  if (!user) throw new AppError(404, 'VALIDATION_001', 'Compte de connexion introuvable');
  if (user.employee && user.employee.id !== exceptEmployeeId) {
    throw new AppError(400, 'VALIDATION_001', 'Ce compte est déjà rattaché à un autre employé');
  }
}

function buildData(data: EmployeeInput) {
  return {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    phone: nz(data.phone),
    email: nz(data.email),
    address: nz(data.address),
    photoUrl: nz(data.photoUrl),
    position: nz(data.position),
    contractType: data.contractType ?? null,
    hireDate: toDate(data.hireDate),
    endDate: toDate(data.endDate),
    salary: data.salary ?? null,
    salaryPeriod: data.salaryPeriod ?? null,
    paymentMethod: data.paymentMethod ?? null,
    emergencyContact: nz(data.emergencyContact),
    emergencyPhone: nz(data.emergencyPhone),
    idNumber: nz(data.idNumber),
    notes: nz(data.notes),
    isActive: data.isActive ?? true,
    userId: data.userId ?? null,
  };
}

export async function createEmployee(data: EmployeeInput, actorId?: number) {
  if (data.userId != null) await assertUserLinkable(data.userId);
  const employee = await prisma.employee.create({ data: buildData(data), include: { user: userSelect } });
  await logAudit({
    userId: actorId,
    action: 'employe_creation',
    entityType: 'employee',
    entityId: employee.id,
    details: { name: `${employee.firstName} ${employee.lastName}`, position: employee.position, salary: employee.salary },
  });
  return employee;
}

export async function updateEmployee(id: number, data: EmployeeInput, actorId?: number) {
  await getEmployee(id);
  if (data.userId != null) await assertUserLinkable(data.userId, id);
  const employee = await prisma.employee.update({
    where: { id },
    data: buildData(data),
    include: { user: userSelect },
  });
  await logAudit({
    userId: actorId,
    action: 'employe_modification',
    entityType: 'employee',
    entityId: employee.id,
    details: { name: `${employee.firstName} ${employee.lastName}`, position: employee.position, salary: employee.salary },
  });
  return employee;
}

export async function deleteEmployee(id: number, actorId?: number) {
  const employee = await getEmployee(id);
  await prisma.employee.delete({ where: { id } });
  await logAudit({
    userId: actorId,
    action: 'employe_suppression',
    entityType: 'employee',
    entityId: id,
    details: { name: `${employee.firstName} ${employee.lastName}` },
  });
  return { id };
}
