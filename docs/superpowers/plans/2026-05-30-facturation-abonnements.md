# Facturation & Abonnements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter Restoflow d'une facturation par abonnement (3 paliers en FCFA) encaissée en Mobile Money via CinetPay, avec recouvrement « soft » (jamais de coupure automatique) et pilotage super-admin.

**Architecture:** 4 nouvelles tables Prisma (`SubscriptionPlan` global ; `Subscription`/`SubscriptionInvoice`/`SubscriptionPayment` scopées tenant). Endpoints tenant (lecture + paiement) via le client `prisma` scopé ; endpoints super-admin via `basePrisma` non-scopé ; webhook CinetPay public et idempotent (re-vérification serveur). Aucune modification destructive de l'existant. Le **gating dur** des modules premium est hors périmètre (phase 2).

**Tech Stack:** Node.js, Express, TypeScript, Prisma, Zod, Vitest + Supertest. CinetPay REST API (init paiement + check). Conventions existantes : `basePrisma`/`prisma`, `AsyncLocalStorage` tenant, `AppError`/`ErrorCodes`, `asyncHandler`, `sendSuccess`/`sendError`, `validate(schema, 'body'|'query')`.

**Périmètre de ce plan :** backend complet + scripts seed/backfill + suite de tests d'intégration. Le **frontend** (onglet Abonnement, bannière `past_due`, section Facturation super-admin) fait l'objet de la **Tâche 9** (cadrage + contrat d'API ; détaillé dans son propre plan après exploration du frontend).

**Préalable :** branche `feat/facturation-abonnements` déjà créée et active (isolée du travail concurrent).

---

## Structure des fichiers

**Créés :**
- `backend/prisma/migrations/<timestamp>_subscriptions_billing/migration.sql` (généré par Prisma)
- `backend/prisma/seed-plans.ts` — seed idempotent des 3 plans + backfill des abonnements
- `backend/src/services/billing.service.ts` — logique tenant (abonnement, factures, génération paresseuse, transitions de statut)
- `backend/src/services/billing-admin.service.ts` — logique super-admin (CRUD plans, liste abonnements, paiement manuel)
- `backend/src/services/cinetpay.service.ts` — wrapper API CinetPay (init + check), testable
- `backend/src/controllers/billing.controller.ts` — contrôleurs tenant + webhook
- `backend/src/controllers/billing-admin.controller.ts` — contrôleurs super-admin
- `backend/src/routes/billing.routes.ts` — routes tenant + webhook
- `backend/src/__tests__/integration/billing.test.ts` — suite d'intégration (isolation, flux paiement, webhook, super-admin)

**Modifiés :**
- `backend/prisma/schema.prisma` — 4 modèles + relations sur `Restaurant` et `User`
- `backend/src/config/prisma-extension.ts:5-10` — ajout des 3 modèles tenant à `TENANT_MODELS`
- `backend/src/utils/errors.ts` — codes `BILLING_001..005`
- `backend/src/config/env.ts` — variables CinetPay + `billingTrialDays`
- `backend/src/constants.ts` — statuts/cycles d'abonnement
- `backend/src/validators/schemas.ts` — schémas Zod facturation
- `backend/src/routes/index.ts` — montage de `/billing`
- `backend/src/routes/admin.routes.ts` — routes super-admin facturation
- `backend/src/controllers/admin.controller.ts` *(non — voir billing-admin.controller.ts)*
- `backend/src/__tests__/integration/helpers.ts:8-36` — purge des nouvelles tables
- `backend/.env.example` — documentation des nouvelles variables

---

## Task 1: Schéma Prisma — 4 modèles + relations + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/config/prisma-extension.ts:5-10`
- Create: `backend/prisma/migrations/<timestamp>_subscriptions_billing/migration.sql` (généré)

- [ ] **Step 1: Ajouter les 4 modèles à la fin de `schema.prisma`** (avant la dernière ligne, en suivant le style de `CatalogRequest`)

```prisma
// === Facturation & abonnements (monétisation plateforme) ===
// SubscriptionPlan est GLOBAL (catalogue géré par le super-admin, non scopé).
model SubscriptionPlan {
  id           Int      @id @default(autoincrement())
  code         String   @unique @db.VarChar(30) // 'essentiel' | 'pro' | 'business'
  name         String   @db.VarChar(80)
  priceMonthly Int      @map("price_monthly") // FCFA (entier, pas de centimes)
  priceYearly  Int      @map("price_yearly")  // FCFA
  maxUsers     Int?     @map("max_users")
  features     Json     @default("{}")        // drapeaux modules: { paie_cnps: true, annuaire: true, ... }
  isActive     Boolean  @default(true) @map("is_active")
  sortOrder    Int      @default(0) @map("sort_order")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  subscriptions Subscription[]

  @@map("subscription_plans")
}

// 1 abonnement par restaurant (scopé tenant).
model Subscription {
  id                 Int       @id @default(autoincrement())
  restaurantId       Int       @unique @map("restaurant_id")
  planId             Int       @map("plan_id")
  status             String    @default("trialing") @db.VarChar(20) // trialing|active|past_due|canceled
  billingCycle       String    @default("monthly") @map("billing_cycle") @db.VarChar(10) // monthly|yearly
  currentPeriodStart DateTime  @map("current_period_start")
  currentPeriodEnd   DateTime  @map("current_period_end")
  trialEndsAt        DateTime? @map("trial_ends_at")
  canceledAt         DateTime? @map("canceled_at")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  restaurant Restaurant            @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  plan       SubscriptionPlan      @relation(fields: [planId], references: [id], onDelete: Restrict)
  invoices   SubscriptionInvoice[]

  @@index([status], map: "idx_subscriptions_status")
  @@map("subscriptions")
}

// Facture émise par cycle (scopé tenant).
model SubscriptionInvoice {
  id             Int       @id @default(autoincrement())
  restaurantId   Int       @map("restaurant_id")
  subscriptionId Int       @map("subscription_id")
  amount         Int       // FCFA
  currency       String    @default("XOF") @db.VarChar(3)
  periodStart    DateTime  @map("period_start")
  periodEnd      DateTime  @map("period_end")
  dueDate        DateTime  @map("due_date")
  status         String    @default("pending") @db.VarChar(10) // pending|paid|void
  issuedAt       DateTime  @default(now()) @map("issued_at")
  paidAt         DateTime? @map("paid_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  restaurant   Restaurant            @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  subscription Subscription          @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  payments     SubscriptionPayment[]

  @@index([restaurantId, status], map: "idx_sub_invoices_restaurant_status")
  @@map("subscription_invoices")
}

// Tentative / règlement d'une facture (scopé tenant).
model SubscriptionPayment {
  id           Int      @id @default(autoincrement())
  restaurantId Int      @map("restaurant_id")
  invoiceId    Int      @map("invoice_id")
  provider     String   @db.VarChar(20) // cinetpay|manual
  providerTxId String?  @unique @map("provider_tx_id") @db.VarChar(120)
  method       String?  @db.VarChar(20) // orange_money|mtn|moov|wave|card|cash
  amount       Int
  status       String   @default("initiated") @db.VarChar(20) // initiated|succeeded|failed
  rawPayload   Json?    @map("raw_payload")
  recordedBy   Int?     @map("recorded_by")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  restaurant Restaurant          @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  invoice    SubscriptionInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  recorder   User?               @relation("PaymentRecorder", fields: [recordedBy], references: [id], onDelete: SetNull)

  @@index([restaurantId], map: "idx_sub_payments_restaurant")
  @@index([invoiceId], map: "idx_sub_payments_invoice")
  @@map("subscription_payments")
}
```

- [ ] **Step 2: Ajouter les relations inverses dans le modèle `Restaurant`** (bloc `model Restaurant`, après `orderPayments OrderPayment[]` ligne ~49)

```prisma
  subscription         Subscription?
  subscriptionInvoices SubscriptionInvoice[]
  subscriptionPayments SubscriptionPayment[]
```

- [ ] **Step 3: Ajouter la relation inverse dans le modèle `User`** (chercher `model User`, ajouter parmi ses relations)

```prisma
  paymentRecords SubscriptionPayment[] @relation("PaymentRecorder")
```

- [ ] **Step 4: Enregistrer les 3 modèles tenant dans l'extension d'isolation**

Modifier `backend/src/config/prisma-extension.ts:5-10`, ajouter à la fin du `Set` :

```typescript
export const TENANT_MODELS = new Set<string>([
  'Dish', 'StockItem', 'Order', 'Table', 'CashSession', 'Reservation',
  'Promotion', 'Expense', 'Employee', 'Supplier', 'Purchase', 'Inventory',
  'Notification', 'AuditLog', 'AppSetting', 'StockMovement', 'CatalogRequest',
  'OrderPayment',
  'Subscription', 'SubscriptionInvoice', 'SubscriptionPayment',
]);
```

> NE PAS ajouter `SubscriptionPlan` (catalogue global, géré par super-admin via `basePrisma`).

- [ ] **Step 5: Valider le schéma et générer la migration**

Run (depuis `backend/`) :
```bash
npx prisma validate
npx prisma migrate dev --name subscriptions_billing
```
Expected : `The migration has been applied successfully` + génération du client. La migration crée 4 tables + index + FK.

- [ ] **Step 6: Vérifier la génération du client**

Run :
```bash
npx prisma generate && npm run type-check
```
Expected : aucune erreur TypeScript ; `basePrisma.subscriptionPlan`, `prisma.subscription`, etc. typés.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/config/prisma-extension.ts
git commit -m "feat(facturation): schema Subscription* + migration + isolation tenant"
```

---

## Task 2: Constantes, codes d'erreur et variables d'environnement

**Files:**
- Modify: `backend/src/utils/errors.ts`
- Modify: `backend/src/constants.ts`
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env.example`

- [ ] **Step 1: Ajouter les codes d'erreur** dans l'objet `ErrorCodes` de `backend/src/utils/errors.ts` (après `CATALOG_003`)

```typescript
  BILLING_001: 'Abonnement introuvable',
  BILLING_002: 'Plan introuvable',
  BILLING_003: 'Facture introuvable',
  BILLING_004: 'Facture déjà réglée',
  BILLING_005: 'Paiement non confirmé par le prestataire',
```

- [ ] **Step 2: Ajouter les constantes de domaine** à la fin de `backend/src/constants.ts`

```typescript
// Facturation & abonnements.
export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const INVOICE_STATUSES = ['pending', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['orange_money', 'mtn', 'moov', 'wave', 'card', 'cash'] as const;
export const PLAN_CODES = ['essentiel', 'pro', 'business'] as const;
```

- [ ] **Step 3: Ajouter les variables d'environnement** dans l'objet `env` de `backend/src/config/env.ts` (après `appBaseUrl`)

```typescript
  // CinetPay (encaissement Mobile Money). En dev, valeurs vides tolérées (les appels échouent proprement).
  cinetpayApiKey: process.env.CINETPAY_API_KEY ?? '',
  cinetpaySiteId: process.env.CINETPAY_SITE_ID ?? '',
  cinetpaySecretKey: process.env.CINETPAY_SECRET_KEY ?? '',
  cinetpayBaseUrl: process.env.CINETPAY_BASE_URL ?? 'https://api-checkout.cinetpay.com/v2',
  // Durée de l'essai gratuit à la première souscription (jours).
  billingTrialDays: Number(process.env.BILLING_TRIAL_DAYS ?? 14),
```

- [ ] **Step 4: Documenter dans `.env.example`** (ajouter ces lignes)

```bash
# Facturation (CinetPay)
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_SECRET_KEY=
CINETPAY_BASE_URL=https://api-checkout.cinetpay.com/v2
BILLING_TRIAL_DAYS=14
```

- [ ] **Step 5: Vérifier la compilation**

Run : `npm run type-check`
Expected : aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add backend/src/utils/errors.ts backend/src/constants.ts backend/src/config/env.ts backend/.env.example
git commit -m "feat(facturation): codes erreur, constantes statuts, variables CinetPay"
```

---

## Task 3: Seed des plans par défaut + backfill des abonnements

**Files:**
- Create: `backend/prisma/seed-plans.ts`
- Modify: `backend/package.json` (script `seed:plans`)

- [ ] **Step 1: Écrire le script idempotent** `backend/prisma/seed-plans.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Défauts paramétrables ensuite par le super-admin. Prix en FCFA.
const PLANS = [
  { code: 'essentiel', name: 'Essentiel', priceMonthly: 9000, priceYearly: 91800, maxUsers: 3,
    features: { caisse: true, kds: true, stock: true, salle: true, stats_base: true }, sortOrder: 1 },
  { code: 'pro', name: 'Pro', priceMonthly: 18000, priceYearly: 183600, maxUsers: 8,
    features: { paiement_mixte: true, page_publique: true, exports: true, stats_avancees: true }, sortOrder: 2 },
  { code: 'business', name: 'Business', priceMonthly: 32000, priceYearly: 326400, maxUsers: 20,
    features: { paie_cnps: true, annuaire: true, support_prioritaire: true }, sortOrder: 3 },
];

async function main() {
  // 1) Upsert des plans (idempotent sur `code`).
  for (const p of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: { name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly,
        maxUsers: p.maxUsers, features: p.features, sortOrder: p.sortOrder, isActive: true },
      create: p,
    });
  }
  const essentiel = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'essentiel' } });

  // 2) Backfill : abonnement 'trialing' pour chaque restaurant actif SANS abonnement (ne coupe personne).
  const trialDays = Number(process.env.BILLING_TRIAL_DAYS ?? 14);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const restaurants = await prisma.restaurant.findMany({
    where: { status: 'active', subscription: { is: null } },
    select: { id: true },
  });
  for (const r of restaurants) {
    await prisma.subscription.create({
      data: { restaurantId: r.id, planId: essentiel.id, status: 'trialing',
        billingCycle: 'monthly', currentPeriodStart: now, currentPeriodEnd: periodEnd, trialEndsAt: periodEnd },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Plans seedés (${PLANS.length}). Abonnements backfillés: ${restaurants.length}.`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ajouter le script npm** dans `backend/package.json` (section `scripts`, après `create-demo-restaurant`)

```json
    "seed:plans": "tsx prisma/seed-plans.ts",
```

- [ ] **Step 3: Exécuter le seed et vérifier l'idempotence**

Run :
```bash
npm run seed:plans
npm run seed:plans
```
Expected : `Plans seedés (3).` aux deux exécutions, sans erreur de doublon (upsert). Backfill = 0 à la 2e exécution.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed-plans.ts backend/package.json
git commit -m "feat(facturation): seed des 3 plans + backfill abonnements restos actifs"
```

---

## Task 4: Service tenant — lecture abonnement, factures, génération paresseuse

**Files:**
- Create: `backend/src/services/billing.service.ts`
- Test: `backend/src/__tests__/integration/billing.test.ts`
- Modify: `backend/src/__tests__/integration/helpers.ts:8-36`

- [ ] **Step 1: Étendre la purge des tables de test** dans `helpers.ts`, ajouter EN TÊTE de la liste du `$transaction` (avant `notificationRead`, pour respecter l'ordre FK) :

```typescript
    basePrisma.subscriptionPayment.deleteMany(),
    basePrisma.subscriptionInvoice.deleteMany(),
    basePrisma.subscription.deleteMany(),
    basePrisma.subscriptionPlan.deleteMany(),
```

- [ ] **Step 2: Écrire le test d'intégration** (créer `billing.test.ts`) — bloc « service tenant »

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { signAccessToken } from '../../utils/jwt';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();

let A: SeededRestaurant;
let B: SeededRestaurant;
let ownerTokenA: string;
let ownerTokenB: string;
let superAdminToken: string;
let planId: number;

beforeAll(async () => {
  ({ A, B } = await resetAndSeedTwoRestaurants());

  // Plan + abonnement actif pour A, abonnement échu (passé) pour B.
  const plan = await basePrisma.subscriptionPlan.create({
    data: { code: 'essentiel', name: 'Essentiel', priceMonthly: 9000, priceYearly: 91800,
      maxUsers: 3, features: {}, sortOrder: 1 },
  });
  planId = plan.id;
  const now = new Date();
  const inFuture = new Date(now.getTime() + 10 * 86400000);
  const inPast = new Date(now.getTime() - 2 * 86400000);
  await basePrisma.subscription.create({
    data: { restaurantId: A.id, planId: plan.id, status: 'active', billingCycle: 'monthly',
      currentPeriodStart: new Date(now.getTime() - 20 * 86400000), currentPeriodEnd: inFuture },
  });
  await basePrisma.subscription.create({
    data: { restaurantId: B.id, planId: plan.id, status: 'active', billingCycle: 'monthly',
      currentPeriodStart: new Date(now.getTime() - 40 * 86400000), currentPeriodEnd: inPast },
  });

  const sa = await basePrisma.user.create({
    data: { email: 'sa-billing@test.local', passwordHash: await bcrypt.hash('sa', 10),
      displayName: 'SA', isSuperAdmin: true },
  });
  superAdminToken = signAccessToken({ userId: sa.id, isSuperAdmin: true });

  const loginA = await request(app).post('/api/auth/login')
    .send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerTokenA = loginA.body.data.accessToken;
  const loginB = await request(app).post('/api/auth/login')
    .send({ email: 'owner-resto-b@test.local', password: 'pass123' });
  ownerTokenB = loginB.body.data.accessToken;
});

afterAll(async () => { await basePrisma.$disconnect(); });

describe('Billing — tenant', () => {
  it('GET /api/billing/subscription renvoie l\'abonnement + plan de A', async () => {
    const res = await request(app).get('/api/billing/subscription')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurantId).toBe(A.id);
    expect(res.body.data.plan.code).toBe('essentiel');
    expect(res.body.data.status).toBe('active');
  });

  it('génération paresseuse : B (période échue) passe past_due + facture pending créée', async () => {
    const res = await request(app).get('/api/billing/subscription')
      .set('Authorization', `Bearer ${ownerTokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('past_due');

    const invoices = await request(app).get('/api/billing/invoices')
      .set('Authorization', `Bearer ${ownerTokenB}`);
    expect(invoices.body.data.length).toBe(1);
    expect(invoices.body.data[0].status).toBe('pending');
    expect(invoices.body.data[0].amount).toBe(9000);
  });

  it('idempotence : 2e appel ne crée pas de 2e facture pour la même période', async () => {
    await request(app).get('/api/billing/subscription').set('Authorization', `Bearer ${ownerTokenB}`);
    const invoices = await request(app).get('/api/billing/invoices')
      .set('Authorization', `Bearer ${ownerTokenB}`);
    expect(invoices.body.data.length).toBe(1);
  });

  it('isolation : A ne voit pas les factures de B', async () => {
    const res = await request(app).get('/api/billing/invoices')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((i: { restaurantId: number }) => i.restaurantId === A.id)).toBe(true);
  });

  it('GET /api/billing/plans liste les plans actifs', async () => {
    const res = await request(app).get('/api/billing/plans')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { code: string }) => p.code === 'essentiel')).toBe(true);
  });
});
```

- [ ] **Step 3: Lancer le test (échec attendu)**

Run : `npm run test:integration -- billing`
Expected : FAIL (routes `/api/billing/*` inexistantes → 404).

- [ ] **Step 4: Implémenter `billing.service.ts`**

```typescript
import { prisma, basePrisma } from '../config/prisma';
import { getTenantIdOrThrow } from '../config/tenant-context';
import { AppError } from '../utils/errors';

// Ajoute un cycle (mensuel/annuel) à une date.
function addCycle(from: Date, cycle: string): Date {
  const d = new Date(from);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function priceFor(plan: { priceMonthly: number; priceYearly: number }, cycle: string): number {
  return cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
}

// Génération paresseuse : si la période est échue et qu'aucune facture pending ne couvre la
// période courante, on émet une facture et on bascule l'abonnement en past_due. Idempotent.
async function ensureInvoiceIfDue(subscriptionId: number) {
  const restaurantId = getTenantIdOrThrow();
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, restaurantId },
    include: { plan: true },
  });
  if (!sub || sub.status === 'canceled') return;
  if (sub.currentPeriodEnd.getTime() > Date.now()) return; // pas encore échu

  const existing = await prisma.subscriptionInvoice.findFirst({
    where: { subscriptionId: sub.id, periodStart: sub.currentPeriodEnd, status: { in: ['pending', 'paid'] } },
    select: { id: true },
  });
  if (existing) {
    if (sub.status === 'active') {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
    }
    return;
  }

  const periodStart = sub.currentPeriodEnd;
  const periodEnd = addCycle(periodStart, sub.billingCycle);
  await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId: sub.id,
      amount: priceFor(sub.plan, sub.billingCycle),
      currency: 'XOF',
      periodStart,
      periodEnd,
      dueDate: periodStart,
      status: 'pending',
    },
  });
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
}

export async function getSubscription() {
  const restaurantId = getTenantIdOrThrow();
  const sub = await prisma.subscription.findFirst({
    where: { restaurantId },
    include: { plan: true },
  });
  if (!sub) throw new AppError(404, 'BILLING_001');
  await ensureInvoiceIfDue(sub.id);
  // Relecture après éventuelle bascule de statut.
  return prisma.subscription.findFirstOrThrow({ where: { restaurantId }, include: { plan: true } });
}

export async function listInvoices() {
  const restaurantId = getTenantIdOrThrow();
  return prisma.subscriptionInvoice.findMany({
    where: { restaurantId },
    orderBy: { issuedAt: 'desc' },
  });
}

export async function listPlans() {
  // Catalogue global, lisible par tout membre authentifié → basePrisma (non scopé).
  return basePrisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}
```

- [ ] **Step 5: Implémenter routes + contrôleurs minimaux pour faire passer le test** — créer `backend/src/controllers/billing.controller.ts`

```typescript
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as billingService from '../services/billing.service';

export const getSubscriptionController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await billingService.getSubscription());
});

export const listInvoicesController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await billingService.listInvoices());
});

export const listPlansController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await billingService.listPlans());
});
```

- [ ] **Step 6: Créer `backend/src/routes/billing.routes.ts`** (routes tenant ; le webhook sera ajouté en Task 7)

```typescript
import { Router } from 'express';
import { authenticate, requireRole, requireActiveRestaurant } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
import {
  getSubscriptionController,
  listInvoicesController,
  listPlansController,
} from '../controllers/billing.controller';

const router = Router();

router.use(authenticate, tenantContext, requireActiveRestaurant);

router.get('/subscription', requireRole('propriétaire', 'administrateur'), getSubscriptionController);
router.get('/invoices', requireRole('propriétaire', 'administrateur'), listInvoicesController);
router.get('/plans', requireRole('propriétaire', 'administrateur'), listPlansController);

export default router;
```

- [ ] **Step 7: Monter la route** dans `backend/src/routes/index.ts` — ajouter l'import après `catalogRoutes` (ligne 26) et le montage après la ligne 59 :

```typescript
import billingRoutes from './billing.routes';
// ...
router.use('/billing', billingRoutes);
```

- [ ] **Step 8: Lancer le test (succès attendu)**

Run : `npm run test:integration -- billing`
Expected : PASS (5 tests du bloc « Billing — tenant »).

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/billing.service.ts backend/src/controllers/billing.controller.ts \
  backend/src/routes/billing.routes.ts backend/src/routes/index.ts \
  backend/src/__tests__/integration/billing.test.ts backend/src/__tests__/integration/helpers.ts
git commit -m "feat(facturation): service tenant (abonnement, factures, generation paresseuse) + isolation"
```

---

## Task 5: Wrapper CinetPay (init + check), testable

**Files:**
- Create: `backend/src/services/cinetpay.service.ts`
- Test: `backend/src/__tests__/integration/billing.test.ts` (nouveau bloc `describe`)

- [ ] **Step 1: Écrire le test du wrapper** (ajouter ce bloc à la fin de `billing.test.ts` ; importe `vi`)

Modifier la 1re ligne d'import : `import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';`

```typescript
import * as cinetpay from '../../services/cinetpay.service';

describe('CinetPay wrapper', () => {
  it('initPayment renvoie payment_url quand CinetPay répond code 201', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '201', data: { payment_url: 'https://pay.cinetpay/abc' } }),
        { status: 200 }),
    );
    const out = await cinetpay.initPayment({
      transactionId: 'tx-1', amount: 9000, description: 'Abonnement', returnUrl: 'http://x', notifyUrl: 'http://y',
    });
    expect(out.paymentUrl).toBe('https://pay.cinetpay/abc');
    spy.mockRestore();
  });

  it('verifyPayment renvoie succeeded quand CinetPay status ACCEPTED', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '00', data: { status: 'ACCEPTED', payment_method: 'OMCIV2' } }),
        { status: 200 }),
    );
    const out = await cinetpay.verifyPayment('tx-1');
    expect(out.status).toBe('succeeded');
    spy.mockRestore();
  });

  it('verifyPayment renvoie failed quand status REFUSED', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '00', data: { status: 'REFUSED' } }), { status: 200 }),
    );
    const out = await cinetpay.verifyPayment('tx-1');
    expect(out.status).toBe('failed');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run : `npm run test:integration -- billing`
Expected : FAIL (`cinetpay.service` inexistant).

- [ ] **Step 3: Implémenter `backend/src/services/cinetpay.service.ts`**

```typescript
import { env } from '../config/env';

export interface InitPaymentParams {
  transactionId: string;
  amount: number;
  description: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface VerifyResult {
  status: 'succeeded' | 'failed' | 'pending';
  method?: string;
  raw: unknown;
}

// Initialise un paiement : renvoie l'URL hébergée CinetPay à présenter au proprio.
export async function initPayment(p: InitPaymentParams): Promise<{ paymentUrl: string; raw: unknown }> {
  const res = await fetch(`${env.cinetpayBaseUrl}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: env.cinetpayApiKey,
      site_id: env.cinetpaySiteId,
      transaction_id: p.transactionId,
      amount: p.amount,
      currency: 'XOF',
      description: p.description,
      return_url: p.returnUrl,
      notify_url: p.notifyUrl,
      channels: 'ALL',
    }),
  });
  const body = (await res.json()) as { code?: string; data?: { payment_url?: string } };
  const url = body?.data?.payment_url;
  if (body?.code !== '201' || !url) {
    throw new Error(`CinetPay init échoué: ${JSON.stringify(body)}`);
  }
  return { paymentUrl: url, raw: body };
}

// Source de vérité : on RE-VÉRIFIE le statut côté serveur (jamais se fier au seul payload webhook).
export async function verifyPayment(transactionId: string): Promise<VerifyResult> {
  const res = await fetch(`${env.cinetpayBaseUrl}/payment/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: env.cinetpayApiKey,
      site_id: env.cinetpaySiteId,
      transaction_id: transactionId,
    }),
  });
  const body = (await res.json()) as { data?: { status?: string; payment_method?: string } };
  const s = body?.data?.status;
  const status = s === 'ACCEPTED' ? 'succeeded' : s === 'REFUSED' ? 'failed' : 'pending';
  return { status, method: body?.data?.payment_method, raw: body };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run : `npm run test:integration -- billing`
Expected : PASS (les 3 tests « CinetPay wrapper »).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cinetpay.service.ts backend/src/__tests__/integration/billing.test.ts
git commit -m "feat(facturation): wrapper CinetPay (initPayment + verifyPayment) + tests"
```

---

## Task 6: Initiation de paiement + webhook idempotent

**Files:**
- Modify: `backend/src/services/billing.service.ts`
- Modify: `backend/src/controllers/billing.controller.ts`
- Modify: `backend/src/routes/billing.routes.ts`
- Test: `backend/src/__tests__/integration/billing.test.ts`

- [ ] **Step 1: Écrire le test du flux paiement** (ajouter à `billing.test.ts`)

```typescript
import { env as billingEnv } from '../../config/env';

describe('Billing — flux paiement CinetPay', () => {
  it('POST /invoices/:id/pay initie le paiement et renvoie l\'URL', async () => {
    const inv = await basePrisma.subscriptionInvoice.findFirst({ where: { restaurantId: B.id } });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '201', data: { payment_url: 'https://pay.cinetpay/xyz' } }),
        { status: 200 }),
    );
    const res = await request(app).post(`/api/billing/invoices/${inv!.id}/pay`)
      .set('Authorization', `Bearer ${ownerTokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.paymentUrl).toBe('https://pay.cinetpay/xyz');
    const pay = await basePrisma.subscriptionPayment.findFirst({ where: { invoiceId: inv!.id } });
    expect(pay!.status).toBe('initiated');
    expect(pay!.provider).toBe('cinetpay');
    spy.mockRestore();
  });

  it('webhook ACCEPTED : facture payée + abonnement réactivé + période prolongée', async () => {
    const inv = await basePrisma.subscriptionInvoice.findFirst({ where: { restaurantId: B.id } });
    const pay = await basePrisma.subscriptionPayment.findFirstOrThrow({ where: { invoiceId: inv!.id } });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '00', data: { status: 'ACCEPTED', payment_method: 'OMCIV2' } }),
        { status: 200 }),
    );
    const res = await request(app).post('/api/billing/webhook/cinetpay')
      .send({ cpm_trans_id: pay.providerTxId });
    expect(res.status).toBe(200);

    const paid = await basePrisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: inv!.id } });
    expect(paid.status).toBe('paid');
    const sub = await basePrisma.subscription.findUniqueOrThrow({ where: { restaurantId: B.id } });
    expect(sub.status).toBe('active');
    expect(sub.currentPeriodEnd.getTime()).toBe(paid.periodEnd.getTime());
    spy.mockRestore();
  });

  it('webhook rejoué (idempotent) : pas de double crédit ni double prolongation', async () => {
    const sub1 = await basePrisma.subscription.findUniqueOrThrow({ where: { restaurantId: B.id } });
    const pay = await basePrisma.subscriptionPayment.findFirstOrThrow({ where: { restaurantId: B.id, status: 'succeeded' } });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '00', data: { status: 'ACCEPTED' } }), { status: 200 }),
    );
    await request(app).post('/api/billing/webhook/cinetpay').send({ cpm_trans_id: pay.providerTxId });
    const sub2 = await basePrisma.subscription.findUniqueOrThrow({ where: { restaurantId: B.id } });
    expect(sub2.currentPeriodEnd.getTime()).toBe(sub1.currentPeriodEnd.getTime());
    spy.mockRestore();
  });

  it('webhook tx inconnue → 200 silencieux (pas d\'effet)', async () => {
    const res = await request(app).post('/api/billing/webhook/cinetpay')
      .send({ cpm_trans_id: 'inconnu-zzz' });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run : `npm run test:integration -- billing`
Expected : FAIL (route `/pay` et `/webhook/cinetpay` absentes).

- [ ] **Step 3: Ajouter `initInvoicePayment` et `confirmByTransaction` à `billing.service.ts`**

Ajouter en tête : `import * as cinetpay from './cinetpay.service'; import { env } from '../config/env';` (env déjà importé si présent — sinon ajouter).

```typescript
// Génère un identifiant de transaction déterministe et unique (sans Date.now en test : suffixe random léger).
function makeTransactionId(invoiceId: number): string {
  return `sub-inv-${invoiceId}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function initInvoicePayment(invoiceId: number) {
  const restaurantId = getTenantIdOrThrow();
  const invoice = await prisma.subscriptionInvoice.findFirst({ where: { id: invoiceId, restaurantId } });
  if (!invoice) throw new AppError(404, 'BILLING_003');
  if (invoice.status === 'paid') throw new AppError(409, 'BILLING_004');

  const transactionId = makeTransactionId(invoice.id);
  await prisma.subscriptionPayment.create({
    data: { invoiceId: invoice.id, provider: 'cinetpay', providerTxId: transactionId,
      amount: invoice.amount, status: 'initiated' },
  });

  const { paymentUrl, raw } = await cinetpay.initPayment({
    transactionId,
    amount: invoice.amount,
    description: `Abonnement Restoflow — facture #${invoice.id}`,
    returnUrl: `${env.appBaseUrl}/abonnement`,
    notifyUrl: `${env.appBaseUrl.replace(/\/$/, '')}/api/billing/webhook/cinetpay`,
  });
  await prisma.subscriptionPayment.updateMany({
    where: { providerTxId: transactionId, restaurantId }, data: { rawPayload: raw as object },
  });
  return { paymentUrl, transactionId };
}

// Appelé par le webhook (contexte NON scopé → basePrisma). Idempotent sur providerTxId.
export async function confirmByTransaction(transactionId: string): Promise<void> {
  const payment = await basePrisma.subscriptionPayment.findUnique({ where: { providerTxId: transactionId } });
  if (!payment) return;                          // tx inconnue → no-op silencieux
  if (payment.status === 'succeeded') return;    // déjà traité → idempotent

  const verdict = await cinetpay.verifyPayment(transactionId);
  if (verdict.status !== 'succeeded') {
    if (verdict.status === 'failed') {
      await basePrisma.subscriptionPayment.update({
        where: { id: payment.id }, data: { status: 'failed', rawPayload: verdict.raw as object },
      });
    }
    return;
  }

  const invoice = await basePrisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
  await basePrisma.$transaction([
    basePrisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: 'succeeded', method: verdict.method, rawPayload: verdict.raw as object },
    }),
    basePrisma.subscriptionInvoice.update({
      where: { id: invoice.id }, data: { status: 'paid', paidAt: new Date() },
    }),
    basePrisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: { status: 'active', currentPeriodStart: invoice.periodStart, currentPeriodEnd: invoice.periodEnd },
    }),
  ]);
}
```

- [ ] **Step 4: Ajouter les contrôleurs** dans `billing.controller.ts`

```typescript
import * as cinetpay from '../services/cinetpay.service'; // (non requis ici, retirer si inutilisé)

export const payInvoiceController = asyncHandler(async (req, res) => {
  sendSuccess(res, await billingService.initInvoicePayment(Number(req.params.id)));
});

// Webhook public : aucun contexte tenant. On extrait l'id de transaction CinetPay puis on confirme.
export const cinetpayWebhookController = asyncHandler(async (req, res) => {
  const txId = (req.body?.cpm_trans_id ?? req.body?.transaction_id) as string | undefined;
  if (txId) await billingService.confirmByTransaction(txId);
  // Toujours 200 : éviter que CinetPay re-tente indéfiniment ; l'idempotence protège.
  res.json({ success: true });
});
```

> Retirer la ligne d'import `cinetpay` du contrôleur si l'éditeur signale un import inutilisé.

- [ ] **Step 5: Brancher les routes** dans `billing.routes.ts`

Le webhook DOIT être public (avant le `router.use(authenticate, ...)`). Réorganiser ainsi :

```typescript
import { Router } from 'express';
import { authenticate, requireRole, requireActiveRestaurant } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
import {
  getSubscriptionController,
  listInvoicesController,
  listPlansController,
  payInvoiceController,
  cinetpayWebhookController,
} from '../controllers/billing.controller';

const router = Router();

// Webhook PUBLIC (pas d'auth, pas de contexte tenant — utilise basePrisma en interne).
router.post('/webhook/cinetpay', cinetpayWebhookController);

// Routes tenant.
router.use(authenticate, tenantContext, requireActiveRestaurant);
router.get('/subscription', requireRole('propriétaire', 'administrateur'), getSubscriptionController);
router.get('/invoices', requireRole('propriétaire', 'administrateur'), listInvoicesController);
router.get('/plans', requireRole('propriétaire', 'administrateur'), listPlansController);
router.post('/invoices/:id/pay', requireRole('propriétaire', 'administrateur'), payInvoiceController);

export default router;
```

- [ ] **Step 6: Lancer le test (succès attendu)**

Run : `npm run test:integration -- billing`
Expected : PASS (bloc « flux paiement CinetPay » : 4 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/billing.service.ts backend/src/controllers/billing.controller.ts \
  backend/src/routes/billing.routes.ts backend/src/__tests__/integration/billing.test.ts
git commit -m "feat(facturation): initiation paiement CinetPay + webhook idempotent (re-check serveur)"
```

---

## Task 7: API super-admin — CRUD plans, liste abonnements, paiement manuel

**Files:**
- Create: `backend/src/services/billing-admin.service.ts`
- Create: `backend/src/controllers/billing-admin.controller.ts`
- Modify: `backend/src/routes/admin.routes.ts`
- Modify: `backend/src/validators/schemas.ts`
- Test: `backend/src/__tests__/integration/billing.test.ts`

- [ ] **Step 1: Ajouter les schémas Zod** dans `backend/src/validators/schemas.ts` (à la fin du fichier)

```typescript
export const createPlanSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(80),
  priceMonthly: z.number().int().nonnegative(),
  priceYearly: z.number().int().nonnegative(),
  maxUsers: z.number().int().positive().optional(),
  features: z.record(z.boolean()).optional(),
  sortOrder: z.number().int().optional(),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  method: z.enum(['orange_money', 'mtn', 'moov', 'wave', 'card', 'cash']),
  amount: z.number().int().positive(),
});

export const billingListQuerySchema = z.object({
  status: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(),
});
```

- [ ] **Step 2: Écrire le test super-admin** (ajouter à `billing.test.ts`)

```typescript
describe('Billing — super-admin', () => {
  it('proprio refusé sur /admin/billing/subscriptions → 403', async () => {
    const res = await request(app).get('/api/admin/billing/subscriptions')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(res.status).toBe(403);
  });

  it('super-admin liste tous les abonnements avec resto + plan', async () => {
    const res = await request(app).get('/api/admin/billing/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].restaurant).toBeDefined();
    expect(res.body.data[0].plan).toBeDefined();
  });

  it('super-admin crée un plan', async () => {
    const res = await request(app).post('/api/admin/billing/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ code: 'starter', name: 'Starter', priceMonthly: 5000, priceYearly: 51000 });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('starter');
  });

  it('super-admin enregistre un paiement manuel → facture payée + période prolongée', async () => {
    // Crée une facture pending fraîche pour A.
    const sub = await basePrisma.subscription.findUniqueOrThrow({ where: { restaurantId: A.id } });
    const inv = await basePrisma.subscriptionInvoice.create({
      data: { restaurantId: A.id, subscriptionId: sub.id, amount: 9000, currency: 'XOF',
        periodStart: sub.currentPeriodEnd, periodEnd: new Date(sub.currentPeriodEnd.getTime() + 30 * 86400000),
        dueDate: sub.currentPeriodEnd, status: 'pending' },
    });
    const res = await request(app).post(`/api/admin/billing/subscriptions/${sub.id}/record-payment`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ invoiceId: inv.id, method: 'cash', amount: 9000 });
    expect(res.status).toBe(200);

    const paid = await basePrisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(paid.status).toBe('paid');
    const after = await basePrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.status).toBe('active');
    expect(after.currentPeriodEnd.getTime()).toBe(inv.periodEnd.getTime());
  });
});
```

- [ ] **Step 3: Lancer le test (échec attendu)**

Run : `npm run test:integration -- billing`
Expected : FAIL (routes `/admin/billing/*` absentes).

- [ ] **Step 4: Implémenter `backend/src/services/billing-admin.service.ts`** (tout via `basePrisma`, non scopé)

```typescript
import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';

export async function listSubscriptions(filter?: { status?: string }) {
  return basePrisma.subscription.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { currentPeriodEnd: 'asc' },
    include: {
      restaurant: { select: { id: true, name: true, slug: true, status: true } },
      plan: { select: { code: true, name: true, priceMonthly: true } },
    },
  });
}

export async function listPlans() {
  return basePrisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createPlan(input: {
  code: string; name: string; priceMonthly: number; priceYearly: number;
  maxUsers?: number; features?: Record<string, boolean>; sortOrder?: number;
}) {
  return basePrisma.subscriptionPlan.create({
    data: { ...input, features: input.features ?? {} },
  });
}

export async function updatePlan(id: number, input: Record<string, unknown>) {
  const existing = await basePrisma.subscriptionPlan.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'BILLING_002');
  return basePrisma.subscriptionPlan.update({ where: { id }, data: input });
}

// Enregistre un règlement reçu hors-ligne (Mobile Money direct, cash, virement) et solde la facture.
export async function recordManualPayment(
  subscriptionId: number,
  input: { invoiceId: number; method: string; amount: number },
  recordedBy?: number,
) {
  const sub = await basePrisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new AppError(404, 'BILLING_001');
  const invoice = await basePrisma.subscriptionInvoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice || invoice.subscriptionId !== subscriptionId) throw new AppError(404, 'BILLING_003');
  if (invoice.status === 'paid') throw new AppError(409, 'BILLING_004');

  await basePrisma.$transaction([
    basePrisma.subscriptionPayment.create({
      data: { restaurantId: invoice.restaurantId, invoiceId: invoice.id, provider: 'manual',
        method: input.method, amount: input.amount, status: 'succeeded', recordedBy },
    }),
    basePrisma.subscriptionInvoice.update({ where: { id: invoice.id }, data: { status: 'paid', paidAt: new Date() } }),
    basePrisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'active', currentPeriodStart: invoice.periodStart, currentPeriodEnd: invoice.periodEnd },
    }),
  ]);
  return basePrisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
}
```

- [ ] **Step 5: Implémenter `backend/src/controllers/billing-admin.controller.ts`**

```typescript
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as svc from '../services/billing-admin.service';

export const listSubscriptionsController = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  sendSuccess(res, await svc.listSubscriptions({ status }));
});

export const listPlansController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await svc.listPlans());
});

export const createPlanController = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.createPlan(req.body), 201);
});

export const updatePlanController = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.updatePlan(Number(req.params.id), req.body));
});

export const recordPaymentController = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.recordManualPayment(Number(req.params.id), req.body, req.user?.id));
});
```

- [ ] **Step 6: Brancher les routes super-admin** dans `backend/src/routes/admin.routes.ts`

Ajouter aux imports de validateurs (ligne 4) : `createPlanSchema, updatePlanSchema, recordPaymentSchema, billingListQuerySchema`. Ajouter un bloc d'import contrôleurs :

```typescript
import {
  listSubscriptionsController,
  listPlansController as billingListPlansController,
  createPlanController,
  updatePlanController,
  recordPaymentController,
} from '../controllers/billing-admin.controller';
```

Puis ajouter les routes avant `export default router;` :

```typescript
// Facturation & abonnements (plateforme).
router.get('/billing/subscriptions', validate(billingListQuerySchema, 'query'), listSubscriptionsController);
router.get('/billing/plans', billingListPlansController);
router.post('/billing/plans', validate(createPlanSchema), createPlanController);
router.put('/billing/plans/:id', validate(updatePlanSchema), updatePlanController);
router.post('/billing/subscriptions/:id/record-payment', validate(recordPaymentSchema), recordPaymentController);
```

- [ ] **Step 7: Lancer le test (succès attendu)**

Run : `npm run test:integration -- billing`
Expected : PASS (bloc « super-admin » : 4 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/billing-admin.service.ts backend/src/controllers/billing-admin.controller.ts \
  backend/src/routes/admin.routes.ts backend/src/validators/schemas.ts backend/src/__tests__/integration/billing.test.ts
git commit -m "feat(facturation): API super-admin (CRUD plans, liste abonnements, paiement manuel)"
```

---

## Task 8: Test anti-régression « soft enforcement » + suite complète

**Files:**
- Test: `backend/src/__tests__/integration/billing.test.ts`

- [ ] **Step 1: Ajouter le test garantissant que `Restaurant.status` n'est JAMAIS coupé automatiquement**

```typescript
describe('Billing — soft enforcement (jamais de coupure auto)', () => {
  it('un resto past_due reste status=active côté Restaurant', async () => {
    // B est passé past_due (Task 4) — vérifier que son Restaurant.status est inchangé.
    const resto = await basePrisma.restaurant.findUniqueOrThrow({ where: { id: B.id } });
    expect(resto.status).toBe('active');
  });

  it('l\'app opérationnelle de B reste accessible malgré past_due (ex. GET /api/dishes → 200)', async () => {
    const res = await request(app).get('/api/dishes').set('Authorization', `Bearer ${ownerTokenB}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Lancer la suite billing complète**

Run : `npm run test:integration -- billing`
Expected : PASS (tous les blocs : tenant, wrapper, flux paiement, super-admin, soft enforcement).

- [ ] **Step 3: Lancer toute la suite d'intégration (non-régression globale)**

Run : `npm run test:integration`
Expected : PASS — aucune régression sur isolation, onboarding, catalog, payroll, etc.

- [ ] **Step 4: Vérification finale du build**

Run : `npm run type-check && npm run build`
Expected : aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add backend/src/__tests__/integration/billing.test.ts
git commit -m "test(facturation): soft enforcement (Restaurant.status jamais coupe auto) + suite complete"
```

---

## Task 9: Frontend (cadrage — plan dédié à suivre)

> Le frontend (React/Vite) n'a pas encore été exploré dans ce plan. Cette tâche **n'écrit pas de code** : elle fige le **contrat d'API** et la liste des surfaces, à détailler dans un plan propre `docs/superpowers/plans/2026-05-XX-facturation-frontend.md` **après** avoir lu les conventions du dossier `frontend/src` (structure des pages, client API Axios, gestion des rôles/onglets, composants de la console super-admin).

**Surfaces à livrer :**
1. **Onglet « Abonnement »** (proprio/administrateur) : plan courant + cycle, prochaine échéance, **bouton Payer** (ouvre `paymentUrl`), historique des factures (montant/statut/date), changement de palier.
2. **Bannière `past_due`** globale dans l'espace de travail (rappel non bloquant) quand `subscription.status === 'past_due'`.
3. **Section « Facturation »** dans la console super-admin : liste des abonnements (resto/plan/statut/échéance), gestion du catalogue de plans, **enregistrer un paiement manuel**.

**Contrat d'API (déjà implémenté côté backend, Tasks 4-7) :**

| Méthode | Endpoint | Rôle | Réponse `data` |
|---|---|---|---|
| GET | `/api/billing/subscription` | proprio/admin | `{ id, restaurantId, status, billingCycle, currentPeriodEnd, plan: { code, name, priceMonthly } }` |
| GET | `/api/billing/invoices` | proprio/admin | `[{ id, amount, currency, status, periodStart, periodEnd, dueDate, issuedAt, paidAt }]` |
| GET | `/api/billing/plans` | proprio/admin | `[{ id, code, name, priceMonthly, priceYearly, maxUsers, features }]` |
| POST | `/api/billing/invoices/:id/pay` | proprio/admin | `{ paymentUrl, transactionId }` |
| GET | `/api/admin/billing/subscriptions?status=` | super-admin | `[{ ...subscription, restaurant, plan }]` |
| GET/POST | `/api/admin/billing/plans` (+ PUT `/:id`) | super-admin | plan(s) |
| POST | `/api/admin/billing/subscriptions/:id/record-payment` | super-admin | abonnement mis à jour |

**Note :** le **gating dur** (cacher/bloquer un module selon `plan.features`) reste **hors périmètre** (phase 2). En phase 1, l'UI affiche seulement l'état d'abonnement et les rappels.

- [ ] **Step 1:** Explorer `frontend/src` (pages, client API, routing par rôle, console super-admin) et écrire le plan frontend dédié.
- [ ] **Step 2:** Implémenter selon ce plan (TDD si la stack de test frontend le permet).

---

## Notes de revue (self-review)

- **Couverture du spec :** §3 paliers → Task 3 ; §4 modèle de données → Task 1 ; §5 flux CinetPay + idempotence + re-check → Tasks 5-6 ; §5.2 paiement manuel → Task 7 ; §5.3 essai/past_due soft → Tasks 4 & 8 ; §6 endpoints → Tasks 4,6,7 ; §7 surfaces front → Task 9 ; §8 env → Task 2 ; §9 migration/seed/backfill → Tasks 1 & 3 ; §10 tests → Tasks 4-8 ; §11 risques (webhook usurpé/rejoué) → Task 6.
- **Cohérence des types :** `addCycle`/`priceFor`/`ensureInvoiceIfDue`/`initInvoicePayment`/`confirmByTransaction` (billing.service) ; `initPayment`/`verifyPayment` (cinetpay.service) ; `listSubscriptions`/`createPlan`/`updatePlan`/`recordManualPayment` (billing-admin.service) — noms réutilisés tels quels dans contrôleurs/routes.
- **Pas de `Date.now()` interdit :** le code applicatif (hors workflow) peut utiliser `new Date()` / `Date.now()` normalement (la restriction ne concerne que les scripts de workflow). Les tests évitent les dépendances temporelles fragiles en calculant des offsets explicites.
- **Décision assumée :** génération de facture **paresseuse** (au `GET /subscription`) en phase 1 ; bascule cron en phase 2 (spec §5.1 & §12).
