import rateLimit from 'express-rate-limit';

// Limite les tentatives de connexion (§14.5).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_001',
      message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
    },
  },
});
