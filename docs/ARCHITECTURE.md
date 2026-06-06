# Architecture technique — Restoflow

## 1. Stack

| Couche | Technologies |
| --- | --- |
| **Frontend** | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, React Router 6, Axios, socket.io-client, Dexie (IndexedDB), `vite-plugin-pwa` |
| **Backend** | Node.js 18+, Express 4, TypeScript (tsx), Socket.io 4, JWT, bcrypt, Zod, Prisma 5, helmet, CORS, express-rate-limit, compression, sanitize-html, pdfkit |
| **Base de données** | PostgreSQL (15 en local Docker / cluster dédié ; Railway en prod) |
| **Tests** | Vitest (front + back), Supertest, @testing-library/react, jsdom |

## 2. Organisation du dépôt

```
restaurant-mvp/
├── docker-compose.yml        # PostgreSQL (dev local)
├── README.md                 # Démarrage rapide
├── CHANGELOG.md              # Journal des évolutions
├── CLAUDE.md                 # Règles projet (dont mise à jour de la doc)
├── scripts/
│   └── sync-docs.mjs         # Génère les sections AUTO:* de la doc depuis le code
├── docs/                     # Documentation de référence (ce dossier)
│   └── superpowers/          # specs / plans / rapports par fonctionnalité
├── backend/
│   ├── prisma/               # schema.prisma + migrations/ + seed.ts + scripts d'amorçage
│   └── src/
│       ├── config/           # env, prisma, prisma-extension, tenant-context
│       ├── controllers/      # handlers HTTP (un par domaine)
│       ├── services/         # logique métier (transactions Prisma)
│       ├── routes/           # routes Express + permissions (index.ts = agrégateur)
│       ├── middlewares/      # auth, tenant, validate, sanitize, rateLimit, errorHandler
│       ├── validators/       # schémas Zod
│       ├── websocket/        # Socket.io (rooms par rôle)
│       ├── utils/            # asyncHandler, errors, response, jwt, export, slug…
│       ├── constants.ts      # énumérations métier (rôles, statuts, barèmes paie…)
│       ├── app.ts            # configuration Express
│       └── server.ts         # point d'entrée (HTTP + WebSocket)
└── frontend/
    └── src/
        ├── pages/            # écrans (+ pages/admin/ pour les onglets de gestion)
        ├── components/       # Layout, Navigation, ProtectedRoute, bannières PWA…
        ├── contexts/         # Auth, WebSocket, Notifications
        ├── services/         # api (axios), endpoints, auth-helpers, socket, offline (Dexie)
        ├── hooks/            # hooks réutilisables (ex. usePwaUpdate)
        ├── App.tsx           # définition des routes (lazy-loading)
        └── main.tsx          # point d'entrée React
```

## 3. Multi-tenant

- Toutes les entités opérationnelles portent une clé étrangère `restaurantId`.
- Un utilisateur est relié à un ou plusieurs restaurants via le modèle **`Membership`**
  (`user × restaurant × rôle`). Le restaurant actif est porté par le JWT.
- Le **contexte tenant** est injecté par middleware (`tenantContext`) qui pose `req.restaurantId`
  et `req.membership`. Les requêtes Prisma sont filtrées par ce tenant.
- Chaîne de middlewares des routes scopées :
  `authenticate → tenantContext → requireActiveRestaurant`.
  `requireActiveRestaurant` bloque les restaurants suspendus/rejetés (écrans dédiés côté front).

## 4. Authentification & autorisation

- **JWT** : access token court + refresh token. Mots de passe hachés **bcrypt**.
- Auth par **Bearer token** (header `Authorization`) → pas de CSRF applicable.
- **Rôles** : `propriétaire`, `administrateur`, `caissier`, `cuisinier`, `serveur`
  (+ super-admin plateforme). Les permissions sont déclarées par route (back) et par
  `ProtectedRoute` / `allowedRoles` (front).
- Sécurité transverse : `helmet`, CORS strict, **rate-limiting** (endpoints d'auth),
  **sanitization** des entrées (sanitize-html), validation **Zod**.
- Détail historique : un bug de décodage JWT (UTF-8, caractères accentués) a été corrigé en
  remplaçant `atob()` par `TextDecoder` (voir mémoire `jwt-utf8-decode-bug`).

## 5. Temps réel (WebSocket)

- **Socket.io** côté serveur (`backend/src/websocket/`), organisé en **rooms par rôle**.
- Événements émis sur les transitions de commande, alertes de stock et notifications.
- Côté front, `WebSocketContext` souscrit aux rooms et met à jour l'état applicatif.

## 6. Hors-ligne (PWA caisse)

- **Shell offline** précaché via `vite-plugin-pwa` (manifest + service worker Workbox).
- **Menu** mis en cache dans IndexedDB (**Dexie**) ; les commandes créées hors-ligne sont
  placées dans une **file de synchronisation** rejouée à la reconnexion.
- **Idempotence** : `clientId` (UUID) côté client → pas de doublon à la synchro ;
  atomicité stock/numéro de commande garantie côté serveur (transaction Prisma).
- **Installabilité** : icônes Restoflow (gold), favicon, theme-color ; bandeau de mise à jour
  (`UpdateBanner`) monté à la racine, hook `usePwaUpdate`. Les écrans hors périmètre offline
  affichent `OfflineNotice`.

## 7. Principes métier

- Numéro de commande au format `YYYYMMDD-NNN`, transitions de statut et décrément de stock
  implémentés **en TypeScript dans des transactions Prisma** (source de vérité unique, testable).
- **Montants en entiers FCFA** (sans centimes) ; quantités de stock en flottants arrondis 2 déc.
- Énumérations métier en **français accentué** (stockées en `VARCHAR`, validées par Zod).
- **Paie** : barèmes CNPS/ITS **ajustables par restaurant** (clé `payroll.config` dans
  `app_settings`) car l'accident du travail varie par secteur (2–5 %) et les plafonds évoluent.
- **Budget d'approvisionnement** : architecture **hybride**. Le moteur de répartition est une
  **fonction pure déterministe** (`backend/src/services/budget-engine.service.ts`, testée Vitest) —
  source de vérité des montants. Le service de données (`budget.service.ts`) collecte les signaux
  (achats / rotation via recettes / seuils), persiste l'arborescence `Budget → Section → Poste →
  Ligne` en transaction Prisma, et calcule le suivi budget vs réel. Une **couche IA optionnelle**
  (`budget-ai.service.ts`, SDK `@anthropic-ai/sdk`, modèle `claude-opus-4-8`) enrichit suggestions
  et conclusion ; elle **dégrade proprement** (renvoie `null`) sans `ANTHROPIC_API_KEY` ou en cas
  d'erreur, sans jamais bloquer la génération. Réglages du moteur dans `app_settings` (`budget.config`).

## 8. Déploiement

- Topologie prod : **backend + PostgreSQL sur Railway**, **frontend sur Vercel**.
- Variables d'environnement : voir [DEVELOPPEMENT.md](DEVELOPPEMENT.md).
