import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { getTenantIdOrThrow } from '../config/tenant-context';
import { AppError } from '../utils/errors';
import { Role } from '../constants';

interface MemberView {
  membershipId: number;
  userId: number;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}

function toView(m: {
  id: number; role: string; isActive: boolean;
  user: { id: number; email: string; displayName: string | null; lastLogin: Date | null; createdAt: Date };
}): MemberView {
  return {
    membershipId: m.id, userId: m.user.id, email: m.user.email, displayName: m.user.displayName,
    role: m.role, isActive: m.isActive, lastLogin: m.user.lastLogin, createdAt: m.user.createdAt,
  };
}

export async function listUsers() {
  const rid = getTenantIdOrThrow();
  const members = await basePrisma.membership.findMany({
    where: { restaurantId: rid },
    include: { user: true },
    orderBy: { user: { displayName: 'asc' } },
  });
  return members.map(toView);
}

export async function getUser(membershipId: number) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid }, include: { user: true } });
  if (!m) throw new AppError(404, 'USER_001');
  return toView(m);
}

// Crée un membre : réutilise le User si l'email existe, sinon le crée. Ajoute le membership au restaurant courant.
export async function createUser(data: { email: string; password: string; role: Role; displayName?: string }) {
  const rid = getTenantIdOrThrow();
  const email = data.email.toLowerCase().trim();
  let user = await basePrisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await basePrisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(data.password, 10), displayName: data.displayName ?? null, restaurantId: rid },
    });
  }
  const existing = await basePrisma.membership.findFirst({ where: { userId: user.id, restaurantId: rid } });
  if (existing) throw new AppError(409, 'USER_002');
  const m = await basePrisma.membership.create({ data: { userId: user.id, restaurantId: rid, role: data.role }, include: { user: true } });
  return toView(m);
}

async function countActiveOwners(excludeMembershipId?: number) {
  const rid = getTenantIdOrThrow();
  return basePrisma.membership.count({
    where: { restaurantId: rid, role: 'propriétaire', isActive: true, ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}) },
  });
}

export async function updateUser(membershipId: number, data: { role?: Role; password?: string; displayName?: string }) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid }, include: { user: true } });
  if (!m) throw new AppError(404, 'USER_001');

  // Empêche de retirer le dernier propriétaire actif.
  if (m.role === 'propriétaire' && data.role && data.role !== 'propriétaire' && (await countActiveOwners(membershipId)) === 0) {
    throw new AppError(400, 'USER_004');
  }
  if (data.role) await basePrisma.membership.update({ where: { id: membershipId }, data: { role: data.role } });
  if (data.password || data.displayName !== undefined) {
    await basePrisma.user.update({
      where: { id: m.user.id },
      data: {
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      },
    });
  }
  return getUser(membershipId);
}

export async function toggleActive(membershipId: number, currentUserId: number) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid } });
  if (!m) throw new AppError(404, 'USER_001');
  if (m.userId === currentUserId) throw new AppError(400, 'USER_003', 'Impossible de désactiver votre propre accès');
  if (m.isActive && m.role === 'propriétaire' && (await countActiveOwners(membershipId)) === 0) {
    throw new AppError(400, 'USER_004');
  }
  await basePrisma.membership.update({ where: { id: membershipId }, data: { isActive: !m.isActive } });
  return getUser(membershipId);
}

// Retire un membre du restaurant courant (supprime le membership ; le User global subsiste).
export async function deleteUser(membershipId: number, currentUserId: number) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid } });
  if (!m) throw new AppError(404, 'USER_001');
  if (m.userId === currentUserId) throw new AppError(400, 'USER_003', 'Impossible de retirer votre propre accès');
  if (m.role === 'propriétaire' && m.isActive && (await countActiveOwners(membershipId)) === 0) {
    throw new AppError(400, 'USER_004');
  }
  await basePrisma.membership.delete({ where: { id: membershipId } });
  return { id: membershipId };
}
