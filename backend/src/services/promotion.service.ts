import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { PromoKind, DiscountType } from '../constants';

export interface PromotionInput {
  name: string;
  kind: PromoKind;
  discountType: DiscountType;
  discountValue: number;
  isActive?: boolean;
  startHour?: number;
  endHour?: number;
  days?: string;
  code?: string;
  maxUses?: number;
}

export async function listPromotions() {
  return prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createPromotion(data: PromotionInput) {
  if (data.kind === 'coupon' && data.code) {
    const dup = await prisma.promotion.findFirst({ where: { code: data.code } });
    if (dup) throw new AppError(409, 'VALIDATION_001', 'Ce code coupon existe déjà');
  }
  return prisma.promotion.create({
    data: {
      name: data.name,
      kind: data.kind,
      discountType: data.discountType,
      discountValue: data.discountValue,
      isActive: data.isActive ?? true,
      startHour: data.kind === 'happy_hour' ? data.startHour : null,
      endHour: data.kind === 'happy_hour' ? data.endHour : null,
      days: data.kind === 'happy_hour' ? data.days ?? null : null,
      code: data.kind === 'coupon' ? data.code : null,
      maxUses: data.kind === 'coupon' ? data.maxUses ?? null : null,
    },
  });
}

export async function updatePromotion(id: number, data: Partial<PromotionInput>) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'VALIDATION_001', 'Promotion introuvable');
  return prisma.promotion.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
      ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.startHour !== undefined ? { startHour: data.startHour } : {}),
      ...(data.endHour !== undefined ? { endHour: data.endHour } : {}),
      ...(data.days !== undefined ? { days: data.days } : {}),
      ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
    },
  });
}

export async function deletePromotion(id: number) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'VALIDATION_001', 'Promotion introuvable');
  await prisma.promotion.delete({ where: { id } }); // les commandes gardent promoLabel (promotionId -> null)
  return { id };
}

// Happy hour actif à l'instant donné (plage horaire + jours optionnels).
export async function findActiveHappyHour(now = new Date()) {
  const list = await prisma.promotion.findMany({ where: { kind: 'happy_hour', isActive: true } });
  const hour = now.getHours();
  const weekday = now.getDay() === 0 ? 7 : now.getDay(); // 1=lundi … 7=dimanche
  return (
    list.find((p) => {
      if (p.startHour == null || p.endHour == null) return false;
      const inWindow =
        p.startHour <= p.endHour
          ? hour >= p.startHour && hour < p.endHour
          : hour >= p.startHour || hour < p.endHour; // plage qui passe minuit
      if (!inWindow) return false;
      if (p.days) {
        const days = p.days.split(',').map((s) => Number(s.trim()));
        if (!days.includes(weekday)) return false;
      }
      return true;
    }) ?? null
  );
}

// Coupon valide (actif, non épuisé).
export async function findValidCoupon(code: string) {
  const c = await prisma.promotion.findFirst({ where: { code } });
  if (!c || c.kind !== 'coupon' || !c.isActive) throw new AppError(400, 'VALIDATION_001', 'Coupon invalide');
  if (c.maxUses != null && c.usedCount >= c.maxUses) throw new AppError(400, 'VALIDATION_001', 'Coupon épuisé');
  return c;
}
