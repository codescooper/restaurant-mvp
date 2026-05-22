-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tip_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tip_method" VARCHAR(20);
