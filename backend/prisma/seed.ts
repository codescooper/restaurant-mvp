import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed: nettoyage...');
  // Ordre FK. memberships avant users ; tout le tenant avant restaurants.
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dishIngredient.deleteMany();
  await prisma.dishVariant.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.syncQueue.deleteMany();
  await prisma.table.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  console.log('Seed: super-admin...');
  await prisma.user.create({
    data: {
      email: process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local',
      passwordHash: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD ?? 'superadmin123', 10),
      displayName: 'Super Admin',
      isSuperAdmin: true,
    },
  });

  console.log('Seed: restaurant pilote...');
  const resto = await prisma.restaurant.create({
    data: { name: 'Restaurant Pilote', slug: 'restaurant-pilote', status: 'active' },
  });
  const rid = resto.id;

  console.log('Seed: utilisateurs + memberships...');
  const staff: { email: string; pwd: string; role: string; name: string }[] = [
    { email: 'admin@restaurant-pilote.local', pwd: 'admin123', role: 'propriétaire', name: 'Admin' },
    { email: 'caisse1@restaurant-pilote.local', pwd: 'caisse123', role: 'caissier', name: 'Caissier 1' },
    { email: 'chef1@restaurant-pilote.local', pwd: 'chef123', role: 'cuisinier', name: 'Chef 1' },
    { email: 'serveur1@restaurant-pilote.local', pwd: 'serveur123', role: 'serveur', name: 'Serveur 1' },
  ];
  for (const s of staff) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash: await bcrypt.hash(s.pwd, 10),
        displayName: s.name,
        restaurantId: rid,
        memberships: { create: { restaurantId: rid, role: s.role } },
      },
    });
    void user;
  }

  console.log('Seed: tables...');
  await prisma.table.createMany({
    data: [
      { name: 'Table 1', capacity: 2, restaurantId: rid },
      { name: 'Table 2', capacity: 4, restaurantId: rid },
      { name: 'Table 3', capacity: 4, restaurantId: rid },
      { name: 'Table 4', capacity: 6, restaurantId: rid },
      { name: 'Table 5', capacity: 2, restaurantId: rid },
      { name: 'Terrasse 1', capacity: 4, restaurantId: rid },
    ],
  });

  console.log('Seed: stock...');
  const riz = await prisma.stockItem.create({ data: { name: 'Riz', quantity: 50, unit: 'kg', alertThreshold: 10, restaurantId: rid } });
  const poulet = await prisma.stockItem.create({ data: { name: 'Poulet', quantity: 30, unit: 'kg', alertThreshold: 5, restaurantId: rid } });
  const tomates = await prisma.stockItem.create({ data: { name: 'Tomates', quantity: 20, unit: 'kg', alertThreshold: 5, restaurantId: rid } });
  const oignons = await prisma.stockItem.create({ data: { name: 'Oignons', quantity: 15, unit: 'kg', alertThreshold: 5, restaurantId: rid } });
  const huile = await prisma.stockItem.create({ data: { name: 'Huile', quantity: 25, unit: 'litre', alertThreshold: 5, restaurantId: rid } });
  await prisma.stockItem.create({ data: { name: 'Eau minérale', quantity: 100, unit: 'unité', alertThreshold: 20, restaurantId: rid } });

  console.log('Seed: plats...');
  const pouletBraise = await prisma.dish.create({ data: { name: 'Poulet Braisé', description: 'Poulet grillé avec marinade épicée', price: 2500, category: 'Plat', preparationTime: 20, restaurantId: rid } });
  const rizSauce = await prisma.dish.create({ data: { name: 'Riz Sauce', description: 'Riz avec sauce tomate maison', price: 1500, category: 'Plat', preparationTime: 15, restaurantId: rid } });
  await prisma.dish.create({ data: { name: 'Attiéké Poisson', description: 'Attiéké accompagné de poisson frit', price: 2000, category: 'Plat', preparationTime: 18, restaurantId: rid } });
  await prisma.dish.create({ data: { name: 'Alloco', description: 'Banane plantain frite', price: 500, category: 'Entrée', preparationTime: 8, restaurantId: rid } });
  await prisma.dish.create({ data: { name: 'Jus Naturel', description: 'Jus de fruits frais', price: 1000, category: 'Boisson', preparationTime: 5, restaurantId: rid } });

  console.log('Seed: recettes...');
  await prisma.dishIngredient.createMany({
    data: [
      { dishId: pouletBraise.id, stockItemId: poulet.id, quantityNeeded: 0.5 },
      { dishId: pouletBraise.id, stockItemId: huile.id, quantityNeeded: 0.05 },
      { dishId: rizSauce.id, stockItemId: riz.id, quantityNeeded: 0.3 },
      { dishId: rizSauce.id, stockItemId: tomates.id, quantityNeeded: 0.2 },
      { dishId: rizSauce.id, stockItemId: oignons.id, quantityNeeded: 0.1 },
    ],
  });

  console.log('Seed: parametres...');
  await prisma.appSetting.createMany({
    data: [
      { settingKey: 'restaurant_name', settingValue: 'Restaurant Pilote', restaurantId: rid },
      { settingKey: 'currency', settingValue: 'FCFA', restaurantId: rid },
      { settingKey: 'alert_threshold_default', settingValue: '10', restaurantId: rid },
    ],
  });

  console.log('Seed termine.');
  console.log('  Super-admin :', process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local');
  console.log('  admin@restaurant-pilote.local / admin123 (propriétaire)');
  console.log('  caisse1@restaurant-pilote.local / caisse123 (caissier)');
  console.log('  chef1@restaurant-pilote.local / chef123 (cuisinier)');
  console.log('  serveur1@restaurant-pilote.local / serveur123 (serveur)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
