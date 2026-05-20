import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { Role } from '../constants';

function publicUser(u: { id: number; username: string; role: string; isActive: boolean; lastLogin: Date | null; createdAt: Date }) {
  return { id: u.id, username: u.username, role: u.role, isActive: u.isActive, lastLogin: u.lastLogin, createdAt: u.createdAt };
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { username: 'asc' } });
  return users.map(publicUser);
}

export async function getUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_001');
  return publicUser(user);
}

export async function createUser(data: { username: string; password: string; role: Role }) {
  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) throw new AppError(409, 'USER_002');

  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: data.role,
    },
  });
  return publicUser(user);
}

async function countActiveAdmins(excludeId?: number) {
  return prisma.user.count({
    where: { role: 'administrateur', isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

export async function updateUser(
  id: number,
  data: { username?: string; password?: string; role?: Role }
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_001');

  if (data.username && data.username !== user.username) {
    const dup = await prisma.user.findUnique({ where: { username: data.username } });
    if (dup) throw new AppError(409, 'USER_002');
  }

  // Empeche de retrograder le dernier admin actif.
  if (user.role === 'administrateur' && data.role && data.role !== 'administrateur') {
    if ((await countActiveAdmins(id)) === 0) throw new AppError(400, 'USER_004');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.username ? { username: data.username } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
  });
  return publicUser(updated);
}

export async function toggleActive(id: number, currentUserId: number) {
  if (id === currentUserId) throw new AppError(400, 'USER_003', 'Impossible de désactiver votre propre compte');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_001');

  // Si on desactive un admin actif, il doit en rester au moins un autre.
  if (user.isActive && user.role === 'administrateur' && (await countActiveAdmins(id)) === 0) {
    throw new AppError(400, 'USER_004');
  }

  const updated = await prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });
  return publicUser(updated);
}

export async function deleteUser(id: number, currentUserId: number) {
  if (id === currentUserId) throw new AppError(400, 'USER_003', 'Impossible de supprimer votre propre compte');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_001');

  if (user.role === 'administrateur' && user.isActive && (await countActiveAdmins(id)) === 0) {
    throw new AppError(400, 'USER_004');
  }

  await prisma.user.delete({ where: { id } });
  return { id };
}
