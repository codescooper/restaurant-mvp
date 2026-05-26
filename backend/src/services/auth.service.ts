import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { Role } from '../constants';
import { listActiveMembershipsForUser, getActiveMembership } from './membership.service';

function publicUser(u: { id: number; email: string; displayName: string | null; isSuperAdmin: boolean }) {
  return { id: u.id, email: u.email, displayName: u.displayName, isSuperAdmin: u.isSuperAdmin };
}

// Construit la réponse d'auth. Si un restaurant est sélectionné, le token est scopé dessus.
function buildAuthResponse(
  user: { id: number; email: string; displayName: string | null; isSuperAdmin: boolean },
  selected?: { restaurantId: number; role: Role }
) {
  return {
    user: publicUser(user),
    accessToken: signAccessToken({
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin,
      restaurantId: selected?.restaurantId,
      role: selected?.role,
    }),
    refreshToken: signRefreshToken({ userId: user.id }),
  };
}

export async function login(email: string, password: string) {
  const user = await basePrisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) throw new AppError(401, 'AUTH_001');
  if (!user.isActive) throw new AppError(403, 'AUTH_004');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'AUTH_001');

  await basePrisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const memberships = await listActiveMembershipsForUser(user.id);
  // Auto-sélection si un seul restaurant ; sinon token non scopé + sélecteur côté client.
  const selected = memberships.length === 1
    ? { restaurantId: memberships[0].restaurantId, role: memberships[0].role as Role }
    : undefined;

  return { ...buildAuthResponse(user, selected), memberships };
}

export async function switchRestaurant(userId: number, restaurantId: number) {
  const user = await basePrisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError(403, 'AUTH_004');
  const membership = await getActiveMembership(userId, restaurantId);
  if (!membership) throw new AppError(403, 'AUTH_005');
  return buildAuthResponse(user, { restaurantId, role: membership.role as Role });
}

export async function refresh(refreshToken: string) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'AUTH_002');
  }
  const user = await basePrisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) throw new AppError(403, 'AUTH_004');
  const memberships = await listActiveMembershipsForUser(user.id);
  const selected = memberships.length === 1
    ? { restaurantId: memberships[0].restaurantId, role: memberships[0].role as Role }
    : undefined;
  return { ...buildAuthResponse(user, selected), memberships };
}

export async function getMe(userId: number) {
  const user = await basePrisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'USER_001');
  const memberships = await listActiveMembershipsForUser(user.id);
  return { user: publicUser(user), memberships };
}
