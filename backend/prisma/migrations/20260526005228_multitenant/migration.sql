-- DropIndex
DROP INDEX "app_settings_setting_key_key";

-- DropIndex
DROP INDEX "orders_order_number_key";

-- DropIndex
DROP INDEX "promotions_code_key";

-- DropIndex
DROP INDEX "tables_name_key";

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable: ajouter restaurant_id aux tables tenant
ALTER TABLE "app_settings" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "audit_logs" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "cash_sessions" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "dishes" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "employees" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "expenses" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "inventories" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "notifications" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "orders" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "promotions" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "purchases" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "reservations" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "stock_items" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "stock_movements" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "suppliers" ADD COLUMN "restaurant_id" INTEGER;

ALTER TABLE "tables" ADD COLUMN "restaurant_id" INTEGER;

-- AlterTable users: ajouter les nouvelles colonnes (email nullable pour permettre le backfill)
ALTER TABLE "users"
ADD COLUMN "display_name" VARCHAR(80),
ADD COLUMN "email" VARCHAR(190),
ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "restaurant_id" INTEGER;

-- CreateTable
CREATE TABLE "restaurants" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE INDEX "idx_memberships_restaurant" ON "memberships"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_restaurant_id_key" ON "memberships"("user_id", "restaurant_id");

-- ===== BACKFILL multi-tenant : rattacher l'existant au restaurant #1 =====
INSERT INTO "restaurants" ("id","name","slug","status","created_at")
VALUES (1, 'Restaurant Pilote', 'restaurant-pilote', 'active', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"restaurants"','id'), 1, true);

UPDATE "dishes"          SET "restaurant_id" = 1;
UPDATE "stock_items"     SET "restaurant_id" = 1;
UPDATE "orders"          SET "restaurant_id" = 1;
UPDATE "tables"          SET "restaurant_id" = 1;
UPDATE "cash_sessions"   SET "restaurant_id" = 1;
UPDATE "reservations"    SET "restaurant_id" = 1;
UPDATE "promotions"      SET "restaurant_id" = 1;
UPDATE "expenses"        SET "restaurant_id" = 1;
UPDATE "employees"       SET "restaurant_id" = 1;
UPDATE "suppliers"       SET "restaurant_id" = 1;
UPDATE "purchases"       SET "restaurant_id" = 1;
UPDATE "inventories"     SET "restaurant_id" = 1;
UPDATE "notifications"   SET "restaurant_id" = 1;
UPDATE "audit_logs"      SET "restaurant_id" = 1;
UPDATE "app_settings"    SET "restaurant_id" = 1;
UPDATE "stock_movements" SET "restaurant_id" = 1;

UPDATE "users" SET
  "display_name" = "username",
  "email" = lower("username") || '@restaurant-pilote.local',
  "restaurant_id" = 1
WHERE "email" IS NULL;

INSERT INTO "memberships" ("user_id","restaurant_id","role","is_active","created_at")
SELECT "id", 1,
       CASE WHEN "role" = 'administrateur' THEN 'propriétaire' ELSE "role" END,
       "is_active", CURRENT_TIMESTAMP
FROM "users";
-- ===== fin BACKFILL =====

-- AlterTable users: supprimer les anciennes colonnes et rendre email NOT NULL
ALTER TABLE "users"
DROP COLUMN "role",
DROP COLUMN "username";

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_app_settings_restaurant" ON "app_settings"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_restaurant_id_setting_key_key" ON "app_settings"("restaurant_id", "setting_key");

-- CreateIndex
CREATE INDEX "idx_audit_logs_restaurant" ON "audit_logs"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_cash_sessions_restaurant" ON "cash_sessions"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_dishes_restaurant" ON "dishes"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_employees_restaurant" ON "employees"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_expenses_restaurant" ON "expenses"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_inventories_restaurant" ON "inventories"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_notifications_restaurant" ON "notifications"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_orders_restaurant" ON "orders"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_restaurant_id_order_number_key" ON "orders"("restaurant_id", "order_number");

-- CreateIndex
CREATE INDEX "idx_promotions_restaurant" ON "promotions"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_restaurant_id_code_key" ON "promotions"("restaurant_id", "code");

-- CreateIndex
CREATE INDEX "idx_purchases_restaurant" ON "purchases"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_reservations_restaurant" ON "reservations"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_stock_items_restaurant" ON "stock_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_stock_movements_restaurant" ON "stock_movements"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_suppliers_restaurant" ON "suppliers"("restaurant_id");

-- CreateIndex
CREATE INDEX "idx_tables_restaurant" ON "tables"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tables_restaurant_id_name_key" ON "tables"("restaurant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
