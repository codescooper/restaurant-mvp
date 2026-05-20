import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { DishCategory } from '../constants';

interface IngredientInput {
  stockItemId: number;
  quantityNeeded: number;
}

interface DishInput {
  name: string;
  description?: string;
  price: number;
  category?: DishCategory;
  preparationTime?: number;
  isActive?: boolean;
  ingredients?: IngredientInput[];
}

const dishInclude = {
  ingredients: { include: { stockItem: { select: { id: true, name: true, unit: true, quantity: true } } } },
} as const;

export async function listDishes() {
  return prisma.dish.findMany({ orderBy: { name: 'asc' }, include: dishInclude });
}

export async function getDish(id: number) {
  const dish = await prisma.dish.findUnique({ where: { id }, include: dishInclude });
  if (!dish) throw new AppError(404, 'DISH_001');
  return dish;
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

// Menu pour la caisse : plats actifs annotes d'un flag de disponibilite.
export async function listMenuWithAvailability() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { ingredients: { include: { stockItem: true } } },
  });
  return dishes.map((dish) => {
    const available = dish.ingredients.every((ing) => ing.stockItem.quantity >= ing.quantityNeeded);
    return {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price,
      category: dish.category,
      imageUrl: dish.imageUrl,
      available,
    };
  });
}

export async function createDish(data: DishInput) {
  return prisma.dish.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      preparationTime: data.preparationTime,
      isActive: data.isActive ?? true,
      ingredients: data.ingredients
        ? { create: data.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })) }
        : undefined,
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
    return tx.dish.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.preparationTime !== undefined ? { preparationTime: data.preparationTime } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
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
  await prisma.dish.delete({ where: { id } });
  return { id };
}
