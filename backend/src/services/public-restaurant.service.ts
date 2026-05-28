import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { getBrandingFor } from './settings.service';

export async function getPublicRestaurant(slug: string) {
  const restaurant = await basePrisma.restaurant.findUnique({ where: { slug } });
  // Page publique disponible UNIQUEMENT pour un resto actif.
  if (!restaurant || restaurant.status !== 'active') {
    throw new AppError(404, 'PUBLIC_001', 'Restaurant introuvable ou indisponible');
  }
  const branding = await getBrandingFor(restaurant.id);

  // Plats actifs + ingrédients (pour calcul dispo) + stock courant.
  const dishes = await basePrisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    include: { ingredients: { include: { stockItem: { select: { quantity: true } } } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  // Dispo : un plat est disponible s'il n'a pas d'ingrédient OU si tous ses ingrédients
  // ont un stock >= quantité nécessaire pour 1 portion.
  const menuDishes = dishes.map((d) => {
    const available = d.ingredients.length === 0
      || d.ingredients.every((ing) => ing.stockItem.quantity >= ing.quantityNeeded);
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      price: d.price,
      priceType: d.priceType,
      priceMin: d.priceMin,
      priceMax: d.priceMax,
      imageUrl: d.imageUrl,
      category: d.category ?? 'Autres',
      available,
    };
  });

  // Regrouper par catégorie en préservant l'ordre d'apparition.
  const categoriesMap = new Map<string, typeof menuDishes>();
  for (const dish of menuDishes) {
    if (!categoriesMap.has(dish.category)) categoriesMap.set(dish.category, []);
    categoriesMap.get(dish.category)!.push(dish);
  }
  const menu = Array.from(categoriesMap.entries()).map(([category, items]) => ({ category, items }));

  return {
    name: restaurant.name,
    slug: restaurant.slug,
    branding,
    menu,
  };
}
