import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { roundQty } from './stock.service';

const lineInclude = {
  lines: {
    include: { stockItem: { select: { name: true, unit: true } } },
    orderBy: { stockItemId: 'asc' as const },
  },
};

// Crée une session d'inventaire : snapshot du stock théorique (système) de chaque article (§C).
export async function createInventory(type: string, note: string | undefined, userId?: number) {
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
  if (!items.length) throw new AppError(400, 'STOCK_002', 'Aucun article en stock à inventorier');

  return prisma.inventory.create({
    data: {
      type,
      note,
      createdBy: userId,
      lines: { create: items.map((i) => ({ stockItemId: i.id, theoreticalQty: i.quantity })) },
    },
    include: lineInclude,
  });
}

export async function listInventories() {
  return prisma.inventory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { creator: { select: { displayName: true } }, _count: { select: { lines: true } } },
  });
}

export async function getInventory(id: number) {
  const inv = await prisma.inventory.findUnique({ where: { id }, include: lineInclude });
  if (!inv) throw new AppError(404, 'VALIDATION_001', 'Inventaire introuvable');
  return inv;
}

// Enregistre les quantités comptées (réel) ; possible seulement tant que l'inventaire est en cours.
export async function saveCounts(id: number, lines: { stockItemId: number; countedQty: number }[]) {
  const inv = await prisma.inventory.findUnique({ where: { id } });
  if (!inv) throw new AppError(404, 'VALIDATION_001', 'Inventaire introuvable');
  if (inv.status !== 'en_cours') throw new AppError(400, 'VALIDATION_001', 'Inventaire déjà validé');

  await prisma.$transaction(
    lines.map((l) =>
      prisma.inventoryLine.updateMany({
        where: { inventoryId: id, stockItemId: l.stockItemId },
        data: { countedQty: roundQty(l.countedQty) },
      })
    )
  );
  return getInventory(id);
}

// Valide l'inventaire : ajuste le stock réel à la quantité comptée (mouvement 'ajustement') (§C).
export async function validateInventory(id: number, userId?: number) {
  const inv = await prisma.inventory.findUnique({ where: { id }, include: { lines: true } });
  if (!inv) throw new AppError(404, 'VALIDATION_001', 'Inventaire introuvable');
  if (inv.status !== 'en_cours') throw new AppError(400, 'VALIDATION_001', 'Inventaire déjà validé');

  const counted = inv.lines.filter((l) => l.countedQty != null);

  await prisma.$transaction(async (tx) => {
    for (const line of counted) {
      const item = await tx.stockItem.findUnique({ where: { id: line.stockItemId } });
      if (!item) continue;
      const newQuantity = roundQty(line.countedQty as number);
      if (newQuantity === item.quantity) continue; // pas d'écart : rien à ajuster
      await tx.stockItem.update({
        where: { id: line.stockItemId },
        data: { quantity: newQuantity, lastUpdated: new Date() },
      });
      await tx.stockMovement.create({
        data: {
          stockItemId: line.stockItemId,
          movementType: 'ajustement',
          quantity: roundQty(newQuantity - item.quantity),
          previousQuantity: item.quantity,
          newQuantity,
          note: `Inventaire #${id}`,
          createdBy: userId,
        },
      });
    }
    await tx.inventory.update({
      where: { id },
      data: { status: 'validé', validatedAt: new Date() },
    });
  });
  return getInventory(id);
}
