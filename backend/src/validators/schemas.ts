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
} from '../constants';

// --- Auth ---
export const loginSchema = z.object({
  username: z.string().min(1, 'Nom d\'utilisateur requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Stock ---
export const createStockSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.enum(STOCK_UNITS),
  alertThreshold: z.number().min(0).default(10),
});

export const updateStockSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().min(0).optional(),
  unit: z.enum(STOCK_UNITS).optional(),
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

export const createDishSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  category: z.enum(DISH_CATEGORIES).optional(),
  preparationTime: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  variants: z.array(variantSchema).optional(),
});

export const updateDishSchema = createDishSchema.partial();

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

export const createReservationSchema = z.object({
  tableId: z.number().int().positive(),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(30).optional(),
  partySize: z.number().int().positive().optional(),
  reservedAt: z.string().min(1),
  note: z.string().max(255).optional(),
});

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
