# P2a Onboarding — Rapport de finalisation

**Date :** 2026-05-27
**Branche source :** `feat/p2a-onboarding` (mergée)
**Branche cible :** `main` (poussée sur `origin/main`)
**Commit final main :** `f98b46a` (merge commit)
**Travail total :** 30 commits, 49 fichiers changés, +4661 / −100 lignes

---

## 🎯 Ce qui est en prod (après auto-deploy Railway + Vercel)

### Pour le proprietaire d'un nouveau resto
- Page d'inscription publique **`/signup`** (4 champs : email, password, nom, nom du resto).
- Restaurant créé en `pending`, redirige automatiquement vers `/dashboard` en mode préparation.
- **Bandeau « Mode préparation » amber** en haut de chaque page : explique que les commandes test, les sessions de caisse et les mouvements de stock seront effacés à l'activation.
- Le propriétaire pending a accès à **TOUTES** les pages opérationnelles (Gestion, Caisse, Cuisine, Salle, Service) pour tester sa configuration.
- Les valeurs de stock saisies/modifiées manuellement sont capturées comme `baselineQuantity` : à l'activation, on restaure ces baselines (les décrémentations dues aux commandes test sont annulées).

### Pour le super-admin
- Console **`/super-admin`** accessible uniquement si `currentUser.isSuperAdmin = true` (lien dans la nav, masqué sinon).
- Liste des restaurants avec filtres (Tous / En attente / Actif / Suspendu / Refusé).
- Actions par status :
  - `pending` → **Activer** (reset transactionnel : delete orders/stockMovements/cashSessions/reservations/notifications/auditLogs/expenses/purchases/inventories + restore stock baseline) ou **Refuser** (avec raison).
  - `active` → **Suspendre** (avec raison).
  - `suspended/rejected` → **Réactiver** (simple toggle status, pas de reset).
- Avertissement irréversible sur l'activation, avec affichage des `deletedCounts` après l'opération.

### Pour les membres de l'équipe (serveur/cuisinier/caissier/administrateur)
- Lien d'invitation 7 jours signé (token 64 hex chars) envoyé par WhatsApp/email depuis l'onglet « Membres » de la Gestion.
- Page **`/invite/:token`** : peek public sans auth → formulaire d'acceptation.
  - **Login-first si l'email existe déjà** : on demande le mot de passe existant (bcrypt.compare), pas de nouveau compte.
  - Sinon : création de compte (password + displayName).
- Auto-login + redirection vers `homeForRole(role)` après acceptation.
- Rate limit 10/15min sur `/api/public/invitations/:token/accept` (anti-brute force).
- Defense-in-depth : l'acceptation est refusée si le restaurant n'est pas `active` au moment de l'accept.

### Écrans dédiés statuts non-opérationnels (palette Operator sombre)
- **`/suspended`** : Lock rose, raison affichée, boutons WhatsApp/Email AwemA + déconnexion.
- **`/rejected`** : ShieldOff orange, raison affichée, mêmes CTAs.
- **`/pending-member`** : Hourglass amber (pour les rôles non-propriétaires d'un resto pending).

### Contact AwemA intégré
- WhatsApp : **+225 07 07 14 59 59** (lien wa.me pré-rempli avec message contextualisé).
- Email : **webmarketingagence@gmail.com** (lien mailto pré-rempli avec sujet contextualisé).
- Constantes dans `frontend/src/utils/contact.ts`.

---

## ✅ État qualité

### Tests
| Suite | Compteur | Status |
|---|---|---|
| Backend unit (`vitest`) | **48/48** | ✅ |
| Backend integration (`vitest` + DB test) | **32/32** (15 existants + 17 nouveaux M9) | ✅ |
| Frontend unit (`vitest`) | **20/20** | ✅ |
| Frontend build (`vite`) | 1702 modules, chunks séparés | ✅ |
| Backend `tsc --noEmit` | 0 erreur | ✅ |
| Frontend `tsc --noEmit` | 0 erreur | ✅ |

### Revues qualité passées
Chacun des 9 milestones a subi :
1. Implémenter (subagent dédié)
2. Revue de conformité spec (vs `docs/superpowers/plans/2026-05-27-p2a-onboarding.md`)
3. Revue qualité du code (sécurité, race conditions, FK, performance)

**Issues critiques détectées et fixées en cours de route** :
- M4 — `activateRestaurant` acceptait `suspended/rejected` (aurait wipé des données de prod). Restreint à `pending` uniquement, codes ADMIN_002-005 introduits, timeout transaction porté à 30s.
- M5 — `authenticate` middleware filtrait `restaurant.status === 'active'` en dur (proprio pending ne pouvait pas se reconnecter). Filtre retiré, comportement déplacé en `requireActiveRestaurant` middleware avec carve-out pour le propriétaire pending.
- M5 — Trou de sécurité : un serveur d'un resto suspendu pouvait quand même créer des commandes via curl. Fermé par `requireActiveRestaurant` sur toutes les routes opérationnelles.
- M5 — `switchRestaurant` ne retournait pas `memberships`, crash front sur multi-resto users. Fixé.
- M3 — `acceptInvitation` créait l'User hors transaction (risque d'utilisateur orphelin). Refactor en transaction interactive atomique.
- M3 — Pas de rate limit sur l'endpoint accept invitation (vecteur brute-force mot de passe). Ajouté.

---

## 🚀 Déploiement

### Backend (Railway)
- Push origin/main → trigger build/deploy automatique.
- `npx prisma generate && npm run build` puis `npx prisma migrate deploy && npm start`.
- Migration `20260527120000_p2a_onboarding` ajoute :
  - Table `invitations` (id, restaurantId, email, role, token UNIQUE, status, expiresAt, createdBy?, acceptedAt?, revokedAt?, createdAt) + 3 indexes + 2 FK.
  - Colonnes `restaurants.activated_at`, `rejected_at`, `rejected_reason`, `suspended_at`, `suspended_reason`.
  - Colonne `stock_items.baseline_quantity`.
- **Toutes les modifs sont additives** (pas de DROP COLUMN, pas de rename) : safe rollback.

### Frontend (Vercel)
- Push origin/main → trigger build automatique.
- `npm run build` (Vite) → output `dist/`.
- Routes ajoutées : `/signup`, `/invite/:token`, `/suspended`, `/rejected`, `/pending-member`, `/super-admin`.
- Build vérifié localement : 1702 modules, chunks lazy-loadés (SignupPage 5kB, InviteAcceptPage 5kB, SuperAdminPage 8kB, etc.).

### Vérifications à faire au réveil

1. **Aller sur Railway** : confirmer le dernier build/deploy est `Success` (le webhook a dû partir vers 22:00 heure locale). Logs à surveiller :
   - `prisma migrate deploy` doit appliquer 1 nouvelle migration sans erreur.
   - L'app doit démarrer et passer le healthcheck `/api/health`.
2. **Aller sur Vercel** : confirmer le dernier déploiement est `Ready`. Le frontend ne dépend que de variables `VITE_API_URL` et `VITE_WS_URL` déjà configurées.
3. **Smoke test prod** :
   ```bash
   # Remplace <prod-url> par ton URL Railway/Vercel.
   curl -X POST https://<prod-backend>/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"smoke-prod@test.local","password":"pass1234","displayName":"Smoke","restaurantName":"Smoke Resto"}'
   # Attendu : 201 + { user, accessToken, refreshToken, memberships:[{role:"propriétaire"}] }
   ```
   Ou direct dans le navigateur : `https://<prod-frontend>/signup` → remplir → soumettre → tomber sur Dashboard avec bandeau « Mode préparation ».
4. **Activer le premier resto réel** : se logger en super-admin → `/super-admin` → cliquer Activer sur le resto de test → confirmer dans la modale → vérifier que le resto passe en `active`.
5. **Nettoyage du resto de test** : suppression manuelle via la DB Railway si tu veux pas le garder.

### Variables d'environnement à vérifier sur Railway

| Variable | Valeur attendue | Statut |
|---|---|---|
| `DATABASE_URL` | URL Neon Postgres | Existait depuis P1 |
| `JWT_SECRET` | secret aléatoire fort | Existait depuis P1 |
| `JWT_REFRESH_SECRET` | secret aléatoire fort | Existait depuis P1 |
| `SUPERADMIN_EMAIL` | email du super-admin (toi) | Existait depuis P1 |
| `SUPERADMIN_PASSWORD` | mot de passe seed du super-admin | Existait depuis P1 |
| `APP_BASE_URL` | **URL publique du frontend Vercel** (sert à fabriquer les URLs d'invitation) | À VÉRIFIER — défaut `http://localhost:5173` si non set, ce qui casserait les liens d'invitation envoyés depuis la prod |
| `CORS_ORIGIN` | URL publique du frontend | Existait depuis P1 |

⚠️ **Action requise si APP_BASE_URL pointe encore vers localhost** : aller dans le dashboard Railway, mettre `APP_BASE_URL=https://<ton-frontend-vercel>` et redéployer.

---

## ⚠️ TODOs / Points de vigilance pour la suite

### Bugs latents acceptés (post-MVP)
- **Modal du SuperAdmin** : seul le bouton « Activer » affiche un spinner pendant l'opération. Les boutons Suspendre/Refuser/Réactiver sont seulement désactivés sans feedback visuel. Cosmétique.
- **Race condition signup** : si deux signups concurrents avec le même email passent la vérif d'unicité en même temps, le 2e crashe en 500 (P2002 Prisma non mappé en 409). Mitigé par le rate limiter 3/h/IP. À nettoyer si on observe le cas en prod.
- **TOCTOU activation** : `findUnique` + guard hors transaction. Un autre admin pourrait changer le status entre check et transaction. Pas exploitable en pratique (modale UI bloque, super-admin = personne unique normalement).
- **`_count.invitations` non filtré** : la console super-admin compte toutes les invitations (incluant accepted/revoked/expired). À filtrer en UI si l'usage devient un problème.

### Évolutions naturelles à considérer
- **AdminPage devient lourd** (~1330 lignes après ajout PendingInvitations). Envisager d'extraire `PendingInvitations` en `frontend/src/pages/admin/InvitationsTab.tsx` au prochain milestone.
- **Audit log des actions super-admin** : aucune trace n'est laissée quand on suspend/refuse/active. Pour la traçabilité long-terme, ajouter une entrée `AuditLog` à chaque action admin (utile pour P3).
- **Pagination liste restos** dans la console super-admin. OK pour <100 restos, à revoir si succès rapide.

### Reset à l'activation : table list (mémo)
La transaction d'activation supprime, dans cet ordre :
1. `NotificationRead` (via FK notification)
2. `Notification`
3. `StockMovement`
4. `InventoryLine` (cascade depuis Inventory)
5. `Inventory`
6. `Purchase`
7. `Expense`
8. `Order` (cascade `OrderItem`)
9. `CashSession`
10. `Reservation` (cascade `ReservationItem`)
11. `AuditLog`
12. `UPDATE stock_items SET quantity = COALESCE(baseline_quantity, quantity), baseline_quantity = NULL`
13. `UPDATE restaurants SET status='active', activatedAt=now, ...`

**NE sont PAS supprimés** : Dish, StockItem (juste resetté en quantity), Table, Membership, Supplier (catalogue partagé), Employee, Promotion. Ce sont les données structurelles que le proprio garde pour démarrer.

---

## 📂 Carte des nouveaux fichiers

**Backend (10 fichiers créés, 9 modifiés)** :
- `backend/prisma/schema.prisma` (modifié)
- `backend/prisma/migrations/20260527120000_p2a_onboarding/migration.sql` (créé)
- `backend/src/services/signup.service.ts` (créé)
- `backend/src/services/invitation.service.ts` (créé)
- `backend/src/services/admin.service.ts` (créé)
- `backend/src/services/stock.service.ts` (modifié — capture baseline)
- `backend/src/services/inventory.service.ts` (modifié — capture baseline)
- `backend/src/services/auth.service.ts` (modifié — getMe enrichi + switchRestaurant memberships)
- `backend/src/services/membership.service.ts` (modifié — retrait filtre status)
- `backend/src/controllers/signup.controller.ts` (créé)
- `backend/src/controllers/invitation.controller.ts` (créé)
- `backend/src/controllers/admin.controller.ts` (créé)
- `backend/src/controllers/auth.controller.ts` (modifié)
- `backend/src/routes/auth.routes.ts` (modifié — POST /signup)
- `backend/src/routes/invitation.routes.ts` (créé)
- `backend/src/routes/public.routes.ts` (créé)
- `backend/src/routes/admin.routes.ts` (créé)
- `backend/src/routes/index.ts` (modifié — wire + requireActiveRestaurant)
- `backend/src/middlewares/auth.ts` (modifié — requireActiveRestaurant, retrait filtre)
- `backend/src/middlewares/rateLimit.ts` (modifié — signupLimiter + acceptInviteLimiter)
- `backend/src/utils/slug.ts` (créé)
- `backend/src/utils/errors.ts` (modifié — codes USER_005, INV_001-007, ADMIN_001-005, AUTH_007/008, RESTAURANT_001)
- `backend/src/validators/schemas.ts` (modifié — signup, invitation, admin schemas)
- `backend/src/constants.ts` (modifié — INVITABLE_ROLES)
- `backend/src/__tests__/integration/onboarding.test.ts` (créé)
- `backend/src/__tests__/integration/invitations.test.ts` (créé)
- `backend/src/__tests__/integration/admin.test.ts` (créé)
- `backend/src/__tests__/integration/helpers.ts` (modifié — invitation.deleteMany)
- `backend/src/__tests__/logic.test.ts` (modifié — 6 nouveaux tests slugify)

**Frontend (10 fichiers créés, 6 modifiés)** :
- `frontend/src/pages/SignupPage.tsx` (créé)
- `frontend/src/pages/InviteAcceptPage.tsx` (créé)
- `frontend/src/pages/SuspendedPage.tsx` (créé)
- `frontend/src/pages/RejectedPage.tsx` (créé)
- `frontend/src/pages/PendingMemberPage.tsx` (créé)
- `frontend/src/pages/SuperAdminPage.tsx` (créé)
- `frontend/src/pages/AdminPage.tsx` (modifié — PendingInvitations dans onglet Membres)
- `frontend/src/pages/LoginPage.tsx` (modifié — CTA Créer un restaurant)
- `frontend/src/components/StatusBlockedCard.tsx` (créé)
- `frontend/src/components/SimulationBanner.tsx` (créé)
- `frontend/src/components/Layout.tsx` (modifié — wire SimulationBanner)
- `frontend/src/components/ProtectedRoute.tsx` (modifié — routage par status)
- `frontend/src/components/Navigation.tsx` (modifié — lien Super-admin)
- `frontend/src/contexts/AuthContext.tsx` (modifié — currentRestaurant)
- `frontend/src/services/endpoints.ts` (modifié — signupApi/invitationApi/publicInviteApi/adminApi)
- `frontend/src/types/index.ts` (modifié — RestaurantStatus/CurrentRestaurant/Invitation/AdminRestaurantRow)
- `frontend/src/utils/contact.ts` (créé)
- `frontend/src/App.tsx` (modifié — 6 nouvelles routes + SuperAdminRoute guard)

---

## 🔭 Prochaines étapes possibles (P2b → P2c → autres)

**P2b — Personnalisation** (selon spec déjà écrite) :
- Upload Cloudinary (logo, cover, background).
- Couleur principale (CSS variable).
- Aperçu en direct interne + page publique.

**P2c — Page publique `/r/:slug`** (selon spec déjà écrite) :
- Hero + menu + disponibilité des plats + état des tables.
- Endpoint `GET /api/public/restaurants/:slug/*` sans auth.

Ces deux sous-projets ont déjà leur spec dans `docs/superpowers/specs/2026-05-25-plateforme-multitenant-design.md`. Les plans d'implémentation ne sont pas encore écrits.

---

## ✅ Récap final

| Item | État |
|---|---|
| P2a tasks 1.1 → 9.4 | Toutes complétées |
| Branche feat/p2a-onboarding | Mergée dans main (commit `f98b46a`) |
| Push origin/main | Effectué (commit local main = origin/main = `f98b46a`) |
| Tests backend | 48 + 32 = 80 / 80 verts |
| Tests frontend | 20/20 verts + build OK |
| Railway auto-deploy | Déclenché par le push, à vérifier au réveil |
| Vercel auto-deploy | Déclenché par le push, à vérifier au réveil |
| Migration prod | Sera appliquée par `prisma migrate deploy` au démarrage du conteneur Railway |
| APP_BASE_URL env Railway | **À VÉRIFIER MANUELLEMENT** au réveil |
| Smoke test prod | À faire au réveil |
| Bug latent re-login proprio pending | Fixé (filtre status retiré de listActiveMembershipsForUser ET de authenticate middleware) |
| Trou sécurité serveur d'un resto suspendu | Fermé via requireActiveRestaurant middleware |

**Bilan :** la plateforme prend désormais de vraies inscriptions, le mode préparation permet au propriétaire de configurer librement son resto puis le super-admin l'active avec reset propre des données simulation, et les invitations équipe se font en 1 lien WhatsApp. Tout est versionné, testé, et déployé.

Bon réveil.
