import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { roundQty } from './stock.service';

export interface SupplierInput {
  name: string;
  phone?: string;
  contact?: string;
  note?: string;
}

export interface PurchaseInput {
  supplierId: number;
  stockItemId: number;
  quantity: number;
  unitPrice: number;
  dueDate?: string;
  isPaid?: boolean;
  note?: string;
}

// Liste des fournisseurs avec leur dette (somme des achats non payés).
export async function listSuppliers() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  const debts = await prisma.purchase.groupBy({
    by: ['supplierId'],
    _sum: { totalPrice: true },
    where: { isPaid: false },
  });
  const debtMap = new Map(debts.map((d) => [d.supplierId, d._sum.totalPrice ?? 0]));
  return suppliers.map((s) => ({ ...s, debt: debtMap.get(s.id) ?? 0 }));
}

export async function getSupplier(id: number) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { createdAt: 'desc' },
        include: { stockItem: { select: { name: true, unit: true } } },
      },
    },
  });
  if (!supplier) throw new AppError(404, 'VALIDATION_001', 'Fournisseur introuvable');
  const debt = supplier.purchases.filter((p) => !p.isPaid).reduce((s, p) => s + p.totalPrice, 0);
  return { ...supplier, debt };
}

export async function createSupplier(data: SupplierInput) {
  return prisma.supplier.create({ data });
}

export async function updateSupplier(id: number, data: Partial<SupplierInput>) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'VALIDATION_001', 'Fournisseur introuvable');
  return prisma.supplier.update({ where: { id }, data });
}

export async function deleteSupplier(id: number) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'VALIDATION_001', 'Fournisseur introuvable');
  await prisma.supplier.delete({ where: { id } }); // achats supprimés en cascade
  return { id };
}

// Enregistre un achat (1 article) : crée l'achat + réapprovisionne le stock + mouvement 'entrée'.
export async function createPurchase(input: PurchaseInput, userId?: number) {
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new AppError(404, 'VALIDATION_001', 'Fournisseur introuvable');
  const item = await prisma.stockItem.findUnique({ where: { id: input.stockItemId } });
  if (!item) throw new AppError(404, 'STOCK_002');

  const totalPrice = Math.round(input.unitPrice * input.quantity);
  const newQuantity = roundQty(item.quantity + input.quantity);

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        supplierId: input.supplierId,
        stockItemId: input.stockItemId,
        quantity: roundQty(input.quantity),
        unitPrice: input.unitPrice,
        totalPrice,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        isPaid: !!input.isPaid,
        paidAt: input.isPaid ? new Date() : null,
        note: input.note,
        createdBy: userId,
      },
    });
    // P2a mode préparation : un achat fournisseur redéfinit aussi la baseline
    // (cohérent avec addQuantity) pour qu'il ne soit pas effacé lors de l'activation.
    await tx.stockItem.update({
      where: { id: input.stockItemId },
      data: { quantity: newQuantity, baselineQuantity: newQuantity, lastUpdated: new Date() },
    });
    await tx.stockMovement.create({
      data: {
        stockItemId: input.stockItemId,
        movementType: 'entrée',
        quantity: roundQty(input.quantity),
        previousQuantity: item.quantity,
        newQuantity,
        note: `Achat ${supplier.name}`,
        createdBy: userId,
      },
    });
    return purchase;
  });
}

export async function listPurchases(supplierId?: number) {
  return prisma.purchase.findMany({
    where: supplierId ? { supplierId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      supplier: { select: { id: true, name: true } },
      stockItem: { select: { id: true, name: true, unit: true } },
    },
  });
}

export async function markPurchasePaid(id: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) throw new AppError(404, 'VALIDATION_001', 'Achat introuvable');
  if (purchase.isPaid) return purchase;
  return prisma.purchase.update({ where: { id }, data: { isPaid: true, paidAt: new Date() } });
}
