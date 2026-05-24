import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { DishCategory } from '../constants';

interface IngredientInput {
  stockItemId: number;
  quantityNeeded: number;
}

interface VariantInput {
  name: string;
  price: number;
  isActive?: boolean;
  sortOrder?: number;
  ingredients?: IngredientInput[];
}

interface DishInput {
  name: string;
  description?: string;
  price: number;
  priceType?: 'fixe' | 'libre';
  priceMin?: number;
  priceMax?: number;
  category?: DishCategory;
  preparationTime?: number;
  isActive?: boolean;
  imageUrl?: string;
  ingredients?: IngredientInput[];
  variants?: VariantInput[];
}

const stockSelect = { select: { id: true, name: true, unit: true, quantity: true, unitCost: true } } as const;
const dishInclude = {
  ingredients: { include: { stockItem: stockSelect } },
  variants: {
    orderBy: { sortOrder: 'asc' as const },
    include: { ingredients: { include: { stockItem: stockSelect } } },
  },
} as const;

type DishPayload = Prisma.DishGetPayload<{ include: typeof dishInclude }>;

// Coût de revient d'une recette = Σ (quantité d'ingrédient × coût unitaire), arrondi au FCFA.
function recipeCost(ingredients: { quantityNeeded: number; stockItem: { unitCost: number } }[]): number {
  return Math.round(ingredients.reduce((s, i) => s + i.quantityNeeded * (i.stockItem?.unitCost ?? 0), 0));
}

// Annote un plat (et ses variantes) de son coût de revient calculé.
function withCost(dish: DishPayload) {
  return {
    ...dish,
    costPrice: recipeCost(dish.ingredients),
    variants: dish.variants.map((v) => ({ ...v, costPrice: recipeCost(v.ingredients) })),
  };
}

export async function listDishes() {
  const dishes = await prisma.dish.findMany({ orderBy: { name: 'asc' }, include: dishInclude });
  return dishes.map(withCost);
}

export async function getDish(id: number) {
  const dish = await prisma.dish.findUnique({ where: { id }, include: dishInclude });
  if (!dish) throw new AppError(404, 'DISH_001');
  return withCost(dish);
}

// Disponibilite : actif ET stock suffisant pour la quantite demandee (§13.1 regle 3).
export async function isDishAvailable(dishId: number, quantity = 1): Promise<boolean> {
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    include: { ingredients: { include: { stockItem: true } } },
  });
  if (!dish) throw new AppError(404, 'DISH_001');
  if (!dish.isActive) return false;
  for (const ing of dish.ingredients) {
    if (ing.stockItem.quantity < ing.quantityNeeded * quantity) return false;
  }
  return true;
}

// Menu pour la caisse : plats actifs + variantes, annotes d'un flag de disponibilite.
export async function listMenuWithAvailability() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      ingredients: { include: { stockItem: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { ingredients: { include: { stockItem: true } } },
      },
    },
  });
  return dishes.map((dish) => {
    const variants = dish.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      available: v.ingredients.every((ing) => ing.stockItem.quantity >= ing.quantityNeeded),
    }));
    const hasVariants = variants.length > 0;
    const available = hasVariants
      ? variants.some((v) => v.available)
      : dish.ingredients.every((ing) => ing.stockItem.quantity >= ing.quantityNeeded);
    return {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price,
      priceType: dish.priceType,
      priceMin: dish.priceMin,
      priceMax: dish.priceMax,
      category: dish.category,
      imageUrl: dish.imageUrl,
      available,
      variants,
    };
  });
}

function variantCreateData(variants: VariantInput[]) {
  return variants.map((v, idx) => ({
    name: v.name,
    price: v.price,
    isActive: v.isActive ?? true,
    sortOrder: v.sortOrder ?? idx,
    ingredients: v.ingredients?.length
      ? { create: v.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })) }
      : undefined,
  }));
}

export async function createDish(data: DishInput) {
  const isLibre = data.priceType === 'libre';
  return prisma.dish.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      priceType: data.priceType ?? 'fixe',
      priceMin: isLibre ? data.priceMin ?? null : null,
      priceMax: isLibre ? data.priceMax ?? null : null,
      category: data.category,
      preparationTime: data.preparationTime,
      isActive: data.isActive ?? true,
      imageUrl: data.imageUrl || null,
      ingredients: data.ingredients
        ? { create: data.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })) }
        : undefined,
      // Un plat à prix libre n'a pas de variantes.
      variants: !isLibre && data.variants ? { create: variantCreateData(data.variants) } : undefined,
    },
    include: dishInclude,
  });
}

export async function updateDish(id: number, data: DishInput) {
  await getDish(id);
  return prisma.$transaction(async (tx) => {
    if (data.ingredients) {
      await tx.dishIngredient.deleteMany({ where: { dishId: id } });
      await tx.dishIngredient.createMany({
        data: data.ingredients.map((i) => ({ dishId: id, stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })),
      });
    }
    if (data.priceType === 'libre') {
      // Bascule en prix libre : on retire toute variante (incompatible).
      await tx.dishVariant.deleteMany({ where: { dishId: id } });
    } else if (data.variants) {
      // Remplace les variantes (les anciennes commandes gardent variantName ; variantId passe à null).
      await tx.dishVariant.deleteMany({ where: { dishId: id } });
      for (const [idx, v] of data.variants.entries()) {
        await tx.dishVariant.create({
          data: {
            dishId: id,
            name: v.name,
            price: v.price,
            isActive: v.isActive ?? true,
            sortOrder: v.sortOrder ?? idx,
            ingredients: v.ingredients?.length
              ? { create: v.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })) }
              : undefined,
          },
        });
      }
    }
    return tx.dish.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.priceType !== undefined
          ? {
              priceType: data.priceType,
              priceMin: data.priceType === 'libre' ? data.priceMin ?? null : null,
              priceMax: data.priceType === 'libre' ? data.priceMax ?? null : null,
            }
          : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.preparationTime !== undefined ? { preparationTime: data.preparationTime } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
      },
      include: dishInclude,
    });
  });
}

export async function toggleActive(id: number) {
  const dish = await getDish(id);
  return prisma.dish.update({ where: { id }, data: { isActive: !dish.isActive }, include: dishInclude });
}

export async function deleteDish(id: number) {
  await getDish(id);
  const activeOrderItem = await prisma.orderItem.findFirst({
    where: { dishId: id, order: { status: { in: ['commandée', 'en_cours', 'prête'] } } },
  });
  if (activeOrderItem) {
    throw new AppError(400, 'DISH_002', 'Plat présent dans une commande en cours, suppression impossible');
  }
  await prisma.dishIngredient.deleteMany({ where: { dishId: id } });
  await prisma.dishVariant.deleteMany({ where: { dishId: id } });
  await prisma.dish.delete({ where: { id } });
  return { id };
}
