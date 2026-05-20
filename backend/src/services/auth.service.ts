import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { Role } from '../constants';
import { User } from '@prisma/client';

function buildAuthResponse(user: User) {
  const payload = { userId: user.id, username: user.username, role: user.role as Role };
  return {
    user: { id: user.id, username: user.username, role: user.role },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ userId: user.id }),
  };
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new AppError(401, 'AUTH_001');
  if (!user.isActive) throw new AppError(403, 'AUTH_004');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'AUTH_001');

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  return buildAuthResponse(user);
}

export async function refresh(refreshToken: string) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'AUTH_002');
  }
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) throw new AppError(403, 'AUTH_004');
  return buildAuthResponse(user);
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'USER_001');
  return { id: user.id, username: user.username, role: user.role };
}
