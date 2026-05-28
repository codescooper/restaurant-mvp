import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Crée (ou met à jour) UNIQUEMENT le compte super-admin de la plateforme.
// Idempotent : aucune suppression, peut être relancé sans risque (réinitialise
// le mot de passe au passage si besoin). Sûr à exécuter sur la prod.
//
// Identifiants lus depuis les variables d'environnement :
//   SUPERADMIN_EMAIL    (défaut : superadmin@plateforme.local)
//   SUPERADMIN_PASSWORD (défaut : superadmin123)

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD ?? 'superadmin123';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isSuperAdmin: true, isActive: true },
    create: { email, passwordHash, displayName: 'Super Admin', isSuperAdmin: true },
  });

  console.log('✅ Super-admin prêt :');
  console.log('   email        :', user.email);
  console.log('   isSuperAdmin :', user.isSuperAdmin);
  console.log('   mot de passe : (valeur de SUPERADMIN_PASSWORD, défaut « superadmin123 »)');
}

main()
  .catch((e) => {
    console.error('❌ Échec création super-admin :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
