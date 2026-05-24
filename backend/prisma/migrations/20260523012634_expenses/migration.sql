-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "amount" INTEGER NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "payment_method" VARCHAR(20),
    "note" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_expenses_date" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "idx_expenses_category" ON "expenses"("category");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
