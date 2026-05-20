# Restaurant Pilote — Application de Gestion (MVP)

Application web full-stack de gestion d'un restaurant : stock, caisse, cuisine (KDS) et
statistiques, en temps réel, avec 3 rôles (Administrateur, Caissier, Cuisinier) et mode hors-ligne.

## Stack

- **Frontend** : React 18 + TypeScript, Vite, Tailwind CSS, React Router, Axios, socket.io-client, Dexie (offline)
- **Backend** : Node + Express + TypeScript, Socket.io, JWT, bcrypt, Zod, Prisma
- **Base de données** : PostgreSQL 15 (Docker en dev)

## Prérequis

- Node.js 18+ (testé avec Node 22)
- Docker Desktop (pour PostgreSQL en développement)

> Au **premier lancement de Docker Desktop**, il faut accepter l'accord de licence dans
> l'interface graphique avant que le moteur ne démarre.

## Démarrage rapide

### 1. Base de données (PostgreSQL via Docker)

Depuis la racine du projet :

```bash
docker compose up -d
```

Cela démarre PostgreSQL sur `localhost:5432` (base `restaurant_db`, user/mot de passe `restaurant`).

### 2. Backend

```bash
cd backend
npm install
npm run prisma:migrate     # crée les tables
npm run seed               # insère les données de démonstration
npm run dev                # démarre l'API + WebSocket sur http://localhost:3000
```

### 3. Frontend

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Ouvrir http://localhost:5173.

## Comptes de démonstration

| Rôle           | Identifiant | Mot de passe |
| -------------- | ----------- | ------------ |
| Administrateur | `admin`     | `admin123`   |
| Caissier       | `caisse1`   | `caisse123`  |
| Cuisinier      | `chef1`     | `chef123`    |
| Serveur        | `serveur1`  | `serveur123` |

## Variables d'environnement

### `backend/.env`

```
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://restaurant:restaurant@localhost:5432/restaurant_db?schema=public"
JWT_SECRET=...
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

### `frontend/.env`

```
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_APP_NAME=Restaurant Pilote
```

## Scripts utiles

### Backend (`cd backend`)

- `npm run dev` — serveur de développement (tsx watch)
- `npm run build` / `npm start` — build + exécution production
- `npm run prisma:migrate` — migrations
- `npm run prisma:studio` — explorateur de base Prisma
- `npm run seed` — données de démonstration
- `npm test` — tests unitaires (logique métier + smoke API, sans DB)
- `npm run type-check` — vérification TypeScript

### Frontend (`cd frontend`)

- `npm run dev` — serveur Vite
- `npm run build` — build production
- `npm test` — tests
- `npm run type-check` — vérification TypeScript

## Architecture

```
.
├── docker-compose.yml          # PostgreSQL (dev)
├── backend/
│   ├── prisma/                 # schema.prisma + seed.ts
│   └── src/
│       ├── config/             # env, client Prisma
│       ├── controllers/        # contrôleurs HTTP
│       ├── routes/             # routes Express (+ permissions par rôle)
│       ├── services/           # logique métier (transactions, stock, stats…)
│       ├── middlewares/        # auth, validation, rate-limit, erreurs
│       ├── validators/         # schémas Zod
│       ├── websocket/          # Socket.io (rooms par rôle)
│       ├── app.ts / server.ts
│       └── utils/
└── frontend/
    └── src/
        ├── contexts/           # Auth, WebSocket, Notifications
        ├── components/         # Layout, Navigation, ProtectedRoute…
        ├── pages/              # Login, Caisse, Cuisine, Admin, Dashboard
        ├── services/           # api (axios), socket, endpoints, offline (Dexie)
        ├── hooks/              # useClock, useOfflineSync
        └── utils/
```

## Fonctionnalités

- **Authentification** JWT (access 24h + refresh 7j), bcrypt, rate-limiting sur le login.
- **Caisse** : menu filtrable, panier, réductions (montant/%), paiement (espèces/mobile money/carte),
  reçu imprimable. Décrément automatique du stock à la validation.
- **Cuisine (KDS)** : réception temps réel, statuts séquentiels (commandée → en cours → prête),
  temps écoulé, notifications visuelle + sonore.
- **Admin** : gestion stock (+ recettes), menu, utilisateurs ; alertes de stock faible.
- **Dashboard** : KPIs, ventes par heure, top plats, modes de paiement, export PDF/CSV.
- **Temps réel** : WebSocket (rooms par rôle) pour commandes, statuts et alertes stock.
- **Hors-ligne** : cache du menu (IndexedDB) et file de commandes synchronisée à la reconnexion.
- **Service à table (serveurs & tables)** : rôle **serveur**, plan de **Salle** (tables libres/occupées,
  serveur affecté, addition en cours), prise de commande **rattachée à une table** avec choix
  **encaisser maintenant** ou **régler à la caisse plus tard** (paiement différé), puis **règlement de
  l'addition** à la caisse qui libère la table.

## Notes d'implémentation

- La logique métier (numéro de commande `YYYYMMDD-NNN`, décrément de stock, transitions de statut)
  est implémentée en TypeScript dans des transactions Prisma plutôt qu'en fonctions PL/pgSQL,
  pour une source de vérité unique et testable.
- Montants en entiers (FCFA, sans centimes) ; quantités de stock en flottants arrondis à 2 décimales.
- Auth par Bearer token (header `Authorization`) : pas de CSRF (non applicable) ; sécurité assurée
  par helmet, CORS strict, rate-limiting et sanitization des entrées.

## Déploiement (plus tard)

Pour la production, héberger PostgreSQL sur un service gratuit (ex. **Neon** — réveil automatique,
sans carte) et renseigner `DATABASE_URL`. Build : `npm run build` (frontend + backend).
