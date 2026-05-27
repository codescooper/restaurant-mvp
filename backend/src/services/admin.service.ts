import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';

export async function listRestaurants(filter?: { status?: string }) {
  return basePrisma.restaurant.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { dishes: true, tables: true, memberships: true, invitations: true } },
      memberships: {
        where: { role: 'propriétaire' },
        take: 1,
        include: { user: { select: { email: true, displayName: true } } },
      },
    },
  });
}

export async function activateRestaurant(id: number) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001', 'Restaurant introuvable');
  if (resto.status !== 'pending' && resto.status !== 'suspended' && resto.status !== 'rejected') {
    throw new AppError(400, 'ADMIN_001', "Statut non éligible à l'activation");
  }
  const counts = await basePrisma.$transaction(async (tx) => {
    const counts = {
      orders: await tx.order.count({ where: { restaurantId: id } }),
      stockMovements: await tx.stockMovement.count({ where: { restaurantId: id } }),
      cashSessions: await tx.cashSession.count({ where: { restaurantId: id } }),
      reservations: await tx.reservation.count({ where: { restaurantId: id } }),
      notifications: await tx.notification.count({ where: { restaurantId: id } }),
      auditLogs: await tx.auditLog.count({ where: { restaurantId: id } }),
    };
    await tx.notificationRead.deleteMany({ where: { notification: { restaurantId: id } } });
    await tx.notification.deleteMany({ where: { restaurantId: id } });
    await tx.stockMovement.deleteMany({ where: { restaurantId: id } });
    await tx.order.deleteMany({ where: { restaurantId: id } }); // cascade OrderItem
    await tx.cashSession.deleteMany({ where: { restaurantId: id } });
    await tx.reservation.deleteMany({ where: { restaurantId: id } }); // cascade ReservationItem
    await tx.auditLog.deleteMany({ where: { restaurantId: id } });
    await tx.$executeRaw`
      UPDATE stock_items
      SET quantity = COALESCE(baseline_quantity, quantity), baseline_quantity = NULL
      WHERE restaurant_id = ${id}
    `;
    await tx.restaurant.update({
      where: { id },
      data: {
        status: 'active',
        activatedAt: new Date(),
        rejectedAt: null,
        rejectedReason: null,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    return counts;
  });
  return { status: 'active', deletedCounts: counts };
}

export async function suspendRestaurant(id: number, reason?: string) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001');
  if (resto.status !== 'active')
    throw new AppError(400, 'ADMIN_001', 'Seul un restaurant actif peut être suspendu');
  return basePrisma.restaurant.update({
    where: { id },
    data: { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason?.trim() || null },
  });
}

export async function reactivateRestaurant(id: number) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001');
  if (resto.status !== 'suspended' && resto.status !== 'rejected') {
    throw new AppError(400, 'ADMIN_001', 'Statut non éligible à la réactivation');
  }
  return basePrisma.restaurant.update({
    where: { id },
    data: {
      status: 'active',
      suspendedAt: null,
      suspendedReason: null,
      rejectedAt: null,
      rejectedReason: null,
    },
  });
}

export async function rejectRestaurant(id: number, reason?: string) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001');
  if (resto.status !== 'pending')
    throw new AppError(400, 'ADMIN_001', 'Seul un restaurant en attente peut être refusé');
  return basePrisma.restaurant.update({
    where: { id },
    data: { status: 'rejected', rejectedAt: new Date(), rejectedReason: reason?.trim() || null },
  });
}
