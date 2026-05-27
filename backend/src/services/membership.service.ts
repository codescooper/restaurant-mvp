import { basePrisma } from '../config/prisma';

export interface MembershipView {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  role: string;
}

// Retourne tous les memberships actifs d'un utilisateur, QUEL QUE SOIT le statut du restaurant
// (pending, active, suspended, rejected). Le filtre `restaurant.status === 'active'` a été retiré
// volontairement : le routage par statut est désormais géré côté frontend (ProtectedRoute M5).
// Un propriétaire d'un resto pending/suspended/rejected doit voir ses memberships pour être
// redirigé vers les écrans dédiés plutôt que de tomber dans une boucle sélecteur vide.
export async function listActiveMembershipsForUser(userId: number): Promise<MembershipView[]> {
  const rows = await basePrisma.membership.findMany({
    where: { userId, isActive: true },
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
// Le filtre `restaurant.status === 'active'` est retiré intentionnellement : un propriétaire
// d'un resto pending doit pouvoir se positionner sur son resto pour atterrir sur l'écran
// dédié (pending/Gestion). Le routage par statut est géré côté frontend (ProtectedRoute M5).
export async function getActiveMembership(userId: number, restaurantId: number) {
  return basePrisma.membership.findFirst({
    where: { userId, restaurantId, isActive: true },
  });
}
