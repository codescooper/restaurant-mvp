-- Demandes de référencement (annuaire) — scopées par restaurant (tenant).

CREATE TABLE "catalog_requests" (
  "id"            SERIAL PRIMARY KEY,
  "restaurant_id" INTEGER      NOT NULL,
  "platforms"     TEXT[]       NOT NULL DEFAULT '{}',
  "message"       TEXT,
  "status"        VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "admin_note"    TEXT,
  "created_by"    INTEGER,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at"  TIMESTAMP(3)
);

CREATE INDEX "idx_catalog_requests_restaurant_status" ON "catalog_requests"("restaurant_id", "status");
CREATE INDEX "idx_catalog_requests_status"            ON "catalog_requests"("status");

ALTER TABLE "catalog_requests"
  ADD CONSTRAINT "catalog_requests_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_requests"
  ADD CONSTRAINT "catalog_requests_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
