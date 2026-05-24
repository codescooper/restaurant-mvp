-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deposit_applied" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "deposit_consumed" BOOLEAN NOT NULL DEFAULT false;
