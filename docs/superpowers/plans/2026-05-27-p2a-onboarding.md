# P2a — Onboarding & invitations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le sous-projet P2a : inscription publique → restaurant `pending` avec mode simulation → super-admin valide via `/admin` (activate déclenche reset transactionnel + restauration des stocks au baseline) → invitations 7 jours par lien avec acceptation login-first pour emails existants. Direction visuelle interne : Operator (sombre/dense/accent teal).

**Architecture :** Le multi-tenant et l'auth par email sont déjà en place (P1). P2a ajoute (1) un modèle `Invitation` + champs lifecycle sur `Restaurant` et `StockItem.baselineQuantity`, (2) trois nouvelles couches d'endpoints — public (`/auth/signup`, `/public/invitations/...`), tenant (`/invitations`), super-admin (`/admin/restaurants/...`) — (3) des écrans dédiés (signup, invite accept, suspended, rejected, pending-member, console super-admin) avec un bandeau de simulation et un routage par statut, et (4) l'aiguillage de toute action manuelle de stock vers la mise à jour du `baselineQuantity`. L'activation est une transaction Prisma qui supprime les données transactionnelles du resto et restaure les stocks au baseline.

**Tech Stack :** Node 22, Express 4, Prisma 5.22 (PostgreSQL Neon), JWT, bcrypt, Zod, `express-rate-limit`, React 18 + Vite + Tailwind, Vitest + Supertest.

**Référence spec :** `docs/superpowers/specs/2026-05-27-p2a-onboarding-design.md`

---

## Carte des fichiers

**Créés (backend) :**
- `backend/prisma/migrations/<timestamp>_p2a_onboarding/migration.sql` (M1).
- `backend/src/services/admin.service.ts` (M4) — list/activate-with-reset/suspend/reactivate/reject.
- `backend/src/services/invitation.service.ts` (M3) — create/list/revoke/getByToken/accept.
- `backend/src/services/signup.service.ts` (M2) — signup + slug generation.
- `backend/src/controllers/admin.controller.ts` (M4).
- `backend/src/controllers/invitation.controller.ts` (M3) — tenant + public endpoints.
- `backend/src/controllers/signup.controller.ts` (M2).
- `backend/src/routes/admin.routes.ts` (M4).
- `backend/src/routes/invitation.routes.ts` (M3) — tenant routes.
- `backend/src/routes/public.routes.ts` (M3) — public routes (invitation peek/accept).
- `backend/src/utils/slug.ts` (M2) — `slugify` + uniqueness helper.
- `backend/src/__tests__/integration/onboarding.test.ts` (M9).
- `backend/src/__tests__/integration/invitations.test.ts` (M9).
- `backend/src/__tests__/integration/admin.test.ts` (M9).

**Modifiés (backend) :**
- `backend/prisma/schema.prisma` (M1) — `Invitation`, lifecycle fields, `baselineQuantity`.
- `backend/src/services/stock.service.ts` (M1) — capture du baseline sur édition manuelle.
- `backend/src/services/order.service.ts` (M1) — vérification que decrement ne touche pas `baselineQuantity` (déjà le cas, juste un test).
- `backend/src/services/auth.service.ts` (M2) — `me()` renvoie `currentRestaurant`.
- `backend/src/middlewares/rateLimit.ts` (M2) — ajout `signupLimiter`.
- `backend/src/routes/index.ts` (M2-M4) — branchements signup, public, invitations tenant, admin.
- `backend/src/validators/schemas.ts` (M2-M4) — schémas signup, invitation create, admin actions.
- `backend/src/utils/errors.ts` (M2-M4) — nouveaux codes (`AUTH_007`, `INV_001..005`, `ADMIN_001`).
- `backend/src/__tests__/logic.test.ts` (M2) — tests `slugify`.

**Créés (frontend) :**
- `frontend/src/pages/SignupPage.tsx` (M5).
- `frontend/src/pages/InviteAcceptPage.tsx` (M7).
- `frontend/src/pages/SuspendedPage.tsx` (M6).
- `frontend/src/pages/RejectedPage.tsx` (M6).
- `frontend/src/pages/PendingMemberPage.tsx` (M6).
- `frontend/src/pages/SuperAdminPage.tsx` (M8).
- `frontend/src/components/SimulationBanner.tsx` (M6).
- `frontend/src/components/StatusBlockedCard.tsx` (M6) — carte réutilisable pour `suspended`/`rejected`.
- `frontend/src/utils/contact.ts` (M6) — constantes AwemA + helpers WhatsApp.
- `frontend/src/services/auth-helpers.test.ts` (M5) — déjà existant, on y ajoute peut-être ; sinon créer.

**Modifiés (frontend) :**
- `frontend/src/App.tsx` (M5-M8) — routes signup, invite, suspended, rejected, pending-member, admin.
- `frontend/src/components/ProtectedRoute.tsx` (M5-M6) — aiguillage par status du restaurant courant.
- `frontend/src/pages/LoginPage.tsx` (M5) — lien « Créer un restaurant ».
- `frontend/src/pages/AdminPage.tsx` (M7) — refonte de l'onglet Membres (liste + invitations + create modal).
- `frontend/src/contexts/AuthContext.tsx` (M5) — expose `currentRestaurant` (status, name, slug) depuis `me()`.
- `frontend/src/services/endpoints.ts` (M2-M8) — signupApi, invitationApi, adminApi.
- `frontend/src/types/index.ts` (M2) — `CurrentRestaurant`, `Invitation`, `AdminRestaurantRow`.

**Découpage en milestones** (chacun finit par tests verts + commit) :
- **M1** — Schéma, migration, baseline stock.
- **M2** — Signup public + slug + rate limit + endpoint `me` enrichi.
- **M3** — Invitations (entités, service, routes tenant + public).
- **M4** — Super-admin (service activate avec reset, routes admin).
- **M5** — Frontend signup + routage par statut + LoginPage CTA.
- **M6** — Frontend écrans bloquants + bandeau simulation + contact AwemA.
- **M7** — Frontend invitations (acceptance page + management dans AdminPage).
- **M8** — Frontend console super-admin.
- **M9** — Tests d'intégration onboarding + invitations + admin.

---

## Préambule — branche dédiée

- [ ] **Créer la branche depuis `main`**

```bash
git checkout main
git checkout -b feat/p2a-onboarding
git branch --show-current
```
Expected: `feat/p2a-onboarding`.

---

## MILESTONE 1 — Schéma, migration, baseline stock

### Task 1.1 — Schéma Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Ajouter le modèle `Invitation`**

Dans `backend/prisma/schema.prisma`, ajouter (après `Membership`) :

```prisma
model Invitation {
  id           Int       @id @default(autoincrement())
  restaurantId Int       @map("restaurant_id")
  email        String    @db.VarChar(190)
  role         String    @db.VarChar(20)
  token        String    @unique @db.VarChar(64)
  status       String    @default("pending") @db.VarChar(20)
  expiresAt    DateTime  @map("expires_at")
  createdBy    Int?      @map("created_by")
  acceptedAt   DateTime? @map("accepted_at")
  revokedAt    DateTime? @map("revoked_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Restrict)
  creator    User?      @relation("InvitationCreator", fields: [createdBy], references: [id])

  @@index([restaurantId, status], map: "idx_invitations_restaurant_status")
  @@index([email, status], map: "idx_invitations_email_status")
  @@map("invitations")
}
```

- [ ] **Step 2: Ajouter les champs lifecycle sur `Restaurant`**

Repérer le modèle `Restaurant` et y ajouter (à côté de `status`) :

```prisma
  activatedAt       DateTime? @map("activated_at")
  rejectedAt        DateTime? @map("rejected_at")
  rejectedReason    String?   @map("rejected_reason") @db.Text
  suspendedAt       DateTime? @map("suspended_at")
  suspendedReason   String?   @map("suspended_reason") @db.Text

  invitations Invitation[]
```

(La ligne `invitations` rejoint les autres relations inverses de Restaurant.)

- [ ] **Step 3: Ajouter la relation `User` côté createur d'invitation**

Repérer le modèle `User` et ajouter (parmi les relations existantes) :

```prisma
  invitationsCreated Invitation[] @relation("InvitationCreator")
```

- [ ] **Step 4: Ajouter `baselineQuantity` sur `StockItem`**

Dans le modèle `StockItem` (après `quantity`) :

```prisma
  baselineQuantity Float?  @map("baseline_quantity")
```

- [ ] **Step 5: Valider le schéma**

Run: `cd backend && npx prisma validate`
Expected: « The schema at prisma/schema.prisma is valid ».

### Task 1.2 — Migration manuelle

> **Méthode P1** : `prisma migrate dev --create-only` ne fonctionne pas en non-interactif ici. On crée le SQL à la main, on l'applique via psql sur `restaurant_db`, on enregistre avec `prisma migrate resolve --applied`, puis `prisma migrate deploy` sur `restaurant_test`.

**Files:**
- Create: `backend/prisma/migrations/20260527120000_p2a_onboarding/migration.sql`

- [ ] **Step 1: Créer le dossier et le fichier SQL**

Créer `backend/prisma/migrations/20260527120000_p2a_onboarding/migration.sql` :

```sql
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
```

- [ ] **Step 2: Appliquer sur `restaurant_db`**

```powershell
$env:PGPASSWORD = "restaurant"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5433 -U restaurant -d restaurant_db `
  -v ON_ERROR_STOP=1 `
  -f "backend/prisma/migrations/20260527120000_p2a_onboarding/migration.sql"
```
Expected: 6 `ALTER TABLE`, 1 `CREATE TABLE`, 3 `CREATE INDEX`, 2 `ALTER TABLE ADD CONSTRAINT`.

- [ ] **Step 3: Enregistrer**

```bash
cd backend && npx prisma migrate resolve --applied 20260527120000_p2a_onboarding
```

- [ ] **Step 4: Appliquer sur `restaurant_test`**

```powershell
$env:DATABASE_URL = "postgresql://restaurant:restaurant@localhost:5433/restaurant_test?schema=public"
cd backend && npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
```

- [ ] **Step 5: Régénérer le client + valider**

```bash
cd backend && npx prisma generate && npx prisma migrate status
```
Expected: « Database schema is up to date ».

- [ ] **Step 6: Commit**

```bash
git add backend/prisma
git commit -m "feat(p2a): schema + migration (Invitation, lifecycle, baselineQuantity)"
```

### Task 1.3 — Capture du baseline dans `stock.service`

**Files:**
- Modify: `backend/src/services/stock.service.ts`

- [ ] **Step 1: Mettre à jour `createStockItem`**

Dans `backend/src/services/stock.service.ts`, repérer `createStockItem` (signature qui accepte `{name, quantity, unit, ...}`) et faire en sorte que la création passe également `baselineQuantity: data.quantity` :

```ts
export async function createStockItem(data: {
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  alertThreshold?: number;
}) {
  return prisma.stockItem.create({
    data: {
      name: data.name,
      quantity: data.quantity,
      baselineQuantity: data.quantity, // P2a : baseline = quantité initiale
      unit: data.unit,
      unitCost: data.unitCost ?? 0,
      alertThreshold: data.alertThreshold ?? 10,
    },
  });
}
```

(Adapter à la forme exacte de la fonction existante — ne pas dupliquer les champs déjà présents.)

- [ ] **Step 2: Mettre à jour `updateStockItem`**

Repérer `updateStockItem`. Quand `data.quantity` est fourni, ajouter `baselineQuantity: data.quantity` dans le `data:` du `prisma.stockItem.update` :

```ts
const updateData: Prisma.StockItemUpdateInput = {
  ...(data.name !== undefined ? { name: data.name } : {}),
  ...(data.quantity !== undefined ? { quantity: data.quantity, baselineQuantity: data.quantity } : {}),
  ...(data.unit !== undefined ? { unit: data.unit } : {}),
  ...(data.unitCost !== undefined ? { unitCost: data.unitCost } : {}),
  ...(data.alertThreshold !== undefined ? { alertThreshold: data.alertThreshold } : {}),
  lastUpdated: new Date(),
};
return prisma.stockItem.update({ where: { id }, data: updateData });
```

- [ ] **Step 3: Mettre à jour `addQuantity`**

Repérer `addQuantity(id, quantity)`. Après l'update qui change `quantity`, mettre aussi `baselineQuantity = nouveau total` (manuel = baseline) :

```ts
export async function addQuantity(id: number, quantity: number) {
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) throw new AppError(404, 'STOCK_001');
  const newQuantity = roundQty(item.quantity + quantity);
  await prisma.stockItem.update({
    where: { id },
    data: { quantity: newQuantity, baselineQuantity: newQuantity, lastUpdated: new Date() },
  });
  // (le reste — stockMovement, audit, etc. — inchangé)
  ...
}
```

- [ ] **Step 4: Mettre à jour `recordLoss`**

Pareil pour `recordLoss(id, quantity, cause, note)` : après le décrément manuel, set `baselineQuantity = nouvelle quantity` :

```ts
const newQuantity = roundQty(item.quantity - quantity);
await prisma.stockItem.update({
  where: { id },
  data: { quantity: newQuantity, baselineQuantity: newQuantity, lastUpdated: new Date() },
});
```

- [ ] **Step 5: NE PAS toucher `order.service.createOrder`**

Vérifier que le décrément de stock dans `order.service.createOrder` (la boucle `for (const [stockItemId, qty] of required)`) ne touche QUE `quantity`, pas `baselineQuantity`. Si déjà le cas (devrait l'être) : aucun changement. Sinon, retirer toute mention de baseline dans cette boucle.

- [ ] **Step 6: type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/stock.service.ts
git commit -m "feat(p2a): capture baselineQuantity sur edition manuelle de stock"
```

---

## MILESTONE 2 — Signup public + slug + rate limit + `me` enrichi

### Task 2.1 — Helper `slug.ts` + tests

**Files:**
- Create: `backend/src/utils/slug.ts`
- Modify: `backend/src/__tests__/logic.test.ts`

- [ ] **Step 1: Test d'abord (TDD)**

Ajouter en fin de `backend/src/__tests__/logic.test.ts` :

```ts
import { slugify } from '../utils/slug';

describe('slugify', () => {
  it('convertit en kebab-case sans accents', () => {
    expect(slugify('Chez Fatou')).toBe('chez-fatou');
    expect(slugify('Café Crème')).toBe('cafe-creme');
    expect(slugify('La Maison N°7')).toBe('la-maison-no-7');
  });
  it('compresse les espaces et separateurs', () => {
    expect(slugify('   Le  Vieux    Port  ')).toBe('le-vieux-port');
    expect(slugify('A & B / C')).toBe('a-and-b-c');
  });
  it('tronque a 60 caracteres', () => {
    const long = 'a'.repeat(120);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
  it('retire les tirets en bord', () => {
    expect(slugify('--Hello--')).toBe('hello');
  });
});
```

- [ ] **Step 2: Run failing**

Run: `cd backend && npx vitest run src/__tests__/logic.test.ts`
Expected: FAIL « Cannot find module '../utils/slug' ».

- [ ] **Step 3: Implémenter `slug.ts`**

`backend/src/utils/slug.ts` :

```ts
// Slugifie un nom en kebab-case ASCII (60 chars max).
export function slugify(input: string): string {
  return input
    .normalize('NFD')                       // décompose les accents
    .replace(/[̀-ͯ]/g, '')        // retire les marques diacritiques
    .toLowerCase()
    .replace(/°/g, 'o')                     // exception : ° → o (« n°7 » → « no-7 »)
    .replace(/&/g, ' and ')                 // & → and
    .replace(/[^a-z0-9]+/g, '-')            // tout le reste devient -
    .replace(/^-+|-+$/g, '')                // trim tirets aux bords
    .slice(0, 60)                           // longueur max 60
    .replace(/-+$/g, '');                   // re-trim après slice
}
```

- [ ] **Step 4: Tests verts**

Run: `cd backend && npx vitest run src/__tests__/logic.test.ts -t slugify`
Expected: 4 PASS.

### Task 2.2 — Rate limiter signup

**Files:**
- Modify: `backend/src/middlewares/rateLimit.ts`

- [ ] **Step 1: Ajouter `signupLimiter`**

Dans `backend/src/middlewares/rateLimit.ts`, ajouter (à côté du `loginLimiter` existant) :

```ts
import { sendError } from '../utils/response';

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,             // 1 heure
  max: 3,                               // 3 inscriptions par IP par heure
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'AUTH_007', 'Trop d\'inscriptions depuis cette adresse, réessayez plus tard'),
});
```

- [ ] **Step 2: Ajouter `AUTH_007` dans `errors.ts`**

`backend/src/utils/errors.ts` — repérer la table de codes et ajouter à côté de `AUTH_006` :

```ts
  AUTH_007: 'Trop d\'inscriptions depuis cette adresse',
```

### Task 2.3 — Service signup

**Files:**
- Create: `backend/src/services/signup.service.ts`

- [ ] **Step 1: Implémenter**

```ts
import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { slugify } from '../utils/slug';
import { listActiveMembershipsForUser } from './membership.service';

interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  restaurantName: string;
}

async function findFreeSlug(base: string): Promise<string> {
  let candidate = base || 'restaurant';
  let suffix = 1;
  for (;;) {
    const taken = await basePrisma.restaurant.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, 60);
  }
}

export async function signup(input: SignupInput) {
  const email = input.email.toLowerCase().trim();
  const restaurantName = input.restaurantName.trim();

  // L'email doit etre libre globalement (User.email unique).
  const existing = await basePrisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'USER_002', 'Email déjà utilisé');

  const slug = await findFreeSlug(slugify(restaurantName));

  // Tout en transaction : User + Restaurant pending + Membership proprietaire.
  const { user, restaurant } = await basePrisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: { name: restaurantName, slug, status: 'pending' },
    });
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: input.displayName.trim() || null,
        restaurantId: restaurant.id,
        memberships: { create: { restaurantId: restaurant.id, role: 'propriétaire' } },
      },
    });
    return { user, restaurant };
  });

  // Auto-login scope sur le nouveau resto.
  const memberships = await listActiveMembershipsForUser(user.id);
  const accessToken = signAccessToken({
    userId: user.id,
    isSuperAdmin: user.isSuperAdmin,
    restaurantId: restaurant.id,
    role: 'propriétaire',
  });
  const refreshToken = signRefreshToken({ userId: user.id });

  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, isSuperAdmin: user.isSuperAdmin },
    accessToken,
    refreshToken,
    memberships,
  };
}
```

### Task 2.4 — Validateur + controller + route signup

**Files:**
- Modify: `backend/src/validators/schemas.ts`
- Create: `backend/src/controllers/signup.controller.ts`
- Modify: `backend/src/routes/auth.routes.ts`

- [ ] **Step 1: Ajouter `signupSchema`**

Dans `backend/src/validators/schemas.ts`, après `loginSchema` :

```ts
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Au moins 6 caractères'),
  displayName: z.string().min(1).max(80),
  restaurantName: z.string().min(1).max(120),
});
```

- [ ] **Step 2: Controller**

`backend/src/controllers/signup.controller.ts` :

```ts
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as signupService from '../services/signup.service';

export const signupController = asyncHandler(async (req, res) => {
  const result = await signupService.signup(req.body);
  sendSuccess(res, result, 201);
});
```

- [ ] **Step 3: Route avec rate limit**

`backend/src/routes/auth.routes.ts` — ajouter :

```ts
import { signupController } from '../controllers/signup.controller';
import { signupLimiter } from '../middlewares/rateLimit';
import { signupSchema } from '../validators/schemas';

router.post('/signup', signupLimiter, validate(signupSchema), signupController);
```

### Task 2.5 — `me()` renvoie `currentRestaurant`

**Files:**
- Modify: `backend/src/services/auth.service.ts`

- [ ] **Step 1: Enrichir `getMe`**

Dans `backend/src/services/auth.service.ts`, repérer `getMe(userId)`. Récupérer le restaurant courant à partir du token (déjà passé par `req.user`/`req.restaurantId`). Comme `auth.service.getMe` ne reçoit que `userId`, ajouter un argument optionnel `restaurantId?: number` et le passer depuis le controller. Implémentation :

```ts
export async function getMe(userId: number, restaurantId?: number) {
  const user = await basePrisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'USER_001');
  const memberships = await listActiveMembershipsForUser(user.id);
  let currentRestaurant = null;
  if (restaurantId != null) {
    const r = await basePrisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, slug: true, status: true, rejectedReason: true, suspendedReason: true },
    });
    if (r) currentRestaurant = r;
  }
  return { user: { id: user.id, email: user.email, displayName: user.displayName, isSuperAdmin: user.isSuperAdmin }, memberships, currentRestaurant };
}
```

Modifier le `meController` (`backend/src/controllers/auth.controller.ts`) :

```ts
export const meController = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user!.id, req.restaurantId);
  sendSuccess(res, result);
});
```

- [ ] **Step 2: type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit M2**

```bash
git add backend/src backend/src/__tests__/logic.test.ts
git commit -m "feat(p2a): signup public + slug + rate limit + me enrichi"
```

---

## MILESTONE 3 — Invitations (entités, service, routes)

### Task 3.1 — Service invitation

**Files:**
- Create: `backend/src/services/invitation.service.ts`

- [ ] **Step 1: Implémenter**

```ts
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { basePrisma } from '../config/prisma';
import { getTenantIdOrThrow } from '../config/tenant-context';
import { AppError } from '../utils/errors';
import { Role } from '../constants';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { listActiveMembershipsForUser } from './membership.service';

const INVITE_TTL_DAYS = 7;
const INVITABLE_ROLES: Role[] = ['administrateur', 'caissier', 'cuisinier', 'serveur'];

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');   // 64 hex chars
}

export async function listInvitations() {
  const restaurantId = getTenantIdOrThrow();
  return basePrisma.invitation.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createInvitation(input: { email: string; role: Role }, createdBy?: number) {
  const restaurantId = getTenantIdOrThrow();
  if (!INVITABLE_ROLES.includes(input.role)) {
    throw new AppError(400, 'INV_001', 'Rôle non invitable');
  }
  const email = input.email.toLowerCase().trim();
  const existingPending = await basePrisma.invitation.findFirst({
    where: { restaurantId, email, status: 'pending' },
  });
  if (existingPending) throw new AppError(409, 'INV_002', 'Une invitation est déjà en attente pour cet email');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invitation = await basePrisma.invitation.create({
    data: { restaurantId, email, role: input.role, token, status: 'pending', expiresAt, createdBy },
  });
  return {
    ...invitation,
    url: `${env.appBaseUrl}/invite/${token}`,
  };
}

export async function revokeInvitation(id: number) {
  const restaurantId = getTenantIdOrThrow();
  const inv = await basePrisma.invitation.findFirst({ where: { id, restaurantId } });
  if (!inv) throw new AppError(404, 'INV_003', 'Invitation introuvable');
  if (inv.status !== 'pending') throw new AppError(400, 'INV_004', 'Cette invitation n\'est plus en attente');
  return basePrisma.invitation.update({
    where: { id },
    data: { status: 'revoked', revokedAt: new Date() },
  });
}

// Public — pas de tenant context.
export async function peekInvitation(token: string) {
  const inv = await basePrisma.invitation.findUnique({
    where: { token },
    include: { restaurant: { select: { name: true, status: true } } },
  });
  if (!inv) throw new AppError(404, 'INV_003', 'Invitation introuvable');
  // Lazy expire
  if (inv.status === 'pending' && inv.expiresAt < new Date()) {
    await basePrisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
    inv.status = 'expired';
  }
  const emailExists = !!(await basePrisma.user.findUnique({ where: { email: inv.email }, select: { id: true } }));
  return {
    restaurantName: inv.restaurant.name,
    role: inv.role,
    email: inv.email,
    status: inv.status,
    expiresAt: inv.expiresAt,
    emailExists,
  };
}

export async function acceptInvitation(token: string, body: { password: string; displayName?: string }) {
  const inv = await basePrisma.invitation.findUnique({ where: { token } });
  if (!inv) throw new AppError(404, 'INV_003', 'Invitation introuvable');
  if (inv.status !== 'pending') throw new AppError(410, 'INV_005', 'Lien non valide (expiré, révoqué ou déjà utilisé)');
  if (inv.expiresAt < new Date()) {
    await basePrisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
    throw new AppError(410, 'INV_005', 'Lien expiré');
  }
  // Vérif que le resto est active (sinon impossible d'inviter — defense-in-depth).
  const resto = await basePrisma.restaurant.findUnique({ where: { id: inv.restaurantId }, select: { status: true } });
  if (!resto || resto.status !== 'active') throw new AppError(403, 'INV_005', 'Restaurant non actif');

  const existing = await basePrisma.user.findUnique({ where: { email: inv.email } });

  let userId: number;
  if (existing) {
    // Login-first : verifier le mot de passe de l'existant.
    const ok = await bcrypt.compare(body.password, existing.passwordHash);
    if (!ok) throw new AppError(401, 'AUTH_001', 'Mot de passe incorrect');
    if (!existing.isActive) throw new AppError(403, 'AUTH_004');
    userId = existing.id;
  } else {
    // Nouveau compte.
    if (body.password.length < 6) throw new AppError(400, 'VALIDATION_001', 'Mot de passe trop court');
    const created = await basePrisma.user.create({
      data: {
        email: inv.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        displayName: body.displayName?.trim() || null,
        restaurantId: inv.restaurantId,
      },
    });
    userId = created.id;
  }

  await basePrisma.$transaction([
    basePrisma.membership.upsert({
      where: { userId_restaurantId: { userId, restaurantId: inv.restaurantId } },
      create: { userId, restaurantId: inv.restaurantId, role: inv.role, isActive: true },
      update: { role: inv.role, isActive: true },
    }),
    basePrisma.invitation.update({
      where: { id: inv.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    }),
  ]);

  const user = (await basePrisma.user.findUnique({ where: { id: userId } }))!;
  const memberships = await listActiveMembershipsForUser(userId);
  const accessToken = signAccessToken({
    userId,
    isSuperAdmin: user.isSuperAdmin,
    restaurantId: inv.restaurantId,
    role: inv.role as Role,
  });
  const refreshToken = signRefreshToken({ userId });
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, isSuperAdmin: user.isSuperAdmin },
    accessToken,
    refreshToken,
    memberships,
  };
}
```

### Task 3.2 — Codes d'erreur invitations

**Files:**
- Modify: `backend/src/utils/errors.ts`

- [ ] **Step 1: Ajouter les codes**

```ts
  INV_001: 'Rôle non invitable',
  INV_002: 'Une invitation est déjà en attente pour cet email',
  INV_003: 'Invitation introuvable',
  INV_004: 'Invitation non en attente',
  INV_005: 'Lien d\'invitation expiré ou non valide',
```

### Task 3.3 — Validateur invitation

**Files:**
- Modify: `backend/src/validators/schemas.ts`

- [ ] **Step 1: Ajouter**

```ts
const INVITABLE_ROLES = ['administrateur', 'caissier', 'cuisinier', 'serveur'] as const;

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(INVITABLE_ROLES),
});

export const acceptInvitationSchema = z.object({
  password: z.string().min(6),
  displayName: z.string().min(1).max(80).optional(),
});
```

### Task 3.4 — Controller + routes invitations

**Files:**
- Create: `backend/src/controllers/invitation.controller.ts`
- Create: `backend/src/routes/invitation.routes.ts`
- Create: `backend/src/routes/public.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Controller**

```ts
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as invitationService from '../services/invitation.service';
import { Role } from '../constants';

export const listInvitationsController = asyncHandler(async (req, res) => {
  sendSuccess(res, await invitationService.listInvitations());
});

export const createInvitationController = asyncHandler(async (req, res) => {
  const { email, role } = req.body as { email: string; role: Role };
  sendSuccess(res, await invitationService.createInvitation({ email, role }, req.user!.id), 201);
});

export const revokeInvitationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await invitationService.revokeInvitation(Number(req.params.id)));
});

export const peekInvitationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await invitationService.peekInvitation(req.params.token));
});

export const acceptInvitationController = asyncHandler(async (req, res) => {
  const { password, displayName } = req.body as { password: string; displayName?: string };
  sendSuccess(res, await invitationService.acceptInvitation(req.params.token, { password, displayName }));
});
```

- [ ] **Step 2: Routes tenant**

`backend/src/routes/invitation.routes.ts` :

```ts
import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
import { validate } from '../middlewares/validate';
import { createInvitationSchema } from '../validators/schemas';
import {
  listInvitationsController,
  createInvitationController,
  revokeInvitationController,
} from '../controllers/invitation.controller';

const router = Router();

router.use(authenticate, tenantContext);
router.get('/', requireRole('propriétaire', 'administrateur'), listInvitationsController);
router.post('/', requireRole('propriétaire', 'administrateur'), validate(createInvitationSchema), createInvitationController);
router.delete('/:id', requireRole('propriétaire', 'administrateur'), revokeInvitationController);

export default router;
```

- [ ] **Step 3: Routes publiques**

`backend/src/routes/public.routes.ts` :

```ts
import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { acceptInvitationSchema } from '../validators/schemas';
import {
  peekInvitationController,
  acceptInvitationController,
} from '../controllers/invitation.controller';

const router = Router();

// Pas d'auth, pas de tenant context — ces routes sont accessibles à tout le monde.
router.get('/invitations/:token', peekInvitationController);
router.post('/invitations/:token/accept', validate(acceptInvitationSchema), acceptInvitationController);

export default router;
```

- [ ] **Step 4: Brancher dans `routes/index.ts`**

`backend/src/routes/index.ts` — AVANT le bloc `router.use(authenticate, tenantContext)` et après `/auth` :

```ts
import publicRoutes from './public.routes';
router.use('/public', publicRoutes);
```

ET dans la zone des routes tenant authentifiées (juste après les autres `router.use(...)` tenant) :

```ts
import invitationRoutes from './invitation.routes';
router.use('/invitations', invitationRoutes);
```

- [ ] **Step 5: type-check + commit M3**

```bash
cd backend && npx tsc --noEmit
```
Expected: 0 erreur.

```bash
git add backend/src
git commit -m "feat(p2a): service + endpoints invitations (tenant + public)"
```

---

## MILESTONE 4 — Super-admin (activate avec reset, suspend, reject)

### Task 4.1 — Service admin

**Files:**
- Create: `backend/src/services/admin.service.ts`

- [ ] **Step 1: Implémenter**

```ts
import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';

export async function listRestaurants(filter?: { status?: string }) {
  return basePrisma.restaurant.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { dishes: true, tables: true, memberships: true, invitations: true } },
      memberships: {
        where: { role: 'propriétaire' },
        take: 1,
        include: { user: { select: { email: true, displayName: true } } },
      },
    },
  });
}

export async function activateRestaurant(id: number) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001', 'Restaurant introuvable');
  if (resto.status !== 'pending' && resto.status !== 'suspended' && resto.status !== 'rejected') {
    throw new AppError(400, 'ADMIN_001', 'Statut non éligible à l\'activation');
  }
  const counts = await basePrisma.$transaction(async (tx) => {
    const counts = {
      orders: await tx.order.count({ where: { restaurantId: id } }),
      stockMovements: await tx.stockMovement.count({ where: { restaurantId: id } }),
      cashSessions: await tx.cashSession.count({ where: { restaurantId: id } }),
      reservations: await tx.reservation.count({ where: { restaurantId: id } }),
      notifications: await tx.notification.count({ where: { restaurantId: id } }),
      auditLogs: await tx.auditLog.count({ where: { restaurantId: id } }),
    };
    await tx.notificationRead.deleteMany({ where: { notification: { restaurantId: id } } });
    await tx.notification.deleteMany({ where: { restaurantId: id } });
    await tx.stockMovement.deleteMany({ where: { restaurantId: id } });
    await tx.order.deleteMany({ where: { restaurantId: id } });           // cascade OrderItem
    await tx.cashSession.deleteMany({ where: { restaurantId: id } });
    await tx.reservation.deleteMany({ where: { restaurantId: id } });     // cascade ReservationItem
    await tx.auditLog.deleteMany({ where: { restaurantId: id } });
    await tx.$executeRaw`
      UPDATE stock_items
      SET quantity = COALESCE(baseline_quantity, quantity), baseline_quantity = NULL
      WHERE restaurant_id = ${id}
    `;
    await tx.restaurant.update({
      where: { id },
      data: { status: 'active', activatedAt: new Date(), rejectedAt: null, rejectedReason: null, suspendedAt: null, suspendedReason: null },
    });
    return counts;
  });
  return { status: 'active', deletedCounts: counts };
}

export async function suspendRestaurant(id: number, reason?: string) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001');
  if (resto.status !== 'active') throw new AppError(400, 'ADMIN_001', 'Seul un restaurant actif peut être suspendu');
  return basePrisma.restaurant.update({
    where: { id },
    data: { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason?.trim() || null },
  });
}

export async function reactivateRestaurant(id: number) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001');
  if (resto.status !== 'suspended' && resto.status !== 'rejected') {
    throw new AppError(400, 'ADMIN_001', 'Statut non éligible à la réactivation');
  }
  return basePrisma.restaurant.update({
    where: { id },
    data: { status: 'active', suspendedAt: null, suspendedReason: null, rejectedAt: null, rejectedReason: null },
  });
}

export async function rejectRestaurant(id: number, reason?: string) {
  const resto = await basePrisma.restaurant.findUnique({ where: { id } });
  if (!resto) throw new AppError(404, 'ADMIN_001');
  if (resto.status !== 'pending') throw new AppError(400, 'ADMIN_001', 'Seul un restaurant en attente peut être refusé');
  return basePrisma.restaurant.update({
    where: { id },
    data: { status: 'rejected', rejectedAt: new Date(), rejectedReason: reason?.trim() || null },
  });
}
```

### Task 4.2 — Codes d'erreur admin

**Files:**
- Modify: `backend/src/utils/errors.ts`

- [ ] **Step 1: Ajouter**

```ts
  ADMIN_001: 'Action super-admin invalide',
```

### Task 4.3 — Validateur admin

**Files:**
- Modify: `backend/src/validators/schemas.ts`

- [ ] **Step 1: Ajouter**

```ts
export const adminReasonSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const adminListQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'rejected']).optional(),
});
```

### Task 4.4 — Controller + route admin

**Files:**
- Create: `backend/src/controllers/admin.controller.ts`
- Create: `backend/src/routes/admin.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Controller**

```ts
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as adminService from '../services/admin.service';

export const listRestaurantsController = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  sendSuccess(res, await adminService.listRestaurants({ status }));
});

export const activateController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.activateRestaurant(Number(req.params.id)));
});

export const suspendController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.suspendRestaurant(Number(req.params.id), req.body?.reason));
});

export const reactivateController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.reactivateRestaurant(Number(req.params.id)));
});

export const rejectController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.rejectRestaurant(Number(req.params.id), req.body?.reason));
});
```

- [ ] **Step 2: Routes**

`backend/src/routes/admin.routes.ts` :

```ts
import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { adminReasonSchema, adminListQuerySchema } from '../validators/schemas';
import {
  listRestaurantsController,
  activateController,
  suspendController,
  reactivateController,
  rejectController,
} from '../controllers/admin.controller';

const router = Router();

// Pas de tenantContext — super-admin opere global via basePrisma.
router.use(authenticate, requireSuperAdmin);

router.get('/restaurants', validate(adminListQuerySchema, 'query'), listRestaurantsController);
router.post('/restaurants/:id/activate', activateController);
router.post('/restaurants/:id/suspend', validate(adminReasonSchema), suspendController);
router.post('/restaurants/:id/reactivate', reactivateController);
router.post('/restaurants/:id/reject', validate(adminReasonSchema), rejectController);

export default router;
```

- [ ] **Step 3: Brancher dans `routes/index.ts`**

AVANT la zone tenant (mais après `/auth` et `/public`) :

```ts
import adminRoutes from './admin.routes';
router.use('/admin', adminRoutes);
```

- [ ] **Step 4: type-check + commit M4**

```bash
cd backend && npx tsc --noEmit
```
Expected: 0 erreur.

```bash
git add backend/src
git commit -m "feat(p2a): super-admin endpoints + activation avec reset transactionnel"
```

---

## MILESTONE 5 — Frontend signup + routage par statut + LoginPage CTA

### Task 5.1 — Types front

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Ajouter**

```ts
export type RestaurantStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface CurrentRestaurant {
  id: number;
  name: string;
  slug: string;
  status: RestaurantStatus;
  rejectedReason?: string | null;
  suspendedReason?: string | null;
}

export interface Invitation {
  id: number;
  restaurantId: number;
  email: string;
  role: Role;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  url?: string;          // present a la creation
}

export interface AdminRestaurantRow {
  id: number;
  name: string;
  slug: string;
  status: RestaurantStatus;
  createdAt: string;
  activatedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  _count: { dishes: number; tables: number; memberships: number; invitations: number };
  memberships: { user: { email: string; displayName: string | null } }[];
}
```

Et étendre `AuthResponse` :

```ts
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  memberships: MembershipView[];
  currentRestaurant?: CurrentRestaurant | null;
}
```

### Task 5.2 — API client

**Files:**
- Modify: `frontend/src/services/endpoints.ts`

- [ ] **Step 1: Ajouter signupApi**

```ts
export const signupApi = {
  signup: (data: { email: string; password: string; displayName: string; restaurantName: string }) =>
    api.post('/auth/signup', data).then((r) => r.data.data as AuthResponse),
};
```

- [ ] **Step 2: Étendre `authApi.me`**

```ts
export const authApi = {
  // ... existing
  me: () =>
    api.get('/auth/me').then((r) => r.data.data as {
      user: User;
      memberships: MembershipView[];
      currentRestaurant: CurrentRestaurant | null;
    }),
  // ...
};
```

- [ ] **Step 3: Ajouter invitationApi (tenant + public)**

```ts
export const invitationApi = {
  list: () => api.get('/invitations').then((r) => r.data.data as Invitation[]),
  create: (email: string, role: Role) =>
    api.post('/invitations', { email, role }).then((r) => r.data.data as Invitation),
  revoke: (id: number) => api.delete(`/invitations/${id}`).then((r) => r.data.data),
};

export const publicInviteApi = {
  peek: (token: string) =>
    api.get(`/public/invitations/${token}`).then((r) => r.data.data as {
      restaurantName: string;
      role: Role;
      email: string;
      status: 'pending' | 'accepted' | 'revoked' | 'expired';
      expiresAt: string;
      emailExists: boolean;
    }),
  accept: (token: string, body: { password: string; displayName?: string }) =>
    api.post(`/public/invitations/${token}/accept`, body).then((r) => r.data.data as AuthResponse),
};
```

- [ ] **Step 4: Ajouter adminApi**

```ts
export const adminApi = {
  listRestaurants: (status?: RestaurantStatus) =>
    api.get('/admin/restaurants', { params: status ? { status } : {} })
       .then((r) => r.data.data as AdminRestaurantRow[]),
  activate: (id: number) =>
    api.post(`/admin/restaurants/${id}/activate`).then((r) => r.data.data as {
      status: 'active';
      deletedCounts: Record<string, number>;
    }),
  suspend: (id: number, reason?: string) =>
    api.post(`/admin/restaurants/${id}/suspend`, { reason }).then((r) => r.data.data),
  reactivate: (id: number) =>
    api.post(`/admin/restaurants/${id}/reactivate`).then((r) => r.data.data),
  reject: (id: number, reason?: string) =>
    api.post(`/admin/restaurants/${id}/reject`, { reason }).then((r) => r.data.data),
};
```

### Task 5.3 — AuthContext expose `currentRestaurant`

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: État `currentRestaurant`**

Ajouter dans le state du provider :

```ts
const [currentRestaurant, setCurrentRestaurant] = useState<CurrentRestaurant | null>(null);
```

Dans le `useEffect` de restauration de session, après `authApi.me()` :

```ts
setCurrentRestaurant(me.currentRestaurant ?? null);
```

Dans `login` (après l'auto-select branch), si `autoSelected`, faire un `authApi.me()` ou récupérer depuis la réponse signup le `currentRestaurant`. Plus simple : après `setActiveRestaurantId`, appeler `authApi.me()` pour synchroniser `currentRestaurant`. (Coût : 1 round-trip supplémentaire, acceptable.) Idem pour `selectRestaurant`.

Étendre l'interface du context et l'export :

```ts
interface AuthContextType {
  // ... existing
  currentRestaurant: CurrentRestaurant | null;
}
```

### Task 5.4 — Routage par statut dans ProtectedRoute

**Files:**
- Modify: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Réécrire la logique de garde**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  allowedRoles: Role[];
  allowDuringPending?: boolean;  // pour les pages opérationnelles (mode simulation)
}

export function ProtectedRoute({ children, allowedRoles, allowDuringPending }: Props) {
  const { isAuthenticated, hasActiveRestaurant, currentRole, currentRestaurant, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!hasActiveRestaurant) return <Navigate to="/select-restaurant" replace />;
  if (!currentRole) return <Navigate to="/select-restaurant" replace />;

  // Aiguillage par statut du restaurant courant.
  const status = currentRestaurant?.status;
  if (status === 'suspended') return <Navigate to="/suspended" replace />;
  if (status === 'rejected') return <Navigate to="/rejected" replace />;
  if (status === 'pending') {
    if (currentRole !== 'propriétaire') return <Navigate to="/pending-member" replace />;
    if (!allowDuringPending && !isGestionRoute(window.location.pathname)) {
      // Pour propriétaire en pending : les pages "Gestion" sont autorisées partout.
      // On laisse passer ; le bandeau simulation s'affichera côté Layout.
    }
  }

  if (!allowedRoles.includes(currentRole)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

function isGestionRoute(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/dashboard');
}
```

> Simplification : on autorise le propriétaire en pending sur TOUTES les routes (Gestion + Caisse/Cuisine/Salle/Service). Le bandeau « simulation » sur les pages opérationnelles informe que les données seront effacées. Pas de blocage côté ProtectedRoute pour pending+propriétaire ; le routage par status ci-dessus ne fait QUE suspendre/rejeter/déléguer non-proprios.

Reformulons plus simplement :

```tsx
export function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) {
  const { isAuthenticated, hasActiveRestaurant, currentRole, currentRestaurant, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!hasActiveRestaurant || !currentRole) return <Navigate to="/select-restaurant" replace />;

  const status = currentRestaurant?.status;
  if (status === 'suspended') return <Navigate to="/suspended" replace />;
  if (status === 'rejected') return <Navigate to="/rejected" replace />;
  if (status === 'pending' && currentRole !== 'propriétaire') return <Navigate to="/pending-member" replace />;

  if (!allowedRoles.includes(currentRole)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
```

### Task 5.5 — LoginPage CTA + SignupPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/SignupPage.tsx`

- [ ] **Step 1: CTA dans LoginPage**

Ajouter sous le bouton « Se connecter » (avant le bloc démo) :

```tsx
<div className="mt-4 text-center text-sm">
  <Link to="/signup" className="text-gold-400 hover:text-gold-300 font-medium">
    Créer un nouveau restaurant
  </Link>
</div>
```

(Importer `Link` depuis `react-router-dom` si pas déjà fait.)

- [ ] **Step 2: Créer `SignupPage.tsx`**

```tsx
import { useEffect, useRef, useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ChefHat, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signupApi } from '../services/endpoints';
import { getApiError } from '../services/api';

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (isAuthenticated) navigate('/', { replace: true }); }, [isAuthenticated, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !restaurantName) {
      setError('Tous les champs sont requis');
      return;
    }
    setError(''); setLoading(true);
    try {
      const res = await signupApi.signup({ email, password, displayName, restaurantName });
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      localStorage.setItem('activeRestaurantId', String(res.memberships[0].restaurantId));
      window.location.href = '/dashboard';   // hard refresh -> AuthContext recharge tout
    } catch (err) {
      setError(getApiError(err, 'Inscription impossible'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(50rem_40rem_at_50%_-10%,rgba(212,175,55,0.12),transparent)] p-4">
      <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-[450px] p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-4">
            <ChefHat className="w-9 h-9 text-gold-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-100">Créer un restaurant</h1>
          <p className="text-neutral-400 text-sm">Bienvenue sur la plateforme AwemA Restaurants</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Field icon={<Mail />} label="Email" type="email" id="email" ref={emailRef as any} value={email} onChange={setEmail} placeholder="vous@exemple.com" autoComplete="email" />
          <Field icon={<Lock />} label="Mot de passe" type="password" id="password" value={password} onChange={setPassword} placeholder="Au moins 6 caractères" autoComplete="new-password" />
          <Field icon={<User />} label="Votre nom" type="text" id="name" value={displayName} onChange={setDisplayName} placeholder="Alice Dupont" autoComplete="name" />
          <Field icon={<ChefHat />} label="Nom du restaurant" type="text" id="resto" value={restaurantName} onChange={setRestaurantName} placeholder="Chez Fatou" />

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition mt-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Créer mon restaurant
          </button>
        </form>

        <p className="mt-5 text-xs text-neutral-500 text-center">
          Votre restaurant entrera en mode <b>préparation</b>. Vous pourrez le configurer (menu, tables, équipe) avant que la plateforme l'active. Aucun frais.
        </p>

        <div className="mt-4 text-center text-sm">
          <Link to="/" className="text-neutral-400 hover:text-neutral-200">← Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ReactNode; label: string; type: string; id: string;
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}
const Field = ({ icon, label, type, id, value, onChange, placeholder, autoComplete }: FieldProps) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
        className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none" />
    </div>
  </div>
);
```

- [ ] **Step 3: Brancher dans App.tsx**

`frontend/src/App.tsx` — ajouter :

```tsx
const SignupPage = lazy(() => import('./pages/SignupPage'));
// ...
<Route path="/signup" element={<SignupPage />} />
```

- [ ] **Step 4: Vérifier**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 0 erreur, build OK.

- [ ] **Step 5: Commit M5**

```bash
git add frontend/src
git commit -m "feat(p2a): frontend signup + currentRestaurant + routage par statut"
```

---

## MILESTONE 6 — Écrans bloquants + bandeau simulation + contact AwemA

### Task 6.1 — Constantes contact

**Files:**
- Create: `frontend/src/utils/contact.ts`

- [ ] **Step 1: Implémenter**

```ts
export const AWEMA_CONTACT = {
  whatsappPhone: '+2250707145959',
  whatsappNumber: '2250707145959',          // sans +, pour wa.me
  email: 'webmarketingagence@gmail.com',
  whatsappUrl: (message: string) =>
    `https://wa.me/2250707145959?text=${encodeURIComponent(message)}`,
  mailtoUrl: (subject: string) =>
    `mailto:webmarketingagence@gmail.com?subject=${encodeURIComponent(subject)}`,
};
```

### Task 6.2 — Composant `StatusBlockedCard`

**Files:**
- Create: `frontend/src/components/StatusBlockedCard.tsx`

- [ ] **Step 1: Implémenter**

```tsx
import { ReactNode } from 'react';
import { MessageCircle, Mail, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AWEMA_CONTACT } from '../utils/contact';

interface Props {
  icon: ReactNode;
  iconBg: string;            // ex: 'bg-rose-500/10'
  iconColor: string;         // ex: 'text-rose-400'
  title: string;
  subtitle?: string;
  reason?: string | null;
  whatsappMessage: string;
  emailSubject: string;
}

export function StatusBlockedCard({ icon, iconBg, iconColor, title, subtitle, reason, whatsappMessage, emailSubject }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-8 text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 ${iconBg} rounded-full mb-4`}>
          <span className={`${iconColor} [&>svg]:w-8 [&>svg]:h-8`}>{icon}</span>
        </div>
        <h1 className="text-xl font-bold text-neutral-100 mb-2">{title}</h1>
        {subtitle && <p className="text-neutral-400 text-sm mb-3">{subtitle}</p>}
        {reason && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 mb-4 text-left">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Raison</div>
            {reason}
          </div>
        )}
        <p className="text-neutral-500 text-sm mb-5">Contactez AwemA pour toute question :</p>
        <div className="flex flex-col gap-2">
          <a href={AWEMA_CONTACT.whatsappUrl(whatsappMessage)} target="_blank" rel="noreferrer"
             className="flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-lg font-medium">
            <MessageCircle className="w-4 h-4" /> WhatsApp {AWEMA_CONTACT.whatsappPhone}
          </a>
          <a href={AWEMA_CONTACT.mailtoUrl(emailSubject)}
             className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 px-4 py-2.5 rounded-lg font-medium">
            <Mail className="w-4 h-4" /> {AWEMA_CONTACT.email}
          </a>
        </div>
        <button onClick={doLogout} className="mt-6 text-sm text-neutral-500 hover:text-rose-400 flex items-center gap-1 mx-auto">
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
```

### Task 6.3 — Pages bloquantes

**Files:**
- Create: `frontend/src/pages/SuspendedPage.tsx`
- Create: `frontend/src/pages/RejectedPage.tsx`
- Create: `frontend/src/pages/PendingMemberPage.tsx`

- [ ] **Step 1: SuspendedPage**

```tsx
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBlockedCard } from '../components/StatusBlockedCard';

export default function SuspendedPage() {
  const { currentRestaurant } = useAuth();
  const restoName = currentRestaurant?.name ?? 'votre restaurant';
  return (
    <StatusBlockedCard
      icon={<Lock />}
      iconBg="bg-rose-500/10"
      iconColor="text-rose-400"
      title="Restaurant suspendu"
      subtitle={`L'accès à ${restoName} est temporairement suspendu.`}
      reason={currentRestaurant?.suspendedReason ?? null}
      whatsappMessage={`Bonjour AwemA, mon restaurant "${restoName}" est suspendu, j'aimerais en discuter.`}
      emailSubject={`[Plateforme] Restaurant suspendu : ${restoName}`}
    />
  );
}
```

- [ ] **Step 2: RejectedPage**

```tsx
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBlockedCard } from '../components/StatusBlockedCard';

export default function RejectedPage() {
  const { currentRestaurant } = useAuth();
  const restoName = currentRestaurant?.name ?? 'votre restaurant';
  return (
    <StatusBlockedCard
      icon={<ShieldOff />}
      iconBg="bg-orange-500/10"
      iconColor="text-orange-400"
      title="Inscription refusée"
      subtitle={`L'inscription de ${restoName} n'a pas été approuvée.`}
      reason={currentRestaurant?.rejectedReason ?? null}
      whatsappMessage={`Bonjour AwemA, l'inscription de mon restaurant "${restoName}" a été refusée, pourrions-nous en discuter ?`}
      emailSubject={`[Plateforme] Inscription refusée : ${restoName}`}
    />
  );
}
```

- [ ] **Step 3: PendingMemberPage**

```tsx
import { Hourglass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBlockedCard } from '../components/StatusBlockedCard';

export default function PendingMemberPage() {
  const { currentRestaurant } = useAuth();
  const restoName = currentRestaurant?.name ?? 'votre restaurant';
  return (
    <StatusBlockedCard
      icon={<Hourglass />}
      iconBg="bg-amber-500/10"
      iconColor="text-amber-400"
      title="Restaurant en préparation"
      subtitle={`${restoName} n'est pas encore activé. Contactez le propriétaire ou patientez.`}
      whatsappMessage={`Bonjour AwemA, je suis membre de "${restoName}" qui n'est pas encore activé.`}
      emailSubject={`[Plateforme] Restaurant en préparation : ${restoName}`}
    />
  );
}
```

### Task 6.4 — Bandeau simulation

**Files:**
- Create: `frontend/src/components/SimulationBanner.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Composant**

```tsx
import { FlaskConical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function SimulationBanner() {
  const { currentRestaurant, currentRole } = useAuth();
  if (currentRestaurant?.status !== 'pending') return null;
  if (currentRole !== 'propriétaire') return null;
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 flex items-center gap-2 text-sm">
      <FlaskConical className="w-4 h-4 flex-shrink-0" />
      <span><b>Mode préparation</b> — les commandes test, sessions de caisse et mouvements de stock seront effacés à l'activation. Les stocks seront restaurés à leurs valeurs préparées.</span>
    </div>
  );
}
```

- [ ] **Step 2: Insérer dans `Layout.tsx`**

```tsx
import { SimulationBanner } from './SimulationBanner';
// ...
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <SimulationBanner />
      <main>{children}</main>
    </div>
  );
}
```

### Task 6.5 — Routes dans App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Ajouter**

```tsx
const SuspendedPage = lazy(() => import('./pages/SuspendedPage'));
const RejectedPage = lazy(() => import('./pages/RejectedPage'));
const PendingMemberPage = lazy(() => import('./pages/PendingMemberPage'));
// ...
<Route path="/suspended" element={<SuspendedPage />} />
<Route path="/rejected" element={<RejectedPage />} />
<Route path="/pending-member" element={<PendingMemberPage />} />
```

- [ ] **Step 2: type-check + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 0 erreur, build OK.

- [ ] **Step 3: Commit M6**

```bash
git add frontend/src
git commit -m "feat(p2a): ecrans suspended/rejected/pending-member + bandeau simulation + contact AwemA"
```

---

## MILESTONE 7 — Frontend invitations (acceptation + management)

### Task 7.1 — Page d'acceptation invitation

**Files:**
- Create: `frontend/src/pages/InviteAcceptPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Page**

```tsx
import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ChefHat, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { publicInviteApi } from '../services/endpoints';
import { getApiError } from '../services/api';
import { homeForRole } from '../services/auth-helpers';

type PeekResult = Awaited<ReturnType<typeof publicInviteApi.peek>>;

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [peek, setPeek] = useState<PeekResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    publicInviteApi.peek(token)
      .then(setPeek)
      .catch((e) => setError(getApiError(e, 'Invitation introuvable')))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !peek) return;
    if (password.length < 6) { setError('Mot de passe trop court (6 minimum)'); return; }
    if (!peek.emailExists && !displayName.trim()) { setError('Votre nom est requis'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await publicInviteApi.accept(token, { password, displayName: displayName.trim() || undefined });
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      localStorage.setItem('activeRestaurantId', String(res.memberships.find((m) => m.role === peek.role)?.restaurantId ?? res.memberships[0].restaurantId));
      window.location.href = homeForRole(peek.role);
    } catch (err) {
      setError(getApiError(err, 'Impossible d\'accepter cette invitation'));
      setSubmitting(false);
    }
  };

  if (loading) return <Screen><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></Screen>;
  if (error && !peek) return <Screen><Card><Alert>{error}</Alert><Link to="/" className="text-gold-400 mt-3 inline-block">Aller à la connexion</Link></Card></Screen>;
  if (!peek) return null;

  if (peek.status !== 'pending') {
    const labels: Record<string, string> = {
      expired: 'Lien expiré', revoked: 'Invitation révoquée', accepted: 'Invitation déjà utilisée',
    };
    return <Screen><Card>
      <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
      <h1 className="text-xl font-bold text-neutral-100 mb-2">{labels[peek.status] ?? 'Invitation invalide'}</h1>
      <p className="text-neutral-400 text-sm">Demandez un nouveau lien au propriétaire de <b>{peek.restaurantName}</b>.</p>
      <Link to="/" className="text-gold-400 mt-4 inline-block">Aller à la connexion</Link>
    </Card></Screen>;
  }

  return <Screen>
    <Card>
      <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-3">
        <ChefHat className="w-7 h-7 text-gold-400" />
      </div>
      <h1 className="text-xl font-bold text-neutral-100">Rejoindre {peek.restaurantName}</h1>
      <p className="text-neutral-400 text-sm">Vous êtes invité·e en tant que <b className="text-neutral-200">{peek.role}</b>.</p>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <Field icon={<Mail />} label="Email" type="email" id="email" value={peek.email} onChange={() => {}} readOnly />
        {peek.emailExists ? (
          <p className="text-xs text-neutral-500">Vous avez déjà un compte. Saisissez votre mot de passe pour accepter.</p>
        ) : (
          <Field icon={<User />} label="Votre nom" type="text" id="name" value={displayName} onChange={setDisplayName} placeholder="Alice Dupont" />
        )}
        <Field icon={<Lock />} label="Mot de passe" type="password" id="pwd" value={password} onChange={setPassword} placeholder={peek.emailExists ? '••••••••' : 'Au moins 6 caractères'} autoComplete={peek.emailExists ? 'current-password' : 'new-password'} />
        <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg mt-3">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Accepter et rejoindre
        </button>
      </form>
    </Card>
  </Screen>;
}

const Screen = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-black p-4">{children}</div>
);
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-8 text-center">{children}</div>
);
const Alert = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-3 text-sm">
    <AlertCircle className="w-5 h-5 flex-shrink-0" /><span>{children}</span>
  </div>
);
interface FieldP { icon: React.ReactNode; label: string; type: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean; autoComplete?: string; }
const Field = ({ icon, label, type, id, value, onChange, placeholder, readOnly, autoComplete }: FieldP) => (
  <div className="text-left">
    <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly} autoComplete={autoComplete}
        className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none disabled:opacity-60" />
    </div>
  </div>
);
```

- [ ] **Step 2: Route**

`App.tsx` — ajouter :

```tsx
const InviteAcceptPage = lazy(() => import('./pages/InviteAcceptPage'));
// ...
<Route path="/invite/:token" element={<InviteAcceptPage />} />
```

### Task 7.2 — Gestion des invitations dans l'onglet Membres

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Étendre l'onglet Membres**

Dans le rendu de l'onglet `users` de `AdminPage`, ajouter une section sous la table des membres :

```tsx
{tab === 'users' && (
  <>
    {/* ... table des membres existante ... */}
    <PendingInvitations />
  </>
)}
```

Puis créer le sous-composant `PendingInvitations` dans le même fichier (ou un nouveau composant si plus propre) :

```tsx
function PendingInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'serveur' as Role });
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ url: string; email: string } | null>(null);

  const load = () => invitationApi.list().then((all) => setInvitations(all.filter((i) => i.status === 'pending')))
    .catch((e) => setError(getApiError(e)));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.email.trim()) { setError('Email requis'); return; }
    setBusy(true);
    try {
      const inv = await invitationApi.create(form.email.trim(), form.role);
      setCreatedLink({ url: inv.url!, email: form.email });
      setForm({ email: '', role: 'serveur' });
      load();
    } catch (e) { setError(getApiError(e)); } finally { setBusy(false); setModal(false); }
  };

  const revoke = async (id: number) => {
    if (!window.confirm('Révoquer cette invitation ?')) return;
    await invitationApi.revoke(id);
    load();
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };

  const wa = (url: string, email: string) =>
    `https://wa.me/?text=${encodeURIComponent(`Bonjour, je vous invite à rejoindre mon restaurant sur la plateforme : ${url}`)}`;

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-neutral-100">Invitations en attente ({invitations.length})</h3>
        <button onClick={() => setModal(true)} className="bg-gold-400 hover:bg-gold-300 text-black font-bold px-3 py-1.5 rounded-lg text-sm">
          + Inviter un membre
        </button>
      </div>
      {error && <div className="text-rose-400 text-sm mb-2">{error}</div>}
      {invitations.length === 0 ? (
        <p className="text-neutral-500 text-sm">Aucune invitation en attente.</p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {invitations.map((inv) => (
            <li key={inv.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 truncate text-neutral-200">{inv.email}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">{inv.role}</span>
              <span className="text-xs text-neutral-500">Expire le {new Date(inv.expiresAt).toLocaleDateString('fr-FR')}</span>
              <button onClick={() => copy(`${window.location.origin}/invite/${inv.token}`)} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200">📋 Copier</button>
              <a href={wa(`${window.location.origin}/invite/${inv.token}`, inv.email)} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">WhatsApp</a>
              <button onClick={() => revoke(inv.id)} className="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">Révoquer</button>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => !busy && setModal(false)}>
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-100 mb-3">Inviter un membre</h3>
            <label className="block text-sm text-neutral-300 mb-1">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="alice@exemple.com"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 mb-3" />
            <label className="block text-sm text-neutral-300 mb-1">Rôle</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 mb-4">
              <option value="serveur">Serveur</option>
              <option value="cuisinier">Cuisinier</option>
              <option value="caissier">Caissier</option>
              <option value="administrateur">Administrateur</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(false)} disabled={busy} className="px-3 py-2 rounded-lg text-neutral-300">Annuler</button>
              <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-gold-400 text-black font-bold">{busy ? '…' : 'Créer le lien'}</button>
            </div>
          </div>
        </div>
      )}

      {createdLink && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setCreatedLink(null)}>
          <div className="bg-neutral-950 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-emerald-300 mb-2">Lien créé pour {createdLink.email}</h3>
            <p className="text-neutral-400 text-sm mb-3">Partagez ce lien (valide 7 jours) :</p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 break-all mb-3">{createdLink.url}</div>
            <div className="flex gap-2">
              <button onClick={() => copy(createdLink.url)} className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded-lg text-sm">📋 Copier</button>
              <a href={wa(createdLink.url, createdLink.email)} target="_blank" rel="noreferrer" className="flex-1 text-center bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg text-sm">WhatsApp</a>
            </div>
            <button onClick={() => setCreatedLink(null)} className="w-full mt-3 px-3 py-2 rounded-lg text-neutral-400">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: type-check + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: 0 erreur, build OK.

- [ ] **Step 3: Commit M7**

```bash
git add frontend/src
git commit -m "feat(p2a): page acceptation invitation + management dans onglet Membres"
```

---

## MILESTONE 8 — Frontend console super-admin

### Task 8.1 — Page `/admin`

**Files:**
- Create: `frontend/src/pages/SuperAdminPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navigation.tsx`

- [ ] **Step 1: Page**

```tsx
import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, Pause, Play, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { adminApi } from '../services/endpoints';
import { AdminRestaurantRow, RestaurantStatus } from '../types';
import { getApiError } from '../services/api';

const STATUS_LABEL: Record<RestaurantStatus, string> = {
  pending: 'En attente', active: 'Actif', suspended: 'Suspendu', rejected: 'Refusé',
};
const STATUS_BADGE: Record<RestaurantStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300', active: 'bg-emerald-500/15 text-emerald-300',
  suspended: 'bg-rose-500/15 text-rose-300', rejected: 'bg-orange-500/15 text-orange-300',
};

export default function SuperAdminPage() {
  const [rows, setRows] = useState<AdminRestaurantRow[]>([]);
  const [filter, setFilter] = useState<RestaurantStatus | 'all'>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; type: 'activate' | 'suspend' | 'reactivate' | 'reject'; restoName: string; counts?: AdminRestaurantRow['_count']; reason?: string } | null>(null);

  const load = () => adminApi.listRestaurants(filter === 'all' ? undefined : filter)
    .then(setRows).catch((e) => setError(getApiError(e)));
  useEffect(() => { load(); }, [filter]);

  const runAction = async () => {
    if (!confirmAction) return;
    const { id, type, reason } = confirmAction;
    setBusyId(id);
    try {
      if (type === 'activate') {
        const res = await adminApi.activate(id);
        alert(`✅ Restaurant activé. Données simulation supprimées :\n` +
          Object.entries(res.deletedCounts).map(([k, v]) => `  • ${k} : ${v}`).join('\n') +
          `\nStocks restaurés aux valeurs préparées.`);
      } else if (type === 'suspend') await adminApi.suspend(id, reason);
      else if (type === 'reactivate') await adminApi.reactivate(id);
      else if (type === 'reject') await adminApi.reject(id, reason);
      setConfirmAction(null);
      load();
    } catch (e) { setError(getApiError(e)); } finally { setBusyId(null); }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-neutral-200 max-w-7xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-8 h-8 text-gold-400" />
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Console super-admin</h1>
          <p className="text-xs text-neutral-400">Restaurants de la plateforme</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all','pending','active','suspended','rejected'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === s ? 'bg-gold-400 text-black' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}`}>
            {s === 'all' ? 'Tous' : STATUS_LABEL[s as RestaurantStatus]}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-3 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-400 border-b border-neutral-800">
            <tr>
              <th className="text-left p-3">Restaurant</th>
              <th className="text-left p-3">Propriétaire</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Contenu</th>
              <th className="text-left p-3">Créé</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const owner = r.memberships[0]?.user;
              return (
                <tr key={r.id} className="border-b border-neutral-900">
                  <td className="p-3"><div className="font-medium text-neutral-100">{r.name}</div><div className="text-xs text-neutral-500">{r.slug}</div></td>
                  <td className="p-3 text-neutral-300">{owner?.displayName ?? owner?.email ?? '—'}<div className="text-xs text-neutral-500">{owner?.email}</div></td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>{r.rejectedReason && <div className="text-xs text-neutral-500 mt-1">{r.rejectedReason}</div>}{r.suspendedReason && <div className="text-xs text-neutral-500 mt-1">{r.suspendedReason}</div>}</td>
                  <td className="p-3 text-xs text-neutral-400">{r._count.dishes} plats · {r._count.tables} tables · {r._count.memberships} membres</td>
                  <td className="p-3 text-xs text-neutral-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="p-3 text-right">
                    {r.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'activate', restoName: r.name, counts: r._count })} className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25">{busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3 inline" /> Activer</>}</button>
                        <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'reject', restoName: r.name })} className="text-xs px-2 py-1 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25"><XCircle className="w-3 h-3 inline" /> Refuser</button>
                      </div>
                    )}
                    {r.status === 'active' && (
                      <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'suspend', restoName: r.name })} className="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"><Pause className="w-3 h-3 inline" /> Suspendre</button>
                    )}
                    {(r.status === 'suspended' || r.status === 'rejected') && (
                      <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'reactivate', restoName: r.name })} className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"><Play className="w-3 h-3 inline" /> Réactiver</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-neutral-500 p-6">Aucun restaurant dans ce filtre</td></tr>}
          </tbody>
        </table>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setConfirmAction(null)}>
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-100 mb-2">
              {confirmAction.type === 'activate' && `Activer ${confirmAction.restoName} ?`}
              {confirmAction.type === 'suspend' && `Suspendre ${confirmAction.restoName} ?`}
              {confirmAction.type === 'reactivate' && `Réactiver ${confirmAction.restoName} ?`}
              {confirmAction.type === 'reject' && `Refuser ${confirmAction.restoName} ?`}
            </h3>
            {confirmAction.type === 'activate' && (
              <p className="text-sm text-neutral-400 mb-3">
                <b className="text-amber-300">Attention :</b> toutes les données de simulation seront supprimées (commandes test, sessions de caisse, mouvements de stock, notifications, audit). Les stocks seront restaurés aux valeurs préparées par le propriétaire. <b>Cette action est irréversible.</b>
              </p>
            )}
            {(confirmAction.type === 'suspend' || confirmAction.type === 'reject') && (
              <>
                <label className="block text-sm text-neutral-300 mb-1">Raison (optionnelle, visible par le propriétaire)</label>
                <textarea value={confirmAction.reason ?? ''} onChange={(e) => setConfirmAction({ ...confirmAction, reason: e.target.value })} rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 mb-3 text-sm" />
              </>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-3 py-2 rounded-lg text-neutral-300">Annuler</button>
              <button onClick={runAction} disabled={busyId !== null} className="px-4 py-2 rounded-lg bg-gold-400 text-black font-bold">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Route**

`App.tsx` :

```tsx
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
// ...
<Route path="/super-admin" element={
  <ProtectedRoute allowedRoles={[]}>{/* on filtre par isSuperAdmin ci-dessous */}<SuperAdminPage /></ProtectedRoute>
} />
```

Mais l'`ProtectedRoute` actuel filtre par `currentRole`, pas par `isSuperAdmin`. Solution simple : créer un `SuperAdminRoute` qui check `currentUser.isSuperAdmin` :

```tsx
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div>Chargement...</div>;
  if (!currentUser?.isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
// ...
<Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />
```

- [ ] **Step 3: Lien dans la Navigation**

`Navigation.tsx` — afficher un lien « Super-admin » uniquement si `currentUser?.isSuperAdmin` :

```tsx
{currentUser?.isSuperAdmin && (
  <NavLink to="/super-admin" className={linkClass}>
    <Shield className="w-5 h-5" /> Super-admin
  </NavLink>
)}
```

(Importer `Shield` depuis lucide-react.)

- [ ] **Step 4: type-check + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: 0 erreur, build OK.

- [ ] **Step 5: Commit M8**

```bash
git add frontend/src
git commit -m "feat(p2a): console super-admin (liste + actions activate/suspend/reactivate/reject)"
```

---

## MILESTONE 9 — Tests d'intégration

### Task 9.1 — Tests onboarding (signup + activation)

**Files:**
- Create: `backend/src/__tests__/integration/onboarding.test.ts`

- [ ] **Step 1: Implémenter**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant, runUnscoped } from '../../config/tenant-context';
import { resetAndSeedTwoRestaurants } from './helpers';
import * as adminService from '../../services/admin.service';

const app = createApp();

beforeAll(async () => { await resetAndSeedTwoRestaurants(); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Signup', () => {
  it('cree un User + Restaurant pending + Membership proprietaire', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test-signup@test.local', password: 'pass1234', displayName: 'Test', restaurantName: 'Chez Test',
    });
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.user.email).toBe('test-signup@test.local');
    expect(data.memberships).toHaveLength(1);
    expect(data.memberships[0].role).toBe('propriétaire');
    const resto = await basePrisma.restaurant.findFirst({ where: { name: 'Chez Test' } });
    expect(resto?.status).toBe('pending');
    expect(resto?.slug).toBe('chez-test');
  });

  it('refuse un email deja utilise', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'dup@test.local', password: 'pass1234', displayName: 'A', restaurantName: 'R1' });
    const res = await request(app).post('/api/auth/signup').send({ email: 'dup@test.local', password: 'pass1234', displayName: 'B', restaurantName: 'R2' });
    expect(res.status).toBe(409);
  });

  it('genere un slug unique en cas de collision', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'a@s.local', password: 'pass1234', displayName: 'A', restaurantName: 'Le Lion' });
    await request(app).post('/api/auth/signup').send({ email: 'b@s.local', password: 'pass1234', displayName: 'B', restaurantName: 'Le Lion' });
    const lions = await basePrisma.restaurant.findMany({ where: { name: 'Le Lion' }, orderBy: { id: 'asc' } });
    expect(lions[0].slug).toBe('le-lion');
    expect(lions[1].slug).toBe('le-lion-2');
  });
});

describe('Activation avec reset', () => {
  it('supprime les donnees simulation + restaure stock baseline + status active', async () => {
    // Resto pending avec stock baseline 50, qui a "consomme" 5kg via simulation.
    const { user, resto } = await createPendingRestoWithData();
    await runWithTenant(resto.id, async () => {
      const stock = await basePrisma.stockItem.findFirst({ where: { restaurantId: resto.id } });
      expect(stock?.baselineQuantity).toBe(50);
      expect(stock?.quantity).toBe(45);   // 50 - 5 consommé en simulation
    });
    // Activation.
    const res = await runUnscoped(() => adminService.activateRestaurant(resto.id));
    expect(res.status).toBe('active');
    expect(res.deletedCounts.orders).toBeGreaterThan(0);
    // Verifications post-activation.
    const restoAfter = await basePrisma.restaurant.findUnique({ where: { id: resto.id } });
    expect(restoAfter?.status).toBe('active');
    expect(restoAfter?.activatedAt).toBeTruthy();
    const stockAfter = await basePrisma.stockItem.findFirst({ where: { restaurantId: resto.id } });
    expect(stockAfter?.quantity).toBe(50);            // restaure
    expect(stockAfter?.baselineQuantity).toBeNull();  // nettoye
    const orders = await basePrisma.order.count({ where: { restaurantId: resto.id } });
    expect(orders).toBe(0);
  });
});

async function createPendingRestoWithData() {
  // Cree user + resto pending + 1 stock 50kg + 1 plat + 2 commandes simulation consommant 5kg total
  const user = await basePrisma.user.create({
    data: { email: 'pending-test@s.local', passwordHash: 'x', displayName: 'P', isSuperAdmin: false },
  });
  const resto = await basePrisma.restaurant.create({
    data: { name: 'Pending Test', slug: 'pending-test-' + Date.now(), status: 'pending' },
  });
  await basePrisma.membership.create({ data: { userId: user.id, restaurantId: resto.id, role: 'propriétaire' } });
  const stock = await basePrisma.stockItem.create({
    data: { name: 'Riz', quantity: 45, baselineQuantity: 50, unit: 'kg', restaurantId: resto.id },
  });
  const dish = await basePrisma.dish.create({
    data: { name: 'Riz Sauce', price: 1000, restaurantId: resto.id },
  });
  // 2 commandes de simulation, chacune décrémente 2.5kg
  for (let i = 0; i < 2; i++) {
    await basePrisma.order.create({
      data: {
        orderNumber: `${new Date().toISOString().slice(0,10).replace(/-/g,'')}-00${i+1}`,
        total: 1000, discountAmount: 0, discountPercent: 0, finalTotal: 1000,
        status: 'commandée', isPaid: false, restaurantId: resto.id,
        items: { create: [{ dishId: dish.id, dishName: 'Riz Sauce', dishPrice: 1000, quantity: 1, subtotal: 1000 }] },
      },
    });
    await basePrisma.stockMovement.create({
      data: { stockItemId: stock.id, restaurantId: resto.id, movementType: 'commande', quantity: -2.5, previousQuantity: 0, newQuantity: 0 },
    });
  }
  return { user, resto };
}
```

### Task 9.2 — Tests invitations

**Files:**
- Create: `backend/src/__tests__/integration/invitations.test.ts`

- [ ] **Step 1: Implémenter**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();
let A: SeededRestaurant;
let ownerToken: string;

beforeAll(async () => {
  ({ A } = await resetAndSeedTwoRestaurants());
  // Login le proprietaire pour avoir un token scope sur resto A
  const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerToken = login.body.data.accessToken;
});
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Invitations lifecycle', () => {
  it('cree une invitation + URL', async () => {
    const res = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'newbie@test.local', role: 'serveur' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toHaveLength(64);
    expect(res.body.data.url).toContain('/invite/');
  });

  it('refuse une 2e invitation pendante pour le meme email', async () => {
    const res = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'newbie@test.local', role: 'cuisinier' });
    expect(res.status).toBe(409);
  });

  it('peek public renvoie infos sans secrets', async () => {
    const list = await request(app).get('/api/invitations').set('Authorization', `Bearer ${ownerToken}`);
    const token = list.body.data[0].token;
    const res = await request(app).get(`/api/public/invitations/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurantName).toBe('Resto A');
    expect(res.body.data.emailExists).toBe(false);
  });

  it('accept (nouveau user) cree User + Membership', async () => {
    const list = await request(app).get('/api/invitations').set('Authorization', `Bearer ${ownerToken}`);
    const token = list.body.data[0].token;
    const res = await request(app).post(`/api/public/invitations/${token}/accept`)
      .send({ password: 'newpass1', displayName: 'Newbie' });
    expect(res.status).toBe(200);
    expect(res.body.data.memberships.some((m: any) => m.restaurantId === A.id)).toBe(true);
    const inv = await basePrisma.invitation.findUnique({ where: { token } });
    expect(inv?.status).toBe('accepted');
  });

  it('accept (email existant) demande login-first', async () => {
    // Cree un user pre-existant
    await basePrisma.user.create({ data: { email: 'existing@test.local', passwordHash: await bcrypt.hash('mypwd123', 10), displayName: 'Ex', isSuperAdmin: false } });
    const inv = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'existing@test.local', role: 'caissier' });
    const token = inv.body.data.token;
    const peek = await request(app).get(`/api/public/invitations/${token}`);
    expect(peek.body.data.emailExists).toBe(true);
    // Mauvais password -> 401
    const wrong = await request(app).post(`/api/public/invitations/${token}/accept`).send({ password: 'wrong' });
    expect(wrong.status).toBe(401);
    // Bon password -> 200
    const ok = await request(app).post(`/api/public/invitations/${token}/accept`).send({ password: 'mypwd123' });
    expect(ok.status).toBe(200);
  });

  it('revoke marque status revoked', async () => {
    const create = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'tobe-revoked@test.local', role: 'serveur' });
    const id = create.body.data.id;
    await request(app).delete(`/api/invitations/${id}`).set('Authorization', `Bearer ${ownerToken}`);
    const inv = await basePrisma.invitation.findUnique({ where: { id } });
    expect(inv?.status).toBe('revoked');
  });

  it('accept sur lien revoke renvoie 410', async () => {
    const create = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'revoke-then@test.local', role: 'serveur' });
    const { token, id } = create.body.data;
    await request(app).delete(`/api/invitations/${id}`).set('Authorization', `Bearer ${ownerToken}`);
    const res = await request(app).post(`/api/public/invitations/${token}/accept`).send({ password: 'pwd123' });
    expect(res.status).toBe(410);
  });

  it('refuse role proprietaire', async () => {
    const res = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'evil@test.local', role: 'propriétaire' });
    expect(res.status).toBe(400);
  });
});
```

### Task 9.3 — Tests admin

**Files:**
- Create: `backend/src/__tests__/integration/admin.test.ts`

- [ ] **Step 1: Implémenter**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { signAccessToken } from '../../utils/jwt';
import { resetAndSeedTwoRestaurants } from './helpers';

const app = createApp();
let superAdminToken: string;
let ownerToken: string;

beforeAll(async () => {
  await resetAndSeedTwoRestaurants();
  const sa = await basePrisma.user.create({
    data: { email: 'sa@test.local', passwordHash: await bcrypt.hash('sa', 10), displayName: 'SA', isSuperAdmin: true },
  });
  superAdminToken = signAccessToken({ userId: sa.id, isSuperAdmin: true });
  const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerToken = login.body.data.accessToken;
});
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Super-admin', () => {
  it('proprio refuse acces a /api/admin/*', async () => {
    const res = await request(app).get('/api/admin/restaurants').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('super-admin liste tous les restaurants', async () => {
    const res = await request(app).get('/api/admin/restaurants').set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('reject impose une raison sur un pending', async () => {
    const r = await basePrisma.restaurant.create({ data: { name: 'Spam Resto', slug: 'spam-r', status: 'pending' } });
    const res = await request(app).post(`/api/admin/restaurants/${r.id}/reject`).set('Authorization', `Bearer ${superAdminToken}`).send({ reason: 'Faux nom' });
    expect(res.status).toBe(200);
    const after = await basePrisma.restaurant.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('rejected');
    expect(after?.rejectedReason).toBe('Faux nom');
  });

  it('suspend uniquement un actif', async () => {
    const r = await basePrisma.restaurant.create({ data: { name: 'X', slug: 'x-' + Date.now(), status: 'pending' } });
    const res = await request(app).post(`/api/admin/restaurants/${r.id}/suspend`).set('Authorization', `Bearer ${superAdminToken}`).send({ reason: 'test' });
    expect(res.status).toBe(400);
  });

  it('reactivate fait passer suspended -> active', async () => {
    const r = await basePrisma.restaurant.create({ data: { name: 'Y', slug: 'y-' + Date.now(), status: 'suspended', suspendedAt: new Date() } });
    const res = await request(app).post(`/api/admin/restaurants/${r.id}/reactivate`).set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    const after = await basePrisma.restaurant.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('active');
    expect(after?.suspendedAt).toBeNull();
  });
});
```

### Task 9.4 — Vérification + commit M9

- [ ] **Step 1: Lancer toutes les suites**

```bash
cd backend && npx tsc --noEmit && npm test && npm run test:integration
```
Expected :
- `tsc` clean,
- unit ≥ 46 (42 actuels + 4 slugify),
- intégration ≥ 25 (15 actuels + 3 onboarding + 7 invitations + 4 admin).

- [ ] **Step 2: Frontend**

```bash
cd frontend && npx tsc --noEmit && npm test && npm run build
```
Expected : tsc clean, 20 tests, build OK.

- [ ] **Step 3: Commit M9**

```bash
git add backend/src/__tests__/integration
git commit -m "test(p2a): integration onboarding + invitations + admin"
```

---

## Auto-revue (couverture du spec)

| Exigence spec | Couverte par |
|---|---|
| Inscription publique → User + Restaurant pending + Membership propriétaire | Task 2.3, 2.4, 9.1 |
| Slug auto + collision suffix | Task 2.1 + 2.3 + 9.1 |
| Rate limit 3/h IP | Task 2.2 + 2.4 |
| Restaurant lifecycle (pending/active/suspended/rejected) + champs | Task 1.1, 1.2, 4.1 |
| Activation avec reset transactionnel + restauration baseline | Task 4.1, 9.1 |
| StockItem.baselineQuantity capturé sur édition manuelle | Task 1.1, 1.3 |
| Suspend / reactivate / reject avec raison | Task 4.1, 4.4, 9.3 |
| `Invitation` entité + service + endpoints | Task 1.1, 3.1, 3.2, 3.3, 3.4, 9.2 |
| Expiration 7 jours + lazy expire | Task 3.1, 9.2 |
| Rôle propriétaire non invitable | Task 3.1, 9.2 |
| Acceptation login-first email existant | Task 3.1, 9.2 |
| Lien WhatsApp pré-rempli côté front | Task 6.1, 7.2 |
| Bandeau simulation côté front | Task 6.4 |
| Écrans suspended/rejected/pending-member | Task 6.3 |
| ProtectedRoute aiguillage par statut | Task 5.4 |
| Console super-admin avec récap activation | Task 8.1 |
| Contact AwemA constants | Task 6.1 |

## Risques d'exécution & points de vigilance

- **Migration manuelle** : si le timestamp `20260527120000` colle avec une autre migration, ajuster. La méthode psql + `migrate resolve` est éprouvée (idem P1/P2 enhancements).
- **`requireSuperAdmin` middleware** : existe-t-il déjà ? Vérifier dans `middlewares/auth.ts` (créé en P1). Sinon, l'ajouter : `if (!req.user?.isSuperAdmin) return sendError(res, 403, 'AUTH_005');`.
- **`appBaseUrl`** : utilisé pour fabriquer les URLs d'invitation. Sur Railway, doit pointer vers le frontend Vercel. À vérifier post-deploy.
- **WhatsApp `wa.me` côté browser** : ouvre WA Web ou app mobile. Sur desktop sans WA installé, le navigateur affiche une page d'erreur — le bouton email est le fallback prévu.
- **Test `accept` sur invitation email existant** : nécessite un User pré-créé avec `bcrypt`. Bien hasher avec `bcrypt.hash(password, 10)` dans le test (sinon login échoue).
- **Le reset d'activation est irréversible** : modale de confirmation côté super-admin obligatoire (déjà dans Task 8.1).
- **`pending` côté propriétaire = accès complet en simulation** : laisser `ProtectedRoute` autoriser propriétaire en pending sur toutes routes (cf. Task 5.4 simplification). Le bandeau informe.
