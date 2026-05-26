-- DishVariant.price devient optionnel pour autoriser les variantes sur plat a prix libre.
ALTER TABLE "dish_variants" ALTER COLUMN "price" DROP NOT NULL;
