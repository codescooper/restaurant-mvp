# Design — Transformation en plateforme multi-tenant

> Date : 2026-05-25
> Statut : validé (brainstorming) — prêt pour planification (Phase 1 d'abord)
> Application concernée : Restaurant Pilote (backend Express/Prisma/Postgres, frontend React/Vite, temps réel Socket.io)

## 1. Objectif

Transformer l'application **mono-restaurant** actuelle en **plateforme multi-tenant** :

- un **propriétaire** s'inscrit et crée son restaurant ;
- le restaurant reste **en attente** jusqu'à validation par un **super-admin plateforme** ;
- une fois actif, le propriétaire **invite son équipe** (différents rôles) via des **liens d'invitation** partagés par ses propres moyens (WhatsApp/SMS) ;
- chaque restaurant est **totalement isolé** des autres ;
- chaque restaurant est **personnalisable** : couleur principale, logo, cover de connexion, background de l'espace de travail.

## 2. Décisions de cadrage (validées)

| Sujet | Décision | Alternatives écartées |
|---|---|---|
| **Isolation** | Base partagée + colonne `restaurantId` (isolation logique) | Schéma/base par restaurant (trop lourd, YAGNI) |
| **Accès** | Inscription publique **avec restaurant en attente** de validation super-admin (hybride) ; self-service complet ouvert plus tard via un drapeau | Inscription 100 % ouverte d'emblée ; invitation-seule pure |
| **Identité & appartenance** | Compte **global** ; login par **email** ; table `Membership {userId, restaurantId, role}` ; **multi-restaurants par personne** + sélecteur de restaurant | Un compte = un restaurant (trop limitant) |
| **Invitations** | **Liens/codes** générés côté plateforme, **partagés par le proprio** lui-même ; aucun envoi d'email requis | Envoi d'emails transactionnels (ajouté en P4) |
| **Stockage des images** | **Cloudinary**, **upload direct signé** depuis le navigateur ; on ne garde que l'**URL** en base | base64 en base (gonfle base + réponses API) ; upload via notre serveur |
| **Surfaces de personnalisation (v1)** | **1) page de connexion brandée** + **2) espace de travail** | Page publique de présentation → reportée en P4 |
| **Rôles** | Plateforme : `super_admin` (drapeau). Restaurant : `propriétaire` (créateur, droits étendus) + `administrateur`, `caissier`, `cuisinier`, `serveur` | « owner = administrateur tout court » |

## 3. Découpage en phases

Chaque phase aura **son propre plan d'implémentation**. On implémente **P1 d'abord**.

- **P1 — Fondation multi-tenant** *(bloquant, ~70 % de l'effort)* : entités `Restaurant`/`Membership`/super-admin ; `restaurantId` sur toutes les tables ; **scoping de toutes les requêtes** ; auth email + JWT scopé + sélecteur de restaurant ; isolation WebSocket ; corrections d'unicité ; **migration des données prod existantes** en restaurant #1.
- **P2 — Onboarding & invitations** : inscription proprio → resto *en attente* → validation super-admin ; console super-admin ; `Invitation` + liens (créer/révoquer/accepter) ; gestion des membres & rôles.
- **P3 — Personnalisation** : upload Cloudinary (logo/cover/background) ; thème par variables CSS ; application aux surfaces **1 + 2**.
- **P4 — Plus tard (hors périmètre)** : page publique de présentation, envoi d'emails automatique, facturation/abonnements, sous-domaines.

## 4. Architecture — modèle de données

### 4.1 Nouvelles entités

```
Restaurant
  id, name, slug (unique), status: 'pending' | 'active' | 'suspended', createdAt
  → branding (1-1), memberships[], invitations[], + toutes les entités tenant

Membership
  id, userId, restaurantId, role, isActive, createdAt
  @@unique([userId, restaurantId])         // le rôle vit ICI (plus sur User)

Invitation
  id, restaurantId, email, role, token (unique),
  status: 'pending' | 'accepted' | 'revoked' | 'expired',
  expiresAt, createdBy, acceptedAt, createdAt

RestaurantBranding (1-1 avec Restaurant)
  restaurantId (unique), primaryColor, logoUrl, coverUrl, backgroundUrl, updatedAt
```

### 4.2 Changements sur `User`

- **Ajout** : `email` (unique global, identifiant de login), `isSuperAdmin` (défaut `false`), `displayName` (optionnel, non unique).
- **Retrait** : `role` (déplacé dans `Membership`) ; l'unicité de `username` est supprimée — `username` est conservé/recopié en `displayName`.

### 4.3 `restaurantId` sur toutes les entités racine du tenant

À ajouter (FK vers `Restaurant`, index) : `Dish, StockItem, Order, Table, CashSession, Reservation, Promotion, Expense, Employee, Supplier, Purchase, Inventory, Notification, AuditLog, AppSetting`.

Les entités enfants héritent du restaurant **via leur parent** (filtrage appliqué dans les requêtes) : `OrderItem` (→ Order), `DishIngredient`/`DishVariant` (→ Dish), `VariantIngredient` (→ DishVariant), `ReservationItem` (→ Reservation), `InventoryLine` (→ Inventory), `NotificationRead` (→ Notification/User). On **dénormalisera `restaurantId`** sur `StockMovement` (et au besoin sur une autre table très sollicitée) pour la performance des historiques/stats.

### 4.4 Corrections d'unicité

| Avant (global) | Après |
|---|---|
| `User.username` unique | `User.email` unique (global) |
| `Table.name` unique | `@@unique([restaurantId, name])` |
| `Promotion.code` unique | `@@unique([restaurantId, code])` |
| `Order.orderNumber` unique | `@@unique([restaurantId, orderNumber])` + séquence `YYYYMMDD-NNN` **par restaurant** |
| `AppSetting.settingKey` unique | `@@unique([restaurantId, settingKey])` |

## 5. Auth & isolation

### 5.1 Login & sélecteur de restaurant

- `POST /auth/login` (email + mot de passe) → `{ user, memberships[] }` (restaurants actifs de l'utilisateur).
- 1 membership → sélection automatique ; plusieurs → **sélecteur de restaurant** côté front.
- `POST /auth/switch-restaurant` → ré-émet un JWT scopé sur le restaurant choisi (après vérification du membership actif).
- **JWT** : `{ userId, isSuperAdmin, restaurantId, role }`. Le `restaurantId` + `role` du token définissent le contexte actif.

### 5.2 Middleware tenant

Après `authenticate` : résout `req.restaurantId` depuis le token, vérifie que le `Membership (userId, restaurantId)` est **actif** (sinon 403), expose `req.membership = { restaurantId, role }`. `requireRole(...)` lit le rôle du membership.

### 5.3 Isolation des requêtes — **stratégie A (validée)**

- Le `restaurantId` du request est porté par un **`AsyncLocalStorage`**.
- Une **extension Prisma Client** (`$extends`) **injecte automatiquement** `where: { restaurantId }` sur `findMany/findFirst/findUnique/update/updateMany/delete/deleteMany/count` et **renseigne** `restaurantId` sur `create/createMany`, pour **tous les modèles tenant**.
- **Refus par défaut** : une opération sur un modèle tenant **sans** contexte restaurant **lève une erreur** (pas de requête « ouverte » accidentelle).
- **Garde-fous explicites** là où l'extension ne suffit pas : agrégations (`groupBy`, `aggregate`) du service stats, requêtes SQL brutes, et **transactions interactives** (utiliser le client étendu à l'intérieur). Ces points reçoivent un filtrage `restaurantId` manuel + des tests dédiés.
- **Super-admin** : opère via un **client Prisma non-scopé** explicite, réservé aux routes `/api/admin/*` (`isSuperAdmin` requis) — lister/valider/suspendre les restaurants.

### 5.4 Temps réel (WebSocket)

- Rooms renommées **`r:{restaurantId}:{role}`**.
- À la connexion socket : lecture du token → l'utilisateur ne rejoint **que** les rooms de son restaurant actif.
- Au **switch de restaurant** : ré-authentification de la socket (déconnexion/reconnexion avec le nouveau token).

### 5.5 Entrée brandée (pré-auth)

- `GET /api/public/restaurants/:slug/branding` (**sans auth**) → `{ primaryColor, logoUrl, coverUrl }`.
- Permet d'afficher le login **aux couleurs du restaurant** via une URL type `/r/:slug` ; le login générique de la plateforme reste neutre.

## 6. Onboarding & invitations (P2)

### 6.1 Inscription propriétaire

`POST /auth/signup` (email, mot de passe, nom, **nom du restaurant**) → crée `User` (si email nouveau) + `Restaurant (status='pending')` + `Membership (role='propriétaire')`. Le proprio voit un écran **« en attente de validation »** tant que le restaurant n'est pas `active`.

### 6.2 Console super-admin (`/admin`)

Réservée `isSuperAdmin`. Liste les restaurants `pending` ; actions : **activer** (`active`), **suspendre**, **refuser**. Un restaurant `pending`/`suspended` n'ouvre pas l'app complète à ses membres.

### 6.3 Invitations (restaurant `active` uniquement)

- Création (proprio/administrateur) : `POST /restaurant/invitations` (email + rôle) → `Invitation { token, expiresAt }` → renvoie un **lien `/invite/:token`** que le proprio partage lui-même. Révocation : `DELETE /restaurant/invitations/:id`.
- Acceptation `GET/POST /invite/:token` :
  - **email inconnu** → l'invité choisit mot de passe + nom → crée `User` + `Membership` (rôle de l'invitation) ;
  - **email déjà connu** → ajoute simplement un `Membership` (apparaît au prochain login dans le sélecteur) ;
  - token **expiré/révoqué/déjà utilisé** → message clair, aucun accès.

### 6.4 Gestion des membres

Proprio/administrateur : lister les membres, **changer le rôle**, **désactiver** un accès (`Membership.isActive=false`), révoquer les invitations en attente.

### 6.5 Bootstrap super-admin

Créé via le **seed** / variables d'environnement (email + mot de passe initial). Pas de super-admin auto-inscrit.

## 7. Personnalisation (P3)

### 7.1 Upload Cloudinary (direct signé)

- `POST /restaurant/branding/upload-signature` (proprio/administrateur) → signature d'upload.
- Le navigateur **téléverse directement** vers Cloudinary (les images ne transitent ni par Railway ni par la base), puis envoie l'URL obtenue à `PUT /restaurant/branding`.
- *Upload preset* : dossier **par restaurant** (`restaurants/{id}/`), formats/tailles limités, **variantes optimisées** générées par Cloudinary (covers/miniatures).
- 3 visuels : **logo** (carré ~256), **cover** (bannière large), **background** (appliqué avec **voile de lisibilité**).

### 7.2 Thème couleur (variables CSS)

- Stockage de `primaryColor`. À l'ouverture de l'app : injection d'une variable CSS `--color-primary` à la racine ; Tailwind configuré pour la lire.
- **Refactor frontend** : remplacer les couleurs primaires *en dur* (nav, boutons, onglets, accents) par la classe thémée. Teintes hover/contraste **dérivées** (via `color-mix`), avec garantie de **lisibilité du texte** sur la couleur choisie.
- **Valeurs par défaut** propres si rien n'est configuré.

### 7.3 Chargement & application

- Après login + sélection : `GET /restaurant/branding` (authentifié) applique couleur + logo + background à l'espace de travail.
- Login brandé (surface 1) : via l'endpoint public par slug (§5.5).
- Onglet **« Personnalisation »** (réservé proprio/administrateur) : sélecteur de couleur, 3 uploaders avec aperçu, **aperçu en direct**, Enregistrer.

## 8. Migration des données existantes (intégrée à P1)

La prod contient déjà un restaurant réel (données + comptes seed). Migration **multi-étapes**, **testée sur copie**, avec **backup préalable** :

1. Créer `Restaurant` + insérer **« Restaurant #1 »** (`active`).
2. Ajouter chaque `restaurantId` en **nullable** → **backfill** vers le resto #1 → passer en `NOT NULL` + FK + index.
3. `User` : ajouter `email` (nullable), `isSuperAdmin` (défaut false), `displayName` (← `username`). Créer un `Membership` par utilisateur (rôle = ancien `role`) ; l'**administrateur actuel devient `propriétaire`** du resto #1. Emails manquants → **emails provisoires** `username@<slug>.local` (à corriger ensuite). Retirer `User.role` + unicité de `username`.
4. `AppSetting` (plafond remise, PIN manager) → rattachés au resto #1, unicité `(restaurantId, settingKey)`.
5. Créer le **compte super-admin** via seed / variables d'env.

## 9. Déploiement & variables d'environnement

Aucune nouvelle topologie (Railway back + Postgres, Vercel front). Nouvelles variables :

- **Backend** : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET` ; `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` (bootstrap) ; `APP_BASE_URL` (fabrication des liens d'invitation).
- **Frontend** : `VITE_CLOUDINARY_CLOUD_NAME`, base URL pour les liens d'invitation.

## 10. Tests & critères de succès

**Tests :**

- **Suite d'isolation (prioritaire)** : 2 restaurants semés ; pour chaque modèle tenant, vérifier qu'avec le contexte du resto A on ne lit/màj **jamais** les données du resto B, que la création scope bien, et qu'une opération **sans contexte lève une erreur**.
- **Auth/membership** : login renvoie les memberships ; `switch-restaurant` ; membership désactivé bloqué ; rôle appliqué **par restaurant** ; routes super-admin interdites aux non-super-admins.
- **Invitations** : créer/accepter (nouvel utilisateur **et** existant)/expirer/révoquer ; resto `pending` ne peut pas inviter.
- **Migration** : rejouée sur un jeu type-prod → toutes les lignes rattachées au resto #1, comptes préservés, app fonctionnelle.
- **Branding** : autorisation de la signature d'upload, validation de `PUT /restaurant/branding`, endpoint public par slug.

**Critères de succès :**

- Deux restaurants peuvent coexister sans qu'aucune donnée ne fuite (prouvé par la suite d'isolation).
- Un propriétaire peut s'inscrire, être activé, inviter un membre par lien, et ce membre accède au bon restaurant avec le bon rôle.
- Un restaurant peut définir couleur/logo/cover/background, visibles au login (par slug) et dans l'espace de travail.
- Les données prod existantes sont migrées sans perte dans le restaurant #1.

## 11. Risques & parades

| Risque | Parade |
|---|---|
| Fuite de données entre restaurants | Stratégie A *refus par défaut* + suite d'isolation systématique |
| Stats/`groupBy` & SQL brut contournent l'extension | Garde-fous `restaurantId` explicites + tests ciblés (service stats) |
| Gros refactor (~17 services) | Tout en P1, derrière les tests, de façon incrémentale |
| Migration sur données live | Test sur copie + backup + étapes nullable→backfill→not null |
| WebSocket après switch de restaurant | Ré-authentification de la socket au switch |
| Utilisateurs existants sans email | Emails provisoires `username@<slug>.local` signalés à corriger |

## 12. Hors périmètre (P4, plus tard)

Page publique de présentation (URL `/r/:slug` orientée clients) ; envoi d'emails automatique (invitations/vérification) ; facturation/abonnements ; sous-domaines par restaurant ; rôles personnalisés au-delà des 5 prévus.
