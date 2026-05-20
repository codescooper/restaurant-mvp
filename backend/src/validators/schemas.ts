import { z } from 'zod';
import {
  ROLES,
  STOCK_UNITS,
  DISH_CATEGORIES,
  PAYMENT_METHODS,
  MOBILE_MONEY_PROVIDERS,
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

// --- Dishes ---
const ingredientSchema = z.object({
  stockItemId: z.number().int().positive(),
  quantityNeeded: z.number().positive(),
});

export const createDishSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  category: z.enum(DISH_CATEGORIES).optional(),
  preparationTime: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  ingredients: z.array(ingredientSchema).optional(),
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
          quantity: z.number().int().positive(),
          notes: z.string().optional(),
        })
      )
      .min(1),
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

export const updateStatusSchema = z.object({
  status: z.enum(['en_cours', 'prête', 'servie']),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Raison requise'),
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
    createdAt: z.string().optional(),
  })),
});
