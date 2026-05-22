-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "is_offered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "promo_label" VARCHAR(60),
ADD COLUMN     "promotion_id" INTEGER;

-- CreateTable
CREATE TABLE "promotions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "discount_type" VARCHAR(10) NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_hour" INTEGER,
    "end_hour" INTEGER,
    "days" VARCHAR(30),
    "code" VARCHAR(30),
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
