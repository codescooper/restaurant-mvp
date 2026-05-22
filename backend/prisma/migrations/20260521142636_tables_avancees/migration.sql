-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "bill_requested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "table_id" INTEGER NOT NULL,
    "customer_name" VARCHAR(100) NOT NULL,
    "customer_phone" VARCHAR(30),
    "party_size" INTEGER,
    "reserved_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_reservations_table" ON "reservations"("table_id", "status");

-- CreateIndex
CREATE INDEX "idx_reservations_date" ON "reservations"("reserved_at");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
