import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Crée un restaurant FICTIF de démonstration (autonome, idempotent par slug).
// Sert à présenter la plateforme sans exposer un vrai restaurant client.
// Sûr à exécuter sur la prod : ne touche à aucun autre restaurant.
//
// Identifiants démo (modifiables via env) :
//   DEMO_OWNER_EMAIL    (défaut : demo@restoflow.com)
//   DEMO_OWNER_PASSWORD (défaut : Demo-Restoflow-2026)

const prisma = new PrismaClient();

const SLUG = 'bistrot-demo';
const NAME = 'Bistrot Démo';

async function main() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`ℹ️  Le restaurant démo existe déjà (id ${existing.id}, statut ${existing.status}). Aucune action.`);
    return;
  }

  const email = (process.env.DEMO_OWNER_EMAIL ?? 'demo@restoflow.com').toLowerCase().trim();
  const password = process.env.DEMO_OWNER_PASSWORD ?? 'Demo-Restoflow-2026';

  const resto = await prisma.restaurant.create({
    data: { name: NAME, slug: SLUG, status: 'active' },
  });
  const rid = resto.id;

  // Propriétaire démo (réutilise le compte s'il existe déjà globalement).
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const owner = existingUser
    ? existingUser
    : await prisma.user.create({
        data: { email, passwordHash: await bcrypt.hash(password, 10), displayName: 'Démo', restaurantId: rid },
      });
  await prisma.membership.upsert({
    where: { userId_restaurantId: { userId: owner.id, restaurantId: rid } },
    create: { userId: owner.id, restaurantId: rid, role: 'propriétaire' },
    update: { role: 'propriétaire', isActive: true },
  });

  // Stock fictif.
  await prisma.stockItem.createMany({
    data: [
      { name: 'Riz', quantity: 40, unit: 'kg', alertThreshold: 10, restaurantId: rid },
      { name: 'Poulet', quantity: 25, unit: 'kg', alertThreshold: 5, restaurantId: rid },
      { name: 'Poisson', quantity: 18, unit: 'kg', alertThreshold: 5, restaurantId: rid },
      { name: 'Attiéké', quantity: 30, unit: 'kg', alertThreshold: 5, restaurantId: rid },
      { name: 'Boissons', quantity: 120, unit: 'unité', alertThreshold: 24, restaurantId: rid },
    ],
  });

  // Menu fictif (FCFA, contexte Afrique de l'Ouest).
  await prisma.dish.createMany({
    data: [
      { name: 'Poulet Braisé', description: 'Poulet grillé, marinade épicée, accompagnement au choix', price: 3000, category: 'Plat', preparationTime: 20, restaurantId: rid },
      { name: 'Attiéké Poisson', description: 'Attiéké et poisson braisé, sauce tomate fraîche', price: 2500, category: 'Plat', preparationTime: 18, restaurantId: rid },
      { name: 'Riz Sauce Graine', description: 'Riz blanc et sauce graine maison', price: 2000, category: 'Plat', preparationTime: 15, restaurantId: rid },
      { name: 'Alloco', description: 'Bananes plantain frites, sauce piment', price: 1000, category: 'Entrée', preparationTime: 8, restaurantId: rid },
      { name: 'Salade Avocat', description: 'Avocat, crudités de saison', price: 1500, category: 'Entrée', preparationTime: 6, restaurantId: rid },
      { name: 'Jus de Bissap', description: 'Infusion d\'hibiscus glacée', price: 800, category: 'Boisson', preparationTime: 3, restaurantId: rid },
      { name: 'Jus de Gingembre', description: 'Jus de gingembre frais', price: 800, category: 'Boisson', preparationTime: 3, restaurantId: rid },
      { name: 'Dégué', description: 'Dessert au mil et lait fermenté', price: 1000, category: 'Dessert', preparationTime: 5, restaurantId: rid },
    ],
  });

  // Tables fictives.
  await prisma.table.createMany({
    data: [
      { name: 'Table 1', capacity: 2, restaurantId: rid },
      { name: 'Table 2', capacity: 4, restaurantId: rid },
      { name: 'Table 3', capacity: 4, restaurantId: rid },
      { name: 'Table 4', capacity: 6, restaurantId: rid },
      { name: 'Terrasse 1', capacity: 4, restaurantId: rid },
    ],
  });

  console.log('✅ Restaurant démo créé :');
  console.log(`   nom        : ${NAME}`);
  console.log(`   slug       : ${SLUG}  → page publique /r/${SLUG}`);
  console.log(`   statut     : active`);
  console.log(`   propriétaire : ${email} / mot de passe = DEMO_OWNER_PASSWORD (défaut « Demo-Restoflow-2026 »)`);
  console.log(`   contenu    : 8 plats, 5 articles de stock, 5 tables`);
}

main()
  .catch((e) => { console.error('❌ Échec création démo :', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
