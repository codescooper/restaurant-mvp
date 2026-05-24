-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "price_max" INTEGER,
ADD COLUMN     "price_min" INTEGER,
ADD COLUMN     "price_type" VARCHAR(10) NOT NULL DEFAULT 'fixe';
