import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { slugify } from '../utils/slug';
import { MembershipView } from './membership.service';

interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  restaurantName: string;
}

async function findFreeSlug(base: string): Promise<string> {
  let candidate = base || 'restaurant';
  let suffix = 1;
  for (;;) {
    const taken = await basePrisma.restaurant.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, 60);
  }
}

export async function signup(input: SignupInput) {
  const email = input.email.toLowerCase().trim();
  const restaurantName = input.restaurantName.trim();

  const existing = await basePrisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'USER_002', 'Email déjà utilisé');

  const slug = await findFreeSlug(slugify(restaurantName));

  const { user, restaurant } = await basePrisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: { name: restaurantName, slug, status: 'pending' },
    });
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: input.displayName.trim() || null,
        restaurantId: restaurant.id,
        memberships: { create: { restaurantId: restaurant.id, role: 'propriétaire' } },
      },
    });
    return { user, restaurant };
  });

  // Construit inline : listActiveMembershipsForUser filtre restaurant.status === 'active',
  // or le resto vient d'être créé avec status 'pending' — il serait introuvable.
  const memberships: MembershipView[] = [{
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    role: 'propriétaire',
  }];
  const accessToken = signAccessToken({
    userId: user.id,
    isSuperAdmin: user.isSuperAdmin,
    restaurantId: restaurant.id,
    role: 'propriétaire',
  });
  const refreshToken = signRefreshToken({ userId: user.id });

  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, isSuperAdmin: user.isSuperAdmin },
    accessToken,
    refreshToken,
    memberships,
  };
}
