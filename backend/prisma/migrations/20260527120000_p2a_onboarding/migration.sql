-- P2a Onboarding & invitations

-- Lifecycle fields on restaurants
ALTER TABLE "restaurants" ADD COLUMN "activated_at" TIMESTAMP(3);
ALTER TABLE "restaurants" ADD COLUMN "rejected_at" TIMESTAMP(3);
ALTER TABLE "restaurants" ADD COLUMN "rejected_reason" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "restaurants" ADD COLUMN "suspended_reason" TEXT;

-- Baseline quantity on stock items
ALTER TABLE "stock_items" ADD COLUMN "baseline_quantity" DOUBLE PRECISION;

-- Invitations
CREATE TABLE "invitations" (
  "id"            SERIAL PRIMARY KEY,
  "restaurant_id" INTEGER NOT NULL,
  "email"         VARCHAR(190) NOT NULL,
  "role"          VARCHAR(20) NOT NULL,
  "token"         VARCHAR(64) NOT NULL,
  "status"        VARCHAR(20) NOT NULL DEFAULT 'pending',
  "expires_at"    TIMESTAMP(3) NOT NULL,
  "created_by"    INTEGER,
  "accepted_at"   TIMESTAMP(3),
  "revoked_at"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");
CREATE INDEX "idx_invitations_restaurant_status" ON "invitations"("restaurant_id", "status");
CREATE INDEX "idx_invitations_email_status" ON "invitations"("email", "status");

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
