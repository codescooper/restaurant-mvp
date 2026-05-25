import { z } from 'zod';
import {
  ROLES,
  STOCK_UNITS,
  DISH_CATEGORIES,
  PAYMENT_METHODS,
  MOBILE_MONEY_PROVIDERS,
  SALES_CHANNELS,
  DELIVERY_PLATFORMS,
  LOSS_CAUSES,
  INVENTORY_TYPES,
  PROMO_KINDS,
  DISCOUNT_TYPES,
  CONTRACT_TYPES,
  SALARY_PERIODS,
  SALARY_PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from '../constants';

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const switchRestaurantSchema = z.object({
  restaurantId: z.number().int().positive(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Stock ---
export const createStockSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.enum(STOCK_UNITS),
  unitCost: z.number().min(0).default(0),
  alertThreshold: z.number().min(0).default(10),
});

export const updateStockSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().min(0).optional(),
  unit: z.enum(STOCK_UNITS).optional(),
  unitCost: z.number().min(0).optional(),
  alertThreshold: z.number().min(0).optional(),
});

export const addQuantitySchema = z.object({
  quantity: z.number().positive(),
});

// --- Pertes / gaspillage ---
export const recordLossSchema = z.object({
  quantity: z.number().positive(),
  cause: z.enum(LOSS_CAUSES),
  note: z.string().max(255).optional(),
});

// --- Fournisseurs & achats ---
export const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().max(30).optional(),
  contact: z.string().max(100).optional(),
  note: z.string().max(255).optional(),
});
export const updateSupplierSchema = createSupplierSchema.partial();

export const createPurchaseSchema = z.object({
  supplierId: z.number().int().positive(),
  stockItemId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPrice: z.number().int().min(0),
  dueDate: z.string().optional(),
  isPaid: z.boolean().optional(),
  note: z.string().max(255).optional(),
});

// --- Inventaires ---
export const createInventorySchema = z.object({
  type: z.enum(INVENTORY_TYPES).default('ponctuel'),
  note: z.string().max(255).optional(),
});

export const saveInventoryCountsSchema = z.object({
  lines: z
    .array(
      z.object({
        stockItemId: z.number().int().positive(),
        countedQty: z.number().min(0),
      })
    )
    .min(1),
});

// --- Dishes ---
const ingredientSchema = z.object({
  stockItemId: z.number().int().positive(),
  quantityNeeded: z.number().positive(),
});

const variantSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.number().int().min(0),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  ingredients: z.array(ingredientSchema).optional(),
});

const dishObjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  // Mode de prix : 'libre' => le caissier saisit un montant entre priceMin et priceMax.
  priceType: z.enum(['fixe', 'libre']).optional(),
  priceMin: z.number().int().positive().optional(),
  priceMax: z.number().int().positive().optional(),
  category: z.enum(DISH_CATEGORIES).optional(),
  preparationTime: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  // Photo : data URL compressée côté client (ou vide pour retirer). Bornée pour éviter les abus.
  imageUrl: z.string().max(1_000_000).optional(),
  ingredients: z.array(ingredientSchema).optional(),
  variants: z.array(variantSchema).optional(),
});

// Bornes obligatoires et cohérentes pour un prix libre.
const dishBoundsOk = (d: { priceType?: string; priceMin?: number; priceMax?: number }) =>
  d.priceType !== 'libre' || (d.priceMin != null && d.priceMax != null && d.priceMin <= d.priceMax);
// Prix libre et variantes sont mutuellement exclusifs.
const dishNoVariantsIfLibre = (d: { priceType?: string; variants?: unknown[] }) =>
  d.priceType !== 'libre' || !(d.variants && d.variants.length > 0);

export const createDishSchema = dishObjectSchema
  .refine(dishBoundsOk, { message: 'Prix libre : minimum et maximum requis (min ≤ max)', path: ['priceMin'] })
  .refine(dishNoVariantsIfLibre, { message: 'Un plat à prix libre ne peut pas avoir de variantes', path: ['variants'] });

export const updateDishSchema = dishObjectSchema
  .partial()
  .refine(dishBoundsOk, { message: 'Prix libre : minimum et maximum requis (min ≤ max)', path: ['priceMin'] })
  .refine(dishNoVariantsIfLibre, { message: 'Un plat à prix libre ne peut pas avoir de variantes', path: ['variants'] });

// --- Employés (RH) ---
export const createEmployeeSchema = z.object({
  // Identité & contact
  firstName: z.string().min(1, 'Prénom requis').max(50),
  lastName: z.string().min(1, 'Nom requis').max(50),
  phone: z.string().max(30).optional(),
  email: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  // Photo : data URL compressée côté client (comme les plats). Bornée pour éviter les abus.
  photoUrl: z.string().max(1_000_000).optional(),
  // Contrat
  position: z.string().max(60).optional(),
  contractType: z.enum(CONTRACT_TYPES).optional(),
  hireDate: z.string().optional(),
  endDate: z.string().optional(),
  // Rémunération
  salary: z.number().int().min(0).optional(),
  salaryPeriod: z.enum(SALARY_PERIODS).optional(),
  paymentMethod: z.enum(SALARY_PAYMENT_METHODS).optional(),
  // RH & urgence
  emergencyContact: z.string().max(100).optional(),
  emergencyPhone: z.string().max(30).optional(),
  idNumber: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  // Statut & lien compte de connexion (null = délier)
  isActive: z.boolean().optional(),
  userId: z.number().int().positive().nullable().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// --- Dépenses ---
export const createExpenseSchema = z.object({
  label: z.string().min(1, 'Libellé requis').max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().int().positive('Montant invalide'),
  expenseDate: z.string().min(1, 'Date requise'),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).optional(),
  note: z.string().max(1000).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// --- Users ---
export const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES).optional(),
});

// --- Orders ---
export const createOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          dishId: z.number().int().positive(),
          variantId: z.number().int().positive().optional(),
          // Prix saisi en caisse pour les plats à prix libre (validé contre les bornes côté serveur).
          customPrice: z.number().int().min(0).optional(),
          offered: z.boolean().optional(),
          quantity: z.number().int().positive(),
          notes: z.string().optional(),
        })
      )
      .min(1),
    couponCode: z.string().max(30).optional(),
    discountAmount: z.number().min(0).default(0),
    discountPercent: z.number().min(0).max(100).default(0),
    // Paiement optionnel : absent = commande différée (réglée à la caisse).
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    paymentDetails: z
      .object({
        mobileMoneyProvider: z.enum(MOBILE_MONEY_PROVIDERS).optional(),
        cashGiven: z.number().min(0).optional(),
        changeReturned: z.number().min(0).optional(),
      })
      .optional(),
    tipAmount: z.number().int().min(0).optional(),
    tipMethod: z.enum(PAYMENT_METHODS).optional(),
    tableId: z.number().int().positive().optional(),
    channel: z.enum(SALES_CHANNELS).default('sur_place'),
    deliveryPlatform: z.enum(DELIVERY_PLATFORMS).optional(),
    customerName: z.string().max(100).optional(),
    customerPhone: z.string().max(30).optional(),
  })
  .refine((d) => !(d.discountAmount > 0 && d.discountPercent > 0), {
    message: 'Une seule réduction (montant OU pourcentage) à la fois',
    path: ['discountAmount'],
  });

export const payOrderSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentDetails: z
    .object({
      mobileMoneyProvider: z.enum(MOBILE_MONEY_PROVIDERS).optional(),
      cashGiven: z.number().min(0).optional(),
      changeReturned: z.number().min(0).optional(),
    })
    .optional(),
  tipAmount: z.number().int().min(0).optional(),
  tipMethod: z.enum(PAYMENT_METHODS).optional(),
});

export const createTableSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive().optional(),
});
export const updateTableSchema = createTableSchema.partial();

export const billRequestSchema = z.object({
  requested: z.boolean(),
});

export const mergeTableSchema = z.object({
  targetTableId: z.number().int().positive(),
});

const reservationItemSchema = z.object({
  dishId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().positive(),
  notes: z.string().max(255).optional(),
});

export const createReservationSchema = z.object({
  tableId: z.number().int().positive(),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(30).optional(),
  partySize: z.number().int().positive().optional(),
  reservedAt: z.string().min(1),
  // Durée du repas en minutes (heure de fin calculée automatiquement). 15 min → 8 h.
  durationMinutes: z.number().int().min(15).max(480).optional(),
  note: z.string().max(255).optional(),
  // Pré-commande informative + montants / acompte.
  hasPreOrder: z.boolean().optional(),
  items: z.array(reservationItemSchema).optional(),
  totalAmount: z.number().int().min(0).optional(),
  depositAmount: z.number().int().min(0).optional(),
  depositMethod: z.enum(PAYMENT_METHODS).optional(),
});

// Édition : tous les champs optionnels (on n'envoie que ce qui change ; les items remplacent s'ils sont fournis).
export const updateReservationSchema = createReservationSchema.partial();

// --- Promotions ---
export const createPromotionSchema = z
  .object({
    name: z.string().min(1).max(100),
    kind: z.enum(PROMO_KINDS),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.number().int().positive(),
    isActive: z.boolean().optional(),
    startHour: z.number().int().min(0).max(23).optional(),
    endHour: z.number().int().min(0).max(24).optional(),
    days: z.string().max(30).optional(),
    code: z.string().min(1).max(30).optional(),
    maxUses: z.number().int().positive().optional(),
  })
  .refine((d) => d.kind !== 'happy_hour' || (d.startHour != null && d.endHour != null), {
    message: 'Happy hour : heures de début et fin requises',
    path: ['startHour'],
  })
  .refine((d) => d.kind !== 'coupon' || !!d.code, {
    message: 'Coupon : code requis',
    path: ['code'],
  })
  .refine((d) => d.discountType !== 'percent' || d.discountValue <= 100, {
    message: 'Pourcentage entre 1 et 100',
    path: ['discountValue'],
  });

export const updatePromotionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional(),
  discountValue: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  endHour: z.number().int().min(0).max(24).optional(),
  days: z.string().max(30).optional(),
  maxUses: z.number().int().positive().optional(),
});

export const setMaxDiscountSchema = z.object({
  maxDiscountPercent: z.number().int().min(0).max(100),
});

// PIN manager : chaîne (vide = désactive la protection).
export const setManagerPinSchema = z.object({
  pin: z.string().max(20),
});

export const updateStatusSchema = z.object({
  status: z.enum(['en_cours', 'prête', 'servie']),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Raison requise'),
  pin: z.string().max(20).optional(),
});

export const refundOrderSchema = z.object({
  reason: z.string().min(1, 'Raison requise'),
  pin: z.string().max(20).optional(),
});

// --- Caisse (ouverture / fermeture) ---
export const openCashSessionSchema = z.object({
  openingFloat: z.number().int().min(0, 'Fond de caisse invalide'),
  notes: z.string().optional(),
});

export const closeCashSessionSchema = z.object({
  countedCash: z.number().int().min(0, 'Montant compté invalide'),
  discrepancyReason: z.string().optional(),
  notes: z.string().optional(),
});

// --- Stats ---
export const periodSchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
});

export const exportSchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
  format: z.enum(['pdf', 'csv']).default('pdf'),
});

// --- Sync (offline) ---
export const syncSchema = z.object({
  orders: z.array(z.object({
    clientId: z.string().optional(),
    items: z.array(z.object({
      dishId: z.number().int().positive(),
      variantId: z.number().int().positive().optional(),
      customPrice: z.number().int().min(0).optional(),
      offered: z.boolean().optional(),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })).min(1),
    discountAmount: z.number().min(0).default(0),
    discountPercent: z.number().min(0).max(100).default(0),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentDetails: z.object({
      mobileMoneyProvider: z.enum(MOBILE_MONEY_PROVIDERS).optional(),
      cashGiven: z.number().min(0).optional(),
      changeReturned: z.number().min(0).optional(),
    }).optional(),
    channel: z.enum(SALES_CHANNELS).default('sur_place'),
    deliveryPlatform: z.enum(DELIVERY_PLATFORMS).optional(),
    customerName: z.string().max(100).optional(),
    customerPhone: z.string().max(30).optional(),
    createdAt: z.string().optional(),
  })),
});
