import { basePrisma } from '../config/prisma';

export interface MembershipView {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  role: string;
}

// Memberships actifs d'un utilisateur sur des restaurants actifs (pour le login/sélecteur).
export async function listActiveMembershipsForUser(userId: number): Promise<MembershipView[]> {
  const rows = await basePrisma.membership.findMany({
    where: { userId, isActive: true, restaurant: { status: 'active' } },
    include: { restaurant: true },
    orderBy: { restaurant: { name: 'asc' } },
  });
  return rows.map((m) => ({
    restaurantId: m.restaurantId,
    restaurantName: m.restaurant.name,
    restaurantSlug: m.restaurant.slug,
    role: m.role,
  }));
}

// Membership actif précis (pour switch / vérification d'accès). null si absent/inactif.
export async function getActiveMembership(userId: number, restaurantId: number) {
  return basePrisma.membership.findFirst({
    where: { userId, restaurantId, isActive: true, restaurant: { status: 'active' } },
  });
}
