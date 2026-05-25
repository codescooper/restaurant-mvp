import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AuditAction } from '../constants';

interface LogAuditInput {
  userId?: number;
  action: AuditAction;
  entityType: string;
  entityId?: number;
  details?: Prisma.InputJsonValue;
}

// Journalise une action sensible. Ne doit jamais faire échouer l'action métier (§C).
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: input.details,
      },
    });
  } catch {
    // silencieux : le journal est secondaire par rapport à l'opération
  }
}

export interface AuditFilters {
  action?: string;
  userId?: number;
  entityType?: string;
  limit?: number;
}

export async function listAuditLogs(filters: AuditFilters = {}) {
  return prisma.auditLog.findMany({
    where: {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 200,
    include: { user: { select: { id: true, displayName: true } } },
  });
}
