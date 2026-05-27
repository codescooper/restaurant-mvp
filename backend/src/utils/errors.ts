// Codes d'erreur applicatifs (§12.5)
export const ErrorCodes = {
  AUTH_001: 'Identifiants invalides',
  AUTH_002: 'Token expiré',
  AUTH_003: 'Token invalide',
  AUTH_004: 'Compte désactivé',
  AUTH_005: 'Permissions insuffisantes',
  AUTH_006: 'Aucun restaurant sélectionné',
  AUTH_007: 'Trop d\'inscriptions depuis cette adresse',
  STOCK_001: 'Stock insuffisant',
  STOCK_002: 'Article introuvable',
  ORDER_001: 'Commande introuvable',
  ORDER_002: 'Transition de statut invalide',
  ORDER_005: 'Un serveur ne peut pas encaisser : commande à régler à la caisse',
  DISH_001: 'Plat introuvable',
  DISH_002: 'Plat indisponible',
  NOTIF_001: 'Notification introuvable',
  USER_001: 'Utilisateur introuvable',
  USER_002: 'Cet utilisateur a déjà accès à ce restaurant',
  USER_003: 'Action interdite sur votre propre compte',
  USER_004: 'Au moins un propriétaire actif doit rester',
  USER_005: 'Email déjà utilisé',
  TABLE_001: 'Table occupée (commande ou réservation active)',
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
  DB_001: 'Base de données momentanément indisponible',
  INV_001: 'Rôle non invitable',
  INV_002: 'Une invitation est déjà en attente pour cet email',
  INV_003: 'Invitation introuvable',
  INV_004: 'Invitation non en attente',
  INV_005: 'Lien d\'invitation expiré ou non valide',
  INV_006: 'Restaurant non actif',
  INV_007: 'Lien déjà utilisé ou révoqué',
  ADMIN_001: 'Restaurant introuvable',
  ADMIN_002: 'Statut non éligible à l\'activation',
  ADMIN_003: 'Seul un restaurant actif peut être suspendu',
  ADMIN_004: 'Statut non éligible à la réactivation',
  ADMIN_005: 'Seul un restaurant en attente peut être refusé',
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
