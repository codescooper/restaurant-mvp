// Valeurs catégorielles du domaine (libellés français du cahier des charges).

export const ROLES = ['administrateur', 'caissier', 'cuisinier', 'serveur'] as const;
export type Role = (typeof ROLES)[number];

export const TABLE_STATUSES = ['libre', 'occupée'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const STOCK_UNITS = ['kg', 'litre', 'unité', 'gramme', 'ml'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const DISH_CATEGORIES = ['Entrée', 'Plat', 'Dessert', 'Boisson'] as const;
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

export const PAYMENT_METHODS = ['espèces', 'mobile_money', 'carte', 'mixte'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MOBILE_MONEY_PROVIDERS = ['orange_money', 'wave'] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

export const MOVEMENT_TYPES = ['entrée', 'sortie', 'ajustement', 'commande'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'nouvelle_commande',
  'commande_prête',
  'stock_faible',
  'alerte',
  'info',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CURRENCY = 'FCFA';
