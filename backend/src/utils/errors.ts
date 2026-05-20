// Codes d'erreur applicatifs (§12.5)
export const ErrorCodes = {
  AUTH_001: 'Identifiants invalides',
  AUTH_002: 'Token expiré',
  AUTH_003: 'Token invalide',
  AUTH_004: 'Compte désactivé',
  AUTH_005: 'Permissions insuffisantes',
  STOCK_001: 'Stock insuffisant',
  STOCK_002: 'Article introuvable',
  ORDER_001: 'Commande introuvable',
  ORDER_002: 'Transition de statut invalide',
  DISH_001: 'Plat introuvable',
  DISH_002: 'Plat indisponible',
  USER_001: 'Utilisateur introuvable',
  USER_002: 'Username déjà existant',
  USER_003: 'Action interdite sur votre propre compte',
  USER_004: 'Au moins un administrateur actif doit rester',
  VALIDATION_001: 'Données invalides',
  INTERNAL_001: 'Erreur interne du serveur',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message?: string,
    public details?: unknown
  ) {
    super(message ?? ErrorCodes[code]);
    this.name = 'AppError';
  }
}
