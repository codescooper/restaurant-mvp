-- Paiement mixte M1 : table order_payments (source de vérité des encaissements).
-- 1 commande mono-moyen = 1 ligne ; mixte = N lignes. Somme = finalTotal − depositApplied.

CREATE TABLE "order_payments" (
  "id"                    SERIAL PRIMARY KEY,
  "order_id"              INTEGER NOT NULL,
  "method"                VARCHAR(20) NOT NULL,
  "amount"                INTEGER NOT NULL,
  "mobile_money_provider" VARCHAR(20),
  "cash_given"            INTEGER,
  "change_returned"       INTEGER,
  "restaurant_id"         INTEGER,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_order_payments_order" ON "order_payments"("order_id");
CREATE INDEX "idx_order_payments_restaurant_method" ON "order_payments"("restaurant_id","method");

ALTER TABLE "order_payments"
  ADD CONSTRAINT "order_payments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_payments"
  ADD CONSTRAINT "order_payments_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill : 1 ligne de paiement par commande déjà payée (montant net d'acompte).
INSERT INTO "order_payments"
  ("order_id","method","amount","mobile_money_provider","cash_given","change_returned","restaurant_id","created_at")
SELECT
  "id",
  "payment_method",
  ("final_total" - "deposit_applied"),
  "mobile_money_provider",
  "cash_given",
  "change_returned",
  "restaurant_id",
  COALESCE("paid_at","created_at")
FROM "orders"
WHERE "is_paid" = true
  AND "payment_method" IS NOT NULL;
