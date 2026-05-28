import dotenv from 'dotenv';

dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante: ${key}`);
  }
  return value;
}

const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd,
  // En prod, pas de fallback : l'app crashe au démarrage si le secret est absent (forge de tokens impossible).
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev_jwt_secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', isProd ? undefined : 'dev_refresh_secret'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Bootstrap du super-admin plateforme (créé/mis à jour par le seed).
  superadminEmail: process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local',
  superadminPassword: process.env.SUPERADMIN_PASSWORD ?? 'superadmin123',
  // URL de base pour fabriquer les liens (utilisée en P2 ; définie ici pour centraliser).
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
};
