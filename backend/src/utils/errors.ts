// Codes d'erreur applicatifs (§12.5)
export const ErrorCodes = {
  AUTH_001: 'Identifiants invalides',
  AUTH_002: 'Token expiré',
  AUTH_003: 'Token invalide',
  AUTH_004: 'Compte désactivé',
  AUTH_005: 'Permissions insuffisantes',
  AUTH_006: 'Aucun restaurant sélectionné',
  STOCK_001: 'Stock insuffisant',
  STOCK_002: 'Article introuvable',
  ORDER_001: 'Commande introuvable',
  ORDER_002: 'Transition de statut invalide',
  ORDER_005: 'Un serveur ne peut pas encaisser : commande à régler à la caisse',
  DISH_001: 'Plat introuvable',
  DISH_002: 'Plat indisponible',
  USER_001: 'Utilisateur introuvable',
  USER_002: 'Username déjà existant',
  USER_003: 'Action interdite sur votre propre compte',
  USER_004: 'Au moins un administrateur actif doit rester',
  CASH_001: 'Aucune caisse ouverte : encaissement espèces impossible',
  CASH_002: 'Une caisse est déjà ouverte',
  CASH_003: 'Aucune caisse ouverte à fermer',
  CASH_004: 'Justification de l\'écart requise',
  CASH_005: 'Session de caisse introuvable',
  ORDER_003: 'Commande non payée : remboursement impossible',
  ORDER_004: 'Commande déjà remboursée',
  PIN_001: 'Code manager invalide',
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
