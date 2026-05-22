-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "channel" VARCHAR(20) NOT NULL DEFAULT 'sur_place',
ADD COLUMN     "customer_name" VARCHAR(100),
ADD COLUMN     "customer_phone" VARCHAR(30),
ADD COLUMN     "delivery_platform" VARCHAR(20),
ADD COLUMN     "tax_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
