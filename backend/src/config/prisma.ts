import { PrismaClient } from '@prisma/client';
import { tenantExtension } from './prisma-extension';

// Client BRUT (non scopé) : auth, super-admin, seed, migrations, tâches plateforme.
export const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Client SCOPÉ par défaut (importé par tous les services métier) : filtrage automatique
// par restaurantId via le contexte tenant. Refus par défaut hors contexte.
export const prisma = basePrisma.$extends(tenantExtension);
