import { prisma } from '../config/prisma';
import { basePrisma } from '../config/prisma';
import { getTenantIdOrThrow } from '../config/tenant-context';
import { AppError } from '../utils/errors';

// --- Tenant (restaurant) ---

export async function listMine() {
  const restaurantId = getTenantIdOrThrow();
  // Le prisma scopé injecte restaurantId automatiquement, le where explicite est une sécurité.
  return prisma.catalogRequest.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createRequest(
  input: { platforms: string[]; message?: string },
  createdBy?: number,
) {
  if (!input.platforms || input.platforms.length === 0) {
    throw new AppError(400, 'CATALOG_003', 'Choisissez au moins une plateforme');
  }

  const restaurantId = getTenantIdOrThrow();

  // Éviter les doublons : refuser si une demande pending ou in_progress existe déjà.
  const existing = await prisma.catalogRequest.findFirst({
    where: { restaurantId, status: { in: ['pending', 'in_progress'] } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'CATALOG_002', 'Une demande est déjà en cours pour ce restaurant');
  }

  // L'extension tenant injecte restaurantId dans le create.
  return prisma.catalogRequest.create({
    data: {
      platforms: input.platforms,
      message: input.message,
      createdBy,
    },
  });
}

// --- Super-admin (basePrisma) ---

export async function listAll(filter?: { status?: string }) {
  return basePrisma.catalogRequest.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      restaurant: {
        select: { id: true, name: true, slug: true, status: true },
      },
      creator: {
        select: { displayName: true, email: true },
      },
    },
  });
}

export async function setStatus(id: number, status: string, adminNote?: string) {
  const existing = await basePrisma.catalogRequest.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError(404, 'CATALOG_001', 'Demande introuvable');
  }

  return basePrisma.catalogRequest.update({
    where: { id },
    data: {
      status,
      adminNote: adminNote !== undefined ? adminNote : undefined,
      processedAt: status === 'pending' ? null : new Date(),
    },
  });
}
