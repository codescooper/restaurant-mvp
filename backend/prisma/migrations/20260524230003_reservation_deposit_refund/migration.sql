-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "deposit_refunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deposit_refunded_at" TIMESTAMP(3);
