import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed: nettoyage des donnees existantes...');
  // Ordre respectant les contraintes de cle etrangere.
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dishIngredient.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.syncQueue.deleteMany();
  await prisma.table.deleteMany();

  console.log('Seed: utilisateurs...');
  const passwords: Record<string, string> = {
    admin: 'admin123',
    caisse1: 'caisse123',
    chef1: 'chef123',
    serveur1: 'serveur123',
  };
  await prisma.user.createMany({
    data: [
      { username: 'admin', passwordHash: await bcrypt.hash(passwords.admin, 10), role: 'administrateur' },
      { username: 'caisse1', passwordHash: await bcrypt.hash(passwords.caisse1, 10), role: 'caissier' },
      { username: 'chef1', passwordHash: await bcrypt.hash(passwords.chef1, 10), role: 'cuisinier' },
      { username: 'serveur1', passwordHash: await bcrypt.hash(passwords.serveur1, 10), role: 'serveur' },
    ],
  });

  console.log('Seed: tables...');
  await prisma.table.createMany({
    data: [
      { name: 'Table 1', capacity: 2 },
      { name: 'Table 2', capacity: 4 },
      { name: 'Table 3', capacity: 4 },
      { name: 'Table 4', capacity: 6 },
      { name: 'Table 5', capacity: 2 },
      { name: 'Terrasse 1', capacity: 4 },
    ],
  });

  console.log('Seed: stock...');
  const riz = await prisma.stockItem.create({ data: { name: 'Riz', quantity: 50, unit: 'kg', alertThreshold: 10 } });
  const poulet = await prisma.stockItem.create({ data: { name: 'Poulet', quantity: 30, unit: 'kg', alertThreshold: 5 } });
  const tomates = await prisma.stockItem.create({ data: { name: 'Tomates', quantity: 20, unit: 'kg', alertThreshold: 5 } });
  const oignons = await prisma.stockItem.create({ data: { name: 'Oignons', quantity: 15, unit: 'kg', alertThreshold: 5 } });
  const huile = await prisma.stockItem.create({ data: { name: 'Huile', quantity: 25, unit: 'litre', alertThreshold: 5 } });
  await prisma.stockItem.create({ data: { name: 'Eau minérale', quantity: 100, unit: 'unité', alertThreshold: 20 } });

  console.log('Seed: plats...');
  const pouletBraise = await prisma.dish.create({
    data: { name: 'Poulet Braisé', description: 'Poulet grillé avec marinade épicée', price: 2500, category: 'Plat', isActive: true, preparationTime: 20 },
  });
  const rizSauce = await prisma.dish.create({
    data: { name: 'Riz Sauce', description: 'Riz avec sauce tomate maison', price: 1500, category: 'Plat', isActive: true, preparationTime: 15 },
  });
  await prisma.dish.create({
    data: { name: 'Attiéké Poisson', description: 'Attiéké accompagné de poisson frit', price: 2000, category: 'Plat', isActive: true, preparationTime: 18 },
  });
  await prisma.dish.create({
    data: { name: 'Alloco', description: 'Banane plantain frite', price: 500, category: 'Entrée', isActive: true, preparationTime: 8 },
  });
  await prisma.dish.create({
    data: { name: 'Jus Naturel', description: 'Jus de fruits frais', price: 1000, category: 'Boisson', isActive: true, preparationTime: 5 },
  });

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
      { settingKey: 'restaurant_name', settingValue: 'Restaurant Pilote', description: 'Nom du restaurant' },
      { settingKey: 'currency', settingValue: 'FCFA', description: 'Devise utilisée' },
      { settingKey: 'alert_threshold_default', settingValue: '10', description: "Seuil d'alerte par défaut pour le stock" },
    ],
  });

  console.log('Seed termine.');
  console.log('Comptes de demo:');
  console.log('  admin / admin123 (administrateur)');
  console.log('  caisse1 / caisse123 (caissier)');
  console.log('  chef1 / chef123 (cuisinier)');
  console.log('  serveur1 / serveur123 (serveur)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
