import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { getTenantIdOrThrow } from '../config/tenant-context';
import { AppError } from '../utils/errors';
import { Role } from '../constants';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { listActiveMembershipsForUser } from './membership.service';

const INVITE_TTL_DAYS = 7;
const INVITABLE_ROLES: Role[] = ['administrateur', 'caissier', 'cuisinier', 'serveur'];

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');   // 64 hex chars
}

export async function listInvitations() {
  const restaurantId = getTenantIdOrThrow();
  return basePrisma.invitation.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createInvitation(input: { email: string; role: Role }, createdBy?: number) {
  const restaurantId = getTenantIdOrThrow();
  if (!INVITABLE_ROLES.includes(input.role)) {
    throw new AppError(400, 'INV_001', 'Rôle non invitable');
  }
  const email = input.email.toLowerCase().trim();
  const existingPending = await basePrisma.invitation.findFirst({
    where: { restaurantId, email, status: 'pending' },
  });
  if (existingPending) throw new AppError(409, 'INV_002', 'Une invitation est déjà en attente pour cet email');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invitation = await basePrisma.invitation.create({
    data: { restaurantId, email, role: input.role, token, status: 'pending', expiresAt, createdBy },
  });
  return {
    ...invitation,
    url: `${env.appBaseUrl}/invite/${token}`,
  };
}

export async function revokeInvitation(id: number) {
  const restaurantId = getTenantIdOrThrow();
  const inv = await basePrisma.invitation.findFirst({ where: { id, restaurantId } });
  if (!inv) throw new AppError(404, 'INV_003', 'Invitation introuvable');
  if (inv.status !== 'pending') throw new AppError(400, 'INV_004', 'Cette invitation n\'est plus en attente');
  return basePrisma.invitation.update({
    where: { id },
    data: { status: 'revoked', revokedAt: new Date() },
  });
}

// Public — pas de tenant context.
export async function peekInvitation(token: string) {
  const inv = await basePrisma.invitation.findUnique({
    where: { token },
    include: { restaurant: { select: { name: true, status: true } } },
  });
  if (!inv) throw new AppError(404, 'INV_003', 'Invitation introuvable');
  // Lazy expire
  if (inv.status === 'pending' && inv.expiresAt < new Date()) {
    await basePrisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
    inv.status = 'expired';
  }
  const emailExists = !!(await basePrisma.user.findUnique({ where: { email: inv.email }, select: { id: true } }));
  return {
    restaurantName: inv.restaurant.name,
    role: inv.role,
    email: inv.email,
    status: inv.status,
    expiresAt: inv.expiresAt,
    emailExists,
  };
}

export async function acceptInvitation(token: string, body: { password: string; displayName?: string }) {
  const inv = await basePrisma.invitation.findUnique({ where: { token } });
  if (!inv) throw new AppError(404, 'INV_003', 'Invitation introuvable');
  if (inv.status !== 'pending') throw new AppError(410, 'INV_005', 'Lien non valide (expiré, révoqué ou déjà utilisé)');
  if (inv.expiresAt < new Date()) {
    await basePrisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
    throw new AppError(410, 'INV_005', 'Lien expiré');
  }
  // Vérif que le resto est active (sinon impossible d'inviter — defense-in-depth).
  const resto = await basePrisma.restaurant.findUnique({ where: { id: inv.restaurantId }, select: { status: true } });
  if (!resto || resto.status !== 'active') throw new AppError(403, 'INV_005', 'Restaurant non actif');

  const existing = await basePrisma.user.findUnique({ where: { email: inv.email } });

  let userId: number;
  if (existing) {
    // Login-first : verifier le mot de passe de l'existant.
    const ok = await bcrypt.compare(body.password, existing.passwordHash);
    if (!ok) throw new AppError(401, 'AUTH_001', 'Mot de passe incorrect');
    if (!existing.isActive) throw new AppError(403, 'AUTH_004');
    userId = existing.id;
  } else {
    // Nouveau compte.
    if (body.password.length < 6) throw new AppError(400, 'VALIDATION_001', 'Mot de passe trop court');
    const created = await basePrisma.user.create({
      data: {
        email: inv.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        displayName: body.displayName?.trim() || null,
        restaurantId: inv.restaurantId,
      },
    });
    userId = created.id;
  }

  await basePrisma.$transaction([
    basePrisma.membership.upsert({
      where: { userId_restaurantId: { userId, restaurantId: inv.restaurantId } },
      create: { userId, restaurantId: inv.restaurantId, role: inv.role, isActive: true },
      update: { role: inv.role, isActive: true },
    }),
    basePrisma.invitation.update({
      where: { id: inv.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    }),
  ]);

  const user = (await basePrisma.user.findUnique({ where: { id: userId } }))!;
  const memberships = await listActiveMembershipsForUser(userId);
  const accessToken = signAccessToken({
    userId,
    isSuperAdmin: user.isSuperAdmin,
    restaurantId: inv.restaurantId,
    role: inv.role as Role,
  });
  const refreshToken = signRefreshToken({ userId });
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, isSuperAdmin: user.isSuperAdmin },
    accessToken,
    refreshToken,
    memberships,
  };
}
