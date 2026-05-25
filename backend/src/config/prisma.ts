import { PrismaClient, Prisma } from '@prisma/client';

// Codes d'erreur Prisma liés à une connexion DB perdue ou indisponible. Sur Neon (free tier),
// la base se met en veille après quelques minutes d'inactivité : les connexions ouvertes sont
// coupées (P1017 « Server has closed the connection ») et la sortie de veille prend 1-3 s.
// Ces erreurs sont TRANSITOIRES : réessayer réveille la base puis réussit.
const TRANSIENT_ERROR_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT_ERROR_CODES.has(error.code);
  // Connexion initiale impossible / coupure réseau bas niveau (sans code typé).
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return true;
  return false;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Réessaie automatiquement toute requête qui échoue sur une erreur de connexion transitoire,
// le temps que la base sorte de veille. Jusqu'à 5 tentatives, backoff 400/800/1200/1600 ms
// (~4 s au total) — couvre le cold start de Neon sans bloquer durablement.
const MAX_DB_ATTEMPTS = 5;
prisma.$use(async (params, next) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_DB_ATTEMPTS; attempt++) {
    try {
      return await next(params);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_DB_ATTEMPTS || !isTransientDbError(error)) throw error;
      const code = (error as { code?: string }).code ?? 'connexion';
      // eslint-disable-next-line no-console
      console.warn(`DB: erreur transitoire (${code}) — nouvelle tentative ${attempt + 1}/${MAX_DB_ATTEMPTS}...`);
      await sleep(400 * attempt);
    }
  }
  throw lastError;
});

// Tente d'établir la connexion (et de réveiller Neon) avec quelques essais. Non bloquant :
// si la base reste indisponible, le serveur démarre quand même et se reconnectera à la 1re requête.
export async function connectWithRetry(attempts = 5): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await prisma.$connect();
      return true;
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`DB indisponible au démarrage (tentative ${attempt}/${attempts})...`);
      await sleep(1500);
    }
  }
  return false;
}
