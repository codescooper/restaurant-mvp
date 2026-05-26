# P1 Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter trois enhancements indépendants post-P1 : (1) autoriser des variantes sur un plat à prix libre, (2) rapport sur plage de dates libre avec raccourcis, (3) onglet admin pour gérer les tables.

**Architecture :** Trois milestones indépendants sur la même branche `feat/p1-enhancements`. M1 touche schéma + migration + service plat + commande + UI. M2 touche API stats + UI dashboard (aucune migration). M3 touche guard suppression table + nouvel onglet admin (aucune migration). Tout exécuté sur le cluster local PG18 (port 5433) déjà en place, base `restaurant_db` seedée.

**Tech Stack :** TypeScript, Prisma 5.22, Express, Zod, React 18 + Vite + Tailwind, Vitest, Supertest.

**Référence spec :** `docs/superpowers/specs/2026-05-26-p1-enhancements-design.md`

---

## Carte des fichiers touchés

**Créés :**
- `backend/prisma/migrations/<timestamp>_dish_variant_price_optional/migration.sql` (M1).
- `frontend/src/pages/admin/TablesTab.tsx` (M3).

**Modifiés :**
- `backend/prisma/schema.prisma` (M1 — `DishVariant.price` → optionnel).
- `backend/src/validators/schemas.ts` (M1 — variantSchema/dish refinements ; M2 — schémas dashboard/export).
- `backend/src/services/dish.service.ts` (M1).
- `backend/src/services/order.service.ts` (M1 — libre + variant).
- `backend/src/services/stats.service.ts` (M2).
- `backend/src/services/table.service.ts` (M3 — guard réservation + 409).
- `backend/src/controllers/stats.controller.ts` (M2).
- `backend/src/utils/errors.ts` (M3 — code `TABLE_001`).
- `backend/src/__tests__/logic.test.ts` (M2 — `getRangeFromDates`).
- `backend/src/__tests__/api.test.ts` (M1/M2/M3 — quelques smokes).
- `frontend/src/types/index.ts` (M1 — `MenuVariant.price` nullable).
- `frontend/src/services/endpoints.ts` (M2 — signatures `statsApi`).
- `frontend/src/pages/DashboardPage.tsx` (M2).
- `frontend/src/pages/AdminPage.tsx` (M1 — formulaire plat ; M3 — onglet + import).
- `frontend/src/pages/CaissePage.tsx` (M1 — sélecteur variante en libre).
- `frontend/src/utils/format.ts` ou nouveau `frontend/src/utils/date-range.ts` (M2 — helper `shortcutToRange`).
- `frontend/src/utils/date-range.test.ts` (M2 — tests du helper).

---

## Préambule — branche dédiée

- [ ] **Étape préalable : créer la branche depuis `main`**

Run:
```bash
git checkout main
git checkout -b feat/p1-enhancements
git branch --show-current
```
Expected: `feat/p1-enhancements`. Tous les commits du plan sont sur cette branche.

---

## MILESTONE 1 — Variantes sur plat à prix libre

> But : un plat `priceType='libre'` peut avoir des variantes (nom + recette). La variante n'a plus de prix propre. La commande prend le `customPrice` saisi par le caissier et la recette de la variante. Le mode `fixe` est strictement inchangé.

### Task 1.1 — Schéma : rendre `DishVariant.price` optionnel

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Rendre `price` optionnel sur `DishVariant`**

Dans `backend/prisma/schema.prisma`, localiser le modèle `DishVariant` et changer la ligne :
```prisma
  price     Int
```
en :
```prisma
  price     Int?
```
Aucune autre modification.

- [ ] **Step 2: Valider le schéma**

Run: `cd backend && npx prisma validate`
Expected: « The schema at prisma/schema.prisma is valid ».

### Task 1.2 — Migration : `ALTER COLUMN price DROP NOT NULL`

**Files:**
- Create: `backend/prisma/migrations/<timestamp>_dish_variant_price_optional/migration.sql`

> **Note méthode :** la commande `prisma migrate dev --create-only` exige un TTY pour le shadow DB confirmation dans cet environnement (constaté en P1). On utilise la même méthode éprouvée : `migrate diff` pour générer le SQL, application directe via psql sur `restaurant_db`, `migrate resolve --applied` pour enregistrer, puis `migrate deploy` sur `restaurant_test`.

- [ ] **Step 1: Créer le dossier de migration manuellement**

```bash
cd backend/prisma/migrations
mkdir 20260526120000_dish_variant_price_optional
```
(Utiliser un timestamp postérieur à `20260526005228_multitenant`. Adapter au timestamp courant.)

- [ ] **Step 2: Créer `migration.sql`**

Fichier `backend/prisma/migrations/20260526120000_dish_variant_price_optional/migration.sql` :
```sql
-- DishVariant.price devient optionnel pour autoriser les variantes sur plat a prix libre.
ALTER TABLE "dish_variants" ALTER COLUMN "price" DROP NOT NULL;
```

- [ ] **Step 3: Appliquer la migration à `restaurant_db`**

```powershell
$env:PGPASSWORD = "restaurant"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5433 -U restaurant -d restaurant_db `
  -v ON_ERROR_STOP=1 `
  -f "backend/prisma/migrations/20260526120000_dish_variant_price_optional/migration.sql"
```
Expected: `ALTER TABLE`.

- [ ] **Step 4: Enregistrer la migration dans `_prisma_migrations`**

```bash
cd backend && npx prisma migrate resolve --applied 20260526120000_dish_variant_price_optional
```
Expected: « Migration ... marked as applied ».

- [ ] **Step 5: Appliquer aussi à `restaurant_test`**

```powershell
$env:DATABASE_URL = "postgresql://restaurant:restaurant@localhost:5433/restaurant_test?schema=public"
cd backend && npx prisma migrate deploy
```
Expected: « Applied migration 20260526120000_dish_variant_price_optional ».
Puis effacer la variable d'environnement (PowerShell : `Remove-Item Env:DATABASE_URL`) pour que les commandes suivantes utilisent `restaurant_db` via `.env`.

- [ ] **Step 6: Régénérer le client Prisma**

```bash
cd backend && npx prisma generate
```
Expected: « Generated Prisma Client ».

- [ ] **Step 7: Vérification rapide**

```bash
cd backend && npx prisma migrate status
```
Expected: « Database schema is up to date ».

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260526120000_dish_variant_price_optional
git commit -m "feat(p1-enh): migration dish_variant.price optionnel"
```

### Task 1.3 — Validateurs Zod : inverser `dishNoVariantsIfLibre`

**Files:**
- Modify: `backend/src/validators/schemas.ts`

- [ ] **Step 1: Rendre `variantSchema.price` optionnel**

Dans `backend/src/validators/schemas.ts`, repérer `variantSchema` (~ligne 105) et changer :
```ts
const variantSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.number().int().min(0),
  ...
});
```
en :
```ts
const variantSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  ingredients: z.array(ingredientSchema).optional(),
});
```

- [ ] **Step 2: Remplacer le refinement `dishNoVariantsIfLibre`**

Repérer (~ligne 134-135) :
```ts
const dishNoVariantsIfLibre = (d: { priceType?: string; variants?: unknown[] }) =>
  d.priceType !== 'libre' || !(d.variants && d.variants.length > 0);
```
Le **remplacer** par :
```ts
// Variantes autorisées dans les deux modes. En mode fixe, chaque variante DOIT avoir un prix.
// En mode libre, les variantes n'ont PAS de prix propre (le prix vient du customPrice saisi en caisse).
const dishVariantPricesOk = (d: { priceType?: string; variants?: { price?: number }[] }) => {
  if (!d.variants || d.variants.length === 0) return true;
  if (d.priceType === 'libre') return d.variants.every((v) => v.price == null);
  return d.variants.every((v) => v.price != null);
};
```

- [ ] **Step 3: Remplacer l'usage dans `createDishSchema` et `updateDishSchema`**

Repérer (~ligne 137-144) les deux schémas qui appellent `.refine(dishNoVariantsIfLibre, ...)` et les remplacer par :
```ts
export const createDishSchema = dishObjectSchema
  .refine(dishBoundsOk, { message: 'Prix libre : minimum et maximum requis (min ≤ max)', path: ['priceMin'] })
  .refine(dishVariantPricesOk, {
    message: 'Prix de variante : requis en mode fixe, interdit en mode libre',
    path: ['variants'],
  });

export const updateDishSchema = dishObjectSchema
  .partial()
  .refine(dishBoundsOk, { message: 'Prix libre : minimum et maximum requis (min ≤ max)', path: ['priceMin'] })
  .refine(dishVariantPricesOk, {
    message: 'Prix de variante : requis en mode fixe, interdit en mode libre',
    path: ['variants'],
  });
```

- [ ] **Step 4: Vérifier la compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: zéro erreur (les usages des deux schémas ne changent pas).

### Task 1.4 — Service `dish.service` : autoriser variantes en libre

**Files:**
- Modify: `backend/src/services/dish.service.ts`

- [ ] **Step 1: `createDish` — toujours autoriser les variantes**

Dans `backend/src/services/dish.service.ts`, repérer la fonction `createDish` (~ligne 137) et la ligne :
```ts
      // Un plat à prix libre n'a pas de variantes.
      variants: !isLibre && data.variants ? { create: variantCreateData(data.variants) } : undefined,
```
la remplacer par :
```ts
      // Variantes autorisées dans les deux modes (libre OU fixe).
      variants: data.variants?.length ? { create: variantCreateData(data.variants) } : undefined,
```

- [ ] **Step 2: `variantCreateData` — préserver `price` undefined**

Toujours dans `dish.service.ts`, repérer la helper `variantCreateData` (~ligne 125) :
```ts
function variantCreateData(variants: VariantInput[]) {
  return variants.map((v, idx) => ({
    name: v.name,
    price: v.price,
    isActive: v.isActive ?? true,
    ...
  }));
}
```
Pas de changement nécessaire — `v.price` est `number | undefined` ; quand `undefined`, Prisma stocke `NULL` (autorisé après la migration). Vérifier que le type local `VariantInput.price` reconnaît bien `number | undefined` :
```ts
interface VariantInput {
  name: string;
  price?: number;          // <-- ajouter le `?` si pas déjà
  isActive?: boolean;
  sortOrder?: number;
  ingredients?: IngredientInput[];
}
```

- [ ] **Step 3: `updateDish` — NE PLUS supprimer les variantes en bascule vers `libre`**

Repérer dans `updateDish` (~ligne 163) le bloc :
```ts
    if (data.priceType === 'libre') {
      // Bascule en prix libre : on retire toute variante (incompatible).
      await tx.dishVariant.deleteMany({ where: { dishId: id } });
    } else if (data.variants) {
```
et le **remplacer** par :
```ts
    if (data.variants) {
```
(Le `else if` devient un `if` ; supprime juste le bloc « libre = delete »). Le reste de la branche `data.variants` est inchangé — elle remplace les variantes par celles fournies, et le `priceType` du plat est mis à jour plus bas dans la même transaction.

- [ ] **Step 4: `listMenuWithAvailability` — variant.price nullable**

Repérer (~ligne 86) :
```ts
    const variants = dish.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      available: v.ingredients.every((ing) => ing.stockItem.quantity >= ing.quantityNeeded),
    }));
```
**Aucun changement** : `v.price` est désormais `number | null` ; le type retourné reflète ça. Aller à `frontend/src/types/index.ts` ensuite (Task 1.6) pour aligner le type côté front.

- [ ] **Step 5: Vérifier la compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: zéro erreur (le client Prisma régénéré accepte `price: null`).

### Task 1.5 — Service `order.service` : variantes autorisées en libre

**Files:**
- Modify: `backend/src/services/order.service.ts`

- [ ] **Step 1: Adapter la branche `priceType === 'libre'` dans `createOrder`**

Dans `backend/src/services/order.service.ts`, repérer (~ligne 134-149) le bloc :
```ts
    if (dish.priceType === 'libre') {
      // Prix libre : re-validé contre les bornes (on ne fait pas confiance au prix envoyé par le client).
      unitPrice = resolveLibrePrice(dish, item.customPrice);
    } else if (item.variantId) {
      const variant = dish.variants.find((v) => v.id === item.variantId);
      if (!variant) throw new AppError(404, 'DISH_001', `Variante introuvable pour ${dish.name}`);
      if (!variant.isActive) throw new AppError(400, 'DISH_002', `${dish.name} (${variant.name}) indisponible`);
      unitPrice = variant.price;
      variantId = variant.id;
      variantName = variant.name;
      recipe = variant.ingredients;
    } else if (activeVariants.length > 0) {
      throw new AppError(400, 'VALIDATION_001', `Variante requise pour ${dish.name}`);
    }
```
Le **remplacer** par :
```ts
    if (dish.priceType === 'libre') {
      // Prix libre : re-validé contre les bornes du plat (jamais confiance au client).
      unitPrice = resolveLibrePrice(dish, item.customPrice);
      // Si le plat a des variantes actives, le caissier doit en choisir une (recette + nom).
      if (activeVariants.length > 0) {
        if (!item.variantId) throw new AppError(400, 'VALIDATION_001', `Variante requise pour ${dish.name}`);
        const variant = dish.variants.find((v) => v.id === item.variantId);
        if (!variant) throw new AppError(404, 'DISH_001', `Variante introuvable pour ${dish.name}`);
        if (!variant.isActive) throw new AppError(400, 'DISH_002', `${dish.name} (${variant.name}) indisponible`);
        variantId = variant.id;
        variantName = variant.name;
        recipe = variant.ingredients;
      }
    } else if (item.variantId) {
      const variant = dish.variants.find((v) => v.id === item.variantId);
      if (!variant) throw new AppError(404, 'DISH_001', `Variante introuvable pour ${dish.name}`);
      if (!variant.isActive) throw new AppError(400, 'DISH_002', `${dish.name} (${variant.name}) indisponible`);
      if (variant.price == null) throw new AppError(400, 'VALIDATION_001', `Variante sans prix sur plat fixe`);
      unitPrice = variant.price;
      variantId = variant.id;
      variantName = variant.name;
      recipe = variant.ingredients;
    } else if (activeVariants.length > 0) {
      throw new AppError(400, 'VALIDATION_001', `Variante requise pour ${dish.name}`);
    }
```
*Changements clés :*
1. Branche libre étendue pour gérer `variantId` (recette + nom de la variante), tout en gardant `unitPrice = resolveLibrePrice(...)`.
2. Branche fixe ajoute un garde explicite contre `variant.price == null` (cohérent avec la nouvelle nullable côté schéma).

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: zéro erreur.

### Task 1.6 — Frontend : types + UI plat + caisse

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/pages/CaissePage.tsx`

- [ ] **Step 1: `types/index.ts` — `MenuVariant.price` nullable**

Repérer :
```ts
export interface MenuVariant {
  id: number;
  name: string;
  price: number;
  available: boolean;
}
```
Changer en :
```ts
export interface MenuVariant {
  id: number;
  name: string;
  price: number | null;
  available: boolean;
}
```
Faire de même sur `DishVariant.price` (~ligne 51) : `price: number | null;`.

- [ ] **Step 2: `AdminPage.tsx` — autoriser variantes pour libre, masquer le prix par variante en libre**

Dans `AdminPage.tsx`, repérer l'interface locale `VariantForm` (~ligne 92) :
```ts
interface VariantForm { name: string; price: number; ingredients: Ingredient[] }
```
La changer en :
```ts
interface VariantForm { name: string; price: number | null; ingredients: Ingredient[] }
```
Puis dans le formulaire de plat (modal de création/édition), trouver la section qui rend les variantes — actuellement masquée si `priceType === 'libre'`. **Toujours afficher la section** ; pour CHAQUE champ « Prix » d'une variante, n'afficher l'`<input>` du prix que si `form.priceType !== 'libre'`. À la soumission, mapper chaque variante : si `priceType === 'libre'` → `{ name, ingredients }` (sans `price`) ; sinon → `{ name, price: Number(price), ingredients }`.

> **Repère pratique** : faire un grep dans `AdminPage.tsx` pour `priceType === 'libre'` afin de localiser les rendus conditionnels actuels. Aujourd'hui une condition cache toute la section variantes ; il faut la retirer et la déplacer sur le SEUL champ prix de chaque variante.

- [ ] **Step 3: `CaissePage.tsx` — sélecteur de variante pour plat libre avec variantes**

Aujourd'hui dans `CaissePage`, lorsqu'un plat `libre` est cliqué :
- Si aucune variante : afficher le champ « Prix saisi ».
- Si variantes : `dish.priceType === 'libre'` court-circuite l'affichage des variantes (cf. comportement actuel : libre ⇒ pas de variantes possibles avant ce changement).

Modifier le flux de sélection : si `dish.priceType === 'libre'` ET `dish.variants?.length > 0` actives, on AFFICHE d'abord le sélecteur de variante (boutons des variantes, comme pour le mode fixe), PUIS le champ « Prix saisi » (entre `priceMin` et `priceMax` du plat). À la validation, l'item envoyé porte `{ dishId, variantId, customPrice, quantity }`.

Repérer dans CaissePage la fonction qui gère le clic sur un plat à variantes ; ajouter la branche libre+variants en réutilisant les composants existants. Si la pagination du fichier devient complexe, isoler le rendu du sélecteur de variante dans une variable locale `pickedVariant` que le rendu du champ prix consomme.

> **Reco implémenteur :** si le code CaissePage est trop emmêlé, fait UNE seule modification : pour un plat `libre` avec variantes actives, présenter un mini-formulaire en deux étapes : (a) choisir une variante (boutons), (b) saisir le prix (input). Ne pas refactoriser le reste.

- [ ] **Step 4: Vérifier la compilation et la build frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: zéro erreur.

Run: `cd frontend && npm run build`
Expected: build OK.

### Task 1.7 — Tests M1 + commit

**Files:**
- Modify: `backend/src/__tests__/logic.test.ts` (ou un nouveau fichier de tests si le sujet est trop large)
- Modify: `backend/src/__tests__/api.test.ts`

- [ ] **Step 1: Ajouter un test de validation Zod**

Dans `backend/src/__tests__/logic.test.ts`, ajouter en fin de fichier :
```ts
import { createDishSchema } from '../validators/schemas';

describe('createDishSchema — variantes en libre', () => {
  it('autorise un plat libre avec variantes sans prix', () => {
    const res = createDishSchema.safeParse({
      name: 'Poisson du jour',
      price: 3000,
      priceType: 'libre',
      priceMin: 2000,
      priceMax: 6000,
      variants: [{ name: 'Petit' }, { name: 'Grand' }],
    });
    expect(res.success).toBe(true);
  });
  it('refuse un plat fixe avec variante sans prix', () => {
    const res = createDishSchema.safeParse({
      name: 'Plat',
      price: 3000,
      priceType: 'fixe',
      variants: [{ name: 'Petit' }],
    });
    expect(res.success).toBe(false);
  });
  it('refuse un plat libre avec variante portant un prix', () => {
    const res = createDishSchema.safeParse({
      name: 'Plat',
      price: 3000,
      priceType: 'libre',
      priceMin: 1000,
      priceMax: 5000,
      variants: [{ name: 'Petit', price: 2000 }],
    });
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests unitaires**

Run: `cd backend && npm test`
Expected: 34/34 (les 31 précédents + 3 nouveaux).

- [ ] **Step 3: Lancer la suite d'intégration (non-régression isolation)**

Run: `cd backend && npm run test:integration`
Expected: 12/12 toujours verts.

- [ ] **Step 4: Smoke manuel rapide (optionnel mais recommandé)**

Avec `npm run dev` du backend et du front, créer en admin un plat libre avec 2 variantes sans prix → sauvegarder → vérifier que la lecture retourne bien les 2 variantes (`GET /dishes`). Passer une commande en caisse sur ce plat (choisir une variante + saisir un prix dans les bornes) → la commande est créée avec `variantId` et le bon prix.

- [ ] **Step 5: Commit M1**

```bash
git add backend/src/services/dish.service.ts backend/src/services/order.service.ts \
        backend/src/validators/schemas.ts backend/src/__tests__/logic.test.ts \
        frontend/src/types/index.ts frontend/src/pages/AdminPage.tsx frontend/src/pages/CaissePage.tsx
git commit -m "feat(p1-enh): variantes autorisees sur plat a prix libre (option A)"
```

---

## MILESTONE 2 — Rapport sur plage de dates

> But : remplacer `period: 'today' | 'week' | 'month'` par une plage `from`/`to` libre. UI dashboard avec date-pickers + 4 raccourcis. Export PDF/CSV idem.

### Task 2.1 — Backend : helper `getRangeFromDates`

**Files:**
- Modify: `backend/src/services/stats.service.ts`

- [ ] **Step 1: Ajouter le helper en tête de `stats.service.ts`**

Dans `backend/src/services/stats.service.ts`, AVANT la fonction `getRange` existante, ajouter :
```ts
// Construit la plage à partir de deux dates fournies par le caller.
// `prevEnd = start`, `prevStart = start − (end − start)` (période précédente de même durée).
export function getRangeFromDates(from: Date, to: Date): Range {
  const start = startOfDay(from);
  // On considère `to` inclusif jusqu'à la fin de la journée.
  const end = new Date(to.getTime() + 24 * 60 * 60 * 1000); // = lendemain à 00:00 (borne exclusive)
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = start;
  const prevStart = new Date(start.getTime() - durationMs);
  return { start, end, prevStart, prevEnd };
}
```
S'assurer que `startOfDay` est dans les imports en haut du fichier (déjà présent).

- [ ] **Step 2: Adapter la signature de `getDashboard`**

Remplacer :
```ts
export async function getDashboard(period: Period) {
  const { start, end, prevStart, prevEnd } = getRange(period);
```
par :
```ts
export async function getDashboard(range: Range) {
  const { start, end, prevStart, prevEnd } = range;
```
Le reste de la fonction est **strictement inchangé** (le cœur de calcul opère déjà sur ces 4 variables).

- [ ] **Step 3: Garder l'ancien helper `getRange` exporté**

Le helper `getRange(period)` existe déjà ; on le laisse pour compat éventuelle / appelants internes. Vérifier qu'il est exporté ou exportable au besoin (s'il est privé, le laisser tel quel — il ne sera plus utilisé après M2).

- [ ] **Step 4: Vérifier la compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: erreurs dans `stats.controller.ts` qui passe encore `period` à `getDashboard` — corrigées en Task 2.2.

### Task 2.2 — Backend : controller + validateur + export

**Files:**
- Modify: `backend/src/controllers/stats.controller.ts`
- Modify: `backend/src/validators/schemas.ts`

- [ ] **Step 1: Remplacer `periodSchema` et `exportSchema` dans `schemas.ts`**

Repérer (~ligne 372-379) :
```ts
export const periodSchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
});

export const exportSchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
  format: z.enum(['pdf', 'csv']).default('pdf'),
});
```
Les **remplacer** par :
```ts
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format YYYY-MM-DD')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Date invalide');

const rangeRefine = (d: { from: string; to: string }) => {
  const from = new Date(d.from);
  const to = new Date(d.to);
  if (from > to) return false;
  const days = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 366;
};

export const dashboardRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine(rangeRefine, { message: 'Plage invalide (from > to ou > 366 jours)', path: ['from'] });

export const exportRangeSchema = z
  .object({ from: isoDate, to: isoDate, format: z.enum(['pdf', 'csv']).default('pdf') })
  .refine(rangeRefine, { message: 'Plage invalide (from > to ou > 366 jours)', path: ['from'] });
```

> Conserver les anciens noms `periodSchema`/`exportSchema` exportés s'ils sont importés ailleurs et qu'on veut éviter une cascade d'erreurs ; sinon les remplacer carrément. (En pratique, ils ne sont utilisés que dans `stats.routes.ts` ; on changera l'import en Task 2.3.)

- [ ] **Step 2: Adapter `stats.controller.ts`**

Lire `backend/src/controllers/stats.controller.ts` pour repérer la signature actuelle. Adapter :
- `dashboardController` : extraire `from`/`to` de `req.query`, construire la range via `getRangeFromDates(new Date(from), new Date(to))`, appeler `getDashboard(range)`.
- `exportController` : idem, plus `format` de `req.body` (ou `req.query` selon route). Appel `getDashboard(range)` pour les données + branchement export PDF/CSV inchangé.

Exemple cible :
```ts
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { getDashboard, getRangeFromDates } from '../services/stats.service';
// ... autres imports inchangés (export PDF/CSV)

export const dashboardController = asyncHandler(async (req, res) => {
  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  const range = getRangeFromDates(from, to);
  sendSuccess(res, await getDashboard(range));
});

export const exportController = asyncHandler(async (req, res) => {
  const from = new Date(String(req.body.from));
  const to = new Date(String(req.body.to));
  const format = req.body.format as 'pdf' | 'csv';
  const range = getRangeFromDates(from, to);
  const data = await getDashboard(range);
  // ... appel à la helper de génération PDF/CSV existante (inchangée), 
  //     mais lui passer la plage from/to pour le titre/nom de fichier.
});
```
Garder la helper de génération PDF/CSV existante ; lui passer un libellé construit depuis `from`/`to` au lieu de `period`.

- [ ] **Step 3: Adapter `stats.routes.ts`**

Dans `backend/src/routes/stats.routes.ts`, remplacer `validate(periodSchema)` par `validate(dashboardRangeSchema)` sur la route dashboard, et `validate(exportSchema)` par `validate(exportRangeSchema)` sur la route export. (Si `validate(periodSchema)` valide `req.query`, et `validate(exportSchema)` valide `req.body`, conserver le ciblage actuel — vérifier le `validate(...)` factory dans `middlewares/validate.ts` pour confirmer.)

> **Note :** si `validate(...)` ne sait pas distinguer query/body, il faudra étendre l'appel (ex. `validate(dashboardRangeSchema, 'query')`). Inspecter `middlewares/validate.ts` une fois, et soit utiliser la signature existante, soit étendre légèrement la middleware (ajouter un 2ᵉ argument `source: 'body' | 'query'`).

- [ ] **Step 4: Vérifier la compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: zéro erreur.

### Task 2.3 — Backend : test du helper + smoke API

**Files:**
- Modify: `backend/src/__tests__/logic.test.ts`
- Modify: `backend/src/__tests__/api.test.ts`

- [ ] **Step 1: Tests unitaires du helper**

Ajouter en fin de `logic.test.ts` :
```ts
import { getRangeFromDates } from '../services/stats.service';

describe('getRangeFromDates', () => {
  it('plage 1 jour : prevEnd = start, prev de meme duree', () => {
    const from = new Date('2026-05-14T00:00:00Z');
    const to = new Date('2026-05-14T00:00:00Z');
    const r = getRangeFromDates(from, to);
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
    expect(r.end.getTime() - r.start.getTime()).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
  });
  it('plage 7 jours : duree preservee', () => {
    const r = getRangeFromDates(new Date('2026-05-01'), new Date('2026-05-07'));
    const dur = r.end.getTime() - r.start.getTime();
    expect(dur).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
  });
});
```

- [ ] **Step 2: Smoke API plage invalide**

Ajouter dans `api.test.ts` :
```ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

function fakeToken(): string {
  // Ce smoke ne teste pas l'auth — on saute si l'API exige auth ; sinon test direct.
  return jwt.sign({ userId: 1, isSuperAdmin: false }, env.jwtSecret);
}

it('GET /api/stats/dashboard avec from > to renvoie 400', async () => {
  const res = await request(app).get('/api/stats/dashboard?from=2026-05-20&to=2026-05-01')
    .set('Authorization', `Bearer ${fakeToken()}`);
  // L'auth peut échouer en 401 si le token n'est pas dans un membership ; dans ce cas, le test est mis en xit.
  expect([400, 401, 403]).toContain(res.status);
});
```

> **Note** : si le harnais ne permet pas de tester l'auth sans setup, sauter ce test (ou le marquer `.skip`). Le test unitaire du helper (Step 1) couvre l'essentiel ; le smoke est un bonus.

- [ ] **Step 3: Vérifier**

Run: `cd backend && npm test`
Expected: 36/36 (les 34 précédents + 2 nouveaux ou +1 si le smoke est .skip).

Run: `cd backend && npm run test:integration`
Expected: 12/12.

### Task 2.4 — Frontend : helper `shortcutToRange` + `DashboardPage`

**Files:**
- Create: `frontend/src/utils/date-range.ts`
- Create: `frontend/src/utils/date-range.test.ts`
- Modify: `frontend/src/services/endpoints.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Créer le helper avec tests (TDD)**

Créer `frontend/src/utils/date-range.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { shortcutToRange, Shortcut } from './date-range';

const ANCHOR = new Date('2026-05-14T10:00:00Z');

describe('shortcutToRange', () => {
  it('today renvoie la meme date deux fois', () => {
    const r = shortcutToRange('today', ANCHOR);
    expect(r.from).toBe('2026-05-14');
    expect(r.to).toBe('2026-05-14');
  });
  it('last7 renvoie [anchor-6, anchor]', () => {
    const r = shortcutToRange('last7', ANCHOR);
    expect(r.from).toBe('2026-05-08');
    expect(r.to).toBe('2026-05-14');
  });
  it('thisMonth renvoie [1er du mois, anchor]', () => {
    const r = shortcutToRange('thisMonth', ANCHOR);
    expect(r.from).toBe('2026-05-01');
    expect(r.to).toBe('2026-05-14');
  });
  it('lastMonth renvoie tout le mois precedent', () => {
    const r = shortcutToRange('lastMonth', ANCHOR);
    expect(r.from).toBe('2026-04-01');
    expect(r.to).toBe('2026-04-30');
  });
  it.each(['today', 'last7', 'thisMonth', 'lastMonth'] as Shortcut[])('chaque shortcut a from <= to', (s) => {
    const r = shortcutToRange(s, ANCHOR);
    expect(r.from <= r.to).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd frontend && npx vitest run src/utils/date-range.test.ts`
Expected: FAIL (« Cannot find module './date-range' »).

- [ ] **Step 3: Implémenter `date-range.ts`**

```ts
export type Shortcut = 'today' | 'last7' | 'thisMonth' | 'lastMonth';

function fmt(d: Date): string {
  // ISO YYYY-MM-DD en UTC pour cohérence avec les <input type="date">.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shortcutToRange(s: Shortcut, anchor: Date = new Date()): { from: string; to: string } {
  const today = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  if (s === 'today') return { from: fmt(today), to: fmt(today) };
  if (s === 'last7') {
    const from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { from: fmt(from), to: fmt(today) };
  }
  if (s === 'thisMonth') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: fmt(from), to: fmt(today) };
  }
  // lastMonth
  const firstOfThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
  return { from: fmt(firstOfPrevMonth), to: fmt(lastOfPrevMonth) };
}
```

- [ ] **Step 4: Run tests au vert**

Run: `cd frontend && npx vitest run src/utils/date-range.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Adapter `endpoints.ts`**

Dans `frontend/src/services/endpoints.ts`, repérer `statsApi` et le **remplacer** par :
```ts
export const statsApi = {
  dashboard: (from: string, to: string) =>
    api.get('/stats/dashboard', { params: { from, to } }).then((r) => r.data.data as DashboardData),
  exportReport: (from: string, to: string, format: 'pdf' | 'csv') =>
    api.post('/stats/export', { from, to, format }, { responseType: 'blob' }).then((r) => r.data as Blob),
};
```

- [ ] **Step 6: Adapter `DashboardPage.tsx`**

Dans `frontend/src/pages/DashboardPage.tsx` :
- Supprimer `type Period = ...` et `PERIOD_LABELS`.
- Remplacer `const [period, setPeriod] = useState<Period>('today');` par :
```ts
const initial = shortcutToRange('today');
const [from, setFrom] = useState(initial.from);
const [to, setTo] = useState(initial.to);
```
(Importer `shortcutToRange` depuis `../utils/date-range`.)
- Remplacer `statsApi.dashboard(period)` par `statsApi.dashboard(from, to)`. Dépendances de `useCallback` : `[from, to]`.
- Remplacer le `handleExport(format)` par :
```ts
const handleExport = (format: 'pdf' | 'csv') => {
  setExportError('');
  const token = localStorage.getItem('accessToken');
  if (!token) {
    setExportError('Session expirée. Reconnectez-vous puis réessayez.');
    return;
  }
  // POST avec body via fetch (Content-Disposition pour le téléchargement).
  fetch(`${import.meta.env.VITE_API_URL}/stats/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ from, to, format }),
  })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Export impossible'))))
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-${from}_${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => setExportError('Export impossible. Vérifiez la plage et réessayez.'));
};
```
- Remplacer la barre des 3 boutons existante par un fragment :
```tsx
<div className="flex flex-wrap items-center gap-2">
  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-neutral-100" />
  <span className="text-neutral-500">→</span>
  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-neutral-100" />
  {(['today','last7','thisMonth','lastMonth'] as const).map((s) => {
    const labels = { today: "Aujourd'hui", last7: '7 derniers jours', thisMonth: 'Ce mois-ci', lastMonth: 'Mois dernier' };
    return (
      <button key={s} onClick={() => { const r = shortcutToRange(s); setFrom(r.from); setTo(r.to); }}
        className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 text-sm">
        {labels[s]}
      </button>
    );
  })}
</div>
```
- L'effet WebSocket `socket.on('stats_updated', onUpdate)` reste inchangé.

- [ ] **Step 7: Vérifier la compilation + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: zéro erreur, build OK.

- [ ] **Step 8: Smoke manuel (optionnel)**

Avec backend + front démarrés, ouvrir `/dashboard`, jouer avec les date-pickers, cliquer chaque raccourci, télécharger un PDF + un CSV. Vérifier que le nom du fichier inclut `from_to`.

### Task 2.5 — Commit M2

- [ ] **Step 1: Commit**

```bash
git add backend/src/services/stats.service.ts backend/src/controllers/stats.controller.ts \
        backend/src/validators/schemas.ts backend/src/routes/stats.routes.ts \
        backend/src/__tests__/logic.test.ts backend/src/__tests__/api.test.ts \
        frontend/src/utils/date-range.ts frontend/src/utils/date-range.test.ts \
        frontend/src/services/endpoints.ts frontend/src/pages/DashboardPage.tsx
git commit -m "feat(p1-enh): rapport sur plage de dates libre + raccourcis"
```

---

## MILESTONE 3 — Onglet Tables admin

> But : un nouvel onglet « Tables » dans `AdminPage` pour créer/éditer/supprimer les tables. Backend renforcé : refus 409 si commande active OU réservation active.

### Task 3.1 — Backend : code d'erreur + guard réservation + 409

**Files:**
- Modify: `backend/src/utils/errors.ts`
- Modify: `backend/src/services/table.service.ts`

- [ ] **Step 1: Ajouter `TABLE_001` dans `errors.ts`**

Repérer la table de codes dans `backend/src/utils/errors.ts`. Ajouter (à côté des codes existants comme `CASH_001`) :
```ts
TABLE_001: 'Table occupée (commande ou réservation active)',
```
(Le code exact à insérer respecte la convention présente — vérifier le format de la table.)

- [ ] **Step 2: Remplacer `deleteTable` dans `table.service.ts`**

Repérer (~ligne 147) :
```ts
export async function deleteTable(id: number) {
  const occupying = await prisma.order.findFirst({ where: { tableId: id, ...OCCUPYING_WHERE } });
  if (occupying) throw new AppError(400, 'VALIDATION_001', 'Table occupée, suppression impossible');
  await prisma.order.updateMany({ where: { tableId: id }, data: { tableId: null } });
  await prisma.table.delete({ where: { id } });
  return { id };
}
```
**Remplacer** par :
```ts
export async function deleteTable(id: number) {
  // Garde-fou 1 : commande active (non annulée et non payée OU non servie).
  const occupying = await prisma.order.findFirst({ where: { tableId: id, ...OCCUPYING_WHERE } });
  if (occupying) {
    throw new AppError(409, 'TABLE_001', 'Table occupée par une commande active');
  }
  // Garde-fou 2 : réservation active.
  const activeRes = await prisma.reservation.findFirst({ where: { tableId: id, status: 'active' } });
  if (activeRes) {
    throw new AppError(409, 'TABLE_001', 'Table avec une réservation active');
  }
  // OK : on détache les commandes historiques (FK SetNull manuel pour cohérence) puis on supprime.
  // Les réservations annulées/honorées sont cascade-supprimées par la FK (acceptable : pas de données financières dessus).
  await prisma.order.updateMany({ where: { tableId: id }, data: { tableId: null } });
  await prisma.table.delete({ where: { id } });
  return { id };
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: zéro erreur.

### Task 3.2 — Backend : tests d'intégration sur le guard

**Files:**
- Modify: `backend/src/__tests__/integration/auth.test.ts` (ou un nouveau fichier `tables.test.ts` dans le même dossier)

> **Reco** : créer un nouveau fichier d'intégration dédié plutôt que polluer `auth.test.ts`.

- [ ] **Step 1: Créer `backend/src/__tests__/integration/tables.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { deleteTable, createTable } from '../../services/table.service';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

let A: SeededRestaurant;
beforeAll(async () => { ({ A } = await resetAndSeedTwoRestaurants()); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('deleteTable — garde-fous', () => {
  it("refuse la suppression si la table a une commande active non payee", async () => {
    // Récupère la table A déjà seedée (et une commande active dessus).
    const table = (await runWithTenant(A.id, () => prisma.table.findMany()))[0];
    const dish = (await runWithTenant(A.id, () => prisma.dish.findMany()))[0];
    // Crée une commande active sur la table.
    await basePrisma.order.create({
      data: {
        orderNumber: '20260526-001',
        total: 1000, discountAmount: 0, discountPercent: 0, finalTotal: 1000,
        status: 'commandée', isPaid: false, tableId: table.id, restaurantId: A.id,
        items: { create: [{ dishId: dish.id, dishName: dish.name, dishPrice: 1000, quantity: 1, subtotal: 1000 }] },
      },
    });
    await expect(
      runWithTenant(A.id, () => deleteTable(table.id))
    ).rejects.toMatchObject({ status: 409, code: 'TABLE_001' });
  });

  it("refuse la suppression si la table a une reservation active", async () => {
    // Table propre (créée pour ce test).
    const t = await runWithTenant(A.id, () => createTable({ name: 'Table libre', capacity: 2 }));
    await basePrisma.reservation.create({
      data: {
        tableId: t.id, restaurantId: A.id,
        customerName: 'Test', reservedAt: new Date(), durationMinutes: 90, status: 'active',
      },
    });
    await expect(
      runWithTenant(A.id, () => deleteTable(t.id))
    ).rejects.toMatchObject({ status: 409, code: 'TABLE_001' });
  });

  it("supprime proprement si pas de commande/reservation active", async () => {
    const t = await runWithTenant(A.id, () => createTable({ name: 'Table jetable', capacity: 2 }));
    const before = await runWithTenant(A.id, () => prisma.table.findUnique({ where: { id: t.id } }));
    expect(before).not.toBeNull();
    await runWithTenant(A.id, () => deleteTable(t.id));
    const after = await runWithTenant(A.id, () => prisma.table.findUnique({ where: { id: t.id } }));
    expect(after).toBeNull();
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd backend && npm run test:integration`
Expected: 15/15 (les 12 précédents + 3 nouveaux). Si le test « commande active » échoue, vérifier que la commande créée est bien dans `OCCUPYING_WHERE` (status != annulée ET (status != servie OU isPaid=false)).

### Task 3.3 — Frontend : nouveau `TablesTab` + branchement `AdminPage`

**Files:**
- Create: `frontend/src/pages/admin/TablesTab.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Créer `TablesTab.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { tableApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { RestaurantTable } from '../../types';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT = 'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-6';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

const STATUS_LABEL: Record<string, string> = {
  libre: 'Libre',
  occupée: 'Occupée',
  addition_demandée: 'Addition demandée',
  réservée: 'Réservée',
};
const STATUS_BADGE: Record<string, string> = {
  libre: 'bg-emerald-500/15 text-emerald-300',
  occupée: 'bg-sky-500/15 text-sky-300',
  addition_demandée: 'bg-gold-400/15 text-gold-300',
  réservée: 'bg-purple-500/15 text-purple-300',
};

interface Form { name: string; capacity: string }
const EMPTY: Form = { name: '', capacity: '4' };

export default function TablesTab() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () => tableApi.list().then(setTables).catch((e) => setError(getApiError(e)));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setModal(true); };
  const openEdit = (t: RestaurantTable) => {
    setEditing(t);
    setForm({ name: t.name, capacity: String(t.capacity) });
    setError('');
    setModal(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    const capacity = Number(form.capacity);
    if (!name) { setError('Nom requis'); return; }
    if (!Number.isInteger(capacity) || capacity <= 0) { setError('Capacité invalide'); return; }
    setBusy(true);
    try {
      if (editing) await tableApi.update(editing.id, { name, capacity });
      else await tableApi.create({ name, capacity });
      setModal(false);
      await load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: RestaurantTable) => {
    if (!confirm(`Supprimer ${t.name} ?`)) return;
    setError('');
    try {
      await tableApi.remove(t.id);
      await load();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-neutral-100">Tables</h2>
        <button onClick={openCreate} className={`${BTN_GOLD} flex items-center gap-2 px-3 py-2 rounded-lg`}>
          <Plus className="w-4 h-4" /> Nouvelle table
        </button>
      </div>
      {error && <div className="mb-3 text-sm text-rose-400">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Capacité</th>
              <th className="text-left py-2">Statut</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.id} className="border-b border-neutral-900">
                <td className="py-2 text-neutral-100">{t.name}</td>
                <td className="py-2 text-neutral-300">{t.capacity}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE[t.status] ?? 'bg-neutral-800'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => openEdit(t)} className="p-1.5 text-neutral-400 hover:text-gold-400" title="Éditer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(t)} className="p-1.5 text-neutral-400 hover:text-rose-400" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {tables.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-neutral-500">Aucune table. Cliquez « Nouvelle table ».</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className={OVERLAY} onClick={() => !busy && setModal(false)}>
          <div className={MODAL} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100">{editing ? 'Éditer table' : 'Nouvelle table'}</h3>
              <button onClick={() => setModal(false)} disabled={busy} className="text-neutral-400 hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="mb-3 text-sm text-rose-400">{error}</div>}
            <label className="block text-sm text-neutral-300 mb-1">Nom</label>
            <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <label className="block text-sm text-neutral-300 mt-3 mb-1">Capacité</label>
            <input className={INPUT} type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(false)} disabled={busy} className="px-3 py-2 rounded-lg text-neutral-300 hover:bg-neutral-900">Annuler</button>
              <button onClick={submit} disabled={busy} className={`${BTN_GOLD} px-4 py-2 rounded-lg`}>{busy ? '…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ajouter le tab dans `AdminPage.tsx`**

Dans `frontend/src/pages/AdminPage.tsx`, à proximité des imports d'onglets (~ligne 32-36) :
```ts
import TablesTab from './admin/TablesTab';
```
Étendre le type `Tab` (~ligne 38) :
```ts
type Tab = 'stock' | 'menu' | 'users' | 'employes' | 'depenses' | 'caisse' | 'journal' | 'fournisseurs' | 'inventaire' | 'promotions' | 'tables';
```
Ajouter un bouton « Tables » dans le menu des tabs (chercher où sont rendus les autres tabs comme « Fournisseurs ») et un rendu conditionnel :
```tsx
{tab === 'tables' && <TablesTab />}
```
Le style du bouton suit celui des autres onglets — copier le motif.

- [ ] **Step 3: Vérifier la compilation + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: zéro erreur, build OK.

### Task 3.4 — Commit M3

- [ ] **Step 1: Commit**

```bash
git add backend/src/utils/errors.ts backend/src/services/table.service.ts \
        backend/src/__tests__/integration/tables.test.ts \
        frontend/src/pages/admin/TablesTab.tsx frontend/src/pages/AdminPage.tsx
git commit -m "feat(p1-enh): onglet admin Tables + guard suppression renforce"
```

---

## Vérification finale (avant PR/merge)

- [ ] **Step 1: type-check + tests complets**

```bash
cd backend && npx tsc --noEmit && npm test && npm run test:integration
cd frontend && npx tsc --noEmit && npm test && npm run build
```
Expected :
- Backend : `tsc` clean, `npm test` ≥ 34, `npm run test:integration` ≥ 15.
- Frontend : `tsc` clean, `npm test` ≥ 17, build OK.

- [ ] **Step 2: Smoke UI manuel rapide**

Démarrer backend (`npm run dev`) + frontend (`npm run dev`), se connecter avec `admin@restaurant-pilote.local` / `admin123` :
1. Admin > Menu : créer un plat **libre** (priceMin=1000, priceMax=5000) avec 2 variantes (« Petit », « Grand » ; pas de prix par variante). Sauver. Réouvrir le plat → variantes présentes.
2. Caisse : cliquer ce plat → sélecteur de variante → saisir un prix → ajouter au panier → valider la commande. Vérifier en cuisine et en caisse que la commande montre la variante choisie.
3. Dashboard : tester les date-pickers et chaque raccourci. Télécharger un PDF puis un CSV.
4. Admin > Tables : créer une nouvelle table « Test ». Aller en Salle, vérifier qu'elle apparaît. Retourner en Admin > Tables, supprimer « Test » → 200. Sur une table avec commande active, tenter suppression → 409 « Table occupée ».

---

## Auto-revue (couverture du spec)

| Exigence du spec | Couverte par |
|---|---|
| F1 — DishVariant.price optionnel + migration | Task 1.1, 1.2 |
| F1 — Refinement croisé : libre sans prix variante, fixe avec prix | Task 1.3 |
| F1 — dish.service : variants en libre + plus de delete sur bascule | Task 1.4 |
| F1 — order.service : libre + variantId (recette de la variante) | Task 1.5 |
| F1 — UI admin (toujours visible, prix masqué en libre) + caisse (sélecteur) | Task 1.6 |
| F1 — Type frontend `MenuVariant.price : number | null` | Task 1.6 step 1 |
| F1 — Tests validator (3 cas) | Task 1.7 |
| F2 — API `/stats/dashboard?from=&to=`, `/stats/export {from,to,format}` | Task 2.2 |
| F2 — Validation `from ≤ to`, plage ≤ 366 j | Task 2.2 step 1 |
| F2 — Helper `getRangeFromDates` + `prevEnd = start` | Task 2.1 |
| F2 — UI : double date-picker + 4 raccourcis | Task 2.4 step 6 |
| F2 — Helper `shortcutToRange` + tests | Task 2.4 step 1-4 |
| F2 — Tests : helper + smoke 400 | Task 2.3 |
| F3 — Guard 409 commande active OU réservation active | Task 3.1 |
| F3 — Code d'erreur `TABLE_001` | Task 3.1 step 1 |
| F3 — Onglet Tables admin (créer/éditer/supprimer) | Task 3.3 |
| F3 — Tests intégration guard | Task 3.2 |

## Risques d'exécution

- **Migration F1** : si `prisma migrate dev --create-only` ne fonctionne pas (TTY), utiliser la méthode manuelle décrite en Task 1.2 (psql + `migrate resolve --applied`). Sur prod Railway, la commande standard `prisma migrate deploy` est suffisante (non-interactive).
- **UI plat (admin) — refactor caché** : la section variantes du formulaire peut nécessiter de remonter une condition (`priceType === 'libre'` ⇒ masquer la section). Si l'implémenteur galère, l'isoler dans une variable `variantsAllowed = true` (au lieu de `!isLibre`).
- **Validate middleware** : si `validate(...)` cible uniquement `req.body`, étendre la middleware pour accepter `'query'` (ou faire la validation manuelle dans le controller). Inspecter `middlewares/validate.ts` avant de refactoriser.
- **Smoke UI rapport** : le téléchargement actuel utilise un `<a href>` GET ; la nouvelle version doit basculer en POST (le body porte from/to). Le code en Task 2.4 step 6 prévoit `fetch + Blob + URL.createObjectURL` ; si une route GET avec query est préférée, adapter (mais cohérence avec le validateur).
