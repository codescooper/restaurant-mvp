-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variant_id" INTEGER,
ADD COLUMN     "variant_name" VARCHAR(50);

-- CreateTable
CREATE TABLE "dish_variants" (
    "id" SERIAL NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "price" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dish_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_ingredients" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "stock_item_id" INTEGER NOT NULL,
    "quantity_needed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "variant_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dish_variants_dish" ON "dish_variants"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_ingredients_variant_id_stock_item_id_key" ON "variant_ingredients"("variant_id", "stock_item_id");

-- AddForeignKey
ALTER TABLE "dish_variants" ADD CONSTRAINT "dish_variants_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_ingredients" ADD CONSTRAINT "variant_ingredients_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "dish_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_ingredients" ADD CONSTRAINT "variant_ingredients_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "dish_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
