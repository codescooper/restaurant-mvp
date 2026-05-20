import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { StockUnit } from '../constants';
import { emitStockAlert } from '../websocket';
import { createNotification } from './notification.service';
import { StockItem } from '@prisma/client';

export function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function listStock() {
  return prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
}

export async function getStock(id: number) {
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) throw new AppError(404, 'STOCK_002');
  return item;
}

export async function createStock(data: {
  name: string;
  quantity: number;
  unit: StockUnit;
  alertThreshold: number;
}) {
  return prisma.stockItem.create({
    data: {
      name: data.name,
      quantity: roundQty(data.quantity),
      unit: data.unit,
      alertThreshold: roundQty(data.alertThreshold),
    },
  });
}

export async function updateStock(
  id: number,
  data: { name?: string; quantity?: number; unit?: StockUnit; alertThreshold?: number }
) {
  await getStock(id);
  return prisma.stockItem.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.quantity !== undefined ? { quantity: roundQty(data.quantity) } : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.alertThreshold !== undefined ? { alertThreshold: roundQty(data.alertThreshold) } : {}),
      lastUpdated: new Date(),
    },
  });
}

export async function deleteStock(id: number) {
  await getStock(id);
  const usedInRecipe = await prisma.dishIngredient.findFirst({ where: { stockItemId: id } });
  if (usedInRecipe) {
    throw new AppError(400, 'STOCK_002', 'Article utilisé dans une recette, suppression impossible');
  }
  await prisma.stockMovement.deleteMany({ where: { stockItemId: id } });
  await prisma.stockItem.delete({ where: { id } });
  return { id };
}

// Reapprovisionnement : enregistre un mouvement "entree" (§9.5).
export async function addQuantity(id: number, quantity: number, userId?: number) {
  const item = await getStock(id);
  const newQuantity = roundQty(item.quantity + quantity);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.stockItem.update({
      where: { id },
      data: { quantity: newQuantity, lastUpdated: new Date() },
    });
    await tx.stockMovement.create({
      data: {
        stockItemId: id,
        movementType: 'entrée',
        quantity: roundQty(quantity),
        previousQuantity: item.quantity,
        newQuantity,
        createdBy: userId,
        note: 'Réapprovisionnement',
      },
    });
    return result;
  });
  return updated;
}

export async function listMovements(stockItemId?: number) {
  return prisma.stockMovement.findMany({
    where: stockItemId ? { stockItemId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { stockItem: { select: { name: true, unit: true } } },
  });
}

// Verifie le seuil et notifie une seule fois sous le seuil (§13.1 regle 2).
export async function checkLowStock(item: StockItem) {
  if (item.quantity <= item.alertThreshold) {
    emitStockAlert({
      stockId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      unit: item.unit,
    });
    await createNotification({
      userRole: 'administrateur',
      title: 'Alerte stock',
      message: `${item.name} : stock faible (${item.quantity} ${item.unit})`,
      type: 'stock_faible',
      relatedStockId: item.id,
    });
  }
}

export async function getLowStockItems() {
  const items = await prisma.stockItem.findMany();
  return items.filter((i) => i.quantity <= i.alertThreshold);
}
