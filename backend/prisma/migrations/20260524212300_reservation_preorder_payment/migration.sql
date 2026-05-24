-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "deposit_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deposit_at" TIMESTAMP(3),
ADD COLUMN     "deposit_cash_session_id" INTEGER,
ADD COLUMN     "deposit_method" VARCHAR(20),
ADD COLUMN     "has_pre_order" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payment_status" VARCHAR(15) NOT NULL DEFAULT 'aucun',
ADD COLUMN     "total_amount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reservation_items" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "dish_id" INTEGER,
    "dish_name" VARCHAR(100) NOT NULL,
    "dish_price" INTEGER NOT NULL,
    "variant_id" INTEGER,
    "variant_name" VARCHAR(50),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "subtotal" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "reservation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_reservation_items_res" ON "reservation_items"("reservation_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_cash_session_id_fkey" FOREIGN KEY ("deposit_cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "dish_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
