// Valeurs catégorielles du domaine (libellés français du cahier des charges).

export const ROLES = ['administrateur', 'caissier', 'cuisinier', 'serveur'] as const;
export type Role = (typeof ROLES)[number];

export const TABLE_STATUSES = ['libre', 'occupée', 'addition_demandée', 'réservée'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const RESERVATION_STATUSES = ['active', 'annulée', 'honorée'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// Promotions (§F).
export const PROMO_KINDS = ['happy_hour', 'coupon'] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

export const DISCOUNT_TYPES = ['percent', 'amount'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

// Clés de réglages (table app_settings).
export const SETTING_MAX_DISCOUNT = 'max_discount_percent';
export const SETTING_MANAGER_PIN = 'manager_pin';
export const SETTING_RESTAURANT_NAME = 'restaurant_name';

// Nom du restaurant par défaut (affiché en en-tête des rapports tant qu'aucun n'est configuré).
export const DEFAULT_RESTAURANT_NAME = 'Mon Restaurant';

export const STOCK_UNITS = ['kg', 'litre', 'unité', 'gramme', 'ml'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const DISH_CATEGORIES = ['Entrée', 'Plat', 'Accompagnement', 'Fast-food', 'Dessert', 'Boisson'] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

export const ORDER_STATUSES = [
  'commandée',
  'en_cours',
  'prête',
  'servie',
  'annulée',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Transitions de statut séquentielles autorisées (§13.2)
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  commandée: ['en_cours', 'annulée'],
  en_cours: ['prête', 'annulée'],
  prête: ['servie', 'annulée'],
  servie: [],
  annulée: [],
};

export const PAYMENT_METHODS = ['espèces', 'mobile_money', 'carte', 'virement', 'qr_code', 'mixte'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MOBILE_MONEY_PROVIDERS = ['orange_money', 'wave', 'mtn'] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

// Canal de vente (§A).
export const SALES_CHANNELS = ['sur_place', 'emporter', 'livraison'] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

// Plateformes de livraison (utilisées quand channel = 'livraison').
export const DELIVERY_PLATFORMS = ['glovo', 'yango', 'uber_eats', 'autre'] as const;
export type DeliveryPlatform = (typeof DELIVERY_PLATFORMS)[number];

export const MOVEMENT_TYPES = ['entrée', 'sortie', 'ajustement', 'commande', 'perte'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// Causes de perte / gaspillage (§D).
export const LOSS_CAUSES = ['casse', 'péremption', 'erreur_cuisine', 'vol', 'offert_personnel'] as const;
export type LossCause = (typeof LOSS_CAUSES)[number];

// Inventaires (§C).
export const INVENTORY_TYPES = ['quotidien', 'hebdomadaire', 'mensuel', 'ponctuel'] as const;
export type InventoryType = (typeof INVENTORY_TYPES)[number];

export const INVENTORY_STATUSES = ['en_cours', 'validé'] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const CASH_SESSION_STATUSES = ['ouverte', 'fermée'] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

// Réservations : marges ajoutées APRÈS la fin du repas avant que la table soit de nouveau libre.
// Heure de fin = reservedAt + durationMinutes. Puis :
//   + RESERVATION_GRACE_MINUTES  : marge de tolérance laissée au client (« leste »)
//   + RESERVATION_CLEANING_MINUTES : temps pour l'équipe de nettoyage / remise en place
// Table de nouveau disponible = heure de fin + ces deux marges.
export const RESERVATION_GRACE_MINUTES = 30;
export const RESERVATION_CLEANING_MINUTES = 30;
export const RESERVATION_DEFAULT_DURATION_MINUTES = 90;

// Employés (RH).
export const CONTRACT_TYPES = ['CDI', 'CDD', 'extra', 'stagiaire', 'autre'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const SALARY_PERIODS = ['mensuel', 'horaire', 'journalier'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const SALARY_PAYMENT_METHODS = ['espèces', 'virement', 'mobile_money'] as const;
export type SalaryPaymentMethod = (typeof SALARY_PAYMENT_METHODS)[number];

// Dépenses d'exploitation. La catégorie 'approvisionnement' (achats de stock) est générée
// automatiquement depuis le module stock : visible en trésorerie mais EXCLUE du bénéfice net
// (le coût des matières est déjà compté via le coût matière/COGS au moment de la vente).
export const EXPENSE_CATEGORIES = [
  // Approvisionnement (auto, hors bénéfice net)
  'approvisionnement',
  // Charges fixes
  'loyer', 'électricité', 'eau', 'internet', 'abonnement',
  // Personnel
  'salaire', 'prime', 'charges_sociales',
  // Exploitation
  'équipement', 'entretien', 'transport', 'nettoyage',
  // Divers
  'marketing', 'taxes', 'frais_bancaires', 'autre',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Catégorie réservée aux achats de stock (auto-générée, exclue du bénéfice net).
export const STOCK_PURCHASE_CATEGORY: ExpenseCategory = 'approvisionnement';

export const EXPENSE_PAYMENT_METHODS = ['espèces', 'virement', 'mobile_money', 'carte', 'autre'] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

// Actions sensibles tracées dans le journal d'audit (§C).
export const AUDIT_ACTIONS = [
  'ouverture_caisse',
  'fermeture_caisse',
  'ouverture_tiroir',
  'paiement',
  'remise',
  'annulation',
  'remboursement',
  'correction_commande',
  'employe_creation',
  'employe_modification',
  'employe_suppression',
  'depense_creation',
  'depense_modification',
  'depense_suppression',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Moyens de paiement impliquant des espèces (nécessitent une caisse ouverte).
export const CASH_PAYMENT_METHODS = ['espèces'] as const;

export function isCashPaymentMethod(method?: string | null): boolean {
  return (CASH_PAYMENT_METHODS as readonly string[]).includes(method ?? '');
}

export const NOTIFICATION_TYPES = [
  'nouvelle_commande',
  'commande_prête',
  'stock_faible',
  'alerte',
  'info',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CURRENCY = 'FCFA';
