-- Clé d'idempotence des commandes hors-ligne (dédup des rejeux de sync).
ALTER TABLE "orders" ADD COLUMN "client_id" VARCHAR(64);
CREATE UNIQUE INDEX "orders_client_id_key" ON "orders"("client_id");
