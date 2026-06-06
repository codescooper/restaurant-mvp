-- AlterTable
ALTER TABLE "articles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "catalog_requests" ALTER COLUMN "restaurant_id" DROP NOT NULL,
ALTER COLUMN "platforms" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "budget_category" VARCHAR(50);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "period_label" VARCHAR(60) NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "target_total" INTEGER NOT NULL,
    "reserve_percent" INTEGER NOT NULL DEFAULT 20,
    "status" VARCHAR(20) NOT NULL DEFAULT 'brouillon',
    "conclusion" TEXT,
    "ai_suggestions" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "restaurant_id" INTEGER,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_sections" (
    "id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "budget_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_postes" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "planned_amount" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "budget_postes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" SERIAL NOT NULL,
    "poste_id" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "stock_item_id" INTEGER,
    "quantity" DOUBLE PRECISION,
    "unit" VARCHAR(20),
    "unit_price" INTEGER,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manuel',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_budgets_restaurant" ON "budgets"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_budget_sections_budget" ON "budget_sections"("budget_id");

-- CreateIndex
CREATE INDEX "idx_budget_postes_section" ON "budget_postes"("section_id");

-- CreateIndex
CREATE INDEX "idx_budget_lines_poste" ON "budget_lines"("poste_id");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_sections" ADD CONSTRAINT "budget_sections_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_postes" ADD CONSTRAINT "budget_postes_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "budget_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "budget_postes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
