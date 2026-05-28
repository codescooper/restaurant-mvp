import bcrypt from 'bcrypt';
import { basePrisma } from '../../config/prisma';

export interface SeededRestaurant { id: number; ownerId: number; cashierId: number; }

// Vide toutes les tables (ordre FK) puis crée 2 restaurants isolés avec des données minimales.
export async function resetAndSeedTwoRestaurants(): Promise<{ A: SeededRestaurant; B: SeededRestaurant }> {
  await basePrisma.$transaction([
    basePrisma.notificationRead.deleteMany(),
    basePrisma.notification.deleteMany(),
    basePrisma.stockMovement.deleteMany(),
    basePrisma.orderPayment.deleteMany(),
    basePrisma.orderItem.deleteMany(),
    basePrisma.order.deleteMany(),
    basePrisma.dishIngredient.deleteMany(),
    basePrisma.dishVariant.deleteMany(),
    basePrisma.dish.deleteMany(),
    basePrisma.stockItem.deleteMany(),
    basePrisma.appSetting.deleteMany(),
    basePrisma.table.deleteMany(),
    basePrisma.cashSession.deleteMany(),
    basePrisma.promotion.deleteMany(),
    basePrisma.expense.deleteMany(),
    basePrisma.supplier.deleteMany(),
    basePrisma.purchase.deleteMany(),
    basePrisma.inventoryLine.deleteMany(),
    basePrisma.inventory.deleteMany(),
    basePrisma.employee.deleteMany(),
    basePrisma.reservationItem.deleteMany(),
    basePrisma.reservation.deleteMany(),
    basePrisma.auditLog.deleteMany(),
    basePrisma.invitation.deleteMany(),
    basePrisma.membership.deleteMany(),
    basePrisma.user.deleteMany(),
    basePrisma.restaurant.deleteMany(),
  ]);

  async function makeResto(name: string, slug: string): Promise<SeededRestaurant> {
    const r = await basePrisma.restaurant.create({ data: { name, slug, status: 'active' } });
    const pwd = await bcrypt.hash('pass123', 10);
    const owner = await basePrisma.user.create({
      data: { email: `owner-${slug}@test.local`, passwordHash: pwd, displayName: 'Owner', restaurantId: r.id,
        memberships: { create: { restaurantId: r.id, role: 'propriétaire' } } },
    });
    const cashier = await basePrisma.user.create({
      data: { email: `cashier-${slug}@test.local`, passwordHash: pwd, displayName: 'Cashier', restaurantId: r.id,
        memberships: { create: { restaurantId: r.id, role: 'caissier' } } },
    });
    await basePrisma.dish.create({ data: { name: `Plat ${slug}`, price: 1000, restaurantId: r.id } });
    await basePrisma.table.create({ data: { name: 'Table 1', capacity: 4, restaurantId: r.id } });
    return { id: r.id, ownerId: owner.id, cashierId: cashier.id };
  }

  const A = await makeResto('Resto A', 'resto-a');
  const B = await makeResto('Resto B', 'resto-b');
  return { A, B };
}
