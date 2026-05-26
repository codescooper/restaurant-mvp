# Design — P1 Enhancements

> Date : 2026-05-26
> Statut : validé (brainstorming) — prêt pour planification
> S'appuie sur : `docs/superpowers/specs/2026-05-25-plateforme-multitenant-design.md` (multi-tenant déjà mergé sur `main`).

## 1. Contexte

Trois petits enhancements **indépendants** demandés sur la plateforme post-P1 :

1. Autoriser des **variantes** sur un plat à **prix libre**.
2. Permettre de **télécharger un rapport** journalier/hebdomadaire/mensuel sur **une plage de dates** au choix.
3. Permettre de **modifier la salle** (ajouter / retirer des tables) depuis l'admin.

Aucun de ces changements ne touche le contrat multi-tenant ni l'isolation prouvée par M5. Une seule petite migration (Feature 1), 0 migration pour les deux autres. Ils seront livrés ensemble sur une branche dédiée.

## 2. Feature 1 — Variantes sur plat à prix libre

**Décision (validée) : option A** — la variante apporte uniquement un **nom** et une **recette** ; le prix vient du `customPrice` saisi en caisse, validé contre les bornes du plat (`priceMin`/`priceMax`).

### Règles métier

- Plat **`fixe`** : variantes obligatoirement avec `price` — comportement actuel **inchangé**.
- Plat **`libre`** :
  - Variantes autorisées, **sans `price`** propre.
  - Si des variantes actives existent → la ligne de commande doit porter un `variantId` (cohérent avec `fixe`).
  - Recette : si `variantId` choisi → recette de la variante, sinon recette du plat.
  - Prix unitaire de la ligne : `resolveLibrePrice(dish, customPrice)`.

### Schéma & migration

- `DishVariant.price` → `Int?` (nullable).
- Migration : `ALTER COLUMN price DROP NOT NULL` sur `dish_variants`. Aucune ligne à backfill (les variantes existantes sont toutes sur des plats `fixe` et conservent leur `price`).

### Services

- `dish.service.createDish` / `updateDish` : retirer le bloc qui supprime les variantes lors d'une bascule vers `libre`. Toujours autoriser le tableau `variants`. La validation de `variant.price` se déclenche **uniquement** pour `fixe`.
- `order.service.createOrder` : autoriser `item.variantId` sur un plat `libre` ; résoudre la recette depuis la variante choisie (sinon depuis le plat) ; le prix unitaire reste `resolveLibrePrice(dish, customPrice)`.
- `dish.service.listMenuWithAvailability` : pour un plat libre avec variantes, les variantes renvoient `price: null` ; la disponibilité se calcule sur la recette de la variante.

### Validateurs (Zod)

- `variants[].price` → `z.number().int().nonnegative().optional()`.
- Refinement croisé sur `createDish`/`updateDish` :
  - `priceType !== 'libre'` ⇒ chaque variante doit avoir `price` (sinon erreur de validation).
  - `priceType === 'libre'` ⇒ `price` absent/null.

### UI

- **Admin > Plat** : section "Variantes" **toujours visible** ; champ "Prix" par variante affiché **uniquement** si `priceType === 'fixe'`.
- **Caisse** : pour un plat libre avec variantes → sélecteur de variante + le champ "Prix saisi" existant. Pas de double affichage de prix.
- Type frontend `MenuVariant.price` → `number | null`.

### Tests

- *Logic backend* :
  - `createOrder` avec plat libre + `variantId` + `customPrice` → `OrderItem.variantId` posé, stock décrémenté depuis la **recette de la variante**, prix = `customPrice`.
- *Validator* :
  - libre avec variantes sans prix → OK ;
  - fixe avec variante sans prix → 400 ;
  - libre avec variantes actives sans `variantId` sur la commande → 400.
- *Smoke admin* : POST/PUT d'un plat libre avec 2 variantes (sans prix) → 200, GET ramène les variantes.

## 3. Feature 2 — Rapport sur plage de dates

**Décision (validée) : option C** — plage `from`/`to` libre comme source de vérité + 4 raccourcis qui pré-remplissent les dates. Rapport **agrégé** sur la plage (pas de breakdown par jour).

### API

- `GET /api/stats/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` — les deux requis.
- `POST /api/stats/export` body `{ from, to, format: 'pdf' | 'csv' }`.
- Le paramètre `period` est **retiré** (les presets sont calculés côté front et envoyés en `from`/`to`).
- Validation Zod : dates ISO valides, `from ≤ to`, plage ≤ 366 jours (garde-fou).

### Service `stats.service`

- Helper pur exporté `getRangeFromDates(from: Date, to: Date): { start, end, prevStart, prevEnd }` — `prevEnd = start`, `prevStart = start − (end − start)` (période précédente de **même durée**).
- `getDashboard(range: Range)` reçoit directement la range ; le controller la construit à partir des dates parsées. Le cœur de calcul (totaux, top plats, modes de paiement, marges, etc.) est **inchangé** — il opère déjà sur `start`/`end`/`prevStart`/`prevEnd`.

### Frontend

- `DashboardPage` : la barre des 3 boutons est remplacée par
  - un **double date-picker** (`<input type="date">` côte à côte, simple natif),
  - **4 chips raccourcis** : *Aujourd'hui · 7 derniers jours · Ce mois-ci · Mois dernier* — click → écrit les deux dates dans le picker → refetch.
- `statsApi.dashboard(from, to)` & `exportReport(from, to, format)`.
- Helper pur testé `shortcutToRange(name): { from, to }`.

### Tests

- *Logic backend* : `getRangeFromDates` — cas 1 jour, 30 jours, mois entier (vérifier `prevEnd === start` et la durée de `prevStart..prevEnd`).
- *Validator* : `from > to` → 400, plage > 366 j → 400, formats date invalides → 400.
- *Smoke API* : `GET /stats/dashboard?from=…&to=…` → 200 sur la base seedée.
- *Logic frontend* : `shortcutToRange` pour chaque raccourci avec date d'ancrage fixe (test déterministe).

### Hors périmètre

- Pas de **breakdown par jour** dans le rapport (agrégé sur la plage).
- Pas de comparateur libre (la période précédente reste « même durée juste avant `from` »).

## 4. Feature 3 — Onglet Tables admin

**Décision (validée) : option A (placement) + reco (suppression)** — nouvel onglet dans `AdminPage` ; suppression refusée si la table a une commande active ou une réservation active, sinon autorisée.

### Backend — guard de suppression

- `table.service.removeTable(id)` : ajouter (ou vérifier qu'il existe déjà) un guard qui lève `AppError(409, '<code>')` (code à attribuer dans le plan, ex. `TABLE_002`) si la table a au moins :
  - une **commande active** : `Order { tableId === id, status NOT IN ('annulée'), isPaid: false }` (commande non payée et non annulée = la table est encore mobilisée),
  - une **réservation active** : `Reservation { tableId === id, status === 'active' }`.
- Sinon, suppression standard. Conséquence Prisma : `Order.tableId` historique passe à `NULL` (FK nullable, `onDelete` par défaut = SetNull). **Les statistiques et l'historique sont préservés** (orderNumber, items, montants).
- Création : unicité du nom déjà gérée par `@@unique([restaurantId, name])` ; mapper Prisma `P2002` → 409 si pas déjà fait.

### Frontend

- Nouveau fichier `frontend/src/pages/admin/TablesTab.tsx`, calqué sur `EmployeesTab` :
  - Liste : `name` · `capacity` · statut courant si présent dans la réponse · actions *Éditer* / *Supprimer*.
  - Modale **Nouvelle / Éditer table** : champs `name` (requis), `capacity` (défaut 4).
  - Suppression : confirmation + `tableApi.remove(id)` ; erreurs serveur via `getApiError` (le 409 « table occupée » s'affiche tel quel).
- Ajout dans `AdminPage.tsx` : nouvel onglet « Tables » dans le menu des tabs.
- Accès propriétaire + administrateur (déjà filtré par `requireRole` sur les routes `/tables`).

### Tests

- *Backend logic/smoke* :
  - `removeTable` avec commande active non payée → 409.
  - `removeTable` avec réservation `active` → 409.
  - `removeTable` propre (aucune commande active, aucune réservation active) → 200 et les `Order.tableId` historiques passent à `NULL`.
  - Création avec nom déjà pris dans le restaurant courant → 409.
- *Frontend* : pas de test unitaire dédié (suit le pattern des autres tabs admin) ; vérification au `tsc` + smoke manuel.

### Champs hors v1

- Zone/section (terrasse vs intérieur) : non.
- Soft-delete via `Table.isActive` : non — refus dur + cascade SetNull suffit.

## 5. Séquencement & livrables

- **Une branche** `feat/p1-enhancements` (créée juste avant l'implémentation, depuis `main`).
- **Un plan** d'implémentation détaillé (suivra ce spec), avec 3 milestones :
  - **M1** — Feature 1 (variantes en libre) : schéma + migration + services + validateurs + UI + tests.
  - **M2** — Feature 2 (plage de dates) : API + service + UI + tests.
  - **M3** — Feature 3 (onglet Tables admin) : guard backend + UI + tests.
- Exécution piloté par sous-agents, double revue (conformité + qualité) à chaque étape — même méthode que la P1.
- **Smoke UI manuel** à la fin (login + parcours de chaque feature) avant merge.

## 6. Critères de succès

- *Backend* : `npx tsc --noEmit` clean ; `npm test` toujours ≥ 31 verts (avec 3-4 nouveaux tests unitaires/de logique ajoutés) ; `npm run test:integration` toujours 12/12.
- *Frontend* : `npx tsc --noEmit` clean ; `npm run build` OK ; `npm test` ≥ 12 verts.
- *Smoke UI* :
  - Créer un plat **libre** avec 2 variantes → passer une commande dessus en caisse, avec sélection de variante + prix saisi.
  - Télécharger un rapport sur une **plage personnalisée** (PDF ou CSV).
  - Ajouter une table depuis l'admin, la voir apparaître sur le plan de salle, la supprimer.

## 7. Risques & points de vigilance

- **F1 migration** : `ALTER COLUMN price DROP NOT NULL` est non-destructive et instantanée sur PG18 — pas de blocage attendu. Doit être générée via `prisma migrate dev --create-only` (non-interactif via la méthode déjà éprouvée en P1) puis appliquée.
- **F1 ordre des validations** : le refinement croisé sur les variantes doit se déclencher AVANT que Prisma rejette pour `null` sur une colonne désormais nullable — donc côté Zod uniquement. Bien tester le cas « plat fixe créé avec variante sans prix » → 400 Zod, pas 500 Prisma.
- **F2 plage trop large** : la requête `findMany` sur Orders peut être lourde sur > 6 mois (le service charge tout en mémoire pour calculer top plats etc.). Le garde-fou 366 j est une mesure raisonnable. Une optimisation future serait possible (agrégations SQL) — hors périmètre.
- **F3 fenêtre de course** : entre le check « commande active ? » et le `DELETE`, une nouvelle commande pourrait être prise. Risque très faible (admin + nouvelle commande sur la même table, simultanés). Si Prisma lève une erreur FK plus loin, on la mappe en 409. Acceptable pour v1.

## 8. Hors périmètre

- Page publique de présentation, branding Cloudinary (**P3**).
- Invitations + console super-admin d'activation (**P2**).
- Breakdown jour-par-jour dans le rapport ; comparateur libre.
- Soft-delete des tables ; zones/sections de salle.
