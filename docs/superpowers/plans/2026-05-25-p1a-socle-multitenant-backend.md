# Plan A — Socle multi-tenant backend (P1) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le backend multi-tenant et étanche : chaque donnée appartient à un restaurant, toutes les requêtes sont filtrées automatiquement, l'auth se fait par email avec un rôle par restaurant, et l'isolation est prouvée par des tests.

**Architecture:** Base partagée + colonne `restaurantId`. Isolation par **stratégie A** : un `AsyncLocalStorage` porte le `restaurantId` du request ; une **extension Prisma Client** injecte automatiquement le filtre `restaurantId` (lectures, agrégations, créations, `updateMany`/`deleteMany`) et **refuse par défaut** toute requête tenant hors contexte. Les rooms WebSocket et les helpers d'émission lisent le `restaurantId` depuis le même contexte. L'auth émet un JWT scopé `{ userId, isSuperAdmin, restaurantId, role }`.

**Tech Stack:** Node 22, Express 4, Prisma 5.22 (PostgreSQL), Socket.io 4, JWT, bcrypt, Zod, Vitest 2 + Supertest.

**Périmètre :** backend uniquement. La bascule frontend (login par email, sélecteur de restaurant, reconnexion socket) fait l'objet du **Plan B**. Après ce plan, l'API parle « email » : l'ancien frontend (login par `username`) sera temporairement cassé jusqu'au Plan B — c'est attendu. Les invitations (P2) et la personnalisation (P3) ne sont **pas** dans ce plan ; seules les entités `Restaurant` et `Membership` sont introduites ici (pas `Invitation` ni `RestaurantBranding`).

**Référence design :** `docs/superpowers/specs/2026-05-25-plateforme-multitenant-design.md`

---

## Carte des fichiers

**Créés :**
- `backend/src/config/tenant-context.ts` — `AsyncLocalStorage` du contexte tenant + helpers `runWithTenant`, `getTenantId`, `getTenantIdOrThrow`, `runUnscoped`.
- `backend/src/config/prisma-extension.ts` — l'extension Prisma d'isolation (liste des modèles tenant + injection du filtre).
- `backend/src/middlewares/tenant.ts` — middleware Express qui ouvre le contexte tenant à partir du JWT.
- `backend/src/services/membership.service.ts` — lecture des memberships d'un utilisateur (auth) et helpers.
- `backend/src/__tests__/integration/helpers.ts` — réinitialise la base de test + sème 2 restaurants.
- `backend/src/__tests__/integration/isolation.test.ts` — suite d'isolation (cœur de la preuve).
- `backend/src/__tests__/integration/auth.test.ts` — login/switch/membership/super-admin.
- `backend/vitest.integration.config.ts` — config Vitest pour les tests d'intégration (base de test).
- `backend/.env.test.example` — gabarit de `DATABASE_URL` de test.

**Modifiés :**
- `backend/prisma/schema.prisma` — nouveaux modèles + `restaurantId` partout + unicités.
- `backend/prisma/seed.ts` — super-admin + restaurant #1 + memberships + données scopées.
- `backend/src/config/prisma.ts` — exporte `basePrisma` (brut) et `prisma` (scopé).
- `backend/src/config/env.ts` — variables super-admin + base de test.
- `backend/src/utils/jwt.ts` — payload JWT enrichi.
- `backend/src/middlewares/auth.ts` — `req.membership`, `requireRole` lit le rôle du membership.
- `backend/src/services/auth.service.ts` — login par email + memberships + switch.
- `backend/src/controllers/auth.controller.ts` + `backend/src/routes/auth.routes.ts` — endpoints login/switch/me.
- `backend/src/websocket/index.ts` — rooms `r:{restaurantId}:{role}`, émission scopée par contexte.
- `backend/src/services/user.service.ts` — gestion des membres du restaurant courant.
- `backend/src/services/notification.service.ts` — `markAsRead` scopé.
- `backend/src/services/stats.service.ts`, `cash.service.ts`, `audit.service.ts` — `username` → `displayName`, retrait de `role`.
- `backend/src/validators/schemas.ts` — `loginSchema` (email), `switchRestaurantSchema`, schémas membres.
- `backend/src/app.ts` — branchement du middleware tenant.
- `backend/package.json` — scripts de tests d'intégration + `dotenv-cli`.

**Découpage en milestones** (chacun se termine par un état compilable + testé + un commit) :
- **M1** — Schéma, migration, seed.
- **M2** — Infra d'isolation (contexte + extension + clients + middleware).
- **M3** — Auth multi-tenant + WebSocket scopé.
- **M4** — Adaptations des services (`username`→`displayName`, users→membres, hardening).
- **M5** — Harnais d'intégration + suite d'isolation (la preuve).

---

## MILESTONE 1 — Schéma, migration, seed

> But : la base contient `Restaurant`/`Membership`, un `restaurantId` non-null sur toutes les entités tenant, les unicités corrigées, et les données existantes rattachées au restaurant #1. La migration est rejouable et préserve les données.

### Task 1.1 : Variables d'environnement (super-admin + base de test)

**Files:**
- Modify: `backend/src/config/env.ts`
- Create: `backend/.env.test.example`

- [ ] **Step 1: Ajouter les variables d'env**

Dans `backend/src/config/env.ts`, ajouter à l'objet `env` (après `corsOrigin`) :

```typescript
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Bootstrap du super-admin plateforme (créé/mis à jour par le seed).
  superadminEmail: process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local',
  superadminPassword: process.env.SUPERADMIN_PASSWORD ?? 'superadmin123',
  // URL de base pour fabriquer les liens (utilisée en P2 ; définie ici pour centraliser).
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
};
```

- [ ] **Step 2: Créer le gabarit `.env.test.example`**

```
# Base PostgreSQL DÉDIÉE AUX TESTS (jamais la base de dev/prod).
# Cluster local PG18 sur le port 5433.
DATABASE_URL="postgresql://restaurant:restaurant@localhost:5433/restaurant_test?schema=public"
JWT_SECRET=test_jwt_secret
JWT_REFRESH_SECRET=test_refresh_secret
SUPERADMIN_EMAIL=superadmin@plateforme.local
SUPERADMIN_PASSWORD=superadmin123
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd backend && npm run type-check`
Expected: PASS (aucune erreur).

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/env.ts backend/.env.test.example
git commit -m "feat(multitenant): variables d'env super-admin et base de test"
```

### Task 1.2 : Modèles `Restaurant` et `Membership` + refonte `User`

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Ajouter les modèles `Restaurant` et `Membership`**

En tête des modèles (après le bloc `datasource`/`generator`), ajouter :

```prisma
// Restaurant = tenant. Toutes les entités opérationnelles lui appartiennent via restaurantId.
model Restaurant {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(120)
  slug      String   @unique @db.VarChar(140)
  status    String   @default("active") @db.VarChar(20) // 'pending' | 'active' | 'suspended'
  createdAt DateTime @default(now()) @map("created_at")

  memberships    Membership[]
  users          User[]          // utilisateurs dont c'est le restaurant "principal" historique (nullable)
  dishes         Dish[]
  stockItems     StockItem[]
  orders         Order[]
  tables         Table[]
  cashSessions   CashSession[]
  reservations   Reservation[]
  promotions     Promotion[]
  expenses       Expense[]
  employees      Employee[]
  suppliers      Supplier[]
  purchases      Purchase[]
  inventories    Inventory[]
  notifications  Notification[]
  auditLogs      AuditLog[]
  appSettings    AppSetting[]
  stockMovements StockMovement[]

  @@map("restaurants")
}

// Appartenance d'un utilisateur à un restaurant, avec son rôle dans ce restaurant.
model Membership {
  id           Int      @id @default(autoincrement())
  userId       Int      @map("user_id")
  restaurantId Int      @map("restaurant_id")
  role         String   @db.VarChar(20) // 'propriétaire' | 'administrateur' | 'caissier' | 'cuisinier' | 'serveur'
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  @@unique([userId, restaurantId])
  @@index([restaurantId], map: "idx_memberships_restaurant")
  @@map("memberships")
}
```

- [ ] **Step 2: Refondre le modèle `User`** (login par email, rôle déplacé, super-admin)

Remplacer les champs scalaires du modèle `User` (lignes ~16-22) par :

```prisma
model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique @db.VarChar(190)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  displayName  String?   @map("display_name") @db.VarChar(80)
  isSuperAdmin Boolean   @default(false) @map("is_super_admin")
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at")
  lastLogin    DateTime? @map("last_login")

  // Restaurant "principal" historique (nullable, info ; le contexte vient des memberships).
  restaurantId Int?      @map("restaurant_id")
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id])
  memberships  Membership[]
```

> NE PAS toucher aux relations existantes de `User` (createdOrders, servedOrders, etc.) qui suivent juste après — elles restent. Le champ `role` et le champ `username` sont SUPPRIMÉS.

- [ ] **Step 3: Vérifier la cohérence Prisma (sans migrer encore)**

Run: `cd backend && npx prisma validate`
Expected: échec attendu car les modèles tenant n'ont pas encore `restaurantId` (relations inverses déclarées dans `Restaurant`). On corrige ça en Task 1.3 avant toute migration. (Si `prisma validate` signale des relations manquantes, c'est normal à ce stade.)

> Pas de commit ici : le schéma est volontairement incomplet jusqu'à 1.3.

### Task 1.3 : Ajouter `restaurantId` à toutes les entités tenant

> **Décision de typage (raffine le spec) :** `restaurantId` reste **optionnel** (`Int?`) dans le schéma Prisma — et donc la colonne DB reste nullable. Raison : si le champ était requis, le type `XCreateInput` généré par Prisma exigerait `restaurantId` sur **tous** les `create` des ~17 services (gros churn) ; en le gardant optionnel, les services restent **inchangés** et l'**extension** (M2) devient le **point d'enforcement unique** (elle injecte `restaurantId` sur chaque création et refuse toute requête tenant hors contexte). C'est cohérent avec la philosophie de la stratégie A. Les tests d'isolation (M5) garantissent qu'aucune écriture ne se fait sans `restaurantId`. On renonce volontairement au `NOT NULL` au niveau base au profit de cet enforcement centralisé.

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Ajouter le champ + la relation + un index sur chaque modèle tenant**

Pour **chacun** de ces 16 modèles — `Dish, StockItem, Order, Table, CashSession, Reservation, Promotion, Expense, Employee, Supplier, Purchase, Inventory, Notification, AuditLog, AppSetting, StockMovement` — ajouter ces 2 lignes (dans le corps du modèle, avec les autres scalaires, et la relation avec les autres relations) :

```prisma
  restaurantId Int?       @map("restaurant_id")
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id])
```

et un index dans le bloc `@@` du modèle :

```prisma
  @@index([restaurantId], map: "idx_<table>_restaurant")
```

(remplacer `<table>` par le nom de table mappé : `dishes`, `stock_items`, `orders`, `tables`, `cash_sessions`, `reservations`, `promotions`, `expenses`, `employees`, `suppliers`, `purchases`, `inventories`, `notifications`, `audit_logs`, `app_settings`, `stock_movements`).

- [ ] **Step 2: Corriger les unicités globales (les rendre par-restaurant)**

- `Table` : retirer `@unique` sur `name` (la ligne devient `name String @db.VarChar(50)`) et ajouter dans le bloc `@@` : `@@unique([restaurantId, name])`.
- `Promotion` : retirer `@unique` sur `code` (devient `code String? @db.VarChar(30)`) et ajouter `@@unique([restaurantId, code])`.
- `Order` : retirer `@unique` sur `orderNumber` (devient `orderNumber String @map("order_number") @db.VarChar(20)`) et ajouter `@@unique([restaurantId, orderNumber])`.
- `AppSetting` : retirer `@unique` sur `settingKey` (devient `settingKey String @map("setting_key") @db.VarChar(50)`) et ajouter `@@unique([restaurantId, settingKey])`.

> ⚠️ `@@unique` avec une colonne nullable (`restaurantId Int?`) : Postgres autorise plusieurs NULL, mais en pratique l'extension écrit **toujours** un `restaurantId` non-null → l'unicité composée `(restaurantId, name)` est effective pour toutes les lignes créées par l'app. C'est le comportement voulu (deux restaurants peuvent avoir une « Table 1 »).

- [ ] **Step 3: Valider le schéma**

Run: `cd backend && npx prisma validate`
Expected: PASS (« The schema at prisma/schema.prisma is valid »).

- [ ] **Step 4: Vérifier qu'aucune relation inverse ne manque côté `Restaurant`**

Run: `cd backend && npx prisma format`
Expected: pas d'ajout de champ surprise ; `prisma validate` repasse OK. Si `format` ajoute des relations inverses manquantes, les conserver.

- [ ] **Step 5: Commit (schéma uniquement, pas encore migré)**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(multitenant): schema Restaurant/Membership + restaurantId nullable partout"
```

### Task 1.4 : Migration — créer les colonnes + backfill restaurant #1

> Stratégie : laisser **Prisma générer** la structure (tables, colonnes nullable, suppression des anciens index uniques, création des index uniques composés, FKs, colonnes `users`, suppression de `username`/`role`), puis **insérer un bloc de backfill** au bon endroit pour préserver les données. On n'écrit pas la structure à la main (source d'erreurs) — seulement le backfill.

**Files:**
- Create/Modify: `backend/prisma/migrations/<timestamp>_multitenant/migration.sql` (généré puis édité)

- [ ] **Step 1: Générer la migration SANS l'appliquer**

Run: `cd backend && npx prisma migrate dev --name multitenant --create-only`
Expected: un dossier `prisma/migrations/<timestamp>_multitenant/` avec `migration.sql`. Il contient (ordre Prisma) : `CREATE TABLE "restaurants"` et `"memberships"` ; `ALTER TABLE ... ADD COLUMN "restaurant_id"` (nullable) sur les 16 tables tenant ; sur `users` l'ajout de `email/display_name/is_super_admin/restaurant_id`, le `DROP COLUMN "username"`/`"role"`, la suppression de `users_username_key`, la création de `users_email_key` ; la suppression des index uniques simples (`tables_name_key`, `promotions_code_key`, `orders_order_number_key`, `app_settings_setting_key_key`) et la création des index uniques composés ; les FKs `*_restaurant_id_fkey` et les index `idx_*_restaurant`.

- [ ] **Step 2: INSÉRER le bloc de backfill au bon endroit**

⚠️ Tel quel, le SQL généré **détruit les données** (`DROP COLUMN username/role`) et **viole les FK/unique** (lignes existantes sans `restaurant_id`, sans `email`). Il faut insérer ce bloc **APRÈS** tous les `ADD COLUMN` (les colonnes `restaurant_id` sur les tables tenant ET `email/display_name/restaurant_id` sur `users` doivent déjà exister) et **AVANT** : tout `DROP COLUMN "username"`/`"role"`, la création de `users_email_key`, et l'ajout des contraintes FK `*_restaurant_id_fkey`.

Bloc à insérer (le seul SQL écrit à la main) :

```sql
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

-- Backfill users : email/displayName depuis username, restaurant principal #1
UPDATE "users" SET
  "display_name" = "username",
  "email" = lower("username") || '@restaurant-pilote.local',
  "restaurant_id" = 1
WHERE "email" IS NULL;

-- Un membership par utilisateur existant ; l'admin devient propriétaire (lit username/role AVANT leur DROP)
INSERT INTO "memberships" ("user_id","restaurant_id","role","is_active","created_at")
SELECT "id", 1,
       CASE WHEN "role" = 'administrateur' THEN 'propriétaire' ELSE "role" END,
       "is_active", CURRENT_TIMESTAMP
FROM "users";
-- ===== fin BACKFILL =====
```

> Repère pratique : placer ce bloc juste avant la première ligne `DROP COLUMN "username"` (ou `CREATE UNIQUE INDEX "users_email_key"` si elle vient plus tôt). Si l'ordre généré met les `CREATE UNIQUE INDEX`/`ADD CONSTRAINT ... FOREIGN KEY` avant les `ADD COLUMN`, déplacer le bloc backfill juste après le dernier `ADD COLUMN` et avant ces contraintes. Postgres autorise plusieurs NULL sur un index unique, donc les index uniques composés (sur `restaurant_id` nullable) ne posent pas problème ; l'important est que le backfill `users` précède `users_email_key` et les FK.

- [ ] **Step 3: Appliquer la migration sur la base de dev**

Run: `cd backend && npx prisma migrate dev`
Expected: « Applying migration ... multitenant » puis génération du client Prisma sans erreur. (La base de dev locale est sur le cluster PG18 port 5433.) En cas d'échec FK/NULL, c'est que le bloc backfill est mal placé → corriger l'ordre et relancer sur une base restaurée.

- [ ] **Step 4: Vérifier le backfill**

Run: `cd backend && npx prisma studio` (ou requêtes SQL) et vérifier : `restaurants` contient 1 ligne (id=1) ; chaque table tenant a `restaurant_id = 1` partout ; `memberships` contient un membership par user (l'ancien admin en `propriétaire`) ; `users.email` rempli, `username`/`role` supprimés.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations backend/prisma/schema.prisma
git commit -m "feat(multitenant): migration + backfill des donnees existantes en restaurant #1"
```

### Task 1.5 : Réécrire le seed (super-admin + restaurant #1 + memberships + données scopées)

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Réécrire `seed.ts` intégralement**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed: nettoyage...');
  // Ordre FK. memberships avant users ; tout le tenant avant restaurants.
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dishIngredient.deleteMany();
  await prisma.dishVariant.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.syncQueue.deleteMany();
  await prisma.table.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  console.log('Seed: super-admin...');
  await prisma.user.create({
    data: {
      email: process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local',
      passwordHash: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD ?? 'superadmin123', 10),
      displayName: 'Super Admin',
      isSuperAdmin: true,
    },
  });

  console.log('Seed: restaurant pilote...');
  const resto = await prisma.restaurant.create({
    data: { name: 'Restaurant Pilote', slug: 'restaurant-pilote', status: 'active' },
  });
  const rid = resto.id;

  console.log('Seed: utilisateurs + memberships...');
  const staff: { email: string; pwd: string; role: string; name: string }[] = [
    { email: 'admin@restaurant-pilote.local', pwd: 'admin123', role: 'propriétaire', name: 'Admin' },
    { email: 'caisse1@restaurant-pilote.local', pwd: 'caisse123', role: 'caissier', name: 'Caissier 1' },
    { email: 'chef1@restaurant-pilote.local', pwd: 'chef123', role: 'cuisinier', name: 'Chef 1' },
    { email: 'serveur1@restaurant-pilote.local', pwd: 'serveur123', role: 'serveur', name: 'Serveur 1' },
  ];
  for (const s of staff) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash: await bcrypt.hash(s.pwd, 10),
        displayName: s.name,
        restaurantId: rid,
        memberships: { create: { restaurantId: rid, role: s.role } },
      },
    });
    void user;
  }

  console.log('Seed: tables...');
  await prisma.table.createMany({
    data: [
      { name: 'Table 1', capacity: 2, restaurantId: rid },
      { name: 'Table 2', capacity: 4, restaurantId: rid },
      { name: 'Table 3', capacity: 4, restaurantId: rid },
      { name: 'Table 4', capacity: 6, restaurantId: rid },
      { name: 'Table 5', capacity: 2, restaurantId: rid },
      { name: 'Terrasse 1', capacity: 4, restaurantId: rid },
    ],
  });

  console.log('Seed: stock...');
  const riz = await prisma.stockItem.create({ data: { name: 'Riz', quantity: 50, unit: 'kg', alertThreshold: 10, restaurantId: rid } });
  const poulet = await prisma.stockItem.create({ data: { name: 'Poulet', quantity: 30, unit: 'kg', alertThreshold: 5, restaurantId: rid } });
  const tomates = await prisma.stockItem.create({ data: { name: 'Tomates', quantity: 20, unit: 'kg', alertThreshold: 5, restaurantId: rid } });
  const oignons = await prisma.stockItem.create({ data: { name: 'Oignons', quantity: 15, unit: 'kg', alertThreshold: 5, restaurantId: rid } });
  const huile = await prisma.stockItem.create({ data: { name: 'Huile', quantity: 25, unit: 'litre', alertThreshold: 5, restaurantId: rid } });
  await prisma.stockItem.create({ data: { name: 'Eau minérale', quantity: 100, unit: 'unité', alertThreshold: 20, restaurantId: rid } });

  console.log('Seed: plats...');
  const pouletBraise = await prisma.dish.create({ data: { name: 'Poulet Braisé', description: 'Poulet grillé avec marinade épicée', price: 2500, category: 'Plat', preparationTime: 20, restaurantId: rid } });
  const rizSauce = await prisma.dish.create({ data: { name: 'Riz Sauce', description: 'Riz avec sauce tomate maison', price: 1500, category: 'Plat', preparationTime: 15, restaurantId: rid } });
  await prisma.dish.create({ data: { name: 'Attiéké Poisson', description: 'Attiéké accompagné de poisson frit', price: 2000, category: 'Plat', preparationTime: 18, restaurantId: rid } });
  await prisma.dish.create({ data: { name: 'Alloco', description: 'Banane plantain frite', price: 500, category: 'Entrée', preparationTime: 8, restaurantId: rid } });
  await prisma.dish.create({ data: { name: 'Jus Naturel', description: 'Jus de fruits frais', price: 1000, category: 'Boisson', preparationTime: 5, restaurantId: rid } });

  console.log('Seed: recettes...');
  await prisma.dishIngredient.createMany({
    data: [
      { dishId: pouletBraise.id, stockItemId: poulet.id, quantityNeeded: 0.5 },
      { dishId: pouletBraise.id, stockItemId: huile.id, quantityNeeded: 0.05 },
      { dishId: rizSauce.id, stockItemId: riz.id, quantityNeeded: 0.3 },
      { dishId: rizSauce.id, stockItemId: tomates.id, quantityNeeded: 0.2 },
      { dishId: rizSauce.id, stockItemId: oignons.id, quantityNeeded: 0.1 },
    ],
  });

  console.log('Seed: parametres...');
  await prisma.appSetting.createMany({
    data: [
      { settingKey: 'restaurant_name', settingValue: 'Restaurant Pilote', restaurantId: rid },
      { settingKey: 'currency', settingValue: 'FCFA', restaurantId: rid },
      { settingKey: 'alert_threshold_default', settingValue: '10', restaurantId: rid },
    ],
  });

  console.log('Seed termine.');
  console.log('  Super-admin :', process.env.SUPERADMIN_EMAIL ?? 'superadmin@plateforme.local');
  console.log('  admin@restaurant-pilote.local / admin123 (propriétaire)');
  console.log('  caisse1@restaurant-pilote.local / caisse123 (caissier)');
  console.log('  chef1@restaurant-pilote.local / chef123 (cuisinier)');
  console.log('  serveur1@restaurant-pilote.local / serveur123 (serveur)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

- [ ] **Step 2: Exécuter le seed**

Run: `cd backend && npm run seed`
Expected: logs « Seed termine » sans erreur ; comptes affichés.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(multitenant): seed super-admin + restaurant pilote + memberships"
```

---

## MILESTONE 2 — Infra d'isolation (contexte + extension + clients + middleware)

> But : un `restaurantId` porté par `AsyncLocalStorage`, une extension Prisma qui filtre automatiquement les 16 modèles tenant (refus par défaut), deux clients (`basePrisma` brut / `prisma` scopé), et un middleware qui ouvre le contexte depuis le JWT.

### Task 2.1 : Contexte tenant (AsyncLocalStorage)

**Files:**
- Create: `backend/src/config/tenant-context.ts`

- [ ] **Step 1: Écrire le module de contexte**

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  // restaurantId actif, ou null pour un appel volontairement non-scopé (super-admin/auth).
  restaurantId: number | null;
  unscoped: boolean;
}

const als = new AsyncLocalStorage<TenantStore>();

// Ouvre un contexte scopé sur un restaurant pour toute la durée de `fn`.
export function runWithTenant<T>(restaurantId: number, fn: () => T): T {
  return als.run({ restaurantId, unscoped: false }, fn);
}

// Ouvre un contexte explicitement NON scopé (auth, super-admin, seed, migration).
export function runUnscoped<T>(fn: () => T): T {
  return als.run({ restaurantId: null, unscoped: true }, fn);
}

// restaurantId courant ou null si hors contexte / non-scopé.
export function getTenantId(): number | null {
  return als.getStore()?.restaurantId ?? null;
}

// true si le contexte courant est explicitement non-scopé.
export function isUnscoped(): boolean {
  return als.getStore()?.unscoped === true;
}

// restaurantId courant, ou lève si aucun contexte n'est ouvert (refus par défaut).
export function getTenantIdOrThrow(): number {
  const store = als.getStore();
  if (!store || store.restaurantId == null) {
    throw new Error('TENANT_CONTEXT_MISSING: opération tenant hors contexte restaurant');
  }
  return store.restaurantId;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/tenant-context.ts
git commit -m "feat(multitenant): contexte tenant via AsyncLocalStorage"
```

### Task 2.2 : Extension Prisma d'isolation

**Files:**
- Create: `backend/src/config/prisma-extension.ts`

- [ ] **Step 1: Écrire l'extension**

```typescript
import { Prisma } from '@prisma/client';
import { getTenantIdOrThrow, isUnscoped } from './tenant-context';

// Modèles portant une colonne restaurantId : seuls ceux-ci sont filtrés.
export const TENANT_MODELS = new Set<string>([
  'Dish', 'StockItem', 'Order', 'Table', 'CashSession', 'Reservation',
  'Promotion', 'Expense', 'Employee', 'Supplier', 'Purchase', 'Inventory',
  'Notification', 'AuditLog', 'AppSetting', 'StockMovement',
]);

// Opérations de lecture/agrégation qui acceptent un `where` : on y injecte restaurantId.
const WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'updateMany', 'deleteMany',
]);

export const tenantExtension = Prisma.defineExtension({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.has(model)) return query(args);
        // Contexte explicitement non-scopé (super-admin/auth) : ne rien injecter.
        if (isUnscoped()) return query(args);

        const restaurantId = getTenantIdOrThrow(); // refus par défaut si hors contexte
        const a = (args ?? {}) as Record<string, unknown>;

        // findUnique/findUniqueOrThrow : un `where` unique n'accepte pas de filtre non-unique.
        // L'API d'extension ne permet pas de changer l'opération → on POST-FILTRE le résultat
        // par restaurantId. On force la présence de restaurantId si un `select` restreint est fourni.
        if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
          if (a.select && typeof a.select === 'object') {
            (a.select as Record<string, unknown>).restaurantId = true;
          }
          const res = (await query(a)) as { restaurantId?: number } | null;
          if (res && res.restaurantId !== restaurantId) {
            if (operation === 'findUniqueOrThrow') {
              throw new Error('No record found (cross-tenant isolation)');
            }
            return null;
          }
          return res;
        }

        if (WHERE_OPS.has(operation)) {
          a.where = { ...((a.where as object) ?? {}), restaurantId };
          return query(a);
        }

        if (operation === 'create') {
          a.data = { ...((a.data as object) ?? {}), restaurantId };
          return query(a);
        }
        if (operation === 'createMany') {
          const data = (a.data as Record<string, unknown>[] | Record<string, unknown>);
          a.data = Array.isArray(data)
            ? data.map((d) => ({ ...d, restaurantId }))
            : { ...data, restaurantId };
          return query(a);
        }

        // update/delete/upsert par id unique : NON filtrables sur un where unique.
        // Sûrs UNIQUEMENT si précédés d'une lecture scopée (convention du code, vérifiée par les tests).
        // On laisse passer tel quel.
        return query(args);
      },
    },
  },
});
```

> ⚠️ **Convention d'isolation (à respecter dans tout le code) :** un `update`/`delete`/`upsert` par `id` sur un modèle tenant **doit** être précédé d'une lecture scopée (`findUnique`/`findFirst`) qui valide l'appartenance. C'est déjà le cas partout (ex. `updateDish` appelle `getDish`, `updateStatus` lit l'ordre avant). La suite d'isolation (M5) teste qu'une tentative cross-tenant échoue en 404.

> Note sur `findUnique` : on **post-filtre** le résultat par `restaurantId` (l'API d'extension ne permet pas de transformer `findUnique` en `findFirst`). Si l'appelant a fourni un `select` restreint, l'extension y rajoute `restaurantId: true` pour pouvoir comparer (un champ `restaurantId` supplémentaire dans le résultat est inoffensif pour l'app). Les `findUnique` des services renvoient des enregistrements complets (via `include`), donc `restaurantId` est presque toujours déjà présent.

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/prisma-extension.ts
git commit -m "feat(multitenant): extension Prisma d'isolation par restaurantId"
```

### Task 2.3 : Deux clients Prisma (`basePrisma` brut + `prisma` scopé)

**Files:**
- Modify: `backend/src/config/prisma.ts`

- [ ] **Step 1: Réécrire `prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { tenantExtension } from './prisma-extension';

// Client BRUT (non scopé) : auth, super-admin, seed, migrations, tâches plateforme.
export const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Client SCOPÉ par défaut (importé par tous les services métier) : filtrage automatique
// par restaurantId via le contexte tenant. Refus par défaut hors contexte.
export const prisma = basePrisma.$extends(tenantExtension);
```

> Tous les services qui font `import { prisma } from '../config/prisma'` obtiennent désormais le client scopé, **sans autre changement**. Seuls auth/super-admin importeront `basePrisma`.

- [ ] **Step 2: Adapter `server.ts` (disconnect sur le client de base)**

Dans `backend/src/server.ts`, l'import `import { prisma } from './config/prisma';` et `await prisma.$disconnect();` fonctionnent encore (le client étendu expose `$disconnect`). Aucun changement requis. Vérifier seulement la compilation.

- [ ] **Step 3: Vérifier**

Run: `cd backend && npm run type-check`
Expected: PASS (les services compilent ; le type du client étendu reste compatible avec les appels `.model.method`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/prisma.ts
git commit -m "feat(multitenant): clients Prisma base (brut) et scope (isolation auto)"
```

### Task 2.4 : Middleware tenant (ouvre le contexte depuis le JWT)

**Files:**
- Create: `backend/src/middlewares/tenant.ts`
- Modify: `backend/src/app.ts`

> Ce middleware s'appuie sur `req.membership` posé par `authenticate` (Task 3.3). On l'écrit ici mais il sera réellement actif une fois l'auth refondue. Pour l'instant il lit `req.restaurantId` s'il est présent.

- [ ] **Step 1: Écrire le middleware**

```typescript
import { Request, Response, NextFunction } from 'express';
import { runWithTenant } from '../config/tenant-context';
import { sendError } from '../utils/response';

// Ouvre le contexte tenant pour la durée du traitement de la requête.
// À placer APRÈS `authenticate` (qui pose req.restaurantId), sur les routes scopées.
// Aucun restaurant sélectionné → 403 propre (l'utilisateur doit choisir un restaurant).
export function tenantContext(req: Request, res: Response, next: NextFunction) {
  const restaurantId = req.restaurantId;
  if (restaurantId == null) {
    return sendError(res, 403, 'AUTH_006', 'Aucun restaurant sélectionné');
  }
  return runWithTenant(restaurantId, () => next());
}
```

- [ ] **Step 2: Déclarer `req.restaurantId` dans les types Express**

Dans `backend/src/types/express/index.d.ts`, ajouter à l'augmentation de `Request` (à côté de `user`) :

```typescript
    restaurantId?: number;
    membership?: { restaurantId: number; role: string };
```

(garder la déclaration existante de `user`).

- [ ] **Step 3: Vérifier la compilation**

Run: `cd backend && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middlewares/tenant.ts backend/src/types/express/index.d.ts
git commit -m "feat(multitenant): middleware d'ouverture du contexte tenant"
```

---

## MILESTONE 3 — Auth multi-tenant + WebSocket scopé

> But : login par email renvoyant les memberships, JWT scopé `{ userId, isSuperAdmin, restaurantId, role }`, endpoint `switch-restaurant`, `authenticate` qui pose `req.restaurantId`/`req.membership`, `requireRole` basé sur le membership, et rooms WebSocket par restaurant.

### Task 3.1 : Payload JWT enrichi

**Files:**
- Modify: `backend/src/utils/jwt.ts`

- [ ] **Step 1: Mettre à jour `AccessPayload`**

Remplacer `AccessPayload` et les fonctions concernées :

```typescript
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../constants';

export interface AccessPayload {
  userId: number;
  isSuperAdmin: boolean;
  // Contexte restaurant actif (absent tant qu'aucun restaurant n'est sélectionné, ex. super-admin).
  restaurantId?: number;
  role?: Role;
}

export interface RefreshPayload {
  userId: number;
}

export function signAccessToken(payload: AccessPayload): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function signRefreshToken(payload: RefreshPayload): string {
  const options: SignOptions = { expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtRefreshSecret, options);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtSecret) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshPayload;
}
```

- [ ] **Step 2: type-check** — Run: `cd backend && npm run type-check` — Expected: échecs attendus dans `auth.service.ts`/`auth.ts`/`websocket` (corrigés tâches suivantes). On NE commit pas tant que M3 n'est pas vert (commit en fin de 3.4).

### Task 3.2 : Service membership

**Files:**
- Create: `backend/src/services/membership.service.ts`

- [ ] **Step 1: Écrire le service**

```typescript
import { basePrisma } from '../config/prisma';

export interface MembershipView {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  role: string;
}

// Memberships actifs d'un utilisateur sur des restaurants actifs (pour le login/sélecteur).
export async function listActiveMembershipsForUser(userId: number): Promise<MembershipView[]> {
  const rows = await basePrisma.membership.findMany({
    where: { userId, isActive: true, restaurant: { status: 'active' } },
    include: { restaurant: true },
    orderBy: { restaurant: { name: 'asc' } },
  });
  return rows.map((m) => ({
    restaurantId: m.restaurantId,
    restaurantName: m.restaurant.name,
    restaurantSlug: m.restaurant.slug,
    role: m.role,
  }));
}

// Membership actif précis (pour switch / vérification d'accès). null si absent/inactif.
export async function getActiveMembership(userId: number, restaurantId: number) {
  return basePrisma.membership.findFirst({
    where: { userId, restaurantId, isActive: true, restaurant: { status: 'active' } },
  });
}
```

- [ ] **Step 2: type-check** — Run: `cd backend && npm run type-check` — Expected: ce fichier compile (erreurs résiduelles ailleurs, normal).

### Task 3.3 : Refondre `auth.service`, `authenticate`, `requireRole`

**Files:**
- Modify: `backend/src/services/auth.service.ts`
- Modify: `backend/src/middlewares/auth.ts`

- [ ] **Step 1: Réécrire `auth.service.ts`**

```typescript
import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { Role } from '../constants';
import { listActiveMembershipsForUser, getActiveMembership } from './membership.service';

function publicUser(u: { id: number; email: string; displayName: string | null; isSuperAdmin: boolean }) {
  return { id: u.id, email: u.email, displayName: u.displayName, isSuperAdmin: u.isSuperAdmin };
}

// Construit la réponse d'auth. Si un restaurant est sélectionné, le token est scopé dessus.
function buildAuthResponse(
  user: { id: number; email: string; displayName: string | null; isSuperAdmin: boolean },
  selected?: { restaurantId: number; role: Role }
) {
  return {
    user: publicUser(user),
    accessToken: signAccessToken({
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin,
      restaurantId: selected?.restaurantId,
      role: selected?.role,
    }),
    refreshToken: signRefreshToken({ userId: user.id }),
  };
}

export async function login(email: string, password: string) {
  const user = await basePrisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) throw new AppError(401, 'AUTH_001');
  if (!user.isActive) throw new AppError(403, 'AUTH_004');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'AUTH_001');

  await basePrisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const memberships = await listActiveMembershipsForUser(user.id);
  // Auto-sélection si un seul restaurant ; sinon token non scopé + sélecteur côté client.
  const selected = memberships.length === 1
    ? { restaurantId: memberships[0].restaurantId, role: memberships[0].role as Role }
    : undefined;

  return { ...buildAuthResponse(user, selected), memberships };
}

export async function switchRestaurant(userId: number, restaurantId: number) {
  const user = await basePrisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError(403, 'AUTH_004');
  const membership = await getActiveMembership(userId, restaurantId);
  if (!membership) throw new AppError(403, 'AUTH_005');
  return buildAuthResponse(user, { restaurantId, role: membership.role as Role });
}

export async function refresh(refreshToken: string) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'AUTH_002');
  }
  const user = await basePrisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) throw new AppError(403, 'AUTH_004');
  const memberships = await listActiveMembershipsForUser(user.id);
  const selected = memberships.length === 1
    ? { restaurantId: memberships[0].restaurantId, role: memberships[0].role as Role }
    : undefined;
  return { ...buildAuthResponse(user, selected), memberships };
}

export async function getMe(userId: number) {
  const user = await basePrisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'USER_001');
  const memberships = await listActiveMembershipsForUser(user.id);
  return { user: publicUser(user), memberships };
}
```

- [ ] **Step 2: Réécrire `middlewares/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { basePrisma } from '../config/prisma';
import { env } from '../config/env';
import { sendError } from '../utils/response';
import { Role } from '../constants';
import { AccessPayload } from '../utils/jwt';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
    if (!token) return sendError(res, 401, 'AUTH_003', 'Token manquant');

    let decoded: AccessPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as AccessPayload;
    } catch (err) {
      const code = err instanceof jwt.TokenExpiredError ? 'AUTH_002' : 'AUTH_003';
      return sendError(res, 401, code);
    }

    const user = await basePrisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return sendError(res, 403, 'AUTH_004');

    req.user = { id: user.id, isSuperAdmin: user.isSuperAdmin };

    // Contexte restaurant : vérifie que le membership est toujours actif.
    if (decoded.restaurantId != null) {
      const membership = await basePrisma.membership.findFirst({
        where: { userId: user.id, restaurantId: decoded.restaurantId, isActive: true },
      });
      if (!membership) return sendError(res, 403, 'AUTH_005');
      req.restaurantId = decoded.restaurantId;
      req.membership = { restaurantId: decoded.restaurantId, role: membership.role };
    }
    return next();
  } catch {
    return sendError(res, 500, 'INTERNAL_001');
  }
}

// Exige un restaurant sélectionné ET un rôle autorisé (rôle du membership courant).
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.membership) return sendError(res, 403, 'AUTH_006', 'Aucun restaurant sélectionné');
    if (!roles.includes(req.membership.role as Role)) return sendError(res, 403, 'AUTH_005');
    return next();
  };
}

// Réservé au super-admin plateforme.
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isSuperAdmin) return sendError(res, 403, 'AUTH_005');
  return next();
}
```

- [ ] **Step 3: Mettre à jour le type `req.user`**

Dans `backend/src/types/express/index.d.ts`, remplacer la forme de `user` par :

```typescript
    user?: { id: number; isSuperAdmin: boolean };
```

(et garder `restaurantId?`/`membership?` ajoutés en Task 2.4).

- [ ] **Step 4: Ajouter le code d'erreur `AUTH_006`**

Vérifier que `backend/src/utils/errors.ts` (ou la table de messages utilisée par `sendError`) connaît `AUTH_006`. Si les codes sont centralisés, ajouter :

```typescript
  AUTH_006: 'Aucun restaurant sélectionné',
```

au même endroit que `AUTH_005` (rechercher `AUTH_005` dans `backend/src/` pour localiser la table). Si les messages sont libres (passés en 3ᵉ argument), aucune action.

- [ ] **Step 5: type-check** — Run: `cd backend && npm run type-check` — Expected: erreurs résiduelles seulement dans les fichiers consommant `req.user.role`/`req.user.username` (corrigés en M4) et le controller auth (3.4).

### Task 3.4 : Endpoints auth (login/switch/me) + contexte sur toutes les routes

**Files:**
- Modify: `backend/src/controllers/auth.controller.ts`
- Modify: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/validators/schemas.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: `validators/schemas.ts` — login par email + switch**

Localiser `loginSchema` et le remplacer ; ajouter `switchRestaurantSchema` :

```typescript
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const switchRestaurantSchema = z.object({
  body: z.object({
    restaurantId: z.number().int().positive(),
  }),
});
```

> Garder le `refreshSchema` existant. Adapter à la forme exacte utilisée par `validate` (vérifier si les schémas enveloppent `{ body }` ou non en regardant un schéma voisin du fichier).

- [ ] **Step 2: `auth.controller.ts`**

```typescript
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import * as authService from '../services/auth.service';

export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  sendSuccess(res, result);
});

export const switchRestaurantController = asyncHandler(async (req, res) => {
  const { restaurantId } = req.body;
  const result = await authService.switchRestaurant(req.user!.id, restaurantId);
  sendSuccess(res, result);
});

export const refreshController = asyncHandler(async (req, res) => {
  const token = (req.body?.refreshToken as string) || (req.headers['x-refresh-token'] as string);
  if (!token) return sendError(res, 401, 'AUTH_003', 'Refresh token manquant');
  const result = await authService.refresh(token);
  return sendSuccess(res, result);
});

export const meController = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user!.id);
  sendSuccess(res, result);
});
```

- [ ] **Step 3: `auth.routes.ts`**

```typescript
import { Router } from 'express';
import { loginController, refreshController, meController, switchRestaurantController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginSchema, refreshSchema, switchRestaurantSchema } from '../validators/schemas';
import { loginLimiter } from '../middlewares/rateLimit';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), loginController);
router.post('/refresh', validate(refreshSchema), refreshController);
router.post('/switch-restaurant', authenticate, validate(switchRestaurantSchema), switchRestaurantController);
router.get('/me', authenticate, meController);

export default router;
```

- [ ] **Step 4: Brancher le contexte tenant sur les routes métier**

Dans `backend/src/routes/index.ts`, importer le middleware et l'appliquer à toutes les routes tenant (toutes sauf `/auth` et `/health`). Modifier ainsi :

```typescript
import { authenticate } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
// ... imports existants

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.use('/auth', authRoutes);

// Toutes les routes suivantes sont scopées : auth (pose req.restaurantId) puis ouverture du contexte.
router.use(authenticate, tenantContext);

router.use('/stock', stockRoutes);
router.use('/dishes', dishRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/tables', tableRoutes);
router.use('/stats', statsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/sync', syncRoutes);
router.use('/cash', cashRoutes);
router.use('/audit', auditRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/employees', employeeRoutes);
router.use('/expenses', expenseRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/promotions', promotionRoutes);
router.use('/settings', settingsRoutes);

export default router;
```

> ⚠️ Conséquence : chaque sous-routeur applique peut-être déjà `authenticate` en interne. Vérifier chaque fichier de routes : si `authenticate` y est déjà appliqué par route, le doublon est inoffensif (idempotent) mais retirer les `authenticate` redondants au niveau route est plus propre. NE PAS retirer les `requireRole(...)` par route. (Pour ce plan : laisser les `authenticate` par-route en place ; ils repasseront sans effet de bord puisque le token est revérifié.)

> Note : les routes deviennent toutes authentifiées. Les routes publiques (branding par slug) seront ajoutées en P3 hors de ce groupe.

- [ ] **Step 5: type-check** — Run: `cd backend && npm run type-check` — Expected: erreurs restantes seulement dans websocket + services M4.

### Task 3.5 : WebSocket scopé par restaurant

**Files:**
- Modify: `backend/src/websocket/index.ts`

- [ ] **Step 1: Réécrire `websocket/index.ts`**

```typescript
import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';
import { Role } from '../constants';
import { getTenantId } from '../config/tenant-context';

let io: Server | null = null;

function room(restaurantId: number, role: Role): string {
  return `r:${restaurantId}:${role}`;
}

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, { cors: { origin: env.corsOrigin, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Token manquant'));
    try {
      const payload = verifyAccessToken(token);
      // Un restaurant doit être sélectionné pour recevoir des événements scopés.
      if (payload.restaurantId == null || !payload.role) return next(new Error('Restaurant non sélectionné'));
      socket.data.restaurantId = payload.restaurantId;
      socket.data.role = payload.role;
      return next();
    } catch {
      return next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const restaurantId = socket.data.restaurantId as number;
    const role = socket.data.role as Role;
    socket.join(room(restaurantId, role));
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Émission vers un rôle DU RESTAURANT COURANT (restaurantId lu dans le contexte tenant).
export function emitToRole(role: Role, event: string, payload: unknown): void {
  const restaurantId = getTenantId();
  if (restaurantId == null) return; // hors contexte : on n'émet pas (sécurité)
  io?.to(room(restaurantId, role)).emit(event, payload);
}

// Émission vers TOUS les rôles du restaurant courant.
export function emitToRestaurant(event: string, payload: unknown): void {
  const restaurantId = getTenantId();
  if (restaurantId == null) return;
  for (const role of ['administrateur', 'caissier', 'cuisinier', 'serveur'] as Role[]) {
    io?.to(room(restaurantId, role)).emit(event, payload);
  }
}

// Helpers métier (signatures inchangées : les call sites ne bougent pas).
export function emitNewOrder(payload: unknown): void { emitToRole('cuisinier', 'new_order', payload); }
export function emitOrderReady(payload: unknown): void { emitToRole('caissier', 'order_ready', payload); }
export function emitOrderStatusChanged(payload: unknown): void { emitToRestaurant('order_status_changed', payload); }
export function emitStockAlert(payload: unknown): void { emitToRole('administrateur', 'stock_alert', payload); }
export function emitStatsUpdated(payload: unknown): void { emitToRestaurant('stats_updated', payload); }
```

> `emitToAll` (ancien) est remplacé par `emitToRestaurant`. Rechercher d'éventuels usages de `emitToAll` (`grep -rn emitToAll backend/src`) et les remplacer par `emitToRestaurant`. D'après l'audit, seuls `emitOrderStatusChanged`/`emitStatsUpdated` l'utilisaient (déjà corrigés ci-dessus).

- [ ] **Step 2: type-check** — Run: `cd backend && npm run type-check` — Expected: erreurs restantes seulement dans les services M4 (`username`/`role`).

- [ ] **Step 3: Commit M3 (sera vert après M4)**

> M3 introduit des changements qui ne compilent pleinement qu'avec M4 (suppression des `username`/`role` côté services). On commit donc à la fin de M4. Si l'on exécute via subagents, regrouper M3+M4 jusqu'au premier `type-check` vert.

---

## MILESTONE 4 — Adaptations des services (`username`→`displayName`, users→membres, hardening)

> But : faire compiler tout le code restant en remplaçant les références à `User.username`/`User.role` supprimés, convertir la « gestion des utilisateurs » en gestion des membres du restaurant courant, et durcir `markAsRead`.

### Task 4.1 : Balayage `username` → `displayName` et retrait de `role` dans les `select`

**Files:**
- Modify: `backend/src/services/stats.service.ts`
- Modify: `backend/src/services/cash.service.ts`
- Modify: `backend/src/services/audit.service.ts`

- [ ] **Step 1: `stats.service.ts`**

- Ligne ~58 : `include: { items: true, server: { select: { username: true } } }` → `server: { select: { displayName: true } }`.
- Ligne ~223 : `const who = o.server?.username ?? 'Maison';` → `o.server?.displayName ?? 'Maison'`.

- [ ] **Step 2: `cash.service.ts`**

Remplacer toutes les occurrences de `username: true` dans les `select` de `cashier`/`closer` par `displayName: true` (lignes ~108, ~177-178, ~186-187). Soit, pour chaque bloc :

```typescript
      cashier: { select: { id: true, displayName: true } },
      closer: { select: { id: true, displayName: true } },
```

- [ ] **Step 3: `audit.service.ts`**

Ligne ~46 : remplacer `include: { user: { select: { id: true, username: true, role: true } } }` par :

```typescript
    include: { user: { select: { id: true, displayName: true } } },
```

(`role` n'existe plus sur `User` ; il est porté par `Membership`. Le journal affiche le nom ; le rôle exact au moment de l'action n'est pas requis ici.)

- [ ] **Step 4: Rechercher tout reliquat**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep -i "username\|\.role"` (PowerShell : `npx tsc --noEmit` puis lire les erreurs)
Expected: identifier tout autre fichier référant `user.username`/`user.role`. Les corriger sur le même principe (afficher `displayName`, ne plus lire `role` sur `User`).

### Task 4.2 : Convertir `user.service` en gestion des membres du restaurant courant

**Files:**
- Modify: `backend/src/services/user.service.ts`
- Modify: `backend/src/validators/schemas.ts` (schémas de création/màj de membre)
- Modify: `backend/src/controllers/user.controller.ts` (adapter aux nouvelles signatures)

> Sémantique cible : « les utilisateurs » d'un restaurant = ses **memberships**. Créer un membre = créer (ou réutiliser) un `User` global par email + un `Membership` scopé sur le restaurant courant. Lister = lister les memberships du restaurant courant. Cette tâche couvre le strict nécessaire pour compiler et garder l'écran « Gestion > utilisateurs » fonctionnel.

- [ ] **Step 1: Réécrire `user.service.ts`**

```typescript
import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { getTenantIdOrThrow } from '../config/tenant-context';
import { AppError } from '../utils/errors';
import { Role } from '../constants';

interface MemberView {
  membershipId: number;
  userId: number;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}

function toView(m: {
  id: number; role: string; isActive: boolean;
  user: { id: number; email: string; displayName: string | null; lastLogin: Date | null; createdAt: Date };
}): MemberView {
  return {
    membershipId: m.id, userId: m.user.id, email: m.user.email, displayName: m.user.displayName,
    role: m.role, isActive: m.isActive, lastLogin: m.user.lastLogin, createdAt: m.user.createdAt,
  };
}

export async function listUsers() {
  const rid = getTenantIdOrThrow();
  const members = await basePrisma.membership.findMany({
    where: { restaurantId: rid },
    include: { user: true },
    orderBy: { user: { displayName: 'asc' } },
  });
  return members.map(toView);
}

export async function getUser(membershipId: number) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid }, include: { user: true } });
  if (!m) throw new AppError(404, 'USER_001');
  return toView(m);
}

// Crée un membre : réutilise le User si l'email existe, sinon le crée. Ajoute le membership au restaurant courant.
export async function createUser(data: { email: string; password: string; role: Role; displayName?: string }) {
  const rid = getTenantIdOrThrow();
  const email = data.email.toLowerCase().trim();
  let user = await basePrisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await basePrisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(data.password, 10), displayName: data.displayName ?? null, restaurantId: rid },
    });
  }
  const existing = await basePrisma.membership.findFirst({ where: { userId: user.id, restaurantId: rid } });
  if (existing) throw new AppError(409, 'USER_002');
  const m = await basePrisma.membership.create({ data: { userId: user.id, restaurantId: rid, role: data.role }, include: { user: true } });
  return toView(m);
}

async function countActiveOwners(excludeMembershipId?: number) {
  const rid = getTenantIdOrThrow();
  return basePrisma.membership.count({
    where: { restaurantId: rid, role: 'propriétaire', isActive: true, ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}) },
  });
}

export async function updateUser(membershipId: number, data: { role?: Role; password?: string; displayName?: string }) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid }, include: { user: true } });
  if (!m) throw new AppError(404, 'USER_001');

  // Empêche de retirer le dernier propriétaire actif.
  if (m.role === 'propriétaire' && data.role && data.role !== 'propriétaire' && (await countActiveOwners(membershipId)) === 0) {
    throw new AppError(400, 'USER_004');
  }
  if (data.role) await basePrisma.membership.update({ where: { id: membershipId }, data: { role: data.role } });
  if (data.password || data.displayName !== undefined) {
    await basePrisma.user.update({
      where: { id: m.userId },
      data: {
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      },
    });
  }
  return getUser(membershipId);
}

export async function toggleActive(membershipId: number, currentUserId: number) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid } });
  if (!m) throw new AppError(404, 'USER_001');
  if (m.userId === currentUserId) throw new AppError(400, 'USER_003', 'Impossible de désactiver votre propre accès');
  if (m.isActive && m.role === 'propriétaire' && (await countActiveOwners(membershipId)) === 0) {
    throw new AppError(400, 'USER_004');
  }
  await basePrisma.membership.update({ where: { id: membershipId }, data: { isActive: !m.isActive } });
  return getUser(membershipId);
}

// Retire un membre du restaurant courant (supprime le membership ; le User global subsiste).
export async function deleteUser(membershipId: number, currentUserId: number) {
  const rid = getTenantIdOrThrow();
  const m = await basePrisma.membership.findFirst({ where: { id: membershipId, restaurantId: rid } });
  if (!m) throw new AppError(404, 'USER_001');
  if (m.userId === currentUserId) throw new AppError(400, 'USER_003', 'Impossible de retirer votre propre accès');
  if (m.role === 'propriétaire' && m.isActive && (await countActiveOwners(membershipId)) === 0) {
    throw new AppError(400, 'USER_004');
  }
  await basePrisma.membership.delete({ where: { id: membershipId } });
  return { id: membershipId };
}
```

- [ ] **Step 2: Adapter le controller `user.controller.ts`**

Lire `backend/src/controllers/user.controller.ts` et adapter : les paramètres d'URL passés à `getUser/updateUser/toggleActive/deleteUser` sont désormais des `membershipId` (déjà un `:id` numérique — sémantique changée, signature identique). `createUser` reçoit `{ email, password, role, displayName }` au lieu de `{ username, password, role }`. `toggleActive`/`deleteUser` reçoivent `req.user!.id` comme `currentUserId` (inchangé). Ajuster les destructurations du `req.body`.

- [ ] **Step 3: Adapter les schémas de validation**

Dans `backend/src/validators/schemas.ts`, remplacer les schémas `createUserSchema`/`updateUserSchema` (rechercher `username` dans le fichier) : `username` → `email: z.string().email()` (création) + `displayName: z.string().optional()`. Le `role` accepte désormais `'propriétaire'` en plus des 4 rôles (utiliser l'enum des rôles depuis `constants` si déjà importé, sinon `z.enum([...])`).

- [ ] **Step 4: Mettre à jour les rôles constants**

Dans `backend/src/constants.ts`, étendre `ROLES` pour inclure `propriétaire` :

```typescript
export const ROLES = ['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur'] as const;
```

> Vérifier les `requireRole(...)` existants dans les fichiers de routes : partout où `'administrateur'` ouvre un accès, ajouter `'propriétaire'` (le propriétaire a au moins les droits de l'admin). Rechercher `requireRole('administrateur'` et `requireRole(\n` dans `backend/src/routes/` et inclure `'propriétaire'`.

- [ ] **Step 5: Durcir `notification.service.markAsRead`**

Dans `backend/src/services/notification.service.ts`, remplacer `markAsRead` pour valider l'appartenance avant le `update` par id :

```typescript
export async function markAsRead(notificationId: number, userId: number) {
  // Lecture scopée : refuse une notification d'un autre restaurant (renvoie null → 404).
  const notif = await prisma.notification.findFirst({ where: { id: notificationId } });
  if (!notif) throw new AppError(404, 'NOTIF_001');
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId },
    update: {},
  });
  return prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
}
```

Ajouter `import { AppError } from '../utils/errors';` en tête si absent. (Si `NOTIF_001` n'existe pas dans la table de codes, utiliser un code générique existant type `'VALIDATION_001'` ou ajouter `NOTIF_001`.)

- [ ] **Step 6: type-check complet** — Run: `cd backend && npm run type-check` — Expected: **PASS** (tout le backend compile).

- [ ] **Step 7: Tests existants** — Run: `cd backend && npm test` — Expected: les tests logique + smoke passent. Le smoke `POST /api/auth/login sans champs → 400 VALIDATION_001` doit toujours passer (login exige email+password). Si un smoke teste l'ancien comportement username, l'ajuster.

- [ ] **Step 8: Commit M3+M4**

```bash
git add backend/src
git commit -m "feat(multitenant): auth par email + memberships, websocket scope, services adaptes"
```

---

## MILESTONE 5 — Harnais d'intégration + suite d'isolation (la preuve)

> But : prouver par des tests, contre une vraie base de test, que l'isolation tient (aucune fuite entre 2 restaurants), que l'auth/membership/switch fonctionne, et que le numéro de commande est bien par restaurant.

### Task 5.1 : Outils de test d'intégration (base dédiée)

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.integration.config.ts`
- Create: `backend/src/__tests__/integration/helpers.ts`

- [ ] **Step 1: Ajouter `dotenv-cli` et les scripts**

Dans `backend/package.json`, ajouter à `devDependencies` `"dotenv-cli": "^7.4.2"` puis aux `scripts` :

```json
    "test:integration": "dotenv -e .env.test -- vitest run --config vitest.integration.config.ts",
    "test:integration:setup": "dotenv -e .env.test -- prisma migrate deploy"
```

Run: `cd backend && npm install`
Expected: `dotenv-cli` installé.

- [ ] **Step 2: Config Vitest d'intégration**

`backend/vitest.integration.config.ts` :

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    fileParallelism: false, // une seule base de test partagée → pas de parallélisme
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
```

- [ ] **Step 3: Préparer la base de test**

Créer la base `restaurant_test` sur le cluster PG18 (port 5433), puis :

Run: `cd backend && npm run test:integration:setup`
Expected: `prisma migrate deploy` applique toutes les migrations sur `restaurant_test` (« All migrations have been applied »).

- [ ] **Step 4: Helper de réinitialisation + 2 restaurants**

`backend/src/__tests__/integration/helpers.ts` :

```typescript
import bcrypt from 'bcrypt';
import { basePrisma } from '../../config/prisma';

export interface SeededRestaurant { id: number; ownerId: number; cashierId: number; }

// Vide toutes les tables (ordre FK) puis crée 2 restaurants isolés avec des données minimales.
export async function resetAndSeedTwoRestaurants(): Promise<{ A: SeededRestaurant; B: SeededRestaurant }> {
  await basePrisma.$transaction([
    basePrisma.notificationRead.deleteMany(),
    basePrisma.notification.deleteMany(),
    basePrisma.stockMovement.deleteMany(),
    basePrisma.orderItem.deleteMany(),
    basePrisma.order.deleteMany(),
    basePrisma.dishIngredient.deleteMany(),
    basePrisma.dishVariant.deleteMany(),
    basePrisma.dish.deleteMany(),
    basePrisma.stockItem.deleteMany(),
    basePrisma.appSetting.deleteMany(),
    basePrisma.table.deleteMany(),
    basePrisma.cashSession.deleteMany(),
    basePrisma.promotion.deleteMany(),
    basePrisma.expense.deleteMany(),
    basePrisma.supplier.deleteMany(),
    basePrisma.purchase.deleteMany(),
    basePrisma.inventoryLine.deleteMany(),
    basePrisma.inventory.deleteMany(),
    basePrisma.employee.deleteMany(),
    basePrisma.reservationItem.deleteMany(),
    basePrisma.reservation.deleteMany(),
    basePrisma.auditLog.deleteMany(),
    basePrisma.membership.deleteMany(),
    basePrisma.user.deleteMany(),
    basePrisma.restaurant.deleteMany(),
  ]);

  async function makeResto(name: string, slug: string): Promise<SeededRestaurant> {
    const r = await basePrisma.restaurant.create({ data: { name, slug, status: 'active' } });
    const pwd = await bcrypt.hash('pass123', 10);
    const owner = await basePrisma.user.create({
      data: { email: `owner-${slug}@test.local`, passwordHash: pwd, displayName: 'Owner', restaurantId: r.id,
        memberships: { create: { restaurantId: r.id, role: 'propriétaire' } } },
    });
    const cashier = await basePrisma.user.create({
      data: { email: `cashier-${slug}@test.local`, passwordHash: pwd, displayName: 'Cashier', restaurantId: r.id,
        memberships: { create: { restaurantId: r.id, role: 'caissier' } } },
    });
    await basePrisma.dish.create({ data: { name: `Plat ${slug}`, price: 1000, restaurantId: r.id } });
    await basePrisma.table.create({ data: { name: 'Table 1', capacity: 4, restaurantId: r.id } });
    return { id: r.id, ownerId: owner.id, cashierId: cashier.id };
  }

  const A = await makeResto('Resto A', 'resto-a');
  const B = await makeResto('Resto B', 'resto-b');
  return { A, B };
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/vitest.integration.config.ts backend/src/__tests__/integration/helpers.ts backend/package-lock.json
git commit -m "test(multitenant): harnais d'integration (base dediee + 2 restaurants)"
```

### Task 5.2 : Suite d'isolation (TDD du cœur de sécurité)

**Files:**
- Create: `backend/src/__tests__/integration/isolation.test.ts`

- [ ] **Step 1: Écrire les tests d'isolation**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant, runUnscoped } from '../../config/tenant-context';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

let A: SeededRestaurant; let B: SeededRestaurant;

beforeAll(async () => { ({ A, B } = await resetAndSeedTwoRestaurants()); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Isolation tenant (stratégie A)', () => {
  it('findMany ne renvoie que les données du restaurant courant', async () => {
    const dishesA = await runWithTenant(A.id, () => prisma.dish.findMany());
    const dishesB = await runWithTenant(B.id, () => prisma.dish.findMany());
    expect(dishesA).toHaveLength(1);
    expect(dishesB).toHaveLength(1);
    expect(dishesA[0].restaurantId).toBe(A.id);
    expect(dishesB[0].restaurantId).toBe(B.id);
  });

  it('create injecte automatiquement le restaurantId courant', async () => {
    const created = await runWithTenant(A.id, () => prisma.stockItem.create({ data: { name: 'Riz', quantity: 10, unit: 'kg' } }));
    expect(created.restaurantId).toBe(A.id);
  });

  it('findUnique (réécrit en findFirst) refuse un id d\'un autre restaurant', async () => {
    const dishA = (await runWithTenant(A.id, () => prisma.dish.findMany()))[0];
    const seenFromB = await runWithTenant(B.id, () => prisma.dish.findUnique({ where: { id: dishA.id } }));
    expect(seenFromB).toBeNull();
  });

  it('count/aggregate sont scopés', async () => {
    const countA = await runWithTenant(A.id, () => prisma.dish.count());
    expect(countA).toBe(1);
  });

  it('updateMany d\'un restaurant n\'affecte pas l\'autre', async () => {
    await runWithTenant(A.id, () => prisma.dish.updateMany({ data: { isActive: false } }));
    const stillActiveB = await runWithTenant(B.id, () => prisma.dish.findMany({ where: { isActive: true } }));
    expect(stillActiveB).toHaveLength(1);
  });

  it('refus par défaut : une opération tenant hors contexte lève', async () => {
    await expect(prisma.dish.findMany()).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
  });

  it('runUnscoped permet au super-admin de voir tous les restaurants', async () => {
    const all = await runUnscoped(() => prisma.dish.findMany());
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Lancer (doit échouer si l'extension est mal câblée)**

Run: `cd backend && npm run test:integration -- isolation`
Expected: tous les tests PASS. S'ils échouent, corriger `prisma-extension.ts` jusqu'au vert (ne pas modifier les assertions).

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/integration/isolation.test.ts
git commit -m "test(multitenant): suite d'isolation tenant"
```

### Task 5.3 : Tests auth/membership + numéro de commande par restaurant

**Files:**
- Create: `backend/src/__tests__/integration/auth.test.ts`

- [ ] **Step 1: Écrire les tests via l'API (Supertest)**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();
let A: SeededRestaurant; let B: SeededRestaurant;

beforeAll(async () => { ({ A, B } = await resetAndSeedTwoRestaurants()); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Auth multi-tenant', () => {
  it('login par email auto-sélectionne quand un seul restaurant', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.memberships).toHaveLength(1);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('mauvais mot de passe → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('un token du resto A ne lit pas le stock du resto B', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
    const token = login.body.data.accessToken;
    // crée un stock côté B directement
    await runWithTenant(B.id, () => prisma.stockItem.create({ data: { name: 'SecretB', quantity: 5, unit: 'kg' } }));
    const res = await request(app).get('/api/stock').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = (res.body.data as { name: string }[]).map((s) => s.name);
    expect(names).not.toContain('SecretB');
  });

  it('switch-restaurant refuse un restaurant sans membership', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
    const token = login.body.data.accessToken;
    const res = await request(app).post('/api/auth/switch-restaurant').set('Authorization', `Bearer ${token}`).send({ restaurantId: B.id });
    expect(res.status).toBe(403);
  });
});

describe('Numéro de commande par restaurant', () => {
  it('chaque restaurant a sa propre séquence', async () => {
    const { createOrder } = await import('../../services/order.service');
    const dishA = (await runWithTenant(A.id, () => prisma.dish.findMany()))[0];
    const dishB = (await runWithTenant(B.id, () => prisma.dish.findMany()))[0];
    const o1 = await runWithTenant(A.id, () => createOrder({ items: [{ dishId: dishA.id, quantity: 1 }] }, A.ownerId));
    const o2 = await runWithTenant(B.id, () => createOrder({ items: [{ dishId: dishB.id, quantity: 1 }] }, B.ownerId));
    // Les deux premières commandes du jour finissent toutes deux en -001 (séquences indépendantes).
    expect(o1.orderNumber.endsWith('-001')).toBe(true);
    expect(o2.orderNumber.endsWith('-001')).toBe(true);
    expect(o1.restaurantId).toBe(A.id);
    expect(o2.restaurantId).toBe(B.id);
  });
});
```

> Note : `createOrder` lit `dishMap` et le stock hors transaction via le client scopé — d'où l'appel sous `runWithTenant`. Le test prouve que la transaction interactive reste scopée (numéro + restaurantId corrects).

- [ ] **Step 2: Lancer toute la suite d'intégration**

Run: `cd backend && npm run test:integration`
Expected: isolation + auth + numéro de commande : tous PASS.

- [ ] **Step 3: Lancer les tests unitaires (non-régression)**

Run: `cd backend && npm test`
Expected: tests logique + smoke PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/__tests__/integration/auth.test.ts
git commit -m "test(multitenant): auth/membership/switch + numero de commande par restaurant"
```

### Task 5.4 : Vérification finale du socle backend

- [ ] **Step 1: type-check + build**

Run: `cd backend && npm run type-check && npm run build`
Expected: PASS (compilation TypeScript complète).

- [ ] **Step 2: Démarrage manuel + smoke réel**

Run: `cd backend && npm run dev` puis dans un autre terminal :
```bash
curl -s http://localhost:3000/api/health
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@restaurant-pilote.local","password":"admin123"}'
```
Expected: `health` → `{success:true}` ; `login` → `accessToken` + `memberships` (1 entrée, rôle `propriétaire`). Utiliser le token sur `GET /api/dishes` → renvoie les plats du resto pilote.

- [ ] **Step 3: Commit (si ajustements)**

```bash
git add -A
git commit -m "chore(multitenant): verification finale du socle backend P1"
```

---

## Auto-revue (couverture du spec)

| Exigence du spec | Couverte par |
|---|---|
| Base partagée + `restaurantId` | M1 (schéma + migration) |
| `Restaurant` + `Membership` + super-admin | Task 1.2, 1.6 |
| Identité globale par email | Task 1.2, 3.3 |
| Unicités par restaurant (table/promo/order/setting) | Task 1.3 step 2 + migration 1.4 |
| Séquence numéro de commande par restaurant | Automatique (extension) + test 5.3 |
| Isolation stratégie A (ALS + extension + refus par défaut) | M2 + tests 5.2 |
| JWT scopé + switch-restaurant + requireRole/membership | M3 |
| WebSocket rooms par restaurant | Task 3.5 |
| Migration données prod en restaurant #1 | Task 1.4 |
| Suite d'isolation + auth/membership | M5 |
| `propriétaire` rôle distinct | Task 4.2 step 4 |
| Hardening `update/delete` par id (lecture-d'abord) + `markAsRead` | Extension (note) + Task 4.2 step 5 |

**Hors de ce plan (rappel) :** `Invitation` + `RestaurantBranding`, console super-admin d'activation, page d'inscription, Cloudinary, frontend → Plans suivants (P1-B frontend, puis P2, P3).

## Risques d'exécution & points de vigilance

- **`findUnique` post-filtré** : l'isolation des `findUnique` repose sur le post-filtrage par `restaurantId` (l'API d'extension ne permet pas de changer l'opération). Le test 5.2 « findUnique refuse un id d'un autre restaurant » le vérifie. Si un service utilise un `select` sans `restaurantId`, l'extension l'ajoute automatiquement.
- **`migrate dev --create-only`** : bien éditer le SQL AVANT d'appliquer ; toujours travailler sur une base contenant les données (ne pas réinitialiser). Sur la prod, ne lancer que `prisma migrate deploy` après sauvegarde.
- **`createMany` + `restaurantId`** : Prisma interdit les champs relationnels mais accepte la clé scalaire `restaurantId` — c'est bien la clé scalaire qu'on injecte.
- **Routes appliquant déjà `authenticate`** : doublon inoffensif ; ne pas retirer les `requireRole`.
- **Base de test** : `restaurant_test` DOIT être distincte de la base de dev (le helper fait des `deleteMany` massifs).
