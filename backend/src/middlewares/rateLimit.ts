import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

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

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'AUTH_007', 'Trop d\'inscriptions depuis cette adresse, réessayez plus tard'),
});

export const acceptInviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'AUTH_001', 'Trop de tentatives, réessayez dans 15 minutes'),
});
